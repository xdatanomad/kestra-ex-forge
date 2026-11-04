"""Forge portal: the "datacenter" and the self-service front end in one small app.

- The datacenter: starts/stops Docker containers that act as servers (sshd + python), so
  Kestra/Ansible manage them like real VMs. Fleet state is read from Docker, never faked.
- The service desk: a minimal ServiceNow-like ticket list. New tickets are sent to Kestra.
- The UI never talks to servers itself: every change goes through a Kestra flow.
"""
import json, os, socket, sqlite3, threading, time
from datetime import datetime, timezone

import docker
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

KESTRA_URL = os.environ.get("KESTRA_URL", "http://kestra:8080")
KESTRA_PUBLIC_URL = os.environ.get("KESTRA_PUBLIC_URL", "http://localhost:8080")
AUTH = (os.environ.get("KESTRA_USER", ""), os.environ.get("KESTRA_PASSWORD", ""))
NODE_IMAGE = os.environ.get("NODE_IMAGE", "forge-node")
NODE_NETWORK = os.environ.get("NODE_NETWORK", "forge-net")
KEY_FILE = os.environ.get("SSH_PUBLIC_KEY_FILE", "/keys/forge_ed25519.pub")
DB_PATH = os.path.join(os.environ.get("DATA_DIR", "/data"), "forge.db")
NS = "forge"
MAX_SERVERS = 8

app = FastAPI(title="Forge")
dk = docker.from_env()
lock = threading.Lock()


# ---------- tiny persistence (tickets + activity feed) ----------
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS tickets(
            id TEXT PRIMARY KEY, requester TEXT, text TEXT, status TEXT, plan TEXT, notes TEXT,
            exec_id TEXT, created TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, message TEXT)""")


init_db()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log_event(kind, message):
    with db() as c:
        c.execute("INSERT INTO events(ts, kind, message) VALUES (?,?,?)", (now(), kind, message))


# ---------- Kestra ----------
def run_flow(flow, **inputs):
    """Start a Kestra execution (multipart form = flow inputs). Returns the execution id."""
    files = {k: (None, str(v)) for k, v in inputs.items()}
    try:
        r = httpx.post(f"{KESTRA_URL}/api/v1/main/executions/{NS}/{flow}", files=files or {"_": (None, "")},
                       auth=AUTH, timeout=20)
        r.raise_for_status()
        return r.json()["id"]
    except Exception as e:  # keep the UI alive if Kestra is down
        log_event("error", f"Could not start Kestra flow {flow}: {e}")
        raise HTTPException(502, f"Kestra is not reachable: {e}")


# ---------- the "datacenter" ----------
_pkg_cache = {}


def packages_of(c):
    hit = _pkg_cache.get(c.name)
    if hit and time.time() - hit[0] < 2:
        return hit[1]
    pk = {}
    try:
        code, out = c.exec_run(["sh", "-c", 'for f in /opt/forge/packages/*; do [ -f "$f" ] && echo "$(basename $f)=$(cat $f)"; done'])
        for line in out.decode().splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                pk[k] = v
    except Exception:
        pass
    _pkg_cache[c.name] = (time.time(), pk)
    return pk


def servers():
    out = []
    for c in dk.containers.list(all=True, filters={"label": "forge.node=true"}):
        lb = c.labels
        ip = ""
        try:
            ip = c.attrs["NetworkSettings"]["Networks"][NODE_NETWORK]["IPAddress"]
        except Exception:
            pass
        out.append({
            "name": lb.get("forge.name"), "size": lb.get("forge.size"), "owner": lb.get("forge.owner"),
            "created": lb.get("forge.created"), "state": c.status, "ip": ip,
            "packages": packages_of(c) if c.status == "running" else {},
        })
    return sorted(out, key=lambda s: s["created"] or "")


def safe_name(n):
    n = "".join(ch for ch in (n or "").lower() if ch.isalnum() or ch == "-").strip("-")
    if not n:
        raise HTTPException(400, "invalid server name")
    return n[:24]


class ProvisionIn(BaseModel):
    name: str
    size: str = "small"
    owner: str = "unassigned"


@app.post("/internal/provision")
def provision(p: ProvisionIn):
    """Called by the provision_server flow. Starts the container and waits until SSH answers."""
    name = safe_name(p.name)
    with lock:
        current = servers()
        if any(s["name"] == name for s in current):
            raise HTTPException(409, f"server {name} already exists")
        if len(current) >= MAX_SERVERS:
            raise HTTPException(429, f"quota reached ({MAX_SERVERS} servers)")
        key = open(KEY_FILE).read().strip()
        dk.containers.run(
            NODE_IMAGE, name=f"forge-srv-{name}", hostname=name, detach=True, network=NODE_NETWORK,
            environment={"AUTHORIZED_KEY": key},
            labels={"forge.node": "true", "forge.name": name, "forge.size": p.size,
                    "forge.owner": p.owner, "forge.created": now()})
    host = f"forge-srv-{name}"
    for _ in range(60):
        try:
            socket.create_connection((host, 22), timeout=1).close()
            break
        except OSError:
            time.sleep(0.5)
    ip = next((s["ip"] for s in servers() if s["name"] == name), "")
    log_event("provisioned", f"{name} is up ({p.size}, owner {p.owner}, {ip})")
    return {"name": name, "host": host, "ip": ip, "size": p.size, "owner": p.owner, "status": "running"}


class NameIn(BaseModel):
    name: str


@app.post("/internal/decommission")
def decommission(p: NameIn):
    name = safe_name(p.name)
    try:
        dk.containers.get(f"forge-srv-{name}").remove(force=True)
    except docker.errors.NotFound:
        raise HTTPException(404, f"server {name} not found")
    log_event("decommissioned", f"{name} removed")
    return {"name": name, "status": "decommissioned"}


class EventIn(BaseModel):
    kind: str = "info"
    message: str


@app.post("/internal/events")
def add_event(e: EventIn):
    log_event(e.kind, e.message)
    return {"ok": True}


class TicketPatch(BaseModel):
    status: str | None = None
    plan: list | None = None
    note: str | None = None


@app.patch("/internal/tickets/{tid}")
def patch_ticket(tid: str, p: TicketPatch):
    with db() as c:
        row = c.execute("SELECT * FROM tickets WHERE id=?", (tid,)).fetchone()
        if not row:
            raise HTTPException(404)
        notes = json.loads(row["notes"] or "[]")
        if p.note:
            notes.append({"ts": now(), "text": p.note})
        c.execute("UPDATE tickets SET status=COALESCE(?,status), plan=COALESCE(?,plan), notes=? WHERE id=?",
                  (p.status, json.dumps(p.plan) if p.plan is not None else None, json.dumps(notes), tid))
    return {"ok": True}


# ---------- UI-facing API (every action starts a Kestra flow) ----------
class ServerReq(BaseModel):
    name: str
    size: str = "small"
    owner: str = "platform-team"


class SoftwareReq(BaseModel):
    package: str
    simulate_failure: bool = False


@app.post("/api/servers")
def api_provision(r: ServerReq):
    ex = run_flow("provision_server", server_name=safe_name(r.name), size=r.size, owner=r.owner)
    log_event("requested", f"Provision {r.name} → Kestra execution {ex}")
    return {"execution": ex}


@app.post("/api/servers/{name}/software")
def api_install(name: str, r: SoftwareReq):
    ex = run_flow("install_software", server_name=safe_name(name), package=r.package,
                  simulate_failure=str(r.simulate_failure).lower())
    log_event("requested", f"Install {r.package} on {name} → Kestra execution {ex}")
    return {"execution": ex}


@app.delete("/api/servers/{name}")
def api_decommission(name: str):
    ex = run_flow("decommission_server", server_name=safe_name(name))
    log_event("requested", f"Decommission {name} → Kestra execution {ex}")
    return {"execution": ex}


class TicketIn(BaseModel):
    requester: str = "alex.rivera"
    text: str


@app.post("/api/tickets")
def api_ticket(t: TicketIn):
    with db() as c:
        n = c.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] + 1001
        tid = f"REQ{n:07d}"
        c.execute("INSERT INTO tickets VALUES (?,?,?,?,?,?,?,?)",
                  (tid, t.requester, t.text, "New", "[]", "[]", None, now()))
    ex = run_flow("route_request", ticket_id=tid, requester=t.requester, request_text=t.text)
    with db() as c:
        c.execute("UPDATE tickets SET exec_id=? WHERE id=?", (ex, tid))
    log_event("ticket", f"{tid} submitted by {t.requester}")
    return {"id": tid, "execution": ex}


@app.get("/api/state")
def state():
    with db() as c:
        tickets = [dict(r) for r in c.execute("SELECT * FROM tickets ORDER BY created DESC, id DESC LIMIT 20")]
        events = [dict(r) for r in c.execute("SELECT * FROM events ORDER BY id DESC LIMIT 30")]
    for t in tickets:
        t["plan"] = json.loads(t["plan"] or "[]")
        t["notes"] = json.loads(t["notes"] or "[]")
    return {"servers": servers(), "tickets": tickets, "events": events, "kestra": KESTRA_PUBLIC_URL, "max": MAX_SERVERS}


@app.post("/api/reset")
def reset():
    for c in dk.containers.list(all=True, filters={"label": "forge.node=true"}):
        c.remove(force=True)
    with db() as c:
        c.execute("DELETE FROM tickets")
        c.execute("DELETE FROM events")
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")
