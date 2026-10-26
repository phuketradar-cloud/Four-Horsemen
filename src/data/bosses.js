// BossDefinition data (Phase 4). One generic BossEncounterController runs every boss; this file
// only describes them. A boss is also a normal enemy archetype (hp/atk/def/level/sprite/...), so
// marks, Armour Break, Withering, curses, DoTs, affixes and the boss per-hit cap all apply as usual.
//
// phases[]: entered when HP fraction <= at. onEnter actions run once. enrage multiplies speed/damage.
// attacks{}: kind
//   melee     adjacent heavy blow (telegraphed wind-up; guard/parry like any heavy blow)
//   area      danger tiles are marked on the floor for `windup` seconds, then hit whoever stands on them
//             shape: around (radius r) | line (toward the player, length) | cross | zones (count random tiles)
//   summon    raises `spawn` minions next to the boss (maxAlive / maxTotal caps; minions drop nothing)
//   barrier   applies a damage-reducing status; enough damage breaks it early and EXPOSES the boss
//   curse     channelled; deal `interrupt` damage during the channel to break it, else the player is Cursed
//   drain     channelled; standing within `radius` at the end drains class resource and some HP
//   hazard    switches the arena's spectral floor pattern (telegraphed before it activates)
// After attacks with `vulnerable` the boss is EXPOSED (+50% damage taken) for that many seconds.
// counterWindow: a perfect parry of the boss's heavy blow exposes it.
// difficultyAttacks: extra attacks added on Veteran/Nightmare (DIFFICULTIES.bossExtra).
// arena: hand-authored 7x7 room interior. B = boss, X = exit portal (sealed until victory),
//        # = pillar, ~ = spectral hazard tile (Pale Executor), . = floor.
export const BOSSES = {
  grave_warden: {
    id: 'grave_warden', name: 'The Grave Warden', title: 'GUARDIAN OF THE BURIAL SEAL', sprite: 'warden', rank: 'boss',
    lore: 'A massive undead guardian, chained to an ancient seal it no longer remembers.',
    level: 9, hp: 1100, atk: [20, 28], def: 5, moveInterval: 1.1, patrolInterval: 3, windup: 1.0, recover: 1.2, hurtStun: 0.15,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 600, scale: 1.3, combatScale: 2.5, evasion: 0, darkFrac: 0.2,
    lootTable: 'boss_grave_warden', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 0,
    phases: [
      { at: 1, name: 'THE WARDEN WAKES', attacks: ['cleave', 'slam'] },
      { at: 0.6, name: 'THE SEAL HOLDS', attacks: ['cleave', 'slam', 'summon', 'barrier'], onEnter: ['barrier'] },
      { at: 0.3, name: 'WRATH OF THE TOMB', attacks: ['cleave', 'slam', 'summon'], onEnter: ['summon'], enrage: { speed: 0.8, dmg: 1.15 } },
    ],
    attacks: {
      cleave: { kind: 'melee', name: 'Tomb Cleaver', windup: 1.0, dmg: 1, cd: 2.4, recover: 1.1 },
      slam: { kind: 'area', shape: 'around', radius: 1, name: 'Grave Slam', windup: 1.6, dmg: 1.35, cd: 8, recover: 2, vulnerable: 2.5, damageKind: 'physical' },
      summon: { kind: 'summon', name: 'Raise the Dead', windup: 1.3, cd: 16, spawn: 'skeleton', count: 2, maxAlive: 3, maxTotal: 6 },
      barrier: { kind: 'barrier', name: 'Seal of Bone', windup: 0.9, cd: 22, status: 'barrier', dur: 8, breakDamage: 110, exposeOnBreak: 3 },
      quake: { kind: 'area', shape: 'cross', radius: 3, name: 'Tomb Quake', windup: 1.5, dmg: 1.1, cd: 12, recover: 1.5, damageKind: 'physical' },
    },
    difficultyAttacks: { veteran: ['quake'], nightmare: ['quake'] },
    arena: ['.......', '.#...#.', '.......', '...B...', '.......', '.#...#.', '...X...'],
    unlockRecipes: ['wardens_bulwark', 'tempered_war_axe'],
    intro: 'Chains rattle. Something enormous rises from the burial seal.',
  },
  iron_tyrant: {
    id: 'iron_tyrant', name: 'The Iron Tyrant', title: 'WARLORD OF THE RED WARFRONT', sprite: 'tyrant', rank: 'boss',
    lore: 'A warlord in plate so thick that only a cracked guard or a broken armour can reach him.',
    level: 19, hp: 2600, atk: [38, 50], def: 10, moveInterval: 1.15, patrolInterval: 3, windup: 1.1, recover: 1.2, hurtStun: 0.12,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 1500, scale: 1.35, combatScale: 2.4, evasion: 0, darkFrac: 0.1,
    lootTable: 'boss_iron_tyrant', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', ironSkin: true, counterWindow: 2.5,
    phases: [
      { at: 1, name: 'THE TYRANT MARCHES', attacks: ['sweep', 'groundSlam', 'charge'] },
      { at: 0.65, name: 'CALL THE GUARD', attacks: ['sweep', 'groundSlam', 'charge', 'summon'], onEnter: ['summon'] },
      { at: 0.3, name: 'NO RETREAT', attacks: ['sweep', 'groundSlam', 'charge', 'summon'], enrage: { speed: 0.75, dmg: 1.2 } },
    ],
    attacks: {
      sweep: { kind: 'melee', name: 'Frontal Sweep', windup: 1.1, dmg: 1, cd: 2.2, recover: 1.2 },
      groundSlam: { kind: 'area', shape: 'around', radius: 2, name: 'Ground Slam', windup: 1.7, dmg: 1.3, cd: 9, recover: 2.2, vulnerable: 3.5, damageKind: 'physical' },
      charge: { kind: 'area', shape: 'line', length: 5, name: 'Tyrant Charge', windup: 1.4, dmg: 1.2, cd: 11, recover: 1.5, dash: true, damageKind: 'physical' },
      summon: { kind: 'summon', name: 'Call the Guard', windup: 1.3, cd: 18, spawn: 'legionnaire', count: 2, maxAlive: 2, maxTotal: 4 },
      warcry: { kind: 'barrier', name: 'Iron Will', windup: 1, cd: 25, status: 'barrier', dur: 6, breakDamage: 260, exposeOnBreak: 3 },
    },
    difficultyAttacks: { veteran: ['warcry'], nightmare: ['warcry'] },
    arena: ['.......', '.......', '..#.#..', '...B...', '..#.#..', '.......', '...X...'],
    unlockRecipes: ['tyrant_crown'],
    intro: 'Iron grinds on iron. "KNEEL," says the Tyrant.',
  },
  hollow_harvester: {
    id: 'hollow_harvester', name: 'The Hollow Harvester', title: 'THE HUNGER IN THE RESERVOIR', sprite: 'harvesterBoss', rank: 'boss',
    lore: 'A corrupted entity that drains vitality and spreads Withering. Its core shows when its blight misses.',
    level: 33, hp: 4800, atk: [56, 72], def: 14, moveInterval: 1.0, patrolInterval: 3, windup: 1.0, recover: 1.1, hurtStun: 0.12,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 3200, scale: 1.35, combatScale: 2.4, evasion: 0, darkFrac: 0.45,
    lootTable: 'boss_hollow_harvester', deathSfx: 'boneDeath', attackSfx: 'enemyHeavy', counterWindow: 0,
    phases: [
      { at: 1, name: 'THE FIELDS WITHER', attacks: ['reap', 'blightZones', 'drain'] },
      { at: 0.6, name: 'THE HUNGER GROWS', attacks: ['reap', 'blightZones', 'drain', 'summon'], onEnter: ['summon'] },
      { at: 0.3, name: 'NOTHING REMAINS', attacks: ['reap', 'blightZones', 'drain', 'summon'], enrage: { speed: 0.8, dmg: 1.2 } },
    ],
    attacks: {
      reap: { kind: 'melee', name: 'Reaping Scythe', windup: 1.0, dmg: 1, cd: 2.4, recover: 1.1, inflict: { status: 'blighted', chance: 0.6, dur: 6 } },
      blightZones: { kind: 'area', shape: 'zones', count: 6, name: 'Blight Bloom', windup: 1.6, dmg: 0.9, cd: 8, recover: 1.4, damageKind: 'blight', inflict: { status: 'blighted', chance: 1, dur: 6 }, exposeIfMissed: 4 },
      drain: { kind: 'drain', name: 'Vital Drain', windup: 2.0, radius: 2, resourcePct: 0.35, hpPct: 0.08, healCapPct: 0.03, cd: 14, recover: 1.2 },
      summon: { kind: 'summon', name: 'Sow the Thralls', windup: 1.3, cd: 18, spawn: 'thrall', count: 2, maxAlive: 2, maxTotal: 4 },
      bloom: { kind: 'area', shape: 'around', radius: 2, name: 'Rot Nova', windup: 1.5, dmg: 1.1, cd: 12, recover: 1.5, damageKind: 'blight', inflict: { status: 'blighted', chance: 1, dur: 5 } },
    },
    difficultyAttacks: { veteran: ['bloom'], nightmare: ['bloom'] },
    arena: ['.......', '.......', '.......', '...B...', '.......', '.......', '...X...'],
    unlockRecipes: ['harvester_sickle', 'purifying_draught'],
    intro: 'The reservoir drains in a single breath. The Hollow Harvester unfolds.',
  },
  pale_executor: {
    id: 'pale_executor', name: 'The Pale Executor', title: 'JUDGE OF THE FINAL THRESHOLD', sprite: 'executor', rank: 'boss',
    lore: 'An ancient deathly champion who judges all who would cross. Parry its scythe to answer its judgement.',
    level: 48, hp: 8800, atk: [80, 104], def: 20, moveInterval: 1.0, patrolInterval: 3, windup: 1.1, recover: 1.1, hurtStun: 0.1,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 6000, scale: 1.4, combatScale: 2.3, evasion: 0, darkFrac: 0.6,
    lootTable: 'boss_pale_executor', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 3.5,
    phases: [
      { at: 1, name: 'THE JUDGEMENT BEGINS', attacks: ['scythe', 'reapLine', 'curse'] },
      { at: 0.65, name: 'THE THRESHOLD SHIFTS', attacks: ['scythe', 'reapLine', 'curse', 'hazardShift', 'summon'], onEnter: ['hazardShift', 'summon'] },
      { at: 0.3, name: 'FINAL SENTENCE', attacks: ['scythe', 'reapLine', 'curse', 'hazardShift', 'summon', 'sweepAll'], enrage: { speed: 0.78, dmg: 1.2 } },
    ],
    attacks: {
      scythe: { kind: 'melee', name: 'Executioner Scythe', windup: 1.1, dmg: 1, cd: 2.3, recover: 1.1 },
      reapLine: { kind: 'area', shape: 'line', length: 6, name: 'Reaping Line', windup: 1.4, dmg: 1.15, cd: 9, recover: 1.6, vulnerable: 2, damageKind: 'dark' },
      curse: { kind: 'curse', name: 'Sentence of Death', windup: 2.2, interrupt: 0.05, dur: 10, cd: 15, recover: 1 },
      hazardShift: { kind: 'hazard', name: 'The Threshold Shifts', windup: 1.6, cd: 14, recover: 0.6 },
      summon: { kind: 'summon', name: 'Spectral Court', windup: 1.3, cd: 20, spawn: 'revenant', count: 2, maxAlive: 2, maxTotal: 4 },
      sweepAll: { kind: 'area', shape: 'around', radius: 2, name: 'Final Sweep', windup: 1.6, dmg: 1.3, cd: 12, recover: 2, vulnerable: 2.5, damageKind: 'dark' },
      soulStorm: { kind: 'area', shape: 'zones', count: 8, name: 'Soul Storm', windup: 1.5, dmg: 0.9, cd: 11, recover: 1.2, damageKind: 'dark', inflict: { status: 'cursed', chance: 0.5, dur: 6 } },
    },
    difficultyAttacks: { veteran: ['soulStorm'], nightmare: ['soulStorm'] },
    // spectral tiles alternate between pattern A (~ tiles) and pattern B (the other floor tiles of the ring)
    arena: ['~.~.~.~', '.......', '~.....~', '...B...', '~.....~', '.......', '~.~X~.~'],
    unlockRecipes: ['executors_verdict', 'apocalyptic_relic'],
    intro: 'The scales of the threshold turn. "Who would cross?"',
    hazardRingB: true,
  },

  // ================================================================ Phase 5
  // category: miniboss (guards a floor's key room, rewards once, never opens the exit) |
  //           chapterBoss | endgameBoss. New attack kinds / options:
  //   melee.hits   several quick strikes in a row (each guardable), then the listed recover
  //   area.shape 'cone'  widening wedge in front (dragon breath)
  //   empower      buffs every summoned ally (EMPOWERED)
  //   illusion     conjures harmless decoys (1 HP, "ILLUSION" in their name)
  gravekeeper: {
    id: 'gravekeeper', name: 'The Gravekeeper', title: 'MINIBOSS - KEEPER OF THE FIRST GRAVES', sprite: 'gravekeeper', rank: 'boss', miniboss: true, category: 'miniboss',
    lore: 'He buried the first of the dead and refuses to stop.',
    level: 6, hp: 520, atk: [12, 17], def: 4, moveInterval: 1.1, patrolInterval: 3, windup: 1.0, recover: 1.1, hurtStun: 0.15,
    detectRange: 6, loseTime: 999, heavy: true, interruptible: false, xp: 260, scale: 1.15, combatScale: 2.8, evasion: 0, darkFrac: 0.2,
    lootTable: 'boss_gravekeeper', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 0,
    phases: [
      { at: 1, name: 'THE SHOVEL FALLS', attacks: ['shovel', 'grave'] },
      { at: 0.5, name: 'THE DEAD DIG UP', attacks: ['shovel', 'grave', 'summon'], onEnter: ['summon'], enrage: { speed: 0.85, dmg: 1.1 } },
    ],
    attacks: {
      shovel: { kind: 'melee', name: 'Grave Shovel', windup: 1.0, dmg: 1, cd: 2.4, recover: 1.1 },
      grave: { kind: 'area', shape: 'cross', radius: 2, name: 'Open Graves', windup: 1.5, dmg: 1.1, cd: 9, recover: 1.6, vulnerable: 2.5, damageKind: 'physical' },
      summon: { kind: 'summon', name: 'Wake the Buried', windup: 1.3, cd: 18, spawn: 'grave_crawler', count: 2, maxAlive: 2, maxTotal: 4 },
    },
    unlockRecipes: [],
    intro: 'A hunched figure leans on a shovel taller than a man. "Another one for the ground."',
  },
  cerberus: {
    id: 'cerberus', name: 'Cerberus', title: 'MINIBOSS - THREE-HEADED WARDEN OF THE GATE', sprite: 'cerberus', rank: 'boss', miniboss: true, category: 'miniboss',
    lore: 'Greek myth tells of the hound at the gate of the dead. This one guards a different gate.',
    level: 42, hp: 3800, atk: [48, 62], def: 16, moveInterval: 0.8, patrolInterval: 3, windup: 0.8, recover: 1.0, hurtStun: 0.12,
    detectRange: 7, loseTime: 999, heavy: true, interruptible: false, xp: 2600, scale: 1.0, combatScale: 2.8, evasion: 4, darkFrac: 0.3,
    lootTable: 'boss_cerberus', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 2.5, statusRules: { starved: 0.5 },
    phases: [
      { at: 1, name: 'THREE HUNGERS', attacks: ['tripleBite', 'howl'] },
      { at: 0.5, name: 'THE GATE MUST HOLD', attacks: ['tripleBite', 'howl', 'pounce'], enrage: { speed: 0.8, dmg: 1.15 } },
    ],
    attacks: {
      tripleBite: { kind: 'melee', name: 'Triple Bite', windup: 0.9, dmg: 0.75, hits: 3, gap: 0.45, cd: 3.2, recover: 1.8, vulnerable: 2.5 },
      howl: { kind: 'area', shape: 'around', radius: 2, name: 'Hellhound Howl', windup: 1.5, dmg: 0.9, cd: 10, recover: 1.4, damageKind: 'dark' },
      pounce: { kind: 'area', shape: 'line', length: 5, name: 'Pounce', windup: 1.3, dmg: 1.1, cd: 9, recover: 1.5, dash: true, damageKind: 'physical' },
    },
    unlockRecipes: [],
    intro: 'Three heads lift at once. Three growls, one voice.',
  },
  false_prophet: {
    id: 'false_prophet', name: 'The False Prophet', title: 'MINIBOSS - VOICE OF FALSE SIGNS', sprite: 'prophet', rank: 'boss', miniboss: true, category: 'miniboss',
    lore: 'Revelation names a false prophet who works deceiving signs. Here he leads the Beast\'s cult (original game fiction).',
    level: 44, hp: 3000, atk: [44, 58], def: 12, moveInterval: 1.0, patrolInterval: 3, windup: 1.0, recover: 1.1, hurtStun: 0.15,
    detectRange: 7, loseTime: 999, heavy: true, interruptible: false, xp: 2600, scale: 1.1, combatScale: 2.8, evasion: 6, darkFrac: 0.6,
    lootTable: 'boss_false_prophet', deathSfx: 'boneDeath', attackSfx: 'enemyHeavy', counterWindow: 0, resist: { skill: 0.1 },
    phases: [
      { at: 1, name: 'FALSE SIGNS', attacks: ['staff', 'illusions', 'sign'] },
      { at: 0.5, name: 'THE GREAT LIE', attacks: ['staff', 'illusions', 'sign', 'curse'], onEnter: ['illusions'], enrage: { speed: 0.85, dmg: 1.1 } },
    ],
    attacks: {
      staff: { kind: 'melee', name: 'Serpent Staff', windup: 1.0, dmg: 1, cd: 2.4, recover: 1.1 },
      illusions: { kind: 'illusion', name: 'False Signs', windup: 1.2, cd: 14, count: 2, maxAlive: 3 },
      sign: { kind: 'area', shape: 'zones', count: 5, name: 'Burning Sign', windup: 1.5, dmg: 0.9, cd: 8, recover: 1.2, damageKind: 'dark', exposeIfMissed: 3 },
      curse: { kind: 'curse', name: 'Word of Deceit', windup: 2.0, interrupt: 0.05, dur: 8, cd: 15, recover: 1 },
    },
    unlockRecipes: [],
    intro: '"Look," he says, and there are suddenly three of him.',
  },
  the_beast: {
    id: 'the_beast', name: 'The Beast', title: 'CHAPTER V - THE TYRANT FROM THE ABYSS', sprite: 'beast', rank: 'boss', category: 'chapterBoss',
    lore: 'Revelation\'s Beast rises from the sea; ours climbed out of the Abyss. Command, corruption, and a shell that must be cracked.',
    level: 46, hp: 9200, atk: [74, 96], def: 22, moveInterval: 1.15, patrolInterval: 3, windup: 1.15, recover: 1.2, hurtStun: 0.1,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 7000, scale: 1.45, combatScale: 2.3, evasion: 0, darkFrac: 0.4,
    lootTable: 'boss_the_beast', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 2, statusRules: { stagger: 'immune' }, resist: { basic: 0.1 },
    phases: [
      { at: 1, name: 'THE BEAST COMMANDS', attacks: ['maul', 'command', 'summon', 'corruption'] },
      { at: 0.6, name: 'CARAPACE OF THE ABYSS', attacks: ['maul', 'corruption', 'summon', 'command', 'carapace'], onEnter: ['carapace'] },
      { at: 0.3, name: 'SEVEN HEADS, ONE HUNGER', attacks: ['maul', 'corruption', 'summon', 'command', 'trample'], enrage: { speed: 0.78, dmg: 1.2 } },
    ],
    attacks: {
      maul: { kind: 'melee', name: 'Maul', windup: 1.15, dmg: 1, cd: 2.4, recover: 1.2 },
      command: { kind: 'empower', name: 'Command the Horde', windup: 1.0, cd: 12, recover: 0.6 },
      summon: { kind: 'summon', name: 'Call the Abyss', windup: 1.3, cd: 16, spawn: 'abyssal_beast', count: 2, maxAlive: 2, maxTotal: 6 },
      corruption: { kind: 'area', shape: 'zones', count: 7, name: 'Corruption', windup: 1.6, dmg: 0.9, cd: 9, recover: 1.2, damageKind: 'dark', inflict: { status: 'cursed', chance: 0.6, dur: 6 } },
      carapace: { kind: 'barrier', name: 'Abyssal Carapace', windup: 1.0, cd: 24, status: 'barrier', dur: 9, breakDamage: 900, exposeOnBreak: 4 },
      trample: { kind: 'area', shape: 'line', length: 6, name: 'Trample', windup: 1.4, dmg: 1.2, cd: 10, recover: 1.8, dash: true, vulnerable: 2.5, damageKind: 'physical' },
    },
    difficultyAttacks: { veteran: ['trample'], nightmare: ['trample'] },
    arena: ['.......', '.#...#.', '.......', '...B...', '.......', '.#...#.', '...X...'],
    unlockRecipes: [],
    intro: 'The ground heaves. A crowned shape with too many heads rises from the pit.',
  },
  great_dragon: {
    id: 'great_dragon', name: 'The Great Dragon', title: 'MINIBOSS - THE RED SERPENT OF THE END', sprite: 'dragon', rank: 'boss', miniboss: true, category: 'miniboss',
    lore: 'Revelation\'s great red dragon, as this game imagines it: spectral fire, a sweeping tail and wings that call the swarm.',
    level: 48, hp: 9800, atk: [78, 100], def: 20, moveInterval: 1.2, patrolInterval: 3, windup: 1.2, recover: 1.2, hurtStun: 0.1,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 8000, scale: 1.5, combatScale: 2.2, evasion: 0, darkFrac: 0.5,
    lootTable: 'boss_great_dragon', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 2.5, resist: { dot: 0.25 },
    phases: [
      { at: 1, name: 'THE SERPENT STIRS', attacks: ['claw', 'breath', 'tail'] },
      { at: 0.55, name: 'WINGS OF THE END', attacks: ['claw', 'breath', 'tail', 'wings', 'summon'], onEnter: ['wings'], enrage: { speed: 0.82, dmg: 1.15 } },
    ],
    attacks: {
      claw: { kind: 'melee', name: 'Rending Claw', windup: 1.1, dmg: 1, hits: 2, gap: 0.5, cd: 2.8, recover: 1.4 },
      breath: { kind: 'area', shape: 'cone', length: 4, name: 'Spectral Flame', windup: 1.6, dmg: 1.15, cd: 8, recover: 1.8, vulnerable: 2.5, damageKind: 'dark' },
      tail: { kind: 'area', shape: 'around', radius: 1, name: 'Tail Sweep', windup: 1.3, dmg: 1.0, cd: 7, recover: 1.2, damageKind: 'physical' },
      wings: { kind: 'area', shape: 'zones', count: 8, name: 'Wingstorm', windup: 1.5, dmg: 0.85, cd: 10, recover: 1.2, damageKind: 'dark' },
      summon: { kind: 'summon', name: 'Call the Swarm', windup: 1.3, cd: 18, spawn: 'locust', count: 2, maxAlive: 2, maxTotal: 4 },
    },
    unlockRecipes: [],
    intro: 'Red scales fill the hall from wall to wall. Its breath is pale fire.',
  },
  abaddon: {
    id: 'abaddon', name: 'Abaddon, the Destroyer', title: 'ENDGAME - THE ANGEL OF THE BOTTOMLESS PIT', sprite: 'abaddon', rank: 'boss', category: 'endgameBoss',
    lore: 'In Revelation, Abaddon (Apollyon) is king of the Abyss. In this story he is the hand that broke the seals - original fiction built on that name.',
    level: 50, hp: 13500, atk: [88, 112], def: 24, moveInterval: 1.05, patrolInterval: 3, windup: 1.15, recover: 1.1, hurtStun: 0.1,
    detectRange: 8, loseTime: 999, heavy: true, interruptible: false, xp: 15000, scale: 1.5, combatScale: 2.2, evasion: 0, darkFrac: 0.6,
    lootTable: 'boss_abaddon', deathSfx: 'armorDeath', attackSfx: 'enemyHeavy', counterWindow: 3, statusRules: { starved: 'immune' },
    phases: [
      { at: 1, name: 'THE DESTROYER', attacks: ['blade', 'locusts', 'rift'] },
      { at: 0.75, name: 'THE BOTTOMLESS PIT', attacks: ['blade', 'locusts', 'rift', 'pit', 'summon'], onEnter: ['pit', 'summon'] },
      { at: 0.45, name: 'THE BROKEN SEALS', attacks: ['blade', 'locusts', 'rift', 'pit', 'curse', 'drain', 'ward'], onEnter: ['ward'] },
      { at: 0.2, name: 'THE LAST REVELATION', attacks: ['blade', 'locusts', 'rift', 'pit', 'curse', 'drain', 'summon'], enrage: { speed: 0.75, dmg: 1.2 } },
    ],
    attacks: {
      blade: { kind: 'melee', name: "Destroyer's Blade", windup: 1.15, dmg: 1, cd: 2.4, recover: 1.1 },
      locusts: { kind: 'area', shape: 'zones', count: 8, name: 'Locust Swarm', windup: 1.6, dmg: 0.85, cd: 8, recover: 1.2, damageKind: 'dark', exposeIfMissed: 3 },
      rift: { kind: 'area', shape: 'cross', radius: 3, name: 'Abyssal Rift', windup: 1.5, dmg: 1.15, cd: 9, recover: 1.6, vulnerable: 2.5, damageKind: 'dark' },
      pit: { kind: 'hazard', name: 'The Pit Opens', windup: 1.6, cd: 13, recover: 0.6 },
      summon: { kind: 'summon', name: 'Locusts of the Pit', windup: 1.3, cd: 18, spawn: 'locust', count: 2, maxAlive: 2, maxTotal: 6 },
      curse: { kind: 'curse', name: 'Ruin', windup: 2.0, interrupt: 0.04, dur: 10, cd: 14, recover: 1 },
      drain: { kind: 'drain', name: 'Unmaking', windup: 2.0, radius: 2, resourcePct: 0.3, hpPct: 0.08, healCapPct: 0.02, cd: 15, recover: 1.2 },
      ward: { kind: 'barrier', name: 'Seal of the Abyss', windup: 1.0, cd: 26, status: 'barrier', dur: 8, breakDamage: 1300, exposeOnBreak: 4 },
    },
    difficultyAttacks: { veteran: ['curse'], nightmare: ['curse', 'drain'] },
    arena: ['~.~.~.~', '.......', '~.#.#.~', '...B...', '~.#.#.~', '.......', '~.~X~.~'],
    hazardRingB: true,
    unlockRecipes: [],
    intro: 'Wings like torn night. A crown of locusts. "I opened the seals. I will close the world."',
  },
};
