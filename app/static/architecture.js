/* "How It Works" diagrams, in the Kestra house style (flat sheets, see sheet.js).
   1) the architecture: two doors into one set of Kestra flows (door buttons dim one path, dots show traffic)
   2) service-desk flowchart   3) provision + install flowchart
   Everything is plain config below; sheet.js does the drawing. Fixed-width text, so strings are kept short. */
(function () {
  // Rows are 104 apart so connectors between aligned cards are straight lines.
  const R = [124, 228, 332, 436];

  const ARCH = {
    id: "arch", w: 1200, h: 596, noTitle: true,
    zones: [
      { id: "doors", x: 24,  y: 48, w: 270, h: 500, tone: "neutral", title: "Two doors", sub: "Ways in" },
      { id: "kestra", x: 354, y: 48, w: 320, h: 500, tone: "cloud",  title: "Kestra 2.0", sub: "Runs the flows" },
      { id: "infra", x: 734, y: 48, w: 442, h: 500, tone: "cust",   title: "Infrastructure", sub: "What the flows touch" }
    ],
    cards: [
      { id: "portal", x: 48,  y: R[0], w: 222, h: 84, icon: "window", title: "This portal", sub: "Fleet + Desk", g: "portal" },
      { id: "app",    x: 48,  y: R[2], w: 222, h: 84, icon: "window", title: "Kestra App",  sub: "Request form", g: "app" },
      { id: "route",  x: 378, y: R[0], w: 272, h: 84, icon: "flow", title: "route_request",    sub: "AI plans the steps" },
      { id: "prov",   x: 378, y: R[1], w: 272, h: 84, icon: "flow", title: "provision_server", sub: "Starts a server", focus: true },
      { id: "inst",   x: 378, y: R[2], w: 272, h: 84, icon: "flow", title: "install_software", sub: "Runs the playbook" },
      { id: "case",   x: 378, y: R[3], w: 272, h: 84, icon: "flow", title: "open_case",        sub: "Raises a Case" },
      { id: "assets", x: 758, y: R[0], w: 188, h: 84, icon: "db",     title: "Assets",  sub: "Inventory" },
      { id: "servers",x: 968, y: R[1], w: 188, h: 84, icon: "server", title: "Servers", sub: "Containers" },
      { id: "ansible",x: 758, y: R[2], w: 188, h: 84, icon: "gear",   title: "Ansible", sub: "Over SSH" },
      { id: "cases",  x: 758, y: R[3], w: 188, h: 84, icon: "case",   title: "Cases",   sub: "Failures" }
    ],
    edges: [
      { id: "desk",  from: "portal.right", to: "route.left", kind: "conn", g: "portal", label: { text: "Tickets" } },
      { id: "fleet", from: "portal.right", to: "prov.left",  kind: "conn", g: "portal", label: { text: "Fleet" } },
      { id: "form1", from: "app.right",    to: "prov.left",  kind: "conn", g: "app", dash: true, label: { text: "Form" } },
      { id: "form2", from: "app.right",    to: "inst.left",  kind: "conn", g: "app", dash: true, label: { text: "Form" } },
      { id: "start", from: "prov.right",   to: "servers.left", kind: "task", label: { text: "Start" } },
      { id: "rec",   from: "prov.right",   to: "assets.left",  kind: "task", label: { text: "Register" } },
      { id: "play",  from: "inst.right",   to: "ansible.left", kind: "task", label: { text: "Playbook" } },
      { id: "ssh",   from: "ansible.right", to: "servers.bottom", kind: "task", label: { text: "SSH" } },
      { id: "fail",  from: "case.right",   to: "cases.left",   kind: "task", dash: true, label: { text: "Failure" } },
      { id: "back",  poly: [[1062, R[1]], [1062, 24], [159, 24], [159, R[0] - 2]], kind: "ink", dash: true, g: "portal", label: { text: "Fleet state", at: [610, 24] } }
    ],
    legend: [
      { kind: "conn", text: "From the portal" }, { kind: "conn", dash: true, text: "From the app" },
      { kind: "task", text: "Flow action" }, { kind: "task", dash: true, text: "On failure" }, { kind: "ink", dash: true, text: "Read back" }
    ]
  };

  // ---- service desk flowchart (spine runs left to right, then down) ----
  const C = (id, col, row, title, sub, o) => Object.assign({ id, x: 20 + col * 270, y: [40, 190, 370, 520][row], w: 220, h: 96, title, sub }, o);
  const DESK = {
    id: "desk", w: 1360, h: 670, noTitle: true,
    cards: [
      C("n1", 0, 0, "Submit request", "Service Desk tab", { badge: 1 }),
      C("n2", 1, 0, "triage", "Ticket: In Triage", { badge: 2 }),
      C("n3", 2, 0, "agent", "Gemini plans steps", { badge: 3 }),
      C("n4", 3, 0, "plan", "Check, else rules", { badge: 4 }),
      C("n5", 4, 0, "record_plan", "Ticket: In Progress", { badge: 5 }),
      C("d",  4, 1, "Steps planned?", "Any steps found?", { focus: true }),
      C("run", 2, 1, "run_steps", "Loop of subflows", { badge: 6 }),
      C("s1", 1, 2, "provision_server", "Subflow"),
      C("s2", 2, 2, "install_software", "Subflow"),
      C("s3", 3, 2, "decommission_server", "Subflow"),
      C("esc", 4, 2, "escalate", "Opens a Case", { badge: 6 }),
      C("res", 2, 3, "resolved", "Ticket: Resolved", { badge: 7 })
    ],
    edges: [
      { from: "n1.right", to: "n2.left", kind: "task" }, { from: "n2.right", to: "n3.left", kind: "task" },
      { from: "n3.right", to: "n4.left", kind: "task" }, { from: "n4.right", to: "n5.left", kind: "task" },
      { from: "n5.bottom", to: "d.top", kind: "task" },
      { from: "d.left", to: "run.right", kind: "task", label: { text: "Yes" } },
      { from: "d.bottom", to: "esc.top", kind: "ink", dash: true, label: { text: "No", kind: "ink" } },
      { from: "run.bottom", to: "s1.top", kind: "task" }, { from: "run.bottom", to: "s2.top", kind: "task" }, { from: "run.bottom", to: "s3.top", kind: "task" },
      { from: "s1.bottom", to: "res.top", kind: "task" }, { from: "s2.bottom", to: "res.top", kind: "task" }, { from: "s3.bottom", to: "res.top", kind: "task" }
    ],
    legend: [{ kind: "task", text: "Flow step" }, { kind: "ink", dash: true, text: "Escalation" }, { kind: "badge", text: "Task order" }]
  };

  // ---- provision + install (two zones, each a straight happy path) ----
  const P = (id, col, row, zy, title, sub, o) => Object.assign({ id, x: 44 + col * 300, y: zy + 80 + row * 104, w: 240, h: 84, title, sub }, o);
  const PROV = {
    id: "prov", w: 1240, h: 690, noTitle: true,
    zones: [
      { id: "zA", x: 20, y: 20,  w: 1200, h: 300, tone: "cloud", title: "provision_server", sub: "Creates the server, registers an Asset" },
      { id: "zB", x: 20, y: 352, w: 1200, h: 300, tone: "cust",  title: "install_software", sub: "Configures a server with Ansible" }
    ],
    cards: [
      P("a1", 0, 0, 20, "Fleet: Provision", "Portal button", { icon: "window", g: "portal" }),
      P("a2", 0, 1, 20, "Request a server", "Kestra App form", { icon: "window", g: "app" }),
      P("a3", 1, 0, 20, "create", "Starts a container", { icon: "container", badge: 1 }),
      P("a4", 2, 0, 20, "register", "Asset: VM", { icon: "db", badge: 2 }),
      P("a5", 3, 0, 20, "result", "Card + Asset", { icon: "server", focus: true }),
      P("b1", 0, 0, 352, "Fleet: Install", "Portal button", { icon: "window", g: "portal" }),
      P("b2", 0, 1, 352, "Install software", "Kestra App form", { icon: "window", g: "app" }),
      P("b3", 1, 0, 352, "ansible", "Runs the playbook", { icon: "gear", badge: 1 }),
      P("b4", 2, 0, 352, "play ok?", "Decision", { icon: "flow" }),
      P("b5", 3, 0, 352, "register + notify", "Software asset", { icon: "db", badge: 2 }),
      P("b6", 3, 1, 352, "errors: open_case", "Opens a Case", { icon: "case", badge: 2 })
    ],
    edges: [
      { from: "a1.right", to: "a3.left", kind: "conn", g: "portal" }, { from: "a2.right", to: "a3.left", kind: "conn", dash: true, g: "app" },
      { from: "a3.right", to: "a4.left", kind: "task" }, { from: "a4.right", to: "a5.left", kind: "task" },
      { from: "b1.right", to: "b3.left", kind: "conn", g: "portal" }, { from: "b2.right", to: "b3.left", kind: "conn", dash: true, g: "app" },
      { from: "b3.right", to: "b4.left", kind: "task" },
      { from: "b4.right", to: "b5.left", kind: "task", label: { text: "Yes" } },
      { from: "b4.bottom", to: "b6.left", kind: "task", dash: true, label: { text: "No" } }
    ],
    legend: [{ kind: "conn", text: "From the portal" }, { kind: "conn", dash: true, text: "From the app" }, { kind: "task", text: "Flow step" }, { kind: "badge", text: "Task order" }]
  };

  function mount(id, S) {
    const host = document.getElementById(id);
    if (!host) return null;
    host.classList.add("sheet");
    host.innerHTML = '<svg class="sh" xmlns="http://www.w3.org/2000/svg" role="img"></svg>';
    const svg = host.firstChild;
    svg.setAttribute("aria-label", id + " diagram");
    return { svg, ...window.renderSheet(svg, S) };
  }

  // ======================================================================
  // Architecture: door highlight + traffic dots
  // ======================================================================
  let mode = "both", active = true, raf = 0, frame = () => {};
  const routes = [];
  window.forgeArch = {   // usable before the diagram is drawn
    setActive(on) { active = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame); },
    setMode(m) {
      mode = m;
      const svg = document.querySelector("#arch svg");
      if (svg) { svg.classList.remove("m-portal", "m-app"); if (m !== "both") svg.classList.add("m-" + m); }
      routes.forEach(r => { if (!(m === "both" || !r.g || r.g === m)) r.el.style.display = "none"; });
    }
  };

  const arch = mount("arch", ARCH);
  if (arch) {
    const { svg, paths } = arch;
    if (mode !== "both") svg.classList.add("m-" + mode);
    // a dot rides one hop at a time (it is "inside" Kestra between hops)
    const add = (g, c, ids, phase) => routes.push({ g, c, paths: ids.map(i => paths[i]), phase });
    [0, 0.5].forEach(p => {
      add("portal", "conn", ["fleet", "start"], p);
      add("portal", "conn", ["desk"], p + 0.25);
      add("app", "conn", ["form1", "start"], p + 0.1);
      add("app", "conn", ["form2", "play", "ssh"], p + 0.35);
    });
    add("", "task", ["rec"], 0.3);
    add("", "task", ["fail"], 0.7);
    const layer = svg.querySelector(".dots");
    const SPEED = 170, PAUSE = 0.5, TAIL = 1.3;
    routes.forEach(r => {
      r.lens = r.paths.map(p => p.getTotalLength());
      r.cycle = r.lens.reduce((a, l) => a + l / SPEED, 0) + PAUSE * (r.paths.length - 1) + TAIL;
      layer.insertAdjacentHTML("beforeend", `<circle class="pulse ${r.c}" r="5.5" cx="-20" cy="-20"/>`);
      r.el = layer.lastElementChild;
    });
    frame = now => {
      if (!active) return;
      routes.forEach(r => {
        let t = ((now / 1000) + r.phase * r.cycle) % r.cycle, pt = null;
        for (let i = 0; i < r.paths.length; i++) {
          const dur = r.lens[i] / SPEED;
          if (t < dur) { pt = r.paths[i].getPointAtLength(t * SPEED); break; }
          t -= dur;
          if (t < PAUSE) break;
          t -= PAUSE;
        }
        const show = pt && (mode === "both" || !r.g || r.g === mode);
        r.el.style.display = show ? "" : "none";
        if (show) { r.el.setAttribute("cx", pt.x.toFixed(1)); r.el.setAttribute("cy", pt.y.toFixed(1)); }
      });
      raf = requestAnimationFrame(frame);
    };
    if (active) raf = requestAnimationFrame(frame);
  }

  mount("flow-desk", DESK);
  mount("flow-prov", PROV);
  const done = () => { if (window.__overflow && window.__overflow.length) console.warn("TEXT OVERFLOW\n" + window.__overflow.join("\n")); window.__ready = true; };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
    // text widths depend on the mono font: re-run the overflow check once it has loaded
    window.__overflow = [];
    document.querySelectorAll("svg.sh").forEach(svg => {
      const S = { arch: ARCH, desk: DESK, prov: PROV }[svg.parentNode.id.replace("flow-", "")] || ARCH;
      const byId = Object.fromEntries(S.cards.map(c => [c.id, c]));
      svg.querySelectorAll("text[data-c]").forEach(t => {
        const c = byId[t.dataset.c], b = t.getBBox();
        if (b.x < c.x + 8 || b.x + b.width > c.x + c.w - 8) window.__overflow.push(`${S.id}.${c.id}: "${t.textContent}" ${Math.round(b.width)}px in ${c.w - 16}px`);
      });
    });
    done();
  });
})();
