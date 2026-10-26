import { Pix } from './gfx.js';
import { MATERIALS } from '../data/materials.js';

// Phase 4 generated pixel art: themed enemies (re-skinned skeleton / knight + two new bodies:
// crawler and wraith), bosses, dungeon features (stairs, exit portal, tablet, font, shrine, scroll)
// and material icons. Same rules as SpriteFactory: integer rects only, 1px outline, swap for PNGs later.

// ---------------------------------------------------------------- Crawler (48x30): low, many-legged
export function crawler(pose = {}, pal) {
  const p = new Pix(48, 30);
  const [c0, c1, c2, c3] = pal.body;
  const lp = pose.leg || 0, rise = pose.arm === 'raise' ? -6 : pose.arm === 'strike' ? 2 : 0;
  for (let i = 0; i < 3; i++) { // splayed legs
    const y = 16 + i * 3, s = (i % 2 ? lp : -lp);
    p.line(16 - i * 2, y, 3 - i, y + 8 + s, c2, 2); p.line(32 + i * 2, y, 45 + i, y + 8 - s, c2, 2);
  }
  p.ellipse(24, 19, 13, 6, c1);                                  // body
  for (let i = -2; i <= 2; i++) p.line(24 + i * 4, 14, 24 + i * 4, 23, c3);
  p.disc(24, 12 + rise, 6, c0);                                  // skull
  p.rect(20, 11 + rise, 3, 3, '#140f0a'); p.rect(26, 11 + rise, 3, 3, '#140f0a');
  p.px(21, 12 + rise, pal.eye); p.px(27, 12 + rise, pal.eye);
  const jaw = pose.arm === 'strike' ? 3 : 0;
  p.rect(20, 16 + rise + jaw, 9, 2, c1);
  for (let i = 0; i < 4; i++) p.px(21 + i * 2, 16 + rise + jaw, c3);
  return p.outline().c;
}

// ---------------------------------------------------------------- Hound (48x34): war dog, front view
export function hound(pose = {}, pal) {
  const p = new Pix(48, 34);
  const [c0, c1, c2, c3] = pal.body;
  const lp = pose.leg || 0, lunge = pose.arm === 'strike' ? 3 : pose.arm === 'raise' ? -2 : 0;
  p.ellipse(24, 18, 12, 8, c2);                                  // body behind
  p.rect(14 + lp, 20, 5, 12, c1); p.rect(29 - lp, 20, 5, 12, c1); // front legs
  p.rect(13 + lp, 31, 7, 2, c3); p.rect(28 - lp, 31, 7, 2, c3);
  p.ellipse(24, 12 + lunge, 8, 7, c1);                           // head
  p.poly([[16, 8 + lunge], [19, 0 + lunge], [21, 7 + lunge]], c2); p.poly([[32, 8 + lunge], [29, 0 + lunge], [27, 7 + lunge]], c2);
  p.rect(20, 10 + lunge, 2, 2, pal.eye); p.rect(26, 10 + lunge, 2, 2, pal.eye);
  p.ellipse(24, 17 + lunge, 4, 3, c0);                            // muzzle
  if (pose.arm === 'strike' || pose.arm === 'raise') { p.rect(21, 18 + lunge, 7, 2, '#300808'); p.px(22, 18 + lunge, '#fff'); p.px(26, 18 + lunge, '#fff'); }
  if (pal.armor) { p.rect(16, 4 + lunge, 16, 2, pal.armor); p.rect(15, 20, 18, 3, pal.armor); }
  return p.outline().c;
}

// ---------------------------------------------------------------- Wraith (44x64): hooded floating robe + scythe
export function wraith(pose = {}, pal) {
  const p = new Pix(44, 64);
  const [r0, r1, r2] = pal.robe;
  const bob = pose.bob || 0, arm = pose.arm || 'idle';
  const O = 4 + bob;
  if (pal.wings) { p.poly([[14, 14 + O], [0, 4 + O], [2, 30 + O], [12, 26 + O]], pal.wings); p.poly([[30, 14 + O], [44, 4 + O], [42, 30 + O], [32, 26 + O]], pal.wings); }
  // tattered robe
  p.poly([[14, 10 + O], [30, 10 + O], [36, 50 + O], [32, 56 + O], [28, 50 + O], [24, 58 + O], [20, 50 + O], [16, 56 + O], [8, 50 + O]], r1);
  p.poly([[16, 12 + O], [22, 12 + O], [18, 52 + O], [12, 50 + O]], r0);
  p.line(22, 18 + O, 22, 50 + O, r2);
  // hood + face
  p.poly([[13, 14 + O], [16, 2 + O], [22, 0 + O], [28, 2 + O], [31, 14 + O]], r1);
  p.ellipse(22, 10 + O, 5, 5, '#050304');
  const eye = pose.glow ? '#ffffff' : pal.eye;
  p.rect(19, 9 + O, 2, 1, eye); p.rect(24, 9 + O, 2, 1, eye);
  if (pal.snakes) for (let i = 0; i < 7; i++) { const sx = 12 + i * 3; p.line(sx, 4 + O, sx + (i % 2 ? 2 : -2), -2 + O + (i % 3), pal.snakes, 1); p.px(sx + (i % 2 ? 2 : -2), -2 + O + (i % 3), '#ff4040'); }
  if (pal.crown) { p.rect(16, 0 + O, 12, 2, pal.crown); p.px(18, -1 + O, pal.crown); p.px(22, -2 + O, pal.crown); p.px(26, -1 + O, pal.crown); }
  // scythe
  const blade = pal.blade || '#c8d0d8';
  if (arm === 'windup') { p.line(32, 22 + O, 40, 2 + O, '#4a3a22', 2); p.poly([[40, 2 + O], [30, -2 + O], [26, 4 + O], [34, 3 + O]], blade); }
  else if (arm === 'attack') { p.line(30, 24 + O, 6, 44 + O, '#4a3a22', 2); p.poly([[6, 44 + O], [2, 56 + O], [10, 58 + O], [8, 50 + O]], blade); }
  else { p.line(34, 14 + O, 36, 56 + O, '#4a3a22', 2); p.poly([[34, 14 + O], [22, 10 + O], [18, 16 + O], [28, 15 + O]], blade); }
  // bony hands
  p.disc(32, 24 + O, 2, pal.hand || '#d8d0c0');
  if (pal.mist) for (let i = 0; i < 10; i++) p.px(10 + ((i * 13) % 26), 52 + ((i * 7) % 8) + O, pal.mist);
  return p.outline().c;
}

export const setOf = (fn, pal, extra = {}) => ({
  idle: [fn({ bob: 0, ...extra }, pal), fn({ bob: 1, ...extra }, pal)],
  walk: [fn({ leg: 2, bob: 1, ...extra }, pal), fn({ leg: -2, bob: 1, ...extra }, pal)],
  windup: fn({ arm: fn === crawler || fn === hound ? 'raise' : 'windup', glow: true, ...extra }, pal),
  attack: fn({ arm: fn === crawler || fn === hound ? 'strike' : 'attack', ...extra }, pal),
  hurt: fn({ bob: 1, lean: -3, ...extra }, pal),
});
export const skelSet = (skeleton, pal) => ({
  idle: [skeleton({ bob: 0 }, pal), skeleton({ bob: 1 }, pal)],
  walk: [skeleton({ leg: 2, bob: 1 }, pal), skeleton({ leg: -2, bob: 1 }, pal)],
  windup: skeleton({ arm: 'raise', lean: 1 }, pal), attack: skeleton({ arm: 'strike', lean: -1 }, pal), hurt: skeleton({ lean: -3, bob: 1 }, pal),
});
export const knightSet = (knight, pal) => ({
  idle: [knight({ bob: 0 }, null, pal), knight({ bob: 1 }, null, pal)],
  walk: [knight({ leg: 2, bob: 1 }, null, pal), knight({ leg: -2, bob: 1 }, null, pal)],
  windup: knight({ arm: 'windup', glow: true }, null, pal), attack: knight({ arm: 'attack' }, null, pal), hurt: knight({ arm: 'guard', bob: 1 }, null, pal),
});

// ---------------------------------------------------------------- features
function stairs() {
  const p = new Pix(32, 28);
  p.rect(2, 4, 28, 24, '#2a2620'); p.rect(4, 6, 24, 22, '#0a0806');
  for (let i = 0; i < 5; i++) { p.rect(5 + i * 2, 8 + i * 4, 22 - i * 4, 3, ['#6a6050', '#5a5244', '#4a4438', '#3a352c', '#2a2620'][i]); }
  p.rect(2, 2, 28, 3, '#7a6e58');
  return p.outline().c;
}
function portal(active) {
  const p = new Pix(32, 48);
  p.rect(2, 4, 6, 44, '#5a5650'); p.rect(24, 4, 6, 44, '#5a5650'); p.rect(2, 0, 28, 6, '#6a665e');
  p.rect(8, 6, 16, 42, active ? '#2050a0' : '#100c0a');
  if (active) for (let i = 0; i < 6; i++) { p.ellipse(16, 27, 7 - i, 18 - i * 3, ['#3070c0', '#60a0e0', '#90d0ff', '#c0f0ff', '#ffffff', '#ffffff'][i]); }
  else { p.line(10, 12, 22, 40, '#3a2a20'); p.line(22, 14, 11, 38, '#3a2a20'); }
  for (const y of [10, 22, 34]) { p.px(4, y, active ? '#a8f0ff' : '#3a3632'); p.px(27, y, active ? '#a8f0ff' : '#3a3632'); }
  return p.outline().c;
}
function tablet() {
  const p = new Pix(20, 28);
  p.poly([[2, 6], [10, 0], [18, 6], [18, 27], [2, 27]], '#6a665a'); p.poly([[4, 7], [10, 2], [16, 7], [16, 25], [4, 25]], '#8a8676');
  for (let y = 9; y < 24; y += 3) p.line(6, y, 14, y, '#4a4638');
  return p.outline().c;
}
function font(used) {
  const p = new Pix(26, 22);
  p.rect(9, 10, 8, 10, '#6a665a'); p.rect(6, 19, 14, 3, '#5a564a');
  p.ellipse(13, 8, 12, 4, '#8a8676'); p.ellipse(13, 7, 10, 2, used ? '#3a3830' : '#4aa0e0');
  if (!used) { p.px(10, 6, '#c0f0ff'); p.px(16, 7, '#c0f0ff'); }
  return p.outline().c;
}
function shrine(used) {
  const p = new Pix(26, 34);
  p.rect(5, 18, 16, 14, '#2a261a'); p.rect(3, 30, 20, 4, '#1a1810'); p.rect(4, 16, 18, 3, '#3a3424');
  p.poly([[8, 16], [13, 2], [18, 16]], '#20180c');
  if (!used) { p.disc(13, 10, 3, '#80c030'); p.px(13, 9, '#e0ff90'); for (let i = 0; i < 5; i++) p.px(7 + i * 3, 22 + (i % 2) * 4, '#5a8a20'); }
  else p.disc(13, 10, 3, '#3a3a30');
  return p.outline().c;
}
function scrollStand(used) {
  const p = new Pix(18, 28);
  p.rect(7, 12, 4, 14, '#5a5244'); p.rect(4, 25, 10, 3, '#4a4438'); p.rect(3, 10, 12, 3, '#6a6050');
  if (!used) { p.rect(4, 4, 10, 6, '#e8d8a8'); p.rect(3, 4, 2, 6, '#a0823e'); p.rect(13, 4, 2, 6, '#a0823e'); p.line(6, 6, 11, 6, '#8a6a3a'); p.line(6, 8, 10, 8, '#8a6a3a'); }
  return p.outline().c;
}

// ---------------------------------------------------------------- material icons (16x16)
function materialIcon(shape, [m, l, d]) {
  const p = new Pix(16, 16);
  switch (shape) {
    case 'ingot': p.poly([[2, 10], [5, 5], [14, 5], [11, 10]], m); p.poly([[2, 10], [11, 10], [11, 13], [2, 13]], d); p.poly([[11, 10], [14, 5], [14, 8], [11, 13]], d); p.line(5, 6, 12, 6, l); break;
    case 'bone': p.line(3, 12, 12, 3, m, 2); p.disc(3, 13, 2, l); p.disc(2, 11, 1, l); p.disc(13, 2, 2, l); p.disc(12, 4, 1, l); p.line(4, 12, 12, 4, d); break;
    case 'cloth': p.poly([[2, 3], [13, 2], [14, 12], [8, 14], [3, 11]], m); p.line(4, 5, 12, 5, d); p.line(4, 8, 12, 9, d); p.px(6, 3, l); p.px(12, 11, l); break;
    case 'dust': p.ellipse(8, 11, 6, 3, d); p.ellipse(8, 9, 4, 3, m); for (const [x, y] of [[4, 5], [9, 4], [12, 6], [7, 7]]) p.px(x, y, l); break;
    case 'ash': p.ellipse(8, 11, 6, 3, d); p.ellipse(8, 9, 4, 3, m); for (const [x, y] of [[5, 6], [10, 5], [8, 4]]) p.px(x, y, l); break;
    case 'grain': for (let i = 0; i < 5; i++) p.ellipse(4 + i * 2, 4 + i * 2, 2, 1, i % 2 ? m : l); p.line(3, 13, 12, 2, d); break;
    case 'root': p.line(8, 1, 8, 9, m, 2); p.line(8, 9, 3, 15, m); p.line(8, 9, 13, 14, m); p.line(8, 6, 4, 9, d); p.line(8, 5, 12, 8, d); p.px(8, 2, l); break;
    case 'crystal': p.poly([[8, 1], [12, 6], [10, 14], [6, 14], [4, 6]], m); p.poly([[8, 1], [12, 6], [8, 8]], l); p.line(8, 8, 8, 13, d); break;
    case 'orb': p.disc(8, 8, 6, d); p.disc(8, 8, 4, m); p.disc(7, 7, 2, l); p.px(6, 6, '#ffffff'); break;
    case 'core': p.disc(8, 8, 6, d); p.disc(8, 8, 4, m); p.disc(8, 8, 2, l); p.px(8, 8, '#ffffff'); for (const [x, y] of [[2, 8], [14, 8], [8, 2], [8, 14]]) p.px(x, y, l); break;
    case 'shard': p.poly([[8, 1], [13, 7], [8, 15], [3, 7]], d); p.poly([[8, 1], [13, 7], [8, 8]], m); p.px(8, 6, l); break;
    default: p.rect(4, 4, 8, 8, m);
  }
  return p.outline('#050403').c;
}

export function addPhase4Sprites(s, { skeleton, knight }) {
  // ---- I. Ashen Catacombs
  s.crawler = setOf(crawler, { body: ['#e8dcc0', '#c8b890', '#8a7e60', '#4a4434'], eye: '#ff5a2a' });
  // ---- II. Red Warfront
  s.legionnaire = knightSet(knight, { steel: ['#d0a090', '#9a6050', '#6a3a30', '#3a1c18', '#1a0c0a'], capeA: '#8a1610', capeB: '#4a0806', tabard: '#a01a10', crest: '#ff4020', eye: '#ffb030' });
  s.hound = setOf(hound, { body: ['#a0806a', '#6a4a3a', '#4a3024', '#2a1a12'], eye: '#ff3010', armor: '#7a7470' });
  s.executioner = knightSet(knight, { steel: ['#8a8e98', '#5a5e66', '#3a3d44', '#1e2024', '#0a0b0d'], capeA: '#2a0a08', capeB: '#140404', tabard: '#3a0c08', hood: '#14100c', weapon: 'axe', eye: '#ff2010', noHorns: true });
  // ---- III. Black Harvest
  s.thrall = skelSet(skeleton, { bone: ['#b8a878', '#8a7a50', '#5a5030', '#2e2818'], eye: '#c0ff40', moss: '#5a8a20' });
  s.stalker = setOf(crawler, { body: ['#a8c060', '#6a8a30', '#3a5a18', '#1a2a08'], eye: '#e0ff60' });
  s.harvester = setOf(wraith, { robe: ['#3a4a18', '#22300c', '#101804'], eye: '#c0ff40', blade: '#a0b070', mist: '#5a8a20' });
  // ---- IV. Pale Threshold
  s.revenant = setOf(wraith, { robe: ['#c8d0d8', '#9aa4b0', '#6a7480'], eye: '#a8f0ff', blade: '#e8f0f8', mist: '#d0f0ff' });
  s.soulbound = knightSet(knight, { steel: ['#e8f0f8', '#b0bcc8', '#7a8698', '#4a5464', '#20262e'], capeA: '#3a4a6a', capeB: '#1a2438', tabard: '#2a3a5a', eye: '#80e0ff', glowEye: '#ffffff' });
  s.sentinel = knightSet(knight, { steel: ['#f4f0e4', '#d0c8b4', '#a09880', '#5a5444', '#2a2620'], capeA: '#5a5444', capeB: '#2a2620', tabard: '#6a6250', crown: '#c0c8d0', eye: '#a8f0ff', glowEye: '#ffffff' });
  // ---- bosses
  s.warden = knightSet(knight, { steel: ['#f0e8d0', '#cfc39d', '#958865', '#5a5038', '#2a2418'], capeA: '#3a3020', capeB: '#1a160c', tabard: '#4a3a20', crown: '#958865', eye: '#60e0ff', glowEye: '#c0f8ff' });
  s.tyrant = knightSet(knight, { steel: ['#9a9ea8', '#5a5e68', '#34373e', '#1c1e22', '#0a0b0c'], capeA: '#a01810', capeB: '#600a06', tabard: '#7a1008', crown: '#e0b040', weapon: 'axe', eye: '#ff3010', glowEye: '#ffd040' });
  s.harvesterBoss = setOf(wraith, { robe: ['#4a6a18', '#2a400c', '#142006'], eye: '#e0ff60', blade: '#c0e060', mist: '#80c030', crown: '#5a4a20' });
  s.executor = setOf(wraith, { robe: ['#f0f4f8', '#b8c4d0', '#7a8898'], eye: '#ffffff', blade: '#a8f0ff', mist: '#a8f0ff', crown: '#c0c8d0', hand: '#ffffff' });
  // ---- features
  s.features = {
    stairs: stairs(), exitOn: portal(true), exitOff: portal(false), tablet: tablet(),
    font: font(false), fontUsed: font(true), shrine: shrine(false), shrineUsed: shrine(true), scroll: scrollStand(false), scrollUsed: scrollStand(true),
  };
  for (const m of MATERIALS) s.icons[`mat_${m.id}`] = materialIcon(m.icon.shape, m.icon.c);
}
