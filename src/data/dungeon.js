// Dungeon 1: "The Crypt of the First Seal".
// Legend:
//  #  stone wall          T  wall with torch
//  .  floor               P  player start (floor)
//  D  wooden door         G  sealed gate (opens when its guarded room is cleared)
//  S  secret wall (looks like stone; LOOK / E reveals it)
//  C  chest (blocks movement, open with E)
//  k  Hollow Skeleton     K  Fallen Knight     B  Fallen Knight Captain (variant)
export const DUNGEON_1 = {
  id: 'crypt_first_seal',
  name: 'CRYPT OF THE FIRST SEAL',
  start: { dir: 1 }, // facing EAST
  map: [
    '###T################T###',
    '#.....############....C#',
    '#.....###T####T###.....#',
    '#.P...D..........D.....#',
    '#.....####.####.##.....#',
    '##########D####.########',
    '#######.......T.########',
    '##C...#.....k.#.########',
    '##....S...#...#D########',
    '##....#.k.....#.......##',
    '#######.......#.....k.##',
    '#######...k...T...K...##',
    '###############.......##',
    '###############.......##',
    '##################G#####',
    '##########T###T###.#####',
    '########.............###',
    '########.k...#...#...###',
    '########......B......###',
    '########.....#...#..k###',
    '########.............###',
    '#########T#####T########',
  ],
  rooms: [
    { id: 'start', name: 'STARTING CHAMBER', x1: 1, y1: 1, x2: 5, y2: 4, lore: 'You wake upon cold stone. The First Seal hums beneath your feet.' },
    { id: 'loot', name: 'RELIQUARY', x1: 18, y1: 1, x2: 22, y2: 4, lore: 'Offerings of the dead lie forgotten here.' },
    { id: 'combat', name: 'OSSUARY HALL', x1: 7, y1: 6, x2: 13, y2: 11, lore: 'Bones rattle in the dark. Something stirs.' },
    { id: 'secret', name: 'HIDDEN SHRINE', x1: 2, y1: 7, x2: 5, y2: 9, lore: 'A forgotten shrine to the Pale Rider. Whispers coil around a blade.' },
    { id: 'elite', name: 'HALL OF THE FALLEN', x1: 15, y1: 9, x2: 21, y2: 13, lore: 'A knight in blackened plate guards the sealed gate.' },
    { id: 'approach', name: 'SEALED PASSAGE', x1: 18, y1: 14, x2: 18, y2: 15, lore: 'The air grows heavy with ash.' },
    { id: 'final', name: 'CHAMBER OF THE SEAL', x1: 8, y1: 16, x2: 20, y2: 20, lore: 'The First Seal. Its guardians rise to meet you.' },
  ],
  defaultRoom: { id: 'corridor', name: 'MAIN CORRIDOR', lore: 'A long corridor of carved gothic stone, lit by guttering torches.' },
  gates: [{ x: 18, y: 14, requiresCleared: 'elite' }],
  clearRoom: 'final', // killing every enemy here clears the dungeon
  floorItems: [
    { x: 4, y: 1, item: 'health_potion', rarity: 'common' },
    { x: 19, y: 2, item: 'hunter_crossbow', rarity: 'common' },
    { x: 3, y: 8, item: 'cursed_dagger', rarity: 'rare' },
    { x: 13, y: 3, item: 'iron_shard', rarity: 'common', qty: 2 },
  ],
  level: 1, // dungeon level: drives enemy/chest item levels
  chests: [
    { x: 22, y: 1, table: 'chest_reliquary', level: 2 },
    { x: 2, y: 7, table: 'chest_secret', level: 3 },
  ],
  completionTable: 'dungeon_reward',
  spawnChars: { k: { type: 'skeleton' }, K: { type: 'knight' }, B: { type: 'knight', variant: 'captain' } },
};
