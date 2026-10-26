import { CLASS_BALANCE } from '../data/balance.js';

// HorsemanClassManager: each class's unique mechanic + passive, expressed as hooks that the
// shared CombatSystem / SkillSystem call. No combat, cooldown or resource logic is duplicated
// here — hooks only adjust multipliers and feed the ResourceManager.
//
// Hooks (all optional): outgoingMult(g, e, ctx) critBonus(g, e) onHit(g, e, ctx, dmg)
//   onDamaged(g, amount) onKill(g, e)
// ctx = { source: 'basic' | 'skill' | 'dot' | 'counter', skill, cast }   cast = per-cast scratch

const CB = CLASS_BALANCE;

const CONQUEST = {
  outgoingMult(g, e, ctx) {
    // empowered shot at full Dominion: spends Dominion (Phase 6) so it is a timed burst, not a permanent buff
    if (ctx.source === 'basic' && g.resource.full) { ctx.empowered = true; g.resource.spend(CB.conquest.empoweredCost); return CB.conquest.empoweredMult; }
    return 1;
  },
  critBonus(g, e) { return g.status.has(e, 'mark') ? CB.conquest.markCritBonus : 0; }, // Unbroken Will
  onHit(g, e, ctx) {
    const marked = g.status.has(e, 'mark');
    if (marked) g.stats.markedHits++;
    if (ctx.source === 'basic') g.resource.gain(marked ? CB.conquest.markedGain : CB.conquest.basicGain);
    else if (ctx.source === 'skill' && marked && ctx.cast) {
      const room = CB.conquest.skillMarkGainCap - (ctx.cast.gained || 0); // capped Dominion per cast
      if (room > 0) ctx.cast.gained = (ctx.cast.gained || 0) + g.resource.gain(Math.min(CB.conquest.skillMarkGain, room));
    }
  },
};

const WAR = {
  outgoingMult(g) { return 1 + g.resource.value * CB.war.furyDmgPerPoint; },
  onHit(g, e, ctx) {
    if (ctx.source === 'basic') {
      g.resource.gain(CB.war.basicGain);
      // enhanced heavy attacks at high Fury: brief stagger (rank-scaled, stun immunity applies)
      if (g.resource.value >= CB.war.staggerAt && e.alive && g.weapons.current.def.kind === 'melee') g.status.apply(e, 'stagger', { dur: CB.war.staggerDur });
    } else if (ctx.source === 'skill' && ctx.cast) {
      const room = CB.war.skillGainCap - (ctx.cast.gained || 0);
      if (room > 0) ctx.cast.gained = (ctx.cast.gained || 0) + g.resource.gain(Math.min(CB.war.skillGain, room));
    }
  },
  onDamaged(g) {
    g.resource.gain(CB.war.hurtGain, 'hurt', 0.6);
    g.resource.gain(CB.war.ironGain, 'bloodAndIron', 0.6); // passive: Blood and Iron (rate limited)
  },
};

const FAMINE = {
  onHit(g, e, ctx) {
    if (ctx.source === 'basic' && g.status.has(e, 'wither')) g.resource.gain(CB.famine.witherBasicGain);
  },
  onKill(g, e) {
    if (g.status.has(e, 'wither') && !e.plagueClaimed) { // Nothing Is Wasted — once per enemy
      e.plagueClaimed = true;
      g.resource.gain(CB.famine.killGain);
      g.log(`Nothing is wasted: +${CB.famine.killGain} Plague.`, '#b0b040');
    }
  },
};

const DEATH = {
  // Soul Harvest (Phase 6): each HP threshold a foe crosses pays one Soul, once per threshold per foe
  // (summons and illusions excluded) - so Death can fight bosses without starving.
  onHit(g, e) {
    if (e.summoned || e.illusion) return;
    const marks = CB.death.harvest[e.rank] || CB.death.harvest.normal;
    e.harvested = e.harvested || 0;
    while (e.harvested < marks.length && e.hp / e.maxHp <= marks[e.harvested]) {
      e.harvested++;
      if (g.resource.gain(1) > 0) { g.audio.play('soulGain'); g.fx.soulCollect?.(e); }
    }
  },
  onKill(g, e) {
    if (e.soulsClaimed) return; // a death event can never pay out twice
    e.soulsClaimed = true;
    const n = Math.min(3, CB.death.soulsByRank[e.rank] || 1) + CB.death.reapersDue; // + Reaper's Due
    const got = g.resource.gain(n);
    if (got > 0) { g.log(`Reaper's due: +${got} Soul${got > 1 ? 's' : ''}.`, '#a8d8f0'); g.fx.soulCollect(e); }
  },
};

export const MECHANICS = { conquest: CONQUEST, war: WAR, famine: FAMINE, death: DEATH };

export function mech(g) { return MECHANICS[g.hero.classId] || {}; }
