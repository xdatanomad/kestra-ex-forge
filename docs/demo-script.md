# Forge demo: 15 minutes

Audience: platform / infrastructure teams. Message: one orchestrator for requests, provisioning, configuration,
inventory and escalation, with the portal as just another client.

1. **Frame it (2 min).** `make reset`. Open the portal: the **How It Works** tab is the landing page. Walk the two doors (portal, Kestra App) into one flow, then Ansible, servers, Assets and Cases. Use the "From this portal / From the app" buttons to show each door alone. Scroll to the flowcharts: "A service desk request" and "Provision a server, then install software" are the talk track for steps 3 to 7. Then switch to the Fleet tab.
2. **Provision from the portal (2 min).** Request `web-01`. Show the card appear, then Kestra → Executions →
   `provision_server`. Open **Assets**: the server is there with IP, size, owner.
3. **Ansible (2 min).** Install `nginx` on `web-01`. Chip appears on the card; show the Ansible log in the execution.
   Assets now shows the software linked to the server (lineage).
4. **Failure → Case (2 min).** Click **Fail it**. Execution fails, **Cases** has a new HIGH case with a link back
   to the execution. The Activity feed shows it too.
5. **Service desk + AI (4 min).** Service Desk tab, use the first example:
   *"I need a new server called web-01..."*, or the second for a two-package plan.
   Expand the ticket: plan chips, work notes (AI agent), link to the `route_request` execution. Fleet updates live.
6. **Unmappable request (1 min).** Example 4 (laptop keyboard). The agent returns no steps → ticket
   "Needs Attention" and a Case for a human.
7. **Apps (2 min).** Kestra → Apps: *Request a server* and *Install software* as self-service forms, no portal needed.
8. **Decommission (1 min).** Remove a server; the card disappears and the Asset is deleted.

Fallback if Gemini is unavailable: the plan note says "Rule engine"; behaviour is identical for the examples.
