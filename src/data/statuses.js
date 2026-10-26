// Status effect definitions + rank resistance rules. StatusEffectManager is generic over these.
// Multipliers combine multiplicatively; stacks are capped by maxStacks.
export const STATUSES = {
  // ---- enemy debuffs
  mark: { id: 'mark', name: 'MARKED', glyph: 'M', color: '#f0d070', maxStacks: 1, dmgTakenMult: 1.25, unique: true },
  decree: { id: 'decree', name: 'DECREE', glyph: 'D', color: '#e8c060', maxStacks: 1, atkMult: 0.7, defAdd: -3, rankScaled: true },
  armor_break: { id: 'armor_break', name: 'ARMOR BROKEN', glyph: 'A', color: '#ff8030', maxStacks: 1, defAdd: -4, dmgTakenMult: 1.1 },
  wither: { id: 'wither', name: 'WITHERED', glyph: 'W', color: '#b0b040', maxStacks: 5, atkMultPerStack: -0.06 },
  plague: { id: 'plague', name: 'PLAGUE', glyph: 'P', color: '#60b030', maxStacks: 1, dot: true, tick: 1 },
  starved: { id: 'starved', name: 'STARVED', glyph: 'S', color: '#8a5ab0', maxStacks: 1, atkMult: 0.7, moveMult: 1.5 },
  grave_mark: { id: 'grave_mark', name: 'GRAVE MARK', glyph: 'G', color: '#a8d8f0', maxStacks: 1, dmgTakenMult: 1.3 },
  stagger: { id: 'stagger', name: 'STAGGERED', glyph: '*', color: '#ffffff', maxStacks: 1, stun: true, rankScaled: true },
  // ---- player buffs
  blood_rush: { id: 'blood_rush', name: 'BLOOD RUSH', glyph: 'B', color: '#ff3020', self: true, dmgMult: 1.35, atkSpeedMult: 0.7, dmgTakenMult: 1.15 },
  wraith: { id: 'wraith', name: 'WRAITH STEP', glyph: 'W', color: '#c0e8ff', self: true, evade: true },
  // ---- player debuffs (Phase 3)
  sundered: { id: 'sundered', name: 'SUNDERED', glyph: 'S', color: '#ff9a60', self: true, debuff: true, defMult: 0.7 },
  // ---- player buffs from Phase 5 unique items
  bulwark: { id: 'bulwark', name: 'BULWARK', glyph: 'U', color: '#c0c8d0', self: true, dmgTakenMult: 0.7 },
  frenzy: { id: 'frenzy', name: 'FRENZY', glyph: 'F', color: '#ff8040', self: true, dmgMult: 1.15, atkSpeedMult: 0.85 },
  empowered: { id: 'empowered', name: 'EMPOWERED', glyph: '+', color: '#ff60ff', maxStacks: 1, atkMult: 1.3, dmgTakenMult: 0.85 }, // enemy support buff
  petrified: { id: 'petrified', name: 'PETRIFIED', glyph: 'P', color: '#a0a090', self: true, debuff: true, rooted: true },
  // ---- player debuffs (Phase 4: hazards, themed enemies, bosses). playerDot = % max HP per tick, never lethal.
  blighted: { id: 'blighted', name: 'BLIGHTED', glyph: 'B', color: '#80c030', self: true, debuff: true, playerDot: 0.02, tick: 1 },
  cursed: { id: 'cursed', name: 'CURSED', glyph: 'C', color: '#a070e0', self: true, debuff: true, dmgMult: 0.8 },
  // ---- boss states (Phase 4). Status chips make them readable over the boss.
  barrier: { id: 'barrier', name: 'BARRIER', glyph: '#', color: '#a8d8f0', maxStacks: 1, dmgTakenMult: 0.25 },
  iron_skin: { id: 'iron_skin', name: 'IRON SKIN', glyph: 'I', color: '#a0a8b0', maxStacks: 1, dmgTakenMult: 0.45 },
  exposed: { id: 'exposed', name: 'VULNERABLE', glyph: 'V', color: '#ffd040', maxStacks: 1, dmgTakenMult: 1.5 },
};

// Control effects are shortened on tougher enemies; stuns grant brief immunity afterwards
// so nothing can be stun-locked forever. Bosses also cap the damage of any single hit.
export const RANK_RULES = {
  normal: { controlMult: 1, maxHitFrac: 1 },
  elite: { controlMult: 0.6, maxHitFrac: 1 },
  boss: { controlMult: 0.35, maxHitFrac: 0.3 },
};
export const STUN_IMMUNITY = 3; // seconds after a stun ends
