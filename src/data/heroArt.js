// Painted Horseman back views (companions walking ahead + the player in the combat close-up).
// Each entry replaces the drawn back sprite of that Horseman while holding `weapon`, with the frames
// in assets/heroes/<id>/<pose>.png (idle = standing, attack = swinging). Other weapons keep the
// pixel art. Frames are baked from assets/heroes/src/<id>_<pose>.(webp|png|jpg) by
// tools/make-enemy-art.js: bakeEnemy('<id>', '/assets/heroes/src/', ['idle', 'attack']) (DEATH: { ground: 0.4 }).
//   size: optional multiplier on the on-screen size (1 = same body height as the pixel art).
export const HERO_ART_BASE = 'assets/heroes/';

export const HERO_ART = {
  war: { weapon: 'sword', poses: ['idle', 'attack'] },
  conquest: { weapon: 'crossbow', poses: ['idle', 'attack'] },
  famine: { weapon: 'dagger', poses: ['idle', 'attack'] },
  death: { weapon: 'axe', poses: ['idle', 'attack'] },
};
