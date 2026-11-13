// Bakes painted enemy art into in-game frames (run in the browser on the dev server):
//   const m = await import('/tools/make-enemy-art.js'); const out = await m.bakeEnemy('skeleton');
// Source: assets/enemies/src/<id>_<pose>.webp (any size; idle / windup / attack / hurt).
// 1. background removal: real alpha is kept; a chroma-key green backdrop is keyed out (plus despill);
//    an opaque white / light-grey (checkerboard) backdrop is flood-filled away from the image border
//    (only light, colourless pixels connected to the edge)
// 2. one crop rectangle for ALL poses (union of the figures, centred on the idle body) so the body
//    keeps its size and the feet stay on the same baseline in every frame
// 3. high-quality downscale (halving steps) so the idle body is BAKE.bodyH pixels tall
// Returns { pose: dataURL(png) } for assets/enemies/<id>/<pose>.png.
import { isGreenScreen, keyGreen } from '../src/render/ChromaKey.js';

export const ALL_POSES = ['idle', 'windup', 'attack', 'hurt'];
// idle body height of the baked frames. 256 since the 2x frame (RENDER_SCALE 2); bake at 128 to compare
// with older files. The game sizes sprites by ratios, so any height works.
export const BAKE = { bodyH: 256 };

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export function cutBackground(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, W = c.width, H = c.height;
  let transparentEdge = 0;
  for (let i = 0; i < W; i++) if (d[(i) * 4 + 3] < 20) transparentEdge++;
  if (transparentEdge > W * 0.5) return c; // already has real transparency
  if (isGreenScreen(d, W, H)) { keyGreen(d); x.putImageData(id, 0, 0); return c; }
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

// 4x4 ordered dither (same look as the game's dithered glows), used where alpha fades out
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function downscale(src, sx, sy, sw, sh, w, h, ditherFromY = Infinity) {
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
  // crisp alpha: pixel-art sprites have hard edges; below ditherFromY a fading alpha is dithered
  const id = x.getImageData(0, 0, w, h);
  for (let i = 3; i < id.data.length; i += 4) {
    const px = ((i - 3) / 4) % w, py = Math.floor((i - 3) / 4 / w);
    const thr = py >= ditherFromY ? (BAYER[(py % 4) * 4 + (px % 4)] + 0.5) * 16 : 110;
    id.data[i] = id.data[i] < thr ? 0 : 255;
  }
  x.putImageData(id, 0, 0);
  return out;
}

// Paintings made separately (different canvas sizes) are not framed alike, so a shared crop would
// mis-scale them: each pose is then cropped to its own figure, scaled to the idle body height and
// stood on the same baseline, centred.
function bakeSeparate(cut, boxes) {
  const POSES = Object.keys(cut);
  const k = {}, size = {};
  for (const p of POSES) {
    const b = boxes[p], h = b.y1 - b.y0 + 1, w = b.x1 - b.x0 + 1;
    k[p] = BAKE.bodyH / h;
    size[p] = [Math.round(w * k[p]), BAKE.bodyH];
  }
  const W = Math.max(...POSES.map((p) => size[p][0])) + 2, H = BAKE.bodyH;
  const out = {};
  for (const p of POSES) {
    const b = boxes[p];
    const fr = downscale(cut[p], b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, size[p][0], size[p][1]);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(fr, Math.round((W - fr.width) / 2), H - fr.height);
    out[p] = c.toDataURL('image/png');
  }
  return { frames: out, size: [W, H], bodyH: BAKE.bodyH, bodyTop: 0, mode: 'separate' };
}

// Ground effects painted to the image edge (mist, smoke) would end in a hard rectangle: in the lowest
// `ground` fraction of the image they are tapered into a mound that fades out before the side edges.
function fadeGround(c, ground) {
  const x = c.getContext('2d'), W = c.width, H = c.height, id = x.getImageData(0, 0, W, H), d = id.data;
  const y0 = H * (1 - ground), cx = W / 2, soft = W * 0.12;
  for (let y = Math.ceil(y0); y < H; y++) {
    const t = (y - y0) / (H - y0), blend = Math.min(1, (y - y0) / (H * 0.06));
    const half = (W / 2) * (0.55 + 0.45 * t);
    for (let px = 0; px < W; px++) {
      const m = Math.max(0, Math.min(1, (half - Math.abs(px - cx)) / soft));
      const k = (y * W + px) * 4 + 3;
      d[k] = Math.round(d[k] * (1 - blend * (1 - m)));
    }
  }
  x.putImageData(id, 0, 0);
}

// ---------------------------------------------------------------- pose sheets
// One painting with all four poses in a 2x2 layout (any aspect): TL idle, TR windup, BL attack, BR hurt.
// The poses are found as figures, not cut on the quadrant lines, so a weapon that reaches across the
// middle stays with its owner: the keyed image is split into connected shapes (on a coarse grid, so
// sparks and effects next to a figure join it). A shape that lies mostly (85%+) in one quadrant goes
// there whole; a shape spread over several quadrants (two poses drawn touching) is cut on the midlines.
// Panel divider lines (a thin dark line across the image, possibly broken by JPEG) are removed first.
const SHEET_POSES = [['idle', 0, 0], ['windup', 1, 0], ['attack', 0, 1], ['hurt', 1, 1]];

function clearDividers(d, W, H) {
  const on = (x, y) => d[(y * W + x) * 4 + 3] > 40;
  const rc = new Int32Array(H), cc = new Int32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) { rc[y]++; cc[x]++; }
  // a divider: covers 40%+ of the line and is thin (the lines 6px away are less than half as full)
  const thin = (a, i, n) => a[i] > n * 0.4 && (i < 6 || a[i - 6] < a[i] * 0.5) && (i + 6 >= a.length || a[i + 6] < a[i] * 0.5);
  const rows = [], cols = [];
  for (let y = 0; y < H; y++) if (thin(rc, y, W)) rows.push(y);
  for (let x = 0; x < W; x++) if (thin(cc, x, H)) cols.push(x);
  for (const y0 of rows) for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y0 + 2); y++) for (let x = 0; x < W; x++) d[(y * W + x) * 4 + 3] = 0;
  for (const x0 of cols) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x0 + 2); x++) for (let y = 0; y < H; y++) d[(y * W + x) * 4 + 3] = 0;
  return { rows: rows.length, cols: cols.length };
}

export function splitSheet(c) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  const id = x.getImageData(0, 0, W, H), d = id.data;
  const div = clearDividers(d, W, H);
  // coarse occupancy grid, dilated by one cell, labelled with 8-connectivity
  const S = 4, gw = Math.ceil(W / S), gh = Math.ceil(H / S), grid = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (d[(y * W + xx) * 4 + 3] > 40) grid[((y / S) | 0) * gw + ((xx / S) | 0)] = 1;
  const dil = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (grid[gy * gw + gx]) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const ny = gy + oy, nx = gx + ox; if (ny >= 0 && ny < gh && nx >= 0 && nx < gw) dil[ny * gw + nx] = 1; }
  const label = new Int32Array(gw * gh).fill(-1), stats = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!dil[s] || label[s] >= 0) continue;
    const L = stats.length, q = [s]; label[s] = L; let sx = 0, sy = 0, n = 0; const qn = [0, 0, 0, 0];
    while (q.length) {
      const k = q.pop(), gx = k % gw, gy = (k / gw) | 0;
      if (grid[k]) { sx += gx; sy += gy; n++; qn[(gx * S >= W / 2 ? 1 : 0) + (gy * S >= H / 2 ? 2 : 0)]++; }
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const ny = gy + oy, nx = gx + ox; if (ny < 0 || ny >= gh || nx < 0 || nx >= gw) continue; const nk = ny * gw + nx; if (dil[nk] && label[nk] < 0) { label[nk] = L; q.push(nk); } }
    }
    stats.push({ n, cx: n ? sx / n * S : 0, cy: n ? sy / n * S : 0, qn });
  }
  // shape -> its main quadrant, or -1 (= cut on the midlines) when no quadrant holds 85% of it
  const quad = stats.map((st) => { const m = Math.max(...st.qn); return st.n && m >= st.n * 0.85 ? st.qn.indexOf(m) : -1; });
  const out = {};
  for (const [pose, qx, qy] of SHEET_POSES) {
    const qi = qx + qy * 2, pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const px = pc.getContext('2d'), pid = px.createImageData(W, H), pd = pid.data;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = (y * W + xx) * 4;
      if (d[i + 3] === 0) continue;
      const l = label[((y / S) | 0) * gw + ((xx / S) | 0)];
      if (l < 0) continue;
      const q = quad[l] >= 0 ? quad[l] : (xx >= W / 2 ? 1 : 0) + (y >= H / 2 ? 2 : 0);
      if (q !== qi) continue;
      pd[i] = d[i]; pd[i + 1] = d[i + 1]; pd[i + 2] = d[i + 2]; pd[i + 3] = d[i + 3];
    }
    px.putImageData(pid, 0, 0);
    out[pose] = pc;
  }
  return { poses: out, shapes: stats.filter((s) => s.n > 50).length, cut: quad.filter((q, i) => q < 0 && stats[i].n > 50).length, dividers: div };
}

// Bake a 2x2 pose sheet (assets/enemies/src/<id>_sheet.(webp|png|jpg)): every pose is scaled by the
// same factor (idle body = BAKE.bodyH tall), stood on one baseline and centred, so a crouching attack
// stays lower than the standing idle instead of being stretched to the same height.
export async function bakeSheet(id, base = '/assets/enemies/src/') {
  const cut = cutBackground(await loadSource(base, id, 'sheet'));
  const { poses, shapes, cut: midCut, dividers } = splitSheet(cut);
  const boxes = Object.fromEntries(Object.entries(poses).map(([p, c]) => [p, bbox(c)]));
  const k = BAKE.bodyH / (boxes.idle.y1 - boxes.idle.y0 + 1);
  const size = Object.fromEntries(Object.entries(boxes).map(([p, b]) => [p, [Math.max(1, Math.round((b.x1 - b.x0 + 1) * k)), Math.max(1, Math.round((b.y1 - b.y0 + 1) * k))]]));
  const W = Math.max(...Object.values(size).map((s) => s[0])) + 2, H = Math.max(...Object.values(size).map((s) => s[1]));
  const frames = {};
  for (const [p, b] of Object.entries(boxes)) {
    const fr = downscale(poses[p], b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, size[p][0], size[p][1]);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(fr, Math.round((W - fr.width) / 2), H - fr.height);
    frames[p] = c.toDataURL('image/png');
  }
  return { frames, size: [W, H], mode: 'sheet', shapes, midCut, dividers };
}

// first source that exists: <id>_<pose>.webp / .png / .jpg
async function loadSource(base, id, pose) {
  for (const ext of ['webp', 'png', 'jpg']) { try { return await load(`${base}${id}_${pose}.${ext}`); } catch { /* next */ } }
  throw new Error(`${id}_${pose}: no source`);
}

// A pose without a source file is skipped (the game falls back to idle for it); idle is required.
// Horseman back views use the same baking: bakeEnemy('war', '/assets/heroes/src/', ['idle', 'attack']).
// opts.ground (0..1): taper + dither ground mist that reaches the image edges (e.g. 0.35 for DEATH).
export async function bakeEnemy(id, base = '/assets/enemies/src/', poses = ALL_POSES, opts = {}) {
  const cut = {};
  for (const p of poses) {
    try { cut[p] = cutBackground(await loadSource(base, id, p)); } catch { if (p === 'idle') throw new Error(`${id}: idle source missing`); }
    if (cut[p] && opts.ground) fadeGround(cut[p], opts.ground);
  }
  const POSES = Object.keys(cut);
  const boxes = Object.fromEntries(POSES.map((p) => [p, bbox(cut[p])]));
  const sameFrame = POSES.every((p) => cut[p].width === cut.idle.width && cut[p].height === cut.idle.height);
  if (!sameFrame) return bakeSeparate(cut, boxes);
  const body = boxes.idle;
  const cx = (body.x0 + body.x1) / 2;
  const top = Math.min(...POSES.map((p) => boxes[p].y0)), bottom = Math.max(...POSES.map((p) => boxes[p].y1));
  const half = Math.max(...POSES.map((p) => Math.max(cx - boxes[p].x0, boxes[p].x1 - cx))) + 2;
  const k = BAKE.bodyH / (body.y1 - body.y0 + 1);
  const rect = { x: Math.round(cx - half), y: top, w: Math.round(half * 2), h: bottom - top + 1 };
  const W = Math.round(rect.w * k), H = Math.round(rect.h * k);
  const out = {};
  const ditherFromY = opts.ground ? Math.round((cut.idle.height * (1 - opts.ground) - rect.y) * k) : Infinity;
  for (const p of POSES) out[p] = downscale(cut[p], rect.x, rect.y, rect.w, rect.h, W, H, ditherFromY).toDataURL('image/png');
  return { frames: out, size: [W, H], bodyH: BAKE.bodyH, bodyTop: Math.round((body.y0 - top) * k) };
}
