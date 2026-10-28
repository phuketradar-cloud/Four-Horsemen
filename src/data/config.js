// Global layout + tuning constants. Fixed 960x540 (16:9) logical resolution: 1920x1080 is exactly 2x,
// 3840x2160 4x; other window sizes are presented by core/Display.js without uneven pixels.
export const SCREEN = { w: 960, h: 540 };

// Full-screen panels, the Horseman select screen and the camp are composed on the original 640x480
// grid; they are drawn centred on the 16:9 screen through this origin (ctx translate + UI offset).
export const CLASSIC = { x: 160, y: 30, w: 640, h: 480 };
// The whole 16:9 screen in CLASSIC coordinates (backdrops / modal click blockers): fillRect(...FULL)
export const FULL = [-CLASSIC.x, -CLASSIC.y, SCREEN.w, SCREEN.h];

export const LAYOUT = {
  top: { x: 0, y: 0, w: 960, h: 18 },
  leftPanel: { x: 2, y: 20, w: 118, slotH: 132, gap: 2 },
  rightPanel: { x: 840, y: 20, w: 118, slotH: 132, gap: 2 },
  viewFrame: { x: 122, y: 20, w: 716, h: 400 },
  view: { x: 128, y: 26, w: 704, h: 388 }, // inner first-person viewport
  panel: { x: 122, y: 20, w: 396, h: 340 }, // modal panels (CLASSIC coordinates)
  minimap: { x: 2, y: 422, w: 118, h: 116 },
  utilLeft: { x: 124, y: 422, w: 34, h: 116 },
  skillBar: { x: 160, y: 422, w: 642, h: 36 },
  log: { x: 160, y: 460, w: 642, h: 78 },
  weaponHud: { x: 804, y: 422, w: 154, h: 56 },
  utilRight: { x: 804, y: 480, w: 154, h: 58 },
};

export const VIEW = {
  focal: 272,     // projection focal length in px: keeps the 4:3 build's vertical framing (230 / 328 px)
  maxDepth: 7,    // cells drawn ahead
  lateral: 6,     // cells drawn to each side (the 16:9 view sees further sideways)
  shadeLevels: 8,
};

// Output resolutions offered in OPTIONS (16:9). AUTO fills the window; larger choices are capped to
// what the window / screen can show. Fullscreen uses the browser / desktop shell's borderless mode.
export const RESOLUTIONS = ['auto', '1280x720', '1600x900', '1920x1080', '2560x1440', '3840x2160'];

export const TUNING = {
  moveRepeat: 0.2,        // seconds between held-key steps
  turnRepeat: 0.22,
  autoFaceDelay: 0.4,     // seconds before auto-turning toward an adjacent attacker
  perfectGuardWindow: 0.35,
  guardReduction: 0.35,   // damage multiplier while guarding
  mpRegenPerSec: 0.6,
  pickupRange: 1,         // tiles (current tile or tile in front)
  clearedDelay: 1.6,
  // Holding ATTACK repeats basic attacks: at most one per attackRepeat seconds, and never faster than
  // the weapon's own cooldown / swing (a slow axe still swings at its own pace).
  attackRepeat: 0.55,
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
  // former COMMANDS-menu entries that had no key of their own
  KeyG: 'fight', KeyX: 'aboutFace', KeyZ: 'runAway', KeyV: 'nextWeapon', KeyB: 'cast',
  F11: 'fullscreen',
  // party play: take control of Conquest / War / Famine / Death, or cycle through the living
  F1: 'control1', F2: 'control2', F3: 'control3', F4: 'control4', Backquote: 'controlNext',
  BracketLeft: 'menuUp', BracketRight: 'menuDown',
  Enter: 'confirm', NumpadEnter: 'confirm',
};

// Actions that are "held" (polled) rather than only edge-triggered.
export const HELD_ACTIONS = new Set(['forward', 'back', 'turnLeft', 'turnRight', 'guard', 'attack']);

// Phase 5 writes save_v5 (via a temp key, see SaveSystem); older slots (v4 = Phase 4, v3 = Phase 3, v2 = Phase 2,
// v1 = Phase 1) are only read and migrated, never overwritten or deleted.
export const SAVE_KEYS = { settings: 'fh4_settings_v1', save: 'fh5_save_v5', saveTmp: 'fh5_save_v5_tmp', backup: 'fh5_save_v5_backup', quarantine: 'fh5_save_damaged', v4Save: 'fh4_save_v4', v3Save: 'fh4_save_v3', v2Save: 'fh4_save_v2', legacySave: 'fh4_save_v1' };

export const DIRS = [
  { name: 'NORTH', dx: 0, dy: -1 },
  { name: 'EAST', dx: 1, dy: 0 },
  { name: 'SOUTH', dx: 0, dy: 1 },
  { name: 'WEST', dx: -1, dy: 0 },
];
