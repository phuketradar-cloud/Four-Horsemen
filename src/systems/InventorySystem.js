import { RARITY_ORDER, isStackable } from '../data/items.js';
import { MaterialInventory } from './MaterialInventory.js';

// InventoryManager: one list of item instances; equipment references items here by uid.
// Bag capacity counts only UNEQUIPPED items. Stacking: only stackable defs (consumables)
// with the same base + rarity may merge — equipment instances never stack, so items with
// different affixes can never merge.
// Phase 4: materials go to the material pouch (this.materials) instead of bag slots. The bag API
// (fits / add / countOf / consumeDef) routes material ids there, so older callers keep working.
export class InventorySystem {
  constructor(bus, capacity = 40) { this.bus = bus; this.capacity = capacity; this.items = []; this.isEquipped = () => false; this.materials = new MaterialInventory(bus); }

  reset() { this.items = []; this.materials.reset(); }

  isMaterial(item) { return item?.def?.kind === 'material'; }
  get(uid) { return this.items.find((i) => i.uid === uid) || null; }
  has(uid) { return this.items.some((i) => i.uid === uid); }
  countOf(defId) {
    if (this.materials.isMaterial(defId)) return this.materials.count(defId);
    return this.items.filter((i) => i.defId === defId).reduce((s, i) => s + i.qty, 0);
  }
  findFirst(defId) { return this.items.find((i) => i.defId === defId) || null; }
  get bagItems() { return this.items.filter((i) => !this.isEquipped(i.uid)); }
  get bagCount() { return this.bagItems.length; }
  get bagFree() { return this.capacity - this.bagCount; }
  get full() { return this.bagFree <= 0; }

  canStack(a, b) { return isStackable(a.def) && a.defId === b.defId && a.rarity === b.rarity && !(a.affixes?.length) && !(b.affixes?.length); }

  // Would `item` fit (merging into stacks first; materials: pouch room)?
  fits(item) {
    if (this.isMaterial(item)) return this.materials.fits(item.defId, item.qty);
    if (isStackable(item.def)) {
      let room = 0;
      for (const s of this.items) if (this.canStack(s, item)) room += (item.def.stack || 1) - s.qty;
      if (room >= item.qty) return true;
    }
    return !this.full;
  }

  // Returns { ok, stacked?, reason? }.
  add(item) {
    if (!item) return { ok: false, reason: 'invalid' };
    if (this.isMaterial(item)) {
      if (!this.materials.add(item.defId, item.qty)) return { ok: false, reason: 'pouch full' };
      this.bus.emit('inventoryChanged');
      return { ok: true, stacked: true, material: true };
    }
    if (this.has(item.uid)) return { ok: false, reason: 'duplicate' }; // never insert the same instance twice
    const max = item.def.stack || 1;
    if (max > 1) {
      let remaining = item.qty;
      for (const s of this.items) {
        if (remaining <= 0) break;
        if (this.canStack(s, item) && s.qty < max) {
          const take = Math.min(max - s.qty, remaining);
          s.qty += take; remaining -= take;
        }
      }
      if (remaining <= 0) { this.bus.emit('inventoryChanged'); return { ok: true, stacked: true }; }
      item.qty = remaining;
    }
    if (this.full) return { ok: false, reason: 'full' };
    this.items.push(item);
    this.bus.emit('inventoryChanged');
    return { ok: true };
  }

  // Consume qty from a stack; removes the instance when empty. Never goes negative.
  consume(uid, qty = 1) {
    const it = this.get(uid);
    if (!it || qty <= 0 || it.qty < qty) return false;
    it.qty -= qty;
    if (it.qty <= 0) this.items = this.items.filter((i) => i.uid !== uid);
    this.bus.emit('inventoryChanged');
    return true;
  }

  // Remove `qty` of a material/consumable across stacks. All-or-nothing.
  consumeDef(defId, qty) {
    if (qty <= 0) return true;
    if (this.materials.isMaterial(defId)) return this.materials.remove(defId, qty);
    if (this.countOf(defId) < qty) return false;
    let left = qty;
    for (const it of [...this.items].filter((i) => i.defId === defId).sort((a, b) => a.qty - b.qty)) {
      const take = Math.min(left, it.qty);
      this.consume(it.uid, take);
      left -= take;
      if (left <= 0) break;
    }
    return true;
  }

  // Remove a whole instance (dismantle / sell). Equipped items must be unequipped first.
  remove(uid) {
    const it = this.get(uid);
    if (!it || this.isEquipped(uid)) return null;
    this.items = this.items.filter((i) => i.uid !== uid);
    this.bus.emit('inventoryChanged');
    return it;
  }

  // Sorted / filtered view of BAG items (UI only — never reorders authoritative data).
  view({ sort = 'rarity', slot = 'all', rarity = 'any' } = {}) {
    let list = this.bagItems;
    if (slot === 'material') list = list.filter((i) => i.def.kind === 'material' || i.def.kind === 'consumable');
    else if (slot !== 'all') list = list.filter((i) => i.def.slot === slot);
    if (rarity !== 'any') list = list.filter((i) => i.rarity === rarity);
    const kindOrder = { weapon: 0, armor: 1, offhand: 2, ring: 3, relic: 4, consumable: 5, material: 6 };
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      rarity: (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl,
      type: (a, b) => (kindOrder[a.def.kind] ?? 9) - (kindOrder[b.def.kind] ?? 9) || a.name.localeCompare(b.name),
      ilvl: (a, b) => b.ilvl - a.ilvl || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
      value: (a, b) => b.value * b.qty - a.value * a.qty,
    }[sort] || (() => 0);
    return [...list].sort((a, b) => cmp(a, b) || a.uid - b.uid);
  }
}
