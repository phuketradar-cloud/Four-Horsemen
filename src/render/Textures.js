import { makeCanvas, hash2, BAYER4 } from './gfx.js';
import { VIEW } from '../data/config.js';

// Procedural 64x64 pixel-art wall textures, pre-shaded into N dithered fog levels.
// Placeholder-friendly: replace any generator with a loaded PNG of the same size.
// Phase 4: every dungeon theme gets its own tinted set (built once per theme, cached by the
// renderer) plus new wall kinds: class seals, runes, levers, hidden switches, portcullis.
const T = 64;

function fromPixels(fn) {
  const { c, ctx } = makeCanvas(T, T);
  const img = ctx.createImageData(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * T + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function stone(x, y, seed = 1, moss = 1) {
  const row = Math.floor(y / 16);
  const off = row % 2 ? 16 : 0;
  const bx = Math.floor((x + off) / 32);
  const lx = (x + off) % 32, ly = y % 16;
  if (ly === 0 || lx === 0) return [26, 25, 18];
  const bh = hash2(bx, row, seed);
  let r = 78 + bh * 30, g = 80 + bh * 26, b = 62 + bh * 18;
  const n = (hash2(x, y, seed + 7) - 0.5) * 18;
  r += n; g += n; b += n;
  if (ly === 1 || lx === 1) { r += 22; g += 22; b += 18; }
  if (ly === 15 || lx === 31) { r -= 24; g -= 24; b -= 20; }
  // pitting
  if (hash2(x * 3, y * 5, seed + 3) > 0.94) { r -= 30; g -= 30; b -= 26; }
  // moss on lower bricks
  const m = hash2(Math.floor(x / 3), Math.floor(y / 3), seed + 11);
  if (moss > 0 && y > 40 && m > 0.72 + (1 - moss) * 0.25 - (y - 40) * 0.006) { r = r * 0.6 + 14; g = g * 0.7 + 34; b = b * 0.5 + 6; }
  return [r, g, b];
}

function crackOverlay(x, y) {
  // a thin jagged crack used on secret walls (subtle tell)
  const cx = 30 + Math.round(Math.sin(y * 0.35) * 3 + Math.sin(y * 0.9) * 1.5);
  return y > 10 && y < 56 && Math.abs(x - cx) < 1;
}

function door(x, y) {
  if (x < 6 || x > 57 || y < 5) {
    const s = stone(x, y, 4); return [s[0] * 0.9, s[1] * 0.9, s[2] * 0.85];
  }
  if (x === 6 || x === 57 || y === 5) return [20, 14, 8];
  const plank = Math.floor((x - 7) / 9);
  const lx = (x - 7) % 9;
  let r = 92 + hash2(plank, 0, 9) * 26, g = 58 + hash2(plank, 1, 9) * 14, b = 30;
  const grain = Math.sin(y * 0.7 + plank * 3 + hash2(x, plank, 2) * 2) * 8;
  r += grain; g += grain * 0.6;
  if (lx === 0) { r = 40; g = 24; b = 12; }
  if (lx === 1) { r += 16; g += 10; }
  // iron bands + rivets
  if ((y >= 16 && y <= 19) || (y >= 46 && y <= 49)) {
    r = 52; g = 50; b = 48;
    if (y === 16 || y === 46) { r = 90; g = 88; b = 84; }
    if ((x - 10) % 12 === 0 && (y === 17 || y === 47)) { r = 140; g = 136; b = 120; }
  }
  // ring handle
  const dx = x - 46, dy = y - 33;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 3 && d < 5) { r = 120; g = 112; b = 80; }
  return [r, g, b];
}

function gate(x, y) {
  if (x < 4 || x > 59 || y < 3) { const s = stone(x, y, 8); return [s[0] * 0.8, s[1] * 0.75, s[2] * 0.75]; }
  let r = 14, g = 8, b = 8;
  // red sigil glow in the dark behind bars
  const dx = x - 32, dy = y - 34;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 12 && d < 15) { r = 190; g = 34; b = 18; }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * 13, py = Math.sin(a) * 13;
    const a2 = ((k + 2) / 5) * Math.PI * 2 - Math.PI / 2;
    const qx = Math.cos(a2) * 13, qy = Math.sin(a2) * 13;
    // distance from point to segment p-q
    const vx = qx - px, vy = qy - py, wx = dx - px, wy = dy - py;
    const tt = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    const ex = wx - vx * tt, ey = wy - vy * tt;
    if (ex * ex + ey * ey < 0.8) { r = 220; g = 50; b = 24; }
  }
  if (d < 18 && r < 40) { r += (18 - d) * 2.2; }
  // iron bars
  const lx = (x - 4) % 8;
  if (lx <= 1) { r = lx ? 70 : 96; g = lx ? 68 : 94; b = lx ? 72 : 98; }
  if ((y >= 18 && y <= 20) || (y >= 48 && y <= 50)) { r = 64; g = 62; b = 66; if (y === 18 || y === 48) { r = 100; g = 98; b = 100; } }
  return [r, g, b];
}

function torchWall(x, y) {
  const s = stone(x, y, 1);
  // iron sconce bracket
  if (x >= 28 && x <= 35 && y >= 30 && y <= 33) return [44, 40, 36];
  if (x >= 30 && x <= 33 && y >= 33 && y <= 42) return [36, 32, 28];
  if (x >= 29 && x <= 34 && y >= 26 && y <= 29) return [70, 48, 26];
  // soot above torch
  const dx = x - 32, dy = y - 16;
  const soot = Math.max(0, 1 - Math.sqrt(dx * dx * 1.6 + dy * dy) / 16);
  // warm light falloff
  const lx = x - 32, ly = y - 26;
  const light = Math.max(0, 1 - Math.sqrt(lx * lx + ly * ly) / 34) * 0.55;
  return [s[0] * (1 - soot * 0.7) + light * 90, s[1] * (1 - soot * 0.7) + light * 50, s[2] * (1 - soot * 0.7) + light * 10];
}

// ---------------------------------------------------------------- Phase 4 wall kinds
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  const ex = wx - vx * t, ey = wy - vy * t;
  return Math.sqrt(ex * ex + ey * ey);
};
function barrier(x, y) { // War: weakened rubble + split timbers
  let [r, g, b] = stone(x, y, 21);
  const blk = hash2(Math.floor(x / 11), Math.floor(y / 9), 5);
  r = r * (0.7 + blk * 0.4); g = g * (0.68 + blk * 0.4); b = b * (0.65 + blk * 0.4);
  if (segDist(x, y, 4, 8, 60, 56) < 3 || segDist(x, y, 6, 52, 58, 14) < 3) { r = 96; g = 62; b = 30; if (hash2(x, y, 4) > 0.6) { r -= 20; g -= 14; } }
  for (const [ax, ay, bx2, by2] of [[20, 0, 30, 30], [30, 30, 24, 64], [30, 30, 50, 40]]) if (segDist(x, y, ax, ay, bx2, by2) < 1) { r = 18; g = 14; b = 10; }
  return [r, g, b];
}
function sigilDoor(x, y) { // Conquest: smooth stone door with a golden target
  if (x < 5 || x > 58 || y < 4) { const s = stone(x, y, 31); return [s[0] * 0.85, s[1] * 0.85, s[2] * 0.85]; }
  let r = 110 + hash2(x, y, 3) * 10, g = 104 + hash2(x, y, 4) * 10, b = 90;
  if (x === 32 || x === 31) { r = 50; g = 46; b = 40; }
  const d = Math.hypot(x - 32, y - 20);
  if (d < 9 && d > 7) { r = 240; g = 200; b = 90; }
  if (d < 5 && d > 3.5) { r = 220; g = 170; b = 60; }
  if (d < 1.6) { r = 255; g = 240; b = 160; }
  return [r, g, b];
}
function rootsWall(x, y) { // Famine: black blighted roots
  let r = 20, g = 18, b = 10;
  for (let k = 0; k < 7; k++) {
    const cx = 6 + k * 9 + Math.sin(y * 0.15 + k * 2) * 5;
    const w = 2.2 + Math.sin(y * 0.1 + k) * 0.8;
    if (Math.abs(x - cx) < w) { r = 54 + k * 2; g = 40; b = 22; if (Math.abs(x - cx) < 0.8) { r += 18; g += 12; } }
  }
  if (hash2(x, y, 41) > 0.985) { r = 170; g = 210; b = 60; }
  return [r, g, b];
}
function soulSeal(x, y) { // Death: pale door of bound souls
  if (x < 5 || x > 58 || y < 4) { const s = stone(x, y, 51); return [s[0] * 1.1, s[1] * 1.12, s[2] * 1.15]; }
  let r = 150, g = 156, b = 162;
  const n = (hash2(x, y, 9) - 0.5) * 14; r += n; g += n; b += n;
  for (const [cx, cy] of [[20, 22], [44, 22], [32, 42]]) {
    const d = Math.hypot(x - cx, (y - cy) * 0.8);
    if (d < 7) { r = 120 + (7 - d) * 18; g = 190 + (7 - d) * 8; b = 230; }
    if (Math.abs(x - cx + 2) < 1 && Math.abs(y - cy + 1) < 1) { r = 20; g = 30; b = 50; }
    if (Math.abs(x - cx - 2) < 1 && Math.abs(y - cy + 1) < 1) { r = 20; g = 30; b = 50; }
  }
  return [r, g, b];
}
function portcullis(x, y) {
  if (x < 3 || x > 60 || y < 2) { const s = stone(x, y, 61); return [s[0] * 0.8, s[1] * 0.8, s[2] * 0.8]; }
  let r = 10, g = 8, b = 6;
  if ((x - 3) % 9 <= 1 || (y - 2) % 12 <= 1) { r = 84; g = 82; b = 86; if ((x - 3) % 9 === 0 || (y - 2) % 12 === 0) { r = 120; g = 118; b = 120; } }
  if (y > 56 && (x - 3) % 9 <= 1) { r = 150; g = 150; b = 150; }
  return [r, g, b];
}
const RUNE_GLYPH = [
  (dx, dy) => { const d = Math.hypot(dx, dy); return (d > 9 && d < 11.5) || d < 2.5; },            // BIRTH: ring + seed
  (dx, dy) => (Math.abs(dx) < 1.5 + (dy + 10) * 0.35 && dy > -10 && dy < 8) && !(Math.abs(dx) < (dy + 10) * 0.35 - 1 && dy > -6), // BLOOD: drop
  (dx, dy) => Math.abs(dx - dy) < 2 || Math.abs(dx + dy) < 2,                                      // BONE: crossed bones
];
function rune(sym, lit) {
  return (x, y) => {
    const s = stone(x, y, 71 + sym);
    const dx = x - 32, dy = y - 30;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
      const on = RUNE_GLYPH[sym](dx, dy);
      if (on) return lit ? [140, 240, 255] : [34, 30, 24];
      if (lit) { const d = Math.hypot(dx, dy); return [s[0] + (14 - d) * 3, s[1] + (14 - d) * 6, s[2] + (14 - d) * 8]; }
    }
    return s;
  };
}
function lever(pulled) {
  return (x, y) => {
    const s = stone(x, y, 81);
    if (x >= 24 && x <= 40 && y >= 22 && y <= 46) return [44, 42, 40];
    const hy = pulled ? 42 : 18;
    if (segDist(x, y, 32, 34, 44, hy) < 1.8) return [120, 112, 100];
    if (Math.hypot(x - 44, y - hy) < 3) return pulled ? [80, 200, 80] : [160, 40, 30];
    return s;
  };
}
function hiddenSwitch(pressed) {
  return (x, y) => {
    const s = stone(x, y, 1);
    const dx = x - 32, dy = y - 36;
    const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    const spiral = Math.abs(((d - a * 1.6) % 6 + 6) % 6 - 3) < 0.7 && d < 8;
    if (spiral) return pressed ? [20, 18, 14] : [s[0] * 0.72, s[1] * 0.72, s[2] * 0.7];
    if (pressed && d < 9) return [s[0] * 0.6, s[1] * 0.6, s[2] * 0.6];
    return s;
  };
}

function shade(src, level) {
  const { c, ctx } = makeCanvas(T, T);
  ctx.drawImage(src, 0, 0);
  if (level === 0) return c;
  const img = ctx.getImageData(0, 0, T, T);
  const dark = Math.min(0.94, level / (VIEW.shadeLevels - 1) * 0.94);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4;
    const bay = BAYER4[(y & 3) * 4 + (x & 3)];
    let f = 1 - dark + (bay - 0.5) * 0.12;
    f = f < 0 ? 0 : f;
    // quantise to a 6-step ramp for that crunchy retro look
    img.data[i] = Math.round((img.data[i] * f) / 6) * 6;
    img.data[i + 1] = Math.round((img.data[i + 1] * f) / 6) * 6;
    img.data[i + 2] = Math.round((img.data[i + 2] * f) / 6) * 6;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// theme: { wall: [r,g,b] multipliers, moss: 0..1 } (data/dungeons). Default = the Phase 1 crypt.
export function buildTextures(theme = null) {
  const mult = theme?.wall || [1, 1, 1];
  const moss = theme?.moss ?? 1;
  const tint = (fn, tintIt = true) => (x, y) => {
    const c = fn(x, y);
    return tintIt ? [Math.min(255, c[0] * mult[0]), Math.min(255, c[1] * mult[1]), Math.min(255, c[2] * mult[2])] : c;
  };
  const wallFn = (x, y) => stone(x, y, 1, moss);
  const base = {
    wall: fromPixels(tint(wallFn)),
    torch: fromPixels(tint(torchWall)),
    door: fromPixels(tint(door)),
    gate: fromPixels(tint(gate)),
    secret: fromPixels(tint((x, y) => {
      const s = wallFn(x, y);
      return crackOverlay(x, y) ? [s[0] * 0.55, s[1] * 0.55, s[2] * 0.55] : s;
    })),
    barrier: fromPixels(tint(barrier)),
    sigil: fromPixels(tint(sigilDoor, false)),
    roots: fromPixels(rootsWall),
    soulseal: fromPixels(soulSeal),
    portcullis: fromPixels(tint(portcullis)),
    lever: fromPixels(tint(lever(false))),
    leverOn: fromPixels(tint(lever(true))),
    switch: fromPixels(tint(hiddenSwitch(false))),
    switchOn: fromPixels(tint(hiddenSwitch(true))),
  };
  for (let s = 0; s < 3; s++) { base[`rune${s}`] = fromPixels(tint(rune(s, false))); base[`rune${s}on`] = fromPixels(tint(rune(s, true), false)); }
  const shaded = {};
  for (const [k, tex] of Object.entries(base)) {
    shaded[k] = [];
    for (let l = 0; l < VIEW.shadeLevels; l++) shaded[k].push(shade(tex, l));
  }
  return { base, shaded, size: T };
}
