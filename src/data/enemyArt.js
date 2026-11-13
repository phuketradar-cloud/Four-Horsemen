// Painted enemy art. Each entry replaces the procedural sprite set of that sprite key
// (see `sprite:` in enemies.js / bosses.js) with the frames in assets/enemies/<key>/<pose>.png.
// Frames are baked from the source paintings in assets/enemies/src/ by tools/make-enemy-art.js
// (background removed, one shared crop so the body size and the feet line match in every pose).
//   poses: the files that exist. Missing poses fall back: walk <- idle, windup/attack <- idle,
//          hurt <- idle. A sprite key that is not listed keeps its drawn pixel art.
//   size:  optional multiplier on the on-screen size (1 = same body height as the old sprite).
export const ENEMY_ART_BASE = 'assets/enemies/';

export const ENEMY_ART = {
  skeleton: { poses: ['idle', 'windup', 'attack', 'hurt'] }, // Hollow Skeleton (+ summoned skeletons)
  abyssbeast: { poses: ['idle', 'windup', 'attack', 'hurt'], size: 1.5 },
  captain: { poses: ['idle', 'windup', 'attack', 'hurt'] }, // Fallen Knight Captain (crypt boss variant) // Abyssal Beast (The Abyssal Gate)
  abaddon: { poses: ['idle', 'windup', 'attack'] },
  knight: { poses: ['idle', 'windup', 'attack', 'hurt'] }, // Fallen Knight (Ashen Catacombs elite) - made in Google Flow
  // baked from one 2x2 pose sheet each (assets/enemies/src/<key>_sheet.jpg, tools/make-enemy-art.js bakeSheet)
  ...Object.fromEntries([
    'gravekeeper', 'cerberus',                                    // minibosses
    'crawler', 'warden',                                          // Ashen Catacombs
    'legionnaire', 'hound', 'executioner', 'cultist', 'tyrant',   // Red Warfront
    'thrall', 'stalker', 'harvester', 'harvesterBoss',            // Black Harvest
    'revenant', 'soulbound', 'lich', 'sentinel', 'executor',      // Pale Threshold
    'gorgon', 'nephilim', 'chimera', 'locust', 'beast',           // Abyssal Gate
    'seraph', 'prophet', 'dragon',                                // Last Revelation
  ].map((k) => [k, { poses: ['idle', 'windup', 'attack', 'hurt'] }])), // Abaddon, the Destroyer (final boss) - no hurt painting: hurt uses idle
};
