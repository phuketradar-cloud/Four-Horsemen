import { RECIPES, TEMPER, DISMANTLE, SELL_MULT, REFORGE, dismantleBand } from '../data/recipes.js';
import { ITEM_DEFS, isStackable } from '../data/items.js';
import { DUNGEONS } from '../data/dungeons/index.js';
import { mulberry32, newSeed } from '../core/rng.js';

// CraftingManager + EquipmentEnhancementManager + DismantlingManager + selling.
// Every operation validates EVERYTHING first and only then mutates (all-or-nothing): materials are
// deducted only after the craft is confirmed valid, the output is granted exactly once, a full bag
// blocks the craft with an explanation (nothing is consumed), counts never go negative.
export class CraftingSystem {
  constructor(game) { this.game = game; }

  get inv() { return this.game.inventory; }
  get progress() { return this.game.progress; }
  get atForge() { return this.game.scene === 'camp'; }

  // ------------------------------------------------------------------ costs
  missing(mats = {}, gold = 0) {
    const out = [];
    for (const [id, n] of Object.entries(mats)) { const have = this.inv.countOf(id); if (have < n) out.push(`${ITEM_DEFS[id].name} ${have}/${n}`); }
    if (this.game.gold < gold) out.push(`Gold ${this.game.gold}/${gold}`);
    return out;
  }
  _pay(mats, gold) {
    for (const [id, n] of Object.entries(mats)) if (!this.inv.consumeDef(id, n)) throw new Error(`payment failed for ${id}`); // validated before: never happens
    this.game.gold -= gold;
  }

  // ------------------------------------------------------------------ recipe unlocks
  recipe(id) { return RECIPES.find((r) => r.id === id); }
  isUnlocked(r) {
    if (!r) return false;
    const u = r.unlock, p = this.progress;
    if (!u || !p) return !u;
    if (p.recipes.has(r.id || r.recipe)) return true;
    if (u.boss) return (p.bosses[u.boss] || 0) > 0;
    if (u.completed) return p.timesCompleted(u.completed) > 0;
    if (u.unlocked) return p.isUnlocked(u.unlocked);
    if (u.alt) return p.timesCompleted(u.alt[0], u.alt[1]) > 0;
    return false;
  }
  unlockText(r) {
    const u = r.unlock;
    if (!u) return '';
    const dn = (id) => DUNGEONS[id]?.name || id;
    if (u.boss) return `Defeat ${u.boss.replace(/_/g, ' ').toUpperCase()} to learn this recipe.`;
    if (u.completed) return `Complete ${dn(u.completed)} to learn this recipe.`;
    if (u.unlocked) return `Reach ${dn(u.unlocked)} to learn this recipe.`;
    if (u.secret) return `A scroll hidden in a secret room of ${dn(u.secret)} teaches this${u.alt ? ` (or clear it on ${u.alt[1].toUpperCase()})` : ''}.`;
    return 'Locked.';
  }
  unlockRecipe(id) {
    if (!this.progress || this.progress.recipes.has(id)) return false;
    this.progress.recipes.add(id);
    return true;
  }

  // Full validation with every reason it can't be crafted (UI shows them; craft() refuses on any).
  check(r) {
    if (!r) return { ok: false, reasons: ['Unknown recipe.'] };
    const reasons = [];
    if (!this.isUnlocked(r)) reasons.push(this.unlockText(r) || 'Locked.');
    if (r.level && this.game.hero.level < r.level) reasons.push(`Requires level ${r.level}.`);
    if (r.station === 'forge' && !this.atForge) reasons.push('Requires the camp forge.');
    const miss = this.missing(r.cost, r.gold);
    if (miss.length) reasons.push(`Missing: ${miss.join(', ')}.`);
    return { ok: reasons.length === 0, reasons };
  }

  _output(r) {
    const g = this.game, level = Math.max(1, g.hero.level);
    if (r.out.item) {
      const d = ITEM_DEFS[r.out.item];
      const ilvl = isStackable(d) ? 1 : Math.max(r.out.ilvl || 1, level);
      return g.loot.create(r.out.item, r.out.rarity || 'common', r.out.qty || 1, null, { ilvl });
    }
    if (r.out.setPiece) return g.loot.setPiece(r.out.setPiece, level);
    if (r.out.equipment) return g.loot.rollEquipment('crafted', level);
    if (r.out.relic) return g.loot.rollRelic('crafted', level);
    return null;
  }

  // Phase 6: every craft attempt reports its outcome on the bus (notifications + sounds + autosave).
  craft(id) {
    const res = this._craft(id);
    if (!res.ok) this.game.bus.emit('craftFailed', { recipe: id, msg: res.msg });
    return res;
  }

  _craft(id) {
    const g = this.game;
    const r = this.recipe(id);
    if (!r) return { ok: false, msg: 'Unknown recipe.' };
    const chk = this.check(r);
    if (!chk.ok) return { ok: false, msg: chk.reasons[chk.reasons.length - 1].startsWith('Missing') && chk.reasons.length === 1 ? chk.reasons[0] : chk.reasons.join(' ') };
    const item = this._output(r);
    if (!item) return { ok: false, msg: 'The forge sputters.' };
    if (!this.inv.fits(item)) return { ok: false, msg: item.def.kind === 'material' ? 'Material pouch full for that material.' : 'Inventory full: make room before crafting. Nothing was used.' }; // checked BEFORE paying
    this._pay(r.cost, r.gold || 0);
    const res = this.inv.add(item);
    if (!res.ok) { g.giveItem(item); } // unreachable after fits(); kept so an output can never be destroyed
    g.stats.crafted = (g.stats.crafted || 0) + 1;
    g.bus.emit('crafted', { recipe: r.id, item });
    return { ok: true, item, msg: `Crafted ${item.name}${item.qty > 1 ? ' x' + item.qty : ''}.` };
  }

  // ------------------------------------------------------------------ dismantle
  dismantleYield(item) {
    const out = {};
    for (const [id, [base, per]] of Object.entries(DISMANTLE[item.rarity] || {})) {
      const n = base + Math.floor(item.ilvl * per);
      if (n > 0) out[id] = n;
    }
    return dismantleBand(out, item.ilvl || 1);
  }

  // confirm: required for equipped / Legendary / Mythic items (the UI asks first).
  needsConfirm(item) {
    if (!item) return null;
    if (this.game.equipment.isEquipped(item.uid)) return `${item.name} is equipped. Unequip and destroy it?`;
    if (item.rarity === 'legendary' || item.rarity === 'mythic') return `${item.name} is ${item.rarity.toUpperCase()}. Really destroy it?`;
    return null;
  }

  dismantle(uid, confirmed = false) {
    const g = this.game;
    const item = this.inv.get(uid);
    if (!item) return { ok: false, msg: 'That item is gone.' };
    if (isStackable(item.def)) return { ok: false, msg: 'Only equipment can be dismantled.' };
    if (this.needsConfirm(item) && !confirmed) return { ok: false, confirm: this.needsConfirm(item) };
    if (g.equipment.isEquipped(uid)) {
      const r = g.equipment.unequip(uid, true); // destroyed right after: needs no bag space
      if (!r.ok) return r;
    }
    const removed = this.inv.remove(uid); // the single point where the item is consumed
    if (!removed) return { ok: false, msg: 'That item is gone.' };
    const yields = this.dismantleYield(removed);
    this._grant(yields);
    g.stats.dismantled = (g.stats.dismantled || 0) + 1;
    return { ok: true, yields, msg: `Dismantled ${removed.name}: ${this.describe(yields)}.` };
  }

  sell(uid, confirmed = false) {
    const g = this.game;
    const item = this.inv.get(uid);
    if (!item) return { ok: false, msg: 'That item is gone.' };
    if (this.needsConfirm(item) && !confirmed) return { ok: false, confirm: this.needsConfirm(item).replace('destroy', 'sell') };
    if (g.equipment.isEquipped(uid)) g.equipment.unequip(uid, true);
    const removed = this.inv.remove(uid);
    if (!removed) return { ok: false, msg: 'That item is gone.' };
    const gold = Math.max(1, Math.round(removed.value * removed.qty * SELL_MULT));
    g.gold += gold;
    return { ok: true, gold, msg: `Sold ${removed.name}${removed.qty > 1 ? ' x' + removed.qty : ''} for ${gold} gold.` };
  }

  // Sell `n` of a material from the pouch (boss / endgame materials ask first in the UI).
  sellMaterial(id, n) {
    const def = ITEM_DEFS[id];
    if (!def || def.kind !== 'material') return { ok: false, msg: 'Not a material.' };
    n = Math.min(n, this.inv.countOf(id));
    if (n <= 0 || !this.inv.consumeDef(id, n)) return { ok: false, msg: `You have no ${def.name}.` };
    const gold = Math.max(1, Math.round(def.value * n * SELL_MULT));
    this.game.gold += gold;
    return { ok: true, gold, msg: `Sold ${def.name} x${n} for ${gold} gold.` };
  }

  // Materials go to the pouch; anything that doesn't fit is dropped at your feet / camp stash (never lost).
  _grant(mats) {
    const g = this.game;
    for (const [id, n] of Object.entries(mats)) g.giveItem(g.loot.create(id, 'common', n));
  }
  describe(mats) { return Object.entries(mats).map(([id, n]) => `${ITEM_DEFS[id].name} x${n}`).join(', ') || 'nothing'; }

  // ------------------------------------------------------------------ enhancement (tempering)
  temperCost(item) { return TEMPER.cost(item); }

  // Current vs projected item for the confirmation preview (never mutates the real item).
  temperPreview(item) {
    if (!item?.def.slot || (item.upgrade || 0) >= TEMPER.maxLevel) return null;
    const next = { ...item, upgrade: (item.upgrade || 0) + 1 };
    this.game.loot.gen.recompute(next);
    const rows = [];
    if (item.stats.dmgMin !== undefined) rows.push(['DAMAGE', `${item.stats.dmgMin}-${item.stats.dmgMax}`, `${next.stats.dmgMin}-${next.stats.dmgMax}`]);
    for (const [k, v] of Object.entries(next.mods)) if ((item.mods[k] || 0) !== v) rows.push([k, item.mods[k] || 0, v]);
    return { next, rows, cost: this.temperCost(item) };
  }

  temper(uid) {
    const g = this.game;
    const item = this.inv.get(uid);
    if (!item || !item.def.slot) return { ok: false, msg: 'Select a piece of equipment.' };
    if ((item.upgrade || 0) >= TEMPER.maxLevel) return { ok: false, msg: `${item.name} is already fully tempered (+${TEMPER.maxLevel}).` };
    const c = this.temperCost(item);
    const miss = this.missing(c.mats, c.gold);
    if (miss.length) return { ok: false, msg: `Missing: ${miss.join(', ')}.` };
    this._pay(c.mats, c.gold);
    item.upgrade = (item.upgrade || 0) + 1;      // same uid, same affixes, same unique effect
    g.loot.gen.recompute(item);
    if (g.equipment.isEquipped(uid)) g.equipment._changed(item);
    g.bus.emit('enhanced', { item });
    return { ok: true, msg: `${item.name} tempered to +${item.upgrade}.` };
  }

  // ------------------------------------------------------------------ reforge (special outcome)
  get reforgeUnlocked() { return this.isUnlocked({ id: REFORGE.recipe, unlock: REFORGE.unlock }); }
  reforgeCost(item) { return { mats: { ...REFORGE.cost }, gold: REFORGE.gold(item) }; }
  canReforge(item) {
    if (!item?.def.slot || isStackable(item.def)) return 'Select a piece of equipment.';
    if (item.def.uniqueOnly === 'set' || item.def.uniqueOnly === 'mythic') return 'Set and Mythic items cannot be reforged.';
    if (!this.reforgeUnlocked) return this.unlockText({ unlock: REFORGE.unlock });
    if (!this.atForge) return 'Requires the camp forge.';
    if (item.rarity === 'common') return 'Common items have no affixes to reforge.';
    return null;
  }
  reforge(uid) {
    const g = this.game;
    const item = this.inv.get(uid);
    const why = this.canReforge(item);
    if (why) return { ok: false, msg: why };
    const c = this.reforgeCost(item);
    const miss = this.missing(c.mats, c.gold);
    if (miss.length) return { ok: false, msg: `Missing: ${miss.join(', ')}.` };
    this._pay(c.mats, c.gold);
    const seed = newSeed();
    item.seed = seed;
    item.affixes = g.loot.gen.rollAffixes(mulberry32(seed), item.def, item.rarity, item.ilvl, item.classHint);
    g.loot.gen.recompute(item);
    if (g.equipment.isEquipped(uid)) g.equipment._changed(item);
    return { ok: true, msg: `Reforged: ${item.name}.` };
  }
}
