import { DUNGEONS, DUNGEON_ORDER } from '../data/dungeons/index.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty.js';
import { BOSSES } from '../data/bosses.js';

// DungeonSaveManager / persistent progression (character-wide, survives every run):
//   unlocked dungeons, completions per difficulty, boss kills, unlocked recipes, discovered lore,
//   the permanent claim ledger (first-clear bonuses, recipe scrolls ... claimable ONCE per save),
//   and suspended runs (a run you left keeps its exact state until you finish it - so leaving and
//   re-entering can never re-roll chests or respawn enemies).
// Run-specific state (one active floor) lives in GameManager.run and the floor snapshots below.
export class DungeonProgress {
  constructor() { this.reset(); }

  reset() {
    this.unlocked = new Set(DUNGEON_ORDER.filter((id) => !DUNGEONS[id].unlock));
    this.completed = {};          // dungeonId -> { normal: n, veteran: n, nightmare: n }
    this.bosses = {};             // bossId -> kills
    this.claimed = new Set();     // permanent once-per-save reward events
    this.recipes = new Set();     // recipe ids unlocked by bosses / secrets / first clears
    this.lore = new Set();        // lore fragments read
    this.secretsFound = 0;
    this.selected = {};           // dungeonId -> preferred difficulty for a NEW run
    this.runs = {};               // dungeonId -> suspended run { seed, difficulty, floor, ledger[], floors{} }
    this.deepest = {};            // dungeonId -> deepest floor index reached (Phase 5 'reach' objectives)
  }
  reachFloor(id, floor) { if ((this.deepest[id] ?? -1) < floor) this.deepest[id] = floor; }

  isUnlocked(id) { return this.unlocked.has(id); }
  timesCompleted(id, diff = null) {
    const c = this.completed[id] || {};
    return diff ? c[diff] || 0 : Object.values(c).reduce((s, n) => s + n, 0);
  }
  // Veteran opens after a Normal clear of that dungeon, Nightmare after a Veteran clear.
  difficultyUnlocked(id, diff) {
    const i = DIFFICULTY_ORDER.indexOf(diff);
    if (i < 0 || !this.isUnlocked(id)) return false;
    if (DUNGEONS[id]?.prologue) return i === 0;
    return i === 0 || this.timesCompleted(id, DIFFICULTY_ORDER[i - 1]) > 0;
  }
  unlockReason(id, diff = 'normal') {
    const def = DUNGEONS[id];
    if (!this.isUnlocked(id)) return `Complete ${DUNGEONS[def.unlock?.completed]?.name || 'the previous dungeon'} first.`;
    const i = DIFFICULTY_ORDER.indexOf(diff);
    if (i > 0 && !this.difficultyUnlocked(id, diff)) return `Complete it on ${DIFFICULTIES[DIFFICULTY_ORDER[i - 1]].name} first.`;
    return null;
  }

  // Exactly-once claim for a permanent reward event. Returns true the first time only.
  claim(eventId) {
    if (this.claimed.has(eventId)) return false;
    this.claimed.add(eventId);
    return true;
  }

  // Records a completion and unlocks whatever depends on it. Returns newly unlocked dungeon ids.
  recordCompletion(id, diff) {
    const c = (this.completed[id] = this.completed[id] || {});
    c[diff] = (c[diff] || 0) + 1;
    const fresh = [];
    for (const other of DUNGEON_ORDER) {
      const u = DUNGEONS[other].unlock;
      if (u?.completed === id && !this.unlocked.has(other)) { this.unlocked.add(other); fresh.push(other); }
    }
    delete this.runs[id];
    return fresh;
  }

  serialize() {
    return {
      unlocked: [...this.unlocked], completed: this.completed, bosses: this.bosses, claimed: [...this.claimed],
      recipes: [...this.recipes], lore: [...this.lore], secretsFound: this.secretsFound, selected: this.selected, runs: this.runs, deepest: this.deepest,
    };
  }

  // Validates every id against the current definitions; unknown ids are dropped and reported.
  restore(s, knownRecipes = null) {
    this.reset();
    const dropped = [];
    if (!s) return dropped;
    for (const id of s.unlocked || []) if (DUNGEONS[id]) this.unlocked.add(id); else dropped.push(`dungeon ${id}`);
    for (const [id, c] of Object.entries(s.completed || {})) {
      if (!DUNGEONS[id]) { dropped.push(`dungeon ${id}`); continue; }
      this.completed[id] = {};
      for (const d of DIFFICULTY_ORDER) if (c?.[d] > 0) this.completed[id][d] = Math.floor(c[d]);
    }
    for (const [id, n] of Object.entries(s.bosses || {})) if (BOSSES[id]) this.bosses[id] = Math.max(0, Math.floor(n) || 0); else dropped.push(`boss ${id}`);
    this.claimed = new Set((s.claimed || []).filter((e) => typeof e === 'string'));
    for (const r of s.recipes || []) if (!knownRecipes || knownRecipes.has(r)) this.recipes.add(r); else dropped.push(`recipe ${r}`);
    this.lore = new Set((s.lore || []).filter((e) => typeof e === 'string'));
    this.secretsFound = Math.max(0, s.secretsFound | 0);
    for (const [id, d] of Object.entries(s.selected || {})) if (DUNGEONS[id] && DIFFICULTIES[d]) this.selected[id] = d;
    for (const [id, r] of Object.entries(s.runs || {})) {
      if (!DUNGEONS[id] || !r || !DIFFICULTIES[r.difficulty]) { dropped.push(`run ${id}`); continue; }
      this.runs[id] = { seed: r.seed >>> 0, difficulty: r.difficulty, floor: Math.max(0, Math.min((DUNGEONS[id].floors || 1) - 1, r.floor | 0)), ledger: Array.isArray(r.ledger) ? r.ledger : [], floors: r.floors || {}, stats: r.stats || {} };
    }
    for (const [id, f] of Object.entries(s.deepest || {})) if (DUNGEONS[id]) this.deepest[id] = Math.max(0, Math.min((DUNGEONS[id].floors || 1) - 1, f | 0));
    for (const [id, r] of Object.entries(this.runs)) this.reachFloor(id, r.floor); // v4 saves: a suspended run proves its floor
    // a completion always implies its unlocks (repairs older/edited saves)
    for (const id of Object.keys(this.completed)) for (const other of DUNGEON_ORDER) if (DUNGEONS[other].unlock?.completed === id) this.unlocked.add(other);
    return dropped;
  }
}
