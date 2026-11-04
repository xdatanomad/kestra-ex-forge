"""Turns a service-desk request into an ordered list of Forge steps.

Input : request text, ticket id, and (optionally) the AI agent's JSON answer.
Output: patch.json (body for the ticket update) and steps.json (what the flow will run).

The AI answer is used only if it validates against the catalog; otherwise simple keyword rules
take over, so the demo works offline and the AI can never run an unknown workflow.
"""
import json, os, re, sys

text = os.environ.get("REQUEST_TEXT", "")
ticket = os.environ.get("TICKET_ID", "REQ0000000")
ai_raw = os.environ.get("AI_ANSWER", "")

PACKAGES = {"nginx", "postgresql", "redis", "node-exporter"}
SIZES = {"small", "medium", "large"}
SYNONYMS = {"postgres": "postgresql", "database": "postgresql", "db": "postgresql", "cache": "redis",
            "web server": "nginx", "webserver": "nginx", "monitoring": "node-exporter", "metrics": "node-exporter"}


def valid(step):
    f = step.get("flow")
    if f == "provision_server":
        return bool(step.get("server_name")) and step.get("size", "small") in SIZES
    if f == "install_software":
        return bool(step.get("server_name")) and step.get("package") in PACKAGES
    if f == "decommission_server":
        return bool(step.get("server_name"))
    return False


def from_ai(raw):
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    data = json.loads(raw)
    steps = data["steps"] if isinstance(data, dict) else data
    out = [s for s in steps if valid(s)]
    if not out and steps:
        raise ValueError("no valid steps")
    return out, (data.get("reasoning") if isinstance(data, dict) else "") or "Planned by the AI agent."


def from_rules(t):
    low = t.lower()
    m = re.search(r"(?:called|named|name)\s+[\"']?([a-z0-9][a-z0-9-]{1,22})", low)
    m2 = re.search(r"\b([a-z]+-\d{1,3})\b", low)  # e.g. web-01
    name = m.group(1) if m else (m2.group(1) if m2 else "srv-" + ticket[-4:])
    pkgs = []
    for word, pkg in list(SYNONYMS.items()) + [(p, p) for p in PACKAGES]:
        if word in low and pkg not in pkgs:
            pkgs.append(pkg)
    size = next((s for s in SIZES if s in low), "small")
    steps = []
    if re.search(r"decommission|tear ?down|delete|remove|shut ?down", low):
        steps.append({"flow": "decommission_server", "server_name": name})
        return steps, "Matched keywords: decommission."
    if re.search(r"\b(server|vm|box|machine|environment|host)\b", low) and re.search(r"new|need|provision|create|spin|set up|setup|stand", low):
        steps.append({"flow": "provision_server", "server_name": name, "size": size})
    for p in pkgs:
        steps.append({"flow": "install_software", "server_name": name, "package": p})
    return steps, "Matched keywords: " + ", ".join(["server"] * any(s["flow"] == "provision_server" for s in steps) + pkgs) + "."


source, reasoning = "rules", ""
try:
    steps, reasoning = from_ai(ai_raw)
    source = "ai"
except Exception:
    steps, reasoning = from_rules(text)

for s in steps:
    s["server_name"] = re.sub(r"[^a-z0-9-]", "", s["server_name"].lower())[:24]
    if s["flow"] == "provision_server":
        s.setdefault("size", "small")
        s["owner"] = os.environ.get("REQUESTER", "unknown")

summary = [{"flow": s["flow"], "detail": " ".join(str(v) for k, v in s.items() if k != "flow")} for s in steps]
with open("steps.json", "w") as f:
    json.dump(steps, f)
with open("patch.json", "w") as f:
    json.dump({"status": "In Progress" if steps else "Needs Attention", "plan": summary,
               "note": (f"{'AI agent' if source == 'ai' else 'Rule engine'}: {reasoning}" if steps
                        else "Could not map this request to a Forge workflow. A TechOps case was opened.")}, f)
print(f"source={source} steps={len(steps)}")
