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
};
