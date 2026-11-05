/* Forge diagrams, laid out by ELK (vendor/elk.bundled.js) and drawn as plain SVG.
   Nothing is positioned by hand: every box has the same size, ELK places the boxes and routes each connector
   orthogonally around them, and the SVG is drawn at its natural pixel size so the text never scales.
   1) the architecture (animated dots + the "both doors / portal / app" highlight)
   2) two flowcharts: what Kestra runs for a service-desk request, and for provisioning + installing software. */
(function () {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const W = 200, H = 78, DW = 140, DH = 80;          // one box size everywhere; diamonds are a bit smaller
  const LH = 15;                                      // fixed text metrics (monospace: 13px titles, 11px text)
  const tag = g => (g ? " t-" + g : "");
  const text = (x, y, t, cls, anchor) => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor || "middle"}">${esc(t)}</text>`;

  // ---------- node / edge constructors (a "spec" is turned into an ELK graph, then drawn) ----------
  const box = (id, t, s, o) => Object.assign({ id, kind: "box", t, s: s || "", w: W, h: H }, o);
  const diamond = (id, t) => ({ id, kind: "diamond", t, w: DW, h: DH });
  const group = (id, t, sub, children, o) => Object.assign({ id, kind: "group", t, sub, children }, o);
  const edge = (id, from, to, o) => Object.assign({ id, from, to }, o);

  const BASE = {
    "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.json.edgeCoords": "CONTAINER",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES", "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "elk.spacing.nodeNode": "30", "elk.layered.spacing.nodeNodeBetweenLayers": "64",
    "elk.spacing.edgeNode": "22", "elk.layered.spacing.edgeNodeBetweenLayers": "22",
    "elk.spacing.edgeEdge": "14", "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
    "elk.spacing.edgeLabel": "4", "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX", "elk.layered.nodePlacement.favorStraightEdges": "true", "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED", "elk.padding": "[top=0,left=0,bottom=0,right=0]"
  };
  const GROUP_PAD = "[top=46,left=20,bottom=22,right=20]";

  function toElk(n) {
    if (n.kind === "group") return { id: n.id, layoutOptions: { "elk.padding": GROUP_PAD }, children: n.children.map(toElk) };
    return { id: n.id, width: n.w, height: n.h };
  }
  function flat(nodes, out) { nodes.forEach(n => { out.push(n); if (n.children) flat(n.children, out); }); return out; }

  async function layout(nodes, edges, opts) {
    const elk = new ELK();
    const graph = {
      id: "root", layoutOptions: Object.assign({}, BASE, opts || {}),
      children: nodes.map(toElk),
      edges: edges.map(e => ({
        id: e.id, sources: [e.from], targets: [e.to]
      }))
    };
    const res = await elk.layout(graph);
    // absolute rectangles
    const rect = {};
    (function walk(list, ox, oy) { list.forEach(n => { rect[n.id] = { x: ox + n.x, y: oy + n.y, w: n.width, h: n.height }; if (n.children) walk(n.children, ox + n.x, oy + n.y); }); })(res.children, 0, 0);
    // edge coordinates are relative to the lowest group that contains both ends
    const parent = {};
    (function link(list, par) { list.forEach(n => { parent[n.id] = par; if (n.children) link(n.children, n.id); }); })(nodes, null);
    const chain = id => { const c = []; for (let p = parent[id]; p; p = parent[p]) c.push(p); return c; };
    const pts = {}, raw = {};
    res.edges.forEach((e, i) => {
      const a = chain(edges[i].from), b = chain(edges[i].to), lca = a.find(x => b.includes(x));
      const ox = lca ? rect[lca].x : 0, oy = lca ? rect[lca].y : 0, s = e.sections[0];
      pts[e.id] = [[s.startPoint.x, s.startPoint.y]].concat((s.bendPoints || []).map(b2 => [b2.x, b2.y]), [[s.endPoint.x, s.endPoint.y]]).map(q => [q[0] + ox, q[1] + oy]);
      raw[e.id] = pts[e.id]; pts[e.id] = smooth(raw[e.id], 14);
    });
    return { rect, pts, raw };
  }

  // round every corner of an orthogonal route (sampled quadratic curves), so lines and dots share one smooth path
  function smooth(p, r0) {
    const out = [p[0]], d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1], r = Math.min(r0, d(a, b) / 2, d(b, c) / 2);
      if (r < 1) { out.push(b); continue; }
      const u = [(b[0] - a[0]) / d(a, b), (b[1] - a[1]) / d(a, b)], v = [(c[0] - b[0]) / d(b, c), (c[1] - b[1]) / d(b, c)];
      const s0 = [b[0] - u[0] * r, b[1] - u[1] * r], s1 = [b[0] + v[0] * r, b[1] + v[1] * r];
      for (let k = 0; k <= 8; k++) { const t = k / 8, m = 1 - t; out.push([m * m * s0[0] + 2 * m * t * b[0] + t * t * s1[0], m * m * s0[1] + 2 * m * t * b[1] + t * t * s1[1]]); }
    }
    out.push(p[p.length - 1]);
    return out;
  }

  // ---------- drawing ----------
  function drawNode(n, r) {
    if (n.kind === "group") {
      let o = `<g class="grp ${n.c || "kestra"}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14"/>` +
        text(r.x + 18, r.y + 29, n.t, "tt kt", "start");
      if (n.sub) o += text(r.x + 18 + n.t.length * 7.8 + 14, r.y + 29, n.sub, "lab", "start");
      return o + "</g>";
    }
    if (n.kind === "diamond") {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const p = [[cx, r.y], [r.x + r.w, cy], [cx, r.y + r.h], [r.x, cy]].map(q => q.join(",")).join(" ");
      return `<g class="n ink"><polygon points="${p}"/>${text(cx, cy + 5, n.t, "tt")}</g>`;
    }
    const lines = n.s.split("|").filter(Boolean), cx = r.x + r.w / 2;
    const block = 14 + (lines.length ? 4 + lines.length * LH : 0), y0 = r.y + (r.h - block) / 2 + 12;
    let o = `<g class="n ${n.c || "ink"}${tag(n.g)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"/>` + text(cx, y0, n.t, "tt");
    lines.forEach((l, i) => { o += text(cx, y0 + 4 + (i + 1) * LH, l, "ss"); });
    if (n.n) o += `<g class="badge"><circle cx="${r.x + 6}" cy="${r.y + 6}" r="10"/><text x="${r.x + 6}" y="${r.y + 10}" text-anchor="middle">${n.n}</text></g>`;
    return o + "</g>";
  }
  // edge labels are not part of the layout. Default: the longest horizontal stretch; lp "vert": left of the first vertical stretch
  function labelAt(p, e) {
    if (e.lp === "vert") {
      for (let i = 1; i < p.length; i++) if (Math.abs(p[i][0] - p[i - 1][0]) < 1 && Math.abs(p[i][1] - p[i - 1][1]) > 1) return { x: p[i][0] - 6, y: (p[i][1] + p[i - 1][1]) / 2 + 4, a: "end" };
    }
    if (e.lp === "vr") {
      for (let i = 1; i < p.length; i++) if (Math.abs(p[i][0] - p[i - 1][0]) < 1 && Math.abs(p[i][1] - p[i - 1][1]) > 1) return { x: p[i][0] + 8, y: (p[i][1] + p[i - 1][1]) / 2 + 4, a: "start" };
    }
    let best = null;
    for (let i = 1; i < p.length; i++) {
      const len = Math.abs(p[i][0] - p[i - 1][0]);
      if (Math.abs(p[i][1] - p[i - 1][1]) < 1 && (!best || len > best.len)) best = { len, x: (p[i][0] + p[i - 1][0]) / 2, y: p[i][1] - 6 };
    }
    return best;
  }
  function drawEdge(e, p, raw) {
    const n = p.length, b = p[n - 1], a = p[n - 2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 8, hw = 3.8;
    const base = [b[0] - L * Math.cos(ang), b[1] - L * Math.sin(ang)];
    const line = p.slice(0, n - 1).concat([base]);
    const tri = [b, [base[0] - hw * Math.sin(ang), base[1] + hw * Math.cos(ang)], [base[0] + hw * Math.sin(ang), base[1] - hw * Math.cos(ang)]];
    const f = q => q.map(v => +v.toFixed(1)).join(",");
    let o = `<g class="a ${e.c || "ink"}${tag(e.g)}"><path d="M${line.map(f).join(" L")}"/><path class="hd" d="M${tri.map(f).join(" L")} Z"/>`;
    const lab = e.l && labelAt(raw, e);
    if (lab) o += text(lab.x, lab.y, e.l, "lab", lab.a);
    return o + "</g>";
  }
  // returns {svg, lay, w, h}; extra(rect) may add things above the diagram (returns {svg, top})
  async function render(el, label, nodes, edges, opts, extra, pre) {
    const lay = pre || await layout(nodes, edges, opts);
    const all = Object.values(lay.rect);
    const PAD = 14;
    let maxX = Math.max(...all.map(r => r.x + r.w)), maxY = Math.max(...all.map(r => r.y + r.h));
    const ex = extra ? extra(lay.rect) : { svg: "", top: 0 };
    const w = Math.ceil(maxX + 2 * PAD), h = Math.ceil(maxY + 2 * PAD + ex.top);
    let body = "";
    flat(nodes, []).filter(n => n.kind === "group").forEach(n => { body += drawNode(n, lay.rect[n.id]); });
    body += ex.svg;
    edges.forEach(e => { body += drawEdge(e, lay.pts[e.id], lay.raw[e.id]); });
    flat(nodes, []).filter(n => n.kind !== "group").forEach(n => { body += drawNode(n, lay.rect[n.id]); });
    body += `<g id="dots"></g>`;
    el.innerHTML = `<svg class="dg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><g transform="translate(${PAD},${PAD + ex.top})">${body}</g></svg>`;
    return { lay, svg: el.querySelector("svg") };
  }

  // ======================================================================
  // 1) Architecture
  // ======================================================================
  const archEl = document.getElementById("arch");
  let mode = "both", archSvg = null, active = true, raf = 0, frame = () => {};
  const routes = [];
  window.forgeArch = {   // usable before the layout is ready
    setActive(on) { active = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame); },
    setMode(m) {
      mode = m;
      if (archSvg) archSvg.classList.remove("m-portal", "m-app");
      if (archSvg && m !== "both") archSvg.classList.add("m-" + m);
      routes.forEach(r => { if (!(m === "both" || !r.g || r.g === m)) r.el.style.display = "none"; });
    }
  };
  if (archEl) {
    // The architecture is placed on an explicit grid (columns x rows) so related boxes line up and most
    // connectors are plain straight lines; elbows only where a line has to change row.
    const GAPX = 84, PITCH = 104, TOP = 80, COLX = c => c * (W + GAPX);
    const cell = (n, c, r) => { n.c0 = c; n.r0 = r; return n; };
    const kids = [
      cell(box("route", "route_request", "AI plans, runs the steps"), 1, 0),
      cell(box("prov", "provision_server", "starts a server,|registers it"), 1, 1),
      cell(box("inst", "install_software", "runs an Ansible playbook"), 1, 2),
      cell(box("case", "open_case", "raises a Case for a human"), 1, 3)
    ];
    const nodes = [
      cell(box("portal", "This portal", "Fleet + Service Desk", { c: "portal", g: "portal" }), 0, 0),
      cell(box("app", "Kestra App", "self-service forms", { c: "app", g: "app" }), 0, 2),
      group("kestra", "Kestra 2.0", "", kids),
      cell(box("servers", "Servers", "Docker containers"), 3, 1),
      cell(box("assets", "Assets", "server inventory"), 3, 2),
      cell(box("ansible", "Ansible", "over SSH"), 2, 2),
      cell(box("cases", "Cases", "failures, escalations"), 2, 3)
    ];
    const edges = [
      edge("e_desk", "portal", "route", { c: "portal", g: "portal", l: "tickets" }),
      edge("e_fleet", "portal", "prov", { c: "portal", g: "portal", l: "Fleet", lp: "vert" }),
      edge("e_form1", "app", "prov", { c: "app", g: "app", l: "form", lp: "vert" }),
      edge("e_form2", "app", "inst", { c: "app", g: "app", l: "form" }),
      edge("e_start", "prov", "servers", { l: "start" }),
      edge("e_rec", "prov", "assets", { ch: 10 }),
      edge("e_play", "inst", "ansible", { l: "playbook" }),
      edge("e_ssh", "ansible", "servers", { l: "SSH", lp: "vert", ch: -10 }),
      edge("e_fail", "case", "cases", { l: "failure" })
    ];
    const rect = {};
    flat(nodes, []).forEach(n => { if (n.r0 !== undefined) rect[n.id] = { x: COLX(n.c0), y: TOP + n.r0 * PITCH, w: n.w, h: n.h }; });
    rect.kestra = { x: COLX(1) - 20, y: TOP - 46, w: W + 40, h: 46 + 3 * PITCH + H + 22 };
    const raw = {}, pts = {};
    edges.forEach(e => {
      const a = rect[e.from], b = rect[e.to], x0 = a.x + a.w, y0 = a.y + a.h / 2, x1 = b.x, y1 = b.y + b.h / 2;
      const cx = x1 - GAPX / 2 + (e.ch || 0);
      raw[e.id] = Math.abs(y0 - y1) < 1 ? [[x0, y0], [x1, y1]] : [[x0, y0], [cx, y0], [cx, y1], [x1, y1]];
      pts[e.id] = smooth(raw[e.id], 14);
    });
    // the portal reads fleet state straight from the servers: a dashed line over the top of everything
    const extra = r => {
      const s = r.servers, p = r.portal, y = 14, sx = s.x + s.w / 2, px = p.x + p.w / 2;
      return { top: 0, svg: `<g class="a mute t-portal dash"><path d="M${sx},${s.y} L${sx},${y} L${px},${y} L${px},${p.y - 9}"/><path class="hd" d="M${px},${p.y - 1} L${px - 3.8},${p.y - 9} L${px + 3.8},${p.y - 9} Z"/></g>` +
        text((sx + px) / 2, y - 7, "fleet state is read straight from the servers", "lab") };
    };
    render(archEl, "Forge architecture", nodes, edges, {}, extra, { rect, pts, raw }).then(({ lay, svg }) => {
      archSvg = svg;
      if (mode !== "both") svg.classList.add("m-" + mode);
      // traffic dots follow the ELK routes; a dot is hidden between hops (it is "inside" Kestra)
      const P = (g, c, ids, phase) => routes.push({ g, c, segs: ids.map(i => lay.pts[i]), phase });
      [0, 0.5].forEach(p => {
        P("portal", "portal", ["e_fleet", "e_start"], p);
        P("portal", "portal", ["e_desk"], p + 0.25);
        P("app", "app", ["e_form1", "e_start"], p + 0.1);
        P("app", "app", ["e_form2", "e_play", "e_ssh"], p + 0.35);
      });
      P("", "ink", ["e_rec"], 0.3);
      P("", "ink", ["e_fail"], 0.7);
      const layer = svg.querySelector("#dots");
      const SPEED = 150, PAUSE = 0.55, TAIL = 1.4;
      routes.forEach(r => {
        r.lens = r.segs.map(s => s.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0));
        r.cycle = r.lens.reduce((a, l) => a + l / SPEED, 0) + PAUSE * (r.segs.length - 1) + TAIL;
        layer.insertAdjacentHTML("beforeend", `<circle class="dot ${r.c}" r="5" cx="-20" cy="-20"/>`);
        r.el = layer.lastElementChild;
      });
      const at = (seg, d) => { for (let i = 1; i < seg.length; i++) { const l = Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]); if (d <= l || i === seg.length - 1) { const k = l ? Math.min(d / l, 1) : 1; return [seg[i - 1][0] + (seg[i][0] - seg[i - 1][0]) * k, seg[i - 1][1] + (seg[i][1] - seg[i - 1][1]) * k]; } d -= l; } };
      frame = now => {
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
      if (active) raf = requestAnimationFrame(frame);
    });
  }

  // ======================================================================
  // 2) Flowchart: a service-desk request
  // ======================================================================
  const desk = document.getElementById("flow-desk");
  if (desk) {
    const nodes = [
      box("n1", "Submit request", "Service Desk tab|starts route_request", { c: "portal", n: 1 }),
      box("n2", "triage", "ticket becomes|In Triage", { n: 2 }),
      box("n3", "agent", "Gemini plans the steps|(optional)", { n: 3 }),
      box("n4", "plan", "check the plan, else|keyword rules", { n: 4 }),
      box("n5", "record_plan", "plan saved on ticket|In Progress", { n: 5 }),
      diamond("d", "steps planned?"),
      box("n6", "run_steps", "Loop, one step at a time|each step is a Subflow", { n: 6 }),
      box("s1", "provision_server", ""), box("s2", "install_software", ""), box("s3", "decommission_server", ""),
      box("n7", "resolved", "ticket becomes|Resolved", { n: 7 }),
      box("esc", "escalate", "open_case creates a Case|ticket: Needs Attention", { n: 6 })
    ];
    // same idea as the architecture: explicit grid (spine in the middle column), so the main path is one straight line
    const PY = 108, X = k => k * 236, cyOf = r => 10 + H / 2 + r * PY, rect = {};
    const put = (id, c, r, w, h) => { rect[id] = { x: X(c) + (W - w) / 2, y: cyOf(r) - h / 2, w, h }; };
    ["n1", "n2", "n3", "n4", "n5"].forEach((id, r) => put(id, 1, r, W, H));
    put("d", 1, 5, DW, DH); put("esc", 2, 5, W, H); put("n6", 1, 6, W, H);
    put("s1", 0, 7, W, H); put("s2", 1, 7, W, H); put("s3", 2, 7, W, H); put("n7", 1, 8, W, H);
    const edges = [];
    ["n1", "n2", "n3", "n4", "n5", "d"].slice(1).forEach((id, i) => edges.push(edge("c" + i, ["n1", "n2", "n3", "n4", "n5", "d"][i], id)));
    edges.push(edge("y", "d", "n6", { l: "yes", lp: "vr" }));
    ["s1", "s2", "s3"].forEach(t => { edges.push(edge("a" + t, "n6", t)); edges.push(edge("b" + t, t, "n7")); });
    edges.push(edge("no", "d", "esc", { l: "no", h: true }));
    const raw = {}, pts = {};
    edges.forEach(e => {
      const a = rect[e.from], b = rect[e.to];
      if (e.h) raw[e.id] = [[a.x + a.w, a.y + a.h / 2], [b.x, b.y + b.h / 2]];
      else {
        const x0 = a.x + a.w / 2, y0 = a.y + a.h, x1 = b.x + b.w / 2, y1 = b.y, my = (y0 + y1) / 2;
        raw[e.id] = Math.abs(x0 - x1) < 1 ? [[x0, y0], [x1, y1]] : [[x0, y0], [x0, my], [x1, my], [x1, y1]];
      }
      pts[e.id] = smooth(raw[e.id], 14);
    });
    render(desk, "Service desk request flowchart", nodes, edges, {}, null, { rect, pts, raw });
  }

  // ======================================================================
  // 3) Flowchart: provision a server, then install software
  // ======================================================================
  const prov = document.getElementById("flow-prov");
  if (prov) {
    const nodes = [
      group("gA", "provision_server", "creates the server and registers it as an Asset", [
        box("a1", "Fleet: Provision", "portal button", { c: "portal" }),
        box("a2", "Request a server", "Kestra App form", { c: "app" }),
        box("a3", "create", "HTTP call: starts a|container, waits|for SSH", { n: 1 }),
        box("a4", "register", "Asset: VM|(ip, size, owner)", { n: 2 }),
        box("a5", "result", "server card on Fleet|Asset in Kestra", { c: "kestra" })
      ], { c: "ink" }),
      group("gB", "install_software", "configures a server with Ansible", [
        box("b1", "Fleet: Install", "portal button", { c: "portal" }),
        box("b2", "Install software", "Kestra App form", { c: "app" }),
        box("b3", "ansible", "AnsibleCLI in Docker|SSH key from a secret|runs the playbook", { n: 1 }),
        diamond("b4", "play ok?"),
        box("b5", "register + notify", "Asset: software, linked|to the server (lineage)|activity feed updated", { n: 2 }),
        box("b6", "errors: open_case", "Subflow creates a|Kestra Case|(what Fail it does)", { n: 2 })
      ], { c: "ink" })
    ];
    // explicit grid again: the happy path of each flow is one straight line, the second entry point elbows in
    const CP = 250, GX = 50, rect = {};
    const putG = (id, c, r, gy, w, h) => { rect[id] = { x: 20 + c * CP + (W - w) / 2, y: gy + 46 + r * (H + 24) + (H - h) / 2, w, h }; };
    const GH = 46 + H + 24 + H + 22, GW = 40 + 3 * CP + W, GB = GH + 28;
    rect.gA = { x: 0, y: 0, w: GW, h: GH }; rect.gB = { x: 0, y: GB, w: GW, h: GH };
    putG("a1", 0, 0, 0, W, H); putG("a2", 0, 1, 0, W, H); putG("a3", 1, 0, 0, W, H); putG("a4", 2, 0, 0, W, H); putG("a5", 3, 0, 0, W, H);
    putG("b1", 0, 0, GB, W, H); putG("b2", 0, 1, GB, W, H); putG("b3", 1, 0, GB, W, H); putG("b4", 2, 0, GB, DW, DH);
    putG("b5", 3, 0, GB, W, H); putG("b6", 3, 1, GB, W, H);
    const edges = [
      edge("p1", "a1", "a3", { c: "portal" }), edge("p2", "a2", "a3", { c: "app" }),
      edge("p3", "a3", "a4"), edge("p4", "a4", "a5"),
      edge("q1", "b1", "b3", { c: "portal" }), edge("q2", "b2", "b3", { c: "app" }),
      edge("q3", "b3", "b4"), edge("q4", "b4", "b5", { l: "yes" }), edge("q5", "b4", "b6", { l: "no", lp: "vr", down: true })
    ];
    const raw = {}, pts = {};
    edges.forEach(e => {
      const a = rect[e.from], b = rect[e.to], x0 = a.x + a.w, y0 = a.y + a.h / 2, x1 = b.x, y1 = b.y + b.h / 2;
      if (e.down) raw[e.id] = [[a.x + a.w / 2, a.y + a.h], [a.x + a.w / 2, y1], [x1, y1]];
      else raw[e.id] = Math.abs(y0 - y1) < 1 ? [[x0, y0], [x1, y1]] : [[x0, y0], [x1 - GX / 2, y0], [x1 - GX / 2, y1], [x1, y1]];
      pts[e.id] = smooth(raw[e.id], 14);
    });
    render(prov, "Provision and install flowchart", nodes, edges, {}, null, { rect, pts, raw });
  }
})();
