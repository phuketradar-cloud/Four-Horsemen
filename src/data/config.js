// Global layout + tuning constants. Fixed 640x480 (4:3) logical resolution.
export const SCREEN = { w: 640, h: 480 };

export const LAYOUT = {
  top: { x: 0, y: 0, w: 640, h: 18 },
  leftPanel: { x: 2, y: 20, w: 118, slotH: 104, gap: 2 },
  rightPanel: { x: 520, y: 20, w: 118, slotH: 104, gap: 2 },
  viewFrame: { x: 122, y: 20, w: 396, h: 340 },
  view: { x: 128, y: 26, w: 384, h: 328 }, // inner first-person viewport
  commandMenu: { x: 420, y: 30, w: 88, itemH: 10 },
  minimap: { x: 2, y: 362, w: 118, h: 116 },
  utilLeft: { x: 124, y: 362, w: 34, h: 116 },
  skillBar: { x: 160, y: 362, w: 322, h: 36 },
  log: { x: 160, y: 400, w: 322, h: 78 },
  weaponHud: { x: 484, y: 362, w: 154, h: 56 },
  utilRight: { x: 484, y: 420, w: 154, h: 58 },
};

export const VIEW = {
  focal: 230,     // projection focal length in px (inner viewport)
  maxDepth: 7,    // cells drawn ahead
  lateral: 3,     // cells drawn to each side
  shadeLevels: 8,
};

export const TUNING = {
  moveRepeat: 0.2,        // seconds between held-key steps
  turnRepeat: 0.22,
  autoFaceDelay: 0.4,     // seconds before auto-turning toward an adjacent attacker
  perfectGuardWindow: 0.35,
  guardReduction: 0.35,   // damage multiplier while guarding
  mpRegenPerSec: 0.6,
  pickupRange: 1,         // tiles (current tile or tile in front)
  clearedDelay: 1.6,
};

// Keyboard -> action. Several keys can map to one action.
export const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'turnLeft', ArrowLeft: 'turnLeft',
  KeyD: 'turnRight', ArrowRight: 'turnRight',
  Space: 'attack',
  KeyE: 'interact',
  // Digit1-4 are resolved by Input using the HOTKEYS setting (skills vs weapons; Shift = the other)
  Digit5: 'ultimate',
  Tab: 'inventory',
  KeyI: 'character',
  Escape: 'pause',
  KeyF: 'guard',
  KeyR: 'ultimate',
  KeyT: 'target',
  KeyK: 'skills',
  KeyC: 'crafting',
  KeyQ: 'quickPotion',
  KeyL: 'look',
  KeyM: 'map',
  KeyP: 'formation',
  KeyO: 'objectives',
  KeyJ: 'journal',
  BracketLeft: 'menuUp', BracketRight: 'menuDown',
  Enter: 'confirm', NumpadEnter: 'confirm',
};

// Actions that are "held" (polled) rather than only edge-triggered.
export const HELD_ACTIONS = new Set(['forward', 'back', 'turnLeft', 'turnRight', 'guard']);

// Phase 5 writes save_v5 (via a temp key, see SaveSystem); older slots (v4 = Phase 4, v3 = Phase 3, v2 = Phase 2,
// v1 = Phase 1) are only read and migrated, never overwritten or deleted.
export const SAVE_KEYS = { settings: 'fh4_settings_v1', save: 'fh5_save_v5', saveTmp: 'fh5_save_v5_tmp', backup: 'fh5_save_v5_backup', quarantine: 'fh5_save_damaged', v4Save: 'fh4_save_v4', v3Save: 'fh4_save_v3', v2Save: 'fh4_save_v2', legacySave: 'fh4_save_v1' };

export const DIRS = [
  { name: 'NORTH', dx: 0, dy: -1 },
  { name: 'EAST', dx: 1, dy: 0 },
  { name: 'SOUTH', dx: 0, dy: 1 },
  { name: 'WEST', dx: -1, dy: 0 },
];
