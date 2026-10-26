import { ITEM_DEFS, CATALOG_IDS, CURATED_LEGENDARY_IDS, MYTHIC_IDS } from './items.js';
import { AFFIXES } from './affixes.js';
import { SETS } from './sets.js';
import { WEAPONS } from './weapons.js';
import { LEGENDARY_EFFECTS } from './legendaryEffects.js';
import { STATUSES } from './statuses.js';
import { ENEMIES, ENEMY_VARIANTS } from './enemies.js';
import { BOSSES } from './bosses.js';
import { CHAMPION_MODS } from './difficulty.js';
import { LOOT_TABLES } from './lootTables.js';
import { RECIPES, REFORGE } from './recipes.js';
import { MATERIAL_DEFS } from './materials.js';
import { DUNGEONS, DUNGEON_ORDER } from './dungeons/index.js';
import { CHAPTERS, QUESTS, NPCS, KEY_ITEMS, ENDINGS } from './campaign.js';
import { LORE, LORE_BY_ID } from './lore.js';

// Content registry + validator (Phase 5). One place that knows every content collection, so tools,
// tests and the journal can count, look up and cross-check them. validateContent() reports every
// missing reference / invalid id / broken rule as a readable line; it never throws.
// Run in node:  node tools/validate-content.mjs      in the browser:  ?test5 (part of the suite)
export const REGISTRY = {
  items: ITEM_DEFS, affixes: AFFIXES, sets: SETS, weapons: WEAPONS, effects: LEGENDARY_EFFECTS, statuses: STATUSES,
  enemies: ENEMIES, variants: CHAMPION_MODS, bosses: BOSSES, lootTables: LOOT_TABLES, recipes: Object.fromEntries(RECIPES.map((r) => [r.id, r])),
  materials: MATERIAL_DEFS, dungeons: DUNGEONS, chapters: Object.fromEntries(CHAPTERS.map((c) => [c.id, c])),
  quests: Object.fromEntries(QUESTS.map((q) => [q.id, q])), npcs: NPCS, keyItems: KEY_ITEMS, lore: LORE_BY_ID, endings: ENDINGS,
};

const ABILITY_KINDS = new Set(['bolt', 'charge', 'nova', 'empower', 'summon', 'gaze']);
const ATTACK_KINDS = new Set(['melee', 'area', 'summon', 'barrier', 'drain', 'curse', 'hazard', 'empower', 'illusion']);
const AI_KINDS = new Set([undefined, 'melee', 'ranged', 'charger', 'support', 'summoner', 'cursed', 'guardian', 'swarm', 'illusion']);
const OBJ_TYPES = new Set(['talk', 'boss', 'complete', 'keyItem', 'kill', 'collect', 'craft', 'secret', 'puzzle', 'reach', 'lore', 'deliver']);
// statuses applied by the four Horsemen's mechanics; a boss may resist a few, never most of them
export const CLASS_STATUSES = ['mark', 'decree', 'armor_break', 'stagger', 'wither', 'plague', 'starved', 'grave_mark'];

export function contentCounts() {
  const items = Object.values(ITEM_DEFS);
  const eq = items.filter((d) => d.slot);
  return {
    baseItems: eq.length, catalogBases: CATALOG_IDS.length, affixes: Object.keys(AFFIXES).length,
    curatedLegendaries: CURATED_LEGENDARY_IDS.length, mythics: MYTHIC_IDS.length, sets: Object.keys(SETS).length,
    enemies: Object.keys(ENEMIES).length, variants: Object.keys(CHAMPION_MODS).length, bosses: Object.keys(BOSSES).length,
    minibosses: Object.values(BOSSES).filter((b) => b.miniboss).length, dungeons: DUNGEON_ORDER.length,
    chapters: CHAPTERS.length, quests: QUESTS.length, mainQuests: QUESTS.filter((q) => !q.side).length, sideQuests: QUESTS.filter((q) => q.side).length,
    npcs: Object.keys(NPCS).length, lore: LORE.length, recipes: RECIPES.length, lootTables: Object.keys(LOOT_TABLES).length,
  };
}

export function validateContent() {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const item = (id, where) => { if (!ITEM_DEFS[id]) err(`${where}: unknown item '${id}'`); };
  const table = (id, where) => { if (id && !LOOT_TABLES[id]) err(`${where}: unknown loot table '${id}'`); };

  // ---------------------------------------------------------------- items
  for (const [id, d] of Object.entries(ITEM_DEFS)) {
    if (d.id !== id) err(`item ${id}: id field '${d.id}' does not match its key`);
    if (d.weaponId && !WEAPONS[d.weaponId]) err(`item ${id}: unknown weapon behaviour '${d.weaponId}'`);
    if (d.setId && !SETS[d.setId]) err(`item ${id}: unknown set '${d.setId}'`);
    if (d.effect && !LEGENDARY_EFFECTS[d.effect]) err(`item ${id}: unknown unique effect '${d.effect}'`);
    if (d.catalog && !(d.minIlvl <= d.maxIlvl)) err(`item ${id}: catalog ilvl window ${d.minIlvl}-${d.maxIlvl} is invalid`);
    for (const dg of d.dungeons || []) if (!DUNGEONS[dg]) err(`item ${id}: unknown source dungeon '${dg}'`);
  }
  for (const [id, s] of Object.entries(SETS)) {
    for (const p of s.pieces || []) { if (!ITEM_DEFS[p]) err(`set ${id}: unknown piece '${p}'`); else if (ITEM_DEFS[p].setId !== id) err(`set ${id}: piece '${p}' does not point back to the set`); }
  }
  for (const [id, a] of Object.entries(AFFIXES)) {
    if (a.requires?.tag && !Object.values(ITEM_DEFS).some((d) => (d.tags || []).includes(a.requires.tag))) warn(`affix ${id}: no item carries tag '${a.requires.tag}' (it can never roll)`);
  }
  for (const [id, e] of Object.entries(LEGENDARY_EFFECTS)) {
    for (const act of e.actions || []) if (act.status && !STATUSES[act.status]) err(`effect ${id}: unknown status '${act.status}'`);
    if (e.trigger && !e.icd && (e.actions || []).some((x) => x.type === 'damage' || x.type === 'status')) warn(`effect ${id}: proc without an internal cooldown`);
  }
  if (CURATED_LEGENDARY_IDS.length < 20) err(`only ${CURATED_LEGENDARY_IDS.length} curated legendaries (need 20)`);
  if (MYTHIC_IDS.length < 8) err(`only ${MYTHIC_IDS.length} mythics (need 8)`);
  if (Object.keys(SETS).length < 8) err(`only ${Object.keys(SETS).length} sets (need 8)`);
  if (Object.keys(AFFIXES).length < 50) err(`only ${Object.keys(AFFIXES).length} affixes (need 50)`);

  // ---------------------------------------------------------------- enemies & bosses
  for (const [id, e] of Object.entries(ENEMIES)) {
    const w = `enemy ${id}`;
    if (e.id !== id) err(`${w}: id field mismatch`);
    for (const f of ['name', 'sprite', 'hp', 'rank']) if (e[f] === undefined) err(`${w}: missing '${f}'`);
    if (!e.illusion && !(e.xp >= 0)) err(`${w}: missing xp`);
    if (!AI_KINDS.has(e.ai)) err(`${w}: unknown ai '${e.ai}'`);
    table(e.lootTable, w);
    for (const a of e.abilities || []) {
      if (!ABILITY_KINDS.has(a.kind)) err(`${w}: ability '${a.id}' has unknown kind '${a.kind}'`);
      if (!(a.cd > 0) || !(a.windup > 0)) err(`${w}: ability '${a.id}' needs cd > 0 and a telegraph windup > 0 (no unavoidable damage)`);
      if (a.kind === 'summon') {
        if (!ENEMIES[a.spawn]) err(`${w}: ability '${a.id}' summons unknown '${a.spawn}'`);
        if (!(a.maxAlive > 0) || !(a.maxTotal > 0)) err(`${w}: summon '${a.id}' needs maxAlive and maxTotal caps (no endless summons)`);
      }
      if (a.kind === 'gaze' && !(a.dur <= 2)) err(`${w}: gaze '${a.id}' lasts ${a.dur}s (max 2s; no stun chains)`);
      if (a.inflict && !STATUSES[a.inflict.status]) err(`${w}: ability '${a.id}' inflicts unknown status '${a.inflict.status}'`);
    }
    for (const [s, v] of Object.entries(e.statusRules || {})) { if (!STATUSES[s]) err(`${w}: statusRules names unknown status '${s}'`); if (v !== 'immune' && !(typeof v === 'number' && v >= 0)) err(`${w}: statusRules.${s} must be 'immune' or a multiplier`); }
    for (const [k, v] of Object.entries(e.resist || {})) { if (!['basic', 'skill', 'dot'].includes(k)) err(`${w}: unknown resist '${k}'`); if (v > 0.6 || v < -0.5) err(`${w}: resist ${k} ${v} outside -0.5..0.6`); }
    if (!e.lore && !e.illusion) warn(`${w}: no lore text`);
  }
  for (const [id, v] of Object.entries(ENEMY_VARIANTS || {})) if (!ENEMIES[v.base]) err(`variant ${id}: unknown base '${v.base}'`);
  for (const [id, b] of Object.entries(BOSSES)) {
    const w = `boss ${id}`;
    if (b.id !== id) err(`${w}: id field mismatch`);
    if (!b.attacks || !Object.keys(b.attacks).length) err(`${w}: no attacks`);
    if (!Array.isArray(b.phases) || !b.phases.length) err(`${w}: no phases`);
    for (const [aid, a] of Object.entries(b.attacks || {})) {
      if (!ATTACK_KINDS.has(a.kind)) err(`${w}: attack '${aid}' has unknown kind '${a.kind}'`);
      if (!(a.windup > 0)) err(`${w}: attack '${aid}' has no telegraph windup`);
      if (a.kind === 'summon') { if (!ENEMIES[a.spawn]) err(`${w}: attack '${aid}' summons unknown '${a.spawn}'`); if (!(a.maxAlive > 0)) err(`${w}: attack '${aid}' has no maxAlive cap`); }
    }
    for (const ph of b.phases || []) for (const aid of ph.attacks || []) if (!b.attacks?.[aid]) err(`${w}: phase uses unknown attack '${aid}'`);
    for (const list of Object.values(b.difficultyAttacks || {})) for (const aid of list) if (!b.attacks?.[aid]) err(`${w}: difficultyAttacks names unknown attack '${aid}'`);
    if (!LOOT_TABLES[`boss_${id}`] && !LOOT_TABLES[b.lootTable]) err(`${w}: no loot table (boss_${id})`);
    const immune = CLASS_STATUSES.filter((s) => b.statusRules?.[s] === 'immune').length;
    if (immune > 2) err(`${w}: immune to ${immune} class mechanics (max 2)`);
    for (const r of b.unlockRecipes || []) if (!REGISTRY.recipes[r]) err(`${w}: unlocks unknown recipe '${r}'`);
  }

  // ---------------------------------------------------------------- loot, recipes, materials
  for (const [id, t] of Object.entries(LOOT_TABLES)) {
    for (const f of t.fixed || []) item(f.item, `loot ${id} fixed`);
    for (const e of t.entries || []) {
      if (e.type === 'item') item(e.item, `loot ${id}`);
      if (e.type === 'set' && e.set && !SETS[e.set]) err(`loot ${id}: unknown set '${e.set}'`);
      if (e.type === 'curated') for (const p of e.pool || []) item(p, `loot ${id} curated pool`);
    }
  }
  const recipeIds = new Set([...RECIPES.map((r) => r.id), REFORGE.recipe]);
  for (const r of RECIPES) {
    const w = `recipe ${r.id}`;
    for (const m of Object.keys(r.cost || {})) item(m, w);
    if (r.out?.item) item(r.out.item, w);
    if (r.out?.setPiece && !SETS[r.out.setPiece]) err(`${w}: unknown set '${r.out.setPiece}'`);
    const u = r.unlock;
    if (u?.boss && !BOSSES[u.boss]) err(`${w}: unlocks from unknown boss '${u.boss}'`);
    for (const k of ['completed', 'unlocked', 'secret']) if (u?.[k] && !DUNGEONS[u[k]]) err(`${w}: unknown dungeon '${u[k]}'`);
  }

  // ---------------------------------------------------------------- dungeons
  for (const id of DUNGEON_ORDER) {
    const d = DUNGEONS[id], w = `dungeon ${id}`;
    if (d.unlock?.completed && !DUNGEONS[d.unlock.completed]) err(`${w}: unlock names unknown dungeon '${d.unlock.completed}'`);
    if (d.boss && !BOSSES[d.boss]) err(`${w}: unknown boss '${d.boss}'`);
    for (const [f, b] of Object.entries(d.minibosses || {})) { if (!BOSSES[b]) err(`${w}: unknown miniboss '${b}'`); else if (!BOSSES[b].miniboss) err(`${w}: '${b}' is not flagged miniboss`); if (+f >= (d.floors || 1) - 0 || +f < 0) err(`${w}: miniboss floor ${f} out of range`); }
    for (const [e, cfg] of Object.entries(d.enemies || {})) { if (!ENEMIES[e]) err(`${w}: unknown enemy '${e}'`); table(cfg.loot, w); }
    for (const list of Object.values(d.encounters || {})) for (const enc of list) for (const e of enc.group) if (!d.enemies?.[e]) err(`${w}: encounter uses '${e}' which is not in its enemy list`);
    for (const t of Object.values(d.tables || {})) table(t, w);
    for (const r of d.secretRecipes || []) if (!recipeIds.has(r)) err(`${w}: unknown secret recipe '${r}'`);
    for (const l of d.lorePool || []) if (!LORE_BY_ID[l]) err(`${w}: lorePool names unknown lore '${l}'`);
  }

  // ---------------------------------------------------------------- campaign
  const chapterIds = new Set(CHAPTERS.map((c) => c.id));
  const questIds = new Set(QUESTS.map((q) => q.id));
  if (questIds.size !== QUESTS.length) err('campaign: duplicate quest ids');
  for (const c of CHAPTERS) {
    if (!DUNGEONS[c.dungeon]) err(`chapter ${c.id}: unknown dungeon '${c.dungeon}'`);
    const m = QUESTS.find((q) => q.id === c.mainQuest);
    if (!m) err(`chapter ${c.id}: unknown main quest '${c.mainQuest}'`); else if (m.side || m.chapter !== c.id) err(`chapter ${c.id}: main quest '${c.mainQuest}' is a side quest or belongs elsewhere`);
    for (const s of c.side) { const q = QUESTS.find((x) => x.id === s); if (!q) err(`chapter ${c.id}: unknown side quest '${s}'`); else if (!q.side || q.chapter !== c.id) err(`chapter ${c.id}: '${s}' is not a side quest of this chapter`); }
  }
  for (const q of QUESTS) {
    const w = `quest ${q.id}`;
    if (!chapterIds.has(q.chapter)) err(`${w}: unknown chapter '${q.chapter}'`);
    if (q.npc && !NPCS[q.npc]) err(`${w}: unknown npc '${q.npc}'`);
    if (q.turnIn && !NPCS[q.turnIn]) err(`${w}: unknown turn-in npc '${q.turnIn}'`);
    for (const p of q.prereq) if (!questIds.has(p)) err(`${w}: unknown prerequisite '${p}'`);
    if (!q.objectives?.length) err(`${w}: no objectives`);
    for (const o of q.objectives || []) {
      if (!OBJ_TYPES.has(o.type)) { err(`${w}: unknown objective type '${o.type}'`); continue; }
      if (!o.text) err(`${w}: objective without text`);
      if (o.npc && !NPCS[o.npc]) err(`${w}: objective npc '${o.npc}' unknown`);
      if (o.boss && !BOSSES[o.boss]) err(`${w}: objective boss '${o.boss}' unknown`);
      if (o.enemy && !ENEMIES[o.enemy]) err(`${w}: objective enemy '${o.enemy}' unknown`);
      if (o.dungeon && !DUNGEONS[o.dungeon]) err(`${w}: objective dungeon '${o.dungeon}' unknown`);
      if (o.material && !MATERIAL_DEFS[o.material]) err(`${w}: objective material '${o.material}' unknown`);
      if (o.recipe && !recipeIds.has(o.recipe)) err(`${w}: objective recipe '${o.recipe}' unknown`);
      if (o.item && !KEY_ITEMS[o.item]) err(`${w}: objective key item '${o.item}' unknown`);
      if (o.type === 'lore' && !chapterIds.has(o.chapter)) err(`${w}: lore objective chapter '${o.chapter}' unknown`);
      if (o.type === 'lore' && LORE.filter((l) => l.chapter === o.chapter && l.discovery.type === 'tablet').length < o.count) err(`${w}: needs ${o.count} tablets in ${o.chapter}, fewer exist`);
      if (o.type === 'reach' && o.floor >= (DUNGEONS[o.dungeon]?.floors || 1)) err(`${w}: reach floor ${o.floor} does not exist`);
      if (o.type === 'deliver' && !Object.values(q.grantOnBoss || {}).includes(o.item) && !(q.rewards.keyItems || []).includes(o.item) && !QUESTS.some((x) => (x.rewards.keyItems || []).includes(o.item))) err(`${w}: deliver item '${o.item}' is never granted`);
      if (o.type === 'deliver' && !q.turnIn) err(`${w}: deliver objective but no turn-in npc`);
    }
    for (const [b, k] of Object.entries(q.grantOnBoss || {})) { if (!BOSSES[b]) err(`${w}: grantOnBoss unknown boss '${b}'`); if (!KEY_ITEMS[k]) err(`${w}: grantOnBoss unknown key item '${k}'`); }
    const r = q.rewards || {};
    for (const m of Object.keys(r.materials || {})) item(m, `${w} reward`);
    for (const it of r.items || []) item(it.id, `${w} reward`);
    if (r.set && !SETS[r.set]) err(`${w}: reward set '${r.set}' unknown`);
    for (const rc of r.recipes || []) if (!recipeIds.has(rc)) err(`${w}: reward recipe '${rc}' unknown`);
    for (const l of r.lore || []) if (!LORE_BY_ID[l]) err(`${w}: reward lore '${l}' unknown`);
    if (q.ending && !Object.keys(ENDINGS).length) err(`${w}: ending quest but no endings`);
  }
  for (const e of Object.values(ENDINGS)) for (const l of e.reward?.lore || []) if (!LORE_BY_ID[l]) err(`ending ${e.id}: unknown lore '${l}'`);
  // lore entries must be discoverable
  const pooled = new Set(DUNGEON_ORDER.flatMap((id) => DUNGEONS[id].lorePool || []));
  const rewarded = new Set([...QUESTS.flatMap((q) => q.rewards.lore || []), ...Object.values(ENDINGS).flatMap((e) => e.reward?.lore || [])]);
  if (new Set(LORE.map((l) => l.id)).size !== LORE.length) err('lore: duplicate ids');
  for (const l of LORE) {
    if (!chapterIds.has(l.chapter)) err(`lore ${l.id}: unknown chapter '${l.chapter}'`);
    if (l.npc && !NPCS[l.npc]) err(`lore ${l.id}: unknown npc link '${l.npc}'`);
    if (l.enemy && !ENEMIES[l.enemy] && !BOSSES[l.enemy]) err(`lore ${l.id}: unknown enemy link '${l.enemy}'`);
    if (l.discovery.type === 'tablet' && !pooled.has(l.id)) err(`lore ${l.id}: tablet lore not in any dungeon lorePool (undiscoverable)`);
    if ((l.discovery.type === 'quest' || l.discovery.type === 'ending') && !rewarded.has(l.id)) err(`lore ${l.id}: not granted by any quest/ending (undiscoverable)`);
    if (l.discovery.type === 'quest' && !questIds.has(l.discovery.ref)) err(`lore ${l.id}: discovery quest '${l.discovery.ref}' unknown`);
  }
  for (const [id, n] of Object.entries(NPCS)) { if (n.id !== id) err(`npc ${id}: id mismatch`); if (!n.lines?.default) err(`npc ${id}: no default line`); }
  return { ok: errors.length === 0, errors, warnings, counts: contentCounts() };
}
