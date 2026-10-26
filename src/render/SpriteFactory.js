import { Pix, makeCanvas, hash2, BAYER4 } from './gfx.js';
import { SKILLS } from '../data/skills.js';
import { addPhase4Sprites } from './SpritesPhase4.js';
import { addPhase5Sprites } from './SpritesPhase5.js';

// Generated pixel-art sprites. Every sprite is a small canvas drawn with integer rects,
// scaled up with nearest-neighbour at render time. Swap any entry for a PNG later.

const BONE_DEFAULT = ['#efe6cc', '#cfc39d', '#958865', '#5a5038'];
const STEEL_DEFAULT = ['#c0c7cf', '#868e98', '#565c66', '#30343a', '#17191d'];
const STEEL = STEEL_DEFAULT;
const DARK = '#140f0a';

// ---------------------------------------------------------------- Skeleton (40x56)
// pal (Phase 4): { bone: [4 colours], eye, blade } re-skins it (Withered Thrall).
function skeleton(pose = {}, pal = null) {
  const BONE = pal?.bone || BONE_DEFAULT;
  const p = new Pix(40, 56);
  const oy = pose.bob || 0, lx = pose.lean || 0, lp = pose.leg || 0;
  const arm = pose.arm || 'down';
  const U = (x) => x + lx; // upper body x shift
  // legs
  p.line(17, 38, 16 + lp, 46, BONE[1], 2); p.line(16 + lp, 46, 15 + lp * 1.5, 53, BONE[2], 2);
  p.line(23, 38, 24 - lp, 46, BONE[1], 2); p.line(24 - lp, 46, 25 - lp * 1.5, 53, BONE[2], 2);
  p.rect(13 + lp * 1.5, 53, 5, 2, BONE[2]); p.rect(23 - lp * 1.5, 53, 5, 2, BONE[2]);
  p.px(16 + lp, 46, BONE[0]); p.px(24 - lp, 46, BONE[0]);
  // pelvis
  p.poly([[U(14), 34 + oy], [U(26), 34 + oy], [U(27), 37 + oy], [U(22), 40 + oy], [U(18), 40 + oy], [U(13), 37 + oy]], BONE[1]);
  p.px(U(17), 36 + oy, BONE[3]); p.px(U(23), 36 + oy, BONE[3]);
  // spine
  for (let y = 17; y <= 34; y++) p.rect(U(19), y + oy, 2, 1, y % 2 ? BONE[2] : BONE[1]);
  // ribs
  [[7, 22], [7, 25], [6, 28], [4, 31]].forEach(([w, y]) => {
    p.line(U(20 - w), y + 1 + oy, U(19), y + oy, BONE[1]);
    p.line(U(21), y + oy, U(20 + w), y + 1 + oy, BONE[1]);
    p.px(U(20 - w), y + 2 + oy, BONE[2]); p.px(U(20 + w), y + 2 + oy, BONE[2]);
    p.line(U(21 - w), y + 2 + oy, U(19 + w), y + 2 + oy, BONE[3]);
  });
  // clavicle
  p.line(U(13), 19 + oy, U(27), 19 + oy, BONE[1], 2);
  // arms + rusty blade
  const SL = [U(13), 20 + oy], SR = [U(27), 20 + oy];
  const blade = (x0, y0, x1, y1) => { p.line(x0, y0, x1, y1, '#8f8a7e', 2); p.line(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, '#a0592f'); };
  if (arm === 'raise') {
    p.line(...SL, U(9), 14 + oy, BONE[1], 2); p.line(U(9), 14 + oy, U(11), 8 + oy, BONE[2], 2);
    p.line(...SR, U(31), 13 + oy, BONE[1], 2); p.line(U(31), 13 + oy, U(29), 6 + oy, BONE[2], 2);
    blade(U(29), 5 + oy, U(36), 0); p.line(U(26), 7 + oy, U(32), 5 + oy, '#5a3a20');
  } else if (arm === 'strike') {
    p.line(...SL, U(10), 28 + oy, BONE[1], 2); p.line(U(10), 28 + oy, U(11), 35 + oy, BONE[2], 2);
    p.line(...SR, U(28), 26 + oy, BONE[1], 2); p.line(U(28), 26 + oy, U(22), 31 + oy, BONE[2], 2);
    blade(U(22), 31 + oy, U(6), 44 + oy); p.line(U(21), 28 + oy, U(24), 34 + oy, '#5a3a20');
  } else {
    p.line(...SL, U(11), 28 + oy, BONE[1], 2); p.line(U(11), 28 + oy, U(12), 35 + oy, BONE[2], 2);
    p.line(...SR, U(29), 28 + oy, BONE[1], 2); p.line(U(29), 28 + oy, U(30), 35 + oy, BONE[2], 2);
    blade(U(30), 36 + oy, U(35), 51 + oy); p.line(U(28), 35 + oy, U(32), 37 + oy, '#5a3a20');
  }
  // skull
  const jaw = arm === 'strike' ? 1 : 0;
  p.disc(U(20), 9 + oy, 6, BONE[1]);
  p.disc(U(18), 7 + oy, 3, BONE[0]);
  p.rect(U(15), 12 + oy, 10, 2, BONE[2]);
  p.rect(U(16), 9 + oy, 3, 3, DARK); p.rect(U(21), 9 + oy, 3, 3, DARK);
  p.px(U(17), 10 + oy, pal?.eye || '#ff3a1a'); p.px(U(22), 10 + oy, pal?.eye || '#ff3a1a');
  if (pal?.moss) for (let i = 0; i < 14; i++) p.px(U(12 + ((i * 7) % 17)), 18 + ((i * 11) % 20) + oy, pal.moss);
  p.rect(U(19), 12 + oy, 2, 2, DARK);
  p.rect(U(16), 14 + oy + jaw, 8, 3, BONE[1]);
  for (let i = 0; i < 4; i++) p.px(U(17 + i * 2), 14 + oy + jaw, BONE[3]);
  return p.outline().c;
}

// ---------------------------------------------------------------- Fallen Knight (56x80)
// pal (Phase 4): { steel: [5], capeA, capeB, tabard, eye, glowEye, crown, weapon: 'sword'|'axe' } re-skins it.
function knight(pose = {}, variant = null, pal = null) {
  const STEEL = pal?.steel || STEEL_DEFAULT;
  const p = new Pix(56, 80);
  const O = 8 + (pose.bob || 0);
  const lp = pose.leg || 0;
  const arm = pose.arm || 'idle';
  const capeA = pal?.capeA || (variant === 'captain' ? '#6a0c0a' : '#4a1014');
  const capeB = pal?.capeB || (variant === 'captain' ? '#3a0605' : '#2c080b');
  const tabard = pal?.tabard || (variant === 'captain' ? '#8a1610' : '#5e1a16');
  // cape
  p.poly([[16, 12 + O], [40, 12 + O], [47, 56 + O], [41, 54 + O], [36, 60 + O], [30, 55 + O], [24, 60 + O], [18, 54 + O], [9, 57 + O]], capeB);
  p.poly([[18, 14 + O], [26, 14 + O], [22, 55 + O], [14, 54 + O]], capeA);
  // legs (O-independent at the feet)
  const leg = (x) => {
    p.rect(x, 46 + O - (pose.bob || 0), 7, 18, STEEL[2]); p.rect(x, 46 + O - (pose.bob || 0), 2, 18, STEEL[1]);
    p.disc(x + 3, 49 + O - (pose.bob || 0), 3, STEEL[1]);
    p.rect(x - 1, 64 + 8, 9, 4, STEEL[3]); p.rect(x - 1, 64 + 8, 9, 1, STEEL[1]);
  };
  leg(19 + lp); leg(30 - lp);
  // torso plate
  p.poly([[17, 20 + O], [39, 20 + O], [37, 38 + O], [19, 38 + O]], STEEL[2]);
  p.poly([[17, 20 + O], [28, 20 + O], [28, 38 + O], [19, 38 + O]], STEEL[1]);
  p.line(28, 21 + O, 28, 37 + O, STEEL[0]);
  p.line(20, 29 + O, 36, 29 + O, STEEL[3]);
  [[22, 25], [33, 32], [25, 34], [31, 23]].forEach(([x, y]) => p.px(x, y + O, '#7a3a20'));
  p.rect(19, 37 + O, 18, 3, STEEL[4]); p.rect(26, 37 + O, 4, 3, '#a0823e');
  // tabard
  p.poly([[21, 40 + O], [35, 40 + O], [34, 52 + O], [32, 50 + O], [30, 54 + O], [27, 50 + O], [25, 53 + O], [22, 50 + O]], tabard);
  p.rect(27, 42 + O, 2, 6, '#1a0606'); p.rect(25, 44 + O, 6, 2, '#1a0606');
  // shield (screen-left)
  const sy = arm === 'guard' ? -4 : 0, sx = arm === 'guard' ? 6 : 0;
  p.line(17, 24 + O, 12 + sx, 32 + O, STEEL[2], 3);
  p.poly([[5 + sx, 25 + O + sy], [19 + sx, 25 + O + sy], [19 + sx, 40 + O + sy], [12 + sx, 49 + O + sy], [5 + sx, 40 + O + sy]], STEEL[1]);
  p.poly([[7 + sx, 27 + O + sy], [17 + sx, 27 + O + sy], [17 + sx, 39 + O + sy], [12 + sx, 46 + O + sy], [7 + sx, 39 + O + sy]], STEEL[3]);
  p.rect(11 + sx, 29 + O + sy, 2, 14, '#7a1810'); p.rect(8 + sx, 33 + O + sy, 8, 2, '#7a1810');
  // pauldrons
  p.ellipse(16, 22 + O, 6, 4, STEEL[1]); p.ellipse(15, 21 + O, 3, 2, STEEL[0]);
  p.ellipse(40, 22 + O, 6, 4, STEEL[2]); p.ellipse(39, 21 + O, 3, 2, STEEL[1]);
  // helm
  p.rect(24, 18 + O, 8, 3, STEEL[3]);
  p.rect(22, 5 + O, 12, 14, STEEL[2]); p.ellipse(28, 6 + O, 6, 3, STEEL[2]);
  p.rect(22, 5 + O, 3, 13, STEEL[1]); p.px(23, 4 + O, STEEL[0]);
  p.rect(23, 11 + O, 10, 2, STEEL[4]);
  const g = pose.glow ? pal?.glowEye || '#ffd040' : pal?.eye || '#ff4020';
  p.rect(25, 11 + O, pose.glow ? 2 : 1, pose.glow ? 2 : 1, g); p.rect(30, 11 + O, pose.glow ? 2 : 1, pose.glow ? 2 : 1, g);
  for (let i = 0; i < 3; i++) p.px(26 + i * 2, 15 + O, STEEL[4]);
  if (pal?.hood) { p.poly([[20, 2 + O], [36, 2 + O], [37, 20 + O], [19, 20 + O]], pal.hood); p.rect(24, 11 + O, 8, 3, '#000'); p.rect(25, 11 + O, 1, 1, g); p.rect(30, 11 + O, 1, 1, g); }
  else if (!pal?.noHorns) { p.line(22, 6 + O, 17, 0 + O, STEEL[3], 2); p.line(34, 6 + O, 39, 0 + O, STEEL[3], 2); }
  if (variant === 'captain' || pal?.crown) { const cc = pal?.crown || '#a0823e'; p.rect(23, 2 + O, 10, 2, cc); p.px(25, 1 + O, '#e0c060'); p.px(28, 0 + O, '#e0c060'); p.px(31, 1 + O, '#e0c060'); }
  if (pal?.crest) for (let i = 0; i < 6; i++) p.rect(26 + (i % 2), 2 + O - i, 4, 1, pal.crest);
  // sword arm (screen-right)
  const sword = (hx, hy, tx, ty) => {
    const dx = tx - hx, dy = ty - hy, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    if (pal?.weapon === 'axe') { // executioner's axe: haft + broad head at the tip
      p.line(hx, hy, tx, ty, '#5a3a1c', 3);
      p.poly([[tx - nx * 9 - dx / len * 6, ty - ny * 9 - dy / len * 6], [tx + nx * 2, ty + ny * 2], [tx - nx * 9 + dx / len * 4, ty - ny * 9 + dy / len * 4]], STEEL[1]);
      p.line(tx - nx * 9 - dx / len * 6, ty - ny * 9 - dy / len * 6, tx - nx * 9 + dx / len * 4, ty - ny * 9 + dy / len * 4, STEEL[0], 1);
      return;
    }
    p.line(hx, hy, tx, ty, STEEL[0], 3);
    p.line(hx + nx, hy + ny, tx, ty, STEEL[1], 1);
    p.line(hx - nx * 5, hy - ny * 5, hx + nx * 5, hy + ny * 5, '#a0823e', 2);
    p.disc(hx - dx / len * 4, hy - dy / len * 4, 1, '#a0823e');
  };
  if (arm === 'windup') {
    p.line(40, 24 + O, 45, 14 + O, STEEL[2], 3); p.line(45, 14 + O, 39, 6 + O, STEEL[1], 3);
    sword(39, 5 + O, 54, -O + 1);
  } else if (arm === 'attack') {
    p.line(40, 24 + O, 38, 34 + O, STEEL[2], 3); p.line(38, 34 + O, 30, 42 + O, STEEL[1], 3);
    sword(30, 42 + O, 4, 64 + O);
  } else {
    p.line(40, 24 + O, 44, 33 + O, STEEL[2], 3); p.line(44, 33 + O, 43, 40 + O, STEEL[1], 3);
    sword(43, 40 + O, 47, 68 + 8);
  }
  return p.outline().c;
}

// ---------------------------------------------------------------- Player (back view) per Horseman
const BACK_STYLE = {
  war: { cape: ['#b0281c', '#8a1c14', '#5a0e0a'], armor: STEEL, head: 'horns' },
  conquest: { cape: ['#efe8d4', '#c8bea4', '#8a826c'], armor: ['#f4ecd8', '#d8c890', '#a8904a', '#6a5a2a', '#2a2210'], head: 'crown' },
  famine: { cape: ['#3a3428', '#24201a', '#100e0a'], armor: ['#8a8470', '#5a5648', '#3a3830', '#22201a', '#0e0d0a'], head: 'hood' },
  death: { cape: ['#8a8a88', '#5e5e5c', '#3a3a3a'], armor: ['#e8e4d8', '#c0bcb0', '#8a867a', '#4a4840', '#1a1a18'], head: 'cowl' },
};
function playerBack(weaponId = 'sword', lunge = 0, cls = 'war') {
  const p = new Pix(48, 60);
  const oy = -lunge;
  const st = BACK_STYLE[cls] || BACK_STYLE.war;
  const RED = st.cape, A = st.armor;
  p.rect(15, 52, 6, 8, A[3]); p.rect(27, 52, 6, 8, A[3]);
  p.poly([[12, 18 + oy], [36, 18 + oy], [40, 56], [33, 53], [28, 57], [22, 53], [16, 57], [8, 55]], RED[1]);
  p.poly([[12, 18 + oy], [22, 18 + oy], [18, 54], [8, 55]], RED[0]);
  p.line(24, 20 + oy, 25, 52, RED[2], 2);
  p.ellipse(11, 20 + oy, 6, 4, A[1]); p.ellipse(10, 19 + oy, 3, 2, A[0]);
  p.ellipse(37, 20 + oy, 6, 4, A[2]);
  if (st.head === 'hood' || st.head === 'cowl') {
    p.poly([[16, 18 + oy], [18, 6 + oy], [24, 1 + oy], [30, 6 + oy], [32, 18 + oy]], RED[1]);
    p.poly([[18, 17 + oy], [19, 7 + oy], [24, 2 + oy], [24, 17 + oy]], RED[0]);
    if (st.head === 'cowl') { p.px(24, 3 + oy, '#c0e8ff'); p.px(23, 9 + oy, '#80c0e0'); }
  } else {
    p.ellipse(24, 10 + oy, 6, 7, A[2]); p.ellipse(22, 8 + oy, 3, 3, A[1]);
    if (st.head === 'horns') { p.line(18, 8 + oy, 11, 1 + oy, '#d8ccb0', 2); p.line(30, 8 + oy, 37, 1 + oy, '#d8ccb0', 2); }
    else { // broken crown + halo shard
      p.rect(18, 3 + oy, 12, 2, '#d8b050');
      for (const x of [18, 21, 24, 27, 29]) p.rect(x, 0 + oy, 1, 3, '#f0d070');
      p.line(14, 1 + oy, 19, -2 + oy, '#fff0b0'); p.line(29, -2 + oy, 34, 1 + oy, '#fff0b0');
    }
    p.rect(20, 15 + oy, 8, 3, A[3]);
  }
  // right arm + weapon
  p.line(37, 22 + oy, 40, 31 + oy, STEEL[2], 3);
  const hx = 40, hy = 31 + oy;
  if (weaponId === 'sword') { p.line(hx, hy, hx + 3, hy - 28, STEEL[0], 2); p.line(hx - 3, hy + 1, hx + 4, hy - 1, '#a0823e', 2); }
  else if (weaponId === 'axe') { p.line(hx, hy + 4, hx + 2, hy - 26, '#6a4422', 2); p.poly([[hx + 2, hy - 26], [hx + 9, hy - 30], [hx + 10, hy - 18], [hx + 2, hy - 20]], STEEL[1]); }
  else if (weaponId === 'crossbow') { p.line(16, 24 + oy, 44, 24 + oy, '#5a3a1e', 2); p.line(30, 22 + oy, 30, 34 + oy, '#7a5030', 3); }
  else if (weaponId === 'dagger') { p.line(hx, hy, hx + 2, hy - 10, '#9a70c0', 2); p.px(hx + 2, hy - 11, '#e0c0ff'); }
  return p.outline().c;
}

// ---------------------------------------------------------------- First-person weapons
function fpSword() {
  const p = new Pix(24, 76);
  p.poly([[9, 6], [12, 0], [15, 6], [15, 50], [9, 50]], '#a49e92');
  p.rect(9, 6, 2, 44, '#cdc8bc'); p.rect(12, 8, 1, 40, '#6f6a60');
  [[13, 14], [10, 22], [14, 31], [11, 40], [13, 45]].forEach(([x, y]) => p.rect(x, y, 2, 2, '#8a4a28'));
  p.px(15, 18, '#3a342c'); p.px(9, 33, '#3a342c');
  p.rect(2, 50, 20, 4, '#a8834a'); p.rect(2, 50, 20, 1, '#d8b56d'); p.rect(1, 51, 2, 2, '#5e4321'); p.rect(21, 51, 2, 2, '#5e4321');
  p.rect(9, 54, 6, 10, '#4a2c16');
  p.rect(5, 56, 14, 12, STEEL[2]); p.rect(5, 56, 14, 2, STEEL[1]);
  for (let i = 0; i < 4; i++) p.rect(6 + i * 3, 58, 2, 2, STEEL[0]);
  p.rect(7, 68, 10, 8, STEEL[3]);
  p.disc(12, 66, 2, '#a8834a');
  return p.outline().c;
}
function fpAxe() {
  const p = new Pix(44, 80);
  p.rect(18, 12, 5, 68, '#6a4422'); p.rect(18, 12, 2, 68, '#8a5c32');
  for (let y = 46; y < 56; y += 3) p.rect(18, y, 5, 1, '#2a1a0e');
  p.poly([[22, 6], [38, 0], [42, 12], [38, 28], [22, 20]], STEEL[1]);
  p.poly([[34, 1], [38, 0], [42, 12], [38, 28], [34, 24], [38, 12]], STEEL[0]);
  p.poly([[18, 8], [8, 13], [18, 18]], STEEL[2]);
  p.rect(17, 6, 7, 16, STEEL[3]);
  p.px(28, 10, '#7a1810'); p.px(30, 14, '#7a1810'); p.px(27, 16, '#5a0e0a');
  p.rect(13, 58, 15, 12, STEEL[2]); p.rect(13, 58, 15, 2, STEEL[1]);
  for (let i = 0; i < 4; i++) p.rect(14 + i * 3, 60, 2, 2, STEEL[0]);
  p.rect(15, 70, 11, 10, STEEL[3]);
  return p.outline().c;
}
function fpCrossbow(loaded = true) {
  const p = new Pix(84, 56);
  p.rect(37, 14, 10, 42, '#6a4422'); p.rect(37, 14, 3, 42, '#8a5c32');
  p.rect(36, 10, 12, 8, STEEL[2]);
  // limbs
  p.line(4, 18, 24, 12, '#3a2414', 3); p.line(24, 12, 42, 10, '#3a2414', 3);
  p.line(42, 10, 60, 12, '#3a2414', 3); p.line(60, 12, 80, 18, '#3a2414', 3);
  p.line(6, 17, 24, 11, '#6a4a2a', 1); p.line(60, 11, 78, 17, '#6a4a2a', 1);
  // string
  if (loaded) { p.line(4, 19, 42, 30, '#d8ccb0'); p.line(42, 30, 80, 19, '#d8ccb0'); }
  else { p.line(4, 19, 42, 22, '#d8ccb0'); p.line(42, 22, 80, 19, '#d8ccb0'); }
  if (loaded) { p.rect(41, 0, 2, 30, '#8a6a40'); p.poly([[40, 3], [42, -1], [44, 3]], STEEL[0]); p.rect(40, 26, 4, 3, '#a02a1a'); }
  // hands
  p.rect(24, 40, 13, 12, STEEL[2]); p.rect(24, 40, 13, 2, STEEL[1]);
  p.rect(47, 44, 13, 12, STEEL[2]); p.rect(47, 44, 13, 2, STEEL[1]);
  return p.outline().c;
}
function fpDagger() {
  const p = new Pix(22, 52);
  const blade = [[10, 0], [13, 5], [11, 10], [14, 16], [12, 22], [14, 28], [8, 28], [10, 22], [8, 16], [11, 10], [8, 5]];
  p.poly(blade, '#4a2a66');
  p.line(11, 2, 11, 27, '#9a70c0');
  [[11, 6], [12, 15], [10, 21]].forEach(([x, y]) => p.px(x, y, '#e0c0ff'));
  p.rect(4, 28, 14, 3, '#3a2a40'); p.px(3, 29, '#b25ae0'); p.px(18, 29, '#b25ae0');
  p.rect(8, 31, 6, 9, '#2a1a20');
  p.rect(4, 34, 14, 11, STEEL[2]); p.rect(4, 34, 14, 2, STEEL[1]);
  for (let i = 0; i < 4; i++) p.rect(5 + i * 3, 36, 2, 2, STEEL[0]);
  p.rect(6, 45, 10, 7, STEEL[3]);
  return p.outline().c;
}
function fpFists() {
  const p = new Pix(24, 30);
  p.rect(4, 4, 16, 14, STEEL[2]); p.rect(4, 4, 16, 2, STEEL[1]);
  for (let i = 0; i < 4; i++) p.rect(5 + i * 4, 6, 3, 3, STEEL[0]);
  p.rect(6, 18, 12, 12, STEEL[3]);
  return p.outline().c;
}

// ---------------------------------------------------------------- Item icons (16x16)
function icon(kind) {
  const p = new Pix(16, 16);
  switch (kind) {
    case 'sword':
      p.line(4, 11, 13, 2, '#bcb6aa', 2); p.line(5, 11, 13, 3, '#7a756a');
      p.line(2, 9, 6, 13, '#a8834a', 2); p.line(2, 14, 4, 12, '#5e3a1e', 2); break;
    case 'axe':
      p.line(3, 14, 11, 3, '#7a4c26', 2);
      p.poly([[9, 1], [14, 2], [15, 7], [12, 8], [9, 5]], '#a8a49a'); p.line(14, 2, 15, 7, '#e0dcd0'); break;
    case 'crossbow':
      p.line(2, 6, 8, 3, '#5a3a1e', 2); p.line(8, 3, 14, 6, '#5a3a1e', 2);
      p.line(8, 3, 8, 15, '#8a5c32', 2); p.line(2, 7, 14, 7, '#d8ccb0'); p.line(8, 0, 8, 6, '#c0c0c0'); break;
    case 'dagger':
      p.line(6, 10, 12, 3, '#6a3a90', 2); p.px(12, 3, '#e0c0ff'); p.line(4, 9, 8, 12, '#3a2a40', 2); p.line(3, 13, 5, 11, '#2a1a20', 2); break;
    case 'potion':
      p.rect(6, 1, 4, 2, '#8a6a40'); p.rect(7, 3, 2, 3, '#a0b0b8');
      p.disc(8, 10, 5, '#a0b0b8'); p.disc(8, 10, 4, '#b0201a'); p.rect(5, 9, 6, 1, '#e04030'); p.px(6, 8, '#ffd0c0'); break;
    case 'shard':
      p.poly([[8, 1], [12, 6], [10, 14], [5, 13], [4, 6]], '#6a7480'); p.poly([[8, 1], [12, 6], [8, 8]], '#b0bcc8');
      p.line(8, 8, 7, 13, '#3a4048'); break;
    // ---- Phase 3 weapons
    case 'longsword': p.line(3, 12, 14, 1, '#d0d4d8', 2); p.line(4, 12, 14, 2, '#8a9098'); p.line(1, 10, 6, 15, '#c0a050', 2); p.px(2, 14, '#5e3a1e'); break;
    case 'scythe': p.line(4, 15, 9, 1, '#6a5030', 2); p.poly([[9, 1], [15, 4], [13, 6], [8, 3]], '#c8d0d8'); p.line(10, 2, 15, 4, '#ffffff'); break;
    case 'bow': for (let a = -1.2; a <= 1.2; a += 0.15) p.px(6 + Math.cos(a) * 6, 8 + Math.sin(a) * 7, '#8a6a3a'); p.line(7, 1, 7, 15, '#e8e0c8'); p.line(2, 8, 14, 8, '#c0c0c0'); p.px(14, 8, '#ffffff'); break;
    case 'sickle': for (let a = 3.6; a < 5.9; a += 0.15) p.px(9 + Math.cos(a) * 5, 7 + Math.sin(a) * 5, '#a0a840'); p.line(9, 7, 6, 15, '#4a3a22', 2); break;
    // ---- armour
    case 'helm': p.ellipse(8, 7, 6, 5, '#868e98'); p.rect(2, 7, 12, 5, '#565c66'); p.rect(4, 8, 8, 2, '#17191d'); p.px(5, 4, '#c0c7cf'); break;
    case 'crown': p.rect(2, 8, 12, 5, '#d8b050'); for (const x of [2, 6, 10, 13]) p.rect(x, 4, 1, 4, '#f0d070'); p.px(8, 10, '#c02010'); p.rect(2, 8, 12, 1, '#fff0b0'); break;
    case 'hood': p.poly([[2, 15], [3, 6], [8, 1], [13, 6], [14, 15]], '#3a3428'); p.ellipse(8, 9, 3, 4, '#0a0806'); p.px(7, 9, '#c0e060'); p.px(9, 9, '#c0e060'); break;
    case 'plate': p.poly([[2, 2], [14, 2], [13, 14], [3, 14]], '#868e98'); p.rect(7, 2, 2, 12, '#c0c7cf'); p.rect(3, 9, 10, 1, '#565c66'); p.ellipse(3, 3, 2, 2, '#565c66'); p.ellipse(13, 3, 2, 2, '#565c66'); break;
    case 'robe': p.poly([[4, 1], [12, 1], [15, 15], [1, 15]], '#4a2a5a'); p.line(8, 2, 8, 15, '#a07ab0'); p.rect(4, 6, 8, 1, '#c0a050'); break;
    case 'jerkin': p.poly([[3, 2], [13, 2], [13, 14], [3, 14]], '#7a5030'); p.line(8, 2, 8, 14, '#4a3018'); for (let y = 4; y < 14; y += 3) p.px(9, y, '#c0a050'); break;
    case 'gauntlet': p.rect(4, 2, 8, 9, '#868e98'); for (let i = 0; i < 4; i++) p.rect(4 + i * 2, 1, 1, 3, '#c0c7cf'); p.rect(5, 11, 6, 4, '#565c66'); break;
    case 'wraps': p.rect(5, 2, 7, 12, '#c8b890'); for (let y = 3; y < 14; y += 2) p.line(5, y, 11, y + 1, '#8a7a5a'); p.px(8, 6, '#8a1010'); break;
    case 'greaves': p.rect(3, 1, 4, 12, '#868e98'); p.rect(9, 1, 4, 12, '#868e98'); p.rect(2, 12, 6, 3, '#565c66'); p.rect(8, 12, 6, 3, '#565c66'); p.px(4, 5, '#c0c7cf'); p.px(10, 5, '#c0c7cf'); break;
    case 'boots': p.rect(4, 2, 4, 10, '#3a2a1a'); p.rect(4, 11, 8, 4, '#2a1a0e'); p.rect(4, 2, 4, 1, '#6a5030'); break;
    // ---- off hand / jewellery / relics
    case 'shield': p.poly([[2, 1], [14, 1], [14, 9], [8, 15], [2, 9]], '#565c66'); p.poly([[4, 3], [12, 3], [12, 8], [8, 13], [4, 8]], '#7a1810'); p.rect(7, 3, 2, 9, '#c0a050'); break;
    case 'tome': p.rect(3, 2, 10, 13, '#3a1a10'); p.rect(4, 2, 1, 13, '#c0a050'); p.disc(9, 8, 2, '#b25ae0'); p.rect(12, 3, 1, 11, '#e8d8b0'); break;
    case 'talisman': p.line(8, 1, 8, 5, '#c8b890'); p.disc(8, 10, 4, '#a0823e'); p.disc(8, 10, 2, '#5fbf4a'); break;
    case 'ring': for (let a = 0; a < Math.PI * 2; a += 0.3) p.px(8 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, '#c0c0c0'); p.rect(6, 3, 4, 3, '#4f86e0'); break;
    case 'signet': for (let a = 0; a < Math.PI * 2; a += 0.3) p.px(8 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, '#d8b050'); p.rect(5, 3, 6, 4, '#d8b050'); p.px(8, 5, '#7a1810'); break;
    case 'shardRelic': p.poly([[8, 1], [13, 7], [8, 15], [3, 7]], '#a01810'); p.poly([[8, 1], [13, 7], [8, 8]], '#ff6040'); p.px(8, 6, '#fff0b0'); break;
    case 'banner': p.line(3, 1, 3, 15, '#6a5030', 2); p.poly([[4, 2], [14, 3], [12, 7], [14, 11], [4, 10]], '#9a1810'); p.px(8, 6, '#ffd040'); break;
    case 'scalesRelic': p.line(8, 2, 8, 13, '#2a2620', 2); p.line(2, 4, 14, 4, '#b0b040'); p.rect(1, 8, 5, 2, '#b0b040'); p.rect(10, 8, 5, 2, '#b0b040'); p.rect(5, 13, 6, 2, '#2a2620'); break;
    case 'lantern': p.rect(6, 1, 4, 2, '#565c66'); p.rect(4, 3, 8, 10, '#565c66'); p.rect(5, 4, 6, 8, '#a8d8f0'); p.rect(7, 6, 2, 4, '#ffffff'); p.rect(5, 13, 6, 2, '#565c66'); break;
    // ---- consumables / materials
    case 'elixir': p.rect(6, 1, 4, 2, '#3a3a3a'); p.rect(7, 3, 2, 3, '#808890'); p.disc(8, 10, 5, '#808890'); p.disc(8, 10, 4, '#4a2a8a'); p.px(6, 8, '#c0a0ff'); break;
    case 'ash': p.ellipse(8, 11, 6, 3, '#4a4440'); p.ellipse(8, 9, 4, 3, '#6a6460'); for (const [x, y] of [[5, 6], [10, 5], [8, 4]]) p.px(x, y, '#ff6020'); break;
    case 'essence': p.disc(8, 8, 5, '#3a1a50'); p.disc(8, 8, 3, '#b25ae0'); p.px(7, 7, '#ffffff'); break;
    case 'soulfrag': p.poly([[8, 1], [12, 8], [8, 15], [4, 8]], '#80c0e0'); p.poly([[8, 1], [12, 8], [8, 9]], '#c0e8ff'); p.px(8, 7, '#ffffff'); break;
    case 'core': p.disc(8, 8, 6, '#5a0808'); p.disc(8, 8, 4, '#c02010'); p.disc(8, 8, 2, '#ffd040'); p.px(8, 8, '#ffffff'); break;
    case 'gold': p.disc(6, 10, 4, '#a0802a'); p.disc(10, 8, 4, '#d8b050'); p.px(9, 6, '#fff0b0'); break;
    default:
      p.rect(4, 4, 8, 8, '#888');
  }
  return p.outline('#050403').c;
}

// UI glyphs (12x12) engraved on round buttons
function uiGlyph(kind, col = '#d8b56d') {
  const p = new Pix(12, 12);
  const s = '#2a1e0e';
  const draw = (fn) => { fn(s, 1); fn(col, 0); };
  draw((c, o) => {
    switch (kind) {
      case 'bag': p.rect(2 + o, 4 + o, 8, 7, c); p.rect(4 + o, 2 + o, 4, 2, c); p.px(6 + o, 7 + o, s); break;
      case 'person': p.disc(6 + o, 3 + o, 2, c); p.rect(3 + o, 6 + o, 6, 5, c); break;
      case 'formation': for (let i = 0; i < 3; i++) { p.rect(1 + o, 1 + i * 4 + o, 4, 3, c); p.rect(7 + o, 1 + i * 4 + o, 4, 3, c); } break;
      case 'map': p.rect(1 + o, 2 + o, 10, 8, c); p.line(4 + o, 2 + o, 4 + o, 9 + o, s); p.line(8 + o, 2 + o, 8 + o, 9 + o, s); break;
      case 'gear': p.disc(6 + o, 6 + o, 4, c); p.disc(6 + o, 6 + o, 1, s); p.rect(5 + o, 0 + o, 2, 12, c); p.rect(0 + o, 5 + o, 12, 2, c); break;
      case 'potion': p.rect(5 + o, 1 + o, 2, 3, c); p.disc(6 + o, 7 + o, 4, c); break;
      case 'pause': p.rect(3 + o, 2 + o, 2, 8, c); p.rect(7 + o, 2 + o, 2, 8, c); break;
      case 'save': p.rect(2 + o, 2 + o, 8, 8, c); p.rect(4 + o, 2 + o, 4, 3, s); break;
      case 'sound': p.rect(1 + o, 4 + o, 3, 4, c); p.poly([[4 + o, 4 + o], [8 + o, 1 + o], [8 + o, 11 + o], [4 + o, 8 + o]], c); p.px(10 + o, 5 + o, c); p.px(10 + o, 7 + o, c); break;
      case 'help': p.rect(4 + o, 1 + o, 4, 2, c); p.rect(8 + o, 2 + o, 2, 3, c); p.rect(5 + o, 5 + o, 3, 2, c); p.rect(5 + o, 9 + o, 2, 2, c); break;
      case 'sword': p.line(2 + o, 10 + o, 10 + o, 2 + o, c, 2); p.line(1 + o, 7 + o, 5 + o, 11 + o, c); break;
      case 'shield': p.poly([[2 + o, 1 + o], [10 + o, 1 + o], [10 + o, 6 + o], [6 + o, 11 + o], [2 + o, 6 + o]], c); break;
      case 'anvil': p.rect(1 + o, 3 + o, 10, 3, c); p.rect(4 + o, 6 + o, 4, 3, c); p.rect(2 + o, 9 + o, 8, 2, c); break;
      case 'skills': p.poly([[6 + o, 0 + o], [8 + o, 4 + o], [12 + o, 5 + o], [9 + o, 8 + o], [10 + o, 12 + o], [6 + o, 10 + o], [2 + o, 12 + o], [3 + o, 8 + o], [0 + o, 5 + o], [4 + o, 4 + o]], c); break;
      default: p.rect(3, 3, 6, 6, c);
    }
  });
  return p.c;
}

// ---------------------------------------------------------------- Chest (32x24)
function chest(open = false) {
  const p = new Pix(32, 26);
  p.rect(2, 12, 28, 13, '#5a3a1c'); p.rect(2, 12, 28, 2, '#7a5028');
  for (let x = 2; x < 30; x += 7) p.rect(x, 12, 1, 13, '#3a2410');
  p.rect(2, 18, 28, 2, '#8a8478'); p.rect(14, 15, 4, 5, '#c0a050');
  if (open) {
    p.rect(2, 0, 28, 6, '#4a2e14'); p.rect(2, 0, 28, 1, '#6a4420'); p.rect(4, 6, 24, 6, '#1a0e06');
    p.rect(6, 8, 4, 3, '#f0c040'); p.rect(18, 9, 5, 2, '#e0b030');
  } else {
    p.poly([[2, 12], [4, 5], [28, 5], [30, 12]], '#6a4420'); p.rect(4, 5, 24, 1, '#8a5c30');
    p.rect(2, 9, 28, 2, '#8a8478');
  }
  return p.outline().c;
}

// ---------------------------------------------------------------- Torch flame (8x14) frames
function flame(f) {
  const p = new Pix(10, 16);
  const sway = [0, 1, 0, -1][f];
  p.ellipse(5, 10, 4, 5, '#c0300c');
  p.ellipse(5 + sway * 0.5, 8, 3, 5, '#f07818');
  p.ellipse(5 + sway, 7, 2, 4, '#ffd040');
  p.px(5 + sway, 2 + (f % 2), '#ffd040');
  p.rect(4, 11, 2, 2, '#fff0b0');
  return p.c;
}

// ---------------------------------------------------------------- Portraits (44x52)
function portraitBg(p, top, bottom) {
  for (let y = 0; y < 52; y++) for (let x = 0; x < 44; x++) {
    const t = y / 51 + (BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) * 0.25;
    p.px(x, y, t < 0.5 ? top : bottom);
  }
}
function portraitWar() {
  const p = new Pix(44, 52);
  portraitBg(p, '#3a0c08', '#1a0604');
  p.poly([[0, 52], [4, 40], [16, 37], [28, 37], [40, 40], [44, 52]], '#8a1c14');
  p.ellipse(8, 44, 8, 5, STEEL[1]); p.ellipse(36, 44, 8, 5, STEEL[2]);
  p.rect(17, 34, 10, 6, '#7a5034');
  p.ellipse(22, 27, 9, 11, '#b0805a'); p.ellipse(25, 29, 6, 9, '#946444');
  p.poly([[13, 30], [31, 30], [29, 39], [22, 43], [15, 39]], '#5a1e10');
  p.rect(18, 33, 8, 2, '#2a0c06');
  p.rect(15, 24, 5, 3, '#1a0a04'); p.rect(24, 24, 5, 3, '#1a0a04');
  p.px(17, 25, '#ff7a3a'); p.px(26, 25, '#ff7a3a'); p.px(16, 25, '#ffb070'); p.px(25, 25, '#ffb070');
  p.line(25, 20, 30, 30, '#7a3a28');
  p.ellipse(22, 14, 13, 9, STEEL[2]); p.ellipse(19, 11, 7, 4, STEEL[1]); p.px(16, 9, STEEL[0]);
  p.rect(9, 18, 26, 4, STEEL[1]); p.rect(9, 18, 26, 1, STEEL[0]);
  p.rect(21, 18, 3, 13, STEEL[1]);
  p.rect(9, 20, 4, 16, STEEL[2]); p.rect(31, 20, 4, 16, STEEL[3]);
  p.line(11, 12, 4, 2, '#d8ccb0', 3); p.line(33, 12, 40, 2, '#b8ac90', 3);
  p.px(4, 1, '#efe6cc'); p.px(40, 1, '#efe6cc');
  p.rect(20, 3, 5, 3, '#b0281c');
  return p.c;
}
function portraitConquest() {
  const p = new Pix(44, 52);
  portraitBg(p, '#3a3424', '#14120a');
  // broken halo
  for (let a = -2.7; a < -0.45; a += 0.05) p.px(22 + Math.cos(a) * 17, 18 + Math.sin(a) * 13, '#f0d070');
  p.px(5, 14, '#fff0b0'); p.px(39, 15, '#fff0b0');
  // ivory pauldrons + white cloak
  p.poly([[0, 52], [4, 40], [16, 37], [28, 37], [40, 40], [44, 52]], '#d8d0b8');
  p.ellipse(8, 44, 8, 5, '#f4ecd8'); p.ellipse(36, 44, 8, 5, '#c8bea4');
  p.rect(20, 40, 4, 12, '#d8b050');
  p.rect(17, 34, 10, 6, '#a89c84');
  // pale face, hollow gold eyes, thin cruel mouth
  p.ellipse(22, 27, 8, 10, '#e0d8c8'); p.ellipse(25, 29, 5, 8, '#c8bea8');
  p.rect(15, 25, 5, 2, '#2a2414'); p.rect(24, 25, 5, 2, '#2a2414');
  p.px(17, 25, '#ffd040'); p.px(26, 25, '#ffd040');
  p.rect(19, 33, 7, 1, '#7a6a5a');
  // crown
  p.rect(13, 14, 18, 4, '#d8b050'); p.rect(13, 14, 18, 1, '#fff0b0');
  for (const x of [13, 17, 21, 25, 29]) { p.rect(x, 9, 2, 5, '#d8b050'); p.px(x, 8, '#f0d070'); }
  p.px(22, 15, '#c02010'); p.px(16, 15, '#4060c0');
  // bow limb over shoulder
  p.line(38, 4, 41, 30, '#8a6a3a', 2); p.line(38, 4, 37, 30, '#e8e0c8');
  return p.c;
}

function portraitHooded(kind) {
  const p = new Pix(44, 52);
  const cfg = {
    famine: { bg: ['#141410', '#060604'], hood: ['#2a2620', '#16140f'], face: '#8a8470' },
    pestilence: { bg: ['#1a2410', '#080c04'], hood: ['#c8c4b0', '#8a8670'], face: '#7a9a50' },
    death: { bg: ['#1a1a20', '#06060a'], hood: ['#1c1c22', '#0c0c10'], face: '#e8e4d8' },
  }[kind];
  portraitBg(p, cfg.bg[0], cfg.bg[1]);
  p.poly([[4, 52], [8, 22], [22, 4], [36, 22], [40, 52]], cfg.hood[1]);
  p.poly([[8, 52], [11, 22], [22, 7], [22, 52]], cfg.hood[0]);
  p.ellipse(22, 28, 9, 12, '#050404');
  if (kind === 'death') {
    p.disc(22, 26, 7, cfg.face); p.rect(18, 31, 9, 4, cfg.face);
    p.rect(17, 24, 4, 4, '#050404'); p.rect(24, 24, 4, 4, '#050404'); p.px(18, 25, '#80d0ff'); p.px(25, 25, '#80d0ff');
    for (let i = 0; i < 4; i++) p.px(19 + i * 2, 33, '#504c44');
    p.line(36, 4, 40, 52, '#5a4a36', 2); p.poly([[30, 2], [44, 6], [36, 8]], STEEL[1]);
  } else if (kind === 'famine') {
    p.ellipse(22, 29, 6, 9, cfg.face); p.rect(18, 26, 3, 3, '#1a1810'); p.rect(24, 26, 3, 3, '#1a1810');
    p.px(19, 27, '#d0c060'); p.px(25, 27, '#d0c060'); p.line(19, 34, 25, 34, '#3a362a');
    p.line(14, 46, 30, 46, '#a0823e'); p.line(22, 40, 22, 46, '#a0823e'); p.rect(12, 47, 5, 2, '#a0823e'); p.rect(27, 47, 5, 2, '#a0823e');
  } else {
    p.ellipse(22, 29, 7, 9, cfg.face); p.rect(18, 26, 3, 2, '#1a2a10'); p.rect(24, 26, 3, 2, '#1a2a10');
    p.px(20, 32, '#4a6a2a'); p.px(25, 33, '#4a6a2a'); p.px(17, 30, '#a0c060');
    p.rect(15, 8, 14, 3, '#c0a040'); p.px(16, 6, '#e0c060'); p.px(22, 5, '#e0c060'); p.px(28, 6, '#e0c060');
    p.line(38, 10, 34, 50, '#6a5030', 2);
  }
  return p.c;
}
function sealed(src) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height); ctx.globalAlpha = 1;
  const link = (x, y) => { ctx.fillStyle = '#6a6458'; ctx.fillRect(x, y, 3, 2); ctx.fillStyle = '#9a9488'; ctx.fillRect(x, y, 3, 1); };
  for (let i = 0; i < 16; i++) { link(i * 3, i * 3.3); link(41 - i * 3, i * 3.3); }
  ctx.fillStyle = '#7a6a3a'; ctx.fillRect(17, 22, 10, 9); ctx.fillStyle = '#c0a050'; ctx.fillRect(17, 22, 10, 1);
  ctx.fillStyle = '#7a6a3a'; ctx.fillRect(19, 17, 2, 5); ctx.fillRect(23, 17, 2, 5); ctx.fillRect(19, 16, 6, 2);
  ctx.fillStyle = '#1a1206'; ctx.fillRect(21, 25, 2, 3);
  return c;
}
function portraitEmpty() {
  const p = new Pix(44, 52);
  for (let y = 0; y < 52; y++) for (let x = 0; x < 44; x++) {
    const n = hash2(x, y, 5);
    p.px(x, y, n > 0.5 ? '#1c1a14' : '#16140f');
  }
  p.disc(22, 26, 9, '#221f17'); p.disc(22, 26, 7, '#16140f');
  p.line(22, 18, 22, 34, '#2c2820'); p.line(14, 26, 30, 26, '#2c2820');
  return p.c;
}

// ---------------------------------------------------------------- Skill icons (24x24)
function skillIcon(kind, col) {
  const p = new Pix(24, 24);
  const D = '#100c08';
  switch (kind) {
    case 'pierce': p.line(3, 20, 20, 3, col, 2); p.poly([[20, 3], [14, 4], [19, 9]], '#ffffff'); p.line(2, 21, 6, 17, '#8a6a3a', 2); for (const k of [7, 12]) p.px(k, 24 - k - 4, '#ffffff'); break;
    case 'crown': p.rect(4, 12, 16, 6, col); for (const x of [4, 9, 14, 19]) p.rect(x, 6, 2, 6, col); p.px(12, 14, '#c02010'); p.rect(4, 12, 16, 1, '#ffffff'); break;
    case 'volley': for (let i = 0; i < 3; i++) { p.line(3 + i * 5, 21, 12 + i * 5, 4, col, 1); p.px(12 + i * 5, 3, '#ffffff'); } break;
    case 'scroll': p.rect(5, 4, 14, 16, '#e8d8b0'); p.rect(4, 3, 16, 3, col); p.rect(4, 18, 16, 3, col); for (let y = 8; y < 17; y += 3) p.rect(7, y, 10, 1, '#8a6a3a'); p.disc(16, 17, 2, '#c02010'); break;
    case 'sun': p.disc(12, 12, 5, col); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.line(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, 12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11, '#fff0b0'); } break;
    case 'cleave': for (let a = 3.6; a < 5.9; a += 0.08) p.rect(12 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, 2, 2, col); p.line(5, 20, 19, 6, '#c0c0c0', 1); break;
    case 'shieldBreak': p.poly([[5, 3], [19, 3], [19, 13], [12, 21], [5, 13]], '#8a8e96'); p.line(13, 3, 10, 10, D, 2); p.line(10, 10, 14, 15, D, 2); p.line(14, 15, 11, 21, D); p.px(16, 8, col); p.px(7, 6, col); break;
    case 'blood': p.poly([[12, 2], [18, 12], [12, 21], [6, 12]], col); p.disc(12, 14, 6, col); p.rect(9, 11, 2, 4, '#ff9080'); break;
    case 'quake': p.rect(2, 16, 20, 6, '#5a4632'); p.line(12, 16, 9, 8, col, 2); p.line(12, 16, 16, 9, col, 2); p.line(9, 8, 6, 3, col); p.line(16, 9, 19, 3, col); p.line(12, 16, 12, 22, '#ff6020', 2); break;
    case 'apocalypse': p.disc(12, 13, 9, '#5a0808'); p.disc(12, 13, 6, col); p.disc(12, 13, 3, '#ffd040'); for (let i = 0; i < 6; i++) { const a = i * 1.05; p.line(12 + Math.cos(a) * 9, 13 + Math.sin(a) * 9, 12 + Math.cos(a) * 11, 13 + Math.sin(a) * 11, '#ff8a30'); } break;
    case 'wither': p.line(12, 22, 12, 10, '#5a4a2a', 2); p.poly([[12, 10], [5, 6], [7, 12]], col); p.poly([[12, 13], [19, 9], [17, 15]], '#6a7020'); p.px(6, 18, col); p.px(17, 20, col); break;
    case 'drain': p.disc(7, 15, 4, '#5a0e0a'); p.disc(18, 8, 4, col); for (let i = 0; i < 5; i++) p.px(9 + i * 2, 13 - i * 1.3, '#80ff60'); break;
    case 'plague': p.disc(12, 12, 7, col); p.disc(12, 12, 4, '#2a4a10'); for (const [x, y] of [[4, 4], [20, 5], [5, 19], [19, 19]]) p.disc(x, y, 1, col); break;
    case 'field': p.ellipse(12, 17, 10, 4, col); p.ellipse(12, 17, 6, 2, '#2a1e30'); for (const x of [6, 12, 18]) p.line(x, 15, x, 6, '#6a4a8a'); break;
    case 'scales': p.line(12, 3, 12, 20, col, 2); p.line(4, 7, 20, 7, col); p.line(4, 7, 3, 13, col); p.line(4, 7, 6, 13, col); p.rect(2, 13, 6, 2, col); p.line(20, 7, 19, 11, col); p.line(20, 7, 22, 11, col); p.rect(18, 11, 6, 2, col); p.rect(8, 20, 8, 2, col); break;
    case 'rend': p.line(4, 4, 20, 20, col, 3); p.line(4, 4, 20, 20, '#ffffff'); p.line(7, 16, 10, 13, col); p.line(14, 8, 17, 5, col); break;
    case 'grave': p.rect(7, 6, 10, 16, '#5a5e66'); p.disc(12, 7, 5, '#5a5e66'); p.rect(11, 6, 2, 10, col); p.rect(8, 9, 8, 2, col); break;
    case 'wraith': p.disc(12, 9, 6, col); p.poly([[6, 9], [18, 9], [19, 22], [16, 19], [12, 22], [8, 19], [5, 22]], col); p.rect(9, 8, 2, 2, D); p.rect(13, 8, 2, 2, D); break;
    case 'embrace': p.disc(12, 10, 6, '#e8e4d8'); p.rect(9, 9, 2, 2, D); p.rect(13, 9, 2, 2, D); p.line(3, 22, 9, 15, col, 2); p.line(21, 22, 15, 15, col, 2); break;
    case 'scythe': p.line(18, 22, 9, 3, '#6a5030', 2); for (let a = 3.3; a < 4.9; a += 0.08) p.rect(18 + Math.cos(a) * 12, 10 + Math.sin(a) * 8, 2, 2, col); p.px(5, 7, '#ffffff'); break;
    default: p.rect(6, 6, 12, 12, col);
  }
  return p.outline(D).c;
}

// ---------------------------------------------------------------- Title art (horsemen silhouettes)
function rider(kind, col, rim, gallop) {
  const p = new Pix(72, 56);
  const g = gallop;
  p.ellipse(32, 30, 15, 7, col);
  p.poly([[42, 26], [50, 12], [56, 10], [60, 15], [54, 18], [48, 30]], col);
  p.line(58, 14, 63, 18, col, 3);
  p.line(20, 32, 10 - g * 3, 44, col, 3); p.line(10 - g * 3, 44, 6 - g * 2, 52, col, 2);
  p.line(26, 34, 22 + g * 2, 46, col, 3); p.line(22 + g * 2, 46, 24 + g * 3, 54, col, 2);
  p.line(40, 34, 46 + g * 3, 44, col, 3); p.line(46 + g * 3, 44, 50 + g * 4, 52, col, 2);
  p.line(44, 32, 50 - g * 2, 46, col, 3); p.line(50 - g * 2, 46, 48 - g * 2, 54, col, 2);
  p.poly([[18, 27], [6, 26], [2, 32], [10, 30]], col);
  p.poly([[28, 24], [36, 24], [37, 8], [29, 8]], col);
  p.disc(33, 5, 3, col);
  p.poly([[29, 10], [10, 14], [4, 22], [28, 20]], col);
  if (kind === 'war') { p.line(37, 10, 48, -2, rim, 2); }
  if (kind === 'famine') { p.line(37, 10, 44, 2, col, 2); p.line(40, 2, 50, 2, rim); p.line(40, 2, 40, 6, rim); p.line(50, 2, 50, 6, rim); }
  if (kind === 'pestilence') { p.line(38, 0, 44, 10, rim); p.line(44, 10, 38, 20, rim); p.line(38, 0, 38, 20, '#888'); }
  if (kind === 'death') { p.line(38, 22, 44, 0, col, 2); p.poly([[44, 0], [58, 4], [46, 3]], rim); }
  p.line(30, 9, 30, 24, rim); p.line(18, 27, 28, 24, rim);
  return p.c;
}
function titleArt() {
  const { c, ctx } = makeCanvas(640, 480);
  const sky = ['#4a0a06', '#3a0806', '#2a0604', '#1a0403', '#0c0202', '#050101'];
  for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x += 1) {
    const t = Math.min(0.999, Math.max(0, (y / 360) + (BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) * 0.12));
    ctx.fillStyle = sky[Math.floor(t * sky.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  // blood moon
  const m = new Pix(90, 90);
  m.disc(45, 45, 40, '#8a1a0c'); m.disc(40, 40, 34, '#b0301a'); m.disc(36, 34, 8, '#8a1a0c'); m.disc(56, 52, 6, '#8a1a0c'); m.disc(30, 58, 4, '#9a2414');
  ctx.drawImage(m.c, 512, 132);
  // hills
  ctx.fillStyle = '#0a0302';
  for (let x = 0; x < 640; x++) {
    const h = 330 + Math.sin(x * 0.012) * 18 + Math.sin(x * 0.041) * 7;
    ctx.fillRect(x, Math.round(h), 1, 480);
  }
  const riders = [['war', '#160404', '#d03020'], ['famine', '#0c0c0a', '#a0a080'], ['pestilence', '#0e1208', '#90c050'], ['death', '#0a0a0e', '#c8d0e0']];
  riders.forEach(([k, col, rim], i) => {
    const r = rider(k, col, rim, i % 2);
    ctx.drawImage(r, 70 + i * 128, 238 + (i % 2) * 10 + Math.round(Math.sin(i * 1.4) * 6), 144, 112);
  });
  // ash particles
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = hash2(i, 1, 3) > 0.7 ? '#e06030' : '#5a3a30';
    ctx.fillRect(Math.floor(hash2(i, 2, 3) * 640), Math.floor(hash2(i, 3, 3) * 480), 1, 1);
  }
  return c;
}

// ---------------------------------------------------------------- Build all
export function buildSprites() {
  const war = portraitWar(), conquest = portraitConquest();
  const famine = portraitHooded('famine'), death = portraitHooded('death');
  const s = {
    skeleton: {
      idle: [skeleton({ bob: 0 }), skeleton({ bob: 1 })],
      walk: [skeleton({ leg: 2, bob: 1 }), skeleton({ leg: -2, bob: 1 })],
      windup: skeleton({ arm: 'raise', lean: 1 }),
      attack: skeleton({ arm: 'strike', lean: -1 }),
      hurt: skeleton({ lean: -3, bob: 1 }),
    },
    knight: {
      idle: [knight({ bob: 0 }), knight({ bob: 1 })],
      walk: [knight({ leg: 2, bob: 1 }), knight({ leg: -2, bob: 1 })],
      windup: knight({ arm: 'windup', glow: true }),
      attack: knight({ arm: 'attack' }),
      hurt: knight({ arm: 'guard', bob: 1 }),
    },
    captain: {
      idle: [knight({ bob: 0 }, 'captain'), knight({ bob: 1 }, 'captain')],
      walk: [knight({ leg: 2, bob: 1 }, 'captain'), knight({ leg: -2, bob: 1 }, 'captain')],
      windup: knight({ arm: 'windup', glow: true }, 'captain'),
      attack: knight({ arm: 'attack' }, 'captain'),
      hurt: knight({ arm: 'guard', bob: 1 }, 'captain'),
    },
    player: {},
    fp: { sword: fpSword(), axe: fpAxe(), crossbow: fpCrossbow(true), crossbowEmpty: fpCrossbow(false), dagger: fpDagger(), fists: fpFists() },
    icons: {},
    ui: {},
    chest: { closed: chest(false), open: chest(true) },
    flame: [0, 1, 2, 3].map(flame),
    portraits: {
      war, conquest, famine, death,
      warSealed: sealed(war), conquestSealed: sealed(conquest), famineSealed: sealed(famine), deathSealed: sealed(death),
      empty: portraitEmpty(),
    },
    skillIcons: {},
    title: titleArt(),
  };
  // per Horseman, per weapon, 2 lunge frames
  for (const cls of ['war', 'conquest', 'famine', 'death']) {
    s.player[cls] = {};
    for (const w of ['sword', 'axe', 'crossbow', 'dagger', 'fists']) s.player[cls][w] = [playerBack(w, 0, cls), playerBack(w, 4, cls)];
  }
  for (const sk of Object.values(SKILLS)) s.skillIcons[sk.id] = skillIcon(sk.icon, sk.color);
  for (const k of ['sword', 'axe', 'crossbow', 'dagger', 'potion', 'shard', 'longsword', 'scythe', 'bow', 'sickle', 'helm', 'crown', 'hood', 'plate', 'robe', 'jerkin',
    'gauntlet', 'wraps', 'greaves', 'boots', 'shield', 'tome', 'talisman', 'ring', 'signet', 'shardRelic', 'banner', 'scalesRelic', 'lantern',
    'elixir', 'ash', 'essence', 'soulfrag', 'core', 'gold']) s.icons[k] = icon(k);
  for (const k of ['bag', 'person', 'formation', 'map', 'gear', 'potion', 'pause', 'save', 'sound', 'help', 'sword', 'shield', 'skills', 'anvil']) {
    s.ui[k] = uiGlyph(k); s.ui[k + '_hi'] = uiGlyph(k, '#ffe58a');
  }
  addPhase4Sprites(s, { skeleton, knight }); // themed enemies, bosses, features, material icons
  addPhase5Sprites(s, { skeleton, knight }); // mythological bestiary, NPC portraits, catalog icons
  return s;
}
