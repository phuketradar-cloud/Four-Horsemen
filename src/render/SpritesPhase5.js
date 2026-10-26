import { Pix } from './gfx.js';
import { crawler, hound, wraith, setOf, knightSet } from './SpritesPhase4.js';

// Phase 5 generated pixel art (procedural placeholders in the established style; see the asset
// manifest in README): mythological enemies and bosses, NPC portraits, and new item icons.

// ---------------------------------------------------------------- multi-headed beast (front view)
// heads: number of heads (Cerberus 3, the Beast 5); horns / crowns / mane options.
function beastFront(pose = {}, pal) {
  const p = new Pix(64, 52);
  const [c0, c1, c2, c3] = pal.body;
  const lp = pose.leg || 0, lunge = pose.arm === 'strike' ? 3 : pose.arm === 'raise' ? -3 : 0;
  p.ellipse(32, 30, 20, 12, c2);                                           // body
  for (const x of [16, 26, 38, 48]) p.rect(x + (x < 32 ? lp : -lp), 34, 5, 16, c1);
  for (const x of [15, 25, 37, 47]) p.rect(x + (x < 32 ? lp : -lp), 49, 7, 2, c3);
  const n = pal.heads || 1;
  for (let i = 0; i < n; i++) {
    const hx = 32 + (i - (n - 1) / 2) * (n > 3 ? 10 : 14), hy = 16 + Math.abs(i - (n - 1) / 2) * 3 + lunge;
    if (pal.mane) p.disc(hx, hy, 8, pal.mane);
    p.ellipse(hx, hy, 6, 6, c1);
    p.ellipse(hx, hy + 5, 4, 3, c0);
    p.px(hx - 3, hy - 1, pal.eye); p.px(hx + 2, hy - 1, pal.eye);
    if (pal.horns) { p.line(hx - 4, hy - 4, hx - 7, hy - 10, pal.horns, 2); p.line(hx + 4, hy - 4, hx + 7, hy - 10, pal.horns, 2); }
    if (pal.crowns) { p.rect(hx - 4, hy - 8, 9, 2, pal.crowns); p.px(hx - 3, hy - 9, pal.crowns); p.px(hx + 3, hy - 9, pal.crowns); }
    if (pose.arm === 'strike' || pose.arm === 'raise') { p.rect(hx - 3, hy + 6, 7, 2, '#300808'); p.px(hx - 2, hy + 6, '#fff'); p.px(hx + 2, hy + 6, '#fff'); }
  }
  if (pal.tail) { p.line(52, 26, 62, 14, pal.tail, 2); p.disc(62, 13, 2, pal.tail); p.px(63, 12, '#ff4040'); }
  if (pal.wings) { p.poly([[14, 22], [0, 6], [4, 28]], pal.wings); p.poly([[50, 22], [64, 6], [60, 28]], pal.wings); }
  return p.outline().c;
}
function beastSet(pal) {
  return {
    idle: [beastFront({}, pal), beastFront({ leg: 1 }, pal)], walk: [beastFront({ leg: 2 }, pal), beastFront({ leg: -2 }, pal)],
    windup: beastFront({ arm: 'raise' }, pal), attack: beastFront({ arm: 'strike' }, pal), hurt: beastFront({ leg: 1 }, pal),
  };
}

// ---------------------------------------------------------------- the Great Dragon (front view)
function dragon(pose = {}) {
  const p = new Pix(80, 64);
  const [r0, r1, r2, r3] = ['#ff8060', '#c02818', '#801010', '#400606'];
  const wing = pose.arm === 'raise' ? -6 : 0;
  p.poly([[30, 30], [2, 6 + wing], [6, 40], [24, 44]], r3); p.poly([[50, 30], [78, 6 + wing], [74, 40], [56, 44]], r3);
  for (let i = 0; i < 3; i++) { p.line(30, 30, 4 + i * 6, 8 + wing + i * 10, r2); p.line(50, 30, 76 - i * 6, 8 + wing + i * 10, r2); }
  p.ellipse(40, 46, 16, 12, r2); p.ellipse(40, 48, 9, 8, '#d0a060');                 // body + belly plates
  for (let y = 42; y < 56; y += 3) p.line(33, y, 47, y, '#a07040');
  p.rect(36, 18, 8, 22, r1);                                                       // neck
  const hy = pose.arm === 'strike' ? 14 : 10;
  p.ellipse(40, hy, 10, 7, r1); p.ellipse(40, hy + 6, 7, 4, r2);                     // head + jaw
  p.line(32, hy - 4, 26, hy - 12, '#e0d0b0', 2); p.line(48, hy - 4, 54, hy - 12, '#e0d0b0', 2);
  p.rect(34, hy - 2, 3, 2, '#ffe060'); p.rect(43, hy - 2, 3, 2, '#ffe060');
  if (pose.arm === 'strike' || pose.arm === 'raise') { p.ellipse(40, hy + 8, 5, 3, '#a8f0ff'); p.px(40, hy + 8, '#ffffff'); }
  p.rect(26, 56, 6, 6, r3); p.rect(48, 56, 6, 6, r3);
  return p.outline().c;
}
const dragonSet = () => ({ idle: [dragon({}), dragon({})], walk: [dragon({}), dragon({})], windup: dragon({ arm: 'raise' }), attack: dragon({ arm: 'strike' }), hurt: dragon({}) });

// ---------------------------------------------------------------- NPC portraits (48x48, framed)
function portrait(pal) {
  const p = new Pix(48, 48);
  p.rect(0, 0, 48, 48, pal.bg[1]); p.rect(0, 0, 48, 24, pal.bg[0]);
  p.poly([[6, 48], [10, 30], [24, 24], [38, 30], [42, 48]], pal.robe);         // shoulders
  if (pal.hood) p.poly([[12, 30], [14, 8], [24, 3], [34, 8], [36, 30]], pal.hood);
  p.ellipse(24, 18, 8, 10, pal.skin);                                            // face
  p.rect(19, 16, 3, 2, pal.eye); p.rect(26, 16, 3, 2, pal.eye);
  if (pal.beard) p.poly([[17, 22], [31, 22], [28, 34], [20, 34]], pal.beard);
  if (pal.blind) p.rect(17, 15, 14, 3, '#e8e0d0');
  if (pal.crown) { p.rect(16, 6, 16, 3, pal.crown); p.px(18, 5, pal.crown); p.px(24, 4, pal.crown); p.px(30, 5, pal.crown); }
  if (pal.mark) p.rect(23, 9, 2, 4, pal.mark);
  p.line(0, 0, 47, 0, '#a0823e'); p.line(0, 47, 47, 47, '#a0823e'); p.line(0, 0, 0, 47, '#a0823e'); p.line(47, 0, 47, 47, '#a0823e');
  return p.c;
}

// ---------------------------------------------------------------- item icons (16x16)
function icon(kind) {
  const p = new Pix(16, 16);
  switch (kind) {
    case 'hammer': p.line(4, 14, 10, 6, '#6a4a2a', 2); p.rect(7, 1, 8, 6, '#8a929c'); p.rect(7, 1, 8, 1, '#c8d0d8'); break;
    case 'spear': p.line(2, 14, 12, 4, '#7a5a30', 1); p.poly([[11, 5], [15, 1], [13, 6]], '#c8d0d8'); break;
    case 'mask': p.ellipse(8, 8, 6, 7, '#d8ccb0'); p.rect(4, 6, 3, 2, '#000'); p.rect(9, 6, 3, 2, '#000'); p.line(5, 12, 11, 12, '#6a5a40'); break;
    case 'headdress': p.ellipse(8, 11, 6, 4, '#7a5a30'); p.line(3, 9, 1, 1, '#d8ccb0', 1); p.line(13, 9, 15, 1, '#d8ccb0', 1); p.line(8, 8, 8, 1, '#c02010'); break;
    case 'bonemail': p.rect(3, 2, 10, 12, '#5a5038'); for (let y = 3; y < 13; y += 2) p.line(4, y, 12, y, '#e8dcc0'); break;
    case 'regalia': p.poly([[2, 2], [14, 2], [13, 14], [3, 14]], '#c0a050'); p.rect(7, 2, 2, 12, '#fff0b0'); p.px(8, 6, '#c02010'); break;
    case 'bracers': p.rect(3, 4, 4, 9, '#8a929c'); p.rect(9, 4, 4, 9, '#8a929c'); p.rect(3, 7, 10, 1, '#565c66'); p.rect(3, 10, 10, 1, '#565c66'); break;
    case 'orb': p.disc(8, 8, 6, '#3a2a5a'); p.disc(8, 8, 4, '#8a6ad0'); p.px(6, 6, '#ffffff'); p.rect(5, 14, 6, 2, '#a0823e'); break;
    case 'parry': p.line(4, 13, 13, 3, '#c8d0d8', 1); p.line(2, 9, 8, 15, '#a0823e', 2); break;
    case 'soulring': for (let a = 0; a < Math.PI * 2; a += 0.3) p.px(8 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, '#a8d8f0'); p.disc(8, 4, 2, '#e0f8ff'); break;
    case 'sealRelic': p.disc(8, 8, 6, '#6a1010'); p.disc(8, 8, 4, '#a02020'); p.line(5, 5, 11, 11, '#ffd040'); p.line(11, 5, 5, 11, '#ffd040'); break;
    case 'idol': p.rect(5, 4, 6, 10, '#4a3a20'); p.disc(8, 4, 3, '#4a3a20'); p.px(7, 4, '#ff4040'); p.px(9, 4, '#ff4040'); p.rect(4, 14, 8, 2, '#2a2010'); break;
    case 'reliquary': p.rect(3, 6, 10, 8, '#c0c8d0'); p.poly([[3, 6], [8, 2], [13, 6]], '#e0e8f0'); p.rect(7, 8, 2, 4, '#c0a050'); break;
    case 'totem': p.rect(6, 1, 4, 14, '#6a4a2a'); p.rect(5, 2, 6, 3, '#a07040'); p.rect(5, 8, 6, 3, '#a07040'); p.px(7, 3, '#000'); p.px(9, 3, '#000'); break;
    case 'cursedblade': p.line(4, 12, 13, 2, '#5a3a7a', 2); p.line(5, 12, 13, 3, '#a070e0'); p.line(2, 10, 6, 14, '#2a1a30', 2); break;
    case 'chalice': p.poly([[3, 2], [13, 2], [10, 8], [6, 8]], '#c0a050'); p.rect(7, 8, 2, 4, '#a08030'); p.rect(4, 12, 8, 2, '#c0a050'); p.rect(5, 3, 6, 1, '#100c08'); break;
    default: p.rect(4, 4, 8, 8, '#888');
  }
  return p.outline('#050403').c;
}

export const NPC_PORTRAIT_PALETTES = {
  maren: { bg: ['#3a3020', '#1a160c'], robe: '#5a4a30', hood: '#4a3a24', skin: '#d8b890', eye: '#2a1a10', beard: '#e8e0d0' },
  ansel: { bg: ['#3a1010', '#1a0606'], robe: '#7a1810', skin: '#c89870', eye: '#1a0a06', beard: '#3a2a1a', mark: '#ffd040' },
  ysolde: { bg: ['#2a3a10', '#101a06'], robe: '#4a5a20', hood: '#3a4a18', skin: '#e0c0a0', eye: '#3a5a10' },
  ferryman: { bg: ['#1a2a3a', '#060c14'], robe: '#3a4a5a', hood: '#2a3a4a', skin: '#b8c8d0', eye: '#a8f0ff' },
  seer: { bg: ['#2a1040', '#0c0614'], robe: '#4a2a6a', skin: '#d8c8b8', eye: '#000', blind: true, crown: '#c0a050' },
};

export function addPhase5Sprites(s, { skeleton, knight }) {
  void skeleton;
  // ---- chapter II-IV additions
  s.cultist = setOf(wraith, { robe: ['#8a1810', '#5a0c08', '#300604'], eye: '#ffb030', blade: '#c0c0c0', hand: '#c89870' });
  s.lich = setOf(wraith, { robe: ['#4a2a6a', '#2a1a40', '#140a20'], eye: '#a0ff60', blade: '#a070e0', crown: '#c0a050', mist: '#a070e0' });
  // ---- chapter V
  s.abyssbeast = setOf(hound, { body: ['#a070d0', '#5a2a8a', '#3a1a5a', '#1a0a2a'], eye: '#ff40ff' });
  s.gorgon = setOf(wraith, { robe: ['#3a6a3a', '#24442a', '#102010'], eye: '#ffe040', blade: '#a0c060', snakes: '#5a9a3a', hand: '#7a9a6a' });
  s.nephilim = knightSet(knight, { steel: ['#f0c890', '#c08a50', '#8a5a2a', '#4a2e14', '#20140a'], capeA: '#8a6a3a', capeB: '#4a3a1a', tabard: '#a07040', crown: '#f0d070', eye: '#ffe060', glowEye: '#ffffff', weapon: 'axe' });
  s.chimera = beastSet({ body: ['#e0b070', '#a07030', '#6a4a20', '#2a1a0a'], eye: '#ff4020', heads: 2, mane: '#8a4a10', horns: '#e0d0b0', tail: '#5a9a3a' });
  // ---- chapter VI
  s.locust = setOf(crawler, { body: ['#c0a050', '#8a6a20', '#5a4410', '#2a2008'], eye: '#ff3020' });
  s.seraph = setOf(wraith, { robe: ['#f0f0e0', '#c8c0a0', '#8a8060'], eye: '#ffb040', blade: '#ffe060', wings: '#e8e0c0', hand: '#f0e0c0', crown: '#ffd040' });
  s.prophet = setOf(wraith, { robe: ['#f0e8d0', '#c0a050', '#6a5420'], eye: '#ff4040', blade: '#5a9a3a', crown: '#c0a050', hand: '#d8c0a0' });
  // ---- bosses
  s.gravekeeper = knightSet(knight, { steel: ['#a09080', '#6a5a4a', '#4a3e30', '#2a2218', '#100c08'], capeA: '#3a3020', capeB: '#1a160c', tabard: '#4a3a24', hood: '#2a2218', weapon: 'axe', eye: '#80e0ff', noHorns: true });
  s.cerberus = beastSet({ body: ['#6a4a40', '#3a2a24', '#24180e', '#0e0806'], eye: '#ff3010', heads: 3, horns: null });
  s.beast = beastSet({ body: ['#8a3a5a', '#5a1a3a', '#3a0a24', '#1a0410'], eye: '#ffd040', heads: 5, horns: '#e0d0b0', crowns: '#e0b040', wings: null, tail: '#5a1a3a' });
  s.dragon = dragonSet();
  s.abaddon = setOf(wraith, { robe: ['#3a1a2a', '#1e0a16', '#0a0408'], eye: '#ff60c0', blade: '#c060ff', wings: '#2a1020', crown: '#c0a050', mist: '#c060ff', hand: '#e0c0d0' });
  // ---- NPC portraits + icons
  s.npcPortraits = Object.fromEntries(Object.entries(NPC_PORTRAIT_PALETTES).map(([k, v]) => [k, portrait(v)]));
  for (const k of ['hammer', 'spear', 'mask', 'headdress', 'bonemail', 'regalia', 'bracers', 'orb', 'parry', 'soulring', 'sealRelic', 'idol', 'reliquary', 'totem', 'cursedblade', 'chalice']) s.icons[k] = icon(k);
}
