import { STAT_LABELS, ATTRS, ATTR_LABELS } from '../data/formulas.js';

// ItemComparison: deltas come from running the real StatCalculator with the candidate swapped in,
// so a green number always means the final statistic actually improves (caps included).
// All listed stats are "higher is better".
export function compareItem(g, item) {
  const slot = item?.def?.slot;
  if (!slot) return null;
  const eq = g.equipment;
  const current = slot === 'mainHand' ? eq.activeItem() : eq.itemIn(slot);
  if (current && current.uid === item.uid) return { slot, current, same: true, deltas: [] };
  const override = { [slot]: item };
  if (slot === 'mainHand' && item.twoHanded && eq.slots.offHand) override.offHand = null; // 2H stows the off-hand
  const before = g.calc.get();
  const after = g.calc.compute(override);
  const deltas = [];
  const push = (key, label, a, b, suffix = '') => {
    const diff = +(b - a).toFixed(1);
    if (Math.abs(diff) >= 0.05) deltas.push({ key, label, before: a, after: b, diff, better: diff > 0, suffix });
  };
  if (slot === 'mainHand') {
    const avg = (it) => (it ? (it.stats.dmgMin + it.stats.dmgMax) / 2 : 2);
    push('weaponDmg', 'WEAPON DMG (AVG)', avg(current), avg(item));
  }
  for (const [k, label, suf] of STAT_LABELS) push(k, label, before[k], after[k], suf || '');
  for (const a of ATTRS) push(a, ATTR_LABELS[a], before.attrs[a], after.attrs[a]);
  for (const k of ['markedDmg', 'markedCrit', 'areaDmg', 'dotDmg', 'drainPower', 'witherStacks', 'executeDmg', 'curseDmg']) {
    if (before[k] !== after[k]) push(k, k.replace(/([A-Z])/g, ' $1').toUpperCase(), before[k], after[k], '%');
  }
  if (override.offHand === null && eq.slots.offHand) deltas.push({ key: 'offhand', label: 'OFF-HAND STOWED (2H)', diff: 0, better: false, note: true });
  return { slot, current, deltas, blocked: !eq.canEquip(item).ok ? eq.canEquip(item).msg : null };
}

// Simple build-agnostic score (used by the test bot to decide auto-equips; not shown to players).
export function upgradeScore(cmp) {
  if (!cmp || cmp.same || cmp.blocked) return -Infinity;
  const w = { weaponDmg: 3, hp: 0.25, atk: 2, def: 1.5, crit: 1, skillPower: 0.6, critDmg: 0.2, atkSpeed: 0.6, evasion: 0.8, resist: 0.3, damageReduction: 1.2, accuracy: 0.3 };
  return cmp.deltas.reduce((s, d) => s + (w[d.key] || 0.05) * (d.diff || 0), 0);
}
