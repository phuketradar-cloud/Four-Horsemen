// Phase 5 curated equipment: 21 Legendaries, 4 new Mythics (8 in total with Phase 3's), and the
// pieces of 4 new sets (8 sets in total). Names and effects are hand-written, never random.
// uniqueOnly 'legendary' / 'mythic' / 'set': never rolled as random bases; they come from boss and
// chapter tables, quest rewards, the 'curated' loot entry, or a Legendary roll's 15% curated chance.
// Effects (`unique`) are defined in legendaryEffects.js and run by the generic handlers in
// systems/LegendaryEffects.js.
const L = (id, o) => ({ id, uniqueOnly: 'legendary', stack: 1, value: 220, minIlvl: 8, ...o });
const MY = (id, o) => ({ id, uniqueOnly: 'mythic', stack: 1, value: 480, minIlvl: 25, ...o });
const W = (weaponId) => ({ kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId });

export const CURATED = [
  // ---------------------------------------------------------------- Conquest
  L('crown_of_dominion', { name: 'Crown of Dominion', kind: 'armor', type: 'armor', slot: 'head', icon: 'crown', classes: ['conquest'], unique: 'crown_of_dominion', minIlvl: 10, base: { crit: [2, 0.1], def: [0.6, 0.2] }, desc: 'The White Rider\'s crown. Every marked foe is already conquered.' }),
  L('victors_gauntlets', { name: "Gauntlets of the Victor", kind: 'armor', type: 'armor', slot: 'hands', icon: 'gauntlet', classes: ['conquest'], unique: 'victors_gauntlets', base: { atk: [1.5, 0.35], accuracy: [2, 0.2] }, desc: 'Gilded steel that remembers every kill.' }),
  L('heralds_signet', { name: "Herald's Signet", kind: 'ring', type: 'armor', slot: 'ring', icon: 'signet', classes: ['conquest'], unique: 'heralds_signet', base: { lck: [2, 0.3] }, desc: 'It announces you before you arrive.' }),
  // ---------------------------------------------------------------- War
  L('gorefist', { name: 'Gorefist', kind: 'armor', type: 'armor', slot: 'hands', icon: 'gauntlet', classes: ['war'], unique: 'gorefist', base: { atk: [2, 0.4], def: [0.5, 0.15] }, desc: 'Spiked knuckles, never quite clean.' }),
  L('ninth_legion_banner', { name: 'Banner of the Ninth Legion', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'banner', classes: ['war'], unique: 'ninth_legion', base: { def: [1, 0.3], hp: [5, 1.2] }, desc: 'The legion that never retreated. None of them came home.' }),
  L('siegebreaker', { name: 'Siegebreaker', ...W('hammer'), icon: 'hammer', classes: ['war'], unique: 'siegebreaker', dmgMult: 1.12, minIlvl: 12, desc: 'A maul that ended three sieges by itself. Two-handed.' }),
  // ---------------------------------------------------------------- Famine
  L('scales_last_harvest', { name: 'Scales of the Last Harvest', kind: 'relic', type: 'relic', slot: 'relic', icon: 'scalesRelic', classes: ['famine'], unique: 'scales_last_harvest', base: { wis: [2, 0.3] }, desc: 'Everything is weighed. Everything is found wanting.' }),
  L('locust_hood', { name: 'Locust Hood', kind: 'armor', type: 'armor', slot: 'head', icon: 'hood', classes: ['famine'], unique: 'locust_hood', base: { int: [2, 0.3], resist: [3, 0.4] }, desc: 'It rustles with wings when you speak.' }),
  L('blightroot_sickle', { name: 'Blightroot Sickle', ...W('dagger'), icon: 'sickle', classes: ['famine'], unique: 'blightroot_sickle', dmgMult: 1.08, desc: 'Grown, not forged.' }),
  // ---------------------------------------------------------------- Death
  L('gravecaller_gloves', { name: 'Gravecaller Gloves', kind: 'armor', type: 'armor', slot: 'hands', icon: 'wraps', classes: ['death'], unique: 'gravecaller', base: { int: [2, 0.3], critDmg: [5, 0.4] }, desc: 'The dead answer when these knock.' }),
  L('ferrymans_coin', { name: "Ferryman's Coin", kind: 'ring', type: 'armor', slot: 'ring', icon: 'signet', classes: ['death'], unique: 'ferrymans_coin', base: { hp: [4, 1] }, desc: 'Payment for a crossing. Someone always pays.' }),
  L('requiem_scythe', { name: 'Requiem', ...W('scythe'), icon: 'scythe', classes: ['death'], unique: 'requiem', dmgMult: 1.1, minIlvl: 14, desc: 'Its swing is a hymn for the dead. Two-handed.' }),
  // ---------------------------------------------------------------- any Horseman
  L('heart_first_seal', { name: 'Heart of the First Seal', kind: 'relic', type: 'relic', slot: 'relic', icon: 'sealRelic', unique: 'heart_first_seal', base: { hp: [8, 1.6] }, desc: 'It beats, slowly, against your palm.' }),
  L('nephilim_girdle', { name: "Nephilim's Girdle", kind: 'armor', type: 'armor', slot: 'legs', icon: 'greaves', unique: 'nephilim_girdle', minIlvl: 30, base: { hpPct: [4, 0.1], def: [1.2, 0.3] }, desc: 'Cut from the belt of a giant who fell from heaven, or so they say.' }),
  L('abyss_touched_ring', { name: 'Abyss-Touched Ring', kind: 'ring', type: 'armor', slot: 'ring', icon: 'soulring', unique: 'abyss_touched', minIlvl: 36, base: { atk: [1, 0.25] }, desc: 'Look into the stone too long and it looks back.' }),
  L('seraph_feather', { name: "Seraph's Feather", kind: 'relic', type: 'relic', slot: 'relic', icon: 'totem', unique: 'seraph_feather', minIlvl: 20, base: { resist: [3, 0.3] }, desc: 'White, and warm, and very far from home.' }),
  L('gorgons_eye', { name: "Gorgon's Eye", kind: 'ring', type: 'armor', slot: 'ring', icon: 'ring', unique: 'gorgons_eye', minIlvl: 32, base: { crit: [1, 0.06] }, desc: 'It never blinks.' }),
  L('cerberus_collar', { name: 'Collar of Cerberus', kind: 'relic', type: 'relic', slot: 'relic', icon: 'idol', unique: 'cerberus_collar', minIlvl: 38, base: { atk: [1.5, 0.3] }, desc: 'Three heads, one leash.' }),
  L('dragonscale_aegis', { name: 'Dragonscale Aegis', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'shield', classes: ['war', 'death'], unique: 'dragonscale', minIlvl: 40, base: { def: [2, 0.4], resist: [5, 0.3] }, desc: 'A single scale of the Great Dragon. A tower could hide behind it.' }),
  L('prophets_lie', { name: "The Prophet's Lie", kind: 'ring', type: 'armor', slot: 'ring', icon: 'signet', unique: 'prophets_lie', minIlvl: 36, base: { lck: [2, 0.3] }, desc: 'It shows you where you are not.' }),
  L('lantern_lost_road', { name: 'Lantern of the Lost Road', kind: 'relic', type: 'relic', slot: 'relic', icon: 'lantern', unique: 'lantern_lost_road', base: { hp: [3, 0.8] }, desc: 'It burns brighter near hidden places.' }),
  // ---------------------------------------------------------------- new Mythics (one more per Horseman)
  MY('unerring_arrow', { name: 'The Unerring Arrow', ...W('bow'), icon: 'bow', classes: ['conquest'], unique: 'unerring_arrow', dmgMult: 1.18, critAdd: 0.05, desc: 'It has never missed. It never will.' }),
  MY('red_kings_mantle', { name: "The Red King's Mantle", kind: 'armor', type: 'armor', slot: 'chest', icon: 'regalia', classes: ['war'], unique: 'red_kings_mantle', base: { def: [2.2, 0.45], hp: [10, 2] }, desc: 'Woven from the banners of every army he broke.' }),
  MY('empty_chalice', { name: 'The Empty Chalice', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'chalice', classes: ['famine'], unique: 'empty_chalice', base: { skillPower: [8, 1.2], wis: [3, 0.4] }, desc: 'However much you pour in, it is always empty.' }),
  MY('pale_crown', { name: 'The Pale Crown', kind: 'armor', type: 'armor', slot: 'head', icon: 'crown', classes: ['death'], unique: 'pale_crown', base: { int: [3, 0.4], def: [1, 0.3] }, desc: 'Worn by the one who comes last.' }),
];

// ---------------------------------------------------------------- 4 new sets (pieces)
const SP = (id, name, slot, icon, setId, base, extra = {}) => ({ id, name, kind: slot === 'offHand' ? 'offhand' : slot === 'ring' ? 'ring' : 'armor', type: 'armor', slot, icon, setId, uniqueOnly: 'set', base, value: 70, stack: 1, minIlvl: 1, desc: 'Part of a set.', ...extra });
export const NEW_SET_PIECES = [
  SP('gk_helm', "Gravekeeper's Helm", 'head', 'helm', 'gravekeeper', { def: [1, 0.25], hp: [5, 1.2] }),
  SP('gk_coat', "Gravekeeper's Coat", 'chest', 'bonemail', 'gravekeeper', { def: [1.3, 0.3], statusResist: [3, 0.2] }),
  SP('gk_lantern', "Gravekeeper's Lantern", 'offHand', 'lantern', 'gravekeeper', { resist: [3, 0.3], hp: [3, 0.8] }),
  SP('gk_ring', "Gravekeeper's Ring", 'ring', 'ring', 'gravekeeper', { lck: [1, 0.2], hp: [3, 0.6] }),
  SP('wl_helm', 'Legion Crest Helm', 'head', 'helm', 'warforged_legion', { def: [1.2, 0.28], atk: [0.8, 0.2] }),
  SP('wl_plate', 'Legion Breastplate', 'chest', 'plate', 'warforged_legion', { def: [1.8, 0.4], hp: [6, 1.4] }),
  SP('wl_gauntlets', 'Legion Gauntlets', 'hands', 'gauntlet', 'warforged_legion', { atk: [1.5, 0.35], armorPen: [0.5, 0.1] }),
  SP('wl_greaves', 'Legion Greaves', 'legs', 'greaves', 'warforged_legion', { def: [1, 0.25], hp: [5, 1.1] }),
  SP('aw_mask', 'Abyssal Watcher Mask', 'head', 'mask', 'abyssal_watch', { evasion: [2, 0.1], crit: [1, 0.06] }),
  SP('aw_cloak', 'Abyssal Watcher Cloak', 'chest', 'robe', 'abyssal_watch', { def: [1, 0.3], evasion: [2, 0.12] }),
  SP('aw_grips', 'Abyssal Watcher Grips', 'hands', 'wraps', 'abyssal_watch', { accuracy: [3, 0.25], atkSpeed: [2, 0.1] }),
  SP('aw_treads', 'Abyssal Watcher Treads', 'legs', 'boots', 'abyssal_watch', { moveSpeed: [3, 0.1], evasion: [1, 0.08] }),
  SP('sr_halo', "Seraph's Ruined Halo", 'head', 'crown', 'seraphs_ruin', { skillPower: [4, 0.6], resist: [3, 0.3] }),
  SP('sr_vestment', "Seraph's Ruined Vestment", 'chest', 'robe', 'seraphs_ruin', { def: [1.1, 0.3], skillPower: [4, 0.7] }),
  SP('sr_wraps', "Seraph's Ruined Wraps", 'hands', 'wraps', 'seraphs_ruin', { int: [2, 0.3], wis: [1, 0.2] }),
  SP('sr_sandals', "Seraph's Ruined Sandals", 'legs', 'boots', 'seraphs_ruin', { resist: [3, 0.3], hp: [3, 0.8] }),
];
