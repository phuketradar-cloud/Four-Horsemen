import { SKILLS } from '../data/skills.js';
import { HORSEMEN } from '../data/characters.js';

// Painted skill / passive / UI icons (assets/skills/<key>.png, 96x96, cut by tools/make-skill-icons.js).
// Keys: every skill id in data/skills.js, every Horseman passive id (data/characters.js) and the
// UI symbols below. Results (a missing file keeps the drawn pixel icon - nothing else changes):
//   sprites.skillIcons[id]    24x24  skill bar, SKILLS panel (same size as the pixel icons)
//   sprites.skillIconsHi[id]  32x32  Horseman select screen
//   sprites.passiveIcons[id]  32x32  Horseman select screen
//   sprites.uiIcons[key]      16x16 (+ uiIcons.hi[key] 32x32)  difficulty skulls, resource emblems
export const UI_ICON_KEYS = ['skull_lit', 'skull_dim', 'res_dominion', 'res_fury', 'res_plague', 'res_souls'];

function load(src) {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

function fit(img, size) {
  let cur = img, w = img.width;
  while (w / 2 >= size) {
    const n = document.createElement('canvas'); n.width = n.height = Math.round(w / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, n.width, n.height); cur = n; w = n.width;
  }
  const out = document.createElement('canvas'); out.width = out.height = size;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, size, size);
  out.painted = true;
  return out;
}

export async function loadSkillArt(sprites, base = 'assets/skills/') {
  if (typeof document === 'undefined') return [];
  sprites.skillIconsHi = sprites.skillIconsHi || {};
  sprites.passiveIcons = sprites.passiveIcons || {};
  sprites.uiIcons = sprites.uiIcons || { hi: {} };
  const jobs = [
    ...Object.keys(SKILLS).map((id) => [id, (img) => { sprites.skillIcons[id] = fit(img, 24); sprites.skillIconsHi[id] = fit(img, 32); }]),
    ...Object.values(HORSEMEN).map((h) => [h.passive.id, (img) => { sprites.passiveIcons[h.passive.id] = fit(img, 32); }]),
    ...UI_ICON_KEYS.map((k) => [k, (img) => { sprites.uiIcons[k] = fit(img, 16); sprites.uiIcons.hi[k] = fit(img, 32); }]),
  ];
  const done = [];
  await Promise.all(jobs.map(async ([key, apply]) => {
    try { apply(await load(`${base}${key}.png`)); done.push(key); } catch { /* keep the drawn icon */ }
  }));
  return done;
}
