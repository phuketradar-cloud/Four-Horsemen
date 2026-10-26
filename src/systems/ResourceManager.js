import { RESOURCES, HORSEMEN } from '../data/characters.js';

// One class resource (Dominion / Fury / Plague / Souls). Values are always clamped to [0, max];
// tagged gains can be rate-limited so rapid repeated events cannot farm resource.
export class ResourceManager {
  constructor(game) { this.game = game; this.reset('war'); }

  reset(classId) {
    this.def = RESOURCES[HORSEMEN[classId].resource];
    this.value = this.def.start;
    this.carry = 0;
    this.lastTagAt = {};
    this.outOfCombatT = 0;
    this.pulse = 0; // HUD flash timer
  }

  get max() { return this.def.max; }
  get full() { return this.value >= this.def.max; }

  _set(v) {
    const before = this.value;
    this.value = Math.max(0, Math.min(this.def.max, v));
    if (this.value !== before) this.pulse = 0.35;
    if (this.value > before && this.def.pips) this.game.audio.play('soulGain');
    if (before < this.def.max && this.value >= this.def.max) this.game.audio.play('resourceFull');
    return this.value - before;
  }

  // tag + minInterval: identical gains closer together than minInterval are ignored.
  // Gear "resource gain %" scales every gain; fractional Souls carry over so +20% still means
  // one extra Soul every 5, never a free one per kill.
  gain(n, tag = null, minInterval = 0) {
    if (n <= 0) return 0;
    if (tag) {
      const now = this.game.time;
      if (now - (this.lastTagAt[tag] ?? -1e9) < minInterval) return 0;
      this.lastTagAt[tag] = now;
    }
    const bonus = (this.game.hero?.stats?.resGain || 0) / 100;
    let amount = n * (1 + bonus);
    if (this.def.pips) {
      this.carry = (this.carry || 0) + amount;
      amount = Math.floor(this.carry + 1e-9);
      this.carry -= amount;
      if (amount <= 0) return 0;
    }
    return this._set(this.value + amount);
  }

  canSpend(n) { return this.value >= n; }
  spend(n) {
    if (n <= 0) return true;
    if (this.value < n) return false;
    this._set(this.value - n);
    if (this.value <= 0) this.game.audio.play('resourceEmpty');
    return true;
  }
  consumeAll() { const v = this.value; this._set(0); this.game.audio.play('resourceEmpty'); return v; }

  update(dt, inCombat) {
    this.pulse = Math.max(0, this.pulse - dt);
    const d = this.def;
    if (d.regenPerSec) this._setQuiet(this.value + d.regenPerSec * (1 + (this.game.hero?.stats?.resRegen || 0) / 100) * dt);
    if (inCombat) { this.outOfCombatT = 0; return; }
    this.outOfCombatT += dt;
    if (d.decayPerSec && this.outOfCombatT > d.decayDelay) this._setQuiet(this.value - d.decayPerSec * dt);
  }
  _setQuiet(v) { this.value = Math.max(0, Math.min(this.def.max, v)); }

  serialize() { return { value: this.def.persist ? this.value : this.def.start }; }
  restore(s) { if (s && typeof s.value === 'number') this._setQuiet(this.def.persist ? s.value : this.def.start); }
}
