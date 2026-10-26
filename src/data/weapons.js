// Weapon archetypes. Pure data — WeaponSystem/CombatSystem read these, never hard-code numbers.
// slot: hotbar key (1-4). cooldown: seconds between attacks. windup: delay from press to impact.
export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Rusted Sword', kind: 'melee', slot: 1,
    dmg: [8, 12], cooldown: 0.6, windup: 0.1, range: 1,
    crit: 0.10, critMult: 1.75,
    speedLabel: 'MEDIUM', rangeLabel: 'CLOSE',
    anim: 'slash', sfx: 'sword', trait: 'Balanced strikes. Reliable.',
  },
  axe: {
    id: 'axe', name: 'War Axe', kind: 'melee', slot: 2, twoHanded: true,
    dmg: [17, 25], cooldown: 1.3, windup: 0.3, range: 1,
    crit: 0.08, critMult: 2.0,
    cleave: true,   // also hits enemies in the front-left / front-right cells
    stagger: true,  // interrupts an enemy wind-up
    speedLabel: 'SLOW', rangeLabel: 'CLOSE +CLEAVE',
    anim: 'heavy', sfx: 'axe', trait: 'Heavy cleave. Staggers foes.',
  },
  crossbow: {
    id: 'crossbow', name: 'Hunter Crossbow', kind: 'ranged', slot: 3, twoHanded: true,
    dmg: [13, 19], cooldown: 1.5, windup: 0.05, range: 6,
    crit: 0.15, critMult: 2.0,
    projectileSpeed: 14, // cells per second
    clip: 1,             // bolts per load; cooldown acts as reload time
    speedLabel: 'SLOW (RELOAD)', rangeLabel: 'LONG (6)',
    anim: 'shoot', sfx: 'crossbow', trait: 'Fires bolts down corridors.',
  },
  dagger: {
    id: 'dagger', name: 'Cursed Dagger', kind: 'melee', slot: 4,
    dmg: [4, 7], cooldown: 0.28, windup: 0.03, range: 1,
    crit: 0.30, critMult: 2.5,
    speedLabel: 'FAST', rangeLabel: 'SHORT',
    anim: 'stab', sfx: 'dagger', trait: 'Rapid stabs, deadly crits.',
  },
  // ---- Phase 5 weapon behaviours (catalog families). `fp` = first-person / back-view sprite reused.
  greatsword: {
    id: 'greatsword', name: 'Greatsword', kind: 'melee', slot: 2, twoHanded: true, fp: 'sword',
    dmg: [15, 23], cooldown: 1.15, windup: 0.25, range: 1, crit: 0.1, critMult: 2.0, stagger: true,
    speedLabel: 'SLOW', rangeLabel: 'CLOSE', anim: 'heavy', sfx: 'greatsword', trait: 'Heavy staggering blows, no cleave.',
  },
  hammer: {
    id: 'hammer', name: 'War Hammer', kind: 'melee', slot: 2, twoHanded: true, fp: 'axe',
    dmg: [19, 29], cooldown: 1.45, windup: 0.35, range: 1, crit: 0.06, critMult: 2.25, stagger: true,
    speedLabel: 'VERY SLOW', rangeLabel: 'CLOSE', anim: 'heavy', sfx: 'hammer', trait: 'Crushing blows that stagger and pierce armour.',
  },
  spear: {
    id: 'spear', name: 'Spear', kind: 'melee', slot: 1, fp: 'dagger', reach: 2,
    dmg: [7, 11], cooldown: 0.7, windup: 0.12, range: 2, crit: 0.1, critMult: 1.75,
    speedLabel: 'MEDIUM', rangeLabel: 'REACH (2)', anim: 'stab', sfx: 'spear', trait: 'Strikes the first foe up to two tiles ahead.',
  },
  scythe: {
    id: 'scythe', name: 'Scythe', kind: 'melee', slot: 2, twoHanded: true, fp: 'axe',
    dmg: [14, 22], cooldown: 1.1, windup: 0.25, range: 1, crit: 0.14, critMult: 2.1, cleave: true,
    speedLabel: 'SLOW', rangeLabel: 'CLOSE +CLEAVE', anim: 'heavy', sfx: 'scythe', trait: 'Wide reaping arcs with high crits.',
  },
  bow: {
    id: 'bow', name: 'Longbow', kind: 'ranged', slot: 3, twoHanded: true, fp: 'crossbow',
    dmg: [10, 15], cooldown: 1.0, windup: 0.05, range: 7, crit: 0.14, critMult: 1.9, projectileSpeed: 16, clip: 1,
    speedLabel: 'MEDIUM', rangeLabel: 'LONG (7)', anim: 'shoot', sfx: 'bow', trait: 'Faster arrows, slightly weaker than bolts.',
  },
  fists: {
    id: 'fists', name: 'Bare Hands', kind: 'melee', slot: 0,
    dmg: [1, 3], cooldown: 0.5, windup: 0.05, range: 1,
    crit: 0.05, critMult: 1.5,
    speedLabel: 'MEDIUM', rangeLabel: 'CLOSE',
    anim: 'stab', sfx: 'punch', trait: 'Better than nothing.',
  },
};

export const WEAPON_BY_SLOT = { 1: 'sword', 2: 'axe', 3: 'crossbow', 4: 'dagger' };
// Phase 2: class skills replaced the Phase 1 "Wrath of War" spell — see data/skills.js.
