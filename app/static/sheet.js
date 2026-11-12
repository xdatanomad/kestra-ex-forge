/* Flat-sheet renderer, ported from the Kestra house-style skill (.agents/skills/kestra-architecture-diagrams/templates/flat-sheet.html).
   Same palette, mono type roles, zones / cards / curved edges / pills / legend. Changes for the portal:
   - renderSheet(svg, SHEET) so several sheets can live on one page; returns the edge paths for animation
   - optional ids and highlight groups (g: 'portal' | 'app') on cards and edges, dimmed by the door buttons
   - no title block when S.noTitle; a few extra icons; dashed legend entries; fonts are vendored (no Google Fonts) */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const DEFS = `<defs>
    <symbol id="i-server" viewBox="0 0 48 48"><rect x="3" y="5" width="42" height="38" rx="7" class="ic-body"/><path d="M11 16h16M11 23h16M11 30h16" class="ic-line"/><circle cx="36" cy="16" r="2.6" class="ic-led"/><circle cx="36" cy="24" r="2.6" class="ic-led2"/></symbol>
    <symbol id="i-db" viewBox="0 0 48 48"><ellipse cx="24" cy="11" rx="16" ry="6" class="ic-body"/><path d="M8 11v26c0 3.3 7.2 6 16 6s16-2.7 16-6V11" class="ic-body"/><path d="M8 20c0 3.3 7.2 6 16 6s16-2.7 16-6M8 29c0 3.3 7.2 6 16 6s16-2.7 16-6" class="ic-line"/></symbol>
    <symbol id="i-container" viewBox="0 0 48 48"><path d="M24 5l16 8v22l-16 8-16-8V13z" class="ic-body"/><path d="M8 13l16 8 16-8M24 21v22" class="ic-line"/></symbol>
    <symbol id="i-queue" viewBox="0 0 48 48"><rect x="4" y="12" width="40" height="24" rx="5" class="ic-body"/><path d="M14 12v24M24 12v24M34 12v24" class="ic-line"/></symbol>
    <symbol id="i-window" viewBox="0 0 48 48"><rect x="4" y="7" width="40" height="34" rx="7" class="ic-body"/><path d="M4 18h40" class="ic-line"/><circle cx="12" cy="12.5" r="1.8" class="ic-led"/><circle cx="18" cy="12.5" r="1.8" class="ic-led2"/><path d="M12 27h16M12 33h10" class="ic-line"/></symbol>
    <symbol id="i-flow" viewBox="0 0 48 48"><rect x="4" y="6" width="14" height="12" rx="4" class="ic-body"/><rect x="30" y="6" width="14" height="12" rx="4" class="ic-body"/><rect x="17" y="30" width="14" height="12" rx="4" class="ic-body"/><path d="M11 18v6h13v6M37 18v6H24" class="ic-line"/></symbol>
    <symbol id="i-gear" viewBox="0 0 48 48"><circle cx="24" cy="24" r="9" class="ic-body"/><circle cx="24" cy="24" r="3.2" class="ic-led2"/><path d="M24 4v7M24 37v7M4 24h7M37 24h7M9.9 9.9l5 5M33.1 33.1l5 5M9.9 38.1l5-5M33.1 14.9l5-5" class="ic-line"/></symbol>
    <symbol id="i-case" viewBox="0 0 48 48"><rect x="4" y="14" width="40" height="27" rx="6" class="ic-body"/><path d="M17 14v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M4 26h40" class="ic-line"/><circle cx="24" cy="26" r="2.6" class="ic-led2"/></symbol>
    <symbol id="i-kmark" viewBox="0 0 20 30"><path d="M10 0l4.5 4.5L10 9 5.5 4.5z"/><path d="M4.5 5.5L9 10l-4.5 4.5L0 10z"/><path d="M15.5 5.5L20 10l-4.5 4.5L11 10z"/><path d="M10 11l4.5 4.5L10 20l-4.5-4.5z"/><circle cx="10" cy="26" r="3"/></symbol>
    <marker id="m-task" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L9 5L1 9z" fill="#7A2EF0"/></marker>
    <marker id="m-conn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L9 5L1 9z" fill="#2F6BD8"/></marker>
    <marker id="m-ink"  viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1L9 5L1 9z" fill="#1B1729"/></marker>
  </defs>`;

  const dirOf = s => ({ top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[s]);
  const tg = g => (g ? " t-" + g : "");

  window.renderSheet = function (svg, S) {
    svg.setAttribute("viewBox", `0 0 ${S.w} ${S.h}`);
    const out = [], raw = s => out.push(s);
    const text = (cls, x, y, s, extra = "") => raw(`<text class="${cls}" x="${x}" y="${y}" ${extra}>${esc(s)}</text>`);
    raw(DEFS);
    if (!S.noTitle) { text("t-title", 40, 74, S.title); text("t-sub", 40, 100, S.sub); text("t-meta", 40, 126, S.meta); }

    const cards = {};
    (S.zones || []).forEach(z => {
      raw(`<rect class="zone ${z.tone === "cust" ? "cust" : z.tone === "neutral" ? "neutral" : ""}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="22"/>`);
      text("t-zone", z.x + 24, z.y + 34, z.title); if (z.sub) text("t-sub", z.x + 24, z.y + 54, z.sub);
    });
    (S.cards || []).forEach(c => { cards[c.id] = c; });

    const pt = ref => {
      const [id, side] = ref.split("."), c = cards[id];
      if (!c) throw new Error("Unknown card in edge: " + ref);
      return { side, ...({ top: { x: c.x + c.w / 2, y: c.y }, bottom: { x: c.x + c.w / 2, y: c.y + c.h }, left: { x: c.x, y: c.y + c.h / 2 }, right: { x: c.x + c.w, y: c.y + c.h / 2 } }[side]) };
    };
    function route(a, b, bend = 0) {   // cubic bezier leaving/entering perpendicular to each side; straight when aligned
      const da = dirOf(a.side), db = dirOf(b.side), k = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4) + bend;
      return `M${a.x} ${a.y}C${a.x + da[0] * k} ${a.y + da[1] * k} ${b.x + db[0] * k} ${b.y + db[1] * k} ${b.x} ${b.y}`;
    }
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    // explicit orthogonal path (e.poly = [[x,y],...]) with rounded corners, for lines that must go around everything
    function polyPath(pts, r = 16) {
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1], la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]), k = Math.min(r, la / 2, lc / 2);
        d += `L${b[0] - (b[0] - a[0]) / la * k} ${b[1] - (b[1] - a[1]) / la * k}Q${b[0]} ${b[1]} ${b[0] + (c[0] - b[0]) / lc * k} ${b[1] + (c[1] - b[1]) / lc * k}`;
      }
      return d + `L${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
    }

    const labels = [];
    (S.edges || []).forEach(e => {
      const a = e.poly ? { x: e.poly[0][0], y: e.poly[0][1] } : pt(e.from), b = e.poly ? { x: e.poly[e.poly.length - 1][0], y: e.poly[e.poly.length - 1][1] } : pt(e.to), kind = e.kind ?? "ink", arrow = e.arrow ?? "end";
      const mk = `marker-end="url(#m-${kind})"` + (arrow === "both" ? ` marker-start="url(#m-${kind})"` : "");
      raw(`<g class="eg${tg(e.g)}"><path ${e.id ? `id="${S.id || "s"}-${e.id}"` : ""} class="edge ${kind}${e.dash ? " dash" : ""}" d="${e.poly ? polyPath(e.poly) : route(a, b, e.bend ?? 0)}" ${arrow === "none" ? "" : mk}/>`);
      raw("</g>");
      if (e.label) labels.push({ e, a, b });
    });

    (S.cards || []).forEach(c => {
      raw(`<g class="cg${tg(c.g)}"><rect class="shcard${c.ghost ? " ghost" : ""}${c.focus ? " focus" : ""}" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="14"/>`);
      const hasIcon = c.icon && c.icon !== "none", compact = c.h <= 100;
      let tx = c.x + 24, ty = c.y + 38;
      if (hasIcon && c.icon !== "kmark") {
        const s = compact ? 44 : 50;   // compact cards: smaller icon, text starts at x+72 (so ~12 chars fit beside it on a 188px card)
        raw(`<use href="#i-${c.icon}" x="${c.x + 16}" y="${compact ? c.y + 20 : c.y + 18}" width="${s}" height="${s}"/>`);
        if (compact) { tx = c.x + 72; ty = c.y + 38; } else { tx = c.x + 20; ty = c.y + c.h - 42; }
      } else if (c.slots || c.chips) { tx = c.x + 20; ty = c.chips ? c.y + 38 : c.y + c.h - 42; }
      if (c.icon === "kmark") raw(`<use href="#i-kmark" class="kmark" x="${c.x + c.w - 54}" y="${c.y + 16}" width="20" height="30"/>`);
      text("t-card", tx, ty, c.title, `data-c="${c.id}"`); text("t-sub", tx, ty + 22, c.sub, `data-c="${c.id}"`);
      (c.rows || []).forEach((r, i) => {
        const ry = c.y + 72 + i * 40;
        raw(`<rect class="shrow" x="${c.x + 24}" y="${ry}" width="${c.w - 48}" height="32" rx="8"/><circle class="shdot" cx="${c.x + 42}" cy="${ry + 16}" r="4"/>`);
        text("t-row", c.x + 58, ry + 21, r);
      });
      if (c.badge) raw(`<circle class="badge" cx="${c.x + c.w}" cy="${c.y}" r="15"/><text class="t-badge" x="${c.x + c.w}" y="${c.y + 5}">${esc(c.badge)}</text>`);
      raw("</g>");
    });

    // edge pills on top; they live in the edge's own group so they dim with it
    const pills = [];
    labels.forEach(({ e, a, b }) => {
      const L = e.label, m = L.at ? { x: L.at[0], y: L.at[1] } : midpoint(a, b), kind = L.kind ?? e.kind ?? "ink", col = kind === "task" ? "#7A2EF0" : kind === "ink" ? "#1B1729" : "#2F6BD8";
      const w = Math.max(L.text.length, (L.sub || "").length * 0.95) * 7.4 + 28, h = L.sub ? 46 : 26;
      const x = m.x - w / 2 + (L.dx ?? 0), y = m.y - h / 2 + (L.dy ?? 0);
      pills.push(`<g class="pl${tg(e.g)}"><rect class="pill" style="stroke:${col}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${L.sub ? 10 : 13}"/>` +
        `<text class="t-pill" x="${m.x + (L.dx ?? 0)}" y="${y + (L.sub ? 19 : 17)}" text-anchor="middle" style="fill:${kind === "task" ? "#5B17C9" : col}">${esc(L.text)}</text>` +
        (L.sub ? `<text class="t-pill2" x="${m.x + (L.dx ?? 0)}" y="${y + 37}" text-anchor="middle">${esc(L.sub)}</text>` : "") + "</g>");
    });

    let lx = 40;
    const leg = [];
    (S.legend || []).forEach(l => {
      if (l.kind === "badge") { leg.push(`<circle class="badge" cx="${lx + 10}" cy="${S.h - 14}" r="10"/><text class="t-badge" x="${lx + 10}" y="${S.h - 10}" style="font-size:11px">1</text>`); lx += 28; }
      else { leg.push(`<path class="edge ${l.kind}${l.dash ? " dash" : ""}" d="M${lx} ${S.h - 14}H${lx + 26}"/>`); lx += 34; }
      leg.push(`<text class="t-leg" x="${lx}" y="${S.h - 10}">${esc(l.text)}</text>`); lx += l.text.length * 7.6 + 30;
    });

    svg.innerHTML = out.join("") + `<g class="dots"></g>` + pills.join("") + leg.join("");   // dots under the pills

    window.__overflow = (window.__overflow || []);
    svg.querySelectorAll("text[data-c]").forEach(t => {
      const c = cards[t.dataset.c], b = t.getBBox();
      if (b.x < c.x + 8 || b.x + b.width > c.x + c.w - 8) window.__overflow.push(`${S.id || "sheet"}.${c.id}: "${t.textContent}" is ${Math.round(b.width)}px wide, card inner width is ${c.w - 16}px`);
    });
    const paths = {};
    (S.edges || []).forEach(e => { if (e.id) paths[e.id] = svg.querySelector(`#${S.id || "s"}-${e.id}`); });
    return { paths, cards };
  };
})();
