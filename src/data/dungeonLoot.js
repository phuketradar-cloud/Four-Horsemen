// Phase 4 loot tables (merged into LOOT_TABLES). Same entry format as Phase 3:
//   { type: 'equipment' | 'relic' | 'set' | 'mythic' | 'item', chance, qty: [min, max], count, minDifficulty }
// Material quantities are multiplied by the difficulty's materialMult at roll time (rounded, min 1).
// minDifficulty: the entry only exists on that difficulty or higher (e.g. Executor Mythic on Nightmare).
// Each enemy identity drops its own materials - nobody drops everything.
const I = (item, chance, qty, extra = {}) => ({ type: 'item', item, chance, ...(qty ? { qty } : {}), ...extra });

export const DUNGEON_LOOT_TABLES = {
  // ------------------------------------------------------------ I. Ashen Catacombs
  ashen_skeleton: { rarity: 'ordinary', gold: [2, 6], entries: [
    { type: 'equipment', chance: 0.16 }, I('health_potion', 0.18),
    I('bone_fragment', 0.75, [1, 3]), I('grave_dust', 0.45, [1, 2]), I('cloth_scrap', 0.25, [1, 2]),
  ] },
  ashen_crawler: { rarity: 'ordinary', gold: [1, 4], entries: [
    { type: 'equipment', chance: 0.1 }, I('bone_fragment', 0.55, [1, 2]), I('grave_dust', 0.55, [1, 3]),
  ] },
  ashen_knight: { rarity: 'elite', gold: [10, 20], entries: [
    { type: 'equipment', chance: 0.85 }, { type: 'relic', chance: 0.1 }, I('health_potion', 0.45),
    I('rusted_iron', 0.85, [2, 4]), I('lesser_soul_fragment', 0.5, [1, 2]), I('fallen_essence', 0.35), I('ancient_alloy', 0.06),
  ] },
  ashen_chest: { rarity: 'chest', gold: [12, 24], fixed: [{ item: 'rusted_iron', qty: 2 }], entries: [
    { type: 'equipment', chance: 0.75 }, I('cloth_scrap', 0.6, [1, 3]), I('health_potion', 0.4),
  ] },
  ashen_secret: { rarity: 'secret', gold: [20, 35], fixed: [{ item: 'lesser_soul_fragment', qty: 2 }], entries: [
    { type: 'equipment', chance: 1 }, { type: 'relic', chance: 0.35 }, I('grave_dust', 1, [2, 4]), I('ancient_relic_dust', 0.12),
  ] },
  boss_grave_warden: { rarity: 'warden', gold: [40, 70], fixed: [{ item: 'grave_warden_core', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, I('rusted_iron', 1, [3, 6]), I('lesser_soul_fragment', 1, [2, 4]),
    I('tempered_iron', 0.6, [1, 2]), I('ancient_alloy', 0.25), I('soul_fragment', 0.5), I('health_potion', 0.6, [1, 2]),
  ] },
  ashen_reward: { rarity: 'reward', gold: [60, 90], entries: [
    { type: 'set', chance: 0.5, forClass: true }, { type: 'equipment', chance: 1 }, I('bone_fragment', 1, [3, 5]), I('ancient_alloy', 0.35),
  ] },

  // ------------------------------------------------------------ II. Red Warfront
  war_legionnaire: { rarity: 'ordinary', gold: [6, 14], entries: [
    { type: 'equipment', chance: 0.2 }, I('rusted_iron', 0.6, [1, 3]), I('tempered_iron', 0.35, [1, 2]), I('crimson_ash', 0.4, [1, 2]), I('cloth_scrap', 0.2),
  ] },
  war_hound: { rarity: 'ordinary', gold: [3, 8], entries: [
    { type: 'equipment', chance: 0.08 }, I('bone_fragment', 0.5, [1, 2]), I('crimson_ash', 0.5, [1, 2]),
  ] },
  war_executioner: { rarity: 'elite', gold: [25, 45], entries: [
    { type: 'equipment', chance: 0.9 }, { type: 'relic', chance: 0.14 }, I('tempered_iron', 0.9, [2, 4]), I('war_essence', 0.6, [1, 2]),
    I('broken_weapon_core', 0.3), I('ancient_alloy', 0.08), I('health_potion', 0.4),
  ] },
  war_chest: { rarity: 'chest', gold: [30, 55], fixed: [{ item: 'tempered_iron', qty: 2 }], entries: [
    { type: 'equipment', chance: 0.8 }, I('crimson_ash', 0.6, [2, 3]), I('greater_health_potion', 0.25),
  ] },
  war_secret: { rarity: 'secret', gold: [45, 80], fixed: [{ item: 'broken_weapon_core', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, { type: 'relic', chance: 0.3 }, I('war_essence', 1, [1, 3]), I('ancient_relic_dust', 0.14),
  ] },
  boss_iron_tyrant: { rarity: 'tyrant', gold: [90, 140], fixed: [{ item: 'iron_tyrant_core', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, I('tempered_iron', 1, [4, 7]), I('war_essence', 1, [2, 4]), I('broken_weapon_core', 0.8, [1, 2]),
    I('ancient_alloy', 0.5, [1, 2]), I('greater_health_potion', 0.6),
  ] },
  war_reward: { rarity: 'reward', gold: [120, 180], entries: [
    { type: 'set', chance: 0.6, forClass: true }, { type: 'equipment', chance: 1 }, I('tempered_iron', 1, [3, 5]), I('ancient_alloy', 0.5),
  ] },

  // ------------------------------------------------------------ III. Black Harvest
  harvest_thrall: { rarity: 'ordinary', gold: [10, 20], entries: [
    { type: 'equipment', chance: 0.2 }, I('withered_root', 0.7, [1, 3]), I('black_grain', 0.5, [1, 2]), I('cloth_scrap', 0.3),
  ] },
  harvest_stalker: { rarity: 'ordinary', gold: [10, 22], entries: [
    { type: 'equipment', chance: 0.2 }, I('blighted_essence', 0.5, [1, 2]), I('withered_root', 0.4),
  ] },
  harvest_harvester: { rarity: 'elite', gold: [40, 70], entries: [
    { type: 'equipment', chance: 0.9 }, { type: 'relic', chance: 0.18 }, I('blighted_essence', 0.9, [2, 3]), I('corrupted_catalyst', 0.35),
    I('black_grain', 0.8, [2, 4]), I('ancient_alloy', 0.1), I('greater_health_potion', 0.35),
  ] },
  harvest_chest: { rarity: 'chest', gold: [50, 80], fixed: [{ item: 'black_grain', qty: 3 }], entries: [
    { type: 'equipment', chance: 0.8 }, I('withered_root', 0.7, [2, 4]), I('purifying_draught', 0.3),
  ] },
  harvest_secret: { rarity: 'secret', gold: [70, 110], fixed: [{ item: 'corrupted_catalyst', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, { type: 'relic', chance: 0.35 }, I('blighted_essence', 1, [2, 3]), I('ancient_relic_dust', 0.16),
  ] },
  boss_hollow_harvester: { rarity: 'harvester', gold: [150, 220], fixed: [{ item: 'hollow_harvester_core', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, I('corrupted_catalyst', 1, [2, 3]), I('blighted_essence', 1, [3, 5]),
    I('ancient_alloy', 0.7, [1, 2]), I('purifying_draught', 0.7, [1, 2]),
  ] },
  harvest_reward: { rarity: 'reward', gold: [180, 260], entries: [
    { type: 'set', chance: 0.7, forClass: true }, { type: 'equipment', chance: 1 }, I('withered_root', 1, [3, 5]), I('corrupted_catalyst', 0.5),
  ] },

  // ------------------------------------------------------------ IV. Pale Threshold
  pale_revenant: { rarity: 'ordinary', gold: [16, 30], entries: [
    { type: 'equipment', chance: 0.25 }, I('spectral_shard', 0.55, [1, 2]), I('condensed_soul', 0.3), I('pale_bone', 0.4, [1, 2]),
  ] },
  pale_soulbound: { rarity: 'ordinary', gold: [20, 34], entries: [
    { type: 'equipment', chance: 0.3 }, I('pale_bone', 0.7, [1, 3]), I('condensed_soul', 0.45), I('ancient_alloy', 0.2),
  ] },
  pale_sentinel: { rarity: 'elite', gold: [60, 100], entries: [
    { type: 'equipment', chance: 0.95 }, { type: 'relic', chance: 0.25 }, I('spectral_shard', 0.9, [2, 3]), I('condensed_soul', 0.7, [1, 2]),
    I('apocalyptic_fragment', 0.2), I('greater_health_potion', 0.4),
  ] },
  pale_chest: { rarity: 'chest', gold: [70, 120], fixed: [{ item: 'pale_bone', qty: 3 }], entries: [
    { type: 'equipment', chance: 0.85 }, I('spectral_shard', 0.6, [1, 3]), I('greater_health_potion', 0.4),
  ] },
  pale_secret: { rarity: 'secret', gold: [100, 160], fixed: [{ item: 'condensed_soul', qty: 2 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, { type: 'relic', chance: 0.4 }, I('mythic_essence', 0.1), I('ancient_relic_dust', 0.3), I('apocalyptic_fragment', 0.35),
  ] },
  boss_pale_executor: { rarity: 'executor', gold: [250, 380], fixed: [{ item: 'pale_executor_core', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 2 }, I('apocalyptic_fragment', 1, [1, 3]), I('condensed_soul', 1, [3, 5]),
    I('mythic_essence', 0.25), I('ancient_alloy', 1, [1, 3]),
    { type: 'mythic', chance: 0.08, forClass: true, minDifficulty: 'nightmare' }, // special condition: Nightmare only
  ] },
  pale_reward: { rarity: 'reward', gold: [300, 420], entries: [
    { type: 'set', chance: 0.8, forClass: true }, { type: 'equipment', chance: 1 }, I('apocalyptic_fragment', 1, [1, 2]),
    I('mythic_essence', 0.15, null, { minDifficulty: 'veteran' }),
  ] },

  // ------------------------------------------------------------ Phase 5: minibosses, chapters V-VI, variants
  boss_gravekeeper: { rarity: 'elite', gold: [25, 45], fixed: [{ item: 'grave_dust', qty: 3 }], entries: [
    { type: 'equipment', chance: 1 }, { type: 'set', set: 'gravekeeper', chance: 0.5 }, I('bone_fragment', 1, [2, 4]), I('lesser_soul_fragment', 0.7), I('health_potion', 0.6),
  ] },
  abyss_beast: { rarity: 'ordinary', gold: [24, 40], entries: [{ type: 'equipment', chance: 0.22 }, I('abyssal_ichor', 0.35), I('pale_bone', 0.4, [1, 2])] },
  abyss_gorgon: { rarity: 'ordinary', gold: [28, 46], entries: [{ type: 'equipment', chance: 0.3 }, I('abyssal_ichor', 0.45), I('spectral_shard', 0.35)] },
  abyss_nephilim: { rarity: 'elite', gold: [70, 110], entries: [{ type: 'equipment', chance: 0.95 }, { type: 'relic', chance: 0.2 }, I('abyssal_ichor', 0.9, [1, 3]), I('ancient_alloy', 0.4), I('apocalyptic_fragment', 0.25)] },
  abyss_chimera: { rarity: 'elite', gold: [70, 110], entries: [{ type: 'equipment', chance: 0.95 }, { type: 'relic', chance: 0.2 }, I('abyssal_ichor', 0.8, [1, 2]), I('blighted_essence', 0.6, [1, 2]), I('apocalyptic_fragment', 0.25)] },
  abyss_chest: { rarity: 'chest', gold: [90, 140], fixed: [{ item: 'abyssal_ichor', qty: 1 }], entries: [{ type: 'equipment', chance: 0.9 }, I('greater_health_potion', 0.5)] },
  abyss_secret: { rarity: 'secret', gold: [120, 180], fixed: [{ item: 'abyssal_ichor', qty: 2 }], entries: [{ type: 'equipment', chance: 1, count: 2 }, { type: 'set', set: 'abyssal_watch', chance: 0.4 }, I('mythic_essence', 0.12), I('ancient_relic_dust', 0.3)] },
  boss_cerberus: { rarity: 'executor', gold: [150, 220], fixed: [{ item: 'abyssal_ichor', qty: 3 }], entries: [{ type: 'equipment', chance: 1 }, { type: 'curated', chance: 0.35, pool: ['cerberus_collar', 'abyss_touched_ring', 'gorgons_eye'] }, I('apocalyptic_fragment', 0.8, [1, 2])] },
  boss_the_beast: { rarity: 'executor', gold: [300, 420], fixed: [{ item: 'beast_horn', qty: 1 }], entries: [{ type: 'equipment', chance: 1, count: 2 }, { type: 'set', set: 'abyssal_watch', chance: 0.6 }, { type: 'curated', chance: 0.4 }, I('abyssal_ichor', 1, [3, 5]), I('mythic_essence', 0.3), { type: 'mythic', chance: 0.08, forClass: true, minDifficulty: 'veteran' }] },
  abyss_reward: { rarity: 'reward', gold: [320, 450], entries: [{ type: 'set', set: 'abyssal_watch', chance: 0.7 }, { type: 'equipment', chance: 1 }, I('abyssal_ichor', 1, [2, 3])] },
  rev_locust: { rarity: 'ordinary', gold: [24, 40], entries: [{ type: 'equipment', chance: 0.2 }, I('abyssal_ichor', 0.3), I('apocalyptic_fragment', 0.08)] },
  rev_seraph: { rarity: 'ordinary', gold: [32, 54], entries: [{ type: 'equipment', chance: 0.32 }, I('condensed_soul', 0.45), I('abyssal_ichor', 0.35)] },
  rev_chest: { rarity: 'chest', gold: [120, 180], fixed: [{ item: 'apocalyptic_fragment', qty: 1 }], entries: [{ type: 'equipment', chance: 0.95 }, I('greater_health_potion', 0.6)] },
  rev_secret: { rarity: 'secret', gold: [160, 240], fixed: [{ item: 'abyssal_ichor', qty: 2 }], entries: [{ type: 'equipment', chance: 1, count: 2 }, { type: 'set', set: 'seraphs_ruin', chance: 0.45 }, { type: 'curated', chance: 0.25 }, I('mythic_essence', 0.18)] },
  boss_false_prophet: { rarity: 'executor', gold: [200, 280], fixed: [{ item: 'apocalyptic_fragment', qty: 2 }], entries: [{ type: 'equipment', chance: 1 }, { type: 'curated', chance: 0.4, pool: ['prophets_lie', 'seraph_feather', 'lantern_lost_road'] }, { type: 'set', set: 'seraphs_ruin', chance: 0.35 }] },
  boss_great_dragon: { rarity: 'executor', gold: [350, 480], fixed: [{ item: 'dragon_scale', qty: 1 }], entries: [{ type: 'equipment', chance: 1, count: 2 }, { type: 'curated', chance: 0.45, pool: ['dragonscale_aegis', 'nephilim_girdle', 'heart_first_seal'] }, I('apocalyptic_fragment', 1, [2, 3])] },
  boss_abaddon: { rarity: 'executor', gold: [600, 900], fixed: [{ item: 'abaddon_shard', qty: 1 }, { item: 'mythic_essence', qty: 1 }], entries: [
    { type: 'equipment', chance: 1, count: 3 }, { type: 'set', set: 'seraphs_ruin', chance: 0.8 }, { type: 'curated', chance: 0.6 },
    { type: 'mythic', chance: 0.12, forClass: true }, { type: 'mythic', chance: 0.15, forClass: true, minDifficulty: 'nightmare' },
  ] },
  rev_reward: { rarity: 'reward', gold: [500, 700], entries: [{ type: 'set', set: 'seraphs_ruin', chance: 0.8 }, { type: 'equipment', chance: 1, count: 2 }, I('apocalyptic_fragment', 1, [2, 3])] },
  variant_ancient: { rarity: 'elite', gold: [10, 30], entries: [{ type: 'equipment', chance: 0.4 }, I('ancient_relic_dust', 0.2), I('ancient_alloy', 0.3)] },
  variant_abyssal: { rarity: 'elite', gold: [15, 35], entries: [I('abyssal_ichor', 0.8, [1, 2]), { type: 'equipment', chance: 0.3 }] },

  // ------------------------------------------------------------ class-only caches (any dungeon; class rooms)
  class_cache: { rarity: 'secret', gold: [15, 40], entries: [
    { type: 'equipment', chance: 1 }, I('ancient_alloy', 0.3), I('ancient_relic_dust', 0.08),
  ] },
  // corrupted shrine drained by Famine: alchemical materials
  shrine_drain: { rarity: 'chest', gold: [0, 0], entries: [
    I('blighted_essence', 1, [1, 2]), I('withered_root', 1, [1, 3]), I('corrupted_catalyst', 0.25),
  ] },
};
