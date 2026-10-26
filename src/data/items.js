import { materialItemDefs } from './materials.js';
import { buildCatalog } from './itemCatalog.js';
import { CURATED, NEW_SET_PIECES } from './uniqueItems.js';

// Static item definitions (ItemDefinition) + rarity tiers + equipment slot definitions.
// Generated item INSTANCES (level, rarity, affixes, rolls, uid, seed) are built by ItemGenerator;
// nothing here is mutated at runtime.

// statMult scales base stats; [rollMin, rollMax] bounds where affix rolls land inside their range.
export const RARITIES = {
  common:    { id: 'common',    label: 'COMMON',    color: '#b8b2a0', border: '#5e5a4e', statMult: 1.00, roll: [0.0, 0.55], affixes: [0, 0], valueMult: 1,  glow: 0.0 },
  uncommon:  { id: 'uncommon',  label: 'UNCOMMON',  color: '#5fbf4a', border: '#2e6a24', statMult: 1.05, roll: [0.1, 0.7],  affixes: [1, 1], valueMult: 2,  glow: 0.4 },
  rare:      { id: 'rare',      label: 'RARE',      color: '#5a8ff0', border: '#284a8a', statMult: 1.10, roll: [0.25, 0.85], affixes: [2, 2], valueMult: 4,  glow: 0.6 },
  epic:      { id: 'epic',      label: 'EPIC',      color: '#b862ea', border: '#5e2a80', statMult: 1.15, roll: [0.4, 0.95], affixes: [3, 3], valueMult: 8,  glow: 0.8 },
  legendary: { id: 'legendary', label: 'LEGENDARY', color: '#f29a2a', border: '#8a4e10', statMult: 1.20, roll: [0.55, 1.0], affixes: [3, 4], valueMult: 16, glow: 1.0, legendaryEffect: true },
  mythic:    { id: 'mythic',    label: 'MYTHIC',    color: '#ff5a6e', border: '#8a1424', statMult: 1.25, roll: [0.7, 1.0],  affixes: [2, 4], valueMult: 40, glow: 1.0, uniqueEffect: true },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// EquipmentSlotDefinition: exactly eight primary slots.
export const EQUIP_SLOTS = ['head', 'chest', 'hands', 'legs', 'mainHand', 'offHand', 'ring', 'relic'];
export const SLOT_DEFS = {
  head: { label: 'HEAD', short: 'HEAD', icon: 'helm' },
  chest: { label: 'CHEST', short: 'CHST', icon: 'plate' },
  hands: { label: 'HANDS', short: 'HAND', icon: 'gauntlet' },
  legs: { label: 'LEGS', short: 'LEGS', icon: 'greaves' },
  mainHand: { label: 'MAIN HAND', short: 'MAIN', icon: 'sword' },
  offHand: { label: 'OFF HAND', short: 'OFF', icon: 'shield' },
  ring: { label: 'RING', short: 'RING', icon: 'ring' },
  relic: { label: 'RELIC', short: 'RELC', icon: 'shardRelic' },
};
export const EQUIP_LABELS = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, SLOT_DEFS[s].label]));

// base: { stat: [valueAtIlvl0, perItemLevel] } (flat stats). Weapons use archetype damage (weapons.js) x dmgMult.
// uniqueOnly: 'mythic' | 'set' => only created by explicit sources (boss tables, rewards), never random.
const D = {};
const def = (id, o) => { D[id] = { id, stack: 1, value: 10, minIlvl: 1, ...o }; };

// ---------------------------------------------------------------- main hand
def('rusted_sword', { name: 'Rusted Sword', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'sword', icon: 'sword', value: 12, desc: 'A pitted blade from a forgotten war.' });
def('knight_longsword', { name: 'Knight Longsword', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'sword', icon: 'longsword', value: 24, dmgMult: 1.12, minIlvl: 3, desc: 'Balanced steel of the fallen order.' });
def('war_axe', { name: 'War Axe', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'axe', value: 30, desc: "A headsman's axe. Two-handed: cleaves and staggers." });
def('reaper_scythe', { name: 'Reaper Scythe', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'scythe', value: 34, critAdd: 0.04, classes: ['death'], desc: 'A long pale blade. Two-handed.' });
def('hunter_crossbow', { name: 'Hunter Crossbow', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'crossbow', icon: 'crossbow', value: 35, desc: 'Strike from afar. Two-handed, slow to reload.' });
def('pale_longbow', { name: 'Pale Longbow', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'crossbow', icon: 'bow', value: 38, dmgMult: 0.95, critAdd: 0.05, classes: ['conquest'], desc: "A king's hunting bow. Two-handed." });
def('cursed_dagger', { name: 'Cursed Dagger', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'dagger', icon: 'dagger', value: 28, desc: 'Whispers of the void. Quick and cruel.' });
def('hunger_sickle', { name: 'Hunger Sickle', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'dagger', icon: 'sickle', value: 30, dmgMult: 1.05, classes: ['famine'], desc: 'It reaps what the famine leaves.' });
// mythic uniques (one per Horseman; boss / reward sources only)
def('sunlance', { name: 'Sunlance', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'crossbow', icon: 'bow', value: 400, dmgMult: 1.2, critAdd: 0.05, classes: ['conquest'], uniqueOnly: 'mythic', unique: 'sunlance', desc: 'The White Crown\'s first conquest.' });
def('worldbreaker', { name: 'Worldbreaker, Edge of the Red Apocalypse', short: 'Worldbreaker', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'axe', value: 400, dmgMult: 1.2, classes: ['war'], uniqueOnly: 'mythic', unique: 'worldbreaker', desc: 'It has ended a hundred wars.' });
def('maw_of_famine', { name: 'Maw of the Black Rider', short: 'Maw of Famine', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'dagger', icon: 'sickle', value: 400, dmgMult: 1.2, classes: ['famine'], uniqueOnly: 'mythic', unique: 'maw_of_famine', desc: 'Every cut is a hunger that never ends.' });
def('last_silence', { name: 'The Last Silence', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'scythe', value: 400, dmgMult: 1.15, critAdd: 0.05, classes: ['death'], uniqueOnly: 'mythic', unique: 'last_silence', desc: 'The sound the world makes after.' });

// ---------------------------------------------------------------- armour
def('iron_helm', { name: 'Iron Helm', kind: 'armor', type: 'armor', slot: 'head', icon: 'helm', base: { def: [0.8, 0.25], hp: [4, 1.5] }, desc: 'Dented, dependable.' });
def('pale_circlet', { name: 'Pale Circlet', kind: 'armor', type: 'armor', slot: 'head', icon: 'crown', base: { crit: [1.5, 0.1], def: [0.5, 0.2] }, desc: 'A thin band of tarnished silver.' });
def('plague_hood', { name: 'Plague Hood', kind: 'armor', type: 'armor', slot: 'head', icon: 'hood', base: { wis: [1, 0.3], int: [1, 0.3], resist: [3, 0.5] }, desc: 'Smells of myrrh and rot.' });
def('breastplate', { name: 'Breastplate', kind: 'armor', type: 'armor', slot: 'chest', icon: 'plate', base: { def: [1.5, 0.4], hp: [8, 2] }, desc: 'Heavy steel plate.' });
def('ash_robe', { name: 'Robe of Ash', kind: 'armor', type: 'armor', slot: 'chest', icon: 'robe', base: { def: [1, 0.3], skillPower: [4, 1], resist: [4, 0.6] }, desc: 'Woven from burial shrouds.' });
def('leather_jerkin', { name: 'Leather Jerkin', kind: 'armor', type: 'armor', slot: 'chest', icon: 'jerkin', base: { def: [1, 0.25], evasion: [2, 0.2] }, desc: 'Light and quiet.' });
def('gauntlets', { name: 'Gauntlets', kind: 'armor', type: 'armor', slot: 'hands', icon: 'gauntlet', base: { atk: [1.5, 0.4], def: [0.5, 0.2] }, desc: 'Steel knuckles.' });
def('hand_wraps', { name: 'Hand Wraps', kind: 'armor', type: 'armor', slot: 'hands', icon: 'wraps', base: { atkSpeed: [3, 0.3], accuracy: [3, 0.3] }, desc: 'Bandaged, blood-stiffened.' });
def('greaves', { name: 'Greaves', kind: 'armor', type: 'armor', slot: 'legs', icon: 'greaves', base: { def: [1, 0.25], hp: [5, 1.2] }, desc: 'Plated leg armour.' });
def('shadow_boots', { name: 'Shadow Boots', kind: 'armor', type: 'armor', slot: 'legs', icon: 'boots', base: { evasion: [3, 0.3], moveSpeed: [3, 0.2] }, desc: 'Soft soles that never echo.' });

// ---------------------------------------------------------------- off hand (class / weapon rules)
def('tower_shield', { name: 'Tower Shield', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'shield', classes: ['war', 'death'], base: { def: [1.5, 0.4], damageReduction: [3, 0.3] }, desc: 'Cannot be used with two-handed weapons.' });
def('grimoire', { name: 'Grimoire', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'tome', classes: ['famine', 'death', 'conquest'], base: { skillPower: [6, 1.2], int: [2, 0.4] }, desc: 'Pages of dead tongues.' });
def('war_talisman', { name: 'War Talisman', kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'talisman', base: { resGain: [4, 0.4], wis: [1, 0.3] }, desc: 'A charm of bone and iron.' });

// ---------------------------------------------------------------- rings
def('iron_band', { name: 'Iron Band', kind: 'ring', type: 'armor', slot: 'ring', icon: 'ring', base: { crit: [1, 0.1] }, desc: 'A plain band.' });
def('signet', { name: 'Signet', kind: 'ring', type: 'armor', slot: 'ring', icon: 'signet', base: { lck: [2, 0.4] }, desc: 'Bears a broken crest.' });

// ---------------------------------------------------------------- relics (build-defining effects at every rarity)
def('shard_first_seal', { name: 'Shard of the First Seal', kind: 'relic', type: 'relic', slot: 'relic', icon: 'shardRelic', unique: 'echo_strike', base: { hp: [3, 1] }, desc: 'Still warm.' });
def('crown_fragment', { name: 'Crown Fragment', kind: 'relic', type: 'relic', slot: 'relic', icon: 'crown', unique: 'royal_command', classes: ['conquest'], base: { crit: [1, 0.1] }, desc: 'A shard of a broken halo.' });
def('bloodied_banner', { name: 'Bloodied Banner', kind: 'relic', type: 'relic', slot: 'relic', icon: 'banner', unique: 'blood_tithe', classes: ['war'], base: { atk: [1, 0.3] }, desc: 'Carried over a thousand dead.' });
def('black_scales', { name: 'Black Scales', kind: 'relic', type: 'relic', slot: 'relic', icon: 'scalesRelic', unique: 'hungering_scales', classes: ['famine'], base: { wis: [1, 0.3] }, desc: 'They always tip toward hunger.' });
def('pale_lantern', { name: 'Pale Lantern', kind: 'relic', type: 'relic', slot: 'relic', icon: 'lantern', unique: 'pale_lantern', classes: ['death'], base: { int: [1, 0.3] }, desc: 'Lights the way for the departed.' });

// ---------------------------------------------------------------- set pieces (uniqueOnly 'set'; see sets.js)
const setPiece = (id, name, slot, icon, setId, cls, base) => def(id, { name, kind: 'armor', type: 'armor', slot, icon, setId, classes: [cls], uniqueOnly: 'set', base, value: 60, desc: 'Part of a Horseman set.' });
setPiece('wc_crown', 'Crown of the Pale King', 'head', 'crown', 'white_crown', 'conquest', { crit: [3, 0.2], def: [1, 0.3] });
setPiece('wc_mantle', 'Ivory Mantle', 'chest', 'robe', 'white_crown', 'conquest', { def: [1, 0.3], hp: [6, 1.5] });
setPiece('wc_bracers', 'Gilded Bracers', 'hands', 'wraps', 'white_crown', 'conquest', { accuracy: [4, 0.3], atk: [1, 0.3] });
setPiece('wc_greaves', 'Pale Greaves', 'legs', 'greaves', 'white_crown', 'conquest', { def: [1.5, 0.4], evasion: [2, 0.2] });
setPiece('rb_helm', 'Warlord Helm', 'head', 'helm', 'red_battlefield', 'war', { def: [1, 0.25], hp: [6, 1.5] });
setPiece('rb_plate', 'Bloodsoaked Plate', 'chest', 'plate', 'red_battlefield', 'war', { def: [2, 0.45], hp: [8, 2] });
setPiece('rb_gauntlets', 'Gauntlets of Carnage', 'hands', 'gauntlet', 'red_battlefield', 'war', { atk: [2, 0.5], armorPen: [1, 0.2] });
setPiece('rb_greaves', 'Greaves of the March', 'legs', 'greaves', 'red_battlefield', 'war', { def: [1, 0.25], hp: [5, 1.2] });
setPiece('bh_hood', 'Hood of Hunger', 'head', 'hood', 'black_harvest', 'famine', { wis: [2, 0.4], resist: [3, 0.5] });
setPiece('bh_robe', 'Robe of Scarcity', 'chest', 'robe', 'black_harvest', 'famine', { skillPower: [5, 1], def: [1, 0.3] });
setPiece('bh_grips', 'Withered Grips', 'hands', 'wraps', 'black_harvest', 'famine', { int: [2, 0.4], atkSpeed: [2, 0.2] });
setPiece('bh_treads', 'Barren Treads', 'legs', 'boots', 'black_harvest', 'famine', { evasion: [2, 0.2], hp: [4, 1] });
setPiece('pr_cowl', 'Cowl of the Reaper', 'head', 'hood', 'pale_reaper', 'death', { int: [2, 0.4], crit: [1, 0.1] });
setPiece('pr_shroud', 'Shroud of Ash', 'chest', 'robe', 'pale_reaper', 'death', { def: [2, 0.5], skillPower: [4, 1] });
setPiece('pr_gloves', 'Bone Gloves', 'hands', 'gauntlet', 'pale_reaper', 'death', { atk: [1.5, 0.4], critDmg: [5, 0.5] });
setPiece('pr_walkers', 'Grave Walkers', 'legs', 'boots', 'pale_reaper', 'death', { def: [1.5, 0.4], moveSpeed: [3, 0.2] });

// ---------------------------------------------------------------- consumables + materials (stackable, no affixes)
def('health_potion', { name: 'Health Potion', kind: 'consumable', type: 'consumable', icon: 'potion', heal: 40, stack: 9, value: 15, desc: 'Restores 40 HP.' });
def('dark_elixir', { name: 'Dark Elixir', kind: 'consumable', type: 'consumable', icon: 'elixir', resource: 0.4, stack: 5, value: 25, desc: 'Restores 40% of your class resource.' });
def('iron_shard', { name: 'Iron Shard', kind: 'material', type: 'material', icon: 'shard', stack: 999, value: 3, materialValue: 1, tier: 'legacy', desc: 'Common crafting material.' });
def('cursed_ash', { name: 'Cursed Ash', kind: 'material', type: 'material', icon: 'ash', stack: 999, value: 8, materialValue: 3, tier: 'legacy', desc: 'Ash from a burned grave.' });
def('fallen_essence', { name: 'Fallen Essence', kind: 'material', type: 'material', icon: 'essence', stack: 999, value: 20, materialValue: 8, tier: 'legacy', desc: 'What remains of a fallen knight.' });
def('soul_fragment', { name: 'Soul Fragment', kind: 'material', type: 'material', icon: 'soulfrag', stack: 999, value: 45, materialValue: 20, tier: 'legacy', desc: 'A sliver of a trapped soul.' });
def('apocalyptic_core', { name: 'Apocalyptic Core', kind: 'material', type: 'material', icon: 'core', stack: 999, value: 150, materialValue: 60, tier: 'legacy', desc: 'It hums with the end of the world.' });

// ---------------------------------------------------------------- Phase 4: dungeon materials (data/materials.js)
for (const m of materialItemDefs()) D[m.id] = m;

// ---------------------------------------------------------------- Phase 4: consumables
def('greater_health_potion', { name: 'Greater Health Potion', kind: 'consumable', type: 'consumable', icon: 'potion', heal: 120, stack: 9, value: 45, desc: 'Restores 120 HP.' });
def('purifying_draught', { name: 'Purifying Draught', kind: 'consumable', type: 'consumable', icon: 'elixir', cure: true, healPct: 0.15, stack: 5, value: 60, desc: 'Cures Blight, Curses and Sunder; restores 15% HP.' });

// ---------------------------------------------------------------- Phase 4: crafted-only equipment (uniqueOnly 'crafted')
const crafted = (id, o) => def(id, { uniqueOnly: 'crafted', value: 80, ...o });
crafted('forged_rusted_sword', { name: 'Grave-Forged Sword', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'sword', icon: 'sword', dmgMult: 1.08, desc: 'Rusted iron re-forged with bone ash.' });
crafted('tempered_war_axe', { name: 'Tempered War Axe', kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'axe', dmgMult: 1.18, minIlvl: 10, base: { armorPen: [2, 0.15] }, desc: 'Folded war steel. Two-handed.' });
crafted('withering_charm', { name: 'Withering Charm', kind: 'ring', type: 'armor', slot: 'ring', icon: 'talisman', minIlvl: 18, base: { dotDmg: [6, 0.3], wis: [2, 0.3] }, desc: 'A knot of withered root around a black seed.' });
crafted('soulbound_ring', { name: 'Soulbound Ring', kind: 'ring', type: 'armor', slot: 'ring', icon: 'ring', minIlvl: 30, base: { skillPower: [5, 0.4], resist: [4, 0.25] }, desc: 'A ring with a captive soul for a gem.' });
crafted('apocalyptic_relic', { name: 'Apocalyptic Relic', kind: 'relic', type: 'relic', slot: 'relic', icon: 'shardRelic', unique: 'end_of_days', minIlvl: 40, base: { hp: [10, 2] }, value: 500, desc: 'The end of the world, held in one hand.' });
// boss-core equipment (recipes unlocked by defeating the boss)
crafted('wardens_bulwark', { name: "Warden's Bulwark", kind: 'offhand', type: 'armor', slot: 'offHand', icon: 'shield', base: { def: [2, 0.4], damageReduction: [4, 0.2], statusResist: [5, 0.2] }, desc: 'A tomb door turned shield.' });
crafted('tyrant_crown', { name: "Tyrant's Crown", kind: 'armor', type: 'armor', slot: 'head', icon: 'crown', minIlvl: 12, base: { atk: [3, 0.4], def: [1.5, 0.3], armorPen: [2, 0.2] }, desc: 'Heavy with the will of a warlord.' });
crafted('harvester_sickle', { name: "Harvester's Sickle", kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'dagger', icon: 'sickle', minIlvl: 22, dmgMult: 1.15, base: { dotDmg: [8, 0.3] }, desc: 'It reaps vitality with every cut.' });
crafted('executors_verdict', { name: "Executor's Verdict", kind: 'weapon', type: 'weapon', slot: 'mainHand', weaponId: 'axe', icon: 'scythe', minIlvl: 36, dmgMult: 1.2, critAdd: 0.05, base: { executeDmg: [10, 0.3] }, desc: 'The last judgement, given an edge. Two-handed.' });

// ---------------------------------------------------------------- Phase 5: catalog + curated items
for (const c of buildCatalog()) D[c.id] = c;                 // ~300 family x tier bases
for (const c of [...CURATED, ...NEW_SET_PIECES]) D[c.id] = c;  // curated Legendaries / Mythics / set pieces

export const ITEM_DEFS = D;
export const CURATED_LEGENDARY_IDS = Object.values(D).filter((d) => d.uniqueOnly === 'legendary').map((d) => d.id);
export const CATALOG_IDS = Object.values(D).filter((d) => d.catalog).map((d) => d.id);
export const MATERIAL_IDS = Object.values(D).filter((d) => d.kind === 'material').map((d) => d.id);
export const WEAPON_ITEM_IDS = Object.values(D).filter((d) => d.kind === 'weapon' && !d.uniqueOnly).map((d) => d.id);
// Bases that random equipment drops can pick from (everything wearable that isn't uniqueOnly).
export const RANDOM_EQUIPMENT_IDS = Object.values(D).filter((d) => d.slot && !d.uniqueOnly && d.kind !== 'relic').map((d) => d.id);
export const RELIC_IDS = Object.values(D).filter((d) => d.kind === 'relic' && !d.uniqueOnly).map((d) => d.id);
export const MYTHIC_IDS = Object.values(D).filter((d) => d.uniqueOnly === 'mythic').map((d) => d.id);
export const isStackable = (d) => (d.stack || 1) > 1;
