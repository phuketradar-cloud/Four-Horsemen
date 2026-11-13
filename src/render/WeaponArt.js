import { WEAPON_ART, WEAPON_ART_BASE } from '../data/weaponArt.js';
import { keyGreen } from './ChromaKey.js';
import { RENDER_SCALE } from '../data/config.js';

// Replaces drawn first-person weapons (sprites.fp) with painted ones once they load
// (data: data/weaponArt.js). The green backdrop is keyed out, the painting is cropped to the weapon
// and scaled to its on-screen size. Each canvas carries what DungeonRenderer.renderWeapon needs:
//   drawScale (1 - already at screen size), pivX / pivY (the gripping fist), lift, painted
// If a file is missing or fails to decode, that weapon keeps its pixel art.
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function bbox(d, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

// high-quality downscale in halving steps, then crisp alpha (pixel-art sprites have hard edges)
function shrink(src, sx, sy, sw, sh, w, h) {
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
  const id = x.getImageData(0, 0, w, h);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] < 110 ? 0 : 255;
  x.putImageData(id, 0, 0);
  return out;
}

// Where the arm leaves the picture: opaque pixels on the bottom / right border (centre E, width w).
// A disc of the forearm just inside the edge is stamped again and again along the fist -> E direction,
// on a canvas padded by `pad` on every side, giving a sleeve that runs on past the old cut.
function extendArm(src, d, px, py) {
  const W = src.width, H = src.height, edge = [];
  for (let x = 0; x < W; x++) for (let y = H - 3; y < H; y++) if (d[(y * W + x) * 4 + 3] > 128) edge.push([x, y]);
  for (let y = 0; y < H; y++) for (let x = W - 3; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) edge.push([x, y]);
  if (edge.length < 20) return null;
  const ex = edge.reduce((s, p) => s + p[0], 0) / edge.length, ey = edge.reduce((s, p) => s + p[1], 0) / edge.length;
  let dx = ex - px, dy = ey - py; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  // arm thickness at the cut: the span of the cut along the bottom edge or the right edge
  const bot = edge.filter((p) => p[1] >= H - 3), rgt = edge.filter((p) => p[0] >= W - 3);
  const span = (a, i) => (a.length ? Math.max(...a.map((p) => p[i])) - Math.min(...a.map((p) => p[i])) : 0);
  const w = Math.min(Math.max(span(bot, 0) * Math.abs(dy), span(rgt, 1) * Math.abs(dx), 20), W * 0.3);
  if (dx < 0 || dy < 0) return null; // the paintings hold the weapon in the right hand: arm leaves bottom-right
  const r = w * 0.45, back = r * 1.3, run = Math.round(Math.max(W, H) * 1.6);
  // grow the canvas only to the right and down (where the arm goes); `pad` = 0 keeps the pivot where it was
  const pad = 0, out = document.createElement('canvas'); out.width = W + Math.ceil(run * dx); out.height = H + Math.ceil(run * dy);
  const o = out.getContext('2d');
  const cx = ex - dx * back, cy = ey - dy * back;   // patch centre, inside the forearm
  const patch = document.createElement('canvas'); patch.width = patch.height = Math.ceil(r * 2);
  const pc = patch.getContext('2d'); pc.beginPath(); pc.arc(r, r, r, 0, Math.PI * 2); pc.clip();
  pc.drawImage(src, cx - r, cy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
  for (let t = back; t < run; t += Math.max(1, r * 0.25)) o.drawImage(patch, pad + cx + dx * t - r, pad + cy + dy * t - r);
  o.drawImage(src, pad, pad);
  return { canvas: out, pad };
}

export async function loadWeaponArt(sprites, art = WEAPON_ART, base = WEAPON_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(Object.entries(art).map(async ([key, def]) => {
    try {
      const img = await load(base + def.file);
      const k0 = document.createElement('canvas'); k0.width = img.width; k0.height = img.height;
      const kx = k0.getContext('2d'); kx.drawImage(img, 0, 0);
      const kd = kx.getImageData(0, 0, k0.width, k0.height);
      keyGreen(kd.data); kx.putImageData(kd, 0, 0);
      let px = (def.pivot?.[0] ?? 0.5) * img.width, py = (def.pivot?.[1] ?? 0.8) * img.height;
      // melee: the painted forearm is cut by the image edge - continue it past the edge so it never
      // ends in mid-air on screen (the cut end would show above the bottom when the hand tilts)
      let c = k0;
      if (def.pivot && def.extendArm !== false) { const ext = extendArm(k0, kd.data, px, py); if (ext) { c = ext.canvas; px += ext.pad; py += ext.pad; } }
      const id = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      const b = bbox(id.data, c.width, c.height);
      if (b.x1 < 0) throw new Error('empty');
      // baked at RENDER_SCALE x the on-screen size, drawn back at 1 / RENDER_SCALE (sharp in the 2x view)
      const k = (def.width ? def.width / (b.x1 - b.x0 + 1) : def.reach / Math.max(1, py - b.y0)) * RENDER_SCALE;
      const w = Math.max(1, Math.round((b.x1 - b.x0 + 1) * k)), h = Math.max(1, Math.round((b.y1 - b.y0 + 1) * k));
      const out = shrink(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, w, h);
      out.drawScale = 1 / RENDER_SCALE; out.pivX = (px - b.x0) * k; out.pivY = (py - b.y0) * k; out.lift = def.lift || 0; out.painted = true;
      sprites.fp[key] = out;
      done.push(key);
    } catch { console.warn(`[weapon art] ${def.file}: not found - keeping the pixel-art ${key}`); }
  }));
  return done;
}
