// Forged-metal UI frames (pixel-art, all fillRect - no images): a bevelled iron band with an
// engraved groove, rivets along the edges, spiked corner bosses with a gem, an optional crest
// plaque on the top edge and an optional accent glow line inside. Used by UIManager.frame/box/
// textButton and the Horseman select screen, so every panel shares one look.
//
// metalFrame(ctx, x, y, w, h, opts)
//   band     band thickness in px (default 6); content should start at x + band
//   fill     inner colour (null = leave the inside untouched)
//   accent   colour for the inner glow line + corner gems (default bronze)
//   rivets   true/false (default true when the side is long enough)
//   corners  'spike' (default) | 'boss' | 'none'
//   crest    true = small plaque with a gem on the top edge
//   metal    'iron' (default) | 'bronze' | 'gold'
export const METALS = {
  // outer -> inner, lit side (top/left) and shaded side (bottom/right)
  iron: { lit: ['#050403', '#4a443c', '#8c8474', '#5c554a', '#3a352e', '#1c1915', '#0a0806'], dark: ['#050403', '#26221d', '#3e3830', '#2c2822', '#1e1b17', '#121009', '#0a0806'], rivet: ['#0a0806', '#6a6050', '#c8bca0'] },
  bronze: { lit: ['#050403', '#6a4a24', '#c89a52', '#8a6430', '#5a3e1c', '#2a1c0c', '#0a0806'], dark: ['#050403', '#3a2810', '#5a3e1c', '#3a2810', '#2a1c0c', '#180f06', '#0a0806'], rivet: ['#0a0806', '#8a6430', '#f0d090'] },
  gold: { lit: ['#050403', '#8a6418', '#f0cc60', '#c09030', '#806018', '#3a2a0a', '#0a0806'], dark: ['#050403', '#4a3408', '#8a6418', '#5a4010', '#3a2a0a', '#1c1404', '#0a0806'], rivet: ['#0a0806', '#c09030', '#fff0b0'] },
};

function pick(pal, i, t) {
  // stretch the 7-tone ramp over any band thickness
  const k = t <= 1 ? 0 : Math.round((i / (t - 1)) * (pal.length - 1));
  return pal[k];
}

export function rivet(ctx, cx, cy, m = METALS.iron) {
  ctx.fillStyle = m.rivet[0]; ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.fillStyle = m.rivet[1]; ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.fillStyle = m.rivet[2]; ctx.fillRect(cx - 1, cy - 1, 1, 1);
}

function gem(ctx, cx, cy, r, color) {
  ctx.fillStyle = '#050403';
  for (let k = -r - 1; k <= r + 1; k++) { const hw = r + 1 - Math.abs(k); ctx.fillRect(cx - hw, cy + k, hw * 2 + 1, 1); }
  ctx.fillStyle = color;
  for (let k = -r; k <= r; k++) { const hw = r - Math.abs(k); ctx.fillRect(cx - hw, cy + k, hw * 2 + 1, 1); }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(cx - 1, cy - r + 1, 1, 1);
}

function corner(ctx, cx, cy, sx, sy, size, m, accent, style) {
  if (style === 'none') return;
  const s = size, x0 = sx > 0 ? cx : cx - s + 1, y0 = sy > 0 ? cy : cy - s + 1;
  // outward spike along the diagonal
  if (style === 'spike') {
    // main diagonal spike plus two short side thorns
    for (let k = 1; k <= 6; k++) {
      const sz = k < 4 ? 3 : k < 6 ? 2 : 1;
      ctx.fillStyle = '#050403'; ctx.fillRect(cx - sx * k - 1, cy - sy * k - 1, sz + 1, sz + 1);
      ctx.fillStyle = k < 3 ? m.lit[2] : m.lit[1]; ctx.fillRect(cx - sx * k, cy - sy * k, sz, sz);
    }
    ctx.fillStyle = m.rivet[2]; ctx.fillRect(cx - sx * 6, cy - sy * 6, 1, 1);
    ctx.fillStyle = m.lit[1];
    ctx.fillRect(cx - sx * 4, cy + sy * 1, 2, 1); ctx.fillRect(cx + sx * 1, cy - sy * 4, 1, 2);
  }
  ctx.fillStyle = '#050403'; ctx.fillRect(x0 - 1, y0 - 1, s + 2, s + 2);
  ctx.fillStyle = m.dark[2]; ctx.fillRect(x0, y0, s, s);
  ctx.fillStyle = m.lit[2]; ctx.fillRect(x0, y0, s, 1); ctx.fillRect(x0, y0, 1, s);
  ctx.fillStyle = m.lit[3]; ctx.fillRect(x0 + 1, y0 + 1, s - 2, s - 2);
  ctx.fillStyle = m.dark[1]; ctx.fillRect(x0 + 2, y0 + s - 2, s - 3, 1); ctx.fillRect(x0 + s - 2, y0 + 2, 1, s - 3);
  gem(ctx, x0 + Math.floor(s / 2), y0 + Math.floor(s / 2), Math.max(1, Math.floor(s / 2) - 2), accent);
}

export function metalFrame(ctx, x, y, w, h, opts = {}) {
  const t = opts.band ?? 6, m = METALS[opts.metal || 'iron'];
  const accent = opts.accent || '#c89a52';
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (opts.fill) { ctx.fillStyle = opts.fill; ctx.fillRect(x + t, y + t, w - t * 2, h - t * 2); }
  // bevelled band: ring i, lit on top/left, shaded on bottom/right
  for (let i = 0; i < t; i++) {
    const L = pick(m.lit, i, t), D = pick(m.dark, i, t);
    ctx.fillStyle = L; ctx.fillRect(x + i, y + i, w - i * 2, 1); ctx.fillRect(x + i, y + i, 1, h - i * 2);
    ctx.fillStyle = D; ctx.fillRect(x + i, y + h - 1 - i, w - i * 2, 1); ctx.fillRect(x + w - 1 - i, y + i, 1, h - i * 2);
  }
  // engraved groove + knurled notches on the top and bottom bands
  if (t >= 5) {
    const g = Math.floor(t / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + t, y + g, w - t * 2, 1); ctx.fillRect(x + t, y + h - 1 - g, w - t * 2, 1);
    ctx.fillRect(x + g, y + t, 1, h - t * 2); ctx.fillRect(x + w - 1 - g, y + t, 1, h - t * 2);
    ctx.fillStyle = 'rgba(255,240,200,0.10)';
    for (let k = x + t + 3; k < x + w - t - 3; k += 6) { ctx.fillRect(k, y + 1, 1, g - 1); ctx.fillRect(k, y + h - g, 1, g - 1); }
  }
  // engraved diamond chain between the rivets (bands of 6px and more)
  const c = Math.floor(t / 2), step = 44;
  const nearRivet = (k, o) => { if (opts.rivets === false) return false; const r = ((k - o - 22) % step + step) % step; return r < 5 || r > step - 5; };
  if (t >= 5 && opts.pattern !== false) {
    const dia = (px, py) => {
      ctx.fillStyle = m.dark[1]; ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3);
      ctx.fillStyle = m.rivet[2]; ctx.globalAlpha = 0.55; ctx.fillRect(px, py - 1, 1, 1); ctx.globalAlpha = 1;
    };
    for (let k = x + t + 6; k < x + w - t - 6; k += 8) if (!nearRivet(k, x)) { dia(k, y + c); dia(k, y + h - 1 - c); }
    for (let k = y + t + 6; k < y + h - t - 6; k += 8) if (!nearRivet(k, y)) { dia(x + c, k); dia(x + w - 1 - c, k); }
  }
  // rivets
  if (opts.rivets !== false && t >= 4) {
    for (let k = x + 22; k < x + w - 18; k += step) { rivet(ctx, k, y + c, m); rivet(ctx, k, y + h - 1 - c, m); }
    for (let k = y + 22; k < y + h - 18; k += step) { rivet(ctx, x + c, k, m); rivet(ctx, x + w - 1 - c, k, m); }
  }
  // corner brackets: a raised ridge running ~18px along both edges just outside the frame,
  // ending in a curl - the "filigree" around each corner
  if (opts.brackets !== false && t >= 5 && w > 60 && h > 40) {
    const L = Math.min(22, Math.floor(Math.min(w, h) / 4));
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
      const ox = cx - sx * 2, oy = cy - sy * 2;
      ctx.fillStyle = '#050403';
      ctx.fillRect(sx > 0 ? ox - 1 : ox - L, oy - 1, L + 2, 3); ctx.fillRect(ox - 1, sy > 0 ? oy - 1 : oy - L, 3, L + 2);
      ctx.fillStyle = m.lit[2];
      ctx.fillRect(sx > 0 ? ox : ox - L + 1, oy, L, 1); ctx.fillRect(ox, sy > 0 ? oy : oy - L + 1, 1, L);
      // curls at both ends
      ctx.fillStyle = m.lit[1];
      ctx.fillRect(ox + sx * L - (sx > 0 ? 1 : 0), oy + sy * 1, 2, 2);
      ctx.fillRect(ox + sx * 1, oy + sy * L - (sy > 0 ? 1 : 0), 2, 2);
    }
  }
  // inner accent line
  if (opts.accent) { ctx.globalAlpha = 0.65; ctx.fillStyle = accent; ctx.fillRect(x + t, y + t, w - t * 2, 1); ctx.fillRect(x + t, y + h - t - 1, w - t * 2, 1); ctx.fillRect(x + t, y + t, 1, h - t * 2); ctx.fillRect(x + w - t - 1, y + t, 1, h - t * 2); ctx.globalAlpha = 1; }
  // corners
  const cs = Math.max(7, t + 4), style = opts.corners || 'spike';
  corner(ctx, x - 1, y - 1, 1, 1, cs, m, accent, style);
  corner(ctx, x + w, y - 1, -1, 1, cs, m, accent, style);
  corner(ctx, x - 1, y + h, 1, -1, cs, m, accent, style);
  corner(ctx, x + w, y + h, -1, -1, cs, m, accent, style);
  // crest plaque on the top edge
  if (opts.crest && w > 80) {
    const pw = 30, ph = t + 6, px = Math.round(x + w / 2 - pw / 2), py = y - 3;
    ctx.fillStyle = '#050403'; ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = m.lit[2]; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = m.lit[3]; ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.fillStyle = m.dark[1]; ctx.fillRect(px + 1, py + ph - 1, pw - 2, 1);
    for (const sx of [px + 3, px + pw - 4]) { ctx.fillStyle = m.dark[1]; ctx.fillRect(sx, py + 2, 1, ph - 4); }
    gem(ctx, px + pw / 2, py + Math.floor(ph / 2), Math.max(2, Math.floor(ph / 2) - 2), accent);
  }
}

// Small metal plate (buttons): bevelled face with an optional sheen and end rivets.
export function metalPlate(ctx, x, y, w, h, opts = {}) {
  const m = METALS[opts.metal || 'iron'];
  ctx.fillStyle = '#050403'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const face = opts.face || [m.lit[3], m.lit[4], m.dark[3]];
  g.addColorStop(0, face[0]); g.addColorStop(0.5, face[1]); g.addColorStop(1, face[2]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = m.lit[2]; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = m.dark[1]; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.fillRect(x + 1, y + 1, w - 2, Math.max(1, Math.floor(h / 3)));
  if (opts.rivets !== false && w >= 40 && h >= 12) { const cy = y + Math.floor(h / 2); rivet(ctx, x + 4, cy, m); rivet(ctx, x + w - 5, cy, m); }
}
