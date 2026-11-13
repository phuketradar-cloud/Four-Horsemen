// Painted dungeon scenery. A set replaces the drawn wall / door / floor / ceiling of the dungeon
// themes listed in `themes` (theme ids from data/dungeons/*.js) with the paintings in assets/scenes/.
// Any square size works; images are scaled down to the texture size when they load.
//   wall:    seamless brick face - also the stone behind torches, levers, runes, hidden switches
//            and secret walls, so those blend into the painted wall
//   door:    the whole door face (frame included)
//   floor / ceiling: one dungeon cell, seen from above / below (tiles across cells)
// A part without a file keeps its drawn texture. Theme colour multipliers still apply on top,
// unless the set says tint: false (paintings already in the dungeon's colours).
export const SCENE_ART_BASE = 'assets/scenes/';
export const SCENE_TEX_SIZE = 256; // painted wall/door texture size (drawn textures stay 64 and are scaled)

export const SCENE_ART = {
  ashen: {
    themes: ['ashen', 'crypt'], // Ashen Catacombs + the Crypt of the First Seal
    wall: 'ashen_wall.jpg', door: 'ashen_door.jpg', floor: 'ashen_floor.jpg', ceiling: 'ashen_ceiling.jpg',
  },
  warfront: {
    themes: ['warfront'], tint: false, // The Red Warfront: the paintings are already red
    wall: 'warfront_wall.jpg', door: 'warfront_door.jpg', floor: 'warfront_floor.jpg', ceiling: 'warfront_ceiling.jpg',
  },
  harvest: {
    themes: ['harvest'], tint: false, // The Black Harvest: the yellow mold and black roots carry the theme (tinted it turns olive)
    wall: 'harvest_wall.jpg', door: 'harvest_door.jpg', floor: 'harvest_floor.jpg', ceiling: 'harvest_ceiling.jpg',
  },
  pale: {
    themes: ['pale'], tint: false, // The Pale Threshold: pale marble, already cold blue
    wall: 'pale_wall.jpg', door: 'pale_door.jpg', floor: 'pale_floor.jpg', ceiling: 'pale_ceiling.jpg',
  },
  abyss: {
    themes: ['abyss'], tint: false, // The Abyssal Gate: violet basalt, already purple
    wall: 'abyss_wall.jpg', door: 'abyss_door.jpg', floor: 'abyss_floor.jpg', ceiling: 'abyss_ceiling.jpg',
  },
  revelation: {
    themes: ['revelation'], tint: false, // The Last Revelation: crimson stone with molten cracks
    wall: 'revelation_wall.jpg', door: 'revelation_door.jpg', floor: 'revelation_floor.jpg', ceiling: 'revelation_ceiling.jpg',
  },
};
