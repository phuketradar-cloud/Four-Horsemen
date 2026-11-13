import { NPCS } from '../data/campaign.js';

// Painted portraits for the sanctuary NPCs (Maren, Ansel, Ysolde, the Ferryman, the Seer).
// Files: assets/npcs/<portrait>.webp|png|jpg - any size; a head-and-shoulders painting works best.
// The picture is cover-cropped to NPC_FACE (biased toward the top, where the face is) and replaces
// sprites.npcPortraits[<portrait>]. A missing file keeps the drawn pixel portrait - nothing breaks.
export const NPC_FACE = { w: 76, h: 90 };
const EXTS = ['webp', 'png', 'jpg'];

function load(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}

export function fitFace(img, w = NPC_FACE.w, h = NPC_FACE.h, bias = 0.2) {
  const sw = img.width, sh = img.height, s = Math.max(w / sw, h / sh);
  const cw = w / s, ch = h / s, cx = (sw - cw) / 2, cy = (sh - ch) * bias;
  let cur = document.createElement('canvas'); cur.width = Math.round(cw); cur.height = Math.round(ch);
  cur.getContext('2d').drawImage(img, cx, cy, cw, ch, 0, 0, cur.width, cur.height);
  while (cur.width / 2 >= w) { // halving steps: a single big downscale looks grainy
    const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, w, h);
  x.strokeStyle = '#a0823e'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);
  out.painted = true;
  return out;
}

// Draws an NPC face into a w x h box: painted art fills it, the square pixel fallback is centred.
export function drawNpcFace(ctx, por, x, y, w, h, bg = '#1a140c') {
  if (!por) { ctx.fillStyle = '#2a2018'; ctx.fillRect(x, y, w, h); return; }
  if (por.painted) { ctx.drawImage(por, x, y, w, h); return; }
  const s = Math.min(w, h);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.drawImage(por, x + (w - s) / 2, y + (h - s) / 2, s, s);
}

export async function loadNpcArt(sprites, base = 'assets/npcs/') {
  if (typeof document === 'undefined' || !sprites.npcPortraits) return [];
  const done = [];
  await Promise.all(Object.values(NPCS).map(async ({ portrait: id }) => {
    for (const ext of EXTS) {
      try { const img = await load(`${base}${id}.${ext}`); sprites.npcPortraits[id] = fitFace(img); done.push(id); return; } catch { /* try the next extension */ }
    }
  }));
  return done;
}
