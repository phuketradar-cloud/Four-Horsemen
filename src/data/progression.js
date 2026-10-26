// XP curve + progression knobs. Per-class attribute growth lives in characters.js.
export const PROGRESSION = {
  maxLevel: 50,             // configurable level cap
  xpBase: 40,
  xpExponent: 1.25,
  healOnLevelUp: 0.5,       // fraction of max HP restored on level up
  resourceOnLevelUp: 0.25,  // fraction of class resource restored on level up
  skillPointsPerLevel: 1,   // granted on every level-up
  explorationXp: { room: 15, secret: 40, chest: 20 },
  objectiveXp: { eliteRoomCleared: 50, dungeonCleared: 150 },
  // Anti-farming: kills of foes more than `freeGap` levels below you are worth less.
  xpScaling: { freeGap: 2, perLevel: 0.15, min: 0.1, eliteBonus: 1.0, bossBonus: 1.0 },
  autosaveOnLevelUp: true,  // only when out of combat
};

// XP needed to go from `level` to `level + 1`.
export function xpToNext(level) {
  return Math.round(PROGRESSION.xpBase * Math.pow(level, PROGRESSION.xpExponent));
}

// Reward for a kill after level-difference scaling (never below `min` of the base value).
export function scaledXp(baseXp, enemyLevel, playerLevel) {
  const s = PROGRESSION.xpScaling;
  const gap = playerLevel - enemyLevel - s.freeGap;
  const mult = gap > 0 ? Math.max(s.min, 1 - s.perLevel * gap) : 1;
  return Math.max(1, Math.round(baseXp * mult));
}
