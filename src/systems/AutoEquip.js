import { EQUIP_SLOTS } from '../data/items.js';

// Auto-equip: puts on the best gear from the bag for the Horseman whose systems are active (g.equipment,
// g.calc - the controlled one, or a companion inside party.withActor). "Best" is measured on the real
// StatCalculator with each candidate swapped in, so set bonuses, caps and class passives count.
//  - every hotbar weapon slot (sword / axe / crossbow / dagger types) gets its best weapon; the weapon
//    in hand stays the same type as before
//  - then off-hand, head, chest, hands, legs, ring and relic
//  - items another Horseman is wearing are left alone; items the hero cannot use are skipped
// Score weights (per point of the final stat): the role of the class shifts weight between raw attack
// and skill power, so a caster Horseman values skill power the way a fighter values attack.
const WEIGHTS = { weaponDmg: 3, hp: 0.25, atk: 2, def: 1.5, crit: 1, skillPower: 0.6, critDmg: 0.2, atkSpeed: 0.6, evasion: 0.8, resist: 0.3, damageReduction: 1.2, accuracy: 0.3, armorPen: 0.5, statusResist: 0.2 };
const CASTER = { famine: 1.6, death: 1.4 }; // skill power weight multiplier for skill-driven Horsemen

export function gearScore(stats, weapon, classId) {
  let s = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) if (k !== 'weaponDmg') s += w * (k === 'skillPower' ? CASTER[classId] || 1 : 1) * (+stats[k] || 0);
  const avg = weapon ? (weapon.stats.dmgMin + weapon.stats.dmgMax) / 2 : 2;
  return s + WEIGHTS.weaponDmg * avg;
}

const usable = (g, it) => {
  const owner = g.party?.ownerOf(it.uid);
  return (!owner || owner.equipment === g.equipment) && g.equipment.canEquip(it).ok;
};

// The changes auto-equip would make, without making them: [{ item, slot, replaces, gain }].
// part: 'weapons', 'gear' or 'all' (gear is judged against the weapon in hand at the time)
export function bestLoadout(g, part = 'all') {
  const eq = g.equipment, calc = g.calc, cls = g.hero.classId, plan = [];
  const items = g.inventory.items.filter((it) => it.def.slot);
  const score = (override, weapon) => gearScore(calc.compute(override), weapon, cls);
  // weapons, one hotbar slot at a time, scored as if held
  for (let idx = 0; idx < 4 && part !== 'gear'; idx++) {
    const cur = eq.weaponSlots[idx] ? g.inventory.get(eq.weaponSlots[idx]) : null;
    const scoreW = (w) => (w ? score({ mainHand: w, ...(w.twoHanded ? { offHand: null } : {}) }, w) : -Infinity);
    let best = cur, bestS = scoreW(cur);
    for (const it of items) {
      if (it.def.kind !== 'weapon' || eq.hotbarIndexFor(it) !== idx || it === cur || !usable(g, it)) continue;
      const s = scoreW(it);
      if (s > bestS + 0.01) { best = it; bestS = s; }
    }
    if (best && best !== cur) plan.push({ item: best, slot: `weapon ${idx + 1}`, replaces: cur, gain: bestS - scoreW(cur) });
  }
  // armour, jewellery and off-hand, against the weapon in hand
  const held = eq.activeItem();
  for (const slot of part === 'weapons' ? [] : EQUIP_SLOTS) {
    if (slot === 'mainHand') continue;
    if (slot === 'offHand' && held?.twoHanded) continue;
    const cur = eq.itemIn(slot);
    let best = cur, bestS = score({ [slot]: cur || null }, held);
    for (const it of items) {
      if (it.def.slot !== slot || it === cur || !usable(g, it)) continue;
      const s = score({ [slot]: it }, held);
      if (s > bestS + 0.01) { best = it; bestS = s; }
    }
    if (best && best !== cur) plan.push({ item: best, slot, replaces: cur, gain: bestS - score({ [slot]: cur || null }, held) });
  }
  return plan;
}

// Equip the best gear now. Keeps the same hotbar weapon in hand. Returns the items put on.
// Weapons first (equipping one readies it, so the original hotbar slot is readied again after),
// then the rest against the weapon actually in hand.
export function autoEquip(g) {
  const eq = g.equipment, active = eq.active, done = [];
  for (const p of bestLoadout(g, 'weapons')) if (eq.equip(p.item.uid).ok) done.push(p);
  if (eq.active !== active && eq.weaponSlots[active]) eq.select(active);
  for (const p of bestLoadout(g, 'gear')) if (eq.equip(p.item.uid).ok) done.push(p);
  return done;
}
