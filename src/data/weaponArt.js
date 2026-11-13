// Painted first-person weapons (the weapon in the player's hand). Each entry replaces one drawn
// sprite in sprites.fp (every weapon maps to one of these through `fp:` in data/weapons.js:
// greatsword -> sword, hammer/scythe -> axe, spear -> dagger, bow -> crossbow).
// Source: assets/weapons/<file>, a painting on a chroma-key green backdrop (keyed out when it loads).
//   pivot: [x, y] of the gripping fist in the source, as fractions of its width / height - melee
//          weapons swing around this point, and it sits where the old sprite's hand was
//   reach: on-screen pixels from the fist to the tip (melee)      width: on-screen width (crossbow)
//   lift:  raises the weapon so the gauntlet shows above the bottom edge (the pixel art kept its hand below)
// A weapon that is not listed, or whose file fails to load, keeps its pixel art.
export const WEAPON_ART_BASE = 'assets/weapons/';

export const WEAPON_ART = {
  sword: { file: 'fp_sword.jpg', pivot: [0.49, 0.77], reach: 260, lift: 80 },
  axe: { file: 'fp_axe.jpg', pivot: [0.48, 0.76], reach: 260, lift: 80 },
  dagger: { file: 'fp_dagger.jpg', pivot: [0.5, 0.77], reach: 180, lift: 75 },
  crossbow: { file: 'fp_crossbow.jpg', width: 320 },
  crossbowEmpty: { file: 'fp_crossbow_empty.jpg', width: 320 },
  // fists: { file: 'fp_fists.jpg', pivot: [0.5, 0.75], reach: 60 },
};
