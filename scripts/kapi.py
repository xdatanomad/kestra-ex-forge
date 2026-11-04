#!/usr/bin/env python3
"""Tiny Kestra API helper for the Forge demo (stdlib only).

Credentials are read from .env (gitignored), never from the command line.

  kapi.py deploy [paths...]          create-or-update flows (default: flows/**/*.yml)
  kapi.py run <ns> <flow> [k=v ...]  trigger an execution and wait for the result
  kapi.py secret <ns> <KEY> <ENVVAR> store $ENVVAR (from .env) as a namespace secret
  kapi.py apps                       create-or-update the Apps in apps/\n  kapi.py files <ns>                 upload namespace-files/ to a namespace
  kapi.py secret-value <ns> <KEY> <file>  store a file's content as a namespace secret
  kapi.py rm-flow <ns> <flow>        delete a flow
  kapi.py rm-ns <ns>                 delete a namespace
"""
import base64, glob, json, os, re, sys, time, uuid
import urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("KESTRA_URL", "http://localhost:8080")
TENANT = "main"


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env")) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
AUTH = "Basic " + base64.b64encode(
    f"{ENV['KESTRA_BASIC_AUTH_USERNAME']}:{ENV['KESTRA_BASIC_AUTH_PASSWORD']}".encode()
).decode()


def call(method, path, body=None, ctype="application/json", extra=None):
    headers = {"Authorization": AUTH}
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else (
            body.encode() if isinstance(body, str) else json.dumps(body).encode())
        headers["Content-Type"] = ctype
    headers.update(extra or {})
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw[:1] in (b"{", b"[") else raw.decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def flow_ids(yml):
    ns = re.search(r"^namespace:\s*(\S+)", yml, re.M).group(1)
    fid = re.search(r"^id:\s*(\S+)", yml, re.M).group(1)
    return ns, fid


def deploy(paths):
    files = []
    for p in paths or [os.path.join(ROOT, "flows")]:
        files += sorted(glob.glob(os.path.join(p, "**", "*.yml"), recursive=True)) if os.path.isdir(p) else [p]
    ok = True
    for f in files:
        yml = open(f).read()
        ns, fid = flow_ids(yml)
        code, res = call("PUT", f"/api/v1/{TENANT}/flows/{ns}/{fid}", yml, "application/x-yaml")
        if code == 404:
            code, res = call("POST", f"/api/v1/{TENANT}/flows", yml, "application/x-yaml")
        status = "ok" if code < 300 else "FAILED"
        ok &= code < 300
        print(f"{status:6} {ns}/{fid} ({os.path.relpath(f, ROOT)})" + ("" if code < 300 else f"\n       {json.dumps(res)[:600]}"))
    return ok


def deploy_apps():
    ok = True
    _, found = call("GET", f"/api/v1/{TENANT}/apps/search?size=100")
    existing = {a["id"]: a["uid"] for a in found.get("results", [])}
    for f in sorted(glob.glob(os.path.join(ROOT, "apps", "*.yml"))):
        yml = open(f).read()
        aid = re.search(r"^id:\s*(\S+)", yml, re.M).group(1)
        if aid in existing:
            code, res = call("PUT", f"/api/v1/{TENANT}/apps/{existing[aid]}", yml, "application/x-yaml")
        else:
            code, res = call("POST", f"/api/v1/{TENANT}/apps", yml, "application/x-yaml")
        ok &= code < 300 or code == 304
        print(f"{'ok' if code < 300 or code == 304 else 'FAILED':6} app {aid}" + ("" if code < 300 or code == 304 else f" {code} {json.dumps(res)[:300]}"))
    return ok


def upload_files(ns):
    base = os.path.join(ROOT, "namespace-files")
    ok = True
    for f in sorted(glob.glob(os.path.join(base, "**", "*"), recursive=True)):
        if not os.path.isfile(f):
            continue
        rel = os.path.relpath(f, base)
        bd = uuid.uuid4().hex
        body = (f'--{bd}\r\nContent-Disposition: form-data; name="fileContent"; filename="{os.path.basename(f)}"\r\n'
                f'Content-Type: application/octet-stream\r\n\r\n').encode() + open(f, "rb").read() + f"\r\n--{bd}--\r\n".encode()
        code, res = call("POST", f"/api/v1/{TENANT}/namespaces/{ns}/files?path=/{rel}", body, f"multipart/form-data; boundary={bd}")
        ok &= code < 300
        print(f"{'ok' if code < 300 else 'FAILED':6} {ns}:/{rel}" + ("" if code < 300 else f" {code} {str(res)[:200]}"))
    return ok


def run(ns, fid, kv):
    bd = uuid.uuid4().hex
    parts = "".join(
        f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'
        for k, v in (a.split("=", 1) for a in kv))
    code, ex = call("POST", f"/api/v1/{TENANT}/executions/{ns}/{fid}",
                    (parts + f"--{bd}--\r\n").encode(), f"multipart/form-data; boundary={bd}")
    if code >= 300:
        print(code, ex)
        return False
    eid = ex["id"]
    for _ in range(180):
        _, s = call("GET", f"/api/v1/{TENANT}/executions/{eid}")
        if s["state"]["current"] in ("SUCCESS", "FAILED", "WARNING", "KILLED", "CANCELLED"):
            break
        time.sleep(1)
    print(eid, s["state"]["current"])
    for t in s.get("taskRunList", []):
        print(f"  {t['state']['current']:8} {t['taskId']}")
    return s["state"]["current"] == "SUCCESS"


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    cmd, a = argv[0], argv[1:]
    if cmd == "deploy":
        return 0 if deploy(a) else 1
    if cmd == "apps":
        return 0 if deploy_apps() else 1
    if cmd == "files":
        return 0 if upload_files(a[0]) else 1
    if cmd == "secret-value":
        ns, key, path = a
        code, res = call("PUT", f"/api/v1/{TENANT}/namespaces/{ns}/secrets", {"key": key, "value": open(path).read()})
        print(code, "" if code < 300 else res)
        return 0 if code < 300 else 1
    if cmd == "run":
        return 0 if run(a[0], a[1], a[2:]) else 1
    if cmd == "secret":
        ns, key, var = a
        code, res = call("PUT", f"/api/v1/{TENANT}/namespaces/{ns}/secrets", {"key": key, "value": ENV[var]})
        print(code, "" if code < 300 else res)
        return 0 if code < 300 else 1
    if cmd == "rm-flow":
        print(call("DELETE", f"/api/v1/{TENANT}/flows/{a[0]}/{a[1]}")[0])
        return 0
    if cmd == "rm-ns":
        print(call("DELETE", f"/api/v1/{TENANT}/namespaces/{a[0]}")[0])
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
