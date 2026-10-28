import { ENEMIES, ENEMY_VARIANTS } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { DIFFICULTIES, CHAMPION_MODS, ENEMY_SCALING } from '../data/difficulty.js';
import { DIRS } from '../data/config.js';
import { randRange } from '../core/rng.js';

// Grid-based enemy state machine:
//   idle -> patrol -> detect -> chase -> attack(ready/windup/strike/recover) ; hurt ; death
// Enemies only strike when orthogonally adjacent, never through walls, and stop all logic once dead.
export class EnemyAI {
  constructor(game) { this.game = game; }

  // Always rebuilds the list in place: restarting can never duplicate enemies.
  spawnAll(spawns) {
    const list = this.game.enemies;
    list.length = 0;
    spawns.forEach((s, i) => list.push(this.create(s, i)));
  }

  // Phase 4: spawns may carry a level (scaled by ENEMY_SCALING), a per-dungeon loot table, a
  // champion modifier (difficulty), a boss id (BossEncounterController drives it) or `summoned`.
  // Crypt spawns carry none of these, so Phase 1-3 enemies are exactly unchanged.
  create(spawn, id) {
    const variant = spawn.variant ? ENEMY_VARIANTS[spawn.variant] : null;
    const def = spawn.boss ? BOSSES[spawn.boss] : ENEMIES[variant ? variant.base : spawn.type];
    const baseLevel = (def.level || 1) + (variant?.levelAdd || 0);
    // Phase 5 variant modifiers are only applied where their level rule allows (never on bosses)
    const champRaw = spawn.champion ? CHAMPION_MODS[spawn.champion] : null;
    const champ = champRaw && !spawn.boss && (spawn.level ?? baseLevel) >= (champRaw.minLevel || 0) ? champRaw : null;
    const level = (spawn.level ?? baseLevel) + (champ?.levelAdd || 0);
    const dl = level - baseLevel;
    const S = ENEMY_SCALING;
    const diff = spawn.level !== undefined ? DIFFICULTIES[this.game.run?.difficulty] || DIFFICULTIES.normal : DIFFICULTIES.normal;
    const hp = Math.round(def.hp * (variant?.hpMult || 1) * (1 + S.hpPerLevel * dl) * diff.hpMult * (champ ? 1.5 * (champ.hpMult || 1) : 1));
    const merge = (a, b) => (a || b ? { ...(a || {}), ...(b || {}) } : null);
    return {
      resist: merge(def.resist, champ?.resist), statusRules: merge(def.statusRules, champ?.statusRules), evasionBonus: champ?.evasionAdd || 0,
      bonusLoot: spawn.summoned ? null : champ?.bonusLoot || null, miniboss: !!(spawn.boss && def.miniboss), illusion: !!def.illusion,
      abilityCd: {}, ability: null,
      id, sid: spawn.sid || null, type: def.id, variant: spawn.variant || null, def,
      spriteKey: spawn.variant || def.sprite,
      name: champ ? `${champ.name} ${def.name}` : variant ? variant.name : def.name,
      rank: variant?.rank || def.rank || 'normal',
      level,
      darkFrac: Math.min(0.9, (variant?.darkFrac ?? def.darkFrac ?? 0) + (champ?.darkAdd || 0)),
      lootTable: spawn.summoned ? null : spawn.loot || variant?.lootTable || def.lootTable,
      lootRolled: false,
      boss: !!spawn.boss, summoned: !!spawn.summoned, champion: spawn.champion || null, champ,
      guardsSecret: spawn.guardsSecret || null, guardian: !!spawn.guardian,
      defBonus: Math.round((S.defPerLevel * dl + (champ?.defAdd || 0)) * 10) / 10,
      moveMult: champ?.speed || 1, windupMult: champ?.windupMult || 1, strikeMult: 1,
      statuses: new Map(), stunImmuneUntil: 0, soulsClaimed: false, plagueClaimed: false,
      x: spawn.x, y: spawn.y, rx: spawn.x, ry: spawn.y, home: { x: spawn.x, y: spawn.y },
      hp, maxHp: hp, atkMult: (variant?.atkMult || 1) * (1 + S.atkPerLevel * dl) * diff.dmgMult * (champ ? 1.15 * (champ.dmgMult || 1) : 1),
      xp: spawn.summoned || def.illusion ? 0 : Math.round(def.xp * (variant?.xpMult || 1) * (1 + S.xpPerLevel * dl) * diff.xpMult * (champ ? 1.6 * (champ.xpMult || 1) : 1)),
      room: spawn.room || this.game.dungeon.roomAt(spawn.x, spawn.y).id,
      state: 'idle', stateT: 0, wait: randRange(0.8, 2.5), moveT: 0, lostT: 0, stun: 0,
      phase: null, phaseT: 0, flash: 0, moveAnim: 0, patrolSteps: 0,
      alive: true, dying: false, deathT: 0, screen: null,
    };
  }

  // Add one enemy mid-fight (boss summons). Ids >= 1000 are never saved.
  spawnExtra(spawn) {
    const id = 1000 + (this.extraSeq = (this.extraSeq || 0) + 1);
    const e = this.create({ ...spawn, summoned: true }, id);
    this.game.enemies.push(e);
    return e;
  }

  enemyAt(x, y) { return this.game.enemies.find((e) => e.alive && e.x === x && e.y === y) || null; }

  _occupied(x, y, self) {
    const p = this.game.player;
    if (p.x === x && p.y === y) return true;
    if (this.game.party?.occupied(x, y)) return true; // companions' bodies
    return this.game.enemies.some((e) => e !== self && e.alive && e.x === x && e.y === y);
  }

  // Party play: which Horseman this foe fights. It keeps an adjacent current foe, else takes any
  // adjacent Horseman, else the nearest one it can see. Solo play: always the player.
  _pickTarget(e) {
    const g = this.game, party = g.party;
    if (!party?.enabled) return { member: null, body: g.player };
    const list = party.livingBodies();
    const d = (t) => Math.abs(t.body.x - e.x) + Math.abs(t.body.y - e.y);
    const cur = list.find((t) => t.member === e.aggro) || null;
    if (cur && d(cur) === 1) return cur;
    const adj = list.find((t) => d(t) === 1);
    if (adj) return adj;
    const seen = list.filter((t) => d(t) <= e.def.detectRange && g.dungeon.hasLOS(e.x, e.y, t.body.x, t.body.y));
    if (cur && seen.includes(cur)) return cur;
    if (seen.length) return seen.sort((a, b) => d(a) - d(b))[0];
    return cur || list[0];
  }

  _set(e, state) {
    if (e.state === state) return;
    e.state = state; e.stateT = 0;
    if (state === 'attack') { e.phase = 'ready'; e.phaseT = 0; }
    else e.phase = null;
    if (state === 'detect') this.game.audio.play('alert');
  }

  _adjacent(e) {
    const p = this.game.player;
    return Math.abs(p.x - e.x) + Math.abs(p.y - e.y) === 1;
  }

  _sees(e) {
    const p = this.game.player;
    const dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    if (dist > e.def.detectRange) return false;
    return this.game.dungeon.hasLOS(e.x, e.y, p.x, p.y);
  }

  _moveTo(e, nx, ny) {
    if (this._occupied(nx, ny, e) || !this.game.dungeon.isWalkable(nx, ny)) return false;
    e.x = nx; e.y = ny; e.moveAnim = 0.35;
    return true;
  }

  get awake() { return this.game.enemies.some((e) => e.alive && ['detect', 'chase', 'attack', 'hurt'].includes(e.state)); }

  onHit(e, { stagger = false } = {}) {
    if (!e.alive) return;
    e.lostT = 0;
    const interrupt = stagger || e.def.interruptible;
    if (e.state === 'attack' && e.phase === 'windup' && !interrupt) return; // knights shrug off light hits mid-swing
    if (e.state === 'attack' && e.phase === 'strike') return;
    // party play: four attackers must not hit-stun a foe forever - after a flinch it keeps its
    // footing for a moment (real staggers from skills / parries still land)
    const g = this.game;
    if (g.party?.enabled && !stagger) {
      if (g.time - (e.flinchAt ?? -99) < 1.2) return;
      e.flinchAt = g.time;
    }
    e.stun = stagger ? 0.9 : e.def.hurtStun;
    this._set(e, 'hurt');
    e.stateT = 0;
  }

  // Phase 6 animation/state watchdog: no enemy can stay stuck in a wind-up, strike, cast or hurt state
  // (e.g. after a save/load or an interrupted ability). Normal timings are far below these limits.
  _watchdog(e) {
    const g = this.game;
    let fixed = null;
    if (e.ability && e.ability.t > e.ability.windup + 3) { g.abilities?.interrupt(e); fixed = 'ability'; }
    else if (!e.boss && e.state === 'attack' && !e.ability && e.phaseT > Math.max(4, (e.def.windup || 1) + (e.def.recover || 1) + 2)) { e.state = 'chase'; e.phase = null; e.phaseT = 0; fixed = 'attack'; }
    else if (e.state === 'hurt' && e.stateT > Math.min(e.stun || 0.5, 5) + 2.5) { e.state = 'chase'; e.stateT = 0; fixed = 'hurt'; } // no legal stun exceeds 5s
    else if (e.boss && e.bossState?.attack && e.bossState.attack.t > (e.bossState.attack.windup || 1) + 8) { g.bossCtl.cancelAttack(e); fixed = 'boss-attack'; }
    if (fixed) {
      this.watchdogFixes = (this.watchdogFixes || 0) + 1;
      if (!this._warned?.has(fixed)) { (this._warned ||= new Set()).add(fixed); console.warn(`[EnemyAI] recovered a stuck '${fixed}' state on ${e.name}`); }
    }
  }

  stagger(e, dur) {
    if (!e.alive) return;
    if (dur >= 0.8) { // visible + audible stagger (parries, heavy blows); never on illusions
      const g = this.game, sp = g.combat.screenPoint(e);
      g.effects.text(sp.x, sp.y - 26, 'STAGGERED', '#ffd080', 1, 0.8);
      g.audio.play('stagger');
    }
    if (e.ability) this.game.abilities?.interrupt(e); // a stagger breaks any cast
    e.stun = dur;
    e.state = 'hurt'; e.stateT = 0; e.phase = null;
  }

  update(dt) {
    const game = this.game;
    const dm = game.dungeon;
    for (const e of game.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      e.moveAnim = Math.max(0, e.moveAnim - dt);
      // smooth render position toward grid cell
      const k = Math.min(1, dt * 9);
      e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k;
      if (e.dying) { e.deathT += dt; if (e.deathT > 0.8) e.dying = false; continue; }
      if (!e.alive) continue;
      e.stateT += dt;
      e.recoil = Math.max(0, (e.recoil || 0) - dt);
      this._watchdog(e);
      // bosses and Phase 5 ability users keep aiming at the controlled Horseman (their scripts use g.player)
      if (e.boss && game.bossCtl) { e.aggro = null; game.bossCtl.update(e, dt, this._sees(e), this._adjacent(e)); continue; } // bosses: BossEncounterController
      if ((e.def.abilities || e.def.ai === 'ranged') && game.abilities?.update(e, dt, this._sees(e), this._adjacent(e))) { e.aggro = null; continue; } // Phase 5 behaviours
      const tgt = this._pickTarget(e);
      e.aggro = tgt.member;
      const tb = tgt.body, tdist = Math.abs(tb.x - e.x) + Math.abs(tb.y - e.y);
      const sees = tdist <= e.def.detectRange && dm.hasLOS(e.x, e.y, tb.x, tb.y);
      const adj = tdist === 1;
      const wu = e.def.windup * (e.windupMult || 1);

      switch (e.state) {
        case 'idle':
          if (sees) this._set(e, 'detect');
          else if (e.stateT > e.wait) { this._set(e, 'patrol'); e.patrolSteps = 0; }
          break;
        case 'patrol': {
          if (sees) { this._set(e, 'detect'); break; }
          e.moveT += dt;
          if (e.moveT >= e.def.patrolInterval) {
            e.moveT = 0;
            const opts = DIRS.map((d) => ({ x: e.x + d.dx, y: e.y + d.dy }))
              .filter((c) => Math.abs(c.x - e.home.x) + Math.abs(c.y - e.home.y) <= 2 && dm.isWalkable(c.x, c.y) && !this._occupied(c.x, c.y, e));
            if (opts.length) { const c = opts[Math.floor(Math.random() * opts.length)]; this._moveTo(e, c.x, c.y); }
            if (++e.patrolSteps >= 3) { this._set(e, 'idle'); e.wait = randRange(1.5, 3.5); }
          }
          break;
        }
        case 'detect':
          if (e.stateT > 0.45) this._set(e, 'chase');
          break;
        case 'chase': {
          if (adj) { this._set(e, 'attack'); break; }
          if (!sees) { e.lostT += dt; if (e.lostT > e.def.loseTime) { this._set(e, 'patrol'); e.patrolSteps = 0; e.lostT = 0; break; } }
          else e.lostT = 0;
          e.moveT += dt;
          if (e.moveT >= e.def.moveInterval * (e.moveMult || 1) * game.status.moveMult(e)) { // Starved foes move slower
            e.moveT = 0;
            const step = dm.nextStep(e.x, e.y, tb.x, tb.y, (x, y) => this._occupied(x, y, e), 300);
            if (step && !(step.x === tb.x && step.y === tb.y)) this._moveTo(e, step.x, step.y);
          }
          break;
        }
        case 'attack': {
          e.phaseT += dt;
          if (e.phase === 'ready') {
            if (!adj) { this._set(e, 'chase'); break; }
            if (e.phaseT > 0.25) { e.phase = 'windup'; e.phaseT = 0; if (e.def.heavy) game.audio.play('windup'); }
          } else if (e.phase === 'windup') {
            if (e.phaseT >= wu) { e.phase = 'strike'; e.phaseT = 0; if (game.party?.enabled) game.party.enemyStrike(e); else game.combat.enemyStrike(e); }
          } else if (e.phase === 'strike') {
            if (e.phaseT > 0.25) { e.phase = 'recover'; e.phaseT = 0; }
          } else if (e.phase === 'recover') {
            if (e.phaseT >= e.def.recover) {
              if (adj) { e.phase = 'windup'; e.phaseT = 0; if (e.def.heavy) game.audio.play('windup'); }
              else this._set(e, 'chase');
            }
          }
          break;
        }
        case 'hurt':
          if (e.stateT >= e.stun) { e.moveT = e.def.moveInterval * 0.5; this._set(e, adj ? 'attack' : 'chase'); }
          break;
        default: break;
      }
    }
  }

  serialize() {
    return this.game.enemies.filter((e) => !e.summoned).map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, alive: e.alive, soulsClaimed: e.soulsClaimed, plagueClaimed: e.plagueClaimed, lootRolled: e.lootRolled }));
  }
  restore(list) {
    for (const s of list) {
      const e = this.game.enemies.find((q) => q.id === s.id);
      if (!e) continue;
      Object.assign(e, { x: s.x, y: s.y, rx: s.x, ry: s.y, hp: s.hp, alive: s.alive, dying: false, state: s.alive ? 'idle' : 'death', stateT: 0, soulsClaimed: !!s.soulsClaimed, plagueClaimed: !!s.plagueClaimed, lootRolled: s.lootRolled ?? !s.alive });
    }
  }
}
