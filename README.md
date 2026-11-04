# Forge: self-service infrastructure on Kestra 2.0

**Story:** Forge is the TechOps platform team of a fictional company. Internal customers ask for servers and
software through a portal or a ServiceNow-style service desk. Every request becomes a Kestra flow: servers are
provisioned, Ansible configures them over SSH, and Kestra keeps the inventory (Assets) and escalates problems (Cases).
Everything runs locally in Docker; "servers" are small SSH containers, so Ansible works on them like real VMs.

```
 Portal (FastAPI)  ──►  Kestra flows  ──►  Ansible over SSH  ──►  Servers (Docker containers)
  Fleet · Service Desk       │                                      ▲
                             ├─► Assets: server + software inventory
                             └─► Cases:  failures and unmappable requests
```

## Run it

```bash
cp .env.example .env     # add your EE license (Apps, Assets and Cases are EE features)
make up                  # first run takes a few minutes (images, Ansible runner)
```

| What | URL |
|---|---|
| Forge portal (Fleet + Service Desk) | http://localhost:8000 |
| Kestra | http://localhost:8080 (login from `.env`) |

`make reset` clears servers and tickets between demo runs. `make down` stops, `make clean` deletes all data.
Stop any other demo stack first, including Pulse (ports 8000, 8080 and 5432).

The portal opens with a **How Forge works** section: a wireframe three.js diagram of the architecture, with the two ways to
request a server (this portal, or a Kestra App) converging on the same flow. Use it to frame the demo, then collapse it.
three.js r128 (MIT) is vendored in `app/static/vendor/`, so the diagram works offline.

## What each piece shows

| Kestra capability | Where in Forge |
|---|---|
| **Flows** + **Subflow**, **Loop** (2.0) | `route_request` runs the planned steps one by one |
| **Ansible** (`AnsibleCLI`) + namespace files | `install_software` runs `playbooks/install_software.yml` over SSH |
| **Assets** (2.0) | `provision_server` creates a server asset, `install_software` links software to it, `decommission_server` deletes it, `fleet_report` queries them |
| **Apps** | `forge_request_server` and `forge_install_software`: self-service forms in Kestra |
| **Cases** (2.0) | `open_case` raises a Case when an install fails or a request cannot be mapped |
| **AI** (`ChatCompletion`, Gemini) | `route_request` asks the model to pick workflows; output is validated and falls back to keyword rules |
| **Secrets**, **errors** handlers, `AllowFailure` | SSH key and API credentials; failure → Case |

## Flows (namespace `forge`)

| Flow | Does |
|---|---|
| `provision_server` | Starts a server container, registers it as an Asset |
| `install_software` | Ansible installs nginx / postgresql / redis / node-exporter; on failure opens a Case |
| `decommission_server` | Removes the server and its Asset |
| `route_request` | Service desk brain: AI plan → Subflows → ticket updates |
| `open_case` | Creates a Kestra Case |
| `fleet_report` | Lists server Assets |

## Layout

```
app/                 portal + "datacenter" API (FastAPI, one static page + architecture.js diagram)
node/                the server image (sshd + python3)
flows/               Kestra flows
apps/                Kestra Apps
namespace-files/     Ansible playbook + the request planner script
scripts/             bootstrap.sh, kapi.py (deploy flows, apps, files, secrets)
docs/demo-script.md  the 15-minute walkthrough
```

## Notes

- The AI step is optional. Without `KESTRA_GEMINI_API_KEY` (or offline) the keyword rules plan the request.
  The plan is validated, so the model can only run the three catalogued workflows.
- The portal never touches servers: it only starts Kestra executions, and reads fleet state straight from Docker.
- SSH keys are generated into `.keys/` by `make up` (gitignored) and stored as a Kestra secret.
- "Installed software" is simulated (config + version marker) so no internet is needed; the Ansible run is real.
- Kestra 2.0 syntax: `Loop` iterates with `item.value` (use `fromJson(...)` for objects); AnsibleCLI runs each
  `commands` entry separately, so chain with `&&` inside one entry.
