// Adaptive music (Phase 6). Every track is ORIGINAL and SYNTHESIZED at runtime by audio/MusicEngine.js
// (no audio files, no licensing). These are temporary/procedural tracks, listed in the README asset
// manifest. A state = tempo + mode + layered patterns; the engine crossfades between states.
//
// Pattern functions get (step 0..15, bar, rnd) and return note events:
//   { inst, deg | semi, oct, len (steps), vel }   deg = scale degree (0-based), semi = raw semitone
// Instruments: pad, choir, bass, bell, stab, kick, snare, hat, drone
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
};

const chord = (deg, inst = 'pad', len = 16, vel = 0.5, oct = 1) => [
  { inst, deg, oct, len, vel }, { inst, deg: deg + 2, oct, len, vel: vel * 0.8 }, { inst, deg: deg + 4, oct, len, vel: vel * 0.7 },
];

export const MUSIC_STATES = {
  // menus / title: slow minor chorale with a distant bell
  title: { tempo: 58, mode: 'minor', root: 55, fade: 2.5, gain: 0.9, pattern: (s, bar, rnd) => {
    const prog = [0, 5, 3, 4][bar % 4];
    const out = s === 0 ? [...chord(prog, 'choir', 16, 0.45)] : [];
    if (s === 0 || s === 8) out.push({ inst: 'bass', deg: prog, oct: -1, len: 8, vel: 0.5 });
    if (rnd() < 0.1) out.push({ inst: 'bell', deg: [0, 2, 4, 6][Math.floor(rnd() * 4)], oct: 2, len: 6, vel: 0.25 });
    return out;
  } },
  // dungeon exploration: tuned to the dungeon (root/mode come from its audio block)
  explore: { tempo: 64, fade: 2.5, gain: 0.75, pattern: (s, bar, rnd) => {
    const prog = [0, 0, 5, 4][bar % 4];
    const out = s === 0 ? [...chord(prog, 'pad', 16, 0.4)] : [];
    if (s === 0) out.push({ inst: 'bass', deg: prog, oct: -1, len: 12, vel: 0.45 });
    if (s % 4 === 2 && rnd() < 0.14) out.push({ inst: 'bell', deg: Math.floor(rnd() * 7), oct: 2, len: 4, vel: 0.18 });
    return out;
  } },
  // ordinary combat: driving ostinato + drums
  combat: { tempo: 116, fade: 0.8, gain: 0.85, pattern: (s, bar) => {
    const prog = [0, 0, 5, 6][bar % 4];
    const out = s === 0 ? [...chord(prog, 'pad', 16, 0.3)] : [];
    if (s % 2 === 0) out.push({ inst: 'bass', deg: s % 8 === 6 ? prog + 4 : prog, oct: -1, len: 2, vel: 0.5 });
    if (s === 0 || s === 8 || s === 10) out.push({ inst: 'kick', vel: 0.7 });
    if (s === 4 || s === 12) out.push({ inst: 'snare', vel: 0.45 });
    if (s % 2 === 1) out.push({ inst: 'hat', vel: 0.18 });
    return out;
  } },
  // elites / minibosses: combat + brass-like stabs
  elite: { tempo: 124, fade: 0.8, gain: 0.9, pattern: (s, bar) => {
    const prog = [0, 6, 5, 4][bar % 4];
    const out = s === 0 ? [...chord(prog, 'pad', 16, 0.3)] : [];
    if (s % 2 === 0) out.push({ inst: 'bass', deg: prog, oct: -1, len: 2, vel: 0.55 });
    if ([0, 3, 6, 10].includes(s)) out.push(...chord(prog, 'stab', 2, 0.32));
    if (s === 0 || s === 6 || s === 8) out.push({ inst: 'kick', vel: 0.75 });
    if (s === 4 || s === 12) out.push({ inst: 'snare', vel: 0.5 });
    if (s % 2 === 1) out.push({ inst: 'hat', vel: 0.2 });
    return out;
  } },
  // bosses: distinct from combat - tritone ostinato, choir, heavier drums
  boss: { tempo: 132, mode: 'phrygian', fade: 0.6, gain: 1, pattern: (s, bar) => {
    const out = [];
    if (s === 0) out.push({ inst: 'choir', semi: 0, oct: 1, len: 16, vel: 0.35 }, { inst: 'choir', semi: 3, oct: 1, len: 16, vel: 0.3 }, { inst: 'choir', semi: bar % 2 ? 6 : 7, oct: 1, len: 16, vel: 0.3 });
    const ost = [0, 0, 1, 0, 6, 0, 1, 3];
    if (s % 2 === 0) out.push({ inst: 'bass', semi: ost[(s / 2) % 8], oct: -1, len: 2, vel: 0.6 });
    if ([0, 3, 8, 11].includes(s)) out.push({ inst: 'kick', vel: 0.85 });
    if (s === 4 || s === 12) out.push({ inst: 'snare', vel: 0.55 });
    if (s === 14 && bar % 2) out.push({ inst: 'snare', vel: 0.35 });
    if (s % 2 === 1) out.push({ inst: 'hat', vel: 0.22 });
    if (s === 0 && bar % 4 === 3) out.push({ inst: 'stab', semi: 6, oct: 1, len: 4, vel: 0.35 });
    return out;
  } },
  // safe rooms (fonts / rest) and the Last Sanctuary camp: warm, gentle arpeggio
  safe: { tempo: 56, mode: 'dorian', fade: 2, gain: 0.7, pattern: (s, bar) => {
    const prog = [0, 3, 5, 4][bar % 4];
    const out = s === 0 ? [...chord(prog, 'pad', 16, 0.32)] : [];
    if (s % 2 === 0) out.push({ inst: 'bell', deg: prog + [0, 2, 4, 7, 4, 2, 0, 2][(s / 2) % 8], oct: 1, len: 3, vel: 0.16 });
    if (s === 0) out.push({ inst: 'bass', deg: prog, oct: -1, len: 16, vel: 0.3 });
    return out;
  } },
  sanctuary: { tempo: 54, mode: 'dorian', root: 65, fade: 2, gain: 0.7, alias: 'safe' },
  // chapter title cards / story beats
  story: { tempo: 48, mode: 'minor', root: 49, fade: 1.5, gain: 0.85, pattern: (s, bar) => {
    const prog = [0, 5, 2, 4][bar % 4];
    const out = s === 0 ? [...chord(prog, 'choir', 16, 0.42)] : [];
    if (s === 0) out.push({ inst: 'bass', deg: prog, oct: -1, len: 16, vel: 0.4 });
    if (s === 8) out.push({ inst: 'bell', deg: prog + 4, oct: 2, len: 8, vel: 0.2 });
    return out;
  } },
  silence: { tempo: 60, fade: 1.5, gain: 0, pattern: () => [] },
};

// One-shot cues; the engine returns to the requested state afterwards (`then`).
export const STINGERS = {
  victory: { tempo: 120, mode: 'major', root: 65, notes: [[0, 'stab', 0, 1, 2], [2, 'stab', 2, 1, 2], [4, 'stab', 4, 1, 2], [6, 'choir', 7, 1, 10], [6, 'choir', 4, 1, 10], [6, 'bass', 0, -1, 10]], then: null },
  bossDefeat: { tempo: 100, mode: 'major', root: 55, notes: [[0, 'kick', 0, 0, 1], [0, 'choir', 0, 1, 14], [0, 'choir', 4, 1, 14], [4, 'stab', 7, 1, 2], [6, 'stab', 9, 1, 2], [8, 'choir', 7, 2, 12], [8, 'bass', 0, -1, 12]], then: null },
  defeat: { tempo: 54, mode: 'minor', root: 55, notes: [[0, 'choir', 4, 1, 6], [6, 'choir', 3, 1, 6], [12, 'choir', 1, 1, 6], [18, 'choir', 0, 1, 14], [18, 'bass', 0, -2, 14]], then: 'silence' },
  chapter: { tempo: 70, mode: 'minor', root: 49, notes: [[0, 'kick', 0, 0, 1], [0, 'choir', 0, 1, 12], [0, 'choir', 2, 1, 12], [0, 'bass', 0, -1, 12], [6, 'bell', 4, 2, 6], [9, 'bell', 6, 2, 6]], then: null },
};
