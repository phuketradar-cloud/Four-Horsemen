// Painted item icons and dungeon objects: assets/items/<key>.png (64x64, baked from the item sheets in
// assets/items/src/ by tools/make-item-art.js). Each one replaces the drawn sprite of the same key and is
// scaled down to that sprite's size, so layouts do not move. A key without a file keeps its pixel art.
export const ITEM_ART_BASE = 'assets/items/';

// sprites.icons[key] - inventory, shop, crafting, loot on the floor, HUD weapon slots
export const ITEM_ICON_ART = [
  // weapons and off-hands
  'sword', 'longsword', 'axe', 'scythe', 'crossbow', 'bow', 'dagger', 'sickle', 'hammer', 'spear', 'cursedblade',
  'shield', 'parry', 'orb', 'tome', 'totem',
  // armour
  'helm', 'crown', 'hood', 'mask', 'headdress', 'plate', 'robe', 'jerkin', 'bonemail', 'regalia',
  'gauntlet', 'wraps', 'bracers', 'greaves', 'boots', 'lantern',
  // jewellery, relics, consumables, currency
  'ring', 'signet', 'soulring', 'talisman', 'shardRelic', 'sealRelic', 'scalesRelic', 'idol', 'reliquary', 'chalice',
  'banner', 'potion', 'elixir', 'gold', 'shard', 'essence', 'ash', 'soulfrag', 'core',
  // crafting materials
  ...['rusted_iron', 'bone_fragment', 'cloth_scrap', 'grave_dust', 'crimson_ash', 'black_grain', 'lesser_soul_fragment',
    'tempered_iron', 'war_essence', 'broken_weapon_core', 'withered_root', 'blighted_essence', 'pale_bone',
    'corrupted_catalyst', 'condensed_soul', 'spectral_shard', 'ancient_alloy', 'grave_warden_core', 'iron_tyrant_core',
    'hollow_harvester_core', 'pale_executor_core', 'abyssal_ichor', 'beast_horn', 'dragon_scale', 'abaddon_shard',
    'apocalyptic_fragment', 'mythic_essence', 'ancient_relic_dust'].map((m) => `mat_${m}`),
];

// world objects: [file key, sprite group, sprite key, dimmed "used" twin, optional canvas shape [w, h]]
// (exit gate / portal / stairs come from assets/items/src/items_portal.jpg, prompt in docs/portal-prompts.md)
export const ITEM_OBJECT_ART = [
  ['chestClosed', 'chest', 'closed'], ['chestOpen', 'chest', 'open'],
  ['font', 'features', 'font', 'fontUsed'], ['shrine', 'features', 'shrine', 'shrineUsed'],
  ['tablet', 'features', 'tablet'], ['scroll', 'features', 'scroll', 'scrollUsed'],
  ['exitOff', 'features', 'exitOff'], ['exitOn', 'features', 'exitOn'],
  ['stairs', 'features', 'stairs', null, [32, 52]], // painted as a standing archway: taller than the old floor hole
];
