import { ITEM_DEFS } from '../data/items.js';
import { MATERIAL_TIERS } from '../data/materials.js';

// MaterialInventory (the material pouch). Materials never take bag slots: they are plain counts
// per material id, clamped to each material's stack limit. Every write is validated:
//   - unknown ids are refused, counts are integers >= 0, never above the stack limit
//   - add() is all-or-nothing (a pickup that does not fit stays where it is)
//   - remove() is all-or-nothing (crafting never leaves a negative or partial payment)
const TIER_ORDER = ['legacy', 'basic', 'uncommon', 'rare', 'boss', 'endgame'];

export class MaterialInventory {
  constructor(bus) { this.bus = bus; this.counts = new Map(); }

  reset() { this.counts.clear(); }
  isMaterial(id) { return ITEM_DEFS[id]?.kind === 'material'; }
  cap(id) { return ITEM_DEFS[id]?.stack || 999; }
  count(id) { return this.counts.get(id) || 0; }
  room(id) { return Math.max(0, this.cap(id) - this.count(id)); }
  fits(id, n) { return this.isMaterial(id) && Number.isInteger(n) && n > 0 && n <= this.room(id); }

  add(id, n) {
    n = Math.floor(n);
    if (!this.fits(id, n)) return false;
    this.counts.set(id, this.count(id) + n);
    this.bus?.emit('materialsChanged', { id, delta: n });
    return true;
  }

  remove(id, n) {
    n = Math.floor(n);
    if (!this.isMaterial(id) || n <= 0 || this.count(id) < n) return false;
    const left = this.count(id) - n;
    if (left > 0) this.counts.set(id, left); else this.counts.delete(id);
    this.bus?.emit('materialsChanged', { id, delta: -n });
    return true;
  }

  // Sorted for the UI: by tier, then name.
  list() {
    return [...this.counts.entries()].filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, qty: n, def: ITEM_DEFS[id], tier: ITEM_DEFS[id].tier || 'basic' }))
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.def.name.localeCompare(b.def.name));
  }
  tierColor(id) { return MATERIAL_TIERS[ITEM_DEFS[id]?.tier || 'basic']?.color || '#b8b2a0'; }

  serialize() { return Object.fromEntries([...this.counts.entries()].filter(([, n]) => n > 0)); }

  // Returns the ids that could not be restored (unknown definitions).
  restore(obj) {
    this.counts.clear();
    const unknown = [];
    for (const [id, raw] of Object.entries(obj || {})) {
      if (!this.isMaterial(id)) { unknown.push(id); continue; }
      const n = Math.max(0, Math.min(this.cap(id), Math.floor(Number(raw) || 0)));
      if (n > 0) this.counts.set(id, n);
    }
    return unknown;
  }
}
