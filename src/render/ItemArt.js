import { ITEM_ART_BASE, ITEM_ICON_ART, ITEM_OBJECT_ART } from '../data/itemArt.js';

// Replaces drawn item icons, chests and dungeon objects with the painted ones once they load
// (data: data/itemArt.js). Each painting is fitted into the old sprite's canvas size - icons centred,
// world objects standing on the bottom edge - so every screen keeps its layout. Objects with a
// "used" twin (an emptied font, a spent shrine) get a darkened copy. A missing file keeps the pixel art.
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function fit(img, w, h, bottom) {
  let cur = img, cw = img.width, ch = img.height;
  const s = Math.min(w / cw, h / ch), tw = img.width * s;
  while (cw / 2 >= tw && cw / 2 >= 1) { // halving steps keep small icons clean
    const n = document.createElement('canvas'); n.width = Math.round(cw / 2); n.height = Math.round(ch / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n.width, n.height);
    cur = n; cw = n.width; ch = n.height;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  const dw = Math.max(1, Math.round(img.width * s)), dh = Math.max(1, Math.round(img.height * s));
  x.drawImage(cur, Math.round((w - dw) / 2), bottom ? h - dh : Math.round((h - dh) / 2), dw, dh);
  return out;
}

function dimmed(c) {
  const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
  const x = out.getContext('2d'); x.filter = 'brightness(0.5) saturate(0.4)'; x.drawImage(c, 0, 0);
  return out;
}

export async function loadItemArt(sprites, base = ITEM_ART_BASE) {
  if (typeof document === 'undefined') return [];
  const done = [];
  await Promise.all(ITEM_ICON_ART.map(async (k) => {
    try {
      const img = await load(`${base}${k}.png`);
      const old = sprites.icons[k];
      sprites.icons[k] = fit(img, old?.width || 16, old?.height || 16, false);
      // full-size copy for loot lying on the dungeon floor (drawn large in the 2x view)
      sprites.iconsHi = sprites.iconsHi || {};
      sprites.iconsHi[k] = fit(img, img.width, img.height, false);
      done.push(k);
    } catch { /* keep the pixel art */ }
  }));
  await Promise.all(ITEM_OBJECT_ART.map(async ([file, group, key, used]) => {
    try {
      const img = await load(`${base}${file}.png`);
      const old = sprites[group]?.[key];
      // same shape as the old sprite canvas, but up to ~256px so chests / fonts stay sharp up close
      // (the renderer sizes billboards by ratio, so a bigger canvas does not change the on-screen size)
      const ow = old?.width || 32, oh = old?.height || 32, res = Math.max(1, Math.floor(img.height / Math.max(ow, oh)));
      const c = fit(img, ow * res, oh * res, true);
      sprites[group][key] = c;
      if (used) sprites[group][used] = dimmed(c);
      done.push(file);
    } catch { /* keep the pixel art */ }
  }));
  return done;
}
