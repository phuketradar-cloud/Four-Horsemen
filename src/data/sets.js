// Set definitions. SetBonusManager counts distinct equipped slots per setId and activates
// bonuses at each threshold. Bonus stats use the same keys as items (see formulas.js).
export const SETS = {
  white_crown: {
    id: 'white_crown', name: 'WHITE CROWN', cls: 'conquest', color: '#f0d890',
    pieces: ['wc_crown', 'wc_mantle', 'wc_bracers', 'wc_greaves'],
    bonuses: [
      { count: 2, stats: { crit: 6 }, desc: '+6% Crit Chance' },
      { count: 4, stats: { markedDmg: 20, markedCrit: 10 }, desc: 'Marked foes take +20% damage, +10% crit against them' },
    ],
  },
  red_battlefield: {
    id: 'red_battlefield', name: 'RED BATTLEFIELD', cls: 'war', color: '#ff6040',
    pieces: ['rb_helm', 'rb_plate', 'rb_gauntlets', 'rb_greaves'],
    bonuses: [
      { count: 2, stats: { hpPct: 10 }, desc: '+10% Max HP' },
      { count: 4, stats: { resGain: 25, areaDmg: 20 }, desc: '+25% Fury generation, +20% area damage' },
    ],
  },
  black_harvest: {
    id: 'black_harvest', name: 'BLACK HARVEST', cls: 'famine', color: '#b0b040',
    pieces: ['bh_hood', 'bh_robe', 'bh_grips', 'bh_treads'],
    bonuses: [
      { count: 2, stats: { skillPower: 15 }, desc: '+15% Skill Power' },
      { count: 4, stats: { witherStacks: 1, dotDmg: 30 }, desc: '+1 max Withering stack, +30% DoT damage' },
    ],
  },
  pale_reaper: {
    id: 'pale_reaper', name: 'PALE REAPER', cls: 'death', color: '#a8d8f0',
    pieces: ['pr_cowl', 'pr_shroud', 'pr_gloves', 'pr_walkers'],
    bonuses: [
      { count: 2, stats: { critDmg: 20 }, desc: '+20% Crit Damage' },
      { count: 4, stats: { curseDmg: 25, executeDmg: 20 }, desc: 'Grave-Marked foes take +25%, foes below 35% HP take +20%' },
    ],
  },
  // ---- Phase 5 sets (any Horseman). Pieces: data/uniqueItems.js NEW_SET_PIECES.
  gravekeeper: {
    id: 'gravekeeper', name: 'GRAVEKEEPER', cls: null, color: '#c8c0a0', source: 'Chapter I',
    pieces: ['gk_helm', 'gk_coat', 'gk_lantern', 'gk_ring'],
    bonuses: [
      { count: 2, stats: { statusResist: 12, hp: 20 }, desc: '+12% Status Resist, +20 Max HP' },
      { count: 4, stats: { lifeOnKill: 10, damageReduction: 6 }, desc: '+10 HP on kill, +6% Damage Reduction' },
    ],
  },
  warforged_legion: {
    id: 'warforged_legion', name: 'WARFORGED LEGION', cls: null, color: '#d08040', source: 'Chapter II',
    pieces: ['wl_helm', 'wl_plate', 'wl_gauntlets', 'wl_greaves'],
    bonuses: [
      { count: 2, stats: { defPct: 10 }, desc: '+10% Defense' },
      { count: 4, stats: { atkPct: 10, bossDmg: 10 }, desc: '+10% Attack, +10% damage to elites/bosses' },
    ],
  },
  abyssal_watch: {
    id: 'abyssal_watch', name: 'ABYSSAL WATCH', cls: null, color: '#a060e0', source: 'Chapter V',
    pieces: ['aw_mask', 'aw_cloak', 'aw_grips', 'aw_treads'],
    bonuses: [
      { count: 2, stats: { evasion: 6, accuracy: 6 }, desc: '+6% Evasion, +6 Accuracy' },
      { count: 4, stats: { critDmg: 25, rangedDmg: 15 }, desc: '+25% Crit Damage, +15% ranged damage' },
    ],
  },
  seraphs_ruin: {
    id: 'seraphs_ruin', name: "SERAPH'S RUIN", cls: null, color: '#f0f0c0', source: 'Chapter VI',
    pieces: ['sr_halo', 'sr_vestment', 'sr_wraps', 'sr_sandals'],
    bonuses: [
      { count: 2, stats: { skillPower: 15, resist: 8 }, desc: '+15% Skill Power, +8% Resistance' },
      { count: 4, stats: { cdr: 8, statusDur: 15 }, desc: '+8% cooldown reduction, +15% status duration' },
    ],
  },
};
export const SET_FOR_CLASS = { conquest: 'white_crown', war: 'red_battlefield', famine: 'black_harvest', death: 'pale_reaper' };
