// Cuts the painted skill / passive / UI icon sheets (assets/skills/src/*.jpg, 1376x768) into
// 96x96 PNGs for assets/skills/<key>.png. Crop squares are [x, y, size] in source pixels, chosen
// inside each tile's painted rim (labels and frames drawn by the generator are left out).
// Browser console on the dev server:
//   const m = await import('/tools/make-skill-icons.js'); document.body.append(await m.preview());
//   const out = await m.bakeAll();   // { key: dataURL }
import { keyGreen } from '../src/render/ChromaKey.js';

export const SKILL_ICON_CROPS = {
  skills_conquest: {
    piercing_judgment: [36, 30, 304], mark_of_crown: [528, 30, 304], phantom_volley: [1038, 30, 304],
    royal_decree: [34, 433, 304], world_conqueror: [532, 433, 304], unbroken_will: [1040, 433, 304],
  },
  skills_war: {
    cleave: [70, 114, 244], armor_breaker: [400, 114, 244], blood_rush: [732, 114, 244],
    earthshaker: [70, 448, 244], red_apocalypse: [400, 450, 244], blood_and_iron: [1063, 448, 244],
  },
  skills_famine: {
    withering_touch: [66, 28, 278], harvest_of_weakness: [550, 28, 278], black_plague: [1038, 28, 278],
    starvation_field: [66, 412, 278], last_harvest: [552, 408, 278], nothing_is_wasted: [1038, 412, 278],
  },
  skills_death: {
    soul_rend: [143, 101, 220], grave_mark: [579, 101, 220], wraith_step: [1022, 101, 220],
    deaths_embrace: [143, 437, 220], final_silence: [578, 430, 228], reapers_due: [1022, 437, 220],
  },
  // transparent symbols: green is keyed out
  ui_icons: {
    skull_lit: [90, 50, 280], skull_dim: [550, 50, 280], res_dominion: [1005, 50, 280],
    res_fury: [85, 405, 280], res_plague: [550, 405, 280], res_souls: [1005, 405, 280],
  },
};
export const KEYED = new Set(['ui_icons']);
export const OUT = 96;

async function load(name) { const img = new Image(); img.src = `/assets/skills/src/${name}.jpg?v=${Date.now()}`; await img.decode(); return img; }

export async function bake(name) {
  const img = await load(name), out = {};
  for (const [key, [x, y, s]] of Object.entries(SKILL_ICON_CROPS[name])) {
    // crop at full size first (keying works best before downscaling), then halve down to 96
    let c = document.createElement('canvas'); c.width = c.height = s;
    const cx = c.getContext('2d'); cx.drawImage(img, x, y, s, s, 0, 0, s, s);
    if (KEYED.has(name)) { const d = cx.getImageData(0, 0, s, s); keyGreen(d.data); cx.putImageData(d, 0, 0); }
    while (c.width / 2 >= OUT) { const n = document.createElement('canvas'); n.width = n.height = Math.round(c.width / 2); const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(c, 0, 0, n.width, n.height); c = n; }
    const o = document.createElement('canvas'); o.width = o.height = OUT; const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, OUT, OUT);
    out[key] = o;
  }
  return out;
}

export async function bakeAll() {
  const res = {};
  for (const name of Object.keys(SKILL_ICON_CROPS)) for (const [k, c] of Object.entries(await bake(name))) res[k] = c.toDataURL('image/png');
  return res;
}

// Contact sheet: every source with its crop squares outlined, plus the baked icons.
export async function preview(scale = 0.4) {
  const names = Object.keys(SKILL_ICON_CROPS);
  const W = Math.round(1376 * scale), H = Math.round(768 * scale);
  const c = document.createElement('canvas'); c.width = W * 2 + 120; c.height = H * 3;
  const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < names.length; i++) {
    const img = await load(names[i]), ox = (i % 2) * W, oy = Math.floor(i / 2) * H;
    x.drawImage(img, ox, oy, W, H);
    x.strokeStyle = '#ff00ff'; x.lineWidth = 2;
    for (const [cx, cy, s] of Object.values(SKILL_ICON_CROPS[names[i]])) x.strokeRect(ox + cx * scale, oy + cy * scale, s * scale, s * scale);
  }
  let k = 0;
  for (const n of names) for (const cv of Object.values(await bake(n))) { x.drawImage(cv, W * 2 + 8 + (k % 2) * 52, 4 + Math.floor(k / 2) * 52, 48, 48); k++; }
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:100vw;height:auto;background:#333';
  return c;
}
