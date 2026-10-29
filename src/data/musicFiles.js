// Music files. A music state listed here plays this file (looped) from assets/music/ instead of
// the synthesized track in data/music.js. A state that is not listed, or whose file is missing or
// fails to load, keeps the synthesized music - nothing else changes.
//   key:  a music state (title, explore, combat, elite, boss, safe, sanctuary, story)
//         or a variant: 'explore:<dungeonId>' (one dungeon's exploration) / 'boss:<bossId>' (one boss).
//         A variant falls back to its plain state, e.g. 'boss:abaddon' -> 'boss'.
//   value: file name in assets/music/ (mp3 / ogg / m4a), or { file, gain } (gain: volume multiplier).
// Stingers (victory / bossDefeat / defeat / chapter) stay synthesized; the file track dips under them.
// Only use music you have the rights to - the game is published on GitHub Pages.
export const MUSIC_BASE = 'assets/music/';

export const MUSIC_FILES = {
  title: 'title.mp3',
  explore: 'explore.mp3',
  elite: 'elite.mp3',
  boss: 'boss.mp3',
  safe: 'safe.mp3',
  sanctuary: 'sanctuary.mp3',
  story: 'story.mp3',
  // examples: 'explore:ashen_catacombs': 'catacombs.mp3', 'boss:abaddon': 'abaddon.mp3',
};

export const MUSIC_FILE_TUNING = {
  fade: 1.5,                             // crossfade seconds between file tracks
  gain: 1,                               // overall file-track volume (the MUSIC slider still applies)
  restart: ['elite', 'boss', 'story'],   // these start from the top each time; others resume where they left off
};
