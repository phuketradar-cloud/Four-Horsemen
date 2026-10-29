import { ENEMY_ART, ENEMY_ART_BASE } from '../data/enemyArt.js';

// Replaces procedural enemy sprite sets with painted frames once they load (data: data/enemyArt.js).
// The set keeps the renderer's shape { idle[2], walk[2], windup, attack, hurt } and adds:
//   artScale   - billboard height multiplier so the painted BODY is as tall in the world as the old
//                sprite's body (the painted frame has room for a raised sword / splashes)
//   combatMult - combat-scene size multiplier, same idea for the close-up encounter view
// If a file is missing or fails to decode, that enemy keeps its drawn sprite - nothing else changes.
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function toCanvas(img, dy = 0) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, dy);
  return c;
}

// height of the opaque figure (rows that contain a solid pixel)
function bodyHeight(img) {
  const c = toCanvas(img), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < c.height; y++) {
    let any = false;
    for (let x = 0; x < c.width && !any; x++) if (d[(y * c.width + x) * 4 + 3] > 128) any = true;
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  return top < 0 ? c.height : bottom - top + 1;
}

export async function loadEnemyArt(sprites, art = ENEMY_ART, base = ENEMY_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(Object.entries(art).map(async ([key, def]) => {
    try {
      const old = sprites[key];
      const f = {};
      for (const p of def.poses) f[p] = await load(`${base}${key}/${p}.png`);
      if (!f.idle) throw new Error('idle frame missing');
      const idle = toCanvas(f.idle);
      const pose = (p) => (f[p] ? toCanvas(f[p]) : idle);
      const newBody = bodyHeight(f.idle);
      const oldIdle = old?.idle?.[0];
      const oldBody = oldIdle ? bodyHeight(oldIdle) : newBody;
      const oldFrame = oldIdle ? oldIdle.height : idle.height;
      sprites[key] = {
        idle: [idle, toCanvas(f.idle, 1)],                       // 1px breathing bob
        walk: [toCanvas(f.walk || f.idle, -2), toCanvas(f.walk || f.idle, 1)], // step bounce
        windup: pose('windup'), attack: pose('attack'), hurt: pose('hurt'),
        artScale: (oldBody / oldFrame) * (idle.height / newBody) * (def.size || 1),
        combatMult: (oldBody / newBody) * (def.size || 1),
        painted: true,
      };
      done.push(key);
    } catch { console.warn(`[enemy art] ${key}: art not found - keeping the drawn sprite`); }
  }));
  return done;
}
