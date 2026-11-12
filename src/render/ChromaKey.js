// Chroma-key green backdrop removal, shared by tools/make-enemy-art.js and render/WeaponArt.js.
// Works on ImageData.data (RGBA bytes) in place.
export const greenness = (d, p) => d[p + 1] - Math.max(d[p], d[p + 2]);

// most border pixels are strongly green
export function isGreenScreen(d, W, H) {
  let g = 0, n = 0;
  for (let i = 0; i < W; i += 4) for (const y of [0, H - 1]) { n++; if (greenness(d, (y * W + i) * 4) > 60) g++; }
  for (let j = 0; j < H; j += 4) for (const x of [0, W - 1]) { n++; if (greenness(d, (j * W + x) * 4) > 60) g++; }
  return g > n * 0.6;
}

// clear green pixels (soft edge), then despill: no kept pixel stays greener than its red/blue
// (removes the green fringe a painted / JPEG edge picks up from the backdrop)
export function keyGreen(d) {
  for (let p = 0; p < d.length; p += 4) {
    const k = greenness(d, p);
    if (k > 70) { d[p + 3] = 0; continue; }
    if (k > 25) d[p + 3] = Math.round(d[p + 3] * (70 - k) / 45);
    const cap = Math.max(d[p], d[p + 2]);
    if (d[p + 1] > cap) d[p + 1] = cap;
  }
}
