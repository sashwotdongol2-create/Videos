// painted.js: the painted-film kit. Real paintings, cut out and set in flat rooms, moving as 12 fps stop motion, with
// transitions taken from human-md.ai and more. One 1080x1920 canvas; the page defines window.renderAt(t).
// Load with <script src="painted.js"></script>; everything lives on window.P.
//
// Conventions
// - Scene functions take (t, f) and draw a whole frame on P.X. Read P.X inside the function every call (transitions
//   swap it to draw scenes into snapshots).
// - Transitions: P.tr.<name>(t, [start, end], A, B, opts). A and B are scene functions. Before start the transition
//   draws A, after end it draws B.
// - Time is stepped by the page: f = Math.floor(t * P.FPS), t = f / P.FPS. Every ease below is fed that stepped t.
(function () {
  const P = (window.P = {});
  const W = (P.W = 1080), H = (P.H = 1920);
  P.FPS = 12;
  let X = null;
  Object.defineProperty(P, 'X', { get: () => X });
  P.init = canvas => { P.main = canvas; X = canvas.getContext('2d'); return P; };

  // ---------------------------------------------------------------- maths
  P.rng = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  P.hash = (a, b = 0) => P.rng(a * 7919 + b * 104729 + 17)();
  P.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  P.lerp = (a, b, k) => a + (b - a) * k;
  P.prog = (t, [a, b]) => P.clamp((t - a) / (b - a));
  P.step = (k, n) => Math.floor(P.clamp(k) * n) / n;   // quantise 0..1 into n hard steps (stepped wipes)
  const clamp = P.clamp, lerp = P.lerp, prog = P.prog, hash = P.hash;
  function bezier(x1, y1, x2, y2) {
    return x => { let lo = 0, hi = 1, t = x; for (let k = 0; k < 28; k++) { t = (lo + hi) / 2; const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3; if (cx < x) lo = t; else hi = t; }
      return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3; };
  }
  // the site's eases, by name
  P.ease = {
    linear: x => x,
    camera: bezier(0.62, 0, 0.22, 1),        // in-out, for pans, tilts, irises
    dive: bezier(0.7, 0, 0.84, 0.28),        // slow start, fast end: zooming into something
    out: bezier(0.18, 0.82, 0.24, 1),        // fast start: reveals
    exit: bezier(0.3, -0.16, 0.62, 0),       // a small pull back before leaving
    spring: (x, z = 0.34, w = 14) => { if (x >= 1) return 1; const d = Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(w * d * x) + z / d * Math.sin(w * d * x)); },
    bouncy: x => P.ease.spring(x, 0.34, 14), snappy: x => P.ease.spring(x, 0.78, 16), wobble: x => P.ease.spring(x, 0.18, 20), settle: x => P.ease.spring(x, 0.9, 9),
    dolly: e => { const t = 0.74; if (e <= t) { const n = e / t; return 1.03 * (n < .5 ? 4 * n ** 3 : 1 - (-2 * n + 2) ** 3 / 2); } return 1 + .03 * (1 + Math.cos(Math.PI * (e - t) / .26)) / 2; },
    hop: x => -4 * x * (1 - x),               // 0 → -1 → 0: multiply by a height for a hop
  };
  const E = P.ease;

  // ---------------------------------------------------------------- assets
  P.IMG = {}; P.BOX = {};
  P.load = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('missing ' + src)); im.src = src; });
  // P.loadAll({ name: 'assets/x.png', ... }): images into P.IMG; PNGs (cut-outs) also get a bounding box in P.BOX
  P.loadAll = async map => { for (const [k, src] of Object.entries(map)) { P.IMG[k] = await P.load(src); if (/\.png$/i.test(src)) P.BOX[k] = bbox(P.IMG[k]); } };
  function bbox(im) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 3) for (let xx = 0; xx < c.width; xx += 3) if (d[(y * c.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  P.canvas = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // draw fn into canvas c (cleared), with P.X pointing at it while fn runs
  P.into = (c, fn) => { const o = X; X = c.getContext('2d'); X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, c.width, c.height); fn(); X = o; return c; };
  const SNAPS = {};
  P.snap = (name, fn) => P.into(SNAPS[name] || (SNAPS[name] = P.canvas()), fn);   // a reusable named snapshot

  // painted-wash texture (3 variants cycled, so the wall boils too) and film grain
  let TEX = [], GRAIN = [];
  function wash(seed) {
    const c = P.canvas(), x = c.getContext('2d'), r = P.rng(seed);
    for (let k = 0; k < 160; k++) {
      const cx = r() * W, cy = r() * H, rad = 80 + r() * 380, a = 0.035 + r() * 0.05, light = r() > 0.5;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,20,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    x.globalAlpha = 0.035;
    for (let k = 0; k < 900; k++) { x.strokeStyle = r() > 0.5 ? '#fff' : '#000'; x.lineWidth = 1 + r() * 3; const sx = r() * W, sy = r() * H, l = 20 + r() * 90, an = -0.3 + r() * 0.6; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(an) * l, sy + Math.sin(an) * l); x.stroke(); }
    return c;
  }
  function grain(seed) {
    const c = P.canvas(W / 2, H / 2), x = c.getContext('2d'), id = x.createImageData(c.width, c.height), r = P.rng(seed);
    for (let k = 0; k < id.data.length; k += 4) { const v = 128 + (r() - 0.5) * 70; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    x.putImageData(id, 0, 0); return c;
  }
  P.textures = () => { TEX = [wash(11), wash(23), wash(37)]; GRAIN = [grain(5), grain(6), grain(7)]; };
  P.tex = f => TEX[f % TEX.length];
  // call last in renderAt: film grain + soft vignette over everything
  P.finish = f => {
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'overlay'; X.globalAlpha = 0.2; X.drawImage(GRAIN[f % GRAIN.length], 0, 0, W, H); X.restore();
    const vg = X.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.fillStyle = vg; X.fillRect(0, 0, W, H); X.restore();
  };

  // ---------------------------------------------------------------- set pieces
  P.COLORS = { cobalt: '#0b41c2', beige: '#d1c2af', green: '#3f6b4f', pink: '#e0c9bf', rust: '#c9502e', cream: '#e3d6b8', umber: '#6e5a45', ink: '#1d1a16', paper: '#f4ecdc', accent: '#f2552c', night: '#201e1f' };
  P.FLOOR = 1190;
  // a flat room: wall, floor, baseboard line, floor shading, painted wash
  P.room = (wall = P.COLORS.cobalt, floor = P.COLORS.beige, f = 0, floorY = P.FLOOR) => {
    X.fillStyle = wall; X.fillRect(-60, -60, W + 120, floorY + 60);
    X.fillStyle = floor; X.fillRect(-60, floorY, W + 120, H - floorY + 60);
    X.fillStyle = 'rgba(10,20,40,0.3)'; X.fillRect(-60, floorY - 6, W + 120, 6);
    const fl = X.createLinearGradient(0, floorY, 0, floorY + 220); fl.addColorStop(0, 'rgba(60,50,40,0.18)'); fl.addColorStop(1, 'rgba(60,50,40,0)');
    X.fillStyle = fl; X.fillRect(-60, floorY, W + 120, 220);
    X.save(); X.globalCompositeOperation = 'overlay'; X.drawImage(P.tex(f), 0, 0); X.restore();
  };
  // a painting filling a box (cover fit), focus fx/fy, extra zoom
  P.cover = (im, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) => {
    const s = Math.max(w / im.width, h / im.height) * zoom, dw = im.width * s, dh = im.height * s;
    X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip();   // never spill past the box (pans and tilts put scenes side by side)
    X.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); X.restore();
  };
  // a whole painting as the scene, with a slow push (zoom from z0 to z1 over [a, b])
  P.painting = (im, t, f, o = {}) => { const z = lerp(o.z0 ?? 1.0, o.z1 ?? 1.05, prog(t, o.span || [0, 10])); P.cover(im, 0, 0, W, H, o.fx ?? 0.5, o.fy ?? 0.5, z); };
  // a cut-out figure standing with its feet at (cx, feet), hgt px tall. opts: talk (bob), rot, sx (mirror/turn),
  // sc (scale pop), dy, alpha, shadow (false to skip), seed
  P.figure = (key, cx, feet, hgt, f, o = {}) => {
    const im = P.IMG[key], b = P.BOX[key]; if (!im || !b) throw new Error('figure not loaded: ' + key);
    const s = hgt / b.h, seed = key.length * 13 + (o.seed || 0);
    const bx = (hash(f, seed) - 0.5) * 4, by = (hash(f, seed + 9) - 0.5) * 3;   // the boil
    let rot = (hash(f, seed + 3) - 0.5) * 0.004 + (o.rot || 0), lift = 0, sy = 1;
    if (o.talk) { lift = -hash(f, 51 + seed) * 9; sy = 1 + hash(f, 77 + seed) * 0.012; rot += (hash(f, 33 + seed) - 0.5) * 0.012; }
    if (o.shadow !== false) {
      X.save(); X.globalCompositeOperation = 'multiply'; const r = Math.max(120, b.w * s * 0.5);
      const sh = X.createRadialGradient(cx, feet + 8, 0, cx, feet + 8, r); sh.addColorStop(0, 'rgba(50,35,25,0.5)'); sh.addColorStop(1, 'rgba(50,35,25,0)');
      X.translate(cx, feet + 8); X.scale(1, 0.16); X.translate(-cx, -(feet + 8)); X.fillStyle = sh; X.fillRect(cx - r, feet - r, r * 2, r * 2.2); X.restore();
    }
    X.save(); X.translate(cx + bx, feet + by + lift + (o.dy || 0)); X.rotate(rot); X.scale((o.sx ?? 1) * (o.sc ?? 1), sy * (o.sc ?? 1));
    X.globalAlpha = o.alpha ?? 1;
    X.drawImage(im, -(b.x0 + b.w / 2) * s, -b.y1 * s, im.width * s, im.height * s); X.restore();
  };
  // a five-frame stop-motion turn (mirror → face), for P.figure's sx: P.turn(t, t0)
  P.turn = (t, t0, from = -1) => { const seq = [-1, -0.6, -0.15, 0.35, 0.8, 1], k = Math.floor((t - t0) * P.FPS); return t < t0 ? from : seq[clamp(k, 0, 5)] * -from; };
  // a gilt picture frame around the box
  P.gilt = (x, y, w, h, m = 34) => {
    const sides = [[[x - m, y - m], [x + w + m, y - m], [x + w, y], [x, y], 0, -1], [[x + w, y], [x + w + m, y - m], [x + w + m, y + h + m], [x + w, y + h], 1, 0],
      [[x, y + h], [x + w, y + h], [x + w + m, y + h + m], [x - m, y + h + m], 0, 1], [[x - m, y - m], [x, y], [x, y + h], [x - m, y + h + m], -1, 0]];
    for (const [a, b, c, d, nx, ny] of sides) {
      const g = X.createLinearGradient(x + w / 2 + nx * (w / 2), y + h / 2 + ny * (h / 2), x + w / 2 + nx * (w / 2 + m), y + h / 2 + ny * (h / 2 + m)), lit = ny < 0 || nx < 0;
      g.addColorStop(0, '#5a3b12'); g.addColorStop(0.18, lit ? '#f3d27a' : '#c9973c'); g.addColorStop(0.45, lit ? '#b8862f' : '#8a5f1d'); g.addColorStop(0.7, lit ? '#e8c063' : '#b0802c'); g.addColorStop(1, '#4a2f0c');
      X.fillStyle = g; X.beginPath(); X.moveTo(...a); X.lineTo(...b); X.lineTo(...c); X.lineTo(...d); X.closePath(); X.fill();
    }
    X.strokeStyle = 'rgba(40,25,5,0.8)'; X.lineWidth = 2; X.strokeRect(x - m, y - m, w + 2 * m, h + 2 * m); X.strokeRect(x, y, w, h);
    X.save(); X.globalCompositeOperation = 'multiply'; const sh = X.createLinearGradient(0, y, 0, y + 40); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = sh; X.fillRect(x, y, w, 40); X.restore();
  };
  // a framed picture: image (or draw fn) inside a gilt frame, optional velvet cover lifting in steps (cover 1 → 0)
  P.framed = (src, x, y, w, h, o = {}) => {
    X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip();
    if (typeof src === 'function') { X.translate(x, y); X.scale(w / W, w / W); src(); } else P.cover(src, x, y, w, h, o.fx ?? 0.5, o.fy ?? 0.5);
    X.restore(); X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip();
    const cov = o.cover ?? 0;
    if (cov > 0) {
      const k = Math.ceil(cov * 6) / 6; X.fillStyle = o.coverColor || '#6d1f1a'; X.fillRect(x, y, w, h * k);
      X.fillStyle = 'rgba(0,0,0,0.25)'; for (let s = 0; s < 6; s++) X.fillRect(x + s * w / 6, y, 3, h * k);
      if (cov >= 1 && o.label) { X.font = `${Math.round(h * 0.5)}px OldItalic`; X.fillStyle = '#e9c46a'; X.textAlign = 'center'; X.fillText(o.label, x + w / 2, y + h * 0.67); }
    }
    X.restore(); P.gilt(x, y, w, h, o.m ?? Math.max(18, w * 0.11));
  };

  // ---------------------------------------------------------------- type
  // words that drop in on a spring, one after another. lines: [{text, font: 'InterBlack'|'OldItalic', size, color,
  // gap, strike, shadow}]. o.align 'center'|'left', o.stagger (s per word)
  P.drop = (lines, y0, t, t0, f, o = {}) => {
    X.save(); X.textBaseline = 'alphabetic'; let y = y0, n = 0;
    for (const l of lines) {
      X.font = `${l.size}px ${l.font}`; const words = l.text.split(' '), sp = X.measureText(' ').width;
      const total = words.reduce((a, w) => a + X.measureText(w).width, 0) + sp * (words.length - 1);
      let x = o.align === 'left' ? (o.x ?? 80) : (o.x ?? W / 2) - total / 2;
      for (const w of words) {
        const k = (t - t0 - n * (o.stagger ?? 0.07)) / 0.5; n++;
        if (k > 0) {
          const e = E.spring(clamp(k)), dy = (1 - e) * -90, sq = 1 + (1 - e) * 0.25;
          X.save(); X.translate(x, y + dy); X.scale(1 / sq, sq); X.fillStyle = l.color || '#fff';
          if (l.shadow !== false) { X.shadowColor = 'rgba(0,0,0,0.35)'; X.shadowBlur = 18; X.shadowOffsetY = 4; }
          X.fillText(w, (hash(f, n) - .5) * 2, 0);
          if (l.strike && k > 1.2) { X.shadowColor = 'transparent'; X.fillStyle = P.COLORS.accent; X.fillRect(-6, -l.size * 0.32, (X.measureText(w).width + 12) * clamp((k - 1.2) * 3), 9); }
          X.restore();
        }
        x += X.measureText(w).width + sp;
      }
      y += l.gap ?? l.size * 1.05;
    }
    X.restore();
  };
  const wrap = (text, maxW) => { const ws = text.split(' '), out = []; let cur = ''; for (const w of ws) { const n = cur ? cur + ' ' + w : w; if (X.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; };
  P.wrap = wrap;
  // a typed caption on a paper strip. L = {t, text, kind: undefined | 'q' (italic quote) | 'a' (quote, underlined)}
  P.caption = (L, t, f, o = {}) => {
    X.save(); X.font = (L.kind === 'q' ? 'italic ' : '') + `${o.size || 52}px "American Typewriter", "Courier New", monospace`;
    const text = L.kind ? `“${L.text}”` : L.text, lines = wrap(text, o.maxW || 900), shown = Math.floor((t - L.t) * P.FPS * 1.5) + 1;
    const lh = (o.size || 52) * 1.3, y0 = (o.y || 1700) - (lines.length - 1) * lh / 2;
    const bw = Math.max(...lines.map(l => X.measureText(l).width)) + 60;
    X.fillStyle = o.paper || 'rgba(244,236,220,0.92)'; X.beginPath(); X.roundRect(W / 2 - bw / 2 + (hash(f, 7) - .5) * 2, y0 - lh * 0.85, bw, lines.length * lh + 34, 6); X.fill();
    let n = 0;
    lines.forEach((ln, k) => {
      const ws = ln.split(' '), vis = ws.slice(0, Math.max(0, shown - n)).join(' '); n += ws.length;
      const y = y0 + k * lh, x0 = W / 2 - X.measureText(ln).width / 2; X.textAlign = 'left';
      if (L.kind === 'a' && vis) { X.fillStyle = 'rgba(242,85,44,0.8)'; X.fillRect(x0 - 6, y + 9, X.measureText(vis).width + 12, 10); }
      X.fillStyle = o.color || (L.kind === 'q' ? '#5a2a14' : P.COLORS.ink); X.fillText(vis, x0, y);
    });
    X.restore();
  };
  // show each line from its start to its end (+tail), never over the next line
  P.captions = (lines, t, f, o = {}) => lines.forEach((L, k) => { const nx = lines[k + 1]; if (t >= L.t && t <= Math.min(L.t + L.d + (o.tail ?? 0.3), nx ? nx.t - 0.01 : 1e9)) P.caption(L, t, f, o); });
  P.talking = (lines, who, t) => lines.some(L => L.who === who && t >= L.t + (L.talkFrom || 0) && t <= L.t + L.d);

  // ---------------------------------------------------------------- elements
  P.el = {};
  // a rubber stamp that slams down (scale 1.9, 1.2, 1.0)
  P.el.stamp = (text, x, y, t, t0, o = {}) => {
    if (t < t0) return; const k = Math.floor((t - t0) * P.FPS), s = k < 3 ? [1.9, 1.2, 1.0][k] : 1, size = o.size || 200, col = o.color || P.COLORS.paper;
    X.save(); X.translate(x, y); X.rotate(o.rot ?? -0.12); X.scale(s, s); X.font = `${size}px InterBlack`; const w = X.measureText(text).width;
    X.strokeStyle = col; X.lineWidth = size * 0.08; X.strokeRect(-w / 2 - size * 0.3, -size * 0.7, w + size * 0.6, size * 1.3);
    X.fillStyle = col; X.textAlign = 'center'; X.fillText(text, 0, size * 0.35); X.restore();
  };
  // a counter card that pops in and rolls from a to b over [tA, tB]
  P.el.counter = (x, y, a, b, t, tShow, tA, tB, o = {}) => {
    if (t < tShow) return; const k = Math.floor((t - tShow) * P.FPS), sc = k < 3 ? [0.6, 1.1, 0.97][k] : 1;
    const v = t < tA ? a : Math.round(lerp(a, b, E.camera(prog(t, [tA, tB]))) / (o.round || 10)) * (o.round || 10), done = t >= tB;
    const pop = done && Math.floor((t - tB) * P.FPS) < 2 ? 1.12 : 1;
    X.save(); X.translate(x, y); X.scale(sc * pop, sc * pop); X.rotate(o.rot ?? -0.03);
    X.fillStyle = P.COLORS.paper; X.shadowColor = 'rgba(0,0,0,0.4)'; X.shadowBlur = 30; X.shadowOffsetY = 10; X.beginPath(); X.roundRect(-300, -120, 600, 240, 28); X.fill(); X.shadowColor = 'transparent';
    X.textAlign = 'center'; X.fillStyle = done ? P.COLORS.accent : P.COLORS.ink; X.font = '150px InterBlack'; X.fillText((o.prefix || '') + v.toLocaleString('en-US') + (o.suffix || ''), 0, 55);
    X.font = '46px OldItalic'; X.fillStyle = '#5a4a3a'; X.fillText(o.label || '', 0, 100); X.restore();
  };
  // cut-outs that drop in one by one on a spring between t0 and t1. list: [{key, x, feet, h}]
  P.el.crowd = (list, t, t0, t1, f) => list.forEach((c, i) => {
    const at = lerp(t0, t1, list.length > 1 ? i / (list.length - 1) : 0); if (t < at) return;
    P.figure(c.key, c.x, c.feet, c.h, f, { dy: (1 - E.spring(clamp((t - at) / 0.5), 0.3, 13)) * -500, seed: i, talk: c.talk });
  });
  // a painted-looking ball and a hop path: P.el.hopAt(points[[x,y],...], t, span) → [x, y]
  P.el.ball = (x, y, r, f, color = P.COLORS.accent) => {
    const g = X.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#ff9a6e'); g.addColorStop(0.55, color); g.addColorStop(1, '#a3301a');
    X.fillStyle = g; X.beginPath(); X.arc(x + (hash(f, 91) - .5) * 2, y, r, 0, 7); X.fill();
  };
  P.el.hopAt = (pts, t, span, height = 220) => {
    const p = prog(t, span) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(p)), q = p - i;
    return [lerp(pts[i][0], pts[i + 1][0], q), lerp(pts[i][1], pts[i + 1][1], q) + E.hop(q) * height];
  };
  // a parchment speech bubble with typed text and a tail pointing at (tx, ty)
  P.el.bubble = (text, x, y, t, t0, o = {}) => {
    if (t < t0) return; const k = Math.floor((t - t0) * P.FPS), sc = k < 3 ? [0.5, 1.08, 0.98][k] : 1;
    X.save(); X.font = `${o.size || 50}px "American Typewriter", monospace`; const lines = wrap(text, o.maxW || 560), lh = (o.size || 50) * 1.25;
    const bw = Math.max(...lines.map(l => X.measureText(l).width)) + 70, bh = lines.length * lh + 50;
    X.translate(x, y); X.scale(sc, sc); X.rotate(o.rot ?? -0.02);
    X.fillStyle = P.COLORS.paper; X.shadowColor = 'rgba(0,0,0,0.35)'; X.shadowBlur = 24; X.shadowOffsetY = 8;
    X.beginPath(); X.roundRect(-bw / 2, -bh / 2, bw, bh, 34); X.fill();
    if (o.tail) { X.beginPath(); X.moveTo(-30, bh / 2 - 4); X.lineTo(o.tail[0] - x, o.tail[1] - y); X.lineTo(30, bh / 2 - 4); X.fill(); }
    X.shadowColor = 'transparent'; X.fillStyle = P.COLORS.ink; X.textAlign = 'center';
    const shown = Math.floor((t - t0) * P.FPS * 1.5) + 1; let n = 0;
    lines.forEach((ln, i) => { const ws = ln.split(' '); X.fillText(ws.slice(0, Math.max(0, shown - n)).join(' '), 0, -bh / 2 + 50 + i * lh + lh * 0.45); n += ws.length; });
    X.restore();
  };
  // darken everything except a soft circle
  P.el.spotlight = (x, y, r, a = 0.6) => {
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); const g = X.createRadialGradient(x, y, r * 0.7, x, y, r * 1.4); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,8,6,${a})`);
    X.fillStyle = g; X.fillRect(0, 0, W, H); X.restore();
  };
  // a paper label tag, slightly rotated, popping in
  P.el.tag = (text, x, y, t, t0, o = {}) => {
    if (t < t0) return; const k = Math.floor((t - t0) * P.FPS), sc = k < 3 ? [0.6, 1.1, 0.98][k] : 1;
    X.save(); X.translate(x, y); X.rotate(o.rot ?? 0.04); X.scale(sc, sc); X.font = `${o.size || 46}px InterBlack`; const w = X.measureText(text).width + 50, h = (o.size || 46) * 1.6;
    X.fillStyle = o.bg || P.COLORS.paper; X.shadowColor = 'rgba(0,0,0,0.3)'; X.shadowBlur = 14; X.shadowOffsetY = 5; X.fillRect(-w / 2, -h / 2, w, h);
    X.shadowColor = 'transparent'; X.fillStyle = o.color || P.COLORS.ink; X.textAlign = 'center'; X.fillText(text, 0, (o.size || 46) * 0.36); X.restore();
  };
  // a round window onto another scene (a canvas), opening in steps, with a gold rim
  P.el.porthole = (canvas, x, y, r, t, span) => {
    const rr = r * P.step(E.out(prog(t, span)), 6); if (rr <= 0) return;
    X.save(); X.beginPath(); X.arc(x, y, rr, 0, 7); X.clip(); X.translate(x - rr, y - rr); X.scale(2 * rr / W, 2 * rr / W); X.drawImage(canvas, 0, -(H - W) / 2); X.restore();
    X.save(); X.lineWidth = 22; X.strokeStyle = '#c9973c'; X.beginPath(); X.arc(x, y, rr + 8, 0, 7); X.stroke(); X.lineWidth = 4; X.strokeStyle = '#5a3b12'; X.beginPath(); X.arc(x, y, rr + 19, 0, 7); X.stroke(); X.restore();
  };
  // which item of a flipbook sequence shows at t: P.el.flip(['a','b','a','b','b'], t, t0) (one per frame step)
  P.el.flip = (seq, t, t0) => t < t0 ? seq[0] : seq[Math.min(seq.length - 1, Math.floor((t - t0) * P.FPS))];
  // the dolly push-in: a zoom factor for a camera, 1 → about 1+amt with the site's overshoot, then back out at b
  P.dolly = (t, a, b, amt = 0.05) => (t < a || t > b + 0.6) ? 1 : 1 + amt * E.dolly(prog(t, [a, a + 1.0])) * (1 - E.camera(prog(t, [b, b + 0.6])));
  // run fn inside a camera: drift (tiny idle float) and zoom about a point
  P.camera = (t, fn, o = {}) => {
    const z = o.z ?? 1, cx = o.cx ?? W / 2, cy = o.cy ?? H / 2 - 120;
    X.save(); X.translate(cx + Math.sin(t * 0.6) * (o.drift ?? 6), cy + Math.cos(t * 0.45) * (o.drift ?? 5)); X.scale(z, z); X.translate(-cx, -cy); fn(); X.restore();
  };

  // ---------------------------------------------------------------- transitions
  // Each: P.tr.name(t, [a, b], A, B, opts). A, B: (t, f) => draws a full frame.
  P.tr = {};
  const f12 = t => Math.floor(t * P.FPS + 1e-6);
  const before = (t, s, A, B) => { if (t < s[0]) { A(t, f12(t)); return true; } if (t >= s[1]) { B(t, f12(t)); return true; } return false; };
  const at = (dx, dy, fn) => { X.save(); X.translate(dx, dy); fn(); X.restore(); };
  const clipRect = (x, y, w, h, fn) => { X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip(); fn(); X.restore(); };
  const maxR = (x, y) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 2;

  P.tr.cut = (t, s, A, B) => (t < (s[0] + s[1]) / 2 ? A : B)(t, f12(t));
  // stepped wipe in n hard steps; dir 'down' | 'up' | 'left' | 'right'
  P.tr.wipe = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const k = P.step(prog(t, s), o.steps || 6), f = f12(t), d = o.dir || 'down';
    A(t, f);
    if (d === 'down') clipRect(0, 0, W, H * k, () => B(t, f)); else if (d === 'up') clipRect(0, H * (1 - k), W, H * k, () => B(t, f));
    else if (d === 'right') clipRect(0, 0, W * k, H, () => B(t, f)); else clipRect(W * (1 - k), 0, W * k, H, () => B(t, f));
  };
  // venetian blinds: n strips open one after another, each in steps
  P.tr.blinds = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const n = o.n || 8, p = prog(t, s), f = f12(t), horiz = o.dir !== 'v';
    A(t, f); X.save(); X.beginPath();
    for (let i = 0; i < n; i++) { const k = P.step(p * 1.5 - i / n * 0.5, 4); if (horiz) X.rect(0, i * H / n, W, H / n * k); else X.rect(i * W / n, 0, W / n * k, H); }
    X.clip(); B(t, f); X.restore();
  };
  // whip pan: a fast slide with two ghost copies trailing (dir -1 = content moves left)
  P.tr.whip = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = E.camera(prog(t, s)), dir = o.dir ?? -1, dx = dir * W * e, f = f12(t);
    for (const [g, a] of [[-dir * 70, 0.28], [-dir * 35, 0.4], [0, 1]]) { X.save(); X.globalAlpha = a; at(dx + g, 0, () => A(t, f)); at(dx - dir * W + g, 0, () => B(t, f)); X.restore(); }
  };
  // pan: a calm sideways camera move, optionally through a corridor drawn by o.gap(t, f) of width o.gapW
  P.tr.pan = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const gw = o.gap ? (o.gapW || 760) : 0, span = W + gw, e = E.camera(prog(t, s)), dir = o.dir ?? -1, f = f12(t);
    at(dir * span * e, 0, () => A(t, f)); if (o.gap) at(dir * span * e - dir * W, 0, () => o.gap(t, f)); at(dir * span * e - dir * span, 0, () => B(t, f));
  };
  // tilt: the camera moves up (dir -1, B is above A) or down (dir 1)
  P.tr.tilt = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = E.camera(prog(t, s)), dir = o.dir ?? -1, f = f12(t);
    at(0, -dir * H * e, () => A(t, f)); at(0, -dir * H * e + dir * H, () => B(t, f));
  };
  // iris: B opens in a circle from (x, y), r0 = starting radius, rim = light ring
  P.tr.iris = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = E.camera(prog(t, s)), x = o.x ?? W / 2, y = o.y ?? H / 2, r = lerp(o.r0 || 0, maxR(x, y), e), f = f12(t);
    A(t, f); X.save(); X.beginPath(); X.arc(x, y, r, 0, 7); X.clip(); B(t, f); X.restore();
    if (o.rim !== false && e < 1) { X.save(); X.strokeStyle = 'rgba(255,240,220,0.5)'; X.lineWidth = 10 * (1 - e); X.beginPath(); X.arc(x, y, r, 0, 7); X.stroke(); X.restore(); }
  };
  // iris out and in: A closes down to a point (colour outside), then B opens from the same point
  P.tr.irisOutIn = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const p = prog(t, s), x = o.x ?? W / 2, y = o.y ?? H / 2, f = f12(t), half = p < 0.5;
    const e = half ? E.camera(p * 2) : E.camera((p - 0.5) * 2), r = half ? maxR(x, y) * (1 - e) : maxR(x, y) * e;
    X.fillStyle = o.color || P.COLORS.night; X.fillRect(0, 0, W, H);
    X.save(); X.beginPath(); X.arc(x, y, Math.max(0, r), 0, 7); X.clip(); (half ? A : B)(t, f); X.restore();
  };
  // keyhole: like iris but the opening is a keyhole
  P.tr.keyhole = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = E.dive(prog(t, s)), x = o.x ?? W / 2, y = o.y ?? H * 0.45, sc = lerp(0.2, 14, e), f = f12(t);
    A(t, f); X.save(); X.translate(x, y); X.scale(sc, sc); X.beginPath(); X.arc(0, -40, 60, 0, 7); X.moveTo(-34, 0); X.lineTo(34, 0); X.lineTo(58, 150); X.lineTo(-58, 150); X.closePath();
    X.setTransform(1, 0, 0, 1, 0, 0); X.clip(); B(t, f); X.restore();
  };
  // dive: the camera zooms into rect r ({x, y, w, h} in A's frame) where B is showing, until B fills the screen.
  // o.cover: draw a velvet cover over the rect that lifts during the first 40 %
  P.tr.dive = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const r = o.rect, e = E.dive(prog(t, s)), z = lerp(1, Math.max(W / r.w, H / r.h), e), cx = r.x + r.w / 2, cy = r.y + r.h / 2, f = f12(t);
    const snapB = P.snap('diveB', () => B(t, f));
    X.save(); X.translate(W / 2, H / 2); X.scale(z, z); X.translate(-lerp(W / 2, cx, e), -lerp(H / 2, cy, e));
    A(t, f); P.framed(snapB, r.x, r.y, r.w, r.h, { cover: o.cover ? 1 - prog(t, [s[0], s[0] + (s[1] - s[0]) * 0.4]) : 0, label: o.label, m: o.m });
    X.restore();
  };
  // shrink: the reverse of dive. A shrinks into rect r on B (a wall with a frame), landing inside a gilt frame
  P.tr.shrink = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const r = o.rect, e = 1 - E.camera(prog(t, s)), z = lerp(1, Math.max(W / r.w, H / r.h), e), cx = r.x + r.w / 2, cy = r.y + r.h / 2, f = f12(t);
    const snapA = P.snap('shrinkA', () => A(t, f));
    X.save(); X.translate(W / 2, H / 2); X.scale(z, z); X.translate(-lerp(W / 2, cx, e), -lerp(H / 2, cy, e));
    B(t, f); P.framed(snapA, r.x, r.y, r.w, r.h, { m: o.m }); X.restore();
  };
  // shatter: A cracks, then falls away in triangle shards onto B
  const SHARDS = {};
  function shards(seed) {
    if (SHARDS[seed]) return SHARDS[seed]; const cols = 5, rows = 9, r = P.rng(seed), Pt = [], out = [];
    for (let j = 0; j <= rows; j++) { Pt[j] = []; for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; Pt[j][i] = [i * W / cols + (edge ? 0 : (r() - .5) * 120), j * H / rows + (edge ? 0 : (r() - .5) * 120)]; } }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = Pt[j][i], b = Pt[j][i + 1], c = Pt[j + 1][i + 1], d = Pt[j + 1][i];
      for (const tri of (r() > .5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]])) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        out.push({ tri, cx, cy, vx: (cx - W / 2) * 0.9 + (r() - .5) * 300, vy: -350 - r() * 500, w: (r() - .5) * 6, delay: (cy / H) * 0.15 + r() * 0.08 });
      }
    }
    return (SHARDS[seed] = out);
  }
  P.tr.shatter = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const f = f12(t), st = t - s[0], snapA = P.snap('shatterA', () => A(s[0], f12(s[0])));
    B(t, f);
    for (const sh of shards(o.seed || 99)) {
      const u = Math.max(0, st - 0.18 - sh.delay), dx = sh.vx * u, dy = sh.vy * u + 2600 * u * u / 2, a = sh.w * u;
      X.save(); X.translate(sh.cx + dx, sh.cy + dy); X.rotate(a); X.translate(-sh.cx, -sh.cy);
      X.beginPath(); X.moveTo(...sh.tri[0]); X.lineTo(...sh.tri[1]); X.lineTo(...sh.tri[2]); X.closePath();
      X.save(); X.clip(); X.drawImage(snapA, 0, 0); X.restore();
      if (st > 0.05) { X.strokeStyle = 'rgba(250,240,220,0.8)'; X.lineWidth = 3; X.stroke(); }
      X.restore();
    }
  };
  // curtain: velvet drops in steps over A, o.mid(t, f) draws on the closed curtain (a stamp), it rises on B
  P.tr.curtain = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const p = prog(t, s), f = f12(t), d = o.down ?? 0.35, u = o.up ?? 0.7;
    const curtain = k => { const h = H * k; if (h <= 0) return; const g = X.createLinearGradient(0, 0, W, 0); for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, i % 2 ? (o.dark || '#a23a1f') : (o.light || '#c9502e')); X.fillStyle = g; X.fillRect(0, 0, W, h); X.fillStyle = 'rgba(0,0,0,0.25)'; X.fillRect(0, h - 26, W, 26); };
    if (p < d) { A(t, f); curtain(P.step(p / d, 6)); }
    else if (p < u) { curtain(1); if (o.mid) o.mid(t, f); }
    else { B(t, f); curtain(1 - P.step((p - u) / (1 - u), 6)); }
  };
  // paper tear: a ragged edge sweeps down; above it B, below it A, with a white torn rim and a shadow
  P.tr.tear = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const k = P.step(E.camera(prog(t, s)), 8), f = f12(t), y0 = -80 + (H + 160) * k, r = P.rng(o.seed || 5), pts = [];
    for (let x = -20; x <= W + 40; x += 40) pts.push([x, y0 + (r() - .5) * 70]);
    const edge = dy => { X.beginPath(); X.moveTo(-20, -40); pts.forEach(([x, y]) => X.lineTo(x, y + dy)); X.lineTo(W + 40, -40); X.closePath(); };
    A(t, f);
    X.save(); X.shadowColor = 'rgba(0,0,0,0.45)'; X.shadowBlur = 30; X.shadowOffsetY = 12; edge(14); X.fillStyle = '#f4ecdc'; X.fill(); X.restore();
    X.save(); edge(0); X.clip(); B(t, f); X.restore();
  };
  // ink bleed: B seeps in through growing blots
  P.tr.ink = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = prog(t, s), f = f12(t), r = P.rng(o.seed || 17);   // linear: ink spreads at an even rate
    A(t, f); X.save(); X.beginPath();
    for (let i = 0; i < (o.n || 14); i++) {
      const x = r() * W, y = r() * H, d = r() * 0.5, rad = Math.max(0, e * 1.6 - d * 0.9) * 800;
      if (rad <= 0) continue; X.moveTo(x + rad, y); X.arc(x, y, rad, 0, 7);
      for (let j = 0; j < 5; j++) { const a = r() * 7, dd = rad * (0.7 + r() * 0.4), rr = rad * (0.25 + r() * 0.3); X.moveTo(x + Math.cos(a) * dd + rr, y + Math.sin(a) * dd); X.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, rr, 0, 7); }
    }
    X.clip(); B(t, f); X.restore();
  };
  // mosaic: tiles flip over one by one along the diagonal, A on the front, B on the back
  P.tr.mosaic = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const cols = o.cols || 6, rows = o.rows || 10, tw = W / cols, th = H / rows, p = prog(t, s), f = f12(t);
    const sa = P.snap('mosA', () => A(t, f)), sb = P.snap('mosB', () => B(t, f));
    X.fillStyle = P.COLORS.night; X.fillRect(0, 0, W, H);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const q = clamp(p * 1.8 - (o.order === 'diagonal' ? (i + j) / (cols + rows) : hash(i, j + 50)) * 0.8), sx = q < 0.5 ? 1 - 2 * q : 2 * q - 1, img = q < 0.5 ? sa : sb;
      X.save(); X.translate(i * tw + tw / 2, j * th + th / 2); X.scale(Math.max(0.001, sx), 1); X.drawImage(img, i * tw, j * th, tw, th, -tw / 2 + 3, -th / 2 + 3, tw - 6, th - 6); X.restore();
    }
  };
  // card flip: the whole picture turns over like a card (stepped)
  P.tr.flipCard = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const q = P.step(prog(t, s), 8), f = f12(t), sx = q < 0.5 ? 1 - 2 * q : 2 * q - 1;
    X.fillStyle = o.bg || P.COLORS.night; X.fillRect(0, 0, W, H);
    X.save(); X.translate(W / 2, H / 2); X.scale(Math.max(0.001, sx), 1 - 0.08 * (1 - sx)); X.translate(-W / 2, -H / 2); (q < 0.5 ? A : B)(t, f);
    X.fillStyle = `rgba(0,0,0,${0.5 * (1 - sx)})`; X.fillRect(0, 0, W, H); X.restore();
  };
  // page turn: A peels away from the right edge, its back showing as a paler strip, B underneath
  P.tr.pageTurn = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = P.step(E.camera(prog(t, s)), 10), f = f12(t), xf = W * (1 - e) * 1.15 - W * 0.15, fw = 220 * Math.sin(Math.PI * e);
    B(t, f);
    X.save(); X.beginPath(); X.rect(0, 0, Math.max(0, xf), H); X.clip(); A(t, f); X.restore();
    if (fw > 1) {
      X.save(); const g = X.createLinearGradient(xf, 0, xf + fw, 0); g.addColorStop(0, '#d9ccb4'); g.addColorStop(0.6, '#f4ecdc'); g.addColorStop(1, '#bfb19a');
      X.fillStyle = g; X.shadowColor = 'rgba(0,0,0,0.45)'; X.shadowBlur = 40; X.shadowOffsetX = 20; X.fillRect(xf, 0, fw, H); X.restore();
    }
  };
  // slide over: B slides in over A (which darkens), landing on a spring
  P.tr.slideOver = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const e = E.spring(prog(t, s), 0.5, 12), dir = o.dir ?? 1, f = f12(t);
    A(t, f); X.fillStyle = `rgba(0,0,0,${0.4 * clamp(e)})`; X.fillRect(0, 0, W, H);
    X.save(); X.translate(dir * W * (1 - e), 0); X.shadowColor = 'rgba(0,0,0,0.5)'; X.shadowBlur = 50; X.fillStyle = '#000'; X.fillRect(0, 0, W, H); X.shadowColor = 'transparent'; B(t, f); X.restore();
  };
  // drop: A falls away down while B drops in from above on a spring
  P.tr.drop = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const p = prog(t, s), e = E.spring(clamp(p * 1.2), 0.45, 12), f = f12(t);
    at(0, H * clamp(e), () => A(t, f)); at(0, -H + H * e, () => B(t, f));
  };
  // pop: A shrinks and tips away, B pops up from small with an overshoot
  P.tr.pop = (t, s, A, B, o = {}) => {
    if (before(t, s, A, B)) return; const p = prog(t, s), f = f12(t);
    X.fillStyle = o.bg || P.COLORS.night; X.fillRect(0, 0, W, H);
    if (p < 0.45) { const e = E.dive(p / 0.45); X.save(); X.translate(W / 2, H / 2); X.rotate(0.15 * e); X.scale(1 - 0.8 * e, 1 - 0.8 * e); X.translate(-W / 2, -H / 2); A(t, f); X.restore(); }
    else { const e = E.spring((p - 0.45) / 0.55, 0.35, 14); X.save(); X.translate(W / 2, H / 2); X.scale(0.2 + 0.8 * e, 0.2 + 0.8 * e); X.translate(-W / 2, -H / 2); B(t, f); X.restore(); }
  };
  // gallery: frames on a wall. cells: [[draw fn | image, ...] rows]. P.gallery(cells, cam, t, f) where cam = {x, y, z}
  // in wall units. P.galleryCell(c, r) → [x, y] of a cell; P.galleryAll() → cam showing the whole wall
  P.GAL = { fw: W, fh: H, gap: 380 };
  P.galleryCell = (c, r) => [P.GAL.gap + c * (P.GAL.fw + P.GAL.gap), P.GAL.gap + r * (P.GAL.fh + P.GAL.gap)];
  P.gallerySize = cells => [cells[0].length * P.GAL.fw + (cells[0].length + 1) * P.GAL.gap, cells.length * P.GAL.fh + (cells.length + 1) * P.GAL.gap];
  P.galleryAll = cells => { const [gw, gh] = P.gallerySize(cells); return { x: gw / 2, y: gh / 2, z: Math.min(W / gw, H / gh) * 0.98 }; };
  P.galleryFocus = (c, r) => { const [x, y] = P.galleryCell(c, r); return { x: x + W / 2, y: y + H / 2, z: 1 }; };
  P.camLerp = (a, b, e) => ({ x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), e)) });
  P.gallery = (cells, cam, t, f, o = {}) => {
    const [gw, gh] = P.gallerySize(cells);
    X.save(); X.translate(W / 2, H / 2); X.scale(cam.z, cam.z); X.translate(-cam.x, -cam.y);
    X.fillStyle = o.wall || P.COLORS.cobalt; X.fillRect(-6000, -6000, gw + 12000, gh + 12000);
    for (let i = -2; i < Math.ceil(gw / (W * 1.6)) + 2; i++) for (let j = -2; j < Math.ceil(gh / (H * 1.6)) + 2; j++) X.drawImage(P.tex(f), i * W * 1.6, j * H * 1.6, W * 1.6, H * 1.6);
    cells.forEach((row, r) => row.forEach((c, k) => {
      const [x, y] = P.galleryCell(k, r);
      X.save(); X.beginPath(); X.rect(x, y, W, H); X.clip(); X.translate(x, y);
      if (typeof c === 'function') c(t, f); else P.cover(c, 0, 0, W, H); X.restore();
      P.gilt(x, y, W, H, 110);
    }));
    X.restore();
  };
  P.TRANSITIONS = Object.keys(P.tr);
})();
