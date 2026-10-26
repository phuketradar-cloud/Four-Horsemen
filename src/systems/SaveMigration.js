import { HORSEMEN } from '../data/characters.js';

// Versioned save migration (in memory only — source slots are never rewritten).
//   v1 (Phase 1): WAR only, STR/DEX/VIT/LCK + MP, items {uid, defId, rarity, qty}
//   v2 (Phase 2): + classId, skill points/upgrades, class resource
//   v3 (Phase 3): + gold, item level / seed / affixes / unique effect / temper, 8 named slots
//   v4 (Phase 4): + dungeon progression (unlocks, completions, bosses, claim ledger, recipes,
//                 suspended runs), material pouch, camp stash, current run (dungeon/seed/floor/
//                 difficulty/ledger + other floors' snapshots), scene (camp | playing)
//   v5 (Phase 5): + campaign (quests, key items, codex, bestiary, ending), progress.deepest.
//                 A v4 save gets an empty campaign; GameManager then re-derives every STATE
//                 objective from the v4 progress (bosses, completions), so earlier victories count.
//                 `migrationReport` lists what was converted.
// Phase 1/2 items carry no rolls; LootSystem.restoreItem regenerates them deterministically
// from their uid (same item every load) and EquipmentSystem.restore renames legacy slots.
// Phase 1-3 saves were all in the Crypt of the First Seal: they become a prologue run; their
// materials (still in the inventory list) are moved into the pouch by GameManager.loadGame.
export const SAVE_VERSION = 5;

export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  let d = data;
  const from = d.version || 1;
  if (from === 1) d = v1ToV2(d);
  if (d.version === 2) d = v2ToV3(d);
  if (d.version === 3) d = v3ToV4(d);
  if (d.version === 4) d = v4ToV5(d);
  if (d.version !== SAVE_VERSION) return null; // unknown future version: refuse rather than corrupt
  if (!HORSEMEN[d.hero?.classId] || !Array.isArray(d.inventory) || (!d.player && d.scene !== 'camp')) return null;
  if (from < SAVE_VERSION) d.migratedFrom = from;
  return d;
}

function v1ToV2(v1) {
  const level = Math.max(1, v1.hero?.level | 0 || 1);
  return {
    ...v1,
    version: 2,
    hero: {
      classId: 'war',                       // Phase 1 only had WAR
      level,
      xp: v1.hero?.xp || 0,
      totalXp: v1.hero?.totalXp || 0,
      hp: v1.hero?.hp,                      // clamped to the new max on restore
      skillPoints: Math.max(0, level - 1),  // refund: one point per level gained in Phase 1
      upgrades: {},
    },
    resource: null,                         // starts at the class default
    stats: { markedHits: 0, healed: 0, ...(v1.stats || {}) },
  };
}

function v2ToV3(v2) {
  return {
    ...v2,
    version: 3,
    gold: v2.gold || 0,
    // items stay as {uid, defId, rarity, qty}: restoreItem upgrades them (ilvl 1, deterministic rolls)
    inventory: (v2.inventory || []).map((s) => ({ ...s, baseId: s.baseId || s.defId })),
  };
}

function v3ToV4(v3) {
  return {
    ...v3,
    version: 4,
    scene: 'playing',
    run: { dungeonId: 'crypt_first_seal', difficulty: 'normal', seed: 0, floor: 0, ledger: [], floors: {}, bossDefeated: false },
    progress: null,     // defaults: prologue + Ashen Catacombs unlocked
    materials: {},      // filled from the inventory's material stacks on load
    stash: [],
  };
}

function v4ToV5(v4) {
  const p = v4.progress || {};
  const report = [
    `save v${v4.version} -> v5`,
    `bosses carried over: ${Object.keys(p.bosses || {}).length}`,
    `dungeon completions carried over: ${Object.keys(p.completed || {}).length}`,
    `lore read (Phase 4 tablets): ${(p.lore || []).length}`,
    'campaign started fresh: quests whose goals you already met complete when you speak to their NPC',
  ];
  return { ...v4, version: 5, campaign: null, migrationReport: report };
}
