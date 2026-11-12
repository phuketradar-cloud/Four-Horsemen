import { WEAPON_ART, WEAPON_ART_BASE } from '../data/weaponArt.js';
import { keyGreen } from './ChromaKey.js';

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

export async function loadWeaponArt(sprites, art = WEAPON_ART, base = WEAPON_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(Object.entries(art).map(async ([key, def]) => {
    try {
      const img = await load(base + def.file);
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const id = x.getImageData(0, 0, c.width, c.height);
      keyGreen(id.data); x.putImageData(id, 0, 0);
      const b = bbox(id.data, c.width, c.height);
      if (b.x1 < 0) throw new Error('empty');
      const px = (def.pivot?.[0] ?? 0.5) * c.width, py = (def.pivot?.[1] ?? 0.8) * c.height;
      const k = def.width ? def.width / (b.x1 - b.x0 + 1) : def.reach / Math.max(1, py - b.y0);
      const w = Math.max(1, Math.round((b.x1 - b.x0 + 1) * k)), h = Math.max(1, Math.round((b.y1 - b.y0 + 1) * k));
      const out = shrink(c, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, w, h);
      out.drawScale = 1; out.pivX = (px - b.x0) * k; out.pivY = (py - b.y0) * k; out.lift = def.lift || 0; out.painted = true;
      sprites.fp[key] = out;
      done.push(key);
    } catch { console.warn(`[weapon art] ${def.file}: not found - keeping the pixel-art ${key}`); }
  }));
  return done;
}
