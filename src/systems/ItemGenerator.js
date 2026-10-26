import { ITEM_DEFS, RARITIES, RARITY_ORDER, isStackable } from '../data/items.js';
import { AFFIX_LIST, AFFIXES, affixAllowed } from '../data/affixes.js';
import { WEAPONS } from '../data/weapons.js';
import { LEGENDARY_EFFECTS } from '../data/legendaryEffects.js';
import { TEMPER } from '../data/recipes.js';
import { mulberry32, rngInt, rngWeighted, newSeed } from '../core/rng.js';

// ItemGenerator + AffixRoller.  Base Item + Item Level + Rarity + Prefix/Suffix + optional
// legendary/mythic effect = ItemInstance.  Given the same (baseId, rarity, ilvl, seed, classHint)
// the result is identical, so `seed` is stored on every item for debugging/reproduction.
// The authoritative per-item data is { baseId, rarity, ilvl, seed, affixes[{id,value}], unique, upgrade };
// mods / weapon stats / name / value are always DERIVED by recompute(), never trusted from saves.
export const MAX_ILVL = 50;
const tierOf = (r) => RARITY_ORDER.indexOf(r);

// Base (non-affix) stats of an instance, for tooltips.
export function baseStatsOf(inst) {
  const r = RARITIES[inst.rarity], up = 1 + TEMPER.statPerLevel * (inst.upgrade || 0);
  const out = {};
  for (const [k, [b, per]] of Object.entries(inst.def.base || {})) out[k] = round((b + per * inst.ilvl) * r.statMult * up, 1);
  return out;
}

export function affixRange(a, ilvl) {
  const s = 1 + a.scale * (ilvl - 1);
  return [a.min * s, a.max * s];
}
const round = (v, dec) => +v.toFixed(dec);

export class ItemGenerator {
  constructor() { this.nextUid = 1; }
  reset() { this.nextUid = 1; }

  generate({ baseId, rarity = 'common', ilvl = 1, qty = 1, seed = newSeed(), classHint = null, uid = null, affixes = null, unique, upgrade = 0 }) {
    const def = ITEM_DEFS[baseId];
    if (!def) return null;
    ilvl = Math.max(1, Math.min(MAX_ILVL, Math.round(ilvl)));
    rarity = RARITIES[rarity] ? rarity : 'common';
    if (isStackable(def)) rarity = 'common';
    else if (def.uniqueOnly === 'mythic') rarity = 'mythic';
    else if (def.uniqueOnly === 'legendary') rarity = 'legendary';               // curated Legendaries
    else if (rarity === 'mythic') rarity = 'legendary';          // Mythic requires a mythic base
    else if (def.uniqueOnly === 'set' && tierOf(rarity) < tierOf('epic')) rarity = 'epic';
    if (def.rarities && !def.rarities.includes(rarity)) rarity = [...def.rarities].sort((a, b) => tierOf(b) - tierOf(a)).find((r) => tierOf(r) <= tierOf(rarity)) || def.rarities[0];
    const rng = mulberry32(seed >>> 0);
    if (uid !== null) this.nextUid = Math.max(this.nextUid, uid + 1);
    const inst = {
      uid: uid ?? this.nextUid++, baseId, defId: baseId, def, rarity, ilvl, qty, seed: seed >>> 0, classHint,
      upgrade: Math.max(0, Math.min(TEMPER.maxLevel, upgrade | 0)), affixes: [], unique: def.unique || null, setId: def.setId || null, classes: def.classes || null,
    };
    if (!isStackable(def) && def.slot) {
      inst.affixes = affixes ? this.validateAffixes(affixes, def, rarity, ilvl) : this.rollAffixes(rng, def, rarity, ilvl, classHint);
      if (!def.unique) {
        if (unique !== undefined) inst.unique = unique && LEGENDARY_EFFECTS[unique]?.pool ? unique : null;
        else if (RARITIES[rarity].legendaryEffect) inst.unique = this.rollLegendaryEffect(rng, def);
      }
    }
    this.recompute(inst);
    return inst;
  }

  // Class-synergy affixes roll only on items restricted to that class, or (on generic items)
  // when the drop is generated for a player of that class — then they show "(CLASS)" in tooltips.
  classOk(a, def, classHint) {
    if (!a.cls) return true;
    if (def.classes) return def.classes.includes(a.cls);
    return classHint === a.cls;
  }

  eligibleAffixes(def, rarity, ilvl, classHint) {
    return AFFIX_LIST.filter((a) => a.slots.includes(def.slot) && ilvl >= a.minIlvl && ilvl <= a.maxIlvl && a.rarities.includes(rarity) && this.classOk(a, def, classHint) && affixAllowed(a, def, WEAPONS));
  }

  rollAffixes(rng, def, rarity, ilvl, classHint) {
    const [lo, hi] = RARITIES[rarity].affixes;
    const count = rngInt(rng, lo, hi);
    const pool = this.eligibleAffixes(def, rarity, ilvl, classHint);
    const out = [], groups = new Set();
    let pre = 0, suf = 0;
    for (let i = 0; i < count; i++) {
      const cands = pool.filter((a) => !groups.has(a.group) && (a.kind === 'prefix' ? pre < 2 : suf < 2));
      if (!cands.length) break;
      const a = rngWeighted(rng, cands.map((c) => ({ value: c, weight: c.weight })));
      groups.add(a.group);
      if (a.kind === 'prefix') pre++; else suf++;
      out.push({ id: a.id, value: this.rollValue(rng, a, rarity, ilvl) });
    }
    return out;
  }

  rollValue(rng, a, rarity, ilvl) {
    const [lo, hi] = affixRange(a, ilvl);
    const [r0, r1] = RARITIES[rarity].roll;
    const t = r0 + rng() * (r1 - r0);
    return Math.min(round(hi, a.dec), Math.max(round(lo, a.dec), round(lo + (hi - lo) * t, a.dec)));
  }

  // Restored rolls: unknown affixes are dropped, values clamped into their legal range, no duplicate groups.
  validateAffixes(list, def, rarity, ilvl) {
    const out = [], groups = new Set();
    for (const s of list || []) {
      const a = AFFIXES[s.id];
      if (!a || !a.slots.includes(def.slot) || groups.has(a.group) || !affixAllowed(a, def, WEAPONS)) continue;
      groups.add(a.group);
      const [lo, hi] = affixRange(a, ilvl);
      out.push({ id: a.id, value: Math.min(round(hi, a.dec), Math.max(round(lo, a.dec), +s.value || 0)) });
    }
    return out;
  }

  rollLegendaryEffect(rng, def) {
    const pool = Object.entries(LEGENDARY_EFFECTS).filter(([, e]) => e.pool === 'legendary' && e.slots.includes(def.slot));
    if (!pool.length) return null;
    return pool[Math.floor(rng() * pool.length)][0];
  }

  // Derive every computed field from the authoritative data.
  recompute(inst) {
    const def = inst.def, r = RARITIES[inst.rarity];
    const up = 1 + TEMPER.statPerLevel * (inst.upgrade || 0);
    const mods = {};
    for (const [k, [b, per]] of Object.entries(def.base || {})) mods[k] = round((b + per * inst.ilvl) * r.statMult * up, 1);
    for (const af of inst.affixes) {
      const a = AFFIXES[af.id];
      mods[a.stat] = round((mods[a.stat] || 0) + af.value, 1);
    }
    inst.mods = mods;
    inst.stats = {};
    if (def.kind === 'weapon') {
      const w = WEAPONS[def.weaponId];
      const mult = (def.dmgMult || 1) * (1 + 0.08 * (inst.ilvl - 1)) * r.statMult * up;
      inst.stats = { dmgMin: Math.max(1, Math.round(w.dmg[0] * mult)), dmgMax: Math.max(1, Math.round(w.dmg[1] * mult)), crit: +(w.crit + (def.critAdd || 0)).toFixed(2), cooldown: w.cooldown, range: w.range };
      inst.twoHanded = !!w.twoHanded;
    }
    if (def.heal) inst.stats.heal = def.heal;
    inst.reqLevel = isStackable(def) ? 1 : Math.max(1, inst.ilvl - (def.uniqueOnly ? 1 : 2));
    inst.name = this.nameFor(inst);
    inst.value = Math.round((def.value || 10) * r.valueMult * (1 + 0.15 * (inst.ilvl - 1)) * up);
    return inst;
  }

  // Names only ever use affixes the item actually has, so the name always matches its effects.
  nameFor(inst) {
    const def = inst.def;
    if (def.uniqueOnly || isStackable(def)) return def.name; // uniques/sets/materials keep their fixed names
    const pre = inst.affixes.find((a) => AFFIXES[a.id].kind === 'prefix');
    const suf = inst.affixes.find((a) => AFFIXES[a.id].kind === 'suffix');
    // '<Prefix> <Base> <Suffix>' for every base (Phase 3 contract). Catalog base names already carry
    // their tier ('Hellforged War Hammer'), so names describe the item's real properties.
    const core = `${pre ? AFFIXES[pre.id].name + ' ' : ''}${def.name}`;
    return `${core}${suf ? ' ' + AFFIXES[suf.id].name : ''}`;
  }
}
