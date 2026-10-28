import { SKILLS, SKILL_UNLOCK, ULTIMATE_UNLOCK, UPGRADE_LEVEL, ULT_UPGRADE_LEVEL } from '../data/skills.js';
import { HORSEMEN } from '../data/characters.js';
import { STATUSES } from '../data/statuses.js';
import { DIRS, LAYOUT } from '../data/config.js';
import { randInt } from '../core/rng.js';
import { CooldownManager } from './CooldownManager.js';
import { mech } from './HorsemanMechanics.js';

// SkillManager + SkillExecutionSystem. Every skill of every Horseman runs through use():
//  1 validate  2 cooldown  3 resource  4 target/range  5 spend  6 effects (damage/heal/buff)
//  7 statuses  8 start cooldown  9 animation + audio  10 log / HUD event
// Projectile travel and multi-hit volleys are scheduled as timed hits (validated again on landing).
export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.cooldowns = new CooldownManager(game);
    this.reset();
  }

  reset() {
    this.cooldowns.reset();
    this.pending = [];
    this.lastFail = null;     // { id, reason, t } — shown on the skill bar
    this.healLog = [];        // Famine drain budget window
    this.soulLock = new Map(); // enemy id -> time when Soul Rend may grant a soul again
  }

  // ------------------------------------------------------------------ queries
  get slots() { const d = HORSEMEN[this.game.hero.classId]; return [...d.skills, d.ultimate]; }
  unlockLevel(id) { const i = this.slots.indexOf(id); return i === 4 ? ULTIMATE_UNLOCK : SKILL_UNLOCK[i] ?? 99; }
  isUnlocked(id) { return this.game.hero.level >= this.unlockLevel(id); }
  upgradeLevel(id) { return SKILLS[id].ultimate ? ULT_UPGRADE_LEVEL : UPGRADE_LEVEL; }

  // Effective parameters after the chosen upgrade (or a preview choice).
  params(id, choice = this.game.hero.upgrades[id]) {
    const s = SKILLS[id];
    const mods = choice && s.upgrades[choice] ? s.upgrades[choice].mods : {};
    // Phase 5: unique items may modify a skill (e.g. The Unerring Arrow). Additive keys add,
    // *Mult keys multiply; the result goes through the same bounds as upgrades below.
    const im = this.game.legend?.skillMods?.(id) || {};
    const m = (k, d = 0) => { const a = mods[k] ?? d; const b = im[k]; return b === undefined ? a : k.endsWith('Mult') ? a * b : a + b; };
    const p = { ...s, flags: { ...(mods.flags || {}) } };
    // Resource Efficiency (WIS / gear) trims costs; anything that cost something still costs >= 1.
    const eff = (this.game.hero.stats?.resEff || 0) / 100;
    const rawCost = Math.max(0, s.cost + m('costAdd'));
    p.cost = rawCost > 0 ? Math.max(1, Math.round(rawCost * (1 - eff))) : 0;
    p.cooldown = Math.max(1, s.cooldown + m('cooldownAdd'));
    p.minResource = s.minResource ? s.minResource + m('minResourceAdd') : 0;
    p.maxTargets = (s.maxTargets || 1) + m('targetsAdd');
    p.effects = s.effects.map((e) => {
      const x = { ...e };
      if (x.dmg) x.dmg = x.dmg.map((v) => Math.max(1, Math.round(v * m('dmgMult', 1))));
      if (x.hits) x.hits = Math.max(1, x.hits + m('hitsAdd'));
      if (x.dur !== undefined) x.dur = Math.max(0.3, +(x.dur + m('durAdd')).toFixed(2));
      if (x.stacks) x.stacks += m('stacksAdd');
      if (x.healCap) x.healCap = Math.max(1, x.healCap + m('healCapAdd'));
      if (x.op === 'status' && x.power) { x.power *= m('statusPowerMult', 1); x.perStack = (x.perStack || 0) * m('statusPowerMult', 1); }
      if (x.op === 'buff' && x.power) x.power = { ...x.power, dmg: x.power.dmg.map((v) => Math.round(v * m('dmgMult', 1))) };
      if (x.execute) x.execute = { ...x.execute, threshold: x.execute.threshold + m('thresholdAdd'), bossThreshold: +(x.execute.bossThreshold + m('thresholdAdd') * 0.3).toFixed(3) };
      if (x.perResource) x.perResource += m('perResourceAdd');
      if (x.secondary) x.secondary = Math.min(1, x.secondary + m('secondaryAdd'));
      return x;
    });
    return p;
  }

  // Compact numbers for tooltips and upgrade previews.
  summary(p) {
    const out = [];
    const d = p.effects.find((e) => e.dmg || (e.power && e.power.dmg));
    if (d) {
      const dmg = d.dmg || d.power.dmg;
      out.push(['DMG', `${dmg[0]}-${dmg[1]}${d.hits > 1 ? ' X' + d.hits : ''}`]);
    }
    const st = p.effects.find((e) => e.dur !== undefined);
    if (st) out.push(['DUR', `${st.dur}S`]);
    const pw = p.effects.find((e) => e.op === 'status' && e.power);
    if (pw) out.push(['DPS', `${+pw.power.toFixed(1)}+${+pw.perStack.toFixed(1)}/STK`]);
    const sk = p.effects.find((e) => e.stacks);
    if (sk) out.push(['STACKS', sk.stacks]);
    const h = p.effects.find((e) => e.healCap);
    if (h) out.push(['HEAL CAP', h.healCap]);
    const ex = p.effects.find((e) => e.execute);
    if (ex) out.push(['EXECUTE', `<${Math.round(ex.execute.threshold * 100)}%`]);
    const sec = p.effects.find((e) => e.secondary);
    if (sec) out.push(['2ND', `${Math.round(sec.secondary * 100)}%`]);
    const pr = p.effects.find((e) => e.perResource);
    if (pr) out.push(['PER SOUL', `+${pr.perResource}`]);
    if (p.maxTargets > 1) out.push(['TARGETS', p.maxTargets]);
    out.push(['CD', `${p.cooldown}S`]);
    out.push(p.consumeAll ? ['NEEDS', p.minResource] : ['COST', p.cost]);
    return out;
  }

  // ------------------------------------------------------------------ targeting
  resolve(p) {
    const g = this.game, pl = g.player, d = DIRS[pl.dir];
    const dist = (e) => Math.abs(e.x - pl.x) + Math.abs(e.y - pl.y);
    const visible = (e) => e && e.alive && dist(e) <= p.range && g.dungeon.hasLOS(pl.x, pl.y, e.x, e.y);
    const front = g.ai.enemyAt(pl.x + d.dx, pl.y + d.dy);
    const lineFirst = () => {
      for (let i = 1; i <= p.range; i++) {
        const x = pl.x + d.dx * i, y = pl.y + d.dy * i;
        if (g.dungeon.blocksSight(x, y)) return null;
        const e = g.ai.enemyAt(x, y);
        if (e) return e;
      }
      return null;
    };
    switch (p.target) {
      case 'self': return [];
      case 'front': return front ? [front] : [];
      case 'line': {
        const out = [];
        for (let i = 1; i <= p.range; i++) {
          const x = pl.x + d.dx * i, y = pl.y + d.dy * i;
          if (g.dungeon.blocksSight(x, y)) break;
          const e = g.ai.enemyAt(x, y);
          if (e) out.push(e); // pierces: keeps going
        }
        return out;
      }
      case 'arc': {
        const r = { dx: -d.dy, dy: d.dx };
        const cells = [[d.dx, d.dy], [r.dx, r.dy], [-r.dx, -r.dy]];
        if (g.dungeon.isWalkable(pl.x + d.dx, pl.y + d.dy) || front) cells.push([d.dx + r.dx, d.dy + r.dy], [d.dx - r.dx, d.dy - r.dy]);
        const out = [];
        for (const [cx, cy] of cells) { const e = g.ai.enemyAt(pl.x + cx, pl.y + cy); if (e && !out.includes(e)) out.push(e); }
        return out;
      }
      case 'encounter':
        return g.enemies.filter(visible).sort((a, b) => dist(a) - dist(b));
      case 'focus': {
        const vis = g.enemies.filter(visible);
        const primary = (visible(g.target) && g.target)
          || vis.find((e) => g.status.has(e, 'mark') || g.status.has(e, 'grave_mark'))
          || (visible(front) && front) || (visible(lineFirst()) && lineFirst())
          || vis.sort((a, b) => dist(a) - dist(b))[0];
        if (!primary) return [];
        const extra = vis.filter((e) => e !== primary).sort((a, b) => dist(a) - dist(b)).slice(0, Math.max(0, p.maxTargets - 1));
        return [primary, ...extra];
      }
      default: return [];
    }
  }

  // ------------------------------------------------------------------ pipeline
  canUse(id) {
    const g = this.game;
    const s = SKILLS[id];
    const no = (reason) => ({ ok: false, reason });
    if (!s || s.cls !== g.hero.classId) return no('That is not your power.');
    if (!g.hero.alive) return no('The dead cannot act.');
    if (g.scene !== 'playing' || g.panel) return no('Cannot act now.');
    if (!this.isUnlocked(id)) return no(`${s.name} unlocks at level ${this.unlockLevel(id)}.`);
    const left = this.cooldowns.remaining(id);
    if (left > 0) return no(`${s.name} is recharging (${left.toFixed(1)}s).`);
    const p = this.params(id);
    const r = g.resource;
    if (p.consumeAll && r.value < p.minResource) return no(`${s.name} needs ${p.minResource} ${r.def.name} (${Math.floor(r.value)}).`);
    if (!p.consumeAll && r.value < p.cost) return no(`Not enough ${r.def.name}: ${s.name} costs ${p.cost}.`);
    let targets = this.resolve(p);
    if (p.target !== 'self' && !targets.length) return no(`${s.name}: no target in range (${p.range}).`);
    if (p.requiresStatus) {
      targets = targets.filter((e) => g.status.has(e, p.requiresStatus));
      if (!targets.length) return no(`${s.name}: target must be ${STATUSES[p.requiresStatus].name}.`);
    }
    return { ok: true, p, targets };
  }

  use(id) {
    const g = this.game;
    const c = this.canUse(id);                                    // 1-4 validate / cd / resource / target
    if (!c.ok) { this._fail(id, c.reason); return false; }
    const { p, targets } = c;
    const consumed = p.consumeAll ? g.resource.consumeAll() : (g.resource.spend(p.cost), p.cost); // 5 spend
    const cast = { skill: p, consumed, gained: 0, healed: 0 };
    const travel = p.effects.find((e) => e.travel)?.travel || 0;
    for (const eff of p.effects) this._exec(eff, p, targets, cast, travel); // 6-7
    this.cooldowns.start(id, p.cooldown * (1 - (g.hero.stats?.cdr || 0) / 100)); // 8 (CDR capped at 20%)
    g.legend.onSkillCast?.(id, p, targets);
    g.fx.play(p.fx, targets, p);                                   // 9
    g.audio.play(p.sfx);
    g.hero.flash('cast');
    if (p.ultimate) {
      g.effects.showBanner(p.name, p.color, 1.6);
      g.effects.screenFlash(p.color, 0.3);
    }
    const tgt = targets.length ? ` on ${targets.length > 1 ? targets.length + ' foes' : targets[0].name}` : '';
    g.log(`${p.name}${tgt}${p.consumeAll ? ` (spent ${Math.floor(consumed)} ${g.resource.def.name})` : ''}.`, p.color); // 10
    g.bus.emit('skillUsed', { id, targets });
    return true;
  }

  _fail(id, reason) {
    const g = this.game;
    const now = g.realTime;
    if (!this.lastFail || this.lastFail.reason !== reason || now - this.lastFail.t > 0.8) { g.log(reason, '#a89a70'); g.audio.play('deny'); }
    this.lastFail = { id, reason, t: now };
  }

  _schedule(delay, fn) { this.pending.push({ at: this.game.time + delay, fn }); }

  _dist(e) { const pl = this.game.player; return Math.abs(e.x - pl.x) + Math.abs(e.y - pl.y); }

  // Executes one effect op (timed ops land after projectile travel, in op order).
  _exec(eff, p, targets, cast, travel) {
    const g = this.game;
    const land = (e) => (travel ? this._dist(e) / travel : 0);
    switch (eff.op) {
      case 'damage':
      case 'drain':
        targets.forEach((e, ti) => {
          const hits = (eff.hits || 1) + Math.floor((eff.hitsPerResource || 0) * cast.consumed);
          for (let h = 0; h < hits; h++) this._schedule(land(e) + h * (eff.delayPerHit || 0), () => this._hit(e, eff, p, cast, ti));
        });
        break;
      case 'status':
        targets.forEach((e) => {
          this._schedule(land(e) + 0.001, () => {
            if (!e.alive) return;
            const durMult = STATUSES[eff.status].stun ? 1 : 1 + (g.hero.stats?.statusDur || 0) / 100; // never lengthens stuns
            const r = g.status.apply(e, eff.status, { dur: eff.dur * durMult, stacks: eff.stacks || 1, power: eff.power || 0, perStack: eff.perStack || 0 });
            const def = STATUSES[eff.status];
            const sp = g.combat.screenPoint(e);
            if (r.applied) {
              g.effects.text(sp.x, sp.y - 16, `${def.name}${r.stacks > 1 ? ' X' + r.stacks : ''}`, def.color, 1, 1.1);
              g.audio.play(eff.status === 'mark' ? 'markApply' : eff.status === 'grave_mark' ? 'curse' : 'debuff');
            } else if (r.reason === 'resisted') g.effects.text(sp.x, sp.y - 16, 'RESISTED', '#a8a8a8', 1, 1);
          });
        });
        break;
      case 'buff':
        g.status.apply('player', eff.status, { dur: eff.dur, data: eff.power || null });
        g.effects.text(LAYOUT.view.w / 2, 250, STATUSES[eff.status].name, STATUSES[eff.status].color, 1, 1.2);
        break;
      case 'clear':
        targets.forEach((e) => this._schedule(0.02, () => g.status.remove(e, eff.status)));
        break;
      default: break;
    }
  }

  _hit(e, eff, p, cast, ti) {
    const g = this.game;
    if (!e.alive) return; // target died before the hit landed
    let dmg = randInt(eff.dmg[0], eff.dmg[1]) + g.hero.atk * (eff.scale || 0);
    if (eff.perResource) dmg += eff.perResource * cast.consumed;
    if (eff.perStack) {
      const add = e.rank === 'boss' && eff.perStack.bossAdd !== undefined ? eff.perStack.bossAdd : eff.perStack.add;
      dmg += g.status.stacks(e, eff.perStack.status) * add;
    }
    let mult = 1;
    if (ti > 0 && eff.secondary) mult *= eff.secondary;
    if (eff.bonusVs) for (const [st, m] of Object.entries(eff.bonusVs)) if (g.status.has(e, st)) mult *= m;
    const frac = e.hp / e.maxHp;
    const below = (o) => frac < (e.rank === 'boss' ? o.bossThreshold : o.threshold);
    if (eff.execute && below(eff.execute)) { mult *= eff.execute.mult; cast.executed = true; }
    if (eff.lowHp && below(eff.lowHp)) mult *= eff.lowHp.mult;
    if (eff.resourceScale) mult *= 1 + eff.resourceScale * cast.consumed;
    if (eff.markedHitBonus) mult *= 1 + Math.min(eff.markedHitBonus.cap, eff.markedHitBonus.per * g.stats.markedHits);

    // Soul Rend: check the curse before damage (statuses clear on death)
    if (eff.soulOnHit && (p.flags.soulAny || g.status.has(e, eff.soulOnHit.status))) {
      if (g.time >= (this.soulLock.get(e.id) || 0)) {
        this.soulLock.set(e.id, g.time + eff.soulOnHit.lockout);
        if (g.resource.gain(1) > 0) g.fx.soulCollect(e);
      }
    }
    const ctx = { source: 'skill', skill: p, cast, ignoreDef: !!eff.ignoreDef };
    const r = g.combat.finalizeDamage(e, dmg * mult, ctx);
    g.combat.damageEnemy(e, r.dmg, r.crit, { ctx, color: p.color, executed: cast.executed });
    if (eff.op === 'drain') this._drainHeal(e, r.dmg, eff, cast);
  }

  _drainHeal(e, dealt, eff, cast) {
    const g = this.game;
    const drainPower = 1 + (g.hero.stats?.drainPower || 0) / 100; // gear boosts the fraction; caps below still apply
    let heal = dealt * eff.healFrac * drainPower * (e.rank === 'boss' ? eff.bossHealMult ?? 1 : 1);
    heal = Math.min(heal, eff.healCap - cast.healed);
    const budget = HORSEMEN[g.hero.classId].healBudget;
    if (budget) {
      this.healLog = this.healLog.filter((h) => g.time - h.t < budget.window);
      const used = this.healLog.reduce((s, h) => s + h.amt, 0);
      heal = Math.min(heal, budget.max - used);
      if (heal <= 0) { g.log('Your hunger is sated - drain healing is capped for now.', '#8c8467'); return; }
    }
    const healed = g.hero.heal(Math.floor(heal));
    if (healed <= 0) return;
    cast.healed += healed;
    this.healLog.push({ t: g.time, amt: healed });
    g.stats.healed = (g.stats.healed || 0) + healed;
    g.effects.text(LAYOUT.view.w / 2 - 90, 258, `+${healed}`, '#60ff80', 2);
    g.fx.drain(e);
  }

  update() {
    const g = this.game;
    if (!this.pending.length) return;
    const due = this.pending.filter((h) => g.time >= h.at);
    this.pending = this.pending.filter((h) => g.time < h.at);
    for (const h of due) h.fn();
  }

  // ------------------------------------------------------------------ progression
  canUpgrade(id, choice) {
    const g = this.game, h = g.hero, s = SKILLS[id];
    if (!s || s.cls !== h.classId || !s.upgrades[choice]) return { ok: false, reason: 'Invalid upgrade.' };
    if (h.upgrades[id]) return { ok: false, reason: `${s.name} already has ${s.upgrades[h.upgrades[id]].name}.` };
    if (!this.isUnlocked(id)) return { ok: false, reason: `Unlock ${s.name} first (level ${this.unlockLevel(id)}).` };
    if (h.level < this.upgradeLevel(id)) return { ok: false, reason: `Upgrades for ${s.name} open at level ${this.upgradeLevel(id)}.` };
    if (h.skillPoints <= 0) return { ok: false, reason: 'No skill points. Level up to earn more.' };
    return { ok: true };
  }

  upgrade(id, choice) {
    const g = this.game;
    const c = this.canUpgrade(id, choice);
    if (!c.ok) { g.log(c.reason, '#a89a70'); g.audio.play('deny'); return false; }
    g.hero.skillPoints--;
    g.hero.upgrades[id] = choice;
    const s = SKILLS[id];
    g.log(`${s.name} upgraded: ${s.upgrades[choice].name}.`, '#ffd040');
    g.audio.play('levelUp');
    return true;
  }
}
