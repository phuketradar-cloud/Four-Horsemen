import { DIRS, TUNING, LAYOUT } from '../data/config.js';
import { RANK_RULES } from '../data/statuses.js';
import { randInt, chance } from '../core/rng.js';
import { mech } from './HorsemanMechanics.js';

// Attacks, damage, projectiles, enemy strikes, guarding and encounter state.
const VW = LAYOUT.view.w, VH = LAYOUT.view.h;
// 'the Hollow Skeleton' but never 'the The Grave Warden'
const the = (e) => (/^The /.test(e.name) ? e.name : `the ${e.name}`);
const The = (e) => (/^The /.test(e.name) ? e.name : `The ${e.name}`);

export class CombatSystem {
  constructor(game) { this.game = game; this.reset(); }

  reset() {
    this.projectiles = [];
    this.seq = 0;
    this.active = false;
    this.engaged = null;
    this.sideThreats = [];
    this.autoFaceT = 0;
    this.lastMissMsg = -10;
    this.lastAttackAt = -10;
    // Phase 6: feedback counters (tests verify one hit reaction per damage application)
    this.feedback = { hits: 0, applied: 0, miss: 0, resisted: 0, weak: 0, playerHurt: 0 };
  }

  // ------------------------------------------------------------ helpers
  _cellAhead(n = 1, side = 0) {
    const p = this.game.player, d = DIRS[p.dir];
    const r = { dx: -d.dy, dy: d.dx };
    return { x: p.x + d.dx * n + r.dx * side, y: p.y + d.dy * n + r.dy * side };
  }

  // Which side of the player a source is on, relative to facing: front | left | right | behind.
  sideOf(src) {
    const p = this.game.player, d = DIRS[p.dir];
    if (!src || src.x == null) return 'front';
    const dx = src.x - p.x, dy = src.y - p.y;
    const fwd = dx * d.dx + dy * d.dy, right = dx * -d.dy + dy * d.dx;
    if (fwd > 0 && Math.abs(fwd) >= Math.abs(right)) return 'front';
    if (fwd < 0 && Math.abs(fwd) >= Math.abs(right)) return 'behind';
    return right > 0 ? 'right' : 'left';
  }

  screenPoint(e) {
    if (e && e.screen) return { x: e.screen.x + e.screen.w / 2, y: e.screen.y + Math.min(30, e.screen.h * 0.25) };
    return { x: VW / 2, y: VH / 2 - 20 };
  }
  _screenPoint(e) { return this.screenPoint(e); }

  // Shared final damage step for basic attacks AND skills (formulas: data/formulas.js):
  //   raw x class mechanic x enemy vulnerability x player buffs x (1 + skill power% for skills/DoTs)
  //   x class-synergy gear bonuses x legendary conditionals, then crit, then - (enemy DEF - armor pen),
  //   then the boss per-hit cap.
  finalizeDamage(e, raw, ctx) {
    const g = this.game;
    const m = mech(g);
    const s = g.hero.stats || {};
    let dmg = raw * (m.outgoingMult ? m.outgoingMult(g, e, ctx) : 1) * g.status.dmgTakenMult(e) * g.status.playerMult('dmgMult');
    if (ctx.source === 'skill' || ctx.source === 'counter') dmg *= 1 + (s.skillPower || 0) / 100;
    if (ctx.source === 'skill' && ['arc', 'encounter'].includes(ctx.skill?.target)) dmg *= 1 + (s.areaDmg || 0) / 100;
    const marked = g.status.has(e, 'mark');
    if (marked) dmg *= 1 + (s.markedDmg || 0) / 100;
    if (g.status.has(e, 'grave_mark')) dmg *= 1 + (s.curseDmg || 0) / 100;
    if (e.hp / e.maxHp < 0.35) dmg *= 1 + (s.executeDmg || 0) / 100;
    if (e.rank === 'elite' || e.rank === 'boss') dmg *= 1 + (s.bossDmg || 0) / 100;
    dmg *= g.legend.damageMult(e, ctx);
    const rm = this.resistMult(e, ctx); // Phase 5 bestiary resistances / weaknesses per damage source
    ctx.resistMult = rm;                // Phase 6: shown to the player (RESISTED / WEAK)
    dmg *= rm;
    const critChance = Math.min(0.75, (ctx.critChance ?? g.hero.critChance) + (m.critBonus ? m.critBonus(g, e) : 0) + (marked ? (s.markedCrit || 0) / 100 : 0));
    const crit = chance(critChance);
    if (crit) dmg *= (ctx.critMult ?? 1.5) + (s.critDmg || 0) / 100;
    if (!ctx.ignoreDef) dmg -= Math.max(0, e.def.def + (e.defBonus || 0) + g.status.enemyDefAdd(e) - (s.armorPen || 0));
    dmg = Math.max(1, Math.round(dmg));
    const cap = (RANK_RULES[e.rank] || RANK_RULES.normal).maxHitFrac;
    if (cap < 1) dmg = Math.min(dmg, Math.ceil(e.maxHp * cap));
    return { dmg, crit };
  }

  // Enemy resistances by damage source: e.resist = { basic, skill, dot } as fractions
  // (+0.3 = takes 30% less, -0.2 = takes 20% more). Clamped so nothing is ever immune to everything.
  resistMult(e, ctx) {
    const r = e.resist;
    if (!r) return 1;
    const src = ctx.source === 'dot' ? 'dot' : ctx.source === 'skill' || ctx.source === 'counter' ? 'skill' : 'basic';
    return 1 - Math.max(-0.5, Math.min(0.6, r[src] || 0));
  }

  // Hit chance for basic attacks: accuracy - enemy evasion, clamped 60-100% (skills always hit).
  hitChance(e) {
    const acc = this.game.hero.stats?.accuracy ?? 95;
    return Math.max(60, Math.min(100, acc - (e.def.evasion || 0) - (e.evasionBonus || 0))) / 100;
  }

  // Basic weapon hit: weapon roll + 40% ATK (+ DEX for ranged, + STR for two-handed melee),
  // weapon crit stacks with character crit.
  basicDamage(e, w) {
    const g = this.game, s = g.hero.stats || {};
    const ctx = { source: 'basic', critChance: w.crit + g.hero.critChance, critMult: w.critMult };
    if (!chance(this.hitChance(e))) return { miss: true, dmg: 0, crit: false, ctx };
    const kind = w.kind || w.def?.kind;
    const extra = kind === 'ranged' ? s.rangedBonus || 0 : (w.def?.twoHanded || w.twoHanded) ? s.heavyBonus || 0 : 0;
    let raw = randInt(w.min ?? w.dmgMin, w.max ?? w.dmgMax) + g.hero.atk * 0.4 + extra + (s.fireDmg || 0); // fire: only fire items carry it
    if (kind === 'ranged') raw *= 1 + (s.rangedDmg || 0) / 100;
    const r = this.finalizeDamage(e, raw, ctx);
    return { ...r, ctx };
  }

  _miss(e) {
    const g = this.game, sp = this.screenPoint(e);
    g.effects.text(sp.x, sp.y, 'MISS', '#a8a8a8', 1, 0.7);
    g.log(`You miss ${the(e)}.`, '#8c8467');
    g.audio.play('miss');
    this.feedback.miss++;
  }

  // ------------------------------------------------------------ player actions
  // Returns true when a swing actually started (used by the hold-to-attack repeat).
  playerAttack() {
    const g = this.game;
    if (!this.canPlayerAct()) return false;
    const ws = g.weapons;
    if (!ws.canAttack()) {
      if (ws.anim) return false;
      if (ws.current.def.kind === 'ranged' && g.time - this.lastMissMsg > 1) { g.log('Reloading the crossbow...', '#a89a70'); this.lastMissMsg = g.time; }
      return false;
    }
    const w = ws.current;
    const attack = { id: ++this.seq, weapon: w, hit: new Set() };
    ws.begin(attack, (a) => this._impact(a));
    this.lastAttackAt = g.time;
    g.audio.play(w.def.sfx);
    return true;
  }

  // Dead, guarding or stunned (any player status flagged `stun`) Horsemen cannot swing.
  canPlayerAct() {
    const g = this.game;
    return g.hero.alive && !g.player.guarding && !g.status.list('player').some((s) => s.def?.stun);
  }

  _impact(attack) {
    const g = this.game;
    const w = attack.weapon;
    if (w.def.kind === 'ranged') {
      this._spawnProjectile('bolt', w.def.range, w.def.projectileSpeed, { min: w.dmgMin, max: w.dmgMax, crit: w.crit, critMult: w.critMult, kind: 'ranged' }, attack);
      this.projectiles[this.projectiles.length - 1].pierce = g.legend.pierce(); // Sunlance
      return;
    }
    const cells = [this._cellAhead(1, 0)];
    if (w.def.cleave) cells.push(this._cellAhead(1, -1), this._cellAhead(1, 1));
    // reach weapons (spear): the first foe up to `reach` tiles ahead, never through walls
    if (w.def.reach > 1 && !g.ai.enemyAt(cells[0].x, cells[0].y) && g.dungeon.isWalkable(cells[0].x, cells[0].y)) cells.push(this._cellAhead(2, 0));
    let hits = 0;
    for (const c of cells) {
      const e = g.ai.enemyAt(c.x, c.y);
      if (!e || attack.hit.has(e.id)) continue;
      // diagonal cleave targets must not be behind a wall corner
      if ((c.x !== cells[0].x || c.y !== cells[0].y) && !g.dungeon.isWalkable(c.x, c.y)) continue;
      attack.hit.add(e.id); // one damage application per enemy per swing
      const r = this.basicDamage(e, w);
      hits++;
      if (r.miss) { this._miss(e); continue; }
      this.damageEnemy(e, r.dmg, r.crit, { stagger: !!w.def.stagger, ctx: r.ctx });
    }
    if (!hits && g.time - this.lastMissMsg > 1.2) { g.log('You strike at empty air.', '#8c8467'); this.lastMissMsg = g.time; }
    if (hits && w.def.anim === 'heavy') g.effects.addShake(5);
  }

  _spawnProjectile(kind, range, speed, dmg, attack) {
    const p = this.game.player, d = DIRS[p.dir];
    this.projectiles.push({ kind, ox: p.x, oy: p.y, x: p.x, y: p.y, dx: d.dx, dy: d.dy, dist: 0, checked: 0, range, speed, dmg, attack });
  }

  _updateProjectiles(dt) {
    const g = this.game;
    const tryHit = (pr, cx, cy) => {
      const e = g.ai.enemyAt(cx, cy);
      if (!e || pr.attack.hit.has(e.id)) return false;
      pr.attack.hit.add(e.id); // a projectile damages a target once
      const r = this.basicDamage(e, pr.dmg);
      if (r.miss) this._miss(e);
      else this.damageEnemy(e, r.dmg, r.crit, { ctx: r.ctx });
      if (pr.pierce > 0) { pr.pierce--; return true; } // Sunlance: keep flying to the next foe
      pr.dead = true;
      return true;
    };
    for (const pr of this.projectiles) {
      pr.dist += pr.speed * dt;
      pr.x = pr.ox + pr.dx * pr.dist; pr.y = pr.oy + pr.dy * pr.dist;
      // check every cell the projectile has entered since last frame
      while (!pr.dead && pr.checked < Math.floor(pr.dist + 0.5)) {
        pr.checked++;
        const cx = pr.ox + pr.dx * pr.checked, cy = pr.oy + pr.dy * pr.checked;
        if (pr.checked > pr.range) { pr.dead = true; break; }
        if (g.dungeon.blocksSight(cx, cy) || g.dungeon.chestAt(cx, cy)) {
          pr.dead = true;
          if (!g.director?.onProjectileHitWall(cx, cy)) g.audio.play('bump'); // distant sigils (Conquest's precision)
          break;
        }
        tryHit(pr, cx, cy);
      }
      // an enemy that steps into (or swaps through) the bolt's cell is hit too — no tunnelling
      for (let c = pr.checked; !pr.dead && c >= Math.max(1, pr.checked - 1); c--) tryHit(pr, pr.ox + pr.dx * c, pr.oy + pr.dy * c);
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  damageEnemy(e, amount, crit, opts = {}) {
    const g = this.game;
    if (!e.alive) return;
    if (e.invulnerable) { // boss phase transition: clearly signalled, short
      const sp = this._screenPoint(e);
      g.effects.text(sp.x, sp.y, 'IMMUNE', '#a8d8f0', 1, 0.6);
      return;
    }
    e.hp -= amount;
    this.feedback.applied++;
    if (e.boss && g.bossCtl) g.bossCtl.onDamaged(e, amount, opts);
    e.flash = 0.14; e.recoil = opts.dot ? 0 : crit ? 0.22 : 0.14; // sprite tint + small screen-space recoil (renderer)
    const sp = this._screenPoint(e);
    const color = crit ? '#ffd040' : opts.color || '#ffffff';
    g.effects.text(sp.x + (opts.dot ? 14 : 0), sp.y, crit ? `${amount}!` : `${amount}`, color, crit ? 3 : opts.dot ? 1 : 2);
    const debris = e.type === 'skeleton' ? ['#efe6cc', '#cfc39d', '#958865'] : ['#8a1010', '#c02018', '#5a0808', '#a0a8b0'];
    if (!opts.dot) { g.effects.burst(sp.x, sp.y + 20, debris, crit ? 22 : 12, { speed: crit ? 110 : 70 }); this.feedback.hits++; }
    if (!opts.dot) g.audio.play(crit ? 'crit' : 'hit');
    // Horseman audio identity on a CONNECTING basic hit (never on a miss)
    if (opts.ctx?.source === 'basic') g.audio.play({ conquest: 'hitConquest', war: 'hitWar', famine: 'hitFamine', death: 'hitDeath' }[g.hero.classId]);
    const rm = opts.ctx?.resistMult ?? 1;
    if (!opts.dot && rm < 0.95) { g.effects.text(sp.x, sp.y - 14, 'RESISTED', '#a0a8b8', 1, 0.7); g.audio.play('resist'); this.feedback.resisted++; }
    else if (!opts.dot && rm > 1.05) { g.effects.text(sp.x, sp.y - 14, 'WEAK!', '#ffb040', 1, 0.7); g.audio.play('weak'); this.feedback.weak++; }
    if (crit) g.effects.addShake(4);
    const what = opts.dot ? 'Plague gnaws at' : opts.ctx?.source === 'skill' ? `${opts.ctx.skill.name} hits` : opts.ctx?.source === 'counter' ? 'Your counter hits' : 'You hit';
    if (opts.ctx?.empowered) g.effects.text(sp.x, sp.y - 14, 'EMPOWERED', '#fff0b0', 1, 0.8);
    if (opts.executed) g.effects.text(sp.x, sp.y - 14, 'EXECUTE', '#c0e8ff', 1, 0.8);
    g.log(`${crit ? 'CRITICAL! ' : ''}${what} ${the(e)} for ${amount}.`, crit ? '#ffd040' : opts.dot ? '#80b050' : '#e8dcc0');
    const m = mech(g);
    if (opts.ctx && m.onHit) m.onHit(g, e, opts.ctx, amount); // class mechanic sees the hit before death cleanup
    if (opts.ctx?.source === 'basic') g.legend.onBasicHit(e, opts.ctx, amount); // item effects (ICD-limited)
    else if (opts.ctx?.source === 'skill' && e.alive) g.legend.onSkillHit(e, opts.ctx, amount);
    if (e.hp <= 0) { if (e.alive) this._kill(e); return; }
    if (e.boss && g.bossCtl) g.bossCtl.checkPhase(e);
    if (!opts.dot && !e.boss) g.ai.onHit(e, opts);
  }

  _kill(e) {
    const g = this.game;
    e.hp = 0; e.alive = false; e.dying = true; e.deathT = 0;
    e.state = 'death'; e.phase = null;
    g.audio.play(e.def.deathSfx);
    const sp = this._screenPoint(e);
    g.effects.burst(sp.x, sp.y + 30, e.type === 'skeleton' ? ['#efe6cc', '#958865', '#5a5038'] : ['#5a0808', '#a0a8b0', '#30343a'], 34, { speed: 120, life: 0.9 });
    // reward event id: rewards are granted once per enemy, even if death is reported twice
    const first = g.director ? g.director.claimKill(e) : true;
    const xp = first ? g.xpFor(e) : 0; // level-difference scaling (anti-farming), always explained
    const why = e.summoned ? ' (summoned: no reward)' : xp < e.xp ? ` (reduced to ${Math.round((xp / Math.max(1, e.xp)) * 100)}%: foe ${g.hero.level - e.level} levels below you)` : '';
    g.log(`${The(e)} is destroyed! +${xp} XP${why}`, '#ffb060');
    const m = mech(g);
    if (m.onKill) m.onKill(g, e); // passives read statuses before they are cleared
    g.legend.onKill(e, new Map(e.statuses));
    const lok = g.hero.stats?.lifeOnKill || 0; // HP on kill: capped at 5% max HP, at most every 0.5s
    if (lok > 0 && first && g.time - (this.lastLifeOnKill ?? -9) >= 0.5) { this.lastLifeOnKill = g.time; g.hero.heal(Math.min(lok, g.hero.maxHp * 0.05)); }
    g.status.clear(e);
    if (g.target === e) g.target = null;
    g.stats.kills++;
    g.stats.xpGained += xp;
    g.hero.gainXp(xp);
    if (!first) e.lootRolled = true; // a repeated death report can never roll loot later either
    const loot = first ? g.loot.rollEnemy(e) : { items: [], gold: 0 }; // rolled once per defeat
    if (first && e.bonusLoot) loot.items.push(...g.loot.rollTable(e.bonusLoot, e.level || 1).items); // variant bonus table (same event)
    if (loot.gold) { g.gold += loot.gold; g.stats.goldEarned = (g.stats.goldEarned || 0) + loot.gold; }
    if (e.boss && g.director) g.director.onBossDefeated(e, loot); // rewards go straight to the bag + summary
    else if (loot.items.length) {
      g.loot.drop(e.x, e.y, loot.items, g.realTime);
      g.audio.play('pickup');
      g.log(`It dropped ${loot.items.map((d) => d.name + (d.qty > 1 ? ' x' + d.qty : '')).join(', ')}${loot.gold ? ` and ${loot.gold} gold` : ''}.`, '#c8b070');
    } else if (loot.gold) g.log(`+${loot.gold} gold.`, '#e0c060');
    g.bus.emit('enemyKilled', e);
  }

  // Called by EnemyAI when a wind-up completes.
  enemyStrike(e) {
    const g = this.game;
    const p = g.player;
    if (!g.hero.alive) return;
    if (e.illusion) { g.log("The illusion's blade passes through you like smoke.", '#c8c0f0'); return; }
    if (Math.abs(p.x - e.x) + Math.abs(p.y - e.y) !== 1) {
      g.log(`You evade ${the(e)}'s attack!`, '#9ad0ff');
      g.audio.play('enemySwipe');
      return;
    }
    g.audio.play(e.def.attackSfx);
    const facing = this._cellAhead(1, 0);
    const fromFront = facing.x === e.x && facing.y === e.y;
    // Death's Wraith Step: evade the blow and counterattack
    const wraith = g.status.get('player', 'wraith');
    if (wraith && fromFront) {
      g.status.remove('player', 'wraith');
      g.audio.play('wraith');
      g.effects.text(VW / 2, VH / 2 - 30, 'EVADED!', '#c0e8ff', 2);
      g.log(`You slip through ${the(e)}'s blow like a wraith.`, '#c0e8ff');
      const pw = wraith.data;
      if (pw) {
        const ctx = { source: 'counter' };
        const r = this.finalizeDamage(e, randInt(pw.dmg[0], pw.dmg[1]) + g.hero.atk * pw.scale, ctx);
        this.damageEnemy(e, r.dmg, r.crit, { ctx, color: '#c0e8ff' });
        g.fx.play('soulRend', [e], {});
      }
      return;
    }
    const s = g.hero.stats || {};
    // Evasion (gear only): the blow misses entirely
    if (s.evasion > 0 && chance(s.evasion / 100)) {
      g.effects.text(VW / 2, VH / 2 - 30, 'DODGE', '#9ad0ff', 2);
      g.log(`You dodge ${the(e)}'s blow.`, '#9ad0ff');
      g.audio.play('enemySwipe');
      return;
    }
    // enemy debuffs (Withering, Decree, Starved) and player buffs (Blood Rush) scale the blow;
    // the physical share is reduced by DEF, the dark share (knights) by Resistance, all by DR%.
    const raw = randInt(e.def.atk[0], e.def.atk[1]) * e.atkMult * (e.strikeMult || 1) * g.status.enemyAtkMult(e) * g.status.playerMult('dmgTakenMult');
    const dark = raw * (e.darkFrac || 0);
    let dmg = (raw - dark - g.hero.defense * g.status.playerMult('defMult')) + dark * (1 - (s.resist || 0) / 100);
    dmg *= 1 - (s.damageReduction || 0) / 100;
    if (p.guarding && fromFront) {
      if (g.time - p.guardStart <= TUNING.perfectGuardWindow) {
        g.audio.play('parry');
        g.effects.text(VW / 2, VH / 2 - 30, 'PARRY!', '#9ad0ff', 3);
        g.effects.burst(VW / 2, VH / 2, ['#ffffff', '#9ad0ff'], 20, { speed: 140 });
        g.ai.stagger(e, e.def.heavy ? 1.4 : 0.9);
        g.log(`Perfect parry! ${The(e)} staggers.`, '#9ad0ff');
        if (e.boss && g.bossCtl) g.bossCtl.onParried(e);
        return;
      }
      dmg *= TUNING.guardReduction;
      g.audio.play('block');
      g.effects.text(VW / 2, VH / 2 - 30, 'BLOCK', '#9ad0ff', 2);
    }
    const dealt = g.hero.takeDamage(Math.max(1, dmg));
    g.stats.damageTaken += dealt;
    const m = mech(g);
    if (m.onDamaged && g.hero.alive) m.onDamaged(g, dealt);
    if (g.hero.alive) g.legend.onDamaged(e, dealt);
    // Knights' unblocked blows may Sunder (-30% DEF); Status Resist shortens it
    const sun = e.def.sunder;
    if (sun && !(p.guarding && fromFront) && g.hero.alive && chance(sun.chance)) {
      const dur = sun.dur * (1 - (s.statusResist || 0) / 100);
      g.status.apply('player', 'sundered', { dur });
      g.log(`Your armour is sundered for ${dur.toFixed(1)}s!`, '#ff9a60');
    }
    // Phase 4: themed on-hit effects (Blight, Curses), champion lifesteal, boss attack riders
    const unblocked = !(p.guarding && fromFront) && g.hero.alive;
    for (const inf of [e.def.inflict, e.champ?.inflict, e.curInflict]) {
      if (inf && unblocked && chance(inf.chance)) g.applyPlayerDebuff(inf.status, inf.dur);
    }
    if (e.champ?.lifesteal && dealt > 0) e.hp = Math.min(e.maxHp, e.hp + Math.round(dealt * e.champ.lifesteal));
    g.audio.play('hurt');
    g.effects.screenFlash('#c00000', 0.3);
    g.effects.addShake(e.def.heavy ? 8 : 4);
    g.effects.text(VW / 2 - 90, VH - 70, `-${dealt}`, e.def.heavy ? '#ff2010' : '#ff4030', e.def.heavy ? 3 : 2);
    g.effects.damageFrom(this.sideOf(e));
    g.hurtFlash = 0.35; this.feedback.playerHurt++;
    g.log(`${The(e)} hits you for ${dealt}${p.guarding && fromFront ? ' (blocked)' : ''}.`, '#ff7a60');
    if (!g.hero.alive) g.onPlayerDeath(e);
  }

  // ------------------------------------------------------------ encounter state
  update(dt) {
    const g = this.game;
    this._updateProjectiles(dt);
    const p = g.player;
    const front = this._cellAhead(1, 0);
    const aware = (e) => ['detect', 'chase', 'attack', 'hurt'].includes(e.state);
    let engaged = g.enemies.find((e) => (e.alive || e.dying) && e.x === front.x && e.y === front.y && (e.dying || aware(e))) || null;
    if (engaged && engaged.dying && this.engaged !== engaged) engaged = null;
    const adjacent = g.enemies.filter((e) => e.alive && aware(e) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1);
    this.sideThreats = [];
    for (const e of adjacent) {
      if (e === engaged) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = DIRS[p.dir];
      const fwd = dx * d.dx + dy * d.dy, right = dx * -d.dy + dy * d.dx;
      this.sideThreats.push(fwd < 0 ? 'behind' : right > 0 ? 'right' : 'left');
    }
    const wasActive = this.active;
    this.engaged = engaged;
    this.active = !!engaged;
    if (this.active && !wasActive && engaged.alive) {
      g.effects.showBanner('ENCOUNTER!', '#ff5030', 1.1);
      g.log(`${engaged.name} engages you in battle!`, '#ff6040');
    }
    if (!this.active && wasActive && adjacent.length === 0) g.log('The clash falls silent.', '#8c8467');

    // Auto-face the nearest attacker if nothing is in front (classic encounter behaviour).
    if (!engaged && adjacent.length) {
      this.autoFaceT += dt;
      if (this.autoFaceT > TUNING.autoFaceDelay && g.time - p.lastTurnAt > TUNING.autoFaceDelay) {
        const e = adjacent[0];
        const dir = DIRS.findIndex((d) => d.dx === e.x - p.x && d.dy === e.y - p.y);
        if (dir >= 0) { p.dir = dir; g.dungeon.reveal(p.x, p.y, p.dir); }
        this.autoFaceT = 0;
      }
    } else this.autoFaceT = 0;
  }
}
