import { KEYMAP, HELD_ACTIONS, SCREEN } from '../data/config.js';

// Unified keyboard / mouse / gamepad input. Listeners are attached exactly once
// (Input is a singleton created at boot), so restarting the game never duplicates them.
const GAMEPAD_BUTTONS = {
  0: 'attack', 1: 'guard', 2: 'interact', 3: 'confirm',
  4: 'menuUp', 5: 'menuDown', 6: 'prevWeapon', 7: 'nextWeapon',
  8: 'inventory', 9: 'pause',
  12: 'forward', 13: 'back', 14: 'turnLeft', 15: 'turnRight',
};

// Phase 6 key rebinding: player overrides (action -> KeyboardEvent.code) replace the LETTER key of that
// action; arrow keys always keep working as a fallback. A key taken from another action is removed
// from it (shown as UNBOUND in the controls panel). Escape / Enter / digits are never rebindable.
export const REBINDABLE = ['forward', 'back', 'turnLeft', 'turnRight', 'attack', 'interact', 'guard', 'quickPotion', 'target', 'look', 'inventory', 'character', 'skills', 'crafting', 'map', 'journal', 'objectives', 'ultimate'];
const RESERVED = /^(Escape|Enter|NumpadEnter|Tab|Digit[0-9]|Numpad[0-9]|Arrow.*)$/;
export function buildKeymap(overrides = {}) {
  const map = { ...KEYMAP };
  for (const [action, code] of Object.entries(overrides || {})) {
    if (!REBINDABLE.includes(action) || typeof code !== 'string' || RESERVED.test(code)) continue;
    for (const k of Object.keys(map)) if (map[k] === action && !/^(Arrow|Digit|Numpad)/.test(k)) delete map[k];
    map[code] = action;
  }
  return map;
}
export function keysFor(map, action) { return Object.keys(map).filter((k) => map[k] === action); }
export function keyLabel(code) { return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Bracket', '').toUpperCase(); }

export class Input {
  constructor(canvas, onFirstGesture, getHotkeyMode = () => 'skills') {
    if (Input._attached) throw new Error('Input already attached');
    Input._attached = true;
    this.canvas = canvas;
    this.onFirstGesture = onFirstGesture;
    this.getHotkeyMode = getHotkeyMode; // 'skills': 1-4 skills, Shift+1-4 weapons | 'weapons': reversed
    this.heldKeys = new Set();
    this.pressed = [];             // queued edge-triggered actions
    this.mouse = { x: -1, y: -1, down: false, rightDown: false };
    this.clicks = [];              // queued {x, y}
    this.wheel = 0;
    this.padPrev = {};
    this.padHeld = new Set();
    this.padAxisPrev = { x: 0, y: 0 };
    this.lastKeyCode = null;
    this.keymap = { ...KEYMAP };
    this.capture = null;           // (code) => void : next key press is captured for rebinding
    this._bind();
  }

  setBindings(overrides) { this.keymap = buildKeymap(overrides); }

  _gesture() {
    if (this.onFirstGesture) { this.onFirstGesture(); }
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(e.code); return; }
      let action = this.keymap[e.code];
      const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      if (digit) {
        const skillsFirst = this.getHotkeyMode() !== 'weapons';
        action = (skillsFirst !== e.shiftKey ? 'skill' : 'weapon') + digit[2];
      }
      if (action || e.code === 'Tab') e.preventDefault();
      this._gesture();
      if (!action) return;
      if (!e.repeat) this.pressed.push(action); // OS auto-repeat ignored; held logic handles repeats
      this.heldKeys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.heldKeys.delete(e.code); });
    window.addEventListener('blur', () => { this.heldKeys.clear(); this.mouse.down = false; this.mouse.rightDown = false; });

    const toLocal = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * SCREEN.w, y: ((e.clientY - r.top) / r.height) * SCREEN.h };
    };
    this.canvas.addEventListener('mousemove', (e) => { const p = toLocal(e); this.mouse.x = p.x; this.mouse.y = p.y; });
    this.canvas.addEventListener('mouseleave', () => { this.mouse.x = -1; this.mouse.y = -1; });
    this.canvas.addEventListener('mousedown', (e) => {
      this._gesture();
      this.canvas.focus();
      const p = toLocal(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
      if (e.button === 0) { this.mouse.down = true; this.clicks.push({ x: p.x, y: p.y }); }
      if (e.button === 2) this.mouse.rightDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  // Called once per frame before game update.
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    this.padHeld.clear();
    if (!pad) return;
    pad.buttons.forEach((b, i) => {
      const action = GAMEPAD_BUTTONS[i];
      if (!action) return;
      const down = b.pressed || b.value > 0.5;
      if (down && !this.padPrev[i]) { this.pressed.push(action); this._gesture(); }
      if (down) this.padHeld.add(action);
      this.padPrev[i] = down;
    });
    // Left stick as digital directions.
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const sx = ax > 0.6 ? 1 : ax < -0.6 ? -1 : 0;
    const sy = ay > 0.6 ? 1 : ay < -0.6 ? -1 : 0;
    if (sy === -1) { this.padHeld.add('forward'); if (this.padAxisPrev.y !== -1) this.pressed.push('forward'); }
    if (sy === 1) { this.padHeld.add('back'); if (this.padAxisPrev.y !== 1) this.pressed.push('back'); }
    if (sx === -1) { this.padHeld.add('turnLeft'); if (this.padAxisPrev.x !== -1) this.pressed.push('turnLeft'); }
    if (sx === 1) { this.padHeld.add('turnRight'); if (this.padAxisPrev.x !== 1) this.pressed.push('turnRight'); }
    this.padAxisPrev = { x: sx, y: sy };
  }

  isHeld(action) {
    if (!HELD_ACTIONS.has(action)) return false;
    if (this.padHeld.has(action)) return true;
    if (action === 'guard' && this.mouse.rightDown) return true;
    for (const code of this.heldKeys) if (this.keymap[code] === action) return true;
    return false;
  }

  consumePressed() { const p = this.pressed; this.pressed = []; return p; }
  consumeClicks() { const c = this.clicks; this.clicks = []; return c; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  clearAll() { this.pressed = []; this.clicks = []; this.wheel = 0; }
}
