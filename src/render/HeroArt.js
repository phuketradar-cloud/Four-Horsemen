import { HERO_ART, HERO_ART_BASE } from '../data/heroArt.js';

// Replaces drawn Horseman back sprites (sprites.player[id][weapon] = [idle, swing]) with painted
// frames once they load (data: data/heroArt.js). Each frame canvas carries:
//   artScale   - billboard height multiplier so the painted BODY is as tall as the pixel-art body
//   combatMult - size multiplier for the combat close-up back view (drawn at 2.4x the pixel art)
// If a file is missing or fails to decode, that Horseman keeps the pixel art.
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

function bodyHeight(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < c.height; y++) {
    let any = false;
    for (let x = 0; x < c.width && !any; x++) if (d[(y * c.width + x) * 4 + 3] > 128) any = true;
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  return top < 0 ? c.height : bottom - top + 1;
}

export async function loadHeroArt(sprites, art = HERO_ART, base = HERO_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(Object.entries(art).map(async ([id, def]) => {
    try {
      const f = {};
      for (const p of def.poses) f[p] = toCanvas(await load(`${base}${id}/${p}.png`));
      if (!f.idle) throw new Error('idle frame missing');
      const set = sprites.player?.[id];
      const old = set?.[def.weapon]?.[0];
      const newBody = bodyHeight(f.idle), oldBody = old ? bodyHeight(old) : newBody, oldFrame = old ? old.height : f.idle.height;
      const artScale = (oldBody / oldFrame) * (f.idle.height / newBody) * (def.size || 1);
      const combatMult = (oldBody / newBody) * (def.size || 1);
      const frames = [f.idle, f.attack || f.idle];
      for (const c of frames) { c.artScale = artScale; c.combatMult = combatMult; c.painted = true; }
      sprites.player[id] = { ...set, [def.weapon]: frames };
      done.push(id);
    } catch { console.warn(`[hero art] ${id}: art not found - keeping the pixel art`); }
  }));
  return done;
}
