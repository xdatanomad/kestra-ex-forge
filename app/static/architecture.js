/* Forge diagrams: flat 2D SVG, drawn from a few primitives so every connector starts and ends on a box edge.
   1) the architecture (with animated dots and the "both doors / portal / app" highlight)
   2) two flowcharts: what Kestra runs for a service-desk request, and for provisioning + installing software. */
(function () {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ---------- primitives (each returns SVG text) ----------
  const tag = g => (g ? " t-" + g : "");
  function text(x, y, t, cls, anchor) { return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor || "middle"}">${esc(t)}</text>`; }

  // box: x,y,w,h, t=title, s="line|line", c=colour class, g=highlight tag, n=step number
  function box(o) {
    const lines = (o.s || "").split("|").filter(Boolean), lh = 14;
    const block = 16 + (lines.length ? 5 + lines.length * lh : 0);
    const y0 = o.y + (o.h - block) / 2 + 13, cx = o.x + o.w / 2;
    let out = `<g class="n ${o.c || "ink"}${tag(o.g)}"><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10"/>`;
    out += text(cx, y0, o.t, o.sm ? "tt sm" : "tt");
    lines.forEach((l, i) => { out += text(cx, y0 + 5 + (i + 1) * lh, l, "ss"); });
    if (o.n) out += `<g class="badge"><circle cx="${o.x + 4}" cy="${o.y + 4}" r="10"/><text x="${o.x + 4}" y="${o.y + 8}" text-anchor="middle">${o.n}</text></g>`;
    return out + "</g>";
  }
  function diamond(o) {   // cx,cy,w,h
    const p = [[o.cx, o.cy - o.h / 2], [o.cx + o.w / 2, o.cy], [o.cx, o.cy + o.h / 2], [o.cx - o.w / 2, o.cy]];
    return `<g class="n ${o.c || "ink"}"><polygon points="${p.map(q => q.join(",")).join(" ")}"/>${text(o.cx, o.cy + 5, o.t, "tt sm")}</g>`;
  }
  // arrow along points [[x,y],...] ending in an open arrowhead; optional label {x,y,t,a}
  function arrow(pts, o) {
    o = o || {};
    const a = pts[pts.length - 2], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = 9;
    const h = [[b[0] - s * Math.cos(ang - 0.45), b[1] - s * Math.sin(ang - 0.45)], b, [b[0] - s * Math.cos(ang + 0.45), b[1] - s * Math.sin(ang + 0.45)]];
    const d = "M" + pts.map(p => p.join(",")).join(" L");
    let out = `<g class="a ${o.c || "ink"}${tag(o.g)}${o.dash ? " dash" : ""}"><path d="${d}"/><path class="hd" d="M${h.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")}"/>`;
    if (o.l) out += text(o.l.x, o.l.y, o.l.t, "lab", o.l.a);
    return out + "</g>";
  }
  const svg = (w, h, label, body) => `<svg class="dg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;

  // ======================================================================
  // 1) Architecture
  // ======================================================================
  const archEl = document.getElementById("arch");
  let mode = "both", archSvg = null;
  const routes = [];
  if (archEl) {
    const B = [];
    // doors
    B.push(box({ x: 30, y: 60, w: 200, h: 100, t: "This portal", s: "Fleet + Service Desk", c: "portal", g: "portal" }));
    B.push(box({ x: 30, y: 300, w: 200, h: 100, t: "Kestra App", s: "self-service forms", c: "app", g: "app" }));
    // Kestra
    B.push(`<g class="n kestra"><rect x="330" y="40" width="300" height="450" rx="14"/>${text(480, 64, "Kestra 2.0", "tt kt")}</g>`);
    B.push(box({ x: 350, y: 80, w: 260, h: 60, t: "route_request", s: "AI plans, runs the steps" }));
    B.push(box({ x: 350, y: 190, w: 260, h: 60, t: "provision_server", s: "starts a server, registers it" }));
    B.push(box({ x: 350, y: 300, w: 260, h: 60, t: "install_software", s: "runs an Ansible playbook" }));
    B.push(box({ x: 350, y: 420, w: 260, h: 60, t: "open_case", s: "raises a Case for a human" }));
    // targets
    B.push(box({ x: 730, y: 300, w: 200, h: 56, t: "Ansible", s: "over SSH" }));
    B.push(box({ x: 730, y: 150, w: 200, h: 120, t: "Servers", s: "Docker containers" }));
    B.push(box({ x: 730, y: 380, w: 200, h: 50, t: "Assets", s: "server inventory" }));
    B.push(box({ x: 730, y: 445, w: 200, h: 50, t: "Cases", s: "failures, escalations" }));
    // door arrows
    B.push(arrow([[230, 110], [350, 110]], { c: "portal", g: "portal", l: { x: 290, y: 102, t: "Service Desk" } }));
    B.push(arrow([[230, 140], [280, 140], [280, 205], [350, 205]], { c: "portal", g: "portal", l: { x: 272, y: 178, t: "Fleet buttons", a: "end" } }));
    B.push(arrow([[130, 300], [130, 235], [350, 235]], { c: "app", g: "app", l: { x: 240, y: 227, t: "app form" } }));
    B.push(arrow([[230, 330], [350, 330]], { c: "app", g: "app", l: { x: 290, y: 322, t: "app form" } }));
    // Kestra outputs
    B.push(arrow([[610, 330], [730, 330]], { l: { x: 670, y: 322, t: "playbook" } }));
    B.push(arrow([[830, 300], [830, 270]], { l: { x: 842, y: 290, t: "SSH", a: "start" } }));
    B.push(arrow([[610, 220], [730, 220]], { l: { x: 670, y: 212, t: "start container" } }));
    B.push(arrow([[630, 405], [730, 405]], { l: { x: 680, y: 397, t: "record" } }));
    B.push(arrow([[610, 470], [730, 470]], { l: { x: 670, y: 462, t: "on failure" } }));
    // fleet state read back by the portal
    B.push(arrow([[930, 210], [965, 210], [965, 26], [130, 26], [130, 58]], { c: "mute", g: "portal", dash: true }));
    B.push(text(548, 16, "fleet state is read straight from the servers", "lab"));
    B.push(`<g id="dots"></g>`);
    archEl.innerHTML = svg(1000, 510, "Forge architecture", B.join(""));
    archSvg = archEl.querySelector("svg");

    // traffic dots: [segment polylines], a dot is hidden between segments (it is "inside" Kestra)
    const P = (g, c, segs, phase) => routes.push({ g, c, segs, phase });
    const toServer = [[610, 220], [730, 220]];
    [0, 0.5].forEach(p => {
      P("portal", "portal", [[[230, 140], [280, 140], [280, 205], [350, 205]], toServer], p);
      P("portal", "portal", [[[230, 110], [350, 110]]], p + 0.25);
      P("app", "app", [[[130, 300], [130, 235], [350, 235]], toServer], p + 0.1);
      P("app", "app", [[[230, 330], [350, 330]], [[610, 330], [730, 330]], [[830, 300], [830, 270]]], p + 0.35);
    });
    P("", "ink", [[[630, 405], [730, 405]]], 0.3);
    P("", "ink", [[[610, 470], [730, 470]]], 0.7);
    const layer = archSvg.querySelector("#dots");
    const SPEED = 150, PAUSE = 0.55, TAIL = 1.4;
    routes.forEach(r => {
      r.lens = r.segs.map(s => s.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0));
      r.cycle = r.lens.reduce((a, l) => a + l / SPEED, 0) + PAUSE * (r.segs.length - 1) + TAIL;
      layer.insertAdjacentHTML("beforeend", `<circle class="dot ${r.c}" r="5" cx="-20" cy="-20"/>`);
      r.el = layer.lastElementChild;
    });
    const at = (seg, d) => { for (let i = 1; i < seg.length; i++) { const l = Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]); if (d <= l || i === seg.length - 1) { const k = Math.min(d / l, 1); return [seg[i - 1][0] + (seg[i][0] - seg[i - 1][0]) * k, seg[i - 1][1] + (seg[i][1] - seg[i - 1][1]) * k]; } d -= l; } };
    let active = true, raf = 0;
    const frame = now => {
      if (!active) return;
      routes.forEach(r => {
        let t = ((now / 1000) + r.phase * r.cycle) % r.cycle, pos = null;
        for (let i = 0; i < r.segs.length; i++) {
          const dur = r.lens[i] / SPEED;
          if (t < dur) { pos = at(r.segs[i], t * SPEED); break; }
          t -= dur;
          if (t < PAUSE) break;
          t -= PAUSE;
        }
        const show = pos && (mode === "both" || !r.g || r.g === mode);
        r.el.style.display = show ? "" : "none";
        if (show) { r.el.setAttribute("cx", pos[0].toFixed(1)); r.el.setAttribute("cy", pos[1].toFixed(1)); }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.forgeArch = {
      setActive(on) { active = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame); },
      setMode(m) {
        mode = m; archSvg.classList.remove("m-portal", "m-app"); if (m !== "both") archSvg.classList.add("m-" + m);
        routes.forEach(r => { if (!(m === "both" || !r.g || r.g === m)) r.el.style.display = "none"; });   // don't wait for the next frame
      }
    };
  }

  // ======================================================================
  // 2) Flowchart: a service-desk request
  // ======================================================================
  const desk = document.getElementById("flow-desk");
  if (desk) {
    const F = [], y1 = 30, h1 = 76, w1 = 164, xs = [20, 209, 398, 587, 776];
    const row = [
      { t: "Submit request", s: "Service Desk tab|starts route_request", c: "portal" },
      { t: "triage", s: "ticket becomes|In Triage" },
      { t: "agent", s: "Gemini plans the steps|(optional)" },
      { t: "plan", s: "check the plan, else|keyword rules" },
      { t: "record_plan", s: "plan saved on ticket|In Progress" }
    ];
    row.forEach((r, i) => { F.push(box({ x: xs[i], y: y1, w: w1, h: h1, t: r.t, s: r.s, c: r.c, n: i + 1 })); if (i) F.push(arrow([[xs[i - 1] + w1, y1 + h1 / 2], [xs[i], y1 + h1 / 2]])); });
    F.push(arrow([[858, y1 + h1], [858, 160]]));
    F.push(diamond({ cx: 858, cy: 200, w: 170, h: 80, t: "steps planned?" }));
    // yes: loop -> three subflows, then resolved
    F.push(arrow([[773, 200], [724, 200]], { l: { x: 748, y: 192, t: "yes" } }));
    F.push(box({ x: 524, y: 165, w: 200, h: 70, t: "run_steps", s: "Loop, one step at a time|each step is a Subflow", n: 6 }));
    F.push(arrow([[624, 235], [624, 262]]));
    const sub = [["provision_server", 250], ["install_software", 430], ["decommission_server", 610]];
    F.push(`<g class="a ink"><path d="M${250 + 80},262 L${610 + 80},262"/></g>`);
    sub.forEach(([t, x]) => { F.push(arrow([[x + 80, 262], [x + 80, 300]])); F.push(box({ x, y: 300, w: 160, h: 56, t, sm: true })); });
    F.push(arrow([[524, 200], [454, 200]]));
    F.push(box({ x: 290, y: 165, w: 164, h: 70, t: "resolved", s: "ticket becomes|Resolved", n: 7 }));
    // no: escalate
    F.push(arrow([[858, 240], [858, 300]], { l: { x: 870, y: 274, t: "no", a: "start" } }));
    F.push(box({ x: 790, y: 300, w: 190, h: 76, t: "escalate", s: "open_case creates a Case|ticket: Needs Attention", n: 6 }));
    F.push(text(20, 400, "If any step fails, the flow's errors handler marks the ticket Needs Attention (install_software also opens a Case).", "lab", "start"));
    desk.innerHTML = svg(1000, 415, "Service desk request flowchart", F.join(""));
  }

  // ======================================================================
  // 3) Flowchart: provision a server, then install software
  // ======================================================================
  const prov = document.getElementById("flow-prov");
  if (prov) {
    const F = [];
    // --- row A: provision_server
    F.push(text(20, 24, "provision_server", "tt h2", "start") + text(190, 24, "creates the server and registers it as an Asset", "lab", "start"));
    F.push(box({ x: 20, y: 46, w: 170, h: 56, t: "Fleet: Provision", s: "portal button", c: "portal" }));
    F.push(box({ x: 20, y: 118, w: 170, h: 56, t: "Request a server", s: "Kestra App form", c: "app" }));
    F.push(box({ x: 260, y: 66, w: 200, h: 90, t: "create", s: "HTTP call to the datacenter|starts a container,|waits for SSH", n: 1 }));
    F.push(arrow([[190, 74], [225, 74], [225, 96], [260, 96]], { c: "portal" }));
    F.push(arrow([[190, 146], [225, 146], [225, 126], [260, 126]], { c: "app" }));
    F.push(box({ x: 520, y: 66, w: 200, h: 90, t: "register", s: "Asset: VM|(ip, size, owner)", n: 2 }));
    F.push(arrow([[460, 111], [520, 111]]));
    F.push(box({ x: 780, y: 66, w: 200, h: 90, t: "result", s: "server card on Fleet|Asset in Kestra", c: "kestra" }));
    F.push(arrow([[720, 111], [780, 111]]));
    // --- row B: install_software
    F.push(text(20, 232, "install_software", "tt h2", "start") + text(190, 232, "configures a server with Ansible", "lab", "start"));
    F.push(box({ x: 20, y: 254, w: 170, h: 56, t: "Fleet: Install", s: "portal button", c: "portal" }));
    F.push(box({ x: 20, y: 326, w: 170, h: 56, t: "Install software", s: "Kestra App form", c: "app" }));
    F.push(box({ x: 260, y: 266, w: 200, h: 108, t: "ansible", s: "AnsibleCLI in Docker|SSH key from a secret|runs the playbook", n: 1 }));
    F.push(arrow([[190, 282], [225, 282], [225, 300], [260, 300]], { c: "portal" }));
    F.push(arrow([[190, 354], [225, 354], [225, 340], [260, 340]], { c: "app" }));
    F.push(arrow([[460, 320], [510, 320]]));
    F.push(diamond({ cx: 575, cy: 320, w: 130, h: 80, t: "play ok?" }));
    F.push(arrow([[640, 320], [700, 320]], { l: { x: 670, y: 312, t: "yes" } }));
    F.push(box({ x: 700, y: 266, w: 280, h: 108, t: "register + notify", s: "Asset: software, linked|to the server (lineage)|activity feed updated", n: 2 }));
    F.push(arrow([[575, 360], [575, 420]], { l: { x: 587, y: 396, t: "no", a: "start" } }));
    F.push(box({ x: 465, y: 420, w: 220, h: 76, t: "errors: open_case", s: "Subflow creates a Kestra Case|(the Fail it button does this)", n: 2 }));
    prov.innerHTML = svg(1000, 510, "Provision and install flowchart", F.join(""));
  }
})();
