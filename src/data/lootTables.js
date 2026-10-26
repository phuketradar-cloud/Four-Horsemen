import { DUNGEON_LOOT_TABLES } from './dungeonLoot.js';

// ItemRarityTable + LootTableManager config. Weights are relative (normalised at roll time).
export const RARITY_TABLES = {
  ordinary: { common: 70, uncommon: 22, rare: 6, epic: 1.7, legendary: 0.29, mythic: 0.01 },
  elite: { common: 40, uncommon: 33, rare: 18, epic: 7, legendary: 1.8, mythic: 0.2 },
  boss: { common: 10, uncommon: 30, rare: 32, epic: 20, legendary: 7, mythic: 0.5 },
  chest: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 0.9, mythic: 0.1 },
  secret: { common: 20, uncommon: 30, rare: 28, epic: 16, legendary: 5, mythic: 0.5 },
  reward: { common: 0, uncommon: 15, rare: 35, epic: 33, legendary: 14, mythic: 1 },
  crafted: { common: 0, uncommon: 55, rare: 35, epic: 9, legendary: 1, mythic: 0 },
  // Phase 4 boss tables (equipment rarity only; Mythic comes from explicit 'mythic' entries with conditions)
  warden: { common: 0, uncommon: 22, rare: 50, epic: 25, legendary: 3, mythic: 0 },
  tyrant: { common: 0, uncommon: 8, rare: 40, epic: 42, legendary: 10, mythic: 0 },
  harvester: { common: 0, uncommon: 0, rare: 35, epic: 45, legendary: 20, mythic: 0 },
  executor: { common: 0, uncommon: 0, rare: 18, epic: 47, legendary: 35, mythic: 0 },
};
// Mythic is only honoured from these sources; a mythic roll anywhere else becomes Legendary.
export const MYTHIC_SOURCES = ['boss', 'secret', 'reward'];
// Luck shifts weight toward Uncommon..Legendary: w_i x (1 + luck x tierIndex). Never touches Mythic.
export const LUCK_RULES = { maxBonus: 0.25 };

// type: equipment | relic | set | mythic | item (fixed consumable/material)
// set/mythic entries give the defeated-player's class version when forClass is true.
export const LOOT_TABLES = {
  skeleton: {
    rarity: 'ordinary', gold: [2, 6],
    entries: [
      { type: 'equipment', chance: 0.22 },
      { type: 'item', item: 'health_potion', chance: 0.25 },
      { type: 'item', item: 'iron_shard', chance: 0.5, qty: [1, 2] },
      { type: 'item', item: 'cursed_ash', chance: 0.15 },
    ],
  },
  knight: {
    rarity: 'elite', gold: [10, 20],
    entries: [
      { type: 'equipment', chance: 0.9 },
      { type: 'relic', chance: 0.15 },
      { type: 'item', item: 'health_potion', chance: 0.6 },
      { type: 'item', item: 'fallen_essence', chance: 0.5 },
      { type: 'item', item: 'iron_shard', chance: 0.9, qty: [2, 4] },
    ],
  },
  captain: { // boss
    rarity: 'boss', gold: [30, 60],
    entries: [
      { type: 'equipment', chance: 1, count: 2 },
      { type: 'relic', chance: 0.4 },
      { type: 'set', chance: 0.35, forClass: true },  // boss-exclusive: class set piece
      { type: 'mythic', chance: 0.01, forClass: true }, // boss-exclusive: class mythic
      { type: 'item', item: 'soul_fragment', chance: 0.6 },
      { type: 'item', item: 'dark_elixir', chance: 0.5 },
    ],
  },
  chest_reliquary: {
    rarity: 'chest', gold: [15, 25],
    fixed: [{ item: 'war_axe', rarity: 'common' }, { item: 'health_potion', qty: 2 }],
    entries: [{ type: 'equipment', chance: 0.6 }, { type: 'item', item: 'cursed_ash', chance: 0.5, qty: [1, 2] }],
  },
  chest_secret: {
    rarity: 'secret', gold: [20, 40],
    fixed: [{ item: 'iron_shard', qty: 3 }],
    entries: [{ type: 'equipment', chance: 1 }, { type: 'relic', chance: 0.5 }, { type: 'item', item: 'dark_elixir', chance: 0.5 }],
  },
  dungeon_reward: { // completion reward
    rarity: 'reward', gold: [80, 120],
    entries: [
      { type: 'set', chance: 1, forClass: true },
      { type: 'equipment', chance: 1 },
      { type: 'mythic', chance: 0.02, forClass: true },
      { type: 'item', item: 'fallen_essence', chance: 1, qty: [2, 3] },
    ],
  },
};

// Phase 4: per-dungeon enemy / chest / secret / boss / completion tables (MaterialDropTable data).
Object.assign(LOOT_TABLES, DUNGEON_LOOT_TABLES);

// Random-equipment slot weights (which kind of item an "equipment" roll produces).
export const SLOT_WEIGHTS = { mainHand: 22, head: 13, chest: 13, hands: 13, legs: 13, offHand: 10, ring: 10 };
// Item level = source level +/- spread, clamped to [1, 50].
export const ILVL_SPREAD = 1;
