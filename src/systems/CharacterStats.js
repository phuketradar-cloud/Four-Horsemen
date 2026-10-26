import { HORSEMEN } from '../data/characters.js';
import { PROGRESSION, xpToNext } from '../data/progression.js';

// CharacterProgression for the chosen Horseman: level, XP, skill points and upgrades.
// All combat numbers come from the StatCalculator (attributes + equipment + sets); the getters
// below are the stable interface Phase 1/2 systems already use.
export class CharacterStats {
  constructor(bus) { this.bus = bus; this.calc = null; }

  reset(classId = 'war') {
    this.def = HORSEMEN[classId];
    this.classId = classId;
    this.level = 1;
    this.xp = 0;
    this.totalXp = 0;
    this.skillPoints = 0;
    this.upgrades = {}; // skillId -> 'A' | 'B'
    this.calc?.invalidate();
    this.hp = this.maxHp;
    this.feedback = { type: null, t: 0 }; // portrait flash: damage | heal | level | cast
  }

  get stats() { return this.calc ? this.calc.get() : null; }
  get charId() { return this.classId; } // Phase 1 name
  get maxHp() { return this.stats ? this.stats.hp : this.def.base.hp + (this.def.growth.hp || 0) * (this.level - 1); }
  get atk() { return this.stats ? this.stats.atk : this.def.base.atk; }
  get defStat() { return this.stats ? this.stats.def : this.def.base.def; }
  get critPct() { return this.stats ? this.stats.crit : this.def.base.crit; }
  get critChance() { return this.critPct / 100; }
  get moveRepeat() { return this.stats ? this.stats.moveRepeat : this.def.moveRepeat; }
  get xpNeeded() { return xpToNext(this.level); }
  get alive() { return this.hp > 0; }
  get defense() { return this.stats ? this.stats.blowReduction : this.def.base.def * 0.3; } // flat reduction per enemy blow

  // Equipment changed max HP: keep current HP, but never above the new max.
  clampHp() { this.hp = Math.min(this.hp, this.maxHp); }

  flash(type) { this.feedback = { type, t: 0.5 }; }

  takeDamage(n) {
    const amount = Math.max(0, Math.round(n));
    this.hp = Math.max(0, this.hp - amount);
    this.flash('damage');
    return amount;
  }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, Math.round(n)));
    if (this.hp > before) this.flash('heal');
    return this.hp - before;
  }

  gainXp(n) {
    if (this.level >= PROGRESSION.maxLevel || n <= 0) return;
    this.xp += n;
    this.totalXp += n;
    while (this.level < PROGRESSION.maxLevel && this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      const oldMax = this.maxHp;
      this.level++;                       // 1. base attributes grow with level (StatCalculator)
      this.calc?.invalidate();            // 2. derived stats recalculated
      this.skillPoints += PROGRESSION.skillPointsPerLevel; // 3. skills: points + unlock checks (GameManager)
      const gained = this.maxHp - oldMax;
      this.hp = Math.min(this.maxHp, this.hp + gained + Math.round(this.maxHp * PROGRESSION.healOnLevelUp)); // 4. restore
      this.flash('level');
      this.bus.emit('levelUp', { level: this.level, hpGain: gained });   // 5-6. HUD refresh + safe autosave
    }
    if (this.level >= PROGRESSION.maxLevel) this.xp = 0;
  }

  update(dt) { if (this.feedback.t > 0) this.feedback.t -= dt; }

  serialize() {
    return { classId: this.classId, level: this.level, xp: this.xp, totalXp: this.totalXp, hp: this.hp, skillPoints: this.skillPoints, upgrades: { ...this.upgrades } };
  }
  restore(s) {
    this.reset(s.classId || 'war');
    this.level = Math.max(1, Math.min(PROGRESSION.maxLevel, s.level | 0));
    this.xp = s.xp || 0;
    this.totalXp = s.totalXp || 0;
    this.skillPoints = Math.max(0, s.skillPoints | 0);
    this.upgrades = { ...(s.upgrades || {}) };
    this.calc?.invalidate();
    this.hp = Math.max(1, Math.min(this.maxHp, s.hp ?? this.maxHp));
  }
}
