import { sealed } from './SpriteFactory.js';

// Painted Horseman portraits (replace the procedural ones when the files load).
// Files: assets/portraits/<conquest|war|famine|death>.webp, 352x416 (8x the 44x52 HUD portrait),
// cropped from the source paintings by tools/make-portraits.js. To change a portrait, replace the
// file (any size works; it is fitted to the 44x52 shape, centred). If a file is missing or fails
// to decode, that Horseman keeps its procedural portrait - nothing else is affected.
// Produces, per Horseman: portraits[id] (44x52, HUD / camp / equipment), portraits[id + 'Sealed']
// (formation panel) and portraits.hi[id] (88x104, Horseman select screen).
export const PORTRAIT_IDS = ['conquest', 'war', 'famine', 'death'];
const W = 44, H = 52;

function fit(img, w, h) {
  // high-quality downscale in halving steps (single large steps look grainy)
  let src = img, sw = img.width, sh = img.height;
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale, ch = h / scale, cx = (sw - cw) / 2, cy = (sh - ch) / 2; // cover crop, centred
  let cur = document.createElement('canvas'); cur.width = Math.round(cw); cur.height = Math.round(ch);
  cur.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, cur.width, cur.height);
  while (cur.width / 2 >= w) {
    const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, w, h);
  // 1px dark rim so the painting sits inside the stone portrait well like the old pixel art
  x.strokeStyle = 'rgba(0,0,0,0.65)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);
  return out;
}

function load(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}

// Returns the ids that were replaced (others keep their procedural portrait).
export async function loadPortraitArt(sprites, base = 'assets/portraits/') {
  if (typeof document === 'undefined') return [];
  const P = sprites.portraits;
  P.hi = P.hi || {};
  const done = [];
  await Promise.all(PORTRAIT_IDS.map(async (id) => {
    try {
      const img = await load(`${base}${id}.webp`);
      const small = fit(img, W, H);
      P[id] = small;
      P[id + 'Sealed'] = sealed(small);
      P.hi[id] = fit(img, W * 2, H * 2);
      done.push(id);
    } catch { console.warn(`[portraits] ${id}: art not found - keeping the drawn portrait`); }
  }));
  return done;
}
