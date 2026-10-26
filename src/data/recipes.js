// RecipeDefinition data (CraftingManager config).
//   category  weapons | armor | accessories | relics | consumables | upgrades | boss
//   level     required player level          station  'forge' = only at the camp forge; null = anywhere
//   cost      { materialId: qty }             gold     optional currency cost
//   out       { item, qty, rarity, ilvl }  |  { equipment: true }  |  { relic: true }
//             ilvl: the item level is max(out.ilvl, your level) for crafted uniques
//   unlock    null (known from the start) | { boss } | { completed } | { unlocked } | { secret, alt }
//             secret: found as a scroll in that dungeon's secret rooms; alt: [dungeon, difficulty] clear also teaches it
// Crafting is deterministic: no hidden failure chance. Random outputs (FORGE EQUIPMENT, BIND RELIC)
// say so in their description.
export const RECIPE_CATEGORIES = [
  { id: 'weapons', label: 'WEAPONS' }, { id: 'armor', label: 'ARMOR' }, { id: 'accessories', label: 'ACCESSORIES' },
  { id: 'relics', label: 'RELICS' }, { id: 'consumables', label: 'CONSUMABLES' }, { id: 'upgrades', label: 'UPGRADE MATS' }, { id: 'boss', label: 'BOSS ITEMS' },
];

export const RECIPES = [
  // ---- Phase 3 recipes (unchanged ids and costs)
  { id: 'brew_potion', name: 'BREW HEALTH POTION', category: 'consumables', desc: 'One Health Potion (+40 HP).', out: { item: 'health_potion', qty: 1 }, cost: { iron_shard: 2 }, gold: 5 },
  { id: 'distill_elixir', name: 'DISTILL DARK ELIXIR', category: 'consumables', desc: 'Restores 40% of your class resource.', out: { item: 'dark_elixir', qty: 1 }, cost: { cursed_ash: 2, iron_shard: 1 }, gold: 10 },
  { id: 'forge_equipment', name: 'FORGE EQUIPMENT', category: 'armor', desc: 'Random equipment at your level, Uncommon or better (random result).', out: { equipment: true }, cost: { fallen_essence: 2, iron_shard: 4 }, gold: 40 },
  { id: 'bind_relic', name: 'BIND RELIC', category: 'relics', desc: 'Random relic at your level, Uncommon or better (random result).', out: { relic: true }, cost: { soul_fragment: 2, cursed_ash: 2 }, gold: 60 },
  // ---- Phase 4: consumables
  { id: 'brew_greater_potion', name: 'BREW GREATER POTION', category: 'consumables', level: 6, desc: 'One Greater Health Potion (+120 HP).', out: { item: 'greater_health_potion', qty: 1 }, cost: { bone_fragment: 4, grave_dust: 2, lesser_soul_fragment: 1 }, gold: 20, unlock: { secret: 'ashen_catacombs', alt: ['ashen_catacombs', 'veteran'] } },
  { id: 'purifying_draught', name: 'PURIFYING DRAUGHT', category: 'consumables', level: 20, desc: 'Cures Blight, Curses and Sunder and restores 15% HP.', out: { item: 'purifying_draught', qty: 1 }, cost: { blighted_essence: 2, withered_root: 2, black_grain: 2 }, gold: 40, unlock: { boss: 'hollow_harvester' } },
  // ---- weapons
  { id: 'forge_grave_sword', name: 'GRAVE-FORGED SWORD', category: 'weapons', level: 2, station: 'forge', desc: 'An Uncommon sword re-forged from catacomb iron.', out: { item: 'forged_rusted_sword', rarity: 'uncommon', ilvl: 3 }, cost: { rusted_iron: 5, bone_fragment: 2, grave_dust: 1 }, gold: 15 },
  { id: 'tempered_war_axe', name: 'TEMPERED WAR AXE', category: 'weapons', level: 12, station: 'forge', desc: 'A Rare two-handed axe of folded war steel.', out: { item: 'tempered_war_axe', rarity: 'rare', ilvl: 12 }, cost: { tempered_iron: 8, war_essence: 3, broken_weapon_core: 1 }, gold: 120, unlock: { completed: 'ashen_catacombs' } },
  // ---- accessories
  { id: 'withering_charm', name: 'WITHERING CHARM', category: 'accessories', level: 20, station: 'forge', desc: 'A Rare ring that feeds damage over time.', out: { item: 'withering_charm', rarity: 'rare', ilvl: 20 }, cost: { withered_root: 5, blighted_essence: 3, corrupted_catalyst: 1 }, gold: 250, unlock: { unlocked: 'black_harvest' } },
  { id: 'soulbound_ring', name: 'SOULBOUND RING', category: 'accessories', level: 32, station: 'forge', desc: 'An Epic ring of skill power and Resistance.', out: { item: 'soulbound_ring', rarity: 'epic', ilvl: 32 }, cost: { condensed_soul: 4, spectral_shard: 2, ancient_alloy: 1 }, gold: 600, unlock: { unlocked: 'pale_threshold' } },
  // ---- relics
  { id: 'apocalyptic_relic', name: 'APOCALYPTIC RELIC', category: 'relics', level: 45, station: 'forge', desc: 'Legendary relic: End of Days (+8% ATK, +8% HP, +3 luck). Requires the Pale Threshold cleared.', out: { item: 'apocalyptic_relic', rarity: 'legendary', ilvl: 45 }, cost: { apocalyptic_fragment: 5, pale_executor_core: 1, mythic_essence: 1 }, gold: 2000, unlock: { completed: 'pale_threshold' } },
  // ---- upgrade materials
  { id: 'refine_iron', name: 'REFINE IRON', category: 'upgrades', level: 8, station: 'forge', desc: 'Rusted Iron x5 -> Tempered Iron x1.', out: { item: 'tempered_iron', qty: 1 }, cost: { rusted_iron: 5 }, gold: 10, unlock: { completed: 'ashen_catacombs' } },
  { id: 'smelt_alloy', name: 'SMELT ANCIENT ALLOY', category: 'upgrades', level: 12, station: 'forge', desc: 'Tempered Iron and soul fragments -> Ancient Alloy x1.', out: { item: 'ancient_alloy', qty: 1 }, cost: { tempered_iron: 4, lesser_soul_fragment: 2 }, gold: 60, unlock: { boss: 'grave_warden' } },
  { id: 'distill_catalyst', name: 'DISTILL CATALYST', category: 'upgrades', level: 22, station: 'forge', desc: 'Blighted Essence x4 -> Corrupted Catalyst x1.', out: { item: 'corrupted_catalyst', qty: 1 }, cost: { blighted_essence: 4 }, gold: 50, unlock: { secret: 'black_harvest', alt: ['black_harvest', 'veteran'] } },
  { id: 'condense_souls', name: 'CONDENSE SOULS', category: 'upgrades', level: 35, station: 'forge', desc: 'Spectral Shard x3 -> Condensed Soul x1.', out: { item: 'condensed_soul', qty: 1 }, cost: { spectral_shard: 3 }, gold: 80, unlock: { secret: 'pale_threshold', alt: ['pale_threshold', 'veteran'] } },
  // ---- special boss items (boss cores)
  { id: 'wardens_bulwark', name: "WARDEN'S BULWARK", category: 'boss', level: 6, station: 'forge', desc: 'Rare shield: DEF, damage reduction, Status Resist. Any Horseman.', out: { item: 'wardens_bulwark', rarity: 'rare', ilvl: 8 }, cost: { grave_warden_core: 1, rusted_iron: 6, bone_fragment: 6 }, gold: 80, unlock: { boss: 'grave_warden' } },
  { id: 'tyrant_crown', name: "TYRANT'S CROWN", category: 'boss', level: 14, station: 'forge', desc: 'Epic helm: ATK, DEF and armour penetration.', out: { item: 'tyrant_crown', rarity: 'epic', ilvl: 16 }, cost: { iron_tyrant_core: 1, tempered_iron: 6, war_essence: 3 }, gold: 300, unlock: { boss: 'iron_tyrant' } },
  { id: 'harvester_sickle', name: "HARVESTER'S SICKLE", category: 'boss', level: 24, station: 'forge', desc: 'Epic sickle that strengthens damage over time.', out: { item: 'harvester_sickle', rarity: 'epic', ilvl: 26 }, cost: { hollow_harvester_core: 1, blighted_essence: 4, tempered_iron: 6 }, gold: 400, unlock: { boss: 'hollow_harvester' } },
  { id: 'executors_verdict', name: "EXECUTOR'S VERDICT", category: 'boss', level: 38, station: 'forge', desc: 'Legendary two-handed blade with execute damage.', out: { item: 'executors_verdict', rarity: 'legendary', ilvl: 40 }, cost: { pale_executor_core: 1, condensed_soul: 6, ancient_alloy: 3 }, gold: 1200, unlock: { boss: 'pale_executor' } },
  // ---- Phase 5: chapter V-VI recipes (curated items from boss materials)
  { id: 'forge_abyssal_ring', name: 'ABYSS-TOUCHED RING', category: 'accessories', level: 38, station: 'forge', desc: 'Curated Legendary ring: +12% damage to elites and bosses.', out: { item: 'abyss_touched_ring', rarity: 'legendary', ilvl: 40 }, cost: { abyssal_ichor: 6, ancient_alloy: 2, condensed_soul: 2 }, gold: 900, unlock: { secret: 'abyssal_gate', alt: ['abyssal_gate', 'veteran'] } },
  { id: 'forge_watch_piece', name: 'ABYSSAL WATCH PIECE', category: 'armor', level: 40, station: 'forge', desc: 'A random piece of the Abyssal Watch set (Epic or better; random piece).', out: { setPiece: 'abyssal_watch' }, cost: { abyssal_ichor: 5, beast_horn: 1 }, gold: 800, unlock: { boss: 'the_beast' } },
  { id: 'forge_dragonscale', name: 'DRAGONSCALE AEGIS', category: 'boss', level: 42, station: 'forge', desc: 'Curated Legendary shield cut from one scale.', out: { item: 'dragonscale_aegis', rarity: 'legendary', ilvl: 44 }, cost: { dragon_scale: 1, abyssal_ichor: 4, ancient_alloy: 3 }, gold: 1500, unlock: { secret: 'last_revelation', alt: ['last_revelation', 'veteran'] } },
  { id: 'forge_crown_of_dominion', name: 'CROWN OF DOMINION', category: 'boss', level: 12, station: 'forge', desc: 'Curated Legendary helm for CONQUEST.', out: { item: 'crown_of_dominion', rarity: 'legendary', ilvl: 16 }, cost: { iron_tyrant_core: 1, ancient_alloy: 2, tempered_iron: 4 }, gold: 500, unlock: { boss: 'iron_tyrant' } },
  { id: 'forge_seraph_feather', name: "SERAPH'S FEATHER", category: 'relics', level: 45, station: 'forge', desc: 'Curated Legendary relic of last light.', out: { item: 'seraph_feather', rarity: 'legendary', ilvl: 46 }, cost: { abaddon_shard: 1, mythic_essence: 1, condensed_soul: 4 }, gold: 2500, unlock: { boss: 'abaddon' } },
];

// Reforging (special outcome): re-rolls an item's affixes with a new seed. Keeps the base,
// rarity, item level, temper level, unique effect and uid. Taught by a Red Warfront secret scroll.
export const REFORGE = { recipe: 'reforge_affixes', name: 'REFORGE AFFIXES', unlock: { secret: 'red_warfront', alt: ['red_warfront', 'veteran'] }, cost: { corrupted_catalyst: 1 }, gold: (item) => 40 + item.ilvl * 6 };

// Material bands by item level. Phase 3 materials stay the band-1 economy (prologue + catacombs);
// higher item levels map each role to that band's dungeon materials.
export const MATERIAL_BANDS = [
  { maxIlvl: 9, iron_shard: 'iron_shard', cursed_ash: 'cursed_ash', fallen_essence: 'fallen_essence', soul_fragment: 'soul_fragment' },
  { maxIlvl: 19, iron_shard: 'tempered_iron', cursed_ash: 'crimson_ash', fallen_essence: 'war_essence', soul_fragment: 'ancient_alloy' },
  { maxIlvl: 34, iron_shard: 'withered_root', cursed_ash: 'black_grain', fallen_essence: 'blighted_essence', soul_fragment: 'corrupted_catalyst' },
  { maxIlvl: 50, iron_shard: 'pale_bone', cursed_ash: 'pale_bone', fallen_essence: 'spectral_shard', soul_fragment: 'condensed_soul' },
];
export const bandFor = (ilvl) => MATERIAL_BANDS.find((b) => ilvl <= b.maxIlvl) || MATERIAL_BANDS[MATERIAL_BANDS.length - 1];
const mapBand = (mats, ilvl) => { const b = bandFor(ilvl); const out = {}; for (const [k, v] of Object.entries(mats)) out[b[k] || k] = (out[b[k] || k] || 0) + v; return out; };

// Tempering / equipment enhancement: +8% to the item's base stats and weapon damage per level
// (affixes and unique effects unchanged, never duplicated). maxLevel is the configurable cap.
export const TEMPER = {
  maxLevel: 5,
  statPerLevel: 0.08,
  cost(item) {
    const lvl = item.upgrade || 0;
    const tier = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(item.rarity);
    const c = { iron_shard: 2 + lvl * 2 };
    if (tier >= 2) c.fallen_essence = 1 + Math.floor(lvl / 2);
    if (tier >= 4) c.soul_fragment = 1 + Math.floor(lvl / 2);
    return { mats: mapBand(c, item.ilvl || 1), gold: 10 * (lvl + 1) * (1 + tier) * (1 + Math.floor((item.ilvl || 1) / 10)) };
  },
};

// Dismantle yields: per material [base, perItemLevel]. qty = base + floor(ilvl x perItemLevel),
// mapped to the item level's material band.
export const DISMANTLE = {
  common: { iron_shard: [1, 0.3] },
  uncommon: { iron_shard: [2, 0.3], cursed_ash: [1, 0] },
  rare: { cursed_ash: [2, 0.2], fallen_essence: [1, 0] },
  epic: { fallen_essence: [2, 0.2], soul_fragment: [1, 0] },
  legendary: { soul_fragment: [2, 0.1], apocalyptic_core: [1, 0] },
  mythic: { apocalyptic_core: [3, 0], soul_fragment: [2, 0] },
};
export const dismantleBand = (yields, ilvl) => mapBand(yields, ilvl);
export const SELL_MULT = 0.25; // gold = item value x this
