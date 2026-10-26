import { DIRS } from '../data/config.js';
import { chance } from '../core/rng.js';

// Reusable enemy behaviour components (Phase 5). EnemyAI keeps the shared state machine
// (idle / patrol / detect / chase / attack / hurt / death); this module adds, per enemy definition:
//   ai: 'ranged'  keeps 2+ tiles away while it has line of sight, then casts
//   abilities[] (each with cd + telegraphed windup, interrupted by a stagger):
//     bolt     ranged shot; hits if you are still in its line of sight and range (guard halves it)
//     charge   paints a line on the floor, then dashes along it (noDash: breath, no movement)
//     nova     paints the tiles around it, then strikes them
//     empower  support: nearby allies gain EMPOWERED (+30% damage, -15% damage taken) for a while
//     summon   raises up to maxAlive helpers, maxTotal per enemy (summons carry no loot or XP)
//     gaze     "LOOK AWAY": if you are still facing it when it ends you are Petrified briefly
//   Returns true while it is casting / repositioning, so EnemyAI skips its default logic that frame.
export class EnemyAbilities {
  constructor(game) { this.game = game; }

  _dist(e) { const p = this.game.player; return Math.abs(e.x - p.x) + Math.abs(e.y - p.y); }
  _aware(e) { return ['chase', 'attack', 'detect', 'hurt'].includes(e.state); }

  update(e, dt, sees, adj) {
    const g = this.game;
    if (e.illusion) return false;
    const ab = e.ability;
    if (ab) { this._advance(e, ab, dt); return true; }
    if (!this._aware(e) || e.state === 'hurt' || (e.state === 'attack' && e.phase !== 'ready' && e.phase !== 'recover')) return false;
    // choose an ability that is off cooldown and makes sense right now
    for (const a of e.def.abilities || []) {
      if (g.time < (e.abilityCd[a.id] || 0)) continue;
      if (!this._usable(e, a, sees, adj)) continue;
      this._begin(e, a);
      return true;
    }
    // ranged AI: back off when the player is adjacent (if there is room), otherwise default chase
    if (e.def.ai === 'ranged' && sees && this._dist(e) <= 1 && e.state !== 'attack') {
      e.moveT += dt;
      if (e.moveT >= e.def.moveInterval * (e.moveMult || 1)) {
        e.moveT = 0;
        const p = g.player;
        const away = DIRS.map((d) => ({ x: e.x + d.dx, y: e.y + d.dy })).filter((c) => g.dungeon.isWalkable(c.x, c.y) && !g.ai._occupied(c.x, c.y, e))
          .sort((a, b) => (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)) - (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)))[0];
        if (away && Math.abs(away.x - p.x) + Math.abs(away.y - p.y) > 1) { g.ai._moveTo(e, away.x, away.y); return true; }
      }
    }
    // ranged AI at range with sight: hold position (abilities fire when ready)
    if (e.def.ai === 'ranged' && sees && this._dist(e) >= 2 && this._dist(e) <= 5) { e.state = 'chase'; return true; }
    return false;
  }

  _usable(e, a, sees, adj) {
    const g = this.game, d = this._dist(e);
    switch (a.kind) {
      case 'bolt': case 'gaze': return sees && d >= 1 && d <= a.range;
      case 'charge': { const p = g.player; return sees && d >= 2 && d <= a.length && (p.x === e.x || p.y === e.y); }
      case 'nova': return d <= (a.radius || 1) + 1;
      case 'empower': return g.enemies.some((q) => q !== e && q.alive && !q.illusion && Math.abs(q.x - e.x) + Math.abs(q.y - e.y) <= a.radius && !g.status.has(q, 'empowered'));
      case 'summon': {
        const alive = g.enemies.filter((q) => q.alive && q.summoner === e.id).length;
        return sees && alive < a.maxAlive && (e.summonTotal || 0) < a.maxTotal;
      }
      default: return false;
    }
  }

  _begin(e, a) {
    const g = this.game, p = g.player;
    const ab = { a, t: 0, windup: a.windup * (e.windupMult || 1), tiles: null };
    e.ability = ab; e.castName = a.name; e.curWindup = ab.windup;
    e.state = 'attack'; e.phase = 'windup'; e.phaseT = 0;
    if (a.kind === 'charge') {
      const dir = { dx: Math.sign(p.x - e.x), dy: Math.sign(p.y - e.y) };
      ab.dir = dir; ab.tiles = [];
      for (let i = 1; i <= a.length; i++) { const x = e.x + dir.dx * i, y = e.y + dir.dy * i; if (!g.dungeon.isWalkable(x, y)) break; ab.tiles.push([x, y]); }
    } else if (a.kind === 'nova') {
      ab.tiles = [];
      for (let dy = -a.radius; dy <= a.radius; dy++) for (let dx = -a.radius; dx <= a.radius; dx++) if ((dx || dy) && g.dungeon.isWalkable(e.x + dx, e.y + dy)) ab.tiles.push([e.x + dx, e.y + dy]);
    }
    if (ab.tiles) {
      const col = a.damageKind === 'fire' ? '#ff7020' : a.damageKind === 'blight' ? '#80c030' : '#ff3020';
      g.dangerTiles.push(...ab.tiles.map(([x, y]) => ({ x, y, until: g.time + ab.windup, start: g.time, color: col, owner: e.id })));
    }
    const near = this._dist(e) <= 7;
    if (near) {
      const hint = { bolt: 'break line of sight or guard', charge: 'step out of the line', nova: 'step away', gaze: 'LOOK AWAY - face another direction', empower: 'kill it to stop the chant', summon: '' }[a.kind];
      g.log(`${e.name}: ${a.name}!${hint ? ` (${hint})` : ''}`, '#ff9a60');
      g.audio.play(a.kind === 'gaze' ? 'curse' : 'bossCast');
    }
  }

  // A stagger (heavy hit / parry) interrupts any cast.
  interrupt(e) {
    if (!e.ability) return;
    this.game.dangerTiles = this.game.dangerTiles.filter((d) => d.owner !== e.id);
    e.abilityCd[e.ability.a.id] = this.game.time + e.ability.a.cd * 0.5;
    e.ability = null; e.castName = null; e.curWindup = null; e.phase = null;
  }

  _advance(e, ab, dt) {
    const g = this.game;
    if (e.state === 'hurt') { this.interrupt(e); return; }
    ab.t += dt; e.phaseT = ab.t;
    if (ab.t < ab.windup) return;
    this._resolve(e, ab);
    e.abilityCd[ab.a.id] = g.time + ab.a.cd;
    e.ability = null; e.castName = null; e.curWindup = null;
    e.state = 'chase'; e.phase = null; e.moveT = -0.4;
  }

  _hurt(e, mult, kind = 'dark') {
    const g = this.game;
    const raw = ((e.def.atk[0] + e.def.atk[1]) / 2) * e.atkMult * mult * g.status.enemyAtkMult(e);
    return g.hurtPlayer(raw, { kind: kind === 'fire' ? 'dark' : kind, label: `${e.name}'s attack`, nonLethal: false, by: e });
  }

  _resolve(e, ab) {
    const g = this.game, a = ab.a, p = g.player;
    switch (a.kind) {
      case 'bolt': {
        const hit = this._dist(e) <= a.range + 1 && g.dungeon.hasLOS(e.x, e.y, p.x, p.y);
        if (!hit) { g.log(`${a.name} misses - you were out of sight.`, '#9ad0ff'); break; }
        const facing = DIRS[p.dir].dx === Math.sign(e.x - p.x) && DIRS[p.dir].dy === Math.sign(e.y - p.y);
        const guarded = p.guarding && facing;
        g.audio.play('spell');
        this._hurt(e, (a.dmg || 1) * (guarded ? 0.35 : 1), a.damageKind || 'dark');
        if (a.inflict && !guarded && chance(a.inflict.chance)) g.applyPlayerDebuff(a.inflict.status, a.inflict.dur);
        break;
      }
      case 'charge': case 'nova': {
        g.dangerTiles = g.dangerTiles.filter((d) => d.owner !== e.id);
        const on = ab.tiles.some(([x, y]) => x === p.x && y === p.y);
        if (a.kind === 'charge' && !a.noDash) {
          let tx = e.x, ty = e.y;
          for (const [x, y] of ab.tiles) { if (g.ai._occupied(x, y, e)) break; tx = x; ty = y; }
          e.x = tx; e.y = ty; e.moveAnim = 0.35;
        }
        g.audio.play('groundSlam');
        if (on) {
          this._hurt(e, a.dmg || 1, a.damageKind || 'physical');
          if (a.inflict && chance(a.inflict.chance)) g.applyPlayerDebuff(a.inflict.status, a.inflict.dur);
        } else if (this._dist(e) <= 8) g.log(`You avoid ${a.name}.`, '#9ad0ff');
        break;
      }
      case 'empower': {
        let n = 0;
        for (const q of g.enemies) if (q !== e && q.alive && !q.illusion && Math.abs(q.x - e.x) + Math.abs(q.y - e.y) <= a.radius) { g.status.apply(q, 'empowered', { dur: a.dur }); n++; }
        if (n) { g.audio.play('buff'); g.log(`${a.name} empowers ${n} ${n > 1 ? 'allies' : 'ally'}!`, '#ff60ff'); }
        break;
      }
      case 'summon': {
        let made = 0;
        const alive = g.enemies.filter((q) => q.alive && q.summoner === e.id).length;
        const n = Math.min(a.count, a.maxAlive - alive, a.maxTotal - (e.summonTotal || 0));
        const free = DIRS.map((d) => [e.x + d.dx, e.y + d.dy]).filter(([x, y]) => g.dungeon.isWalkable(x, y) && !g.ai._occupied(x, y, null));
        for (let i = 0; i < n && free.length; i++) { const [x, y] = free.splice(Math.floor(Math.random() * free.length), 1)[0]; const m = g.ai.spawnExtra({ x, y, type: a.spawn, level: Math.max(1, e.level - 4), room: e.room }); m.summoner = e.id; m.state = 'detect'; made++; }
        e.summonTotal = (e.summonTotal || 0) + made;
        if (made) { g.audio.play('summon'); g.log(`${e.name} raises ${made} servant${made > 1 ? 's' : ''}. (Summons carry no loot.)`, '#ff9a60'); }
        break;
      }
      case 'gaze': {
        const facing = DIRS[p.dir].dx === Math.sign(e.x - p.x) && DIRS[p.dir].dy === Math.sign(e.y - p.y) && (p.x === e.x || p.y === e.y);
        // no stun chains: after a petrify you are immune to the next one for 4s (several gorgons included)
        if (facing && g.time < (this.petrifyImmuneUntil || 0)) g.log('The stone in your veins resists the gaze.', '#9ad0ff');
        else if (facing && g.dungeon.hasLOS(e.x, e.y, p.x, p.y) && this._dist(e) <= a.range) { g.applyPlayerDebuff('petrified', a.dur); this.petrifyImmuneUntil = g.time + a.dur + 4; g.effects.screenFlash('#a0a090', g.settings.reduceFx ? 0.15 : 0.4); }
        else g.log('You look away just in time.', '#9ad0ff');
        break;
      }
      default: break;
    }
  }
}
