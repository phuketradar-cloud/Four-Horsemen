import { SCENE_ART, SCENE_ART_BASE, SCENE_TEX_SIZE } from '../data/sceneArt.js';

// Loads the painted scenery (data/sceneArt.js) into small square canvases, keyed by dungeon theme id:
// sceneArtFor('ashen') -> { wall, door, floor, ceiling } (only the parts that loaded). Until they load,
// or if a file fails, the drawn textures are used. DungeonRenderer rebuilds its themes once loaded.
const loaded = {};
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// high-quality downscale in halving steps (one big step looks grainy)
function fit(img, size) {
  let cur = document.createElement('canvas'); cur.width = img.width; cur.height = img.height;
  cur.getContext('2d').drawImage(img, 0, 0);
  while (cur.width / 2 >= size) {
    const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  const out = document.createElement('canvas'); out.width = size; out.height = size;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, size, size);
  return out;
}

export function sceneArtFor(themeId) { return loaded[themeId || 'crypt'] || null; }

export async function loadSceneArt(art = SCENE_ART, base = SCENE_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(Object.entries(art).map(async ([id, def]) => {
    const parts = {};
    await Promise.all(['wall', 'door', 'floor', 'ceiling'].map(async (k) => {
      if (!def[k]) return;
      try { parts[k] = fit(await load(base + def[k]), SCENE_TEX_SIZE); } catch { console.warn(`[scene art] ${def[k]}: not found - keeping the drawn ${k}`); }
    }));
    if (!Object.keys(parts).length) return;
    parts.tint = def.tint !== false;
    for (const th of def.themes || [id]) loaded[th] = parts;
    done.push(id);
  }));
  return done;
}
