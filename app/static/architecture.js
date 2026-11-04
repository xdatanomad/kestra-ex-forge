/* Forge architecture diagram: isometric, lines only (plus tiny dots for the traffic).
   Two doors (the portal, a Kestra App) lead to the same Kestra flow; Kestra then drives Ansible, the servers,
   the Assets inventory and Cases. Layout is written in screen units (H right, W down); P() maps it onto the
   isometric ground plane, so the board reads like a flat 2D diagram with isometric slabs standing on it. */
(function () {
  const el = document.getElementById("arch");
  if (!el) return;
  if (!window.THREE) { el.innerHTML = '<p class="meta" style="padding:20px">The diagram needs static/vendor/three.min.js.</p>'; return; }
  const T = THREE;

  // ---------- palette (follows the page theme) ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  const palette = () => ({ ink: css("--ink") || "#1b1f2a", mute: css("--mute") || "#6b7280",
                           brand: dark() ? "#9b8cff" : (css("--brand") || "#5b3df5"), app: dark() ? "#2dd4bf" : "#0d9488" });

  // ---------- true isometric camera ----------
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.domElement.style.display = "block";
  el.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  camera.position.set(60, 60, 60); camera.lookAt(0, 0, 0);

  const KX = 0.7071, KY = 0.4082, KH = 0.8165;      // iso foreshortening of x-z (horizontal), x+z (vertical), y
  const P = (h, w, y) => new T.Vector3((h / KX + w / KY) / 2, y || 0, (w / KY - h / KX) / 2);

  // ---------- materials ----------
  const mats = [];   // every line/dot material, so theme and mode changes can recolour / dim it
  function reg(m, role, base, tag) { mats.push({ m, role, base, tag: tag || "" }); return m; }
  const lineMat = (role, op, tag, dashed) => reg(dashed
    ? new T.LineDashedMaterial({ color: 0, transparent: true, opacity: op, dashSize: 0.28, gapSize: 0.2 })
    : new T.LineBasicMaterial({ color: 0, transparent: true, opacity: op }), role, op, tag);

  // ---------- isometric slab: only the 9 visible edges ----------
  function slab(h, w, dx, dz, ht, y0, role, op, tag) {
    const c = P(h, w, 0);
    const C = (sx, sz, top) => [c.x + sx * dx / 2, y0 + (top ? ht : 0), c.z + sz * dz / 2];
    const seg = [], add = (a, b) => seg.push(...a, ...b);
    add(C(-1, -1, 1), C(1, -1, 1)); add(C(1, -1, 1), C(1, 1, 1)); add(C(1, 1, 1), C(-1, 1, 1)); add(C(-1, 1, 1), C(-1, -1, 1));
    add(C(1, 1, 0), C(1, 1, 1)); add(C(1, -1, 0), C(1, -1, 1)); add(C(-1, 1, 0), C(-1, 1, 1));
    add(C(1, -1, 0), C(1, 1, 0)); add(C(-1, 1, 0), C(1, 1, 0));
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(seg, 3));
    scene.add(new T.LineSegments(g, lineMat(role, op, tag)));
  }

  // ---------- ground lines (screen coords [h, w]) ----------
  function line(pairs, role, op, tag, opts) {
    opts = opts || {};
    const pts = pairs.map(p => P(p[0], p[1], 0));
    const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), lineMat(role, op, tag, opts.dashed));
    if (opts.dashed) l.computeLineDistances();
    scene.add(l);
    const a = pairs[pairs.length - 2], b = pairs[pairs.length - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = 0.34, sp = 0.5;
    const head = [[b[0] - s * Math.cos(ang - sp), b[1] - s * Math.sin(ang - sp)], b, [b[0] - s * Math.cos(ang + sp), b[1] - s * Math.sin(ang + sp)]].map(p => P(p[0], p[1], 0));
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(head), lineMat(role, op, tag)));
  }

  // ---------- layout ----------
  const SM = 2.0, TH = 0.5;                                   // small slab footprint and thickness
  const portal = [-8.6, -2.2], kapp = [-8.6, 2.2], kestra = [-1.2, 0], ansible = [4.3, -3.0], assets = [4.3, 0.3], cases = [4.3, 3.6], servers = [8.6, -0.2];

  slab(portal[0], portal[1], SM, SM, TH, 0, "brand", 0.95, "portal");
  slab(kapp[0], kapp[1], SM, SM, TH, 0, "app", 0.95, "app");
  slab(kestra[0], kestra[1], 4.6, 4.6, 0.9, 0, "brand", 0.95);
  slab(ansible[0], ansible[1], SM, SM, TH, 0, "ink", 0.85);
  slab(assets[0], assets[1], SM, SM, TH, 0, "ink", 0.85);
  slab(cases[0], cases[1], SM, SM, TH, 0, "ink", 0.85);
  [0, 0.85, 1.7].forEach(y => slab(servers[0], servers[1], SM, SM, TH, y, "ink", 0.85));

  // connections (ground)
  line([[portal[0] + 1.41, portal[1]], [-3.95, -0.32]], "brand", 0.95, "portal");
  line([[kapp[0] + 1.41, kapp[1]], [-3.95, 0.32]], "app", 0.95, "app");
  line([[2.05, -0.2], [servers[0] - 1.41, -0.2]], "ink", 0.85);                      // provision
  line([[1.5, -0.3], [ansible[0] - 1.41 + 0.2, ansible[1] + 0.2]], "ink", 0.85);    // to Ansible
  line([[ansible[0] + 1.41, ansible[1]], [servers[0] - 0.9, -0.85]], "ink", 0.85);   // Ansible to servers (SSH)
  line([[1.5, 0.3], [assets[0] - 1.41, assets[1]]], "ink", 0.85);
  line([[0.6, 0.9], [cases[0] - 1.41, cases[1]]], "ink", 0.85);
  line([[servers[0], -2.3], [servers[0], -4.6], [portal[0], -4.6], [portal[0], -3.55]], "mute", 0.7, "", { dashed: true });  // fleet state

  // ---------- traffic: plain dots ----------
  const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); return new T.CanvasTexture(c); })();
  const dots = [];
  function dot(path, role, tag, speed, phase) {
    const pts = path.map(p => P(p[0], p[1], p[2] || 0));
    const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0], 3));
    const m = reg(new T.PointsMaterial({ map: dotTex, size: 5.5 * DPR, sizeAttenuation: false, transparent: true, alphaTest: 0.2, depthTest: false }), role, 1, tag);
    const o = new T.Points(g, m); o.renderOrder = 10; o.frustumCulled = false; scene.add(o);
    dots.push({ o, tag, pts, lens, total: lens[lens.length - 1], speed, phase });
  }
  const shared = [[-1.2, 0, 0.9], [2.05, -0.2, 0], [servers[0] - 1.41, -0.2, 0]];
  [0, 0.5].forEach(p => {
    dot([[portal[0] + 1.41, portal[1]], [-3.95, -0.32], ...shared], "brand", "portal", 0.07, p);
    dot([[kapp[0] + 1.41, kapp[1]], [-3.95, 0.32], ...shared], "app", "app", 0.07, p + 0.25);
  });
  dot([[-1.2, -0.3, 0.9], [1.5, -0.3], [ansible[0] - 1.21, ansible[1] + 0.2]], "ink", "", 0.12, 0.1);
  dot([[ansible[0] + 1.41, ansible[1]], [servers[0] - 0.9, -0.85]], "ink", "", 0.18, 0.6);
  dot([[1.5, 0.3], [assets[0] - 1.41, assets[1]]], "ink", "", 0.14, 0.3);
  dot([[0.6, 0.9], [cases[0] - 1.41, cases[1]]], "ink", "", 0.14, 0.75);

  // ---------- labels (HTML, projected from the scene) ----------
  const labels = [];
  function label(h, w, y, html, cls, tag) {
    const d = document.createElement("div");
    d.className = "lbl " + (cls || ""); d.innerHTML = html; el.appendChild(d);
    labels.push({ d, p: P(h, w, y), tag: tag || "" });
  }
  const node = (pos, title, sub, cls, tag, top) => {            // title on the slab, caption just below it
    label(pos[0], pos[1], top || TH, title, cls, tag);
    if (sub) label(pos[0], pos[1] + 1.35, 0, sub, "s mute", tag);
  };
  node(portal, "This portal", "Fleet + Service Desk", "brand", "portal");
  node(kapp, "Kestra App", "self-service form", "app", "app");
  label(kestra[0], kestra[1], 0.9, "Kestra 2.0<small>install_software</small><small>provision_server</small><small>route_request + AI</small>", "brand");
  node(ansible, "Ansible", "configures over SSH");
  node(assets, "Assets", "server inventory");
  node(cases, "Cases", "failures and escalations");
  label(servers[0], servers[1] + 1.55, 0, "Servers<small>Docker containers</small>", "");
  label(0, -5.0, 0, "fleet state is read straight from the servers", "s mute");

  // ---------- modes: both | portal | app ----------
  let mode = "both", active = true, raf = 0, W = 0, H = 0;
  const visible = tag => mode === "both" || !tag || tag === mode;
  function applyMode() {
    const col = palette();
    mats.forEach(x => { x.m.color.set(col[x.role]); x.m.opacity = visible(x.tag) ? x.base : 0.12; });
    labels.forEach(l => { l.d.style.opacity = visible(l.tag) ? 1 : 0.25; });
  }

  // ---------- sizing ----------
  function size() {
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H);
    const asp = W / H, hw = Math.max(10.9, 5.5 * asp), hh = hw / asp, cx = -0.1, cy = 0.1;
    camera.left = cx - hw; camera.right = cx + hw; camera.top = cy + hh; camera.bottom = cy - hh;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(el);

  const tmp = new T.Vector3();
  function frame(now) {
    if (!active) return;
    const t = now / 1000;
    dots.forEach(d => {
      d.o.visible = visible(d.tag);
      const u = ((t * d.speed + d.phase) % 1) * d.total;
      let i = 1; while (i < d.lens.length - 1 && d.lens[i] < u) i++;
      const k = (u - d.lens[i - 1]) / (d.lens[i] - d.lens[i - 1]);
      tmp.lerpVectors(d.pts[i - 1], d.pts[i], Math.min(Math.max(k, 0), 1));
      const a = d.o.geometry.attributes.position; a.setXYZ(0, tmp.x, tmp.y, tmp.z); a.needsUpdate = true;
    });
    labels.forEach(l => {
      tmp.copy(l.p).project(camera);
      l.d.style.transform = `translate(-50%,-50%) translate(${(tmp.x * 0.5 + 0.5) * W}px,${(-tmp.y * 0.5 + 0.5) * H}px)`;
    });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function setActive(on) { active = on; cancelAnimationFrame(raf); if (on) { size(); raf = requestAnimationFrame(frame); } }
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyMode);

  applyMode(); size(); raf = requestAnimationFrame(frame);
  window.forgeArch = { setActive, setMode: m => { mode = m; applyMode(); } };
})();
