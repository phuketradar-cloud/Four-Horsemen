import { DIFFICULTIES } from '../data/difficulty.js';
import { chance } from '../core/rng.js';

// EnvironmentalHazardManager: small set of reusable, readable hazards. All damage goes through
// GameManager.hurtPlayer (DEF / Resistance / damage reduction apply; debuffs are shortened by
// Status Resist). Trap damage can never kill: it leaves you at 1 HP at worst.
//   spikes     cycle: retracted -> clicking warning (visible tips) -> extended. Time your step.
//   collapse   cracked floor: stepping on it starts a 0.7s crumble (rumble + cracks); stay and you
//              fall (damage, pushed back); afterwards it is a pit. Never on a mandatory route.
//   blight     poisoned pool: damage + Blight every second you stand in it.
//   spectral   ghost-fire tiles in two alternating patterns with a flicker warning before switching;
//              boss-arena tiles follow the boss's 'floor shift' attack instead of the timer.
export const SPIKE_CYCLE = { period: 3.2, warnAt: 1.8, upAt: 2.4 };
export const SPECTRAL_CYCLE = { period: 4.4, warn: 0.9 };

export class HazardManager {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.t = 0; this.crumbling = new Map(); this.lastTick = new Map(); this.spikeHitCycle = -1; this.warned = -1; }

  spikePhase(t = this.t) {
    const c = t % SPIKE_CYCLE.period;
    return c >= SPIKE_CYCLE.upAt ? 'up' : c >= SPIKE_CYCLE.warnAt ? 'warn' : 'down';
  }
  // 'on' | 'warn' | 'off' for a spectral tile
  spectralState(f, t = this.t) {
    if (f.boss) {
      const b = this.game.bossCtl;
      if (b?.activePattern === f.pattern) return b.pendingPattern && b.pendingPattern !== f.pattern ? 'on' : 'on';
      if (b?.pendingPattern === f.pattern) return 'warn';
      return 'off';
    }
    const half = SPECTRAL_CYCLE.period / 2, c = t % SPECTRAL_CYCLE.period;
    const active = c < half ? 'A' : 'B';
    if (f.pattern === active) return 'on';
    const toSwitch = c < half ? half - c : SPECTRAL_CYCLE.period - c;
    return toSwitch < SPECTRAL_CYCLE.warn ? 'warn' : 'off';
  }

  base() {
    const g = this.game, diff = DIFFICULTIES[g.run?.difficulty] || DIFFICULTIES.normal;
    return (6 + 1.6 * (g.dungeon.def.level || 1)) * diff.trapMult;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    if (!g.hero.alive || !g.player) return;
    const p = g.player, dm = g.dungeon;
    // spike warning click when spikes are near the player
    const cycle = Math.floor(this.t / SPIKE_CYCLE.period);
    if (this.spikePhase() === 'warn' && this.warned !== cycle && dm.featuresOf('spikes').some((f) => Math.abs(f.x - p.x) + Math.abs(f.y - p.y) <= 3)) { this.warned = cycle; g.audio.play('spikeWarn'); }
    // crumbling floor timers
    for (const [f, t0] of [...this.crumbling]) {
      if (this.t - t0 < 0.7) continue;
      const occupied = g.enemies.some((e) => e.alive && e.x === f.x && e.y === f.y);
      if (occupied) continue;
      this.crumbling.delete(f);
      f.collapsed = true;
      dm.setPit(f.x, f.y);
      g.audio.play('collapse');
      g.effects.addShake(g.settings.reduceFx ? 1 : 5);
      if (p.x === f.x && p.y === f.y) {
        const dealt = g.hurtPlayer(g.hero.maxHp * 0.15 * (DIFFICULTIES[g.run?.difficulty]?.trapMult || 1), { kind: 'physical', label: 'a collapsing floor', nonLethal: true, flat: true });
        g.log(`The floor gives way! You fall and climb back out (-${dealt} HP).`, '#ff9a60');
        g.controller.pushBack();
      }
    }
    const f = dm.featureAt(p.x, p.y);
    if (!f) return;
    const now = this.t;
    if (f.kind === 'spikes' && this.spikePhase() === 'up' && this.spikeHitCycle !== cycle) {
      this.spikeHitCycle = cycle;
      const dealt = g.hurtPlayer(this.base(), { kind: 'physical', label: 'spikes', nonLethal: true });
      g.audio.play('spikes');
      g.log(`Spikes stab up through the floor! (-${dealt} HP)`, '#ff7a60');
    } else if (f.kind === 'collapse' && !f.collapsed && !this.crumbling.has(f)) {
      this.crumbling.set(f, now);
      g.audio.play('rumble');
      g.log('The cracked floor shifts under your feet - move!', '#ffb060');
    } else if (f.kind === 'blight' && now - (this.lastTick.get('blight') ?? -9) >= 1) {
      this.lastTick.set('blight', now);
      const dealt = g.hurtPlayer(this.base() * 0.6, { kind: 'blight', label: 'the blight pool', nonLethal: true, quiet: true });
      if (chance(0.5)) g.applyPlayerDebuff('blighted', 4);
      g.effects.text(140, 250, `-${dealt}`, '#80c030', 1);
    } else if (f.kind === 'spectral' && this.spectralState(f) === 'on' && now - (this.lastTick.get('spectral') ?? -9) >= 1) {
      this.lastTick.set('spectral', now);
      const dealt = g.hurtPlayer(this.base() * (f.boss ? 1.1 : 0.7), { kind: 'dark', label: 'pale fire', nonLethal: true, quiet: true });
      if (chance(0.35)) g.applyPlayerDebuff('cursed', 4);
      g.effects.text(140, 250, `-${dealt}`, '#a8f0ff', 1);
    }
  }

  serialize() { return { t: this.t }; }
}
