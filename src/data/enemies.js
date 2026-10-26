// Enemy archetypes. AI (EnemyAI.js) is generic; behaviour differences live here.
export const ENEMIES = {
  skeleton: {
    id: 'skeleton', name: 'Hollow Skeleton', sprite: 'skeleton', rank: 'normal',
    hp: 30, atk: [5, 8], def: 1,
    moveInterval: 0.75,  // seconds per tile while chasing
    patrolInterval: 1.6,
    windup: 0.55,        // telegraph before the strike lands
    recover: 0.9,        // pause after striking
    hurtStun: 0.3,
    detectRange: 5,
    loseTime: 4,         // seconds without line of sight before giving up
    heavy: false,        // heavy attacks can be perfect-parried for a stagger
    interruptible: true, // any hit cancels its wind-up
    xp: 25,
    scale: 0.85,         // world height (cell = 1)
    combatScale: 4,
    level: 2, evasion: 5, darkFrac: 0, // Phase 3: XP scaling, hit chance, dark (resist) share of damage
    lootTable: 'skeleton',
    deathSfx: 'boneDeath', attackSfx: 'enemySwipe',
  },
  knight: {
    id: 'knight', name: 'Fallen Knight', sprite: 'knight', rank: 'elite',
    hp: 95, atk: [14, 20], def: 4,
    moveInterval: 1.25,
    patrolInterval: 2.4,
    windup: 1.1,
    recover: 1.4,
    hurtStun: 0.2,
    detectRange: 4,
    loseTime: 6,
    heavy: true,
    interruptible: false, // only staggering hits (axe, perfect parry) break its wind-up
    xp: 90,
    scale: 1.0,
    combatScale: 3.4,
    level: 4, evasion: 3, darkFrac: 0.2,
    sunder: { chance: 0.5, dur: 4 }, // unblocked heavy blows may Sunder you (-30% DEF), shortened by Status Resist
    lootTable: 'knight',
    deathSfx: 'armorDeath', attackSfx: 'enemyHeavy',
  },
};

// ---------------------------------------------------------------- Phase 4 themed enemies
// Same archetype fields as above. `inflict` = status applied by unblocked blows (shortened by
// Status Resist). Stats are given at the archetype's own `level`; other levels scale through
// ENEMY_SCALING (data/difficulty.js). Loot tables are chosen per dungeon spawn table.
const E = (id, o) => {
  ENEMIES[id] = {
    id, rank: 'normal', def: 0, moveInterval: 0.9, patrolInterval: 1.8, windup: 0.6, recover: 1, hurtStun: 0.25,
    detectRange: 5, loseTime: 5, heavy: false, interruptible: true, scale: 1, combatScale: 3.4, evasion: 3, darkFrac: 0,
    deathSfx: 'boneDeath', attackSfx: 'enemySwipe', ...o,
  };
};
// I. Ashen Catacombs
E('grave_crawler', { name: 'Grave Crawler', sprite: 'crawler', level: 3, hp: 24, atk: [4, 7], moveInterval: 0.5, patrolInterval: 1.2, windup: 0.4, recover: 0.8, xp: 22, scale: 0.5, combatScale: 4, evasion: 8, lootTable: 'ashen_crawler', desc: 'Fast and fragile. Do not let it surround you.' });
// II. Red Warfront
E('legionnaire', { name: 'Fallen Legionnaire', sprite: 'legionnaire', level: 12, hp: 75, atk: [11, 16], def: 5, windup: 0.7, xp: 70, scale: 0.95, evasion: 4, lootTable: 'war_legionnaire', deathSfx: 'armorDeath', desc: 'Drilled even in death. Shield up, blade ready.' });
E('war_hound', { name: 'War Hound', sprite: 'hound', level: 11, hp: 50, atk: [8, 13], def: 2, moveInterval: 0.45, windup: 0.35, recover: 0.7, xp: 55, scale: 0.55, combatScale: 3.8, evasion: 12, lootTable: 'war_hound', desc: 'Hunts in packs. Quick, weak bite.' });
E('executioner', { name: 'Iron Executioner', sprite: 'executioner', rank: 'elite', level: 15, hp: 210, atk: [24, 34], def: 8, moveInterval: 1.3, windup: 1.2, recover: 1.5, hurtStun: 0.2, heavy: true, interruptible: false, xp: 220, scale: 1.08, combatScale: 3.2, evasion: 2, darkFrac: 0.1, sunder: { chance: 0.5, dur: 4 }, lootTable: 'war_executioner', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', desc: 'Slow, crushing blows that Sunder armour. Parry them.' });
// III. Black Harvest
E('thrall', { name: 'Withered Thrall', sprite: 'thrall', level: 22, hp: 150, atk: [18, 26], def: 9, moveInterval: 1, windup: 0.8, recover: 1.1, xp: 150, scale: 0.95, combatScale: 3.6, inflict: { status: 'blighted', chance: 0.3, dur: 5 }, lootTable: 'harvest_thrall', desc: 'Rotting farmhands. Their touch spreads Blight.' });
E('stalker', { name: 'Plague Stalker', sprite: 'stalker', level: 24, hp: 120, atk: [17, 24], def: 6, moveInterval: 0.5, windup: 0.45, recover: 0.8, xp: 160, scale: 0.6, combatScale: 3.8, evasion: 14, inflict: { status: 'blighted', chance: 0.35, dur: 5 }, lootTable: 'harvest_stalker', desc: 'Low, quick and hard to hit.' });
E('harvester', { name: 'Hollow Harvester', sprite: 'harvester', rank: 'elite', level: 27, hp: 420, atk: [36, 48], def: 12, moveInterval: 1.2, windup: 1.15, recover: 1.4, hurtStun: 0.2, heavy: true, interruptible: false, darkFrac: 0.5, xp: 520, scale: 1.05, combatScale: 3.2, inflict: { status: 'blighted', chance: 0.5, dur: 6 }, lootTable: 'harvest_harvester', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', desc: 'A lesser husk of the thing in the reservoir. Heavy scythe.' });
// IV. Pale Threshold
E('revenant', { name: 'Pale Revenant', sprite: 'revenant', level: 37, hp: 280, atk: [32, 44], def: 10, moveInterval: 0.7, windup: 0.65, xp: 380, scale: 1, evasion: 15, darkFrac: 0.6, resist: { basic: 0.15, skill: -0.1 }, inflict: { status: 'cursed', chance: 0.3, dur: 6 }, lootTable: 'pale_revenant', desc: 'Mostly dark damage: Resistance matters here. Curses on hit.' });
E('soulbound', { name: 'Soulbound Knight', sprite: 'soulbound', level: 40, hp: 460, atk: [42, 56], def: 18, moveInterval: 1.1, windup: 1, recover: 1.3, hurtStun: 0.2, heavy: true, interruptible: false, darkFrac: 0.3, sunder: { chance: 0.4, dur: 4 }, xp: 480, lootTable: 'pale_soulbound', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', desc: 'Bound to its oath forever.' });
// ---------------------------------------------------------------- Phase 5 bestiary (mythological / apocalyptic)
// New fields:
//   category  common | uncommon | elite | miniboss | chapterBoss | endgameBoss (encounter category)
//   ai        melee (default) | ranged (keeps 2+ tiles away and casts) | support | caster
//   abilities [{ id, kind, cd, windup, ... }] run by systems/EnemyAbilities.js (telegraphed, capped)
//   resist    { basic, skill, dot } damage taken modifiers (+0.25 = 25% less) - counterplay, never immunity
//   statusRules { statusId: 'immune' | durationMultiplier }
//   lore      bestiary entry.  Canon note: names come from Revelation / Greek myth; behaviours and lore
//             here are ORIGINAL game fiction, not scripture or myth retold.
// Chapter II-IV additions
E('war_cultist', { name: 'War Cultist', sprite: 'cultist', category: 'uncommon', ai: 'support', level: 13, hp: 60, atk: [9, 13], def: 3, xp: 80, evasion: 6, lootTable: 'war_legionnaire',
  abilities: [{ id: 'blood_hymn', kind: 'empower', name: 'Blood Hymn', cd: 10, windup: 1.0, radius: 3, dur: 6 }],
  desc: 'Chants that make nearby soldiers hit harder. Kill it first.', lore: 'They pray to the Red Rider, who has never once answered.' });
E('lich', { name: 'Lich', sprite: 'lich', category: 'uncommon', ai: 'ranged', level: 36, hp: 230, atk: [26, 34], def: 8, moveInterval: 1.0, windup: 0.7, xp: 420, evasion: 8, darkFrac: 0.7, lootTable: 'pale_revenant',
  resist: { dot: 0.4, basic: -0.2 }, statusRules: { wither: 0.5 },
  abilities: [{ id: 'grave_bolt', kind: 'bolt', name: 'Grave Bolt', cd: 3.5, windup: 0.9, range: 5, dmg: 1.0, damageKind: 'dark' }, { id: 'raise', kind: 'summon', name: 'Raise Dead', cd: 16, windup: 1.4, spawn: 'skeleton', count: 1, maxAlive: 2, maxTotal: 3 }],
  desc: 'Keeps its distance and casts. Close in: it is frail up close. DoTs do little.', lore: 'A scholar who read the last page of the wrong book.' });
// Chapter V - the Abyssal Gate
E('abyssal_beast', { name: 'Abyssal Beast', sprite: 'abyssbeast', category: 'common', level: 40, hp: 300, atk: [36, 46], def: 12, moveInterval: 0.6, windup: 0.5, recover: 0.8, xp: 400, scale: 0.6, combatScale: 3.8, evasion: 10, darkFrac: 0.4, resist: { basic: 0.1 }, lootTable: 'abyss_beast',
  desc: 'Fast, many-mouthed, and hungry.', lore: 'Original creature: what the Abyss makes when it tries to make a wolf.' });
E('gorgon', { name: 'Gorgon', sprite: 'gorgon', category: 'uncommon', ai: 'ranged', level: 41, hp: 340, atk: [34, 44], def: 10, moveInterval: 0.9, windup: 0.7, xp: 520, evasion: 12, darkFrac: 0.5, statusRules: { starved: 0.5 }, lootTable: 'abyss_gorgon',
  abilities: [{ id: 'gaze', kind: 'gaze', name: 'Petrifying Gaze', cd: 9, windup: 1.4, range: 5, dur: 1.5 }, { id: 'venom_spit', kind: 'bolt', name: 'Venom Spit', cd: 4, windup: 0.8, range: 4, dmg: 0.8, damageKind: 'blight', inflict: { status: 'blighted', chance: 0.6, dur: 4 } }],
  desc: 'When it hisses GAZE, turn away (face another direction) or be petrified.', lore: 'Greek myth tells of the Gorgons; this one followed the Abyss here.' });
E('nephilim', { name: 'Nephilim', sprite: 'nephilim', category: 'elite', rank: 'elite', level: 43, hp: 1100, atk: [62, 80], def: 22, moveInterval: 1.3, windup: 1.25, recover: 1.5, hurtStun: 0.15, heavy: true, interruptible: false, xp: 1300, scale: 1.25, combatScale: 2.8, evasion: 0, darkFrac: 0.2, resist: { basic: 0.25, skill: -0.15 }, lootTable: 'abyss_nephilim', sunder: { chance: 0.6, dur: 4 },
  abilities: [{ id: 'giant_charge', kind: 'charge', name: 'Giant\'s Charge', cd: 10, windup: 1.4, length: 4, dmg: 1.2 }],
  desc: 'Armoured giant: basic attacks glance off (25% less), skills and Armour Break hurt it. Telegraphs a charge.', lore: 'The ancient texts mention giants of old; here they are the Abyss\'s first soldiers.' });
E('chimera', { name: 'Chimera', sprite: 'chimera', category: 'elite', rank: 'elite', level: 44, hp: 950, atk: [52, 68], def: 16, moveInterval: 0.9, windup: 0.9, recover: 1.1, heavy: true, interruptible: false, xp: 1250, scale: 0.9, combatScale: 3.2, evasion: 4, darkFrac: 0.3, statusRules: { stagger: 0.5 }, lootTable: 'abyss_chimera',
  abilities: [{ id: 'fire_breath', kind: 'charge', name: 'Fire Breath', cd: 8, windup: 1.2, length: 4, dmg: 1.0, noDash: true, damageKind: 'fire' }, { id: 'tail_sting', kind: 'nova', name: 'Serpent Tail', cd: 11, windup: 1.1, radius: 1, dmg: 0.9, damageKind: 'blight', inflict: { status: 'blighted', chance: 0.8, dur: 5 } }],
  desc: 'Three heads, three attacks: bite (guard), fire breath (step out of the line), tail (step away).', lore: 'Lion, goat and serpent - the myth\'s monster, remade by the Abyss.' });
// Chapter VI - the Last Revelation
E('locust', { name: 'Abyssal Locust', sprite: 'locust', category: 'common', level: 46, hp: 260, atk: [34, 44], def: 8, moveInterval: 0.45, windup: 0.4, recover: 0.7, xp: 380, scale: 0.5, combatScale: 4, evasion: 16, darkFrac: 0.3, lootTable: 'rev_locust',
  desc: 'Swarms. Hard to hit, easy to kill.', lore: 'Original creature, inspired by the locusts of the Abyss in Revelation.' });
E('fallen_seraph', { name: 'Fallen Seraph', sprite: 'seraph', category: 'uncommon', ai: 'ranged', level: 47, hp: 520, atk: [44, 58], def: 14, windup: 0.8, xp: 700, evasion: 10, darkFrac: 0.6, resist: { skill: 0.15 }, lootTable: 'rev_seraph',
  abilities: [{ id: 'judgement', kind: 'bolt', name: 'Burning Judgement', cd: 3.5, windup: 1.0, range: 6, dmg: 1.0, damageKind: 'fire' }, { id: 'hymn', kind: 'empower', name: 'Ruined Hymn', cd: 12, windup: 1.0, radius: 3, dur: 6 }],
  desc: 'Burns from afar and empowers allies. Skills do a little less.', lore: 'Original fiction: a guardian who looked into the Abyss and was not found wanting - only changed.' });
// support for boss summons
E('illusion', { name: 'Illusion of the Prophet', sprite: 'prophet', category: 'common', level: 44, hp: 1, atk: [0, 0], def: 0, xp: 0, illusion: true, windup: 0.9, desc: 'A false sign: one hit dispels it. It cannot hurt you.', lore: '' });
E('sentinel', { name: 'Deathless Sentinel', sprite: 'sentinel', rank: 'elite', level: 43, hp: 820, atk: [58, 76], def: 24, moveInterval: 1.35, windup: 1.25, recover: 1.5, hurtStun: 0.15, heavy: true, interruptible: false, darkFrac: 0.3, xp: 1100, scale: 1.15, combatScale: 3, lootTable: 'pale_sentinel', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', desc: 'It has never fallen. Armour Break and parries open it up.' });

// Phase 5 bestiary data for the Phase 1-4 roster (category + AI role + lore; combat stats unchanged).
const BESTIARY_EXTRA = {
  skeleton: { category: 'common', lore: 'Buried with their swords by order of the Ash King. They still follow orders.' },
  knight: { category: 'elite', lore: 'Knights of the First Seal who died at their post and stayed there.' },
  grave_crawler: { category: 'common', lore: 'Something that lives in graves and does not mind who else does.' },
  legionnaire: { category: 'common', lore: 'Soldiers of the Ninth, marching in circles around a war they lost.' },
  war_hound: { category: 'common', lore: 'Bred for the Red War. They outlived their masters and their purpose.' },
  executioner: { category: 'elite', lore: 'The army\'s discipline, given a body and an axe.' },
  thrall: { category: 'common', lore: 'Farmhands who ate the blighted grain because there was nothing else.' },
  stalker: { category: 'uncommon', lore: 'It follows the smell of the last harvest. You smell like the last harvest.' },
  harvester: { category: 'elite', lore: 'Husks shed by the thing in the reservoir. Each one is still hungry.' },
  revenant: { category: 'uncommon', lore: 'Souls stopped at the threshold, turned back, and angry about it.' },
  soulbound: { category: 'elite', lore: 'Knights who swore to guard the threshold forever, and were taken at their word.' },
  sentinel: { category: 'elite', lore: 'It has stood at the threshold since before the river had a ferryman.' },
};
for (const [id, extra] of Object.entries(BESTIARY_EXTRA)) Object.assign(ENEMIES[id], { ...extra, ...Object.fromEntries(Object.entries(ENEMIES[id]).filter(([k]) => k in extra)) });

// Variants reuse an archetype with modifiers (keeps the enemy roster to the 2 core types).
export const ENEMY_VARIANTS = {
  captain: { base: 'knight', name: 'Fallen Knight Captain', rank: 'boss', hpMult: 1.5, atkMult: 1.2, xpMult: 2.2, tint: '#ff2a1a', levelAdd: 2, darkFrac: 0.4, lootTable: 'captain' },
};
