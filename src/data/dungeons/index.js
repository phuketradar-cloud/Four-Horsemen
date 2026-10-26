import { DUNGEON_1 } from '../dungeon.js';
import ashen from './ashen_catacombs.js';
import warfront from './red_warfront.js';
import harvest from './black_harvest.js';
import pale from './pale_threshold.js';
import abyss from './abyssal_gate.js';
import revelation from './last_revelation.js';

// DungeonDefinition registry. Definitions are pure data; DungeonGenerator turns a definition +
// seed + floor + difficulty into a layout. New dungeons only need a new data file here.
//
// The Phase 1-3 "Crypt of the First Seal" is the hand-authored PROLOGUE: an `authored` layout
// that goes through the same DungeonManager, with its original Phase 1 completion rule.
export const PROLOGUE = {
  id: 'crypt_first_seal', name: 'CRYPT OF THE FIRST SEAL', order: 0, tier: 0, prologue: true,
  lore: 'Where every Horseman first wakes. A hand-built crypt guarding the First Seal.',
  description: 'The prologue (Phases 1-3). Clear the Chamber of the Seal to break it.',
  theme: { id: 'crypt', wall: [1, 1, 1], moss: 1, floor: [1, 1, 1], ceil: [1, 1, 1], vignette: '#460402', accent: '#d8b56d', torchColor: '#ff8a2a' },
  audio: { ambience: 'crypt', music: { root: 55, mode: 'minor', tempo: 1 } },
  recommended: [1, 6], enemyLevels: [2, 4], floors: 1, unlock: null,
  authored: DUNGEON_1, boss: null, completionXp: 150,
};

export const DUNGEONS = { [PROLOGUE.id]: PROLOGUE, [ashen.id]: ashen, [warfront.id]: warfront, [harvest.id]: harvest, [pale.id]: pale, [abyss.id]: abyss, [revelation.id]: revelation };
export const DUNGEON_ORDER = [PROLOGUE.id, ashen.id, warfront.id, harvest.id, pale.id, abyss.id, revelation.id];
export const PHASE4_DUNGEONS = [ashen.id, warfront.id, harvest.id, pale.id];
export const PHASE5_DUNGEONS = [abyss.id, revelation.id];
