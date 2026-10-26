import { BOSSES } from '../data/bosses.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { DIRS } from '../data/config.js';
import { chance } from '../core/rng.js';
import { drawText } from '../render/PixelFont.js';

// BossEncounterController + BossPhaseManager + BossAttackController: ONE generic driver for every
// boss in data/bosses.js. Encounter states:
//   dormant -> intro (engage) -> standard attacks -> phase transition (brief, IMMUNE, clearly shown)
//   -> special / enrage phase -> death (BossRewardManager lives in DungeonDirector.onBossDefeated)
// Every dangerous attack has a readable telegraph: melee wind-ups use the normal '!!' + guard prompt;
// area attacks paint danger tiles on the floor (view + minimap) for their whole wind-up; channels
// (curse / drain / summon / barrier / floor shift) show their name and a cast bar.
// Anti-exploit: control effects are shortened on bosses (RANK_RULES) and stuns grant immunity,
// the per-hit cap applies, boss heals are capped per drain, summons have alive/total caps.
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export class BossEncounterController {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.boss = null; this.activePattern = null; this.pendingPattern = null; this.game.dangerTiles = []; }

  get active() { const e = this.boss; return !!(e && e.alive && e.bossState?.started); }
  def(e) { return BOSSES[e.type]; }

  _state(e) {
    if (!e.bossState) e.bossState = { phaseIdx: 0, ready: {}, totalSummoned: 0, started: false, attack: null, transitionT: 0, barrierDmg: 0, channelDmg: 0, enrage: { speed: 1, dmg: 1 }, forced: [] };
    return e.bossState;
  }
  attacksFor(e) {
    const d = this.def(e), bs = this._state(e);
    const list = [...(d.phases[bs.phaseIdx]?.attacks || [])];
    const diff = DIFFICULTIES[this.game.run?.difficulty] || DIFFICULTIES.normal;
    if (diff.bossExtra) for (const id of d.difficultyAttacks?.[diff.id] || []) if (!list.includes(id)) list.push(id);
    return list;
  }
  phaseName(e) { const d = this.def(e); return d.phases[this._state(e).phaseIdx]?.name || ''; }

  // ------------------------------------------------------------------ engagement
  start(e) {
    const g = this.game, d = this.def(e), bs = this._state(e);
    if (bs.started) return;
    bs.started = true; this.boss = e;
    e.state = 'chase'; e.stateT = 0;
    for (const id of Object.keys(d.attacks)) bs.ready[id] = g.time + 2 + Math.random() * 2; // nothing fires the moment you walk in
    bs.ready[d.phases[0].attacks[0]] = g.time + 1.2;
    g.effects.showBanner(d.name.toUpperCase(), '#ff6040', 2.6);
    // Phase 6 entrance: cinematic bars + title for 2.4s. Purely visual - the fight is NOT paused
    // (the boss's first attack is already delayed 1.2s+ above), so nothing is unskippable.
    const title = d.title || '';
    g.effects.overlay(2.4, (ctx, k) => {
      const W = ctx.canvas.width, H = ctx.canvas.height, bar = Math.round(22 * Math.min(1, k * 6, (1 - k) * 5));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      if (bar > 12 && title) drawText(ctx, title.slice(0, 60), W / 2, H - bar + 7, '#c8a070', { align: 'center' });
    });
    g.log(`${d.name}, ${d.title}. ${d.intro}`, '#ff9a60');
    g.log(`Phase I - ${d.phases[0].name}.`, '#ffd040');
    g.audio.play('bossIntro');
    g.bus.emit('bossStarted', e);
  }

  // ------------------------------------------------------------------ per frame (from EnemyAI)
  update(e, dt, sees, adj) {
    const g = this.game, d = this.def(e), bs = this._state(e), p = g.player;
    if (!bs.started) {
      const inRoom = g.dungeon.roomAt(p.x, p.y).id === e.room;
      if (inRoom || (sees && cheb(e, p) <= 3)) this.start(e);
      return;
    }
    if (d.ironSkin) this._ironSkin(e);
    if (bs.transitionT > 0) { bs.transitionT -= dt; if (bs.transitionT <= 0) { e.invulnerable = false; e.state = 'chase'; } return; }
    if (e.state === 'hurt') { if (e.stateT >= e.stun) { e.state = 'chase'; e.stateT = 0; } return; } // parried / staggered
    if (bs.attack) { this._advance(e, dt, adj); return; }
    // choose the next attack (forced phase openers first)
    const now = g.time;
    let pick = bs.forced.shift() || null;
    if (!pick) {
      const opts = [];
      for (const id of this.attacksFor(e)) {
        const a = d.attacks[id];
        if (!a || now < (bs.ready[id] || 0)) continue;
        if (a.kind === 'melee') { if (adj) opts.push({ value: id, weight: 3 }); continue; }
        if (a.kind === 'summon' && !this._canSummon(e, a)) continue;
        if (a.kind === 'empower' && !g.enemies.some((q) => q.alive && q.summoner === e.id && !q.illusion)) continue;
        if (a.kind === 'illusion' && g.enemies.filter((q) => q.alive && q.illusion && q.summoner === e.id).length >= a.maxAlive) continue;
        if (a.kind === 'barrier' && g.status.has(e, a.status)) continue;
        if (a.kind === 'area' && a.shape === 'around' && cheb(e, p) > a.radius + 1) continue;
        if (a.kind === 'drain' && cheb(e, p) > a.radius + 2) continue;
        opts.push({ value: id, weight: 2 });
      }
      if (opts.length) {
        const total = opts.reduce((s, o) => s + o.weight, 0);
        let r = Math.random() * total;
        pick = opts.find((o) => (r -= o.weight) < 0)?.value || opts[0].value;
      }
    }
    if (pick) { this._begin(e, pick); return; }
    // otherwise close in
    e.state = 'chase';
    if (!adj) {
      e.moveT += dt;
      if (e.moveT >= d.moveInterval * bs.enrage.speed * g.status.moveMult(e)) {
        e.moveT = 0;
        const step = g.dungeon.nextStep(e.x, e.y, p.x, p.y, (x, y) => g.ai._occupied(x, y, e), 300);
        if (step && !(step.x === p.x && step.y === p.y) && g.dungeon.roomAt(step.x, step.y).id === e.room) g.ai._moveTo(e, step.x, step.y);
      }
    }
  }

  _ironSkin(e) {
    const g = this.game;
    const open = g.status.has(e, 'exposed') || g.status.has(e, 'armor_break');
    if (open && g.status.has(e, 'iron_skin')) {
      g.status.remove(e, 'iron_skin');
      g.effects.text(g.combat.screenPoint(e).x, 50, 'ARMOR CRACKED', '#ffd040', 1, 1);
      g.log(`${e.name}'s armour is cracked open!`, '#ffd040');
    } else if (!open && !g.status.has(e, 'iron_skin')) g.status.apply(e, 'iron_skin', { dur: 9999 });
  }

  _canSummon(e, a) {
    const alive = this.game.enemies.filter((q) => q.alive && q.summoned && q.summoner === e.id).length;
    return alive < a.maxAlive && this._state(e).totalSummoned < a.maxTotal;
  }

  // ------------------------------------------------------------------ attacks
  _begin(e, id) {
    const g = this.game, d = this.def(e), bs = this._state(e), a = d.attacks[id], p = g.player;
    const windup = a.windup * bs.enrage.speed;
    bs.attack = { id, a, t: 0, windup, stage: 'windup', tiles: null, hitPlayer: false };
    e.state = 'attack'; e.phase = 'windup'; e.phaseT = 0; e.curWindup = windup;
    e.strikeMult = (a.dmg || 1) * bs.enrage.dmg; e.curInflict = a.inflict || null;
    e.castName = a.name;
    g.audio.play(a.kind === 'melee' ? 'windup' : 'bossCast');
    if (a.kind === 'area') {
      bs.attack.tiles = this._tiles(e, a);
      const col = a.damageKind === 'blight' ? '#80c030' : a.damageKind === 'dark' ? '#a070e0' : '#ff3020';
      g.dangerTiles = bs.attack.tiles.map(([x, y]) => ({ x, y, until: g.time + windup, start: g.time, color: col }));
      g.log(`${e.name} prepares ${a.name}! Move out of the marked ground!`, '#ff9a60');
    } else if (a.kind === 'drain') {
      bs.attack.tiles = this._around(e, a.radius);
      g.dangerTiles = bs.attack.tiles.map(([x, y]) => ({ x, y, until: g.time + windup, start: g.time, color: '#c060ff' }));
      g.log(`${e.name} begins ${a.name}. Step away (${a.radius}+ tiles)!`, '#c080ff');
    } else if (a.kind === 'curse') {
      bs.channelDmg = 0;
      g.log(`${e.name} chants ${a.name}! Strike it hard to break the curse, or break line of sight.`, '#c080ff');
    } else if (a.kind === 'hazard') {
      this.pendingPattern = this.activePattern === 'A' ? 'B' : 'A';
      g.log(`${a.name}: the pale fire is moving! Watch the flickering tiles.`, '#a8f0ff');
    } else if (a.kind === 'summon' || a.kind === 'barrier') g.log(`${e.name} begins ${a.name}...`, '#ffb060');
    else g.log(`${e.name} raises its weapon: ${a.name}!`, '#ff9a60');
    void p;
  }

  _around(e, r) {
    const g = this.game, out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const x = e.x + dx, y = e.y + dy;
      if (g.dungeon.roomAt(x, y).id === e.room && g.dungeon.isWalkable(x, y)) out.push([x, y]);
    }
    return out;
  }

  _tiles(e, a) {
    const g = this.game, p = g.player, room = g.dungeon.room(e.room);
    const inRoom = (x, y) => room && x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2 && g.dungeon.isWalkable(x, y);
    if (a.shape === 'around') return this._around(e, a.radius);
    if (a.shape === 'cross') {
      const out = [];
      for (const d of DIRS) for (let i = 1; i <= a.radius; i++) { const x = e.x + d.dx * i, y = e.y + d.dy * i; if (!inRoom(x, y)) break; out.push([x, y]); }
      return out;
    }
    if (a.shape === 'line') {
      const dx = p.x - e.x, dy = p.y - e.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { dx: Math.sign(dx) || 1, dy: 0 } : { dx: 0, dy: Math.sign(dy) || 1 };
      const out = [];
      for (let i = 1; i <= a.length; i++) {
        const x = e.x + dir.dx * i, y = e.y + dir.dy * i;
        if (!inRoom(x, y)) break;
        out.push([x, y]);
        // the line is a lane: include the two side tiles of the first cells so it reads as a charge
      }
      this._state(e).attack.dir = dir;
      return out;
    }
    if (a.shape === 'cone') { // widening wedge toward the player (dragon breath)
      const dx = p.x - e.x, dy = p.y - e.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { dx: Math.sign(dx) || 1, dy: 0 } : { dx: 0, dy: Math.sign(dy) || 1 };
      const side = { dx: -dir.dy, dy: dir.dx }, out = [];
      for (let i = 1; i <= a.length; i++) {
        const w = Math.min(2, Math.floor(i / 2));
        for (let s = -w; s <= w; s++) { const x = e.x + dir.dx * i + side.dx * s, y = e.y + dir.dy * i + side.dy * s; if (inRoom(x, y)) out.push([x, y]); }
      }
      return out;
    }
    if (a.shape === 'zones') {
      const cand = [];
      if (room) for (let y = room.y1; y <= room.y2; y++) for (let x = room.x1; x <= room.x2; x++) if (inRoom(x, y) && !(x === e.x && y === e.y)) cand.push([x, y]);
      const out = [[p.x, p.y]];
      while (out.length < a.count && cand.length) { const i = Math.floor(Math.random() * cand.length); const c = cand.splice(i, 1)[0]; if (!out.some((o) => o[0] === c[0] && o[1] === c[1])) out.push(c); }
      return out;
    }
    return [];
  }

  _advance(e, dt, adj) {
    const g = this.game, bs = this._state(e), at = bs.attack, a = at.a, p = g.player;
    at.t += dt;
    e.phaseT = at.t;
    if (at.stage === 'windup') {
      if (at.t < at.windup) return;
      at.stage = 'recover'; at.t = 0;
      e.phase = 'strike';
      this._resolve(e, at, adj);
      at.recover = (a.recover || 0.8) * bs.enrage.speed;
      return;
    }
    if (at.stage === 'recover') {
      if (at.extraHits > 0 && at.t >= at.nextHit) { // follow-up strikes of a combo
        at.extraHits--; at.nextHit += at.a.gap || 0.45;
        e.phase = 'strike';
        if (Math.abs(e.x - g.player.x) + Math.abs(e.y - g.player.y) === 1) g.combat.enemyStrike(e);
        return;
      }
      if (at.t > 0.25 && e.phase === 'strike') e.phase = 'recover';
      if (at.t < at.recover) return;
      this._finish(e, at);
    }
    void p;
  }

  _resolve(e, at, adj) {
    const g = this.game, d = this.def(e), bs = this._state(e), a = at.a, p = g.player;
    switch (a.kind) {
      case 'melee':
        g.combat.enemyStrike(e); // adjacency, guard, perfect parry, Sunder/Blight riders: the normal rules
        at.extraHits = (a.hits || 1) - 1; at.nextHit = a.gap || 0.45; // multi-strike combos (each one guardable)
        break;
      case 'empower': {
        let n = 0;
        for (const q of g.enemies) if (q.alive && q.summoner === e.id) { g.status.apply(q, 'empowered', { dur: 8 }); n++; }
        g.audio.play('buff');
        g.log(n ? `${a.name}: ${n} servant${n > 1 ? 's are' : ' is'} EMPOWERED - kill them or wait it out.` : `${a.name} echoes, but no servant answers.`, '#ff60ff');
        break;
      }
      case 'illusion': {
        const alive = g.enemies.filter((q) => q.alive && q.illusion && q.summoner === e.id).length;
        const free = this._around(e, 2).filter(([x, y]) => !g.ai._occupied(x, y, null));
        let made = 0;
        for (let i = 0; i < Math.min(a.count, a.maxAlive - alive) && free.length; i++) {
          const [x, y] = free.splice(Math.floor(Math.random() * free.length), 1)[0];
          const m = g.ai.spawnExtra({ x, y, type: 'illusion', level: e.level, room: e.room }); m.summoner = e.id; m.state = 'detect'; made++;
        }
        if (made) g.log(`${a.name}: ${made} ILLUSION${made > 1 ? 'S' : ''} appear (1 HP, harmless, clearly marked). The real Prophet has the HP bar.`, '#c8c0f0');
        break;
      }
      case 'area': {
        const onIt = at.tiles.some(([x, y]) => x === p.x && y === p.y);
        if (a.dash && at.dir) { // charge: the boss crashes to the end of its lane
          let tx = e.x, ty = e.y;
          for (const [x, y] of at.tiles) { if (g.ai._occupied(x, y, e)) break; tx = x; ty = y; }
          if (tx !== e.x || ty !== e.y) { e.x = tx; e.y = ty; e.moveAnim = 0.35; }
        }
        g.audio.play('groundSlam');
        g.effects.addShake(g.settings.reduceFx ? 2 : 8);
        if (onIt && g.hero.alive) {
          at.hitPlayer = true;
          const raw = (d.atk[0] + d.atk[1]) / 2 * e.atkMult * e.strikeMult * g.status.enemyAtkMult(e);
          g.hurtPlayer(raw, { kind: a.damageKind || 'physical', label: `${e.name}'s ${a.name}`, nonLethal: false, by: e });
          if (a.inflict && g.hero.alive && chance(a.inflict.chance)) g.applyPlayerDebuff(a.inflict.status, a.inflict.dur);
        } else g.log(`You avoid the ${a.name}.`, '#9ad0ff');
        g.dangerTiles = [];
        if (a.exposeIfMissed && !at.hitPlayer) this.expose(e, a.exposeIfMissed, 'THE CORE IS EXPOSED!');
        break;
      }
      case 'summon': {
        const free = this._around(e, 1).concat(this._around(e, 2)).filter(([x, y]) => !g.ai._occupied(x, y, null) && !g.dungeon.featureAt(x, y));
        let n = Math.min(a.count, a.maxAlive - g.enemies.filter((q) => q.alive && q.summoned && q.summoner === e.id).length, a.maxTotal - bs.totalSummoned);
        let made = 0;
        while (n-- > 0 && free.length) {
          const [x, y] = free.splice(Math.floor(Math.random() * free.length), 1)[0];
          const m = g.ai.spawnExtra({ x, y, type: a.spawn, level: Math.max(1, e.level - 3), room: e.room });
          m.summoner = e.id; m.state = 'detect'; made++;
        }
        bs.totalSummoned += made;
        if (made) { g.audio.play('summon'); g.log(`${a.name}: ${made} servant${made > 1 ? 's' : ''} rise! (Summoned foes carry no loot.)`, '#ff9a60'); }
        break;
      }
      case 'barrier':
        g.status.apply(e, a.status, { dur: a.dur });
        bs.barrierDmg = 0;
        g.audio.play('barrier');
        g.log(`${a.name}! Damage is greatly reduced - break it with ${a.breakDamage} damage to expose ${e.name}.`, '#a8d8f0');
        break;
      case 'curse': {
        const reach = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 7 && g.dungeon.hasLOS(e.x, e.y, p.x, p.y);
        if (reach) { g.applyPlayerDebuff('cursed', a.dur); g.audio.play('curse'); g.effects.screenFlash('#6020a0', 0.4); }
        else g.log('The curse finds no one in sight.', '#9ad0ff');
        break;
      }
      case 'drain': {
        const inside = at.tiles.some(([x, y]) => x === p.x && y === p.y);
        g.dangerTiles = [];
        if (inside) {
          const lost = Math.min(g.resource.value, Math.round(g.resource.max * a.resourcePct));
          g.resource._set(g.resource.value - lost); // clamped, never negative
          const dealt = g.hurtPlayer(g.hero.maxHp * a.hpPct, { kind: 'dark', label: a.name, nonLethal: true, by: e });
          const heal = Math.min(dealt, Math.round(e.maxHp * a.healCapPct));
          e.hp = Math.min(e.maxHp, e.hp + heal);
          g.audio.play('drain');
          g.log(`${a.name} tears away ${lost} ${g.resource.def.name} and ${dealt} HP (it heals ${heal}).`, '#c080ff');
        } else g.log(`You stay clear of ${a.name}.`, '#9ad0ff');
        break;
      }
      case 'hazard':
        this.activePattern = this.pendingPattern; this.pendingPattern = null;
        g.audio.play('spectral');
        g.log('The pale fire settles on new tiles.', '#a8f0ff');
        break;
      default: break;
    }
    if (a.vulnerable) this.expose(e, a.vulnerable, 'VULNERABLE!');
  }

  _finish(e, at) {
    const g = this.game, bs = this._state(e);
    bs.ready[at.id] = g.time + at.a.cd * bs.enrage.speed;
    bs.attack = null;
    e.state = 'chase'; e.phase = null; e.strikeMult = 1; e.curInflict = null; e.castName = null; e.curWindup = null;
  }

  cancelAttack(e, why) {
    const g = this.game, bs = this._state(e);
    if (!bs.attack) return;
    if (why) g.log(why, '#9ad0ff');
    if (bs.attack.a.kind === 'hazard') this.pendingPattern = null;
    bs.ready[bs.attack.id] = g.time + bs.attack.a.cd * 0.5;
    bs.attack = null; g.dangerTiles = [];
    e.phase = null; e.strikeMult = 1; e.curInflict = null; e.castName = null; e.curWindup = null;
  }

  expose(e, secs, text) {
    const g = this.game;
    g.status.apply(e, 'exposed', { dur: secs });
    g.effects.text(g.combat.screenPoint(e).x, 46, text, '#ffd040', 2, 1.2);
    g.log(`${text} ${e.name} takes +50% damage for ${secs}s.`, '#ffd040');
    g.audio.play('vulnerable');
  }

  // ------------------------------------------------------------------ hooks from CombatSystem
  onDamaged(e, amount) {
    const g = this.game, d = this.def(e), bs = this._state(e);
    if (!bs.started) this.start(e);
    const barrierAtk = Object.values(d.attacks).find((a) => a.kind === 'barrier' && g.status.has(e, a.status));
    if (barrierAtk) {
      bs.barrierDmg += amount;
      if (bs.barrierDmg >= barrierAtk.breakDamage) {
        g.status.remove(e, barrierAtk.status);
        g.log('The barrier shatters!', '#a8d8f0');
        this.expose(e, barrierAtk.exposeOnBreak || 3, 'BARRIER BROKEN!');
      }
    }
    const at = bs.attack;
    if (at && at.a.kind === 'curse' && at.stage === 'windup') {
      bs.channelDmg += amount;
      if (bs.channelDmg >= e.maxHp * at.a.interrupt) {
        this.cancelAttack(e, 'You break the curse before it lands!');
        g.ai.stagger(e, 0.6);
      }
    }
  }

  onParried(e) {
    const d = this.def(e);
    this.cancelAttack(e);
    if (d.counterWindow) this.expose(e, d.counterWindow, 'COUNTER WINDOW!');
  }

  // Phase thresholds: each crossed phase runs its transition once (in order).
  checkPhase(e) {
    const g = this.game, d = this.def(e), bs = this._state(e);
    let next = bs.phaseIdx + 1;
    while (next < d.phases.length && e.hp / e.maxHp <= d.phases[next].at) {
      bs.phaseIdx = next;
      const ph = d.phases[next];
      this.cancelAttack(e);
      bs.forced.push(...(ph.onEnter || []));
      if (ph.enrage) bs.enrage = { ...ph.enrage };
      e.invulnerable = true; bs.transitionT = 1.5; e.state = 'chase';
      g.effects.showBanner(`PHASE ${['I', 'II', 'III', 'IV'][next] || next + 1}: ${ph.name}`, ph.enrage ? '#ff3020' : '#ffb040', 2.2);
      g.effects.screenFlash(ph.enrage ? '#ff2000' : '#ffb040', g.settings.reduceFx ? 0.15 : 0.4);
      g.log(`${e.name} - ${ph.name}${ph.enrage ? ' (ENRAGED: faster, harder blows)' : ''}.`, '#ffd040');
      g.audio.play('bossPhase');
      g.bus.emit('bossPhase', { e, phase: next });
      next++;
    }
  }

  onBossDeath(e) {
    const g = this.game;
    g.dangerTiles = []; this.activePattern = null; this.pendingPattern = null;
    for (const m of g.enemies) if (m.summoned && m.summoner === e.id && m.alive) { m.alive = false; m.dying = true; m.deathT = 0; m.hp = 0; m.lootRolled = true; m.state = 'death'; }
    e.invulnerable = false;
    if (this.boss === e) this.boss = null;
  }
}
