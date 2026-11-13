// Crops the sanctuary NPC paintings (assets/npcs/src/<id>.jpg, 1376x768) to a face close-up and
// returns canvases of 304x360 (4x the 76x90 in-game face) to save as assets/npcs/<id>.webp.
// Run in the browser console on the dev server:
//   const m = await import('/tools/make-npc-portraits.js'); const c = await m.bakeNpc('seer');
// Crop boxes are in source pixels; height follows from the 76:90 aspect.
export const NPC_CROPS = {
  maren: { x: 470, y: 50, w: 440 },
  ansel: { x: 470, y: 30, w: 440 },
  ysolde: { x: 470, y: 40, w: 440 },
  ferryman: { x: 470, y: 30, w: 440 },
  seer: { x: 470, y: 50, w: 440 },
};
export const OUT = { w: 304, h: 360 };

export async function bakeNpc(id, src = `/assets/npcs/src/${id}.jpg`, crops = NPC_CROPS) {
  const img = new Image(); img.src = src; await img.decode();
  const c = crops[id], h = Math.round((c.w * OUT.h) / OUT.w);
  const out = document.createElement('canvas'); out.width = OUT.w; out.height = OUT.h;
  const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(img, c.x, c.y, c.w, h, 0, 0, OUT.w, OUT.h);
  return out;
}
