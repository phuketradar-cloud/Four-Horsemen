// LegendaryEffectRegistry data: reusable effects with a trigger, an internal cooldown (icd, seconds)
// and hard limits. Handlers live in systems/LegendaryEffects.js; this file is pure data.
// trigger: basicHit | kill | damaged | statusApplied | passive
// pool: 'legendary' => may roll on random Legendary items of the listed slots.
export const LEGENDARY_EFFECTS = {
  // relics (always present on that relic base)
  echo_strike: { name: 'Echo of the Seal', trigger: 'basicHit', icd: 0, every: 4, mult: 0.5, desc: 'Every 4th basic hit strikes again for 50% damage.' },
  royal_command: { name: 'Royal Command', trigger: 'statusApplied', icd: 6, cls: 'conquest', amount: 10, desc: 'Applying a Mark grants 10 Dominion (once per 6s).' },
  blood_tithe: { name: 'Blood Tithe', trigger: 'kill', icd: 1, cls: 'war', amount: 12, desc: 'Kills grant 12 Fury (once per 1s).' },
  hungering_scales: { name: 'Hungering Scales', trigger: 'passive', cls: 'famine', stats: { witherStacks: 1 }, desc: 'Withering can stack 1 higher.' },
  pale_lantern: { name: 'Pale Lantern', trigger: 'kill', icd: 4, cls: 'death', amount: 1, desc: 'Slaying a Grave-Marked foe grants +1 Soul (once per 4s).' },
  // random legendary pool
  vampiric: { name: 'Vampiric', trigger: 'basicHit', icd: 1.5, pct: 0.02, pool: 'legendary', slots: ['mainHand', 'ring'], desc: 'Basic hits heal 2% max HP (once per 1.5s).' },
  thorns: { name: 'Thorns', trigger: 'damaged', icd: 0.8, pct: 0.25, pool: 'legendary', slots: ['chest', 'offHand'], desc: 'When struck, reflect 25% of the damage taken (once per 0.8s).' },
  second_wind: { name: 'Second Wind', trigger: 'damaged', icd: 60, threshold: 0.3, pct: 0.2, pool: 'legendary', slots: ['head', 'legs', 'hands', 'relic'], desc: 'Falling below 30% HP heals 20% max HP (once per 60s).' },
  // mythic uniques
  sunlance: { name: 'Sunlance', trigger: 'passive', cls: 'conquest', pierce: 1, desc: 'Basic bolts pierce through one extra enemy.' },
  worldbreaker: { name: 'Worldbreaker', trigger: 'basicHit', icd: 2, chance: 0.25, mult: 0.6, cls: 'war', desc: 'Basic hits: 25% chance of a shockwave hitting all adjacent foes for 60% (once per 2s).' },
  maw_of_famine: { name: 'Endless Maw', trigger: 'basicHit', icd: 1, cls: 'famine', desc: 'Basic hits apply 1 Withering stack (once per 1s).' },
  // Phase 4 crafted relic (Apocalyptic Relic)
  end_of_days: { name: 'End of Days', trigger: 'passive', stats: { atkPct: 8, hpPct: 8, lootLuck: 3 }, desc: '+8% ATK, +8% max HP, +3 loot luck.' },
  // ================================================================ Phase 5 (generic handlers)
  // trigger: basicHit | skillHit | kill | damaged | statusApplied | skillCast | roomEnter | passive
  // cond:    targetStatus, targetHpBelow, targetRank[], resourceAbove (0-1), hpBelow (0-1), ranged,
  //          twoHanded, statusId, areaSkill, chance
  // actions: resource{amount} heal{pct} damage{mult, target: target|adjacent} status{status,dur,stacks}
  //          buff{status,dur} revealSecrets
  // dmgBonus {pct, cond}: conditional damage multiplier.  stats: passive.  skillMods: per skill id.
  // Every trigger has an internal cooldown (icd) and procs can never trigger procs.
  crown_of_dominion: { name: 'Dominion', cls: 'conquest', trigger: 'hit', icd: 1, cond: { targetStatus: 'mark' }, actions: [{ do: 'resource', amount: 5 }], dmgBonus: { pct: 15, cond: { targetStatus: 'mark' } }, desc: '+15% damage to Marked foes; hitting one grants 5 Dominion (once per 1s).' },
  victors_gauntlets: { name: "Victor's Due", cls: 'conquest', trigger: 'kill', icd: 3, cond: { targetStatus: 'mark' }, actions: [{ do: 'resource', amount: 12 }, { do: 'heal', pct: 0.03 }], desc: 'Killing a Marked foe: +12 Dominion and 3% HP (once per 3s).' },
  heralds_signet: { name: 'Herald', cls: 'conquest', trigger: 'passive', stats: { markedCrit: 8, accuracy: 4 }, desc: '+8% crit against Marked foes, +4 Accuracy.' },
  gorefist: { name: 'Gore', cls: 'war', trigger: 'basicHit', icd: 1, cond: { twoHanded: true }, actions: [{ do: 'resource', amount: 6 }], desc: 'Two-handed basic hits grant +6 Fury (once per 1s).' },
  ninth_legion: { name: 'No Retreat', cls: 'war', trigger: 'damaged', icd: 30, cond: { hpBelow: 0.5 }, actions: [{ do: 'buff', status: 'bulwark', dur: 5 }, { do: 'resource', amount: 20 }], desc: 'Falling below 50% HP: Bulwark (-30% damage taken) for 5s and +20 Fury (once per 30s).' },
  siegebreaker: { name: 'Siegebreaker', cls: 'war', trigger: 'basicHit', icd: 6, actions: [{ do: 'status', status: 'armor_break', dur: 4 }], desc: 'Basic hits Break Armour for 4s (once per 6s).' },
  scales_last_harvest: { name: 'Last Harvest', cls: 'famine', trigger: 'kill', icd: 4, cond: { targetStatus: 'wither' }, actions: [{ do: 'heal', pct: 0.03 }], stats: { witherStacks: 1 }, desc: '+1 max Withering stack. Killing a Withered foe heals 3% HP (once per 4s; heal caps apply).' },
  locust_hood: { name: 'Locusts', cls: 'famine', trigger: 'skillHit', icd: 2, actions: [{ do: 'status', status: 'wither', stacks: 1, dur: 8 }], desc: 'Skill hits apply 1 Withering stack (once per 2s).' },
  blightroot_sickle: { name: 'Blightroot', cls: 'famine', trigger: 'basicHit', icd: 2, cond: { targetStatus: 'wither' }, actions: [{ do: 'heal', pct: 0.01 }, { do: 'resource', amount: 3 }], desc: 'Basic hits on Withered foes: 1% HP and +3 Plague (once per 2s).' },
  gravecaller: { name: 'Gravecall', cls: 'death', trigger: 'passive', dmgBonus: { pct: 15, cond: { targetStatus: 'grave_mark', skill: true } }, desc: 'Skills deal +15% damage to Grave-Marked foes.' },
  ferrymans_coin: { name: "Ferryman's Toll", cls: 'death', trigger: 'kill', icd: 3, actions: [{ do: 'heal', pct: 0.02 }], desc: 'Kills heal 2% HP (once per 3s).' },
  requiem: { name: 'Requiem', cls: 'death', trigger: 'kill', icd: 5, actions: [{ do: 'resource', amount: 1 }], stats: { executeDmg: 10 }, desc: '+10% execute damage; kills grant +1 Soul (once per 5s).' },
  heart_first_seal: { name: 'First Seal', trigger: 'damaged', icd: 1.5, actions: [{ do: 'damage', mult: 0.4, target: 'attacker' }], desc: 'When struck, the seal answers: 40% of the damage is returned (once per 1.5s).' },
  nephilim_girdle: { name: "Giant's Stand", trigger: 'damaged', icd: 12, cond: { bigHit: 0.12 }, actions: [{ do: 'buff', status: 'bulwark', dur: 3 }], desc: 'A blow over 12% of your max HP grants Bulwark for 3s (once per 12s).' },
  abyss_touched: { name: 'Abyss-Touched', trigger: 'passive', stats: { bossDmg: 12 }, desc: '+12% damage to elites and bosses.' },
  seraph_feather: { name: 'Last Light', trigger: 'damaged', icd: 45, cond: { hpBelow: 0.25 }, actions: [{ do: 'heal', pct: 0.15 }], desc: 'Falling below 25% HP heals 15% (once per 45s).' },
  gorgons_eye: { name: 'Petrifying Gaze', trigger: 'basicHit', icd: 5, cond: { chance: 0.2 }, actions: [{ do: 'status', status: 'starved', dur: 3 }], desc: 'Basic hits have a 20% chance to Slow the target for 3s (once per 5s).' },
  cerberus_collar: { name: 'Three Hungers', trigger: 'kill', icd: 8, actions: [{ do: 'buff', status: 'frenzy', dur: 4 }], desc: 'Kills grant Frenzy (+15% damage, faster attacks) for 4s (once per 8s).' },
  dragonscale: { name: 'Dragonscale', trigger: 'passive', stats: { damageReduction: 5, resist: 6 }, desc: '+5% Damage Reduction, +6% Resistance.' },
  prophets_lie: { name: 'False Sign', trigger: 'passive', stats: { evasion: 6 }, desc: '+6% Evasion.' },
  lantern_lost_road: { name: 'Lost Road', trigger: 'roomEnter', icd: 0, actions: [{ do: 'revealSecrets' }], stats: { lootLuck: 3 }, desc: 'Hidden walls in the rooms you enter are marked on your map. +3 Loot Luck.' },
  // ---- Phase 5 Mythics
  unerring_arrow: { name: 'The Unerring Arrow', cls: 'conquest', trigger: 'passive', pierce: 1, skillMods: { piercing_judgment: { costAdd: -10, dmgMult: 1.25 } }, dmgBonus: { pct: 15, cond: { targetStatus: 'mark', ranged: true } }, desc: 'Arrows pierce one extra foe; ranged hits on Marked foes +15%; Piercing Judgment costs 10 less and hits 25% harder.' },
  red_kings_mantle: { name: "The Red King's Mantle", cls: 'war', trigger: 'skillHit', icd: 0.5, cond: { areaSkill: true }, actions: [{ do: 'resource', amount: 2 }], dmgBonus: { pct: 25, cond: { resourceAbove: 0.75, areaSkill: true } }, desc: 'Area skills deal +25% at 75+ Fury and each area hit grants +2 Fury (once per 0.5s).' },
  empty_chalice: { name: 'The Empty Chalice', cls: 'famine', trigger: 'kill', icd: 3, cond: { targetStatus: 'wither' }, actions: [{ do: 'resource', amount: 15 }], stats: { drainPower: 20 }, dmgBonus: { pct: 12, cond: { targetStatus: 'wither' } }, desc: '+20% drain healing (caps unchanged); Withered foes take +12%; killing one grants +15 Plague (once per 3s).' },
  pale_crown: { name: 'The Pale Crown', cls: 'death', trigger: 'kill', icd: 4, cond: { targetStatus: 'grave_mark' }, actions: [{ do: 'resource', amount: 1 }], stats: { executeDmg: 20 }, skillMods: { final_silence: { minResourceAdd: -2 } }, desc: '+20% execute damage; Grave-Marked kills grant +1 Soul (once per 4s); The Final Silence needs 2 fewer Souls.' },
  last_silence: { name: 'The Last Silence', trigger: 'passive', cls: 'death', threshold: 0.2, bossThreshold: 0.1, mult: 1.6, desc: '+60% damage to foes below 20% HP (bosses: below 10%).' },
};
