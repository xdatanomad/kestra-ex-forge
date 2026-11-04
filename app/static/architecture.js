/* Forge architecture diagram: lines only, no filled objects.
   Two doors (the portal, a Kestra App) lead to the same Kestra flow; Kestra then drives Ansible, the servers,
   the Assets inventory and Cases. Small wireframe packets travel along each path. */
(function () {
  const el = document.getElementById("arch");
  if (!el) return;
  if (!window.THREE) { el.innerHTML = '<p class="meta" style="padding:20px">The 3D diagram needs static/vendor/three.min.js.</p>'; return; }
  const T = THREE;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- palette (follows the page theme) ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  const palette = () => ({ ink: css("--ink") || "#1b1f2a", mute: css("--mute") || "#6b7280",
                           brand: dark() ? "#9b8cff" : (css("--brand") || "#5b3df5"), app: dark() ? "#2dd4bf" : "#0d9488" });

  // ---------- scene ----------
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  el.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
  const group = new T.Group();
  scene.add(group);

  const mats = [];   // every line material, so theme and mode changes can recolour / dim it
  function mat(role, opacity, tag, dashed) {
    const m = dashed
      ? new T.LineDashedMaterial({ color: 0, transparent: true, opacity, dashSize: 0.22, gapSize: 0.16 })
      : new T.LineBasicMaterial({ color: 0, transparent: true, opacity });
    mats.push({ m, role, base: opacity, tag: tag || "" });
    return m;
  }
  function box(cx, cy, w, h, d, role, opacity, tag) {
    const o = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, h, d)), mat(role, opacity, tag));
    o.position.set(cx, cy, 0);
    group.add(o);
  }
  const V = (x, y) => new T.Vector3(x, y, 0);
  function line(points, role, opacity, tag, opts) {
    opts = opts || {};
    const g = new T.BufferGeometry().setFromPoints(points);
    const l = new T.Line(g, mat(role, opacity, tag, opts.dashed));
    if (opts.dashed) l.computeLineDistances();
    group.add(l);
    if (opts.arrow !== false) {               // open arrowhead, two short lines
      const a = points[points.length - 2], b = points[points.length - 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x), s = 0.26, sp = 0.5;
      const pts = [new T.Vector3(b.x - s * Math.cos(ang - sp), b.y - s * Math.sin(ang - sp), 0), b,
                   new T.Vector3(b.x - s * Math.cos(ang + sp), b.y - s * Math.sin(ang + sp), 0)];
      group.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), mat(role, opacity, tag)));
    }
  }

  // ---------- layout (world units) ----------
  const portal = [-7.1, 2.3], kapp = [-7.1, -2.3], kestra = [-1.6, 0], ansible = [3.7, 2.3], assets = [3.7, -1.45], cases = [3.7, -3.5], servers = [7.3, 0.3];

  box(portal[0], portal[1], 3.4, 1.6, 1.2, "brand", 0.95, "portal");
  box(kapp[0], kapp[1], 3.4, 1.6, 1.2, "app", 0.95, "app");
  box(kestra[0], 0.2, 3.9, 4.8, 2.0, "brand", 0.95);
  [[1.4, "install_software"], [0.3, "provision_server"], [-0.8, "route_request"]].forEach(f => box(kestra[0], f[0], 3.55, 0.78, 0.8, "ink", 0.55));
  box(ansible[0], ansible[1], 2.3, 1.1, 1.0, "ink", 0.8);
  box(assets[0], assets[1], 2.3, 1.1, 1.0, "ink", 0.8);
  box(cases[0], cases[1], 2.3, 1.1, 1.0, "ink", 0.8);
  [1.2, 0.3, -0.6].forEach(y => box(servers[0], y, 2.4, 0.72, 1.0, "ink", 0.8));

  // connections
  const kEdge = kestra[0] - 1.95, kRight = kestra[0] + 1.95;
  line([V(portal[0] + 1.7, portal[1]), V(kEdge, 1.2)], "brand", 0.95, "portal");
  line([V(kapp[0] + 1.7, kapp[1]), V(kEdge, -1.2)], "app", 0.95, "app");
  line([V(kRight, 0.3), V(servers[0] - 1.2, 0.3)], "ink", 0.8);                         // provision
  line([V(kRight, 1.4), V(ansible[0] - 1.15, ansible[1] - 0.2)], "ink", 0.8);           // to Ansible
  line([V(ansible[0] + 1.15, ansible[1] - 0.2), V(servers[0] - 1.2, 1.2)], "ink", 0.8); // Ansible to servers (SSH)
  line([V(kRight, -0.9), V(assets[0] - 1.15, assets[1] + 0.1)], "ink", 0.8);
  line([V(kRight, -1.5), V(cases[0] - 1.15, cases[1] + 0.25)], "ink", 0.8);
  line([V(servers[0], 1.65), V(servers[0], 3.75), V(portal[0], 3.75), V(portal[0], 3.15)], "mute", 0.7, "", { dashed: true });  // fleet state

  // ---------- packets (small wireframe diamonds travelling along paths) ----------
  const packets = [];
  function packet(points, role, tag, speed, phase) {
    const lens = [0]; for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + points[i].distanceTo(points[i - 1]));
    const o = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(0.27)), mat(role, 1, tag));
    group.add(o);
    packets.push({ o, tag, points, lens, total: lens[lens.length - 1], speed, phase });
  }
  const toKestra = [V(-1.6, 0.3), V(kRight, 0.3), V(servers[0] - 1.2, 0.3)];
  const portalPath = [V(portal[0] + 1.7, portal[1]), V(kEdge, 1.2), ...toKestra];
  const appPath = [V(kapp[0] + 1.7, kapp[1]), V(kEdge, -1.2), ...toKestra];
  [0, 0.5].forEach(p => { packet(portalPath, "brand", "portal", 0.075, p); packet(appPath, "app", "app", 0.075, p + 0.25); });
  packet([V(-1.6, 1.4), V(kRight, 1.4), V(ansible[0] - 1.15, ansible[1] - 0.2)], "ink", "", 0.12, 0.1);
  packet([V(ansible[0] + 1.15, ansible[1] - 0.2), V(servers[0] - 1.2, 1.2)], "ink", "", 0.2, 0.6);
  packet([V(kRight, -0.9), V(assets[0] - 1.15, assets[1] + 0.1)], "ink", "", 0.16, 0.3);
  packet([V(kRight, -1.5), V(cases[0] - 1.15, cases[1] + 0.25)], "ink", "", 0.16, 0.75);

  // ---------- labels (HTML, projected from 3D) ----------
  const labels = [];
  function label(x, y, title, sub, cls, tag) {
    const d = document.createElement("div");
    d.className = "lbl " + (cls || "");
    d.innerHTML = title + (sub ? `<small>${sub}</small>` : "");
    el.appendChild(d);
    labels.push({ d, p: V(x, y), tag: tag || "" });
  }
  function node(x, y, h, title, sub, cls, tag) {
    label(x, y, title, "", cls, tag);
    if (sub) label(x, y - h / 2 - 0.28, sub, "", "s mute", tag);
  }
  node(portal[0], portal[1], 1.6, "This portal", "Fleet + Service Desk", "brand", "portal");
  node(kapp[0], kapp[1], 1.6, "Kestra App", "self-service form", "app", "app");
  label(kestra[0], 2.2, "Kestra 2.0", "", "brand");
  label(kestra[0], 1.4, "install_software", "", "s");
  label(kestra[0], 0.3, "provision_server", "", "s");
  label(kestra[0], -0.8, "route_request + AI", "", "s");
  node(ansible[0], ansible[1], 1.1, "Ansible", "configures over SSH");
  node(assets[0], assets[1], 1.1, "Assets", "server + software inventory");
  node(cases[0], cases[1], 1.1, "Cases", "failures and escalations");
  label(servers[0], 2.15, "Servers", "", "");
  label(servers[0], -1.4, "Docker containers", "", "s mute");
  label((servers[0] + portal[0]) / 2, 3.95, "fleet state is read straight from the servers", "", "s mute");

  // ---------- modes: both | portal | app ----------
  let mode = "both", active = true, raf = 0;
  function applyMode() {
    const col = palette();
    mats.forEach(x => {
      x.m.color.set(col[x.role]);
      const dim = mode !== "both" && x.tag && x.tag !== mode;
      x.m.opacity = dim ? 0.12 : x.base;
    });
    labels.forEach(l => { l.d.style.opacity = (mode !== "both" && l.tag && l.tag !== mode) ? 0.25 : 1; });
  }
  function visible(tag) { return mode === "both" || !tag || tag === mode; }

  // ---------- sizing, camera, parallax ----------
  let W = 0, H = 0, tx = 0, ty = 0;
  function size() {
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const t = Math.tan(camera.fov * Math.PI / 360);
    const dist = Math.max((9.1) / (t * camera.aspect), 5.0 / t) * 1.02;
    camera.position.set(-0.1, -0.15, dist); camera.lookAt(-0.1, -0.15, 0);
  }
  new ResizeObserver(size).observe(el);
  el.addEventListener("mousemove", e => {
    const r = el.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5; ty = ((e.clientY - r.top) / r.height - 0.5) * 0.22;
  });
  el.addEventListener("mouseleave", () => { tx = ty = 0; });

  const tmp = new T.Vector3();
  function frame(now) {
    if (!active) return;
    const t = now / 1000;
    group.rotation.y += ((tx + (reduce ? 0 : Math.sin(t * 0.35) * 0.07)) - group.rotation.y) * 0.06;
    group.rotation.x += ((ty + (reduce ? 0 : Math.sin(t * 0.27) * 0.025)) - group.rotation.x) * 0.06;
    packets.forEach(p => {
      p.o.visible = visible(p.tag);
      const u = ((t * p.speed + p.phase) % 1) * p.total;
      let i = 1; while (i < p.lens.length - 1 && p.lens[i] < u) i++;
      const k = (u - p.lens[i - 1]) / (p.lens[i] - p.lens[i - 1]);
      p.o.position.lerpVectors(p.points[i - 1], p.points[i], Math.min(Math.max(k, 0), 1));
      p.o.rotation.y = t * 1.6; p.o.rotation.x = t * 0.9;
    });
    labels.forEach(l => {
      tmp.copy(l.p); group.localToWorld(tmp); tmp.project(camera);
      l.d.style.transform = `translate(-50%,-50%) translate(${(tmp.x * 0.5 + 0.5) * W}px,${(-tmp.y * 0.5 + 0.5) * H}px)`;
    });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function setActive(on) {
    active = on; cancelAnimationFrame(raf);
    if (on) { size(); raf = requestAnimationFrame(frame); }
  }
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyMode);

  applyMode(); size(); raf = requestAnimationFrame(frame);
  window.forgeArch = { setActive, setMode: m => { mode = m; applyMode(); } };
})();
