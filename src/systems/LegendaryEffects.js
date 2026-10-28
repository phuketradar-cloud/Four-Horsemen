import { LEGENDARY_EFFECTS } from '../data/legendaryEffects.js';
import { LAYOUT } from '../data/config.js';
import { chance } from '../core/rng.js';

// Effects granted by equipped items (relics, legendary rolls, mythic uniques). The same effect
// from two items activates once. Class-locked effects only work for that Horseman.
export function activeEffectIds(items, classId) {
  const ids = new Set();
  for (const it of items) {
    if (!it?.unique) continue;
    const e = LEGENDARY_EFFECTS[it.unique];
    if (e && (!e.cls || e.cls === classId)) ids.add(it.unique);
  }
  return ids;
}

export function passiveStatsFor(items, classId) {
  const out = {};
  for (const id of activeEffectIds(items, classId)) {
    const e = LEGENDARY_EFFECTS[id];
    if (e.stats) for (const [k, v] of Object.entries(e.stats)) out[k] = (out[k] || 0) + v; // any trigger may also carry passive stats
  }
  return out;
}

// LegendaryEffectRegistry runtime: trigger handlers, internal cooldowns, counters.
// Guards: every handler checks its ICD; re-entrant procs are blocked (an echo hit can't echo,
// a shockwave can't shockwave) so no effect can loop.
export class LegendaryEffects {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.readyAt = new Map(); this.counters = new Map(); this.procs = new Map(); this.busy = false; }

  get ids() { return activeEffectIds(this.game.calc.equippedItems(), this.game.hero.classId); }
  has(id) { return this.ids.has(id); }

  _ready(id) {
    const e = LEGENDARY_EFFECTS[id];
    if (!e.icd) return true;
    if (this.game.time < (this.readyAt.get(id) ?? -1)) return false;
    this.readyAt.set(id, this.game.time + e.icd);
    return true;
  }
  _proc(id) { this.procs.set(id, (this.procs.get(id) || 0) + 1); }

  // Damage multiplier for passive conditional effects (generic dmgBonus capped at +50% in total).
  damageMult(e, ctx = {}) {
    let m = 1;
    if (this.has('last_silence')) {
      const d = LEGENDARY_EFFECTS.last_silence;
      if (e.hp / e.maxHp < (e.rank === 'boss' ? d.bossThreshold : d.threshold)) m *= d.mult; // boss threshold respected
    }
    let bonus = 0;
    for (const id of this.ids) {
      const d = LEGENDARY_EFFECTS[id];
      if (d.dmgBonus && this._cond(d.dmgBonus.cond, { target: e, ctx })) bonus += d.dmgBonus.pct;
    }
    return m * (1 + Math.min(50, bonus) / 100);
  }

  pierce() {
    let n = 0;
    for (const id of this.ids) n += LEGENDARY_EFFECTS[id].pierce || 0;
    return Math.min(2, n);
  }

  // Skill modifiers granted by unique items, merged (SkillSystem.params applies them).
  skillMods(skillId) {
    const out = {};
    for (const id of this.ids) {
      const sm = LEGENDARY_EFFECTS[id].skillMods?.[skillId];
      if (sm) for (const [k, v] of Object.entries(sm)) out[k] = k.endsWith('Mult') ? (out[k] ?? 1) * v : (out[k] || 0) + v;
    }
    return out;
  }

  // ---- generic condition + action handlers (Phase 5 items; reusable by any data entry)
  _cond(c, { target = null, ctx = {}, dealt = 0, statusId = null } = {}) {
    if (!c) return true;
    const g = this.game;
    if (c.chance !== undefined && !chance(c.chance)) return false;
    if (c.targetStatus && !(target && target.statuses && g.status.has(target, c.targetStatus))) return false;
    if (c.targetHpBelow !== undefined && !(target && target.hp / target.maxHp < c.targetHpBelow)) return false;
    if (c.targetRank && !(target && c.targetRank.includes(target.rank))) return false;
    if (c.resourceAbove !== undefined && g.resource.value / g.resource.max < c.resourceAbove) return false;
    if (c.hpBelow !== undefined && g.hero.hp / g.hero.maxHp >= c.hpBelow) return false;
    if (c.bigHit !== undefined && dealt < g.hero.maxHp * c.bigHit) return false;
    if (c.ranged && g.weapons.current.def.kind !== 'ranged') return false;
    if (c.twoHanded && !g.weapons.current.def.twoHanded) return false;
    if (c.skill && ctx.source !== 'skill') return false;
    if (c.areaSkill && !(ctx.source === 'skill' && ['arc', 'encounter'].includes(ctx.skill?.target))) return false;
    if (c.statusId && c.statusId !== statusId) return false;
    return true;
  }

  _generic(trigger, info = {}) {
    if (this.busy || info.ctx?.proc) return; // procs never trigger more procs
    const g = this.game;
    this.busy = true;
    try {
      for (const id of this.ids) {
        const d = LEGENDARY_EFFECTS[id];
        if (!d.actions || !(d.trigger === trigger || (d.trigger === 'hit' && (trigger === 'basicHit' || trigger === 'skillHit')))) continue;
        if (!this._cond(d.cond, info)) continue;
        if (!this._ready(id)) continue;
        this._proc(id);
        for (const a of d.actions) this._act(a, info, d);
      }
    } finally { this.busy = false; }
  }

  _act(a, { target = null, dealt = 0, attacker = null }, d) {
    const g = this.game;
    switch (a.do) {
      case 'resource': g.resource.gain(a.amount); break;
      case 'heal': { const h = g.hero.heal(Math.min(g.hero.maxHp * a.pct, g.hero.maxHp * 0.15)); if (h > 0) g.effects.text(LAYOUT.view.w / 2 - 90, LAYOUT.view.h - 80, `+${h}`, '#60ff80', 1); break; }
      case 'buff': g.status.apply('player', a.status, { dur: a.dur }); g.effects.text(LAYOUT.view.w / 2, 240, d.name.toUpperCase(), '#ffd040', 1, 0.8); break;
      case 'status': if (target?.alive) g.status.apply(target, a.status, { dur: a.dur || 4, stacks: a.stacks || 1 }); break;
      case 'damage': {
        const victim = a.target === 'attacker' ? attacker : target;
        if (victim?.alive && dealt > 0) g.combat.damageEnemy(victim, Math.max(1, Math.round(dealt * a.mult)), false, { ctx: { source: 'counter', proc: true }, color: '#ffe58a' });
        break;
      }
      case 'revealSecrets': {
        const dm = g.dungeon, room = dm.roomAt(g.player.x, g.player.y);
        for (const r of dm.def.rooms || []) {
          if (r.secretDoor && (dm.def.edges || []).some((e) => (e.a === room.id && e.b === r.id) || (e.b === room.id && e.a === r.id)) && !dm.isOpened(r.secretDoor.x, r.secretDoor.y)) {
            if (!dm.isExplored(r.secretDoor.x, r.secretDoor.y)) g.log('The lantern flares: a hidden wall is near (marked on your map).', '#f0d070');
            dm.explored[dm.key(r.secretDoor.x, r.secretDoor.y)] = 1;
          }
        }
        break;
      }
      default: break;
    }
  }

  onSkillHit(e, ctx, dealt) { this._generic('skillHit', { target: e, ctx, dealt }); }
  onSkillCast(skillId, p, targets) { this._generic('skillCast', { ctx: { source: 'skill', skill: p }, target: targets?.[0] || null }); }
  onRoomEnter() { this._generic('roomEnter', {}); }

  onBasicHit(e, ctx, dealt) {
    if (this.busy || ctx.proc) return; // procs never trigger more procs
    this._generic('basicHit', { target: e, ctx, dealt });
    const g = this.game, ids = this.ids;
    this.busy = true;
    try {
      if (ids.has('echo_strike')) {
        const n = (this.counters.get('echo') || 0) + 1;
        this.counters.set('echo', n % LEGENDARY_EFFECTS.echo_strike.every);
        if (n >= LEGENDARY_EFFECTS.echo_strike.every && e.alive) {
          this._proc('echo_strike');
          g.combat.damageEnemy(e, Math.max(1, Math.round(dealt * LEGENDARY_EFFECTS.echo_strike.mult)), false, { ctx: { source: 'basic', proc: true }, color: '#ffe58a' });
          g.effects.text(LAYOUT.view.w / 2, 60, 'ECHO', '#ffe58a', 1, 0.6);
        }
      }
      if (ids.has('vampiric') && this._ready('vampiric')) {
        const healed = g.hero.heal(g.hero.maxHp * LEGENDARY_EFFECTS.vampiric.pct);
        if (healed > 0) { this._proc('vampiric'); g.effects.text(LAYOUT.view.w / 2 - 90, LAYOUT.view.h - 80, `+${healed}`, '#60ff80', 1); }
      }
      if (ids.has('maw_of_famine') && e.alive && this._ready('maw_of_famine')) {
        this._proc('maw_of_famine');
        g.status.apply(e, 'wither', { dur: 10, stacks: 1 });
      }
      if (ids.has('worldbreaker') && chance(LEGENDARY_EFFECTS.worldbreaker.chance) && this._ready('worldbreaker')) {
        this._proc('worldbreaker');
        const p = g.player;
        const around = g.enemies.filter((q) => q.alive && Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) === 1);
        for (const q of around) g.combat.damageEnemy(q, Math.max(1, Math.round(dealt * LEGENDARY_EFFECTS.worldbreaker.mult)), false, { ctx: { source: 'basic', proc: true }, color: '#ff8a30' });
        g.fx.groundCrack();
      }
    } finally { this.busy = false; }
  }

  onKill(e, statusesAtDeath) {
    const g = this.game, ids = this.ids;
    // statuses are cleared right after death: evaluate conditions against the snapshot
    this._generic('kill', { target: { ...e, statuses: statusesAtDeath, alive: false } });
    if (ids.has('blood_tithe') && this._ready('blood_tithe')) { this._proc('blood_tithe'); g.resource.gain(LEGENDARY_EFFECTS.blood_tithe.amount); }
    if (ids.has('pale_lantern') && statusesAtDeath.has('grave_mark') && this._ready('pale_lantern')) { this._proc('pale_lantern'); g.resource.gain(1); }
  }

  onStatusApplied(statusId, target = null) {
    const g = this.game;
    this._generic('statusApplied', { statusId, target });
    if (statusId === 'mark' && this.has('royal_command') && this._ready('royal_command')) { this._proc('royal_command'); g.resource.gain(LEGENDARY_EFFECTS.royal_command.amount); }
  }

  onDamaged(attacker, dealt) {
    const g = this.game, ids = this.ids;
    this._generic('damaged', { attacker, dealt });
    if (ids.has('thorns') && attacker?.alive && dealt > 0 && this._ready('thorns')) {
      this._proc('thorns');
      g.combat.damageEnemy(attacker, Math.max(1, Math.round(dealt * LEGENDARY_EFFECTS.thorns.pct)), false, { ctx: { source: 'counter', proc: true }, color: '#c0a060' });
    }
    if (ids.has('second_wind') && g.hero.alive && g.hero.hp / g.hero.maxHp < LEGENDARY_EFFECTS.second_wind.threshold && this._ready('second_wind')) {
      this._proc('second_wind');
      const healed = g.hero.heal(g.hero.maxHp * LEGENDARY_EFFECTS.second_wind.pct);
      g.log(`Second Wind! +${healed} HP.`, '#60ff80');
    }
  }
}
