import { FORMULAS, ATTRS } from '../data/formulas.js';
import { EQUIP_SLOTS } from '../data/items.js';
import { setBonusesFor } from './SetBonusManager.js';
import { passiveStatsFor } from './LegendaryEffects.js';

// AttributeSystem + DerivedStatCalculator. Layers, in order:
//   1. class base stats + per-level growth          (Horseman data)
//   2. primary attributes (STR..LCK) incl. growth    -> attribute bonuses
//   3. equipment: item base stats, affixes, temper   (flat and % kept separate)
//   4. set bonuses + legendary passive stats
// Temporary combat buffs (Blood Rush etc.) stay in StatusEffectManager and are applied at hit time.
// Results are cached per (class, level, equipment version) and are never written back into items.
const F = FORMULAS;
const cap = (v, c) => Math.min(c, Math.max(0, v));

export class StatCalculator {
  constructor(game) { this.game = game; this.cacheKey = null; this.cache = null; }

  invalidate() { this.cacheKey = null; }

  // Equipped items, optionally with some slots replaced (for comparisons). Only the ACTIVE
  // main-hand weapon counts; readied hotbar weapons give no stats.
  equippedItems(override = null) {
    const g = this.game, eq = g.equipment;
    const out = [];
    for (const slot of EQUIP_SLOTS) {
      let item = override && slot in override ? override[slot] : (eq.slots[slot] ? g.inventory.get(eq.slots[slot]) : null);
      if (item) out.push(item);
    }
    return out;
  }

  get() {
    const g = this.game;
    const key = `${g.hero.classId}|${g.hero.level}|${g.equipment.version}`;
    if (key !== this.cacheKey) { this.cache = this.compute(); this.cacheKey = key; }
    return this.cache;
  }

  compute(override = null, level = this.game.hero.level) {
    const g = this.game, d = g.hero.def, L = level;
    const items = this.equippedItems(override);
    const add = {};
    const sum = (stats) => { for (const [k, v] of Object.entries(stats || {})) add[k] = (add[k] || 0) + v; };
    for (const it of items) sum(it.mods);
    const sets = setBonusesFor(items);
    for (const s of sets) for (const b of s.active) sum(b.stats);
    sum(passiveStatsFor(items, g.hero.classId));
    const a = (k) => add[k] || 0;

    const attrs = {}, bonus = {};
    for (const k of ATTRS) {
      const base = d.attributes[k] + (d.attrGrowth[k] || 0) * (L - 1);
      attrs[k] = +(base + a(k)).toFixed(1);
      bonus[k] = attrs[k] - d.attributes[k]; // only gains above the innate value add derived stats
    }
    const s = {
      attrs, attrBonus: bonus, add, sets, items,
      hp: Math.round((d.base.hp + (d.growth.hp || 0) * (L - 1) + bonus.vit * F.hp.perVit + a('hp')) * (1 + a('hpPct') / 100)),
      atk: +((d.base.atk + bonus.str * F.atk.perStr + bonus.dex * F.atk.perDex + a('atk')) * (1 + a('atkPct') / 100)).toFixed(1),
      def: +((d.base.def + bonus.vit * F.def.perVit + a('def')) * (1 + a('defPct') / 100)).toFixed(1),
      skillPower: +(bonus.int * F.skillPower.perInt + a('skillPower')).toFixed(1),
      resist: cap(bonus.wis * F.resist.perWis + a('resist'), F.resist.cap),
      accuracy: Math.min(F.accuracy.max, Math.max(F.accuracy.min, F.accuracy.base + bonus.dex * F.accuracy.perDex + a('accuracy'))),
      crit: cap(d.base.crit + bonus.dex * F.crit.perDex + bonus.lck * F.crit.perLck + a('crit'), F.crit.cap),
      critDmg: cap(a('critDmg'), F.critDmg.cap),
      atkSpeed: cap(bonus.dex * F.atkSpeed.perDex + a('atkSpeed'), F.atkSpeed.cap),
      evasion: cap(a('evasion'), F.evasion.cap),
      armorPen: +(Math.max(0, bonus.str * F.armorPen.perStr + a('armorPen'))).toFixed(1),
      statusResist: cap(bonus.wis * F.statusResist.perWis + a('statusResist'), F.statusResist.cap),
      resEff: cap(bonus.wis * F.resEff.perWis + a('resEff'), F.resEff.cap),
      resGain: cap(a('resGain'), F.resGain.cap),
      resRegen: cap(bonus.wis * F.resRegen.perWis + a('resRegen'), F.resRegen.cap),
      moveSpeed: cap(a('moveSpeed'), F.moveSpeed.cap),
      damageReduction: cap(a('damageReduction'), F.damageReduction.cap),
      lootLuck: cap(attrs.lck * F.lootLuck.perLck + a('lootLuck'), F.lootLuck.cap),
      rangedBonus: Math.max(0, bonus.dex * F.rangedBonus.perDex),
      heavyBonus: Math.max(0, bonus.str * F.heavyBonus.perStr),
      markedDmg: cap(a('markedDmg'), F.markedDmg.cap),
      markedCrit: cap(a('markedCrit'), F.markedCrit.cap),
      areaDmg: cap(a('areaDmg'), F.areaDmg.cap),
      dotDmg: cap(a('dotDmg'), F.dotDmg.cap),
      drainPower: cap(a('drainPower'), F.drainPower.cap),
      witherStacks: Math.floor(cap(a('witherStacks'), F.witherStacks.cap)),
      executeDmg: cap(a('executeDmg'), F.executeDmg.cap),
      curseDmg: cap(a('curseDmg'), F.curseDmg.cap),
      rangedDmg: cap(a('rangedDmg'), F.rangedDmg.cap),
      fireDmg: cap(a('fireDmg'), F.fireDmg.cap),
      bossDmg: cap(a('bossDmg'), F.bossDmg.cap),
      cdr: cap(a('cdr'), F.cdr.cap),
      statusDur: cap(a('statusDur'), F.statusDur.cap),
      lifeOnKill: cap(a('lifeOnKill'), F.lifeOnKill.cap),
    };
    for (const k of ['resist', 'crit', 'critDmg', 'atkSpeed', 'evasion', 'statusResist', 'resEff', 'resGain', 'resRegen', 'moveSpeed', 'damageReduction', 'lootLuck', 'accuracy']) s[k] = +s[k].toFixed(1);
    s.blowReduction = +(s.def * F.def.reduction).toFixed(2);
    s.moveRepeat = Math.max(0.12, d.moveRepeat * (1 - s.moveSpeed / 100));
    return s;
  }
}
