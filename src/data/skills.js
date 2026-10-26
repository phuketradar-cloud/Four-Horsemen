// SkillDefinition data. SkillSystem executes these through one shared pipeline — no skill
// has bespoke code; behaviour comes from `target` + a list of effect ops.
//
// Fields: id, name, desc, cls, type, cost, cooldown, target, range, maxTargets, scaling,
//   effects[], unlock (level), upgradeLevel, upgrades {A,B}, icon, fx, sfx, color.
//   Ultimates: consumeAll + minResource (spend everything, effect scales with amount).
// target: front | focus | line | arc | encounter | self
// effect ops:
//   damage  { dmg:[min,max], scale (x ATK), hits, delayPerHit, travel (cells/s -> projectile),
//             secondary (mult for 2nd+ targets), bonusVs {status: mult}, perStack {status, add, bossAdd},
//             execute {threshold, bossThreshold, mult}, ignoreDef, resourceScale (mult per point spent),
//             perResource (flat dmg per point spent), hitsPerResource, soulOnHit {status|any, lockout} }
//   drain   damage fields + healFrac, healCap, bossHealMult
//   status  { status, dur, stacks, power, perStack }
//   buff    { status, dur, power }  (on the player)
//   clear   { status }
// Upgrade mods: dmgMult, cooldownAdd, costAdd, durAdd, hitsAdd, targetsAdd, stacksAdd, healCapAdd,
//   minResourceAdd, statusPowerMult, thresholdAdd, perResourceAdd, secondaryAdd, flags{}
export const SKILL_UNLOCK = [1, 2, 3, 4]; // slot 1-4 unlock levels (fits the Phase 1 dungeon's XP)
export const ULTIMATE_UNLOCK = 4;
export const UPGRADE_LEVEL = 2;          // skill upgrades available from this level
export const ULT_UPGRADE_LEVEL = 5;

const S = {};
const def = (id, o) => { S[id] = { id, ...o }; };

// =============================================================== CONQUEST
def('piercing_judgment', {
  cls: 'conquest', name: 'PIERCING JUDGMENT', type: 'projectile', icon: 'pierce', color: '#f0d070',
  desc: 'A bolt of judgment pierces every enemy in the corridor ahead.',
  cost: 15, cooldown: 6, target: 'line', range: 6, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [12, 18], scale: 0.9, travel: 16 }],
  fx: 'goldBolt', sfx: 'holyCast',
  upgrades: {
    A: { name: 'HEAVY JUDGMENT', desc: '+35% damage, +2s cooldown', mods: { dmgMult: 1.35, cooldownAdd: 2 } },
    B: { name: 'SWIFT JUDGMENT', desc: '-2s cooldown, -15% damage', mods: { cooldownAdd: -2, dmgMult: 0.85 } },
  },
});
def('mark_of_crown', {
  cls: 'conquest', name: 'MARK OF THE CROWN', type: 'mark', icon: 'crown', color: '#f0d070',
  desc: 'Mark one foe: it takes +25% damage and your hits on it build Dominion.',
  cost: 0, cooldown: 8, target: 'focus', range: 6, scaling: '-',
  effects: [{ op: 'status', status: 'mark', dur: 10 }],
  fx: 'markSigil', sfx: 'markApply',
  upgrades: {
    A: { name: 'LONG REIGN', desc: '+5s mark duration, +3s cooldown', mods: { durAdd: 5, cooldownAdd: 3 } },
    B: { name: 'CROWN SNAP', desc: '-4s cooldown, -3s mark duration', mods: { cooldownAdd: -4, durAdd: -3 } },
  },
});
def('phantom_volley', {
  cls: 'conquest', name: 'PHANTOM VOLLEY', type: 'projectile', icon: 'volley', color: '#ffffff',
  desc: 'Spectral arrows strike your target; x1.5 damage on a Marked foe.',
  cost: 20, cooldown: 7, target: 'focus', range: 6, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [5, 8], scale: 0.4, hits: 3, delayPerHit: 0.12, travel: 14, bonusVs: { mark: 1.5 } }],
  fx: 'volley', sfx: 'holyCast',
  upgrades: {
    A: { name: 'SPECTRAL STORM', desc: '+2 arrows, +10 Dominion cost', mods: { hitsAdd: 2, costAdd: 10 } },
    B: { name: 'FOCUSED VOLLEY', desc: '-1 arrow, +40% damage, -5 cost', mods: { hitsAdd: -1, dmgMult: 1.4, costAdd: -5 } },
  },
});
def('royal_decree', {
  cls: 'conquest', name: 'ROYAL DECREE', type: 'debuff', icon: 'scroll', color: '#e8c060',
  desc: 'Target deals 30% less damage and loses 3 defense. Shorter on elites and bosses.',
  cost: 25, cooldown: 12, target: 'focus', range: 5, scaling: '-',
  effects: [{ op: 'status', status: 'decree', dur: 6 }],
  fx: 'decree', sfx: 'debuff',
  upgrades: {
    A: { name: 'ABSOLUTE DECREE', desc: '+3s duration, +10 cost', mods: { durAdd: 3, costAdd: 10 } },
    B: { name: 'SWIFT EDICT', desc: '-4s cooldown, -2s duration', mods: { cooldownAdd: -4, durAdd: -2 } },
  },
});
def('world_conqueror', {
  cls: 'conquest', name: 'WORLD CONQUEROR', type: 'ultimate', icon: 'sun', color: '#fff0b0', ultimate: true,
  desc: 'Spend all Dominion (min 50): a spectral volley of 4 +1 per 25 Dominion. x1.6 on Marked, +2% per marked hit this run (max +40%).',
  cost: 0, consumeAll: true, minResource: 50, cooldown: 20, target: 'focus', range: 6, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [8, 12], scale: 0.5, hits: 4, hitsPerResource: 1 / 25, delayPerHit: 0.08, travel: 18, bonusVs: { mark: 1.6 }, markedHitBonus: { per: 0.02, cap: 0.4 } }],
  fx: 'worldConqueror', sfx: 'ultConquest',
  upgrades: {
    A: { name: 'ETERNAL EMPIRE', desc: '+2 arrows, needs +10 more Dominion', mods: { hitsAdd: 2, minResourceAdd: 10 } },
    B: { name: 'SWIFT CONQUEST', desc: '-6s cooldown, -1 arrow', mods: { cooldownAdd: -6, hitsAdd: -1 } },
  },
});

// =============================================================== WAR
def('cleave', {
  cls: 'war', name: 'CLEAVE', type: 'multi', icon: 'cleave', color: '#ff5030',
  desc: 'Sweep every adjacent foe. Secondary targets take 70%.',
  cost: 20, cooldown: 4, target: 'arc', range: 1, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [12, 18], scale: 1.0, secondary: 0.7 }],
  fx: 'redArc', sfx: 'warCry',
  upgrades: {
    A: { name: 'WIDE ARC', desc: 'Secondary targets take 100%, +1s cooldown', mods: { secondaryAdd: 0.3, cooldownAdd: 1 } },
    B: { name: 'QUICK CLEAVE', desc: '-1.5s cooldown, -15% damage', mods: { cooldownAdd: -1.5, dmgMult: 0.85 } },
  },
});
def('armor_breaker', {
  cls: 'war', name: 'ARMOR BREAKER', type: 'debuff', icon: 'shieldBreak', color: '#ff8030',
  desc: 'A defense-ignoring blow that breaks armor: -4 DEF, +10% damage taken for 8s.',
  cost: 25, cooldown: 8, target: 'front', range: 1, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [16, 22], scale: 1.1, ignoreDef: true }, { op: 'status', status: 'armor_break', dur: 8 }],
  fx: 'redArc', sfx: 'armorCrack',
  upgrades: {
    A: { name: 'SHATTER', desc: '+4s armor break, +5 Fury cost', mods: { durAdd: 4, costAdd: 5 } },
    B: { name: 'CRUSHING BLOW', desc: '+25% damage, +3s cooldown', mods: { dmgMult: 1.25, cooldownAdd: 3 } },
  },
});
def('blood_rush', {
  cls: 'war', name: 'BLOOD RUSH', type: 'buff', icon: 'blood', color: '#ff3020',
  desc: '8s: +35% damage and 30% faster attacks, but you take 15% more damage.',
  cost: 30, cooldown: 18, target: 'self', range: 0, scaling: '-',
  effects: [{ op: 'buff', status: 'blood_rush', dur: 8 }],
  fx: 'bloodAura', sfx: 'buff',
  upgrades: {
    A: { name: 'BERSERK', desc: '+4s duration, +4s cooldown', mods: { durAdd: 4, cooldownAdd: 4 } },
    B: { name: 'CONTROLLED RAGE', desc: '-10 Fury cost, -2s duration', mods: { costAdd: -10, durAdd: -2 } },
  },
});
def('earthshaker', {
  cls: 'war', name: 'EARTHSHAKER', type: 'aoe', icon: 'quake', color: '#c06030',
  desc: 'Smash the ground: hits every foe within 3 tiles and staggers them (shorter on elites/bosses).',
  cost: 40, cooldown: 14, target: 'encounter', range: 3, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [10, 15], scale: 0.8 }, { op: 'status', status: 'stagger', dur: 1.2 }],
  fx: 'groundCrack', sfx: 'groundSlam',
  upgrades: {
    A: { name: 'AFTERSHOCK', desc: '+30% damage, +10 Fury cost', mods: { dmgMult: 1.3, costAdd: 10 } },
    B: { name: 'TREMOR', desc: '-4s cooldown, -0.4s stagger', mods: { cooldownAdd: -4, durAdd: -0.4 } },
  },
});
def('red_apocalypse', {
  cls: 'war', name: 'RED APOCALYPSE', type: 'ultimate', icon: 'apocalypse', color: '#ff2010', ultimate: true,
  desc: 'Spend all Fury (min 60): 3 brutal waves on every foe within 3 tiles. +1% damage per Fury spent.',
  cost: 0, consumeAll: true, minResource: 60, cooldown: 22, target: 'encounter', range: 3, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [10, 14], scale: 0.7, hits: 3, delayPerHit: 0.18, resourceScale: 0.01 }],
  fx: 'redApocalypse', sfx: 'ultWar',
  upgrades: {
    A: { name: 'ENDLESS WAR', desc: '+1 wave, needs +10 more Fury', mods: { hitsAdd: 1, minResourceAdd: 10 } },
    B: { name: 'QUICK SLAUGHTER', desc: '-6s cooldown, -15% damage', mods: { cooldownAdd: -6, dmgMult: 0.85 } },
  },
});

// =============================================================== FAMINE
def('withering_touch', {
  cls: 'famine', name: 'WITHERING TOUCH', type: 'debuff', icon: 'wither', color: '#b0b040',
  desc: 'Light damage and 2 Withering stacks (each -6% enemy damage, max 5, 10s).',
  cost: 10, cooldown: 3, target: 'focus', range: 4, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [4, 6], scale: 0.3 }, { op: 'status', status: 'wither', stacks: 2, dur: 10 }],
  fx: 'witherTouch', sfx: 'witherCast',
  upgrades: {
    A: { name: 'DEEP ROT', desc: '+1 stack, +2 Plague cost', mods: { stacksAdd: 1, costAdd: 2 } },
    B: { name: 'LINGERING DECAY', desc: '+5s duration, +1s cooldown', mods: { durAdd: 5, cooldownAdd: 1 } },
  },
});
def('harvest_of_weakness', {
  cls: 'famine', name: 'HARVEST OF WEAKNESS', type: 'drain', icon: 'drain', color: '#a0c050',
  desc: 'Drain a Withered foe: +3 dmg per stack, heal 50% of it (cap 18, halved vs bosses).',
  cost: 25, cooldown: 7, target: 'focus', range: 4, requiresStatus: 'wither', scaling: 'ATK',
  effects: [{ op: 'drain', dmg: [8, 12], scale: 0.5, perStack: { status: 'wither', add: 3 }, healFrac: 0.5, healCap: 18, bossHealMult: 0.5 }],
  fx: 'drain', sfx: 'drain',
  upgrades: {
    A: { name: 'GLUTTONY', desc: '+8 heal cap, +3s cooldown', mods: { healCapAdd: 8, cooldownAdd: 3 } },
    B: { name: 'SWIFT HARVEST', desc: '-3s cooldown, -6 heal cap', mods: { cooldownAdd: -3, healCapAdd: -6 } },
  },
});
def('black_plague', {
  cls: 'famine', name: 'BLACK PLAGUE', type: 'dot', icon: 'plague', color: '#60b030',
  desc: 'Infect up to 2 foes: 3 dmg/s +1.5 per Withering stack for 8s. Re-casting refreshes, never stacks.',
  cost: 20, cooldown: 9, target: 'focus', range: 4, maxTargets: 2, scaling: 'WITHER',
  effects: [{ op: 'status', status: 'plague', dur: 8, power: 5, perStack: 2.5 }], // Phase 6 balance: was 3 / 1.5 (Famine trailed every sim)
  fx: 'plagueCloud', sfx: 'plagueCast',
  upgrades: {
    A: { name: 'PANDEMIC', desc: '+1 target, +5 Plague cost', mods: { targetsAdd: 1, costAdd: 5 } },
    B: { name: 'VIRULENCE', desc: '+50% damage per tick, -2s duration', mods: { statusPowerMult: 1.5, durAdd: -2 } },
  },
});
def('starvation_field', {
  cls: 'famine', name: 'STARVATION FIELD', type: 'aoe', icon: 'field', color: '#8a5ab0',
  desc: 'A field of hunger: foes within 3 tiles deal 30% less damage, move slower, and gain 1 Withering.',
  cost: 30, cooldown: 16, target: 'encounter', range: 3, scaling: '-',
  effects: [{ op: 'status', status: 'starved', dur: 6 }, { op: 'status', status: 'wither', stacks: 1, dur: 10 }],
  fx: 'starveField', sfx: 'fieldCast',
  upgrades: {
    A: { name: 'BARREN EARTH', desc: '+3s duration, +4s cooldown', mods: { durAdd: 3, cooldownAdd: 4 } },
    B: { name: 'HUNGER PANGS', desc: '-10 Plague cost, -2s duration', mods: { costAdd: -10, durAdd: -2 } },
  },
});
def('last_harvest', {
  cls: 'famine', name: 'THE LAST HARVEST', type: 'ultimate', icon: 'scales', color: '#d0d060', ultimate: true,
  desc: 'Spend all Plague (min 70): reap every foe within 3 tiles, +9 dmg per Withering stack (+5 vs bosses). Heal 25% (cap 40). Clears Withering.',
  cost: 0, consumeAll: true, minResource: 70, cooldown: 24, target: 'encounter', range: 3, scaling: 'WITHER',
  effects: [
    { op: 'drain', dmg: [8, 12], scale: 0.5, perStack: { status: 'wither', add: 9, bossAdd: 5 }, healFrac: 0.25, healCap: 40, bossHealMult: 0.5, shared: true },
    { op: 'clear', status: 'wither' },
  ],
  fx: 'lastHarvest', sfx: 'ultFamine',
  upgrades: {
    A: { name: 'FEAST', desc: '+15 heal cap, needs +10 more Plague', mods: { healCapAdd: 15, minResourceAdd: 10 } },
    B: { name: 'SWIFT FAMINE', desc: '-6s cooldown, -15% damage', mods: { cooldownAdd: -6, dmgMult: 0.85 } },
  },
});

// =============================================================== DEATH
def('soul_rend', {
  cls: 'death', name: 'SOUL REND', type: 'single', icon: 'rend', color: '#a8d8f0',
  desc: 'Spectral strike (range 2). Gains 1 Soul if the target bears a Grave Mark (once per foe per 6s).',
  cost: 0, cooldown: 4, target: 'focus', range: 2, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [10, 15], scale: 0.9, soulOnHit: { status: 'grave_mark', lockout: 6 } }],
  fx: 'soulRend', sfx: 'soulRend',
  upgrades: {
    A: { name: 'SOUL TEAR', desc: '+25% damage, +1.5s cooldown', mods: { dmgMult: 1.25, cooldownAdd: 1.5 } },
    B: { name: 'REAPING EDGE', desc: 'Gain Souls from any target, +2s cooldown', mods: { cooldownAdd: 2, flags: { soulAny: true } } },
  },
});
def('grave_mark', {
  cls: 'death', name: 'GRAVE MARK', type: 'curse', icon: 'grave', color: '#a8d8f0',
  desc: 'Curse a foe: it takes +30% damage from you for 10s.',
  cost: 1, cooldown: 10, target: 'focus', range: 5, scaling: '-',
  effects: [{ op: 'status', status: 'grave_mark', dur: 10 }],
  fx: 'graveSigil', sfx: 'curse',
  upgrades: {
    A: { name: 'DEEP GRAVE', desc: '+5s duration, +2s cooldown', mods: { durAdd: 5, cooldownAdd: 2 } },
    B: { name: 'FREE CURSE', desc: 'Costs no Soul, -4s duration', mods: { costAdd: -1, durAdd: -4 } },
  },
});
def('wraith_step', {
  cls: 'death', name: 'WRAITH STEP', type: 'defensive', icon: 'wraith', color: '#c0e8ff',
  desc: 'For 1.6s, evade the next blow from the front and counterattack.',
  cost: 1, cooldown: 9, target: 'self', range: 0, scaling: 'ATK',
  effects: [{ op: 'buff', status: 'wraith', dur: 1.6, power: { dmg: [12, 18], scale: 0.8 } }],
  fx: 'wraith', sfx: 'wraith',
  upgrades: {
    A: { name: 'PHANTOM', desc: '+0.8s evade window, +2s cooldown', mods: { durAdd: 0.8, cooldownAdd: 2 } },
    B: { name: 'VENGEFUL', desc: 'Counter +50% damage, +1 Soul cost', mods: { dmgMult: 1.5, costAdd: 1 } },
  },
});
def('deaths_embrace', {
  cls: 'death', name: "DEATH'S EMBRACE", type: 'execute', icon: 'embrace', color: '#80c0e0',
  desc: 'Melee blow; x2.5 damage below 30% HP (bosses: below 15% only).',
  cost: 2, cooldown: 10, target: 'front', range: 1, scaling: 'ATK',
  effects: [{ op: 'damage', dmg: [14, 20], scale: 1.0, execute: { threshold: 0.3, bossThreshold: 0.15, mult: 2.5 } }],
  fx: 'scythe', sfx: 'embrace',
  upgrades: {
    A: { name: 'GRIM HARVEST', desc: 'Threshold +10% (bosses +3%), +3s cooldown', mods: { thresholdAdd: 0.1, cooldownAdd: 3 } },
    B: { name: 'QUICK END', desc: '-3s cooldown, -15% damage', mods: { cooldownAdd: -3, dmgMult: 0.85 } },
  },
});
def('final_silence', {
  cls: 'death', name: 'THE FINAL SILENCE', type: 'ultimate', icon: 'scythe', color: '#e8f8ff', ultimate: true,
  desc: 'Spend all Souls (min 4): a spectral scythe hits every foe within 3 tiles, +6 dmg per Soul; x1.5 on cursed or low-HP foes.',
  cost: 0, consumeAll: true, minResource: 4, cooldown: 22, target: 'encounter', range: 3, scaling: 'SOULS',
  effects: [{ op: 'damage', dmg: [10, 14], scale: 0.6, perResource: 6, bonusVs: { grave_mark: 1.5 }, lowHp: { threshold: 0.35, bossThreshold: 0.15, mult: 1.5 } }],
  fx: 'finalSilence', sfx: 'ultDeath',
  upgrades: {
    A: { name: 'MASS GRAVE', desc: '+2 dmg per Soul, needs +2 more Souls', mods: { perResourceAdd: 2, minResourceAdd: 2 } },
    B: { name: 'SWIFT SILENCE', desc: '-6s cooldown, -15% damage', mods: { cooldownAdd: -6, dmgMult: 0.85 } },
  },
});

export const SKILLS = S;
