import { SETS } from '../data/sets.js';

// SetBonusManager: pure function of the equipped item list, so bonuses always match the
// current equipment (recalculated on every change). A set counts DISTINCT slots, so the same
// item (or two copies of one piece) can never double-activate a threshold.
export function setBonusesFor(items) {
  const bySet = new Map();
  for (const it of items) {
    if (!it?.setId || !SETS[it.setId]) continue;
    if (!bySet.has(it.setId)) bySet.set(it.setId, new Set());
    bySet.get(it.setId).add(it.def.slot);
  }
  const out = [];
  for (const [id, slots] of bySet) {
    const set = SETS[id];
    const count = slots.size;
    out.push({ set, count, active: set.bonuses.filter((b) => count >= b.count), inactive: set.bonuses.filter((b) => count < b.count) });
  }
  return out;
}
