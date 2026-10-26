import { WEAPONS } from '../data/weapons.js';

// Active weapon, attack cooldowns and attack animation timing.
// An attack is: press -> anim starts -> (windup) impact callback fires exactly once -> anim ends.
const ANIM_DUR = { slash: 0.32, heavy: 0.62, stab: 0.17, shoot: 0.25 };

export class WeaponSystem {
  constructor(equipment) {
    this.eq = equipment;
    this.cooldownMult = () => 1; // set by GameManager (e.g. War's Blood Rush)
    this.reset();
  }

  reset() {
    this.time = 0;
    this.readyAt = {};   // per weapon archetype
    this.anim = null;    // { type, t, dur, windup, attack, fired }
  }

  get current() {
    const item = this.eq.activeItem();
    const def = item ? WEAPONS[item.def.weaponId] : WEAPONS.fists;
    const st = item ? item.stats : { dmgMin: def.dmg[0], dmgMax: def.dmg[1], crit: def.crit };
    return {
      def, item, name: item ? item.name : def.name, rarity: item ? item.rarity : 'common',
      dmgMin: st.dmgMin, dmgMax: st.dmgMax, crit: st.crit, critMult: def.critMult, cooldown: def.cooldown,
    };
  }
  get weaponId() { return this.current.def.id; }
  get cooldown() { return this.current.cooldown; }
  get cooldownLeft() { return Math.max(0, (this.readyAt[this.weaponId] || 0) - this.time); }
  canAttack() { return !this.anim && this.cooldownLeft <= 0; }

  begin(attack, onImpact) {
    const w = this.current.def;
    const dur = ANIM_DUR[w.anim] || 0.3;
    this.anim = { type: w.anim, t: 0, dur, windup: Math.min(w.windup, dur * 0.9), attack, onImpact, fired: false };
    this.readyAt[w.id] = this.time + Math.max(0.15, w.cooldown * this.cooldownMult()); // never below 0.15s
  }

  // Swapping mid-swing cancels the animation (no impact), cooldown of the old weapon is kept.
  cancel() { this.anim = null; }

  update(dt) {
    this.time += dt;
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    if (!a.fired && a.t >= a.windup) { a.fired = true; a.onImpact(a.attack); }
    if (a.t >= a.dur) this.anim = null;
  }
}
