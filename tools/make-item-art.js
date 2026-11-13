// Bakes painted item icons / objects out of one sheet with many items (run in the browser on the dev server):
//   const m = await import('/tools/make-item-art.js');
//   const s = await m.findItems('items_weapons');          // shapes + a numbered preview to look at
//   const out = await m.bakeItems('items_weapons', { sword: 0, axe: 3 });   // shape index -> item key
// Source: assets/items/src/<sheet>.(webp|png|jpg) on a chroma-key green backdrop, any layout - items are
// found as shapes (sparkles and glows next to an item join it), so the sheet does not need a strict grid.
// Each item is cropped, fitted into a SIZE x SIZE square (centred) and returned as a PNG data URL for
// assets/items/<key>.png; the game scales it down to the icon / object size when it loads.
import { cutBackground } from './make-enemy-art.js';

// output square size: 64 for icons; world objects (chests, fonts, shrines...) are baked at 256 so they stay
// sharp up close in the 2x view (bakeItems(name, map, base, D, 256))
const ICON_SIZE = 64;
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function loadSheet(name, base) {
  for (const ext of ['webp', 'png', 'jpg']) { try { return await load(`${base}${name}.${ext}`); } catch { /* next */ } }
  throw new Error(`${name}: no source`);
}

// coarse occupancy grid (S px cells), dilated by D cells, labelled with 8-connectivity; small shapes
// (sparks, loose glow) are merged into the nearest big shape
function shapes(c, S = 4, D = 2) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const gw = Math.ceil(W / S), gh = Math.ceil(H / S), grid = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) grid[((y / S) | 0) * gw + ((x / S) | 0)] = 1;
  const dil = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (grid[gy * gw + gx]) for (let oy = -D; oy <= D; oy++) for (let ox = -D; ox <= D; ox++) { const ny = gy + oy, nx = gx + ox; if (ny >= 0 && ny < gh && nx >= 0 && nx < gw) dil[ny * gw + nx] = 1; }
  const label = new Int32Array(gw * gh).fill(-1), list = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!grid[s] || label[s] >= 0) continue;
    const L = list.length, q = [s]; label[s] = L; let n = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (q.length) {
      const k = q.pop(), gx = k % gw, gy = (k / gw) | 0;
      if (grid[k]) { n++; sx += gx; sy += gy; if (gx < x0) x0 = gx; if (gx > x1) x1 = gx; if (gy < y0) y0 = gy; if (gy > y1) y1 = gy; }
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const ny = gy + oy, nx = gx + ox; if (ny < 0 || ny >= gh || nx < 0 || nx >= gw) continue; const nk = ny * gw + nx; if (dil[nk] && label[nk] < 0) { label[nk] = L; q.push(nk); } }
    }
    list.push({ n, cx: sx / n * S, cy: sy / n * S, x0: x0 * S, y0: y0 * S, x1: (x1 + 1) * S, y1: (y1 + 1) * S });
  }
  const big = Math.max(...list.map((s) => s.n));
  const keep = list.map((s, i) => (s.n >= big * 0.04 ? i : -1)).filter((i) => i >= 0);
  const owner = list.map((s, i) => {
    if (keep.includes(i)) return i;
    let best = -1, bd = 1e9;
    for (const k of keep) { const t = list[k], dd = Math.hypot(t.cx - s.cx, t.cy - s.cy); if (dd < bd) { bd = dd; best = k; } }
    return bd < 90 ? best : -1;
  });
  for (let i = 0; i < list.length; i++) if (owner[i] >= 0 && owner[i] !== i) { const t = list[owner[i]], s = list[i]; t.x0 = Math.min(t.x0, s.x0); t.y0 = Math.min(t.y0, s.y0); t.x1 = Math.max(t.x1, s.x1); t.y1 = Math.max(t.y1, s.y1); }
  // order big shapes top-to-bottom in rows, then left-to-right
  const items = keep.map((i) => ({ ...list[i], id: i }));
  items.sort((a, b) => (Math.abs(a.cy - b.cy) < 60 ? a.cx - b.cx : a.cy - b.cy));
  return { items, label, owner, gw, S, W, H };
}

export async function findItems(name, base = '/assets/items/src/', D = 2) {
  const cut = cutBackground(await loadSheet(name, base));
  const { items } = shapes(cut, 4, D);
  // numbered preview on grey, half size
  const k = 0.5, p = document.createElement('canvas'); p.width = cut.width * k; p.height = cut.height * k;
  const x = p.getContext('2d'); x.fillStyle = '#505060'; x.fillRect(0, 0, p.width, p.height); x.drawImage(cut, 0, 0, p.width, p.height);
  x.font = 'bold 22px sans-serif'; x.lineWidth = 4;
  items.forEach((it, i) => { x.strokeStyle = '#ffe040'; x.lineWidth = 1; x.strokeRect(it.x0 * k, it.y0 * k, (it.x1 - it.x0) * k, (it.y1 - it.y0) * k); x.lineWidth = 4; x.strokeStyle = '#000'; x.strokeText(String(i), it.x0 * k + 2, it.y0 * k + 20); x.fillStyle = '#fff'; x.fillText(String(i), it.x0 * k + 2, it.y0 * k + 20); });
  return { count: items.length, preview: p.toDataURL('image/jpeg', 0.8) };
}

// map: { itemKey: shapeIndex (as numbered by findItems) }
// D: how far (in 4px cells) shapes reach to join - lower it when two items are drawn touching
export async function bakeItems(name, map, base = '/assets/items/src/', D = 2, SIZE = ICON_SIZE) {
  const cut = cutBackground(await loadSheet(name, base));
  const { items, label, owner, gw, S, W, H } = shapes(cut, 4, D);
  const src = cut.getContext('2d').getImageData(0, 0, W, H).data;
  const out = {};
  for (const [key, idx] of Object.entries(map)) {
    const it = items[idx];
    if (!it) { out[key] = null; continue; }
    // only this item's pixels (other items overlapping its box are left out)
    const bw = it.x1 - it.x0, bh = it.y1 - it.y0, c = document.createElement('canvas'); c.width = bw; c.height = bh;
    const cx = c.getContext('2d'), id = cx.createImageData(bw, bh);
    for (let y = it.y0; y < it.y1 && y < H; y++) for (let x = it.x0; x < it.x1 && x < W; x++) {
      const l = label[((y / S) | 0) * gw + ((x / S) | 0)];
      if (l < 0 || (owner[l] !== it.id && l !== it.id)) continue;
      const i = (y * W + x) * 4, o = ((y - it.y0) * bw + (x - it.x0)) * 4;
      id.data[o] = src[i]; id.data[o + 1] = src[i + 1]; id.data[o + 2] = src[i + 2]; id.data[o + 3] = src[i + 3];
    }
    cx.putImageData(id, 0, 0);
    // fit into SIZE x SIZE, centred, high-quality halving steps
    let cur = c;
    const s = Math.min((SIZE - 2) / bw, (SIZE - 2) / bh);
    while (cur.width / 2 >= bw * s && cur.height / 2 >= bh * s) { const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2); const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, n.width, n.height); cur = n; }
    const f = document.createElement('canvas'); f.width = SIZE; f.height = SIZE;
    const fx = f.getContext('2d'); fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high';
    const w = Math.max(1, Math.round(bw * s)), h = Math.max(1, Math.round(bh * s));
    fx.drawImage(cur, Math.round((SIZE - w) / 2), Math.round((SIZE - h) / 2), w, h);
    out[key] = f.toDataURL('image/png');
  }
  return out;
}
