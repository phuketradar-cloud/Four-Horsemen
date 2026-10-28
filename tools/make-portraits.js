// Portrait preparation tool. Runs in a browser (needs canvas):
//   import('/tools/make-portraits.js').then((m) => m.bakePortrait('war'))
// Crops each Horseman's painting (assets/portraits/src/<id>.webp) to the face / upper body at the
// in-game portrait shape (11:13, 44x52 in the HUD) and returns a 352x416 canvas (8x), which is saved
// as assets/portraits/<id>.webp. The game loads those at runtime (render/PortraitArt.js).
// crop = source pixels {x, y, w}; height follows the 11:13 shape.
export const PORTRAIT_CROPS = {
  conquest: { x: 250, y: 18, w: 540 },  // crowned head + halo (crown kept whole)
  war: { x: 300, y: 0, w: 560 },        // horned helm, glowing eyes, fur mantle
  famine: { x: 440, y: 60, w: 460 },    // stone mask under the hood (tighter: readable at 44x52)
  death: { x: 225, y: 140, w: 400 },    // hooded skull + scythe shaft (tighter: readable at 44x52)
};
export const OUT = { w: 352, h: 416 };

export async function bakePortrait(id, src = `/assets/portraits/src/${id}.webp`) {
  const img = new Image(); img.src = src; await img.decode();
  const c = PORTRAIT_CROPS[id], h = Math.round((c.w * OUT.h) / OUT.w);
  const out = document.createElement('canvas'); out.width = OUT.w; out.height = OUT.h;
  const x = out.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(img, c.x, c.y, c.w, Math.min(h, img.height - c.y), 0, 0, OUT.w, OUT.h * Math.min(1, (img.height - c.y) / h));
  return out;
}
