import { SCREEN } from '../data/config.js';
import { HORSEMEN, CLASS_ORDER, RESOURCES } from '../data/characters.js';
import { SKILLS } from '../data/skills.js';
import { drawText, wrapText, textWidth } from '../render/PixelFont.js';
import { metalFrame, metalPlate } from '../render/MetalFrame.js';

// CHOOSE YOUR HORSEMAN - full 16:9 screen (960x540, drawn without the 640x480 CLASSIC offset).
//   cards    four painted portrait cards; the selected one lifts, glows in its accent colour and
//            breathes; hover brightens; click selects, double-click (or BEGIN) asks to confirm
//   profile  name / title / role / lore / difficulty | stat bars | passive, mechanic, skill cards
//            (hover a skill for its tooltip)
//   actions  BACK, BEGIN YOUR JOURNEY (opens a confirmation), keyboard hints
// Keyboard (GameManager select update): A/D or arrows choose, W/S toggle BEGIN/BACK, ENTER
// confirms (asks first), ESC backs out / closes the confirmation.
export const SELECT_ACCENT = { conquest: '#f0c040', war: '#e8402e', famine: '#9acd32', death: '#7ad0f5' };
const STATS = [['HP', 'hp'], ['ATK', 'atk'], ['DEF', 'def'], ['CRIT', 'crit'], ['SPEED', 'speed']];
const SPEED = { SLOW: 0.34, NORMAL: 0.67, FAST: 1 };
const CARD = { w: 196, h: 262, gap: 18, y: 44, pw: 176, ph: 208 };
const PROF = { x: 16, y: 316, w: 928, h: 152 };
const BG = { src: 'assets/title/menu_bg.webp', img: null, tried: false };
const anim = { lift: [0, 0, 0, 0], last: null, sel: -1, changedAt: 0 };
const SKULL = ['0111110', '1111111', '1001001', '1001001', '1111111', '0110110', '0101010'];

function background(ctx, g) {
  if (!BG.tried && typeof Image !== 'undefined') { BG.tried = true; const i = new Image(); i.onload = () => { BG.img = i; }; i.src = BG.src; }
  ctx.save();
  if (BG.img) {
    const s = Math.max(SCREEN.w / BG.img.width, SCREEN.h / BG.img.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(BG.img, (SCREEN.w - BG.img.width * s) / 2, (SCREEN.h - BG.img.height * s) / 2, BG.img.width * s, BG.img.height * s);
  } else if (g.sprites.title) ctx.drawImage(g.sprites.title, 0, 0, SCREEN.w, SCREEN.h);
  ctx.restore();
  ctx.globalAlpha = 0.62; ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h); ctx.globalAlpha = 1;
  // vignette bands
  for (let i = 0; i < 24; i++) { ctx.globalAlpha = 0.03 * (24 - i) / 24 * 8; ctx.fillStyle = '#000'; ctx.fillRect(0, i * 2, SCREEN.w, 2); ctx.fillRect(0, SCREEN.h - i * 2 - 2, SCREEN.w, 2); }
  ctx.globalAlpha = 1;
}

// Forged metal frame (render/MetalFrame.js); accent = inner glow line + corner gems.
function ornate(ctx, x, y, w, h, th, accent, fill = '#0c0907', extra = {}) {
  void th;
  metalFrame(ctx, x, y, w, h, { band: 6, fill, accent: accent || null, ...extra });
}

function glow(ctx, x, y, w, h, color, strength) {
  for (let i = 1; i <= 6; i++) {
    ctx.globalAlpha = strength * (0.32 - i * 0.045); ctx.fillStyle = color;
    ctx.fillRect(x - i - 2, y - i - 2, w + (i + 2) * 2, 1); ctx.fillRect(x - i - 2, y + h + i + 1, w + (i + 2) * 2, 1);
    ctx.fillRect(x - i - 2, y - i - 2, 1, h + (i + 2) * 2); ctx.fillRect(x + w + i + 1, y - i - 2, 1, h + (i + 2) * 2);
  }
  ctx.globalAlpha = 1;
}

function skull(ctx, x, y, color, s = 2) {
  ctx.fillStyle = color;
  SKULL.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '1') ctx.fillRect(x + c * s, y + r * s, s, s); });
}

function dotted(ctx, parts, cx, y, color) {
  const gap = 12, widths = parts.map((p) => textWidth(p));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  let x = Math.round(cx - total / 2);
  parts.forEach((p, i) => {
    drawText(ctx, p, x, y, color); x += widths[i];
    if (i < parts.length - 1) { ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x + gap / 2 - 1, y + 3, 2, 2); x += gap; }
  });
}

function keyCap(ctx, x, y, label, th) {
  const w = Math.max(14, textWidth(label) + 8);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 15);
  ctx.fillStyle = th.stoneMid; ctx.fillRect(x, y, w, 13);
  ctx.fillStyle = th.stoneLight; ctx.fillRect(x, y, w, 1);
  drawText(ctx, label, x + w / 2, y + 3, '#e8dcc0', { align: 'center' });
  return w;
}

function portraitOf(g, id) {
  const P = g.sprites.portraits;
  return P.card?.[id] || P.hi?.[id] || P[id];
}

export function drawCharacterSelect(ctx, g, t) {
  const th = g.theme, ui = g.ui;
  ctx.imageSmoothingEnabled = false;
  background(ctx, g);
  ui.block(0, 0, SCREEN.w, SCREEN.h);
  const dt = anim.last == null ? 0 : Math.min(0.1, Math.max(0, t - anim.last)); anim.last = t;
  if (anim.sel !== g.selectIndex) { anim.sel = g.selectIndex; anim.changedAt = t; }
  const sel = CLASS_ORDER[g.selectIndex], c = HORSEMEN[sel], acc = SELECT_ACCENT[sel] || c.colors.accent;
  const modal = !!g.selectConfirm;

  // ---- title banner
  const title = 'CHOOSE YOUR HORSEMAN', tw = textWidth(title, 3);
  ornate(ctx, SCREEN.w / 2 - tw / 2 - 26, 3, tw + 52, 31, th, acc, '#0e0a07', { corners: 'spike' });
  drawText(ctx, title, SCREEN.w / 2, 12, '#e8dcc0', { align: 'center', scale: 3 });

  // ---- cards
  const x0 = Math.round((SCREEN.w - (CARD.w * 4 + CARD.gap * 3)) / 2);
  let hoverCard = -1;
  CLASS_ORDER.forEach((id, i) => {
    const h = HORSEMEN[id], a = SELECT_ACCENT[id] || h.colors.accent;
    const active = i === g.selectIndex;
    const bx = x0 + i * (CARD.w + CARD.gap);
    const hov = !modal && ui.hover(bx, CARD.y - 6, CARD.w, CARD.h + 6);
    if (hov) hoverCard = i;
    const target = active ? 6 : hov ? 2 : 0;
    anim.lift[i] += (target - anim.lift[i]) * Math.min(1, dt * 12);
    const y = Math.round(CARD.y - anim.lift[i]);
    if (!modal) ui.button(bx, CARD.y - 6, CARD.w, CARD.h + 6, () => {
      if (g.selectIndex === i && g.realTime - (g.lastCardClick || 0) < 0.4) g.selectConfirm = true;
      g.lastCardClick = g.realTime;
      if (g.selectIndex !== i) g.chooseCard(i);
      g.menuIndex = 0;
    }, { sound: false });
    if (active) glow(ctx, bx, y, CARD.w, CARD.h, a, 0.75 + Math.sin(t * 3) * 0.25);
    ornate(ctx, bx, y, CARD.w, CARD.h, th, active ? a : null, active ? '#16100a' : '#0c0907', { metal: active ? 'gold' : 'iron', crest: active });
    // portrait (selected one breathes: a 1px slow drift)
    const px = bx + (CARD.w - CARD.pw) / 2, py = y + 10;
    ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, CARD.pw + 2, CARD.ph + 2);
    const por = portraitOf(g, h.portrait);
    if (por) {
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, CARD.pw, CARD.ph); ctx.clip();
      const bob = active ? Math.round(Math.sin(t * 1.6)) : 0;
      ctx.drawImage(por, px, py + bob - (active ? 1 : 0), CARD.pw, CARD.ph + (active ? 2 : 0));
      ctx.restore();
    }
    // accent wash at the bottom of the portrait + embers on the selected card
    const grad = ctx.createLinearGradient(0, py + CARD.ph - 60, 0, py + CARD.ph);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, active ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad; ctx.fillRect(px, py + CARD.ph - 60, CARD.pw, 60);
    if (active) {
      for (let k = 0; k < 10; k++) {
        const ph = (t * 0.35 + k * 0.137) % 1;
        const ex = px + 8 + ((k * 53) % (CARD.pw - 16)) + Math.round(Math.sin(t * 2 + k) * 3);
        const ey = py + CARD.ph - ph * CARD.ph;
        ctx.globalAlpha = (1 - ph) * 0.8; ctx.fillStyle = a; ctx.fillRect(ex, ey, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else { ctx.globalAlpha = hov ? 0.2 : 0.45; ctx.fillStyle = '#000'; ctx.fillRect(px, py, CARD.pw, CARD.ph); ctx.globalAlpha = 1; }
    ctx.strokeStyle = active ? a : th.bronzeDark; ctx.lineWidth = 1; ctx.strokeRect(px - 0.5, py - 0.5, CARD.pw + 1, CARD.ph + 1);
    // labels
    const ty = py + CARD.ph + 4;
    drawText(ctx, h.name, bx + CARD.w / 2, ty, active ? a : hov ? '#e8dcc0' : '#b8a888', { align: 'center', scale: 2 });
    drawText(ctx, h.title, bx + CARD.w / 2, ty + 17, active ? '#e8dcc0' : '#8a7c64', { align: 'center' });
    dotted(ctx, [RESOURCES[h.resource].name, ...h.role.split(' / ')], bx + CARD.w / 2, ty + 27, active ? a : '#6a6050');
  });

  // ---- profile panel (fades in on change)
  const fade = Math.min(1, (t - anim.changedAt) * 5);
  ornate(ctx, PROF.x, PROF.y, PROF.w, PROF.h, th, acc, '#0d0a07', { crest: true });
  ctx.globalAlpha = 0.5 + fade * 0.5;
  const P = PROF;
  // column A: identity
  const ax = P.x + 16;
  drawText(ctx, c.name, ax, P.y + 12, acc, { scale: 3 });
  drawText(ctx, c.title, ax, P.y + 38, '#d8c8a0', { scale: 2 });
  ctx.fillStyle = th.bronze; ctx.fillRect(ax, P.y + 57, 280, 1); ctx.fillStyle = acc; ctx.fillRect(ax + 134, P.y + 55, 5, 5);
  drawText(ctx, c.epithet, ax, P.y + 64, acc);
  let ly = P.y + 76;
  for (const l of wrapText(c.lore, 47).slice(0, 4)) { drawText(ctx, l, ax, ly, '#c8b898'); ly += 10; }
  drawText(ctx, 'DIFFICULTY', ax, P.y + P.h - 20, '#8a7c64');
  const UI = g.sprites.uiIcons;
  for (let k = 0; k < 3; k++) {
    const lit = k < c.difficulty, img = UI?.[lit ? 'skull_lit' : 'skull_dim'];
    if (img) ctx.drawImage(img, ax + 66 + k * 18, P.y + P.h - 25, 16, 16); else skull(ctx, ax + 68 + k * 18, P.y + P.h - 24, lit ? acc : '#3a3228');
  }
  drawText(ctx, `ROLE: ${c.role}`, ax + 140, P.y + P.h - 20, '#8a7c64');
  // divider
  const div = (x) => { ctx.fillStyle = th.bronzeDark; ctx.fillRect(x, P.y + 12, 1, P.h - 24); ctx.fillStyle = th.bronze; ctx.fillRect(x - 1, P.y + P.h / 2 - 1, 3, 3); };
  div(P.x + 312);
  // column B: stats
  const bx = P.x + 328;
  const max = {};
  for (const [, k] of STATS) if (k !== 'speed') max[k] = Math.max(...CLASS_ORDER.map((id) => HORSEMEN[id].base[k]));
  STATS.forEach(([label, k], i) => {
    const y = P.y + 14 + i * 26;
    const v = k === 'speed' ? c.base.speed : c.base[k];
    const frac = k === 'speed' ? SPEED[v] ?? 0.5 : v / max[k];
    drawText(ctx, label, bx, y + 2, '#d8c8a0', { scale: 2 });
    const bw = 118, bxx = bx + 66;
    ctx.fillStyle = '#000'; ctx.fillRect(bxx - 1, y, bw + 2, 14);
    ctx.fillStyle = '#1a140e'; ctx.fillRect(bxx, y + 1, bw, 12);
    // other Horsemen's best as a faint ghost, this one's value in the accent colour
    const shown = Math.round(bw * frac * (0.25 + 0.75 * fade));
    ctx.fillStyle = acc; ctx.fillRect(bxx, y + 1, shown, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(bxx, y + 1, shown, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bxx, y + 11, shown, 2);
    for (let s = 1; s < 4; s++) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bxx + Math.round(bw * s / 4), y + 1, 1, 12); }
    drawText(ctx, k === 'speed' ? v : `${v}${k === 'crit' ? '%' : ''}`, bxx + bw + 10, y + 2, '#e8dcc0', { scale: 2 });
  });
  div(P.x + 612);
  // column C: passive, mechanic, skills
  const cx = P.x + 628, cw = P.w - 628 - 14;
  const res = RESOURCES[c.resource];
  const pIcon = g.sprites.passiveIcons?.[c.passive.id];
  const px0 = pIcon ? cx + 36 : cx;
  if (pIcon) { ctx.fillStyle = '#000'; ctx.fillRect(cx - 2, P.y + 8, 34, 34); ctx.fillStyle = acc; ctx.fillRect(cx - 1, P.y + 9, 32, 32); ctx.drawImage(pIcon, cx, P.y + 10, 30, 30); }
  drawText(ctx, 'PASSIVE', px0, P.y + 10, '#8a7c64');
  drawText(ctx, c.passive.name, px0 + 48, P.y + 10, acc);
  let cy = P.y + 21;
  for (const l of wrapText(c.passive.desc, Math.floor((cw - (px0 - cx)) / 6)).slice(0, 2)) { drawText(ctx, l, px0, cy, '#c8b898'); cy += 9; }
  cy = Math.max(cy, P.y + 42);
  const rIcon = UI?.[`res_${c.resource}`];
  const rx = rIcon ? cx + 16 : cx;
  if (rIcon) ctx.drawImage(rIcon, cx, cy - 1, 13, 13);
  drawText(ctx, res.name, rx, cy + 3, res.color);
  drawText(ctx, c.mechanic.name, rx + textWidth(res.name) + 8, cy + 3, acc);
  cy += 14;
  for (const l of wrapText(c.mechanic.desc, Math.floor(cw / 6)).slice(0, 3)) { drawText(ctx, l, cx, cy, '#c8b898'); cy += 9; }
  drawText(ctx, 'ACTIVE SKILLS', cx, P.y + 98, '#8a7c64');
  const skills = [...c.skills, c.ultimate];
  let tip = null;
  skills.forEach((id, i) => {
    const s = SKILLS[id], sx = cx + i * 56, sy = P.y + 109, sz = 36;
    const hov = !modal && ui.hover(sx, sy, sz, sz);
    ctx.fillStyle = '#000'; ctx.fillRect(sx - 2, sy - 2, sz + 4, sz + 4);
    ctx.fillStyle = hov ? acc : i === 4 ? '#c09030' : th.bronze; ctx.fillRect(sx - 1, sy - 1, sz + 2, sz + 2);
    ctx.fillStyle = '#0a0806'; ctx.fillRect(sx, sy, sz, sz);
    const icon = g.sprites.skillIconsHi?.[id] || g.sprites.skillIcons?.[id];
    if (icon) ctx.drawImage(icon, sx + 2, sy + 2, 32, 32);
    drawText(ctx, i === 4 ? 'ULT' : String(i + 1), sx + sz + 4, sy + 1, i === 4 ? '#ffe58a' : '#8a7c64');
    if (hov) tip = { s, x: sx + sz / 2, y: sy - 6, ult: i === 4 };
  });
  ctx.globalAlpha = 1;

  // ---- action bar
  const items = [
    { label: 'BEGIN YOUR JOURNEY', run: () => { g.selectConfirm = true; } },
    { label: 'BACK', run: () => g.toTitle() },
  ];
  g.activeMenu = modal ? null : items;
  // BACK
  const bk = { x: 40, y: 484, w: 160, h: 34 };
  const bhov = !modal && ui.button(bk.x, bk.y, bk.w, bk.h, items[1].run);
  const bsel = bhov || g.menuIndex === 1;
  ornate(ctx, bk.x, bk.y, bk.w, bk.h, th, bsel ? acc : null, bsel ? '#2a2016' : '#14100a', { band: 5, rivets: false });
  ctx.fillStyle = bsel ? acc : '#a89878';
  for (let k = 0; k < 7; k++) ctx.fillRect(bk.x + 26 + k, bk.y + 17 - k, 1, k * 2 + 1 > 13 ? 13 : k * 2 + 1);
  drawText(ctx, 'BACK', bk.x + bk.w / 2 + 10, bk.y + 10, bsel ? '#fff0c8' : '#d8c8a0', { align: 'center', scale: 2 });
  // BEGIN
  const bg = { x: 300, y: 478, w: 360, h: 46 };
  const ghov = !modal && ui.button(bg.x, bg.y, bg.w, bg.h, items[0].run);
  const gsel = ghov || g.menuIndex === 0;
  if (gsel) glow(ctx, bg.x, bg.y, bg.w, bg.h, '#ff3020', 0.6 + Math.sin(t * 4) * 0.3);
  ornate(ctx, bg.x, bg.y, bg.w, bg.h, th, '#ffb060', gsel ? '#7a1410' : '#4a0c08', { metal: 'gold', rivets: true, crest: true });
  metalPlate(ctx, bg.x + 6, bg.y + 6, bg.w - 12, bg.h - 12, { face: gsel ? ['#c02818', '#8a160e', '#5a0c06'] : ['#8a1a10', '#5a0e08', '#3a0604'], rivets: false });
  drawText(ctx, 'BEGIN YOUR JOURNEY', bg.x + bg.w / 2, bg.y + 13, gsel ? '#ffe8b0' : '#e8c890', { align: 'center', scale: 3, shadow: '#2a0402' });
  // hints
  let hx = 690; const hy = 494;
  hx += keyCap(ctx, hx, hy, 'A', th) + 2; hx += keyCap(ctx, hx, hy, 'D', th) + 4;
  drawText(ctx, 'SELECT', hx, hy + 3, '#c8b898'); hx += 46;
  hx += keyCap(ctx, hx, hy, 'ENTER', th) + 4; drawText(ctx, 'CONFIRM', hx, hy + 3, '#c8b898'); hx += 52;
  hx += keyCap(ctx, hx, hy, 'ESC', th) + 4; drawText(ctx, 'BACK', hx, hy + 3, '#c8b898');

  // ---- hover feedback for cards that are not selected
  if (hoverCard >= 0 && hoverCard !== g.selectIndex) drawText(ctx, 'CLICK TO CHOOSE', x0 + hoverCard * (CARD.w + CARD.gap) + CARD.w / 2, CARD.y + CARD.ph - 4, '#e8dcc0', { align: 'center' });

  // ---- skill tooltip (multi-line, drawn last)
  if (tip) {
    const s = tip.s, lines = wrapText(s.desc, 44).slice(0, 4);
    const meta = `${s.type.toUpperCase()}   ${s.consumeAll ? 'ALL (MIN ' + s.minResource + ')' : 'COST ' + s.cost}   CD ${s.cooldown}S`;
    const w = Math.max(textWidth(s.name) + 40, textWidth(meta), ...lines.map((l) => textWidth(l))) + 16;
    const h = 30 + lines.length * 10;
    const x = Math.max(8, Math.min(SCREEN.w - w - 8, tip.x - w / 2)), y = tip.y - h;
    ornate(ctx, x, y, w, h, th, acc, '#0a0806');
    drawText(ctx, s.name, x + 8, y + 7, tip.ult ? '#ffe58a' : s.color || acc);
    if (tip.ult) drawText(ctx, 'ULT', x + w - 8, y + 7, '#ffe58a', { align: 'right' });
    drawText(ctx, meta, x + 8, y + 18, '#8a7c64');
    lines.forEach((l, i) => drawText(ctx, l, x + 8, y + 30 + i * 10, '#e8dcc0'));
  }

  // ---- confirmation
  if (modal) {
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h); ctx.globalAlpha = 1;
    const M = { w: 380, h: 132 }; M.x = (SCREEN.w - M.w) / 2; M.y = 196;
    glow(ctx, M.x, M.y, M.w, M.h, acc, 0.8);
    ornate(ctx, M.x, M.y, M.w, M.h, th, acc, '#0e0a07');
    const por = portraitOf(g, c.portrait);
    if (por) { ctx.fillStyle = '#000'; ctx.fillRect(M.x + 13, M.y + 13, 90, 106); ctx.drawImage(por, M.x + 14, M.y + 14, 88, 104); }
    drawText(ctx, `RIDE AS ${c.name}?`, M.x + 116, M.y + 18, acc, { scale: 2 });
    drawText(ctx, c.title, M.x + 116, M.y + 38, '#d8c8a0');
    let my = M.y + 52;
    for (const l of wrapText(`${c.epithet}. The seals are breaking - your journey begins in the crypt of the First Seal.`, 42).slice(0, 3)) { drawText(ctx, l, M.x + 116, my, '#8a7c64'); my += 10; }
    const yes = { x: M.x + 116, y: M.y + 94, w: 120, h: 24 }, no = { x: M.x + 246, y: M.y + 94, w: 120, h: 24 };
    ui.block(0, 0, SCREEN.w, SCREEN.h);
    ui.textButton(ctx, yes.x, yes.y, yes.w, yes.h, 'RIDE [ENTER]', th, () => { g.selectConfirm = false; g.confirmSelect(); }, { selected: true });
    ui.textButton(ctx, no.x, no.y, no.w, no.h, 'WAIT [ESC]', th, () => { g.selectConfirm = false; });
  }
}
