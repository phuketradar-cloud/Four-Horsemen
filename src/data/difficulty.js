// DifficultyManager data. Difficulty is more than bigger numbers: higher tiers add elite champions
// with modifiers, larger encounter groups, extra boss attacks and harsher traps. Reward changes are
// bounded (luckBonus stays under LUCK_RULES.maxBonus and never touches Mythic).
//   levelAdd      enemy level offset (drives stats + item level of drops)
//   hpMult/dmgMult  enemy multipliers on top of level scaling
//   eliteChance   chance an ordinary spawn is upgraded to a champion (see CHAMPION_MODS)
//   extraEnemies  added per combat room
//   bossExtra     boss gains the attacks listed under its def.difficultyAttacks[tier]
//   trapMult      hazard damage multiplier
//   materialMult  material quantity multiplier (rounded per drop)
//   goldMult, xpMult reward multipliers;  luckBonus bounded rarity shift for equipment rolls
export const DIFFICULTIES = {
  normal: { id: 'normal', name: 'NORMAL', color: '#c8b890', levelAdd: 0, hpMult: 1, dmgMult: 1, eliteChance: 0, extraEnemies: 0, bossExtra: false, trapMult: 1, materialMult: 1, goldMult: 1, xpMult: 1, luckBonus: 0, desc: 'The dungeon as its dead intended.' },
  veteran: { id: 'veteran', name: 'VETERAN', color: '#f0a020', levelAdd: 3, hpMult: 1.2, dmgMult: 1.15, eliteChance: 0.18, extraEnemies: 1, bossExtra: true, trapMult: 1.4, materialMult: 1.35, goldMult: 1.3, xpMult: 1.25, luckBonus: 0.08, desc: 'Champions walk among the dead. Bosses learn new attacks.' },
  nightmare: { id: 'nightmare', name: 'NIGHTMARE', color: '#ff4040', levelAdd: 6, hpMult: 1.45, dmgMult: 1.3, eliteChance: 0.32, extraEnemies: 2, bossExtra: true, trapMult: 1.8, materialMult: 1.75, goldMult: 1.6, xpMult: 1.5, luckBonus: 0.15, desc: 'Every hall is a war. Bosses use every trick. Mythic chances unlock.' },
};
export const DIFFICULTY_ORDER = ['normal', 'veteran', 'nightmare'];
export const difficultyRank = (id) => Math.max(0, DIFFICULTY_ORDER.indexOf(id));

// Champion modifiers rolled onto upgraded spawns (veteran+). Each changes behaviour, not just HP.
export const CHAMPION_MODS = {
  armored: { name: 'ARMORED', color: '#a0a8b0', defAdd: 6, hpMult: 1.3, desc: 'Thick plate: +6 DEF.' },
  frenzied: { name: 'FRENZIED', color: '#ff6040', speed: 0.7, windupMult: 0.75, desc: 'Moves and swings faster.' },
  vampiric: { name: 'VAMPIRIC', color: '#c02040', lifesteal: 0.3, desc: 'Heals 30% of the damage it deals.' },
  blighted: { name: 'BLIGHTED', color: '#80c030', inflict: { status: 'blighted', chance: 0.5, dur: 5 }, desc: 'Its blows apply Blight.' },
  // ---- Phase 5 variant modifiers (one per enemy, never stacked; minLevel keeps late variants late)
  cursed: { name: 'CURSED', color: '#a070e0', inflict: { status: 'cursed', chance: 0.4, dur: 5 }, minLevel: 10, desc: 'Its blows Curse you (-20% damage).' },
  spectral: { name: 'SPECTRAL', color: '#a8f0ff', resist: { basic: 0.25, skill: -0.15 }, evasionAdd: 8, minLevel: 20, desc: 'Half there: basic attacks do 25% less, skills 15% more.' },
  soulbound: { name: 'SOULBOUND', color: '#80c0ff', hpMult: 1.2, statusRules: { mark: 0.5, grave_mark: 0.5 }, minLevel: 25, desc: 'Marks and curses last half as long on it.' },
  ancient: { name: 'ANCIENT', color: '#d8c890', levelAdd: 3, hpMult: 1.3, xpMult: 1.5, minLevel: 15, bonusLoot: 'variant_ancient', desc: 'Older and tougher (+3 levels). Better rewards.' },
  abyssal: { name: 'ABYSSAL', color: '#c040ff', dmgMult: 1.15, darkAdd: 0.3, minLevel: 38, bonusLoot: 'variant_abyssal', desc: 'Touched by the Abyss: +15% damage, more of it dark. Drops abyssal ichor.' },
};

// Enemy level scaling (relative to the archetype's own level). Kept here so it is configurable.
export const ENEMY_SCALING = { hpPerLevel: 0.13, atkPerLevel: 0.11, defPerLevel: 0.3, xpPerLevel: 0.09 };

// Dungeon level warning thresholds (shown on the camp screen and before entering).
export const LEVEL_WARNING = { under: 3, danger: 8 };
