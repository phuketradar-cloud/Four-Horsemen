import { STATUSES, RANK_RULES, STUN_IMMUNITY } from '../data/statuses.js';

// Buffs / debuffs / DoTs for enemies (stored on enemy.statuses) and the player.
// Enforces stack caps, refresh-not-stack for DoTs, rank-scaled control and stun immunity.
export class StatusEffectManager {
  constructor(game) { this.game = game; this.reset(); }

  reset() { this.player = new Map(); }

  _map(target) { return target === 'player' ? this.player : target.statuses; }

  // Returns { applied, stacks, reason }.
  apply(target, id, { dur = 5, stacks = 1, power = 0, perStack = 0, data = null } = {}) {
    const def = STATUSES[id];
    const g = this.game;
    if (!def) return { applied: false, reason: 'unknown status' };
    if (target !== 'player') {
      if (!target.alive) return { applied: false, reason: 'dead' };
      // Phase 5 bestiary: per-enemy status rules (immune / duration multiplier)
      const rule = target.statusRules?.[id];
      if (rule === 'immune') return { applied: false, reason: 'resisted' };
      if (typeof rule === 'number') dur *= rule;
      const rank = RANK_RULES[target.rank] || RANK_RULES.normal;
      if (def.rankScaled) dur *= rank.controlMult;
      if (def.stun) {
        if (g.time < (target.stunImmuneUntil || 0)) return { applied: false, reason: 'resisted' };
        target.stunImmuneUntil = g.time + dur + STUN_IMMUNITY;
        g.ai.stagger(target, dur);
      }
      if (def.unique) for (const e of g.enemies) if (e !== target && e.statuses.has(id)) e.statuses.delete(id);
    }
    const map = this._map(target);
    const cur = map.get(id);
    // Famine gear (Black Scales relic, Black Harvest set) may raise the Withering cap (bounded).
    const maxStacks = (def.maxStacks || 1) + (id === 'wither' ? g.hero.stats?.witherStacks || 0 : 0);
    if (target !== 'player') g.legend?.onStatusApplied(id, target);
    if (cur) {
      cur.stacks = Math.min(maxStacks, cur.stacks + stacks);
      cur.until = Math.max(cur.until, g.time + dur); // refresh, never extend past a fresh duration
      cur.dur = Math.max(cur.dur, dur);
      cur.power = Math.max(cur.power, power);
      cur.perStack = Math.max(cur.perStack, perStack);
      if (data) cur.data = data;
    } else {
      map.set(id, { id, stacks: Math.min(maxStacks, stacks), until: g.time + dur, dur, power, perStack, data, nextTick: g.time + (def.tick || 1) });
    }
    return { applied: true, stacks: map.get(id).stacks };
  }

  get(target, id) { return this._map(target)?.get(id) || null; }
  has(target, id) { return !!this.get(target, id); }
  stacks(target, id) { return this.get(target, id)?.stacks || 0; }
  remove(target, id) { this._map(target)?.delete(id); }
  clear(target) { this._map(target)?.clear(); }

  // ---- aggregated modifiers
  enemyAtkMult(e) {
    let m = 1;
    for (const s of e.statuses.values()) {
      const d = STATUSES[s.id];
      if (d.atkMult) m *= d.atkMult;
      if (d.atkMultPerStack) m *= 1 + d.atkMultPerStack * s.stacks;
    }
    return Math.max(0.2, m);
  }
  enemyDefAdd(e) { let a = 0; for (const s of e.statuses.values()) a += STATUSES[s.id].defAdd || 0; return a; }
  dmgTakenMult(e) { let m = 1; for (const s of e.statuses.values()) if (STATUSES[s.id].dmgTakenMult) m *= STATUSES[s.id].dmgTakenMult; return m; }
  moveMult(e) { let m = 1; for (const s of e.statuses.values()) if (STATUSES[s.id].moveMult) m *= STATUSES[s.id].moveMult; return m; }
  playerMult(key) { let m = 1; for (const s of this.player.values()) if (STATUSES[s.id][key]) m *= STATUSES[s.id][key]; return m; }

  list(target) {
    const g = this.game;
    return [...(this._map(target)?.values() || [])].map((s) => ({ ...s, def: STATUSES[s.id], left: Math.max(0, s.until - g.time) }));
  }

  update() {
    const g = this.game;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      for (const s of [...e.statuses.values()]) {
        const d = STATUSES[s.id];
        if (d.dot && g.time >= s.nextTick) {
          s.nextTick += d.tick;
          const st = g.hero.stats || {};
          const dmg = Math.round((s.power + s.perStack * this.stacks(e, 'wither')) * (1 + ((st.dotDmg || 0) + (st.skillPower || 0)) / 100) * g.combat.resistMult(e, { source: 'dot' }));
          if (dmg > 0) g.combat.damageEnemy(e, dmg, false, { dot: true, source: 'dot', color: d.color });
          if (!e.alive) break;
        }
        if (g.time >= s.until) e.statuses.delete(s.id);
      }
    }
    for (const s of [...this.player.values()]) {
      const d = STATUSES[s.id];
      if (d.playerDot && g.time >= s.nextTick) { // Blight: % max HP per tick, never lethal
        s.nextTick += d.tick || 1;
        const dealt = g.hurtPlayer(g.hero.maxHp * d.playerDot, { kind: 'blight', label: d.name.toLowerCase(), nonLethal: true, quiet: true, flat: true });
        if (dealt) g.effects.text(140, 250, `-${dealt}`, d.color, 1);
      }
      if (g.time >= s.until) this.player.delete(s.id);
    }
  }
}
