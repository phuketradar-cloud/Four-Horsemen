import { DIRS } from '../data/config.js';
import { COMPANION_AI, AI_STYLES, PARTY_TUNING } from '../data/party.js';

// Decision-making for the three AI-controlled Horsemen. Runs INSIDE the companion's context
// (PartySystem.withActor): g.player is the companion's body, g.hero / g.weapons / g.skills its own.
// It only decides and moves; every attack goes through CombatSystem.playerAttack() and every
// ability through SkillSystem.use(), so cooldowns, costs, hit detection and damage are the
// player's rules. States:
//   FOLLOW   no foe: walk to its formation cell (the leader's recent trail)
//   SEARCH   lost sight of its target: go to where it was last seen (then FOLLOW)
//   APPROACH move to an attack position (adjacent for melee, in a clear line for ranged)
//   ATTACK   in position: face the target, cast a ready ability or swing / shoot
//   DEFEND   a foe is winding up against it and it is hurt: raise the guard
//   RECOVER  badly hurt: back away towards the leader, guarding
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const AWARE = ['detect', 'chase', 'attack', 'hurt'];

export class CompanionAI {
  constructor(g, party) { this.g = g; this.party = party; }

  get style() { return AI_STYLES[this.g.settings.aiStyle] || AI_STYLES.balanced; }

  update(m, dt) {
    const g = this.g, b = g.player, ai = m.ai, cfg = COMPANION_AI[m.classId], st = this.style;
    const lead = this.party.bodyOf(this.party.ctl);
    for (const [id, until] of ai.unreachable) if (g.time >= until) ai.unreachable.delete(id);
    // stuck / left behind -> catch up behind the leader
    if (ai.lastPos && ai.lastPos.x === b.x && ai.lastPos.y === b.y && ai.state !== 'ATTACK' && ai.state !== 'DEFEND' && manhattan(b, lead) > 2) ai.stuck += dt; else ai.stuck = 0;
    ai.lastPos = { x: b.x, y: b.y };
    if (manhattan(b, lead) > PARTY_TUNING.leash || ai.stuck > PARTY_TUNING.stuckTime) { this._catchUp(m, lead); return; }

    ai.think -= dt;
    if (ai.think <= 0) { ai.think = st.think; this._decide(m, cfg, st, lead); }
    this._act(m, cfg, st, lead);
  }

  // ---------------------------------------------------------------- decisions
  _foes(b, lead) {
    const g = this.g, dm = g.dungeon, R = PARTY_TUNING.detectRange;
    const seenBy = (e, o) => manhattan(e, o) <= R && dm.hasLOS(o.x, o.y, e.x, e.y);
    return g.enemies.filter((e) => e.alive && !e.illusion && (AWARE.includes(e.state) || seenBy(e, b)) && (seenBy(e, b) || seenBy(e, lead)));
  }

  _score(e, m, cfg, st, b) {
    const g = this.g, pf = cfg.prefer;
    let s = manhattan(e, b);
    if (pf.nearest) s += pf.nearest * (manhattan(e, b) <= 1 ? 1 : 0);
    if (pf.marked && g.status.has(e, 'mark')) s += pf.marked;
    if (pf.vulnerable && g.status.has(e, 'exposed')) s += pf.vulnerable;
    if (pf.lowHp) s += pf.lowHp * (1 - e.hp / e.maxHp) * 2;
    if (pf.elite && (e.rank === 'elite' || e.rank === 'boss' || e.boss)) s += pf.elite;
    if (pf.notWithered && !g.status.has(e, 'wither')) s += pf.notWithered;
    if (pf.graveMarked && g.status.has(e, 'grave_mark')) s += pf.graveMarked;
    // assist: foes fighting the controlled Horseman come first
    if (pf.attackingLeader && (e.aggro === this.party.ctl || !e.aggro) && e.state === 'attack') s += pf.attackingLeader;
    // distribution: every other companion already on this foe makes it less attractive
    const others = this.party.companions.filter((o) => o !== m && this.party.alive(o) && o.ai.targetId === e.id).length;
    s += others * st.spread;
    return s;
  }

  _decide(m, cfg, st, lead) {
    const g = this.g, b = g.player, ai = m.ai;
    const hpFrac = g.hero.hp / g.hero.maxHp;
    const foes = this._foes(b, lead).filter((e) => !ai.unreachable.has(e.id));
    const adjacent = foes.filter((e) => manhattan(e, b) === 1);
    // RECOVER: badly hurt with a foe next to it
    if (hpFrac < cfg.retreatAt * st.retreatMult && adjacent.length) { ai.state = 'RECOVER'; return; }
    // DEFEND: an adjacent foe is winding up against this companion and it is hurt enough to care
    const threat = adjacent.find((e) => e.aggro === m && e.state === 'attack' && e.phase === 'windup');
    if (threat && hpFrac < cfg.guardAt * st.guardMult) { ai.state = 'DEFEND'; ai.targetId = threat.id; return; }
    let target = foes.find((e) => e.id === ai.targetId) || null;
    if (!target || ai.state === 'FOLLOW' || ai.state === 'SEARCH') {
      target = foes.slice().sort((a, c) => this._score(a, m, cfg, st, b) - this._score(c, m, cfg, st, b))[0] || null;
    }
    if (target) {
      ai.targetId = target.id; ai.lastSeen = { x: target.x, y: target.y };
      g.target = target;
      // badly hurt melee fighters do not walk back into a brawl: they hold back near the leader
      // (abilities that heal or protect are still used from RECOVER)
      if (hpFrac < cfg.retreatAt * st.retreatMult && !this._ranged() && !this._inPosition(target, m)) { ai.state = 'RECOVER'; return; }
      ai.state = this._inPosition(target, m) ? 'ATTACK' : 'APPROACH';
      return;
    }
    // no valid foe: search where the last one was seen, then follow the leader
    g.target = null;
    if (ai.targetId !== null && ai.lastSeen && manhattan(b, ai.lastSeen) > 0 && ai.state !== 'FOLLOW') { ai.state = 'SEARCH'; ai.targetId = null; return; }
    if (ai.state === 'SEARCH' && ai.lastSeen && manhattan(b, ai.lastSeen) > 0) return;
    ai.state = 'FOLLOW'; ai.targetId = null; ai.lastSeen = null;
  }

  _ranged() { return this.g.weapons.current.def.kind === 'ranged'; }

  // Melee: orthogonally adjacent. Ranged: same row/column, within weapon range, nothing solid between.
  _inPosition(e, m, at = this.g.player) {
    const g = this.g;
    const d = manhattan(e, at);
    if (!this._ranged()) return d === 1;
    const range = g.weapons.current.def.range || 6;
    if (!(e.x === at.x || e.y === at.y) || d > range || d < 1) return false;
    return g.dungeon.hasLOS(at.x, at.y, e.x, e.y) && !this._allyBetween(at, e);
  }

  _allyBetween(a, e) {
    const dx = Math.sign(e.x - a.x), dy = Math.sign(e.y - a.y);
    for (let x = a.x + dx, y = a.y + dy; x !== e.x || y !== e.y; x += dx, y += dy) if (this.party.occupied(x, y, this.party.current)) return true;
    return false;
  }

  // ---------------------------------------------------------------- actions
  _act(m, cfg, st, lead) {
    const g = this.g, b = g.player, ai = m.ai;
    const target = g.enemies.find((e) => e.id === ai.targetId && e.alive) || null;
    switch (ai.state) {
      case 'FOLLOW': {
        b.guarding = false;
        const slot = this.party.companions.filter((o) => this.party.alive(o)).indexOf(m);
        const goal = this.party.trail[slot] || this.party.trail[this.party.trail.length - 1] || null;
        if (goal && manhattan(b, lead) > 1 && !(goal.x === b.x && goal.y === b.y)) this._stepTowards(goal, lead);
        else if (manhattan(b, lead) > 2) this._stepTowards(lead, lead);
        else if (g.time - b.lastTurnAt > 1) { b.dir = this.party.bodyOf(this.party.ctl).dir; }
        break;
      }
      case 'SEARCH':
        b.guarding = false;
        if (ai.lastSeen) { if (manhattan(b, ai.lastSeen) <= 1) { ai.lastSeen = null; ai.state = 'FOLLOW'; } else this._stepTowards(ai.lastSeen, lead); }
        break;
      case 'APPROACH': {
        b.guarding = false;
        if (!target) { ai.state = 'FOLLOW'; break; }
        if (this._inPosition(target, m)) { ai.state = 'ATTACK'; break; }
        const ok = this._ranged() || cfg.keepAway >= 2 ? this._stepToFiringCell(target, cfg) : this._stepTowards(target, lead, true);
        if (ok === false) { ai.unreachable.set(target.id, g.time + PARTY_TUNING.unreachableFor); ai.targetId = null; g.target = null; ai.think = 0; }
        break;
      }
      case 'ATTACK': {
        if (!target) { ai.targetId = null; ai.think = 0; ai.state = 'FOLLOW'; break; }
        if (!this._inPosition(target, m)) { ai.state = 'APPROACH'; break; }
        // ranged / kiting classes step back from a melee foe that closes in, when there is room
        if (cfg.keepAway >= 2 && manhattan(target, b) === 1 && b.moveCD <= 0 && this._stepAway(target)) break;
        this._face(target);
        b.guarding = false;
        g.target = target;
        if (this._tryAbility(m, cfg, st, target)) break;
        if (g.weapons.canAttack()) g.combat.playerAttack();
        break;
      }
      case 'DEFEND': {
        const e = target;
        if (!e || !(e.state === 'attack' && (e.phase === 'windup' || e.phase === 'strike'))) { b.guarding = false; ai.state = e ? 'ATTACK' : 'FOLLOW'; break; }
        this._face(e);
        if (!b.guarding) { b.guarding = true; b.guardStart = g.time; }
        b.guardUntil = g.time + 0.3;
        break;
      }
      case 'RECOVER': {
        const adj = g.enemies.find((e) => e.alive && manhattan(e, b) === 1);
        if (adj) { this._face(adj); if (!this._stepAway(adj)) { if (!b.guarding) { b.guarding = true; b.guardStart = g.time; } b.guardUntil = g.time + 0.3; } }
        else { b.guarding = false; if (manhattan(b, lead) > 1) this._stepTowards(lead, lead); }
        // a self ability that helps (Famine's drain, Death's Wraith Step) is still allowed
        this._tryAbility(m, cfg, st, adj || null, true);
        break;
      }
      default: break;
    }
  }

  // Tries the class abilities in priority order (only ones the normal SkillSystem accepts).
  _tryAbility(m, cfg, st, target, defensiveOnly = false) {
    const g = this.g, ai = m.ai;
    if (g.time - ai.lastCast < st.skillGap) return false;
    const foesNear = g.enemies.filter((e) => e.alive && manhattan(e, g.player) <= 3).length;
    for (const s of cfg.skills) {
      if (defensiveOnly && s.when !== 'hurt') continue;
      const ok = s.when === 'always' ? !!target
        : s.when === 'adjacent' ? !!target && manhattan(target, g.player) === 1
        : s.when === 'multi' ? foesNear >= 2
        : s.when === 'hurt' ? g.hero.hp / g.hero.maxHp < 0.5
        : s.when === 'lowTarget' ? !!target && target.hp / target.maxHp < 0.35
        : s.when.startsWith('notStatus:') ? !!target && !g.status.has(target, s.when.slice(10)) : false;
      if (!ok || !g.skills.slots.includes(s.id)) continue;
      if (!g.skills.canUse(s.id).ok) continue;
      if (g.skills.use(s.id)) {
        ai.lastCast = g.time;
        m.lastAction = { text: g.skills.params(s.id).name, t: g.time, skill: true };
        if (g.skills.params(s.id).ultimate) g.notify(`${m.name} unleashes ${g.skills.params(s.id).name}!`, { kind: 'info', sound: false });
        return true;
      }
    }
    return false;
  }

  _face(e) {
    const b = this.g.player;
    const d = DIRS.findIndex((v) => v.dx === Math.sign(e.x - b.x) && v.dy === Math.sign(e.y - b.y) && (v.dx === 0 || v.dy === 0));
    if (d >= 0 && d !== b.dir) { b.dir = d; b.lastTurnAt = this.g.time; }
  }

  _free(x, y) {
    const g = this.g;
    return g.dungeon.isWalkable(x, y) && !g.ai.enemyAt(x, y) && !this.party.occupied(x, y, this.party.current);
  }

  _move(x, y) {
    const g = this.g, b = g.player;
    if (b.moveCD > 0 || !this._free(x, y)) return false;
    const d = DIRS.findIndex((v) => v.dx === x - b.x && v.dy === y - b.y);
    if (d < 0) return false;
    b.prevX = b.x; b.prevY = b.y;
    b.x = x; b.y = y; b.dir = d;
    b.moveCD = g.hero.moveRepeat || 0.2;
    return true;
  }

  // One BFS step towards a cell (or next to a foe). false = no path at all (unreachable).
  _stepTowards(goal, lead, isFoe = false) {
    const g = this.g, b = g.player;
    if (b.moveCD > 0) return true;
    const blocked = (x, y) => !!g.ai.enemyAt(x, y) || this.party.occupied(x, y, this.party.current);
    const step = g.dungeon.nextStep(b.x, b.y, goal.x, goal.y, blocked, 300);
    if (!step) return isFoe ? false : true;
    if (step.x === goal.x && step.y === goal.y && (isFoe || !this._free(step.x, step.y))) return true; // already beside it
    return this._move(step.x, step.y) || true;
  }

  // Ranged: walk to the nearest free cell that has a clear shot and is not adjacent to the foe.
  _stepToFiringCell(e, cfg) {
    const g = this.g, b = g.player, dm = g.dungeon;
    if (b.moveCD > 0) return true;
    const want = (x, y) => this._inPosition(e, null, { x, y }) && manhattan({ x, y }, e) >= Math.min(cfg.keepAway, 2);
    const start = `${b.x},${b.y}`, prev = new Map([[start, null]]), q = [[b.x, b.y]];
    let found = null;
    for (let i = 0; i < q.length && i < 250 && !found; i++) {
      const [x, y] = q[i];
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy, k = `${nx},${ny}`;
        if (prev.has(k) || !this._free(nx, ny)) continue;
        prev.set(k, `${x},${y}`); q.push([nx, ny]);
        if (want(nx, ny)) { found = k; break; }
      }
    }
    if (!found) return this._stepTowards(e, null, true); // no firing lane: close in like a melee fighter
    let k = found;
    while (prev.get(k) !== start) k = prev.get(k);
    const [x, y] = k.split(',').map(Number);
    return this._move(x, y) || true;
  }

  _stepAway(e) {
    const g = this.g, b = g.player, lead = this.party.bodyOf(this.party.ctl);
    let best = null;
    for (const d of DIRS) {
      const x = b.x + d.dx, y = b.y + d.dy;
      if (!this._free(x, y)) continue;
      const score = manhattan({ x, y }, e) * 2 - manhattan({ x, y }, lead) * 0.5;
      if (manhattan({ x, y }, e) > 1 && (!best || score > best.score)) best = { x, y, score };
    }
    if (!best) return false;
    return this._move(best.x, best.y);
  }

  // Left behind or stuck: reappear on a free cell next to the leader (never on top of anyone).
  _catchUp(m, lead) {
    const g = this.g, b = g.player;
    for (const t of [...this.party.trail, ...DIRS.map((d) => ({ x: lead.x + d.dx, y: lead.y + d.dy }))]) {
      if (manhattan(t, lead) <= 2 && this._free(t.x, t.y)) {
        b.x = t.x; b.y = t.y; b.moveCD = 0.3; m.ai.stuck = 0; m.ai.state = 'FOLLOW'; m.ai.targetId = null;
        return;
      }
    }
  }
}
