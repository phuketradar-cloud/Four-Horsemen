// Centralised attribute + derived-stat formulas and caps. StatCalculator is the only consumer;
// combat, skills and UI read finished numbers from it. `doc` strings are shown in the UI.
//
// Attribute bonuses use dA = (current attribute - the class's innate attribute), so a level-1
// Horseman with no gear has exactly the Phase 2 base stats; growth and gear add on top.
// Flat bonuses and percentage bonuses are separate stats ("hp" vs "hpPct").
export const FORMULAS = {
  hp: { perVit: 4, doc: '(Class HP + HP/level x (LV-1) + 4 x bonus VIT + flat HP) x (1 + HP%)' },
  atk: { perStr: 0.5, perDex: 0.2, doc: '(Class ATK + 0.5 x bonus STR + 0.2 x bonus DEX + flat ATK) x (1 + ATK%)' },
  def: { perVit: 0.25, reduction: 0.3, doc: '(Class DEF + 0.25 x bonus VIT + armour) x (1 + DEF%); each blow is reduced by 0.3 x DEF' },
  skillPower: { perInt: 1.5, doc: '1.5 x bonus INT + flat; skills and DoTs deal +SP% damage (basic attacks unaffected)' },
  resist: { perWis: 0.4, cap: 60, doc: '0.4 x bonus WIS + flat (max 60%); reduces dark damage from knights' },
  accuracy: { base: 95, perDex: 0.4, min: 60, max: 100, doc: '95 + 0.4 x bonus DEX + flat; hit chance = accuracy - enemy evasion (60-100%)' },
  crit: { perDex: 0.15, perLck: 0.25, cap: 60, doc: 'Class CRIT + 0.15 x bonus DEX + 0.25 x bonus LCK + flat (max 60%)' },
  critDmg: { cap: 150, doc: 'Weapon crit multiplier + flat% (max +150%); skills crit for x1.5 + this' },
  atkSpeed: { perDex: 0.2, cap: 40, minCooldown: 0.15, doc: '0.2 x bonus DEX + flat (max 40%); weapon cooldown x (1 - AS%), never below 0.15s' },
  evasion: { cap: 30, doc: 'From gear only (max 30%); chance to dodge an enemy blow entirely' },
  armorPen: { perStr: 0.15, doc: '0.15 x bonus STR + flat; subtracted from enemy DEF' },
  statusResist: { perWis: 0.6, cap: 60, doc: '0.6 x bonus WIS + flat (max 60%); shortens debuffs on you' },
  resEff: { perWis: 0.5, cap: 30, doc: '0.5 x bonus WIS + flat (max 30%); skill costs reduced (min 1)' },
  resGain: { cap: 50, doc: 'From gear/sets only (max 50%); class resource generation bonus' },
  resRegen: { perWis: 1, cap: 100, doc: '1 x bonus WIS + flat (max 100%); passive regeneration bonus (Plague)' },
  moveSpeed: { cap: 25, doc: 'From gear (max 25%); time per tile step x (1 - MS%), min 0.12s' },
  damageReduction: { cap: 40, doc: 'From gear (max 40%); all incoming damage x (1 - DR%)' },
  lootLuck: { perLck: 0.5, cap: 25, doc: '0.5 x LCK + flat (max 25%); boosts Uncommon..Legendary weights, never Mythic' },
  rangedBonus: { perDex: 0.3, doc: 'Ranged basic attacks: +0.3 x bonus DEX damage' },
  heavyBonus: { perStr: 0.2, doc: 'Two-handed melee: +0.2 x bonus STR damage' },
  // class synergy stats (from class affixes, sets, relics)
  markedDmg: { cap: 60, doc: '+% damage to Marked foes (Conquest)' },
  markedCrit: { cap: 30, doc: '+crit% against Marked foes (Conquest)' },
  areaDmg: { cap: 60, doc: '+% damage from area/arc skills (War)' },
  dotDmg: { cap: 80, doc: '+% damage over time (Famine)' },
  drainPower: { cap: 50, doc: '+% drain healing before caps (Famine)' },
  witherStacks: { cap: 2, doc: '+max Withering stacks (Famine)' },
  executeDmg: { cap: 60, doc: '+% damage to foes below 35% HP (Death)' },
  curseDmg: { cap: 60, doc: '+% damage to Grave-Marked foes (Death)' },
  // Phase 5 (catalog affixes / unique items). All bounded.
  rangedDmg: { cap: 50, doc: '+% damage of ranged basic attacks (max 50%)' },
  fireDmg: { cap: 60, doc: 'Flat fire damage added to basic hits (fire items only, max 60)' },
  bossDmg: { cap: 30, doc: '+% damage to elites and bosses (max 30%)' },
  cdr: { cap: 20, doc: 'Skill cooldowns x (1 - CDR%), max 20% - cooldowns can never be removed' },
  statusDur: { cap: 40, doc: '+% duration of statuses you apply (stuns excluded, max 40%)' },
  lifeOnKill: { cap: 50, doc: 'HP restored per kill (also capped at 5% max HP, once per 0.5s)' },
};

// Display order + labels for the character screen.
export const STAT_LABELS = [
  ['hp', 'MAX HP'], ['atk', 'ATTACK'], ['skillPower', 'SKILL POWER', '%'], ['def', 'DEFENSE'], ['resist', 'RESIST', '%'],
  ['accuracy', 'ACCURACY'], ['crit', 'CRIT CHANCE', '%'], ['critDmg', 'CRIT DAMAGE', '%+'], ['atkSpeed', 'ATTACK SPEED', '%+'],
  ['evasion', 'EVASION', '%'], ['armorPen', 'ARMOR PEN'], ['statusResist', 'STATUS RES', '%'], ['resEff', 'RES. EFFICIENCY', '%'],
  ['resGain', 'RES. GAIN', '%+'], ['damageReduction', 'DMG REDUCTION', '%'], ['moveSpeed', 'MOVE SPEED', '%+'], ['lootLuck', 'LOOT LUCK', '%'],
];
export const ATTRS = ['str', 'dex', 'vit', 'int', 'wis', 'lck'];
export const ATTR_LABELS = { str: 'STR', dex: 'DEX', vit: 'VIT', int: 'INT', wis: 'WIS', lck: 'LCK' };

// Human-readable names for every stat key an item/affix/set can carry.
export const STAT_NAMES = {
  hp: 'Max HP', hpPct: '% Max HP', atk: 'Attack', atkPct: '% Attack', def: 'Defense', defPct: '% Defense',
  skillPower: '% Skill Power', resist: '% Resistance', accuracy: 'Accuracy', crit: '% Crit Chance', critDmg: '% Crit Damage',
  atkSpeed: '% Attack Speed', evasion: '% Evasion', armorPen: 'Armor Pen', statusResist: '% Status Resist', resEff: '% Resource Efficiency',
  resGain: '% Resource Gain', resRegen: '% Resource Regen', moveSpeed: '% Move Speed', damageReduction: '% Damage Reduction', lootLuck: '% Loot Luck',
  str: 'STR', dex: 'DEX', vit: 'VIT', int: 'INT', wis: 'WIS', lck: 'LCK',
  markedDmg: '% Damage to Marked', markedCrit: '% Crit vs Marked', areaDmg: '% Area Damage', dotDmg: '% DoT Damage',
  drainPower: '% Drain Healing', witherStacks: 'Max Withering Stacks', executeDmg: '% Damage to <35% HP foes', curseDmg: '% Damage to Cursed',
  rangedDmg: '% Ranged Damage', fireDmg: 'Fire Damage', bossDmg: '% Damage vs Elites/Bosses', cdr: '% Cooldown Reduction', statusDur: '% Status Duration', lifeOnKill: 'HP on Kill',
};
