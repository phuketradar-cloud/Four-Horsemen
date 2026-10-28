// Bakes painted enemy art into in-game frames (run in the browser on the dev server):
//   const m = await import('/tools/make-enemy-art.js'); const out = await m.bakeEnemy('skeleton');
// Source: assets/enemies/src/<id>_<pose>.webp (any size; idle / windup / attack / hurt).
// 1. background removal: real alpha is kept; an opaque white / light-grey (checkerboard) backdrop is
//    flood-filled away from the image border (only light, colourless pixels connected to the edge)
// 2. one crop rectangle for ALL poses (union of the figures, centred on the idle body) so the body
//    keeps its size and the feet stay on the same baseline in every frame
// 3. high-quality downscale (halving steps) so the idle body is BODY_H pixels tall
// Returns { pose: dataURL(png) } for assets/enemies/<id>/<pose>.png.
export const POSES = ['idle', 'windup', 'attack', 'hurt'];
const BODY_H = 128;

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function cutBackground(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, W = c.width, H = c.height;
  let transparentEdge = 0;
  for (let i = 0; i < W; i++) if (d[(i) * 4 + 3] < 20) transparentEdge++;
  if (transparentEdge > W * 0.5) return c; // already has real transparency
  const bg = (p) => { const r = d[p], g = d[p + 1], b = d[p + 2]; return Math.min(r, g, b) > 196 && Math.max(r, g, b) - Math.min(r, g, b) < 14; };
  const seen = new Uint8Array(W * H), q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  const push = (k) => { if (!seen[k] && bg(k * 4)) { seen[k] = 1; q[qt++] = k; } };
  for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  while (qh < qt) {
    const k = q[qh++], px = k % W, py = (k / W) | 0;
    d[k * 4 + 3] = 0;
    if (px > 0) push(k - 1); if (px < W - 1) push(k + 1); if (py > 0) push(k - W); if (py < H - 1) push(k + W);
  }
  // enclosed backdrop (between legs, shield and body, inside a slash arc): large islands of the same
  // near-white / light-grey pixels are cleared too; small ones (blade glints, bone highlights) stay
  const light = (p) => { const r = d[p], g = d[p + 1], b = d[p + 2]; return Math.min(r, g, b) > 214 && Math.max(r, g, b) - Math.min(r, g, b) < 14; };
  const comp = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || d[s * 4 + 3] === 0 || !light(s * 4)) continue;
    let n = 0; qh = 0; qt = 0; q[qt++] = s; seen[s] = 2;
    while (qh < qt) {
      const k = q[qh++]; comp[n++] = k;
      const px = k % W, py = (k / W) | 0;
      for (const nk of [px > 0 ? k - 1 : -1, px < W - 1 ? k + 1 : -1, py > 0 ? k - W : -1, py < H - 1 ? k + W : -1]) {
        if (nk >= 0 && !seen[nk] && d[nk * 4 + 3] !== 0 && light(nk * 4)) { seen[nk] = 2; q[qt++] = nk; }
      }
    }
    if (n > 600) for (let i = 0; i < n; i++) { d[comp[i] * 4 + 3] = 0; seen[comp[i]] = 1; }
  }
  // soften the 1px halo left by anti-aliased edges: light pixels touching cleared ones fade out
  for (let k = 0; k < W * H; k++) {
    if (d[k * 4 + 3] === 0 || !bg(k * 4)) continue;
    const px = k % W, py = (k / W) | 0;
    const near = (px > 0 && seen[k - 1] === 1) || (px < W - 1 && seen[k + 1] === 1) || (py > 0 && seen[k - W] === 1) || (py < H - 1 && seen[k + W] === 1);
    if (near) d[k * 4 + 3] = 0;
  }
  x.putImageData(id, 0, 0);
  return c;
}

function bbox(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

function downscale(src, sx, sy, sw, sh, w, h) {
  let cur = document.createElement('canvas'); cur.width = sw; cur.height = sh;
  cur.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  while (cur.width / 2 >= w) {
    const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, w, h);
  // crisp alpha: pixel-art sprites have hard edges
  const id = x.getImageData(0, 0, w, h);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] < 110 ? 0 : 255;
  x.putImageData(id, 0, 0);
  return out;
}

export async function bakeEnemy(id, base = '/assets/enemies/src/') {
  const cut = {};
  for (const p of POSES) cut[p] = cutBackground(await load(`${base}${id}_${p}.webp`));
  const boxes = Object.fromEntries(POSES.map((p) => [p, bbox(cut[p])]));
  const body = boxes.idle;
  const cx = (body.x0 + body.x1) / 2;
  const top = Math.min(...POSES.map((p) => boxes[p].y0)), bottom = Math.max(...POSES.map((p) => boxes[p].y1));
  const half = Math.max(...POSES.map((p) => Math.max(cx - boxes[p].x0, boxes[p].x1 - cx))) + 2;
  const k = BODY_H / (body.y1 - body.y0 + 1);
  const rect = { x: Math.round(cx - half), y: top, w: Math.round(half * 2), h: bottom - top + 1 };
  const W = Math.round(rect.w * k), H = Math.round(rect.h * k);
  const out = {};
  for (const p of POSES) out[p] = downscale(cut[p], rect.x, rect.y, rect.w, rect.h, W, H).toDataURL('image/png');
  return { frames: out, size: [W, H], bodyH: BODY_H, bodyTop: Math.round((body.y0 - top) * k) };
}
