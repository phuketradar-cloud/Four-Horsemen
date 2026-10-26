import { SAVE_KEYS } from '../data/config.js';
import { migrate, SAVE_VERSION } from './SaveMigration.js';

// LocalStorage persistence for settings + a single save slot. Every access is guarded:
// private mode / blocked storage simply disables saving instead of crashing the game.
// Only authoritative data is written (item rolls, not computed stats or UI text).
// Safe update: the new save is written to a temp key first, read back and validated, then
// copied to the real slot; if the real slot is ever unreadable the temp copy is used.
// Phase 6: ambient bus, separate shake / flash reduction, key rebinding (action -> KeyboardEvent.code)
export const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.9, music: 0.5, ambient: 0.6, muted: false, theme: 0, hotkeys: 'skills', reduceFx: false, reduceShake: false, reduceFlash: false, objectives: true, keybinds: {} };

// Structural validation shared by save (before writing) and load (before restoring). It checks the
// shape the loader relies on; ids inside are validated again by each system's restore().
// strict (used before WRITING): duplicated item uids mean a bug duplicated an item - refuse to save it.
// On load, duplicates are tolerated here and dropped by GameManager.loadGame (Phase 3 behaviour).
export function validateSave(d, strict = false) {
  if (!d || typeof d !== 'object' || d.version !== SAVE_VERSION) return false;
  if (!d.hero || typeof d.hero.classId !== 'string' || !(d.hero.level >= 1)) return false;
  if (!Array.isArray(d.inventory) || !d.equipment || typeof d.equipment !== 'object') return false;
  if (d.scene !== 'camp' && !d.player) return false; // a missing run is restored as the prologue (Phase 4 rule)
  if (!Number.isFinite(+(d.gold ?? 0))) return false;
  const uids = new Set();
  for (const it of [...d.inventory, ...(d.stash || [])]) {
    if (!it || (it.baseId == null && it.defId == null)) return false;
    if (strict && it.uid != null) { if (uids.has(it.uid)) return false; uids.add(it.uid); }
  }
  return true;
}

function read(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export class SaveSystem {
  loadSettings() {
    const s = { ...DEFAULT_SETTINGS, ...(read(SAVE_KEYS.settings) || {}) };
    for (const k of ['master', 'sfx', 'music', 'ambient']) s[k] = Number.isFinite(+s[k]) ? Math.max(0, Math.min(1, +s[k])) : DEFAULT_SETTINGS[k]; // never trust stored numbers
    if (!s.keybinds || typeof s.keybinds !== 'object') s.keybinds = {};
    if (s.reduceFx) { s.reduceShake = true; s.reduceFlash = true; s.reduceFx = false; } // Phase 1-5 single switch maps onto both (Effects applies them centrally)
    return s;
  }
  saveSettings(s) { return write(SAVE_KEYS.settings, s); }

  hasSave() { return !!this.load(); }
  // A save exists only in an older slot (Phase 1, 2 or 3).
  isLegacy() { return !read(SAVE_KEYS.save) && !read(SAVE_KEYS.saveTmp) && !!(read(SAVE_KEYS.v4Save) || read(SAVE_KEYS.v3Save) || read(SAVE_KEYS.v2Save) || read(SAVE_KEYS.legacySave)); }

  snapshot(game) {
    const inRun = !!game.run && game.scene !== 'camp';
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      scene: inRun ? 'playing' : 'camp',
      hero: game.hero.serialize(),
      resource: game.resource.serialize(),
      gold: game.gold,
      inventory: game.inventory.items.map((i) => game.loot.serializeItem(i)),
      materials: game.inventory.materials.serialize(),
      stash: (game.stash || []).map((i) => game.loot.serializeItem(i)),
      equipment: game.equipment.serialize(),
      progress: game.progress.serialize(),
      campaign: game.quests ? game.quests.serialize() : null,
      run: inRun ? game.director.serializeRun() : null,
      player: inRun ? { x: game.player.x, y: game.player.y, dir: game.player.dir } : null,
      dungeon: inRun ? game.dungeon.serialize() : null,
      enemies: inRun ? game.ai.serialize() : [],
      loot: inRun ? game.loot.serialize() : { nextUid: game.loot.nextUid, floor: [] },
      stats: game.stats,
    };
  }

  // Phase 6 save pipeline (returns true/false like before; details in this.lastResult):
  //   1. snapshot -> JSON; the JSON is parsed back and must pass the same validation as a load
  //      (a broken snapshot is NEVER written over a good save)
  //   2. the current main save, if it is valid, is copied to the BACKUP slot first
  //   3. temp key -> read back -> main slot -> temp removed
  // Storage errors (quota, private mode, blocked storage) are reported, never thrown.
  save(game) {
    const res = this._save(game);
    this.lastResult = res;
    return res.ok;
  }
  _save(game) {
    let snap, json;
    try { snap = this.snapshot(game); json = JSON.stringify(snap); } catch (err) { return { ok: false, reason: `could not serialise the game (${err.message})` }; }
    let parsed;
    try { parsed = JSON.parse(json); } catch { return { ok: false, reason: 'snapshot is not valid JSON' }; }
    if (!validateSave(parsed, true)) return { ok: false, reason: 'snapshot failed validation - the previous save was kept' };
    try {
      const prev = localStorage.getItem(SAVE_KEYS.save);
      if (prev && prev !== json) { let ok = false; try { ok = validateSave(JSON.parse(prev)); } catch { ok = false; } if (ok) localStorage.setItem(SAVE_KEYS.backup, prev); }
      localStorage.setItem(SAVE_KEYS.saveTmp, json);
      if (localStorage.getItem(SAVE_KEYS.saveTmp) !== json) return { ok: false, reason: 'storage did not keep the data' };
      localStorage.setItem(SAVE_KEYS.save, json);
      localStorage.removeItem(SAVE_KEYS.saveTmp);
    } catch (err) {
      const quota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      try { localStorage.removeItem(SAVE_KEYS.saveTmp); } catch { /* ignore */ }
      return { ok: false, reason: quota ? 'browser storage is full' : `storage unavailable (${err?.name || 'error'})` };
    }
    return { ok: true, bytes: json.length };
  }

  // Newest slot first (main, temp, backup, then older versions migrated in memory).
  // this.loadedFrom tells the game which slot was used (e.g. 'backup' after a damaged main save).
  load() {
    this.loadedFrom = null; this.damaged = [];
    const slots = [['main', SAVE_KEYS.save], ['temp', SAVE_KEYS.saveTmp], ['backup', SAVE_KEYS.backup], ['v4', SAVE_KEYS.v4Save], ['v3', SAVE_KEYS.v3Save], ['v2', SAVE_KEYS.v2Save], ['v1', SAVE_KEYS.legacySave]];
    for (const [name, key] of slots) {
      let rawText = null;
      try { rawText = localStorage.getItem(key); } catch { return null; }
      if (!rawText) continue;
      let raw = null;
      try { raw = JSON.parse(rawText); } catch { raw = null; }
      const d = raw ? migrate(raw) : null;
      if (d && validateSave(d)) { this.loadedFrom = name; return d; }
      this.damaged.push(name);
      // keep one copy of a damaged save for diagnosis/export; never overwrite an earlier copy
      try { if (!localStorage.getItem(SAVE_KEYS.quarantine)) localStorage.setItem(SAVE_KEYS.quarantine, rawText); } catch { /* ignore */ }
    }
    return null;
  }
  // The backup slot alone (used when restoring the main save throws mid-load).
  loadBackup() {
    try { const d = migrate(JSON.parse(localStorage.getItem(SAVE_KEYS.backup))); return d && validateSave(d) ? d : null; } catch { return null; }
  }

  exportJSON(game) { return JSON.stringify(this.snapshot(game), null, 1); }

  // Removes the current save AND its backup (older-version slots are never touched).
  clear() { try { localStorage.removeItem(SAVE_KEYS.save); localStorage.removeItem(SAVE_KEYS.saveTmp); localStorage.removeItem(SAVE_KEYS.backup); } catch { /* ignore */ } }
}
