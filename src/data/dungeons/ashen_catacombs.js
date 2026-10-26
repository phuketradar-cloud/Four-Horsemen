// DUNGEON I — THE ASHEN CATACOMBS (reference dungeon). Pure data: DungeonGenerator reads it.
export default {
  id: 'ashen_catacombs', name: 'THE ASHEN CATACOMBS', order: 1, tier: 1,
  lore: 'Ancient burial chambers beneath the First Seal. Cracked stone, dust and bones, faded inscriptions and rusted gates.',
  description: 'Undead guard the burial seal. Learn to read telegraphs, find the hidden tombs and face the Grave Warden.',
  theme: {
    id: 'ashen', wall: [1.0, 0.97, 0.9], moss: 0.5, floor: [1.0, 0.95, 0.85], ceil: [0.95, 0.9, 0.85], vignette: '#460402',
    accent: '#d8ccb0', torchColor: '#ff8a2a',
  },
  audio: { ambience: 'crypt', music: { root: 55, mode: 'minor', tempo: 0.9 } }, // procedural (no copyrighted audio)
  recommended: [1, 10], enemyLevels: [2, 8], floors: 2,
  unlock: null, // available from the start
  generation: { cols: 4, rows: 3, cellSize: 10, mainPath: [5, 6], branches: [3, 4], roomSize: [3, 6], loops: 1, narrowChance: 0.3 },
  // Encounter groups (weights). Types are enemy archetypes; loot = per-dungeon table.
  enemies: {
    skeleton: { loot: 'ashen_skeleton' }, grave_crawler: { loot: 'ashen_crawler' }, knight: { loot: 'ashen_knight' },
  },
  encounters: {
    combat: [{ w: 4, group: ['skeleton', 'skeleton'] }, { w: 3, group: ['skeleton', 'grave_crawler'] }, { w: 2, group: ['grave_crawler', 'grave_crawler', 'grave_crawler'] }],
    nest: [{ w: 1, group: ['grave_crawler', 'grave_crawler', 'grave_crawler', 'skeleton'] }],
    elite: [{ w: 1, group: ['knight', 'skeleton'] }, { w: 1, group: ['knight', 'grave_crawler'] }],
    challenge: [{ w: 1, group: ['knight', 'knight', 'skeleton'] }],
  },
  rooms: {
    start: { names: ['Starting Chamber'], lore: ['Cold stone and the smell of old ash. The burial seal hums far below.'] },
    combat: { names: ['Burial Room', 'Narrow Corridor', 'Ossuary'], lore: ['Niches of bones line the walls.', 'Something scrapes in the dark ahead.'] },
    nest: { names: ['Monster Nest'], lore: ['The floor writhes with crawling things.'] },
    elite: { names: ['Hall of the Fallen'], lore: ['A knight in rusted plate keeps a vigil that never ended.'] },
    treasure: { names: ['Loot Chamber'], lore: ['Grave goods, untouched for centuries.'] },
    secret: { names: ['Secret Tomb'], lore: ['A tomb no map remembers.'] },
    puzzle: { names: ['Rune Crypt'], lore: ['Three runes are carved into the walls. An inscription gives their order.'] },
    trap: { names: ['Collapsed Ossuary'], lore: ['The floor is cracked and the walls bristle with spikes.'] },
    rest: { names: ['Quiet Chapel'], lore: ['A small chapel where the dead do not walk. A blessed font still flows.'] },
    challenge: { names: ['Knight Barracks'], lore: ['Optional: a garrison of fallen knights. Victory is well rewarded.'] },
    stairs: { names: ['The Descent'], lore: ['Worn stairs lead deeper into the catacombs.'] },
    boss: { names: ["The Warden's Seal"], lore: ['A vast round chamber around a cracked burial seal.'] },
    class: { names: ['Sealed Tomb'], lore: ['A tomb sealed in a way only some can open.'] },
  },
  hazards: { trap: ['spikes', 'collapse'], ambient: ['spikes'] },
  puzzles: ['runes', 'plates'],
  progression: { floorGate: 'guardian', bossGate: 'runes' }, // floor 1 stairs: guardian; floor 2 boss gate: rune puzzle
  tables: { chest: 'ashen_chest', secret: 'ashen_secret', completion: 'ashen_reward', classCache: 'class_cache' },
  boss: 'grave_warden',
  minibosses: { 0: 'gravekeeper' }, // Phase 5: the grave guardian miniboss holds floor 1's gate
  lorePool: ['ashen_1', 'ashen_2', 'ashen_3', 'ashen_4'],
  secretRooms: [1, 2], // per floor
  completionXp: 250,
  secretRecipes: ['brew_greater_potion'], // recipe scrolls found in secret rooms (once per save)
};
