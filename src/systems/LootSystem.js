import { ITEM_DEFS, RARITY_ORDER, RANDOM_EQUIPMENT_IDS, RELIC_IDS, MYTHIC_IDS, CURATED_LEGENDARY_IDS } from '../data/items.js';
import { RARITY_TABLES, MYTHIC_SOURCES, LUCK_RULES, LOOT_TABLES, SLOT_WEIGHTS, ILVL_SPREAD } from '../data/lootTables.js';
import { SETS, SET_FOR_CLASS } from '../data/sets.js';
import { pickWeighted, randInt, chance, newSeed } from '../core/rng.js';
import { DIFFICULTIES, difficultyRank } from '../data/difficulty.js';
import { ItemGenerator, MAX_ILVL } from './ItemGenerator.js';

// LootTableManager + LootDropService + items lying on the dungeon floor.
// Loot is rolled exactly once per reward event (enemy.lootRolled, chest.opened) and the
// resulting item instances are stored in game state; nothing re-rolls on UI actions.
export class LootSystem {
  constructor(bus, game = null) {
    this.bus = bus;
    this.game = game;
    this.gen = new ItemGenerator();
    this.floor = [];
  }

  get nextUid() { return this.gen.nextUid; }
  get classHint() { return this.game?.hero?.classId || null; }
  get luck() { return Math.min(LUCK_RULES.maxBonus, (this.game?.hero?.stats?.lootLuck || 0) / 100); }

  reset(dungeonDef) {
    this.gen.reset();
    this.resetFloor(dungeonDef);
  }
  // New floor of the same character: floor items only (item uids keep counting up).
  resetFloor(layout) {
    this.floor = [];
    const lvl = layout.level || 1;
    for (const f of layout.floorItems || []) this.drop(f.x, f.y, [this.create(f.item, f.rarity, f.qty || 1, null, { ilvl: lvl })]);
  }
  serializeFloor() { return { floor: this.floor.map((f) => ({ x: f.x, y: f.y, item: this.serializeItem(f.item) })) }; }
  restoreFloor(s) {
    this.floor = [];
    for (const f of s.floor || []) { const item = this.restoreItem(f.item); if (item) this.floor.push({ uid: item.uid, x: f.x, y: f.y, item }); }
  }

  // Phase 1/2 API: a specific base item.
  create(defId, rarity = 'common', qty = 1, uid = null, opts = {}) {
    if (!ITEM_DEFS[defId]) throw new Error(`Unknown item ${defId}`);
    return this.gen.generate({ baseId: defId, rarity, qty, uid, ilvl: opts.ilvl || 1, seed: opts.seed ?? newSeed(), classHint: opts.classHint ?? this.classHint });
  }

  // ------------------------------------------------------------------ rarity tables
  // Normalised probabilities. Mythic weight moves to Legendary for sources that can't give Mythic.
  // Luck boosts Uncommon..Legendary (bounded), never Mythic.
  rarityDistribution(tableName, luck = 0) {
    const t = RARITY_TABLES[tableName] || RARITY_TABLES.ordinary;
    const l = Math.max(0, Math.min(LUCK_RULES.maxBonus, luck));
    const w = {};
    RARITY_ORDER.forEach((r, i) => { w[r] = (t[r] || 0) * (r === 'mythic' || r === 'common' ? 1 : 1 + l * i); });
    if (!MYTHIC_SOURCES.includes(tableName)) { w.legendary += w.mythic; w.mythic = 0; }
    const total = Object.values(w).reduce((s, v) => s + v, 0) || 1;
    const p = {};
    for (const r of RARITY_ORDER) p[r] = w[r] / total;
    return p;
  }

  rollRarity(tableName, luck = this.luck, rnd = Math.random) {
    const p = this.rarityDistribution(tableName, luck);
    let x = rnd();
    for (const r of RARITY_ORDER) { if ((x -= p[r]) < 0) return r; }
    // floating-point tail: return the highest tier that has probability
    return [...RARITY_ORDER].reverse().find((r) => p[r] > 0);
  }

  rollIlvl(level) { return Math.max(1, Math.min(MAX_ILVL, level + randInt(-ILVL_SPREAD, ILVL_SPREAD))); }

  allowedForClass(def, cls) { return !def.classes || def.classes.includes(cls); }

  // ------------------------------------------------------------------ generators per entry type
  rollEquipment(tableName, level, forcedRarity = null, luck = this.luck) {
    const cls = this.classHint;
    const rarity = forcedRarity || this.rollRarity(tableName, luck);
    if (rarity === 'mythic') return this.mythicFor(cls, level);
    const ilvl = this.rollIlvl(level);
    // Phase 5: a Legendary roll has a 15% chance to be a curated Legendary of a fitting level
    if (rarity === 'legendary' && chance(0.15)) { const c = this.curatedFor(cls, ilvl); if (c) return c; }
    const slot = pickWeighted(Object.entries(SLOT_WEIGHTS).map(([value, weight]) => ({ value, weight })));
    let bases = RANDOM_EQUIPMENT_IDS.filter((id) => ITEM_DEFS[id].slot === slot && this.baseFits(ITEM_DEFS[id], ilvl, cls));
    if (!bases.length) bases = RANDOM_EQUIPMENT_IDS.filter((id) => ITEM_DEFS[id].minIlvl <= ilvl);
    return this.gen.generate({ baseId: bases[Math.floor(Math.random() * bases.length)], rarity, ilvl, classHint: cls });
  }

  // Base eligibility: item-level window (catalog tiers stop dropping well above their band),
  // class restriction and dungeon-exclusive tiers (e.g. Abyssal only in the Abyss).
  baseFits(d, ilvl, cls) {
    if (d.minIlvl > ilvl) return false;
    if (d.maxIlvl && ilvl > d.maxIlvl + 4) return false;
    if (!this.allowedForClass(d, cls)) return false;
    if (d.dungeons && !d.dungeons.includes(this.game?.run?.dungeonId)) return false;
    return true;
  }

  curatedFor(cls, ilvl, pool = null) {
    const ids = (pool || CURATED_LEGENDARY_IDS).filter((id) => ITEM_DEFS[id] && ITEM_DEFS[id].minIlvl <= Math.max(ilvl, 1) + 2 && this.allowedForClass(ITEM_DEFS[id], cls));
    if (!ids.length) return null;
    const id = ids[Math.floor(Math.random() * ids.length)];
    return this.gen.generate({ baseId: id, rarity: ITEM_DEFS[id].uniqueOnly === 'mythic' ? 'mythic' : 'legendary', ilvl: Math.max(ilvl, ITEM_DEFS[id].minIlvl), classHint: cls });
  }

  rollRelic(tableName, level, forcedRarity = null, luck = this.luck) {
    const cls = this.classHint;
    let rarity = forcedRarity || this.rollRarity(tableName, luck);
    if (rarity === 'mythic') rarity = 'legendary';
    const bases = RELIC_IDS.filter((id) => this.allowedForClass(ITEM_DEFS[id], cls));
    return this.gen.generate({ baseId: bases[Math.floor(Math.random() * bases.length)], rarity, ilvl: this.rollIlvl(level), classHint: cls });
  }

  setPieceFor(cls, level) { return this.setPiece(SET_FOR_CLASS[cls], level); }
  setPiece(setId, level) {
    const cls = this.classHint;
    const set = SETS[setId];
    if (!set) return null;
    const baseId = set.pieces[Math.floor(Math.random() * set.pieces.length)];
    return this.gen.generate({ baseId, rarity: chance(0.25) ? 'legendary' : 'epic', ilvl: this.rollIlvl(level), classHint: cls });
  }

  mythicFor(cls, level) {
    const ids = MYTHIC_IDS.filter((id) => this.allowedForClass(ITEM_DEFS[id], cls));
    if (!ids.length) return null;
    return this.gen.generate({ baseId: ids[Math.floor(Math.random() * ids.length)], rarity: 'mythic', ilvl: this.rollIlvl(level), classHint: cls });
  }

  // ------------------------------------------------------------------ tables
  // Difficulty of the current run: material quantity multiplier, bounded luck bonus, entry gating.
  runOpts() {
    const d = DIFFICULTIES[this.game?.run?.difficulty] || DIFFICULTIES.normal;
    return { difficulty: d.id, qtyMult: d.materialMult, goldMult: d.goldMult, luckBonus: d.luckBonus };
  }

  rollTable(tableName, level = 1, opts = this.runOpts()) {
    const t = LOOT_TABLES[tableName];
    const items = [];
    if (!t) return { items, gold: 0 };
    const cls = this.classHint;
    const qm = opts.qtyMult || 1;
    const luck = Math.min(LUCK_RULES.maxBonus, this.luck + (opts.luckBonus || 0));
    const qty = (n, isMat) => (isMat ? Math.max(1, Math.round(n * qm)) : n);
    for (const f of t.fixed || []) items.push(this.create(f.item, f.rarity || 'common', qty(f.qty || 1, ITEM_DEFS[f.item].kind === 'material'), null, { ilvl: level }));
    for (const e of t.entries || []) {
      if (e.minDifficulty && difficultyRank(opts.difficulty || 'normal') < difficultyRank(e.minDifficulty)) continue;
      for (let n = 0; n < (e.count || 1); n++) {
        if (!chance(e.chance)) continue;
        let it = null;
        if (e.type === 'equipment') it = this.rollEquipment(t.rarity, level, null, luck);
        else if (e.type === 'relic') it = this.rollRelic(t.rarity, level, null, luck);
        else if (e.type === 'set') it = e.set ? this.setPiece(e.set, level) : this.setPieceFor(cls, level);
        else if (e.type === 'curated') it = this.curatedFor(cls, level, e.pool || null);
        else if (e.type === 'mythic') it = this.mythicFor(cls, level);
        else if (e.type === 'item') it = this.create(e.item, 'common', qty(e.qty ? randInt(e.qty[0], e.qty[1]) : 1, ITEM_DEFS[e.item].kind === 'material'), null, { ilvl: level });
        if (it) items.push(it);
      }
    }
    const gold = t.gold ? Math.round(randInt(t.gold[0], t.gold[1]) * (opts.goldMult || 1)) : 0;
    return { items, gold };
  }

  // Pure roll (no side effects) — used by tests/statistics.
  rollDrops(enemy) { return enemy.lootTable ? this.rollTable(enemy.lootTable, enemy.level || 1).items : []; }

  // Real reward event: exactly once per enemy (summoned minions carry no table).
  rollEnemy(enemy) {
    if (enemy.lootRolled) return { items: [], gold: 0 };
    enemy.lootRolled = true;
    if (!enemy.lootTable) return { items: [], gold: 0 };
    return this.rollTable(enemy.lootTable, enemy.level || 1);
  }

  // Exactly once per chest.
  openChest(chest) {
    if (chest.opened) return { items: [], gold: 0 };
    chest.opened = true;
    return this.rollTable(chest.table, chest.level || 1);
  }

  // ------------------------------------------------------------------ floor
  drop(x, y, items, spawnT) {
    for (const item of items) if (item) this.floor.push({ uid: item.uid, x, y, item, spawnT });
    if (items.length) this.bus.emit('lootDropped', { x, y, items });
  }

  itemsAt(x, y) { return this.floor.filter((f) => f.x === x && f.y === y); }

  // Remove a floor entry (by uid) — once removed it can never be picked up again.
  take(uid) {
    const i = this.floor.findIndex((f) => f.uid === uid);
    if (i < 0) return null;
    return this.floor.splice(i, 1)[0].item;
  }

  // ------------------------------------------------------------------ persistence
  serializeItem(it) {
    return {
      uid: it.uid, baseId: it.baseId, rarity: it.rarity, ilvl: it.ilvl, qty: it.qty, seed: it.seed,
      affixes: (it.affixes || []).map((a) => ({ id: a.id, value: a.value })), unique: it.unique, upgrade: it.upgrade || 0, classHint: it.classHint || null,
    };
  }

  // Returns null for items whose definition no longer exists (caller reports it).
  restoreItem(s) {
    const baseId = s.baseId || s.defId;
    if (!ITEM_DEFS[baseId]) return null;
    const legacy = !s.seed && !s.affixes; // Phase 1/2 item: deterministic seed from its uid
    return this.gen.generate({
      baseId, rarity: s.rarity || 'common', ilvl: s.ilvl || 1, qty: Math.max(1, s.qty | 0 || 1), uid: s.uid,
      seed: legacy ? (Math.imul(s.uid || 1, 2654435761) >>> 0) : s.seed, affixes: legacy ? null : (s.affixes || []),
      unique: legacy ? undefined : (s.unique ?? null), upgrade: s.upgrade || 0, classHint: s.classHint ?? null,
    });
  }

  serialize() { return { nextUid: this.gen.nextUid, floor: this.floor.map((f) => ({ x: f.x, y: f.y, item: this.serializeItem(f.item) })) }; }
  restore(s) {
    this.floor = [];
    for (const f of s.floor || []) { const item = this.restoreItem(f.item); if (item) this.floor.push({ uid: item.uid, x: f.x, y: f.y, item }); }
    this.gen.nextUid = Math.max(this.gen.nextUid, s.nextUid || 1);
  }
}
