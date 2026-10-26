// Phase 6: class-mechanic tuning in ONE data file (previously literals inside HorsemanMechanics.js).
// Every change here was made from a measured simulation (tests/balance.js, ?test6) - see the README
// "Balance changes" table for the before/after numbers and the reason.
export const CLASS_BALANCE = {
  conquest: {
    empoweredMult: 1.6,       // basic shot multiplier at full Dominion
    empoweredCost: 35,        // Phase 6: an empowered shot now SPENDS Dominion (was free -> permanent x1.6)
    basicGain: 4, markedGain: 12, // Dominion per basic hit (marked: was 15)
    markCritBonus: 0.15,      // Unbroken Will: +crit chance vs Marked foes
    skillMarkGain: 6, skillMarkGainCap: 12,
  },
  war: {
    furyDmgPerPoint: 0.0025,  // +0.25% damage per Fury point (max +25%)
    basicGain: 8, staggerAt: 75, staggerDur: 0.4,
    skillGain: 3, skillGainCap: 9, hurtGain: 10, ironGain: 6,
  },
  famine: { witherBasicGain: 5, killGain: 15 },
  death: {
    soulsByRank: { normal: 1, elite: 2, boss: 3 }, reapersDue: 1,
    // Phase 6 "Soul Harvest": crossing these HP fractions grants 1 Soul once each (bosses pay out
    // during the fight instead of only on death - Death was resource-starved against single targets)
    harvest: { normal: [0.5], elite: [0.6, 0.3], boss: [0.8, 0.6, 0.4, 0.2] },
  },
};

// Global combat caps (data/formulas.js keeps per-stat caps; these bound whole-hit outcomes)
export const COMBAT_CAPS = {
  hitCritChance: 0.75,        // max crit chance of any single hit (weapon + character + mark)
};
