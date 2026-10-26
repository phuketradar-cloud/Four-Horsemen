// MaterialDefinition (Phase 4). Materials live in the material pouch (MaterialInventory), not in
// the 40-slot bag. Drop sources and crafting usage are DERIVED from the loot tables and recipes
// (see indexMaterialUsage) so the data can never disagree with itself; tests validate both ways.
//   tier   basic | uncommon | rare | boss | endgame | legacy (Phase 3 materials, still valid)
//   stack  maximum carried in the pouch (pickups beyond it stay on the floor)
//   value  sell value in gold (x SELL_MULT when sold)
//   icon   { shape, c: [main, light, dark] } -> generated 16x16 icon 'mat_<id>'
export const MATERIAL_TIERS = {
  legacy: { label: 'PHASE III', color: '#b8b2a0', stack: 999 },
  basic: { label: 'BASIC', color: '#b8b2a0', stack: 999 },
  uncommon: { label: 'UNCOMMON', color: '#5fbf4a', stack: 500 },
  rare: { label: 'RARE', color: '#5a8ff0', stack: 200 },
  boss: { label: 'BOSS', color: '#f29a2a', stack: 50 },
  endgame: { label: 'ENDGAME', color: '#ff5a6e', stack: 50 },
};

const M = (id, name, tier, shape, c, value, desc, origin) => ({ id, name, tier, icon: { shape, c }, value, desc, origin });

export const MATERIALS = [
  // ---- basic
  M('rusted_iron', 'Rusted Iron', 'basic', 'ingot', ['#8a5a3a', '#b07a4a', '#4a2e1a'], 2, 'Pitted iron from old gates and blades.', 'Armoured dead, chests'),
  M('bone_fragment', 'Bone Fragment', 'basic', 'bone', ['#d8ccb0', '#f0e8d4', '#8a7e60'], 1, 'Splintered bone. Binds well with ash.', 'Skeletons, crawlers'),
  M('cloth_scrap', 'Cloth Scrap', 'basic', 'cloth', ['#7a6a5a', '#a89880', '#3a3028'], 1, 'Burial linen and banner rags.', 'Most humanoid foes'),
  M('grave_dust', 'Grave Dust', 'basic', 'dust', ['#8a8478', '#b8b0a0', '#4a4640'], 2, 'Fine dust from sealed tombs.', 'Ashen Catacombs'),
  M('crimson_ash', 'Crimson Ash', 'basic', 'ash', ['#8a2a1a', '#d05030', '#3a0a06'], 4, 'Ash from a battlefield that never cooled.', 'Red Warfront'),
  M('black_grain', 'Black Grain', 'basic', 'grain', ['#3a3420', '#6a6040', '#1a160c'], 6, 'Blighted grain. It still sprouts in the dark.', 'Black Harvest'),
  // ---- uncommon
  M('lesser_soul_fragment', 'Lesser Soul Fragment', 'uncommon', 'crystal', ['#7aa8c0', '#c0e0f0', '#3a5a6a'], 8, 'A faint sliver of a trapped soul.', 'Fallen Knights, Ashen secrets'),
  M('tempered_iron', 'Tempered Iron', 'uncommon', 'ingot', ['#8a929c', '#c8d0d8', '#4a5058'], 10, 'War-forged steel, folded and quenched.', 'Red Warfront soldiers'),
  M('war_essence', 'War Essence', 'uncommon', 'orb', ['#a01810', '#ff6040', '#4a0806'], 14, 'The rage of a thousand battles, condensed.', 'Iron Executioners'),
  M('broken_weapon_core', 'Broken Weapon Core', 'uncommon', 'core', ['#6a6460', '#e08a30', '#2a2420'], 18, 'The still-hot heart of a shattered weapon.', 'Iron Executioners, Hidden Arsenal'),
  M('withered_root', 'Withered Root', 'uncommon', 'root', ['#6a5030', '#9a8050', '#2a1e10'], 14, 'A root that drinks life from the soil.', 'Withered Thralls'),
  M('blighted_essence', 'Blighted Essence', 'uncommon', 'orb', ['#5a8a20', '#b0e040', '#203a08'], 18, 'Distilled blight. Handle with gloves.', 'Plague Stalkers, Harvesters'),
  M('pale_bone', 'Pale Bone', 'uncommon', 'bone', ['#e8f0f0', '#ffffff', '#9aa8b0'], 22, 'Bone bleached white by the threshold.', 'Pale Threshold'),
  // ---- rare
  M('corrupted_catalyst', 'Corrupted Catalyst', 'rare', 'crystal', ['#7a2a9a', '#d080ff', '#2a0a3a'], 40, 'It changes whatever it touches. Used to reforge affixes.', 'Hollow Harvesters, Black Harvest secrets'),
  M('condensed_soul', 'Condensed Soul', 'rare', 'orb', ['#80b0e0', '#e0f4ff', '#304a6a'], 45, 'Many souls pressed into one cold light.', 'Pale Threshold'),
  M('spectral_shard', 'Spectral Shard', 'rare', 'crystal', ['#60e0d0', '#d0fff8', '#1a5a50'], 45, 'A shard of a ghost. It is never quite where you look.', 'Pale Revenants, Sentinels'),
  M('ancient_alloy', 'Ancient Alloy', 'rare', 'ingot', ['#c0a050', '#fff0b0', '#6a5420'], 50, 'Metal from before the First Seal.', 'Elites and bosses of every dungeon'),
  // ---- boss cores
  M('grave_warden_core', 'Grave Warden Core', 'boss', 'core', ['#d8ccb0', '#ffd040', '#5a5038'], 120, 'The burial seal the Warden guarded.', 'The Grave Warden'),
  M('iron_tyrant_core', 'Iron Tyrant Core', 'boss', 'core', ['#565c66', '#ff6040', '#17191d'], 200, 'A crown-forged heart of iron.', 'The Iron Tyrant'),
  M('hollow_harvester_core', 'Hollow Harvester Core', 'boss', 'core', ['#3a5a10', '#c0ff40', '#101a04'], 300, 'It is still hungry.', 'The Hollow Harvester'),
  M('pale_executor_core', 'Pale Executor Core', 'boss', 'core', ['#c0c8d0', '#a8f0ff', '#3a4048'], 450, 'The judgement of the final threshold.', 'The Pale Executor'),
  // ---- Phase 5 (chapters V-VI)
  M('abyssal_ichor', 'Abyssal Ichor', 'rare', 'orb', ['#5a1a8a', '#c060ff', '#1a0430'], 60, 'It flows upward. Used for abyssal crafting.', 'Abyssal Gate / Last Revelation, ABYSSAL variants'),
  M('beast_horn', 'Horn of the Beast', 'boss', 'shard', ['#3a2a20', '#d8c890', '#120c08'], 500, 'One of ten. Still warm.', 'The Beast'),
  M('dragon_scale', 'Great Dragon Scale', 'boss', 'shard', ['#a01818', '#ff8060', '#400606'], 600, 'Big enough to hide behind.', 'The Great Dragon'),
  M('abaddon_shard', 'Shard of the Destroyer\'s Crown', 'boss', 'crystal', ['#4a0a3a', '#ff60c0', '#1a0414'], 900, 'A splinter of a crown of locusts.', 'Abaddon'),
  // ---- endgame
  M('apocalyptic_fragment', 'Apocalyptic Fragment', 'endgame', 'shard', ['#a01020', '#ff5a6e', '#3a0408'], 120, 'A piece of the end of the world.', 'Pale Threshold elites and boss'),
  M('mythic_essence', 'Mythic Essence', 'endgame', 'orb', ['#c02060', '#ff90c0', '#4a0820'], 300, 'The stuff legends are distilled from.', 'Pale Executor, Pale secrets'),
  M('ancient_relic_dust', 'Ancient Relic Dust', 'endgame', 'dust', ['#c0a050', '#fff0b0', '#5a4a20'], 90, 'Dust from relics older than the Horsemen.', 'Secret rooms (rare)'),
];

export const MATERIAL_DEFS = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

// Item definitions for ITEM_DEFS (kind 'material', stackable to the tier cap).
export function materialItemDefs() {
  return MATERIALS.map((m) => ({
    id: m.id, name: m.name, kind: 'material', type: 'material', icon: `mat_${m.id}`, stack: MATERIAL_TIERS[m.tier].stack,
    value: m.value, materialValue: Math.max(1, Math.round(m.value / 2)), tier: m.tier, desc: m.desc, minIlvl: 1,
  }));
}

// Fill def.sources (loot tables that can drop it) and def.usedIn (recipes that consume it).
export function indexMaterialUsage(itemDefs, lootTables, recipes) {
  for (const d of Object.values(itemDefs)) if (d.kind === 'material') { d.sources = []; d.usedIn = []; }
  for (const [tid, t] of Object.entries(lootTables)) {
    const ids = [...(t.fixed || []).map((f) => f.item), ...(t.entries || []).filter((e) => e.type === 'item').map((e) => e.item)];
    for (const id of ids) if (itemDefs[id]?.kind === 'material' && !itemDefs[id].sources.includes(tid)) itemDefs[id].sources.push(tid);
  }
  for (const r of recipes) for (const id of Object.keys(r.cost || {})) if (itemDefs[id]?.kind === 'material' && !itemDefs[id].usedIn.includes(r.id)) itemDefs[id].usedIn.push(r.id);
}
