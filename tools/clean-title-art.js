// Title-art preparation tool (Phase 6 main menu). Runs in a browser (needs canvas):
//   import('/tools/clean-title-art.js').then((m) => m.cleanTitleArt()).then((c) => ...)
// The concept image has the title, the menu buttons and a controls bar PAINTED IN. The game draws
// those from code (editable text, real buttons), so they are removed here: each region is refilled
// by push-pull interpolation from the surrounding colours, plus soft cloud noise and pixel grain so
// it reads as part of the painting, with feathered edges (no seams). Output: assets/title/menu_bg.webp
// (written by the developer from the returned canvas; see README "Main menu art").
// feather: px of soft blend inside each edge [left, top, right, bottom] (kept small where the
// painted text runs close to the edge, or where the Blood Moon must stay untouched on the right)
export const BAKED_REGIONS = [
  { name: 'title', x: 340, y: 22, w: 950, h: 335, feather: [40, 20, 10, 18] },
  { name: 'buttons', x: 640, y: 352, w: 395, h: 242, feather: [26, 8, 26, 14] },
  { name: 'controls', x: 400, y: 812, w: 880, h: 100, feather: [30, 10, 30, 6] },
];

export async function cleanTitleArt(src = '/assets/title/concept_src.webp', regions = BAKED_REGIONS) {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H), px = data.data;
  // mask: 1 = keep original, 0 = fill, smooth (smoothstep) feather per edge inside each region
  const keep = new Float32Array(W * H).fill(1);
  const ss = (t) => t * t * (3 - 2 * t);
  for (const r of regions) {
    const [fl, ft, fr, fb] = r.feather || [10, 10, 10, 10];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const a = Math.min(1, (x - r.x) / fl, (r.x + r.w - 1 - x) / fr, (y - r.y) / ft, (r.y + r.h - 1 - y) / fb);
      keep[y * W + x] = Math.min(keep[y * W + x], 1 - ss(Math.max(0, a)));
    }
  }
  // ---- push-pull fill (only fully-kept pixels are known)
  let lw = W, lh = H;
  let lvl = { w: lw, h: lh, c: new Float32Array(W * H * 3), k: new Float32Array(W * H) };
  for (let i = 0; i < W * H; i++) { const k = keep[i] >= 1 ? 1 : 0; lvl.k[i] = k; lvl.c[i * 3] = px[i * 4] * k; lvl.c[i * 3 + 1] = px[i * 4 + 1] * k; lvl.c[i * 3 + 2] = px[i * 4 + 2] * k; }
  const pyr = [lvl];
  while (lvl.w > 2 && lvl.h > 2) { // pull: 2x2 weighted sums, normalised
    const nw = Math.ceil(lvl.w / 2), nh = Math.ceil(lvl.h / 2);
    const n = { w: nw, h: nh, c: new Float32Array(nw * nh * 3), k: new Float32Array(nw * nh) };
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let s0 = 0, s1 = 0, s2 = 0, sk = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(lvl.w - 1, x * 2 + dx), sy = Math.min(lvl.h - 1, y * 2 + dy), j = sy * lvl.w + sx;
        s0 += lvl.c[j * 3]; s1 += lvl.c[j * 3 + 1]; s2 += lvl.c[j * 3 + 2]; sk += lvl.k[j];
      }
      const i = y * nw + x, kk = Math.min(1, sk);
      if (sk > 0) { n.c[i * 3] = (s0 / sk) * kk; n.c[i * 3 + 1] = (s1 / sk) * kk; n.c[i * 3 + 2] = (s2 / sk) * kk; }
      n.k[i] = kk;
    }
    pyr.push(n); lvl = n;
  }
  for (let li = pyr.length - 2; li >= 0; li--) { // push: fill holes from the coarser level (bilinear)
    const f = pyr[li], co = pyr[li + 1];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x, k = f.k[i];
      if (k >= 1) continue;
      const fx = Math.min(co.w - 1, Math.max(0, x / 2 - 0.25)), fy = Math.min(co.h - 1, Math.max(0, y / 2 - 0.25));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(co.w - 1, x0 + 1), y1 = Math.min(co.h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
      for (let ch = 0; ch < 3; ch++) {
        const g = (xx, yy) => { const j = yy * co.w + xx; return co.k[j] > 0 ? co.c[j * 3 + ch] / co.k[j] : 0; };
        const v = (g(x0, y0) * (1 - ax) + g(x1, y0) * ax) * (1 - ay) + (g(x0, y1) * (1 - ax) + g(x1, y1) * ax) * ay;
        f.c[i * 3 + ch] = f.c[i * 3 + ch] + v * (1 - k); // premultiplied known part + coarse fill
      }
      f.k[i] = 1;
    }
  }
  // ---- texture: fBm value noise (clouds) + per-pixel grain, scaled to the local brightness
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c2 + (d - c2) * sx) * sy; };
  const fbm = (x, y) => { let s = 0, a = 0.5, f = 1 / 48; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; } return s; };
  const fine = pyr[0];
  for (let i = 0; i < W * H; i++) {
    const k = keep[i];
    if (k >= 1) continue;
    const x = i % W, y = (i / W) | 0;
    const n = fbm(x, y);
    const cloud = 0.45 + n * 1.25;                        // strong cloud/smoke brightness modulation
    const wisp = Math.max(0, fbm(x * 1.7 + 913, y * 2.4 + 211) - 0.56) * 260; // thin ember-red wisps
    const grain = (hash(x >> 1, y >> 1) - 0.5) * 16;     // 2x2 pixel grain like the painting
    for (let ch = 0; ch < 3; ch++) {
      const add = ch === 0 ? wisp : ch === 1 ? wisp * 0.18 : wisp * 0.1;
      const fill = Math.max(0, Math.min(255, (fine.c[i * 3 + ch] / Math.max(1e-6, fine.k[i])) * cloud + add + grain));
      px[i * 4 + ch] = Math.round(px[i * 4 + ch] * k + fill * (1 - k));
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}
