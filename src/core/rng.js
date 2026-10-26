// Random helpers. Kept in one place so a seeded RNG can be swapped in later.
export const rand = () => Math.random();
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
export const randRange = (min, max) => min + Math.random() * (max - min);
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// entries: [{ value, weight }]
export function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    if ((r -= e.weight) <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seeded PRNG (mulberry32) for reproducible item generation. Returns () => [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => (Math.random() * 4294967296) >>> 0;
export const rngInt = (rng, min, max) => Math.floor(min + rng() * (max - min + 1));
export function rngWeighted(rng, entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of entries) if ((r -= e.weight) < 0) return e.value;
  return entries[entries.length - 1].value;
}
export const lerp = (a, b, t) => a + (b - a) * t;
