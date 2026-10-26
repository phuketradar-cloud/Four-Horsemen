// CharacterClassData — the Four Horsemen. Pure data: stats, growth, resource, passive,
// mechanic text, skill slots and starting kit. All balance numbers live here or in skills.js.

// Class resources (never interchangeable "mana"). persist=true values survive between
// encounters and in saves; others reset to `start` on load and decay out of combat.
export const RESOURCES = {
  dominion: { id: 'dominion', name: 'DOMINION', short: 'DOM', max: 100, start: 20, color: '#f0d890', dark: '#3a3018', regenPerSec: 0, decayDelay: 4, decayPerSec: 3, persist: false },
  fury: { id: 'fury', name: 'FURY', short: 'FURY', max: 100, start: 0, color: '#e0301c', dark: '#300806', regenPerSec: 0, decayDelay: 3, decayPerSec: 5, persist: false },
  plague: { id: 'plague', name: 'PLAGUE', short: 'PLG', max: 100, start: 50, color: '#94b040', dark: '#1c2408', regenPerSec: 1.5, decayDelay: 0, decayPerSec: 0, persist: true },
  souls: { id: 'souls', name: 'SOULS', short: 'SOUL', max: 10, start: 2, color: '#a8d8f0', dark: '#0c1820', regenPerSec: 0, decayDelay: 0, decayPerSec: 0, persist: true, pips: true },
};

// base: Phase 2 spec stats. growth: per level after 1. moveRepeat: seconds per tile step.
export const HORSEMEN = {
  conquest: {
    id: 'conquest', name: 'CONQUEST', title: 'THE WHITE RIDER', epithet: 'THE CORRUPTED KING',
    role: 'PRECISION / RANGED', difficulty: 2, portrait: 'conquest',
    lore: 'A pale king beneath a broken halo. Conquest names its prey, and what it names, it takes.',
    colors: { main: '#e8e0c8', accent: '#d8b050', fx: ['#ffffff', '#f0d070', '#fff0b0'] },
    base: { hp: 90, atk: 12, def: 5, crit: 10, speed: 'FAST' }, moveRepeat: 0.15,
    growth: { hp: 9 },
    attributes: { str: 4, dex: 9, vit: 5, int: 5, wis: 5, lck: 7 },
    attrGrowth: { str: 0.4, dex: 1.2, vit: 0.6, int: 0.4, wis: 0.4, lck: 0.5 },
    resource: 'dominion',
    mechanic: { name: 'MARK OF DOMINION', desc: 'Hits on a Marked foe build Dominion. At full Dominion your basic attacks are Empowered (+60% damage).' },
    passive: { id: 'unbroken_will', name: 'UNBROKEN WILL', desc: '+15% critical chance against Marked enemies.' },
    skills: ['piercing_judgment', 'mark_of_crown', 'phantom_volley', 'royal_decree'], ultimate: 'world_conqueror',
    startItems: [{ item: 'hunter_crossbow', equip: true }, { item: 'rusted_sword' }, { item: 'health_potion', qty: 1 }],
  },
  war: {
    id: 'war', name: 'WAR', title: 'THE RED RIDER', epithet: 'THE ETERNAL BATTLEFIELD',
    role: 'MELEE / AREA', difficulty: 1, portrait: 'war',
    lore: 'Every battlefield is his altar. War grows stronger the longer the blood flows.',
    colors: { main: '#b0281c', accent: '#ff6a30', fx: ['#ff3020', '#ff8a30', '#ffd040'] },
    base: { hp: 120, atk: 15, def: 8, crit: 6, speed: 'NORMAL' }, moveRepeat: 0.2,
    growth: { hp: 13 },
    attributes: { str: 9, dex: 4, vit: 8, int: 2, wis: 3, lck: 4 },
    attrGrowth: { str: 1.3, dex: 0.4, vit: 1.0, int: 0.2, wis: 0.3, lck: 0.3 },
    resource: 'fury',
    mechanic: { name: 'BATTLE FURY', desc: 'Dealing and taking damage builds Fury (+0.25% damage per point). At 75+ Fury, basic melee blows stagger.' },
    passive: { id: 'blood_and_iron', name: 'BLOOD AND IRON', desc: 'Taking damage grants +6 extra Fury (at most once every 0.6s).' },
    skills: ['cleave', 'armor_breaker', 'blood_rush', 'earthshaker'], ultimate: 'red_apocalypse',
    startItems: [{ item: 'rusted_sword', equip: true }, { item: 'health_potion', qty: 1 }],
  },
  famine: {
    id: 'famine', name: 'FAMINE', title: 'THE BLACK RIDER', epithet: 'THE DEVOURER OF PLENTY',
    role: 'ATTRITION / SUSTAIN', difficulty: 3, portrait: 'famine',
    lore: 'Famine carries the scales of hunger. Nothing escapes the slow wasting of its gaze.',
    colors: { main: '#2a2620', accent: '#b0b040', fx: ['#a0b040', '#506020', '#2a1e30'] },
    base: { hp: 95, atk: 10, def: 6, crit: 5, speed: 'NORMAL' }, moveRepeat: 0.2,
    growth: { hp: 10 },
    attributes: { str: 3, dex: 5, vit: 6, int: 8, wis: 9, lck: 4 },
    attrGrowth: { str: 0.3, dex: 0.5, vit: 0.7, int: 1.1, wis: 1.1, lck: 0.3 },
    resource: 'plague',
    mechanic: { name: 'WITHERING', desc: 'Withering stacks (max 5) cut enemy damage by 6% each and feed your drains. Drain healing is capped: 60 HP per 20s.' },
    passive: { id: 'nothing_is_wasted', name: 'NOTHING IS WASTED', desc: 'Slaying a Withered enemy restores 15 Plague (once per enemy).' },
    skills: ['withering_touch', 'harvest_of_weakness', 'black_plague', 'starvation_field'], ultimate: 'last_harvest',
    healBudget: { window: 20, max: 60 },
    startItems: [{ item: 'cursed_dagger', equip: true }, { item: 'health_potion', qty: 2 }],
  },
  death: {
    id: 'death', name: 'DEATH', title: 'THE PALE RIDER', epithet: 'THE FINAL SILENCE',
    role: 'CURSE / EXECUTE', difficulty: 3, portrait: 'death',
    lore: 'The last rider comes for all. Death gathers souls and spends them on the final cut.',
    colors: { main: '#c8c8c0', accent: '#a8d8f0', fx: ['#c0e8ff', '#80c0e0', '#e8f8ff'] },
    base: { hp: 100, atk: 13, def: 6, crit: 8, speed: 'NORMAL' }, moveRepeat: 0.2,
    growth: { hp: 11 },
    attributes: { str: 6, dex: 5, vit: 6, int: 8, wis: 5, lck: 5 },
    attrGrowth: { str: 0.8, dex: 0.5, vit: 0.7, int: 1.0, wis: 0.4, lck: 0.4 },
    resource: 'souls',
    mechanic: { name: 'SOUL HARVEST', desc: 'Kills grant Souls (normal 1, elite 2, boss 3; max 10). Souls power curses and the ultimate.' },
    passive: { id: 'reapers_due', name: "REAPER'S DUE", desc: '+1 bonus Soul per enemy slain (strictly once per enemy).' },
    skills: ['soul_rend', 'grave_mark', 'wraith_step', 'deaths_embrace'], ultimate: 'final_silence',
    startItems: [{ item: 'war_axe', equip: true }, { item: 'health_potion', qty: 1 }],
  },
};
export const CLASS_ORDER = ['conquest', 'war', 'famine', 'death'];

// Six party slots (left 0-2, right 3-5). The chosen Horseman leads; the others rest this run.
export function buildFormation(classId) {
  const others = CLASS_ORDER.filter((c) => c !== classId);
  return [classId, others[0], null, others[1], others[2], null];
}
