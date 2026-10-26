import { WEAPONS } from '../data/weapons.js';
import { EQUIP_SLOTS, EQUIP_LABELS } from '../data/items.js';
import { HORSEMEN } from '../data/characters.js';

export { EQUIP_SLOTS, EQUIP_LABELS };

// EquipmentManager: exactly eight slots (head, chest, hands, legs, mainHand, offHand, ring, relic)
// plus the Phase 1 weapon hotbar (1-4). The hotbar holds readied weapons; Main Hand mirrors the
// active one and only it contributes stats. Slots reference item uids; equipped items stay in
// the inventory list but don't use bag space. Every change bumps `version` so the
// StatCalculator recalculates.
export class EquipmentSystem {
  constructor(bus, inventory) { this.bus = bus; this.inv = inventory; this.game = null; this.version = 0; this.reset(); }

  reset() {
    this.slots = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null]));
    this.weaponSlots = [null, null, null, null]; // hotbar 1-4 (sword, axe, crossbow, dagger)
    this.active = 0;
    this._changed();
  }

  _changed(item = null) {
    this.version++;
    if (this.game) { this.game.hero.calc?.invalidate(); this.game.hero.clampHp?.(); }
    this.bus.emit('equipmentChanged', { item });
  }

  isEquipped(uid) { return uid != null && (this.weaponSlots.includes(uid) || Object.values(this.slots).includes(uid)); }
  hotbarIndexFor(item) { return WEAPONS[item.def.weaponId].slot - 1; }
  activeItem() { const uid = this.weaponSlots[this.active]; return uid ? this.inv.get(uid) : null; }
  itemIn(slot) { const uid = this.slots[slot]; return uid ? this.inv.get(uid) : null; }
  slotOf(uid) { return EQUIP_SLOTS.find((s) => this.slots[s] === uid) || (this.weaponSlots.includes(uid) ? 'mainHand' : null); }
  get offHandBlocked() { const w = this.activeItem(); return !!(w && w.twoHanded); }

  // Requirement / compatibility check without changing anything.
  canEquip(item) {
    if (!item) return { ok: false, msg: 'Item not found.' };
    if (!item.def.slot) return { ok: false, msg: 'That cannot be equipped.' };
    const hero = this.game?.hero;
    if (hero) {
      if (item.classes && !item.classes.includes(hero.classId)) return { ok: false, msg: `Only ${item.classes.map((c) => HORSEMEN[c].name).join(' / ')} can use ${item.name}.` };
      if (hero.level < (item.reqLevel || 1)) return { ok: false, msg: `${item.name} requires level ${item.reqLevel}.` };
    }
    if (item.def.slot === 'offHand' && this.offHandBlocked) return { ok: false, msg: 'Your two-handed weapon leaves no hand free for an off-hand item.' };
    return { ok: true };
  }

  equip(uid) {
    const item = this.inv.get(uid);
    const can = this.canEquip(item);
    if (!can.ok) return can;
    const slot = item.def.slot;
    if (item.def.kind === 'weapon') {
      const idx = this.hotbarIndexFor(item);
      if (this.weaponSlots[idx] === uid) {
        if (this.active === idx) return { ok: false, msg: `${item.name} is already equipped.` };
        return this.select(idx) ? { ok: true, msg: `You ready the ${item.name} [${idx + 1}].` } : { ok: false, msg: this.lastMsg };
      }
      // making a two-handed weapon active pushes the off-hand item back into the bag
      if (item.twoHanded && this.slots.offHand) {
        if (this.inv.bagFree < 1) return { ok: false, msg: 'Inventory full: no room to stow your off-hand item for a two-handed weapon.' };
        this.slots.offHand = null;
        this.game?.log('Off-hand item stowed: two-handed weapon equipped.', '#c8b070');
      }
      this.weaponSlots[idx] = uid; // the previous weapon in this hotbar slot returns to the bag
      this.active = idx;
      this._sync();
      this._changed(item);
      return { ok: true, msg: `Equipped ${item.name} [${idx + 1}].` };
    }
    if (this.slots[slot] === uid) return { ok: false, msg: `${item.name} is already equipped.` };
    this.slots[slot] = uid; // previous item (if any) returns to the bag; net bag use is zero
    this._changed(item);
    return { ok: true, msg: `Equipped ${item.name}.` };
  }

  // beingDestroyed: the item is about to be dismantled/sold, so it needs no bag space.
  unequip(uid, beingDestroyed = false) {
    const item = this.inv.get(uid);
    if (!this.isEquipped(uid)) return { ok: false, msg: 'Not equipped.' };
    if (!beingDestroyed && this.inv.bagFree < 1) return { ok: false, msg: 'Inventory full: make room before unequipping.' };
    const idx = this.weaponSlots.indexOf(uid);
    if (idx >= 0) {
      this.weaponSlots[idx] = null;
      if (this.active === idx) {
        const next = this.weaponSlots.findIndex((u) => u !== null);
        this.active = next >= 0 ? next : idx; // empty slot => bare hands
      }
      this._sync();
    } else {
      for (const s of EQUIP_SLOTS) if (this.slots[s] === uid) this.slots[s] = null;
    }
    this._changed(item);
    return { ok: true, msg: `Unequipped ${item ? item.name : 'item'}.` };
  }

  // Ready a hotbar weapon. Two-handed weapons need the off hand free (stowed if there's room).
  select(idx) {
    if (idx < 0 || idx > 3 || !this.weaponSlots[idx]) { this.lastMsg = `No weapon in slot ${idx + 1}.`; return false; }
    const item = this.inv.get(this.weaponSlots[idx]);
    if (item?.twoHanded && this.slots.offHand) {
      if (this.inv.bagFree < 1) { this.lastMsg = 'Inventory full: cannot stow your off-hand for a two-handed weapon.'; return false; }
      this.slots.offHand = null;
      this.game?.log('Off-hand item stowed: two-handed weapon readied.', '#c8b070');
    }
    this.active = idx;
    this._sync();
    this._changed(item);
    return true;
  }

  cycle(step = 1) {
    for (let i = 1; i <= 4; i++) {
      const idx = (this.active + step * i + 8) % 4;
      if (this.weaponSlots[idx]) return this.select(idx);
    }
    return false;
  }

  _sync() { this.slots.mainHand = this.weaponSlots[this.active] || null; }

  // After loading: drop references to missing items and anything this hero may not wear.
  validate() {
    const issues = [];
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      const uid = this.weaponSlots[i];
      const it = uid ? this.inv.get(uid) : null;
      if (uid && (!it || it.def.kind !== 'weapon' || seen.has(uid) || !this.canEquip(it).ok)) { this.weaponSlots[i] = null; issues.push(it ? it.name : `#${uid}`); }
      else if (uid) seen.add(uid);
    }
    for (const s of EQUIP_SLOTS) {
      if (s === 'mainHand') continue;
      const uid = this.slots[s];
      const it = uid ? this.inv.get(uid) : null;
      if (uid && (!it || it.def.slot !== s || seen.has(uid) || !this.canEquip(it).ok)) { this.slots[s] = null; issues.push(it ? it.name : `#${uid}`); }
      else if (uid) seen.add(uid);
    }
    if (!this.weaponSlots[this.active]) { const n = this.weaponSlots.findIndex((u) => u); this.active = n >= 0 ? n : 0; }
    if (this.offHandBlocked && this.slots.offHand) { this.slots.offHand = null; issues.push('off-hand (two-handed weapon)'); }
    this._sync();
    this._changed();
    return issues;
  }

  serialize() { return { slots: { ...this.slots }, weaponSlots: [...this.weaponSlots], active: this.active }; }
  restore(s) {
    const legacy = { helmet: 'head', gloves: 'hands', boots: 'legs' }; // Phase 1/2 slot names
    this.reset();
    for (const [k, v] of Object.entries(s.slots || {})) { const slot = legacy[k] || k; if (slot in this.slots) this.slots[slot] = v; }
    this.weaponSlots = [...(s.weaponSlots || [null, null, null, null])].slice(0, 4);
    this.active = s.active | 0;
    this._sync();
    this._changed();
  }
}
