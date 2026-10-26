// AffixDefinition data. AffixRoller (ItemGenerator) filters by slot, item level, rarity, class
// and exclusive group, then rolls a bounded value:
//   range at ilvl = [min, max] x (1 + scale x (ilvl - 1));  value = lo + (hi - lo) x t,
//   t drawn inside the rarity's roll window (items.js RARITIES[r].roll).
// Fields: id, name, kind (prefix|suffix), slots, minIlvl, maxIlvl, rarities, weight,
//   stat, min, max, scale, dec (decimals), group (exclusive), cls (class synergy), stacking.
// stacking: 'none' — the same affix never appears twice on one item (enforced by `group`);
//   across different items, identical stats add up (the calculator applies the caps).
const ARMOR = ['head', 'chest', 'hands', 'legs'];
const ALL = ['head', 'chest', 'hands', 'legs', 'mainHand', 'offHand', 'ring', 'relic'];
const UNC_UP = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARE_UP = ['rare', 'epic', 'legendary', 'mythic'];
const EPIC_UP = ['epic', 'legendary', 'mythic'];

const A = [];
const add = (id, o) => A.push({ id, minIlvl: 1, maxIlvl: 50, rarities: UNC_UP, weight: 10, scale: 0.12, dec: 0, stacking: 'none', ...o });

// ---------------------------------------------------------------- prefixes
add('brutal', { name: 'Brutal', kind: 'prefix', slots: ['mainHand', 'hands', 'ring'], stat: 'atk', min: 1, max: 3, group: 'atk', desc: '+{v} Attack' });
add('savage', { name: 'Savage', kind: 'prefix', slots: ['mainHand'], stat: 'atkPct', min: 4, max: 9, scale: 0.04, minIlvl: 3, rarities: RARE_UP, group: 'atkPct', weight: 6, desc: '+{v}% Attack' });
add('stalwart', { name: 'Stalwart', kind: 'prefix', slots: [...ARMOR, 'offHand'], stat: 'def', min: 0.5, max: 1.5, dec: 1, group: 'def', desc: '+{v} Defense' });
add('vigorous', { name: 'Vigorous', kind: 'prefix', slots: [...ARMOR, 'ring', 'relic'], stat: 'hp', min: 5, max: 12, group: 'hp', desc: '+{v} Max HP' });
add('keen', { name: 'Keen', kind: 'prefix', slots: ['mainHand', 'hands', 'ring', 'head'], stat: 'crit', min: 1, max: 3, dec: 1, scale: 0.05, group: 'crit', desc: '+{v}% Crit Chance' });
add('arcane', { name: 'Arcane', kind: 'prefix', slots: ['head', 'chest', 'hands', 'offHand', 'ring', 'relic', 'mainHand'], stat: 'skillPower', min: 3, max: 7, group: 'sp', desc: '+{v}% Skill Power' });
add('swift', { name: 'Swift', kind: 'prefix', slots: ['hands', 'mainHand', 'ring'], stat: 'atkSpeed', min: 2, max: 5, scale: 0.04, group: 'as', desc: '+{v}% Attack Speed' });
add('piercing', { name: 'Piercing', kind: 'prefix', slots: ['mainHand', 'hands'], stat: 'armorPen', min: 1, max: 2, dec: 1, group: 'pen', desc: '+{v} Armor Penetration' });
add('fortified', { name: 'Fortified', kind: 'prefix', slots: ['chest', 'offHand'], stat: 'damageReduction', min: 2, max: 4, scale: 0.04, rarities: RARE_UP, group: 'dr', weight: 5, desc: '+{v}% Damage Reduction' });
// class synergy prefixes
add('dominating', { name: 'Dominating', kind: 'prefix', slots: ['mainHand', 'head', 'hands', 'ring', 'relic'], stat: 'markedCrit', min: 3, max: 6, scale: 0.04, cls: 'conquest', group: 'cls1', desc: '+{v}% Crit vs Marked foes' });
add('bloodforged', { name: 'Bloodforged', kind: 'prefix', slots: ['mainHand', 'chest', 'hands', 'relic', 'ring'], stat: 'resGain', min: 6, max: 12, scale: 0.04, cls: 'war', group: 'cls1', desc: '+{v}% Fury generation' });
add('withering', { name: 'Withering', kind: 'prefix', slots: ['mainHand', 'head', 'hands', 'offHand', 'relic'], stat: 'dotDmg', min: 8, max: 15, scale: 0.04, cls: 'famine', group: 'cls1', desc: '+{v}% Plague / DoT damage' });
add('soulbound', { name: 'Soulbound', kind: 'prefix', slots: ['mainHand', 'head', 'chest', 'ring', 'relic'], stat: 'resGain', min: 10, max: 20, scale: 0.04, cls: 'death', group: 'cls1', desc: '+{v}% Soul generation' });

// ---------------------------------------------------------------- suffixes
add('of_the_bear', { name: 'of the Bear', kind: 'suffix', slots: [...ARMOR, 'ring'], stat: 'vit', min: 1, max: 3, group: 'vit', desc: '+{v} VIT' });
add('of_might', { name: 'of Might', kind: 'suffix', slots: ['mainHand', 'hands', 'ring', 'chest'], stat: 'str', min: 1, max: 3, group: 'str', desc: '+{v} STR' });
add('of_finesse', { name: 'of Finesse', kind: 'suffix', slots: ['mainHand', 'hands', 'legs', 'ring'], stat: 'dex', min: 1, max: 3, group: 'dex', desc: '+{v} DEX' });
add('of_insight', { name: 'of Insight', kind: 'suffix', slots: ['head', 'offHand', 'ring', 'relic', 'chest'], stat: 'int', min: 1, max: 3, group: 'int', desc: '+{v} INT' });
add('of_wisdom', { name: 'of Wisdom', kind: 'suffix', slots: ['head', 'offHand', 'ring', 'relic'], stat: 'wis', min: 1, max: 3, group: 'wis', desc: '+{v} WIS' });
add('of_fortune', { name: 'of Fortune', kind: 'suffix', slots: ['ring', 'relic', 'head'], stat: 'lck', min: 1, max: 3, group: 'lck', weight: 6, desc: '+{v} LCK' });
add('of_precision', { name: 'of Precision', kind: 'suffix', slots: ['mainHand', 'hands', 'head', 'ring'], stat: 'accuracy', min: 2, max: 5, group: 'acc', desc: '+{v} Accuracy' });
add('of_the_guardian', { name: 'of the Guardian', kind: 'suffix', slots: [...ARMOR, 'offHand'], stat: 'resist', min: 3, max: 6, scale: 0.05, group: 'res', desc: '+{v}% Resistance' });
add('of_slaughter', { name: 'of Slaughter', kind: 'suffix', slots: ['mainHand', 'ring', 'hands'], stat: 'critDmg', min: 6, max: 14, scale: 0.05, rarities: RARE_UP, group: 'cdmg', desc: '+{v}% Crit Damage' });
add('of_the_shadow', { name: 'of the Shadow', kind: 'suffix', slots: ['legs', 'chest', 'hands'], stat: 'evasion', min: 1, max: 3, dec: 1, scale: 0.05, group: 'eva', desc: '+{v}% Evasion' });
add('of_resolve', { name: 'of Resolve', kind: 'suffix', slots: ['head', 'chest', 'ring', 'relic'], stat: 'statusResist', min: 4, max: 9, scale: 0.05, group: 'sres', desc: '+{v}% Status Resist' });
add('of_the_titan', { name: 'of the Titan', kind: 'suffix', slots: ['chest', 'legs'], stat: 'hpPct', min: 3, max: 6, scale: 0.03, rarities: EPIC_UP, group: 'hpPct', weight: 5, desc: '+{v}% Max HP' });
// class synergy suffixes
add('of_conquest', { name: 'of Conquest', kind: 'suffix', slots: ['mainHand', 'hands', 'ring', 'relic', 'head'], stat: 'markedDmg', min: 6, max: 12, scale: 0.04, cls: 'conquest', group: 'cls2', desc: '+{v}% damage to Marked foes' });
add('of_war', { name: 'of War', kind: 'suffix', slots: ['mainHand', 'chest', 'hands', 'relic', 'legs'], stat: 'areaDmg', min: 8, max: 15, scale: 0.04, cls: 'war', group: 'cls2', desc: '+{v}% area skill damage' });
add('of_hunger', { name: 'of Hunger', kind: 'suffix', slots: ['mainHand', 'chest', 'ring', 'relic', 'offHand'], stat: 'drainPower', min: 8, max: 16, scale: 0.04, cls: 'famine', group: 'cls2', desc: '+{v}% drain healing (caps still apply)' });
add('of_the_reaper', { name: 'of the Reaper', kind: 'suffix', slots: ['mainHand', 'hands', 'ring', 'relic'], stat: 'executeDmg', min: 8, max: 15, scale: 0.04, cls: 'death', group: 'cls2', desc: '+{v}% damage to foes below 35% HP' });
add('of_the_end', { name: 'of the End', kind: 'suffix', slots: ['head', 'chest', 'offHand', 'relic', 'legs'], stat: 'curseDmg', min: 8, max: 15, scale: 0.04, cls: 'death', group: 'cls3', desc: '+{v}% damage to Grave-Marked foes' });

// ---------------------------------------------------------------- Phase 5 affixes (60 total)
// requires: compatibility rule checked against the BASE item (ItemGenerator.affixAllowed):
//   { tag }        the base must carry that tag (fire / blight / spectral / abyss / curse)
//   { ranged }     ranged weapons only        { melee } melee weapons only
//   { twoHanded }  two-handed weapons only    so e.g. "Smoldering" never lands on a non-fire item.
const WEAP = ['mainHand'];
// prefixes
add('heavy', { name: 'Heavy', kind: 'prefix', slots: WEAP, stat: 'armorPen', min: 2, max: 4, dec: 1, requires: { twoHanded: true, melee: true }, group: 'pen', desc: '+{v} Armor Penetration (two-handed)' });
add('hunters', { name: "Hunter's", kind: 'prefix', slots: WEAP, stat: 'rangedDmg', min: 6, max: 12, scale: 0.04, requires: { ranged: true }, group: 'ranged', desc: '+{v}% ranged attack damage' });
add('smoldering', { name: 'Smoldering', kind: 'prefix', slots: [...WEAP, 'hands', 'ring'], stat: 'fireDmg', min: 2, max: 5, scale: 0.1, requires: { tag: 'fire' }, group: 'fire', desc: '+{v} fire damage on basic hits' });
add('blighted', { name: 'Blighted', kind: 'prefix', slots: [...WEAP, 'hands', 'offHand', 'head'], stat: 'dotDmg', min: 5, max: 10, scale: 0.04, requires: { tag: 'blight' }, group: 'dot2', desc: '+{v}% damage over time' });
add('spectral', { name: 'Spectral', kind: 'prefix', slots: [...ARMOR, 'offHand', 'ring'], stat: 'resist', min: 4, max: 8, scale: 0.04, requires: { tag: 'spectral' }, group: 'res', desc: '+{v}% Resistance' });
add('abyssal', { name: 'Abyssal', kind: 'prefix', slots: [...WEAP, 'ring', 'relic', 'hands'], stat: 'bossDmg', min: 4, max: 8, scale: 0.03, requires: { tag: 'abyss' }, rarities: RARE_UP, group: 'boss', desc: '+{v}% damage to elites and bosses' });
add('accursed', { name: 'Accursed', kind: 'prefix', slots: [...WEAP, 'head', 'chest', 'ring', 'legs'], stat: 'curseDmg', min: 5, max: 10, scale: 0.04, requires: { tag: 'curse' }, group: 'curse2', desc: '+{v}% damage to Cursed (Grave-Marked) foes' });
add('tempered', { name: 'Tempered', kind: 'prefix', slots: ARMOR, stat: 'defPct', min: 3, max: 7, scale: 0.03, rarities: RARE_UP, group: 'defPct', desc: '+{v}% Defense' });
add('hallowed', { name: 'Hallowed', kind: 'prefix', slots: ['head', 'offHand', 'relic', 'ring'], stat: 'statusDur', min: 6, max: 12, scale: 0.03, rarities: RARE_UP, group: 'sdur', desc: '+{v}% duration of your status effects (not stuns)' });
add('ravenous', { name: 'Ravenous', kind: 'prefix', slots: [...WEAP, 'ring'], stat: 'lifeOnKill', min: 2, max: 5, scale: 0.1, group: 'lok', desc: '+{v} HP on kill (max 5% of max HP)' });
add('nimble', { name: 'Nimble', kind: 'prefix', slots: ['legs'], stat: 'moveSpeed', min: 2, max: 5, scale: 0.02, group: 'ms', desc: '+{v}% Move Speed' });
add('quickened', { name: 'Quickened', kind: 'prefix', slots: ['head', 'relic', 'ring'], stat: 'cdr', min: 2, max: 4, scale: 0.02, rarities: EPIC_UP, group: 'cdr', weight: 4, desc: '+{v}% skill cooldown reduction (max 20%)' });
add('tyrants', { name: "Tyrant's", kind: 'prefix', slots: [...WEAP, 'hands'], stat: 'bossDmg', min: 3, max: 6, scale: 0.03, rarities: EPIC_UP, group: 'boss', weight: 5, desc: '+{v}% damage to elites and bosses' });
add('gleaming', { name: 'Gleaming', kind: 'prefix', slots: ['ring', 'relic'], stat: 'lootLuck', min: 2, max: 4, scale: 0.03, group: 'luck', weight: 6, desc: '+{v}% Loot Luck' });
add('warded', { name: 'Warded', kind: 'prefix', slots: ['offHand', 'ring', 'relic'], stat: 'statusResist', min: 4, max: 8, scale: 0.04, group: 'sres', desc: '+{v}% Status Resist' });
// suffixes
add('of_the_fallen', { name: 'of the Fallen', kind: 'suffix', slots: [...WEAP, ...ARMOR], stat: 'hp', min: 4, max: 9, group: 'hp', desc: '+{v} Max HP' });
add('of_ruin', { name: 'of Ruin', kind: 'suffix', slots: WEAP, stat: 'atkPct', min: 3, max: 7, scale: 0.03, rarities: EPIC_UP, group: 'atkPct', weight: 5, desc: '+{v}% Attack' });
add('of_souls', { name: 'of Souls', kind: 'suffix', slots: ['ring', 'relic', 'offHand', 'head'], stat: 'resGain', min: 4, max: 9, scale: 0.03, group: 'resg', desc: '+{v}% class resource generation' });
add('of_the_abyss', { name: 'of the Abyss', kind: 'suffix', slots: [...WEAP, 'relic'], stat: 'bossDmg', min: 4, max: 8, scale: 0.03, requires: { tag: 'abyss' }, rarities: RARE_UP, group: 'boss2', desc: '+{v}% damage to elites and bosses' });
add('of_embers', { name: 'of Embers', kind: 'suffix', slots: [...WEAP, 'hands', 'chest'], stat: 'fireDmg', min: 2, max: 4, scale: 0.1, requires: { tag: 'fire' }, group: 'fire2', desc: '+{v} fire damage on basic hits' });
add('of_the_hawk', { name: 'of the Hawk', kind: 'suffix', slots: WEAP, stat: 'accuracy', min: 4, max: 8, requires: { ranged: true }, group: 'acc', desc: '+{v} Accuracy (ranged)' });
add('of_haste', { name: 'of Haste', kind: 'suffix', slots: ['hands', 'ring', 'head'], stat: 'cdr', min: 2, max: 4, scale: 0.02, rarities: EPIC_UP, group: 'cdr', weight: 4, desc: '+{v}% skill cooldown reduction (max 20%)' });
add('of_the_vigil', { name: 'of the Vigil', kind: 'suffix', slots: ['offHand', 'legs', 'chest'], stat: 'damageReduction', min: 1, max: 3, dec: 1, scale: 0.03, rarities: RARE_UP, group: 'dr', desc: '+{v}% Damage Reduction' });
add('of_the_wolf', { name: 'of the Wolf', kind: 'suffix', slots: [...WEAP, 'hands', 'ring'], stat: 'lifeOnKill', min: 2, max: 5, scale: 0.1, group: 'lok', desc: '+{v} HP on kill (max 5% of max HP)' });
add('of_endurance', { name: 'of Endurance', kind: 'suffix', slots: ['chest', 'legs', 'offHand'], stat: 'defPct', min: 3, max: 6, scale: 0.03, rarities: RARE_UP, group: 'defPct', desc: '+{v}% Defense' });
add('of_the_plague', { name: 'of the Plague', kind: 'suffix', slots: [...WEAP, 'hands', 'offHand'], stat: 'statusDur', min: 6, max: 12, scale: 0.03, requires: { tag: 'blight' }, group: 'sdur', desc: '+{v}% duration of your status effects (not stuns)' });
add('of_the_seal', { name: 'of the Seal', kind: 'suffix', slots: ['ring', 'relic', 'head'], stat: 'resist', min: 3, max: 7, scale: 0.04, group: 'res', desc: '+{v}% Resistance' });
add('of_iron', { name: 'of Iron', kind: 'suffix', slots: ['hands', 'legs', 'head'], stat: 'def', min: 0.5, max: 1.5, dec: 1, group: 'def', desc: '+{v} Defense' });
add('of_the_lich', { name: 'of the Lich', kind: 'suffix', slots: ['head', 'chest', 'offHand', 'relic'], stat: 'skillPower', min: 4, max: 8, scale: 0.04, requires: { tag: 'curse' }, group: 'sp2', desc: '+{v}% Skill Power' });
add('of_the_ghost', { name: 'of the Ghost', kind: 'suffix', slots: ['legs', 'chest', 'hands', 'head'], stat: 'evasion', min: 2, max: 4, dec: 1, scale: 0.04, requires: { tag: 'spectral' }, group: 'eva', desc: '+{v}% Evasion' });

export const AFFIXES = Object.fromEntries(A.map((a) => [a.id, a]));
export const AFFIX_LIST = A;

// Compatibility rule (also used when restoring saved rolls): does this base allow the affix?
export function affixAllowed(a, def, weapons) {
  const r = a.requires;
  if (!r) return true;
  const w = def.weaponId ? weapons[def.weaponId] : null;
  if (r.tag && !(def.tags || []).includes(r.tag)) return false;
  if (r.ranged && !(w && w.kind === 'ranged')) return false;
  if (r.melee && !(w && w.kind === 'melee')) return false;
  if (r.twoHanded && !(w && w.twoHanded)) return false;
  return true;
}
