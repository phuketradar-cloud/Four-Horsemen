import { HORSEMEN, CLASS_ORDER, RESOURCES } from '../data/characters.js';
import { SKILLS } from '../data/skills.js';
import { drawText, wrapText } from '../render/PixelFont.js';

// CharacterSelectionUI: four cards, a side-by-side stat comparison and full kit details.
const STATS = [['HP', 'hp'], ['ATK', 'atk'], ['DEF', 'def'], ['CRIT', 'crit']];
const SPEED = { FAST: 2, NORMAL: 1 };

export function drawCharacterSelect(ctx, g, t) {
  const th = g.theme, ui = g.ui;
  ctx.drawImage(g.sprites.title, 0, 0);
  ctx.globalAlpha = 0.72; ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, 640, 480); ctx.globalAlpha = 1;
  ui.block(0, 0, 640, 480);
  drawText(ctx, 'CHOOSE YOUR HORSEMAN', 320, 8, '#d8c8a0', { align: 'center', scale: 2 });

  const sel = CLASS_ORDER[g.selectIndex];
  CLASS_ORDER.forEach((id, i) => {
    const c = HORSEMEN[id];
    const x = 10 + i * 156, y = 28, w = 150, h = 176;
    const active = i === g.selectIndex;
    const hov = ui.button(x, y, w, h, () => {
      if (g.selectIndex === i && g.realTime - (g.lastCardClick || 0) < 0.4) g.confirmSelect();
      g.lastCardClick = g.realTime;
      g.chooseCard(i);
    }, { sound: false });
    ui.frame(ctx, x, y, w, h, th, { border: 3, panel: active ? '#221a0c' : '#0e0c08' });
    if (active) { ctx.fillStyle = Math.floor(t * 3) % 2 ? th.highlight : th.bronzeLight; ctx.fillRect(x + 3, y + 3, w - 6, 2); ctx.fillRect(x + 3, y + h - 5, w - 6, 2); }
    else if (hov) { ctx.fillStyle = th.bronze; ctx.fillRect(x + 3, y + 3, w - 6, 1); }
    ctx.fillStyle = '#000'; ctx.fillRect(x + w / 2 - 45, y + 9, 90, 106);
    ctx.drawImage(g.sprites.portraits.hi?.[c.portrait] || g.sprites.portraits[c.portrait], x + w / 2 - 44, y + 10, 88, 104); // painted art at 2x when loaded
    if (!active) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(x + w / 2 - 44, y + 10, 88, 104); ctx.globalAlpha = 1; }
    drawText(ctx, c.name, x + w / 2, y + 120, active ? c.colors.accent : th.text, { align: 'center', scale: 2 });
    drawText(ctx, c.title, x + w / 2, y + 137, th.textDim, { align: 'center' });
    drawText(ctx, c.role, x + w / 2, y + 147, th.text, { align: 'center' });
    const res = RESOURCES[c.resource];
    drawText(ctx, res.name, x + 8, y + 160, res.color);
    drawText(ctx, 'DIFF', x + 92, y + 160, th.textDim);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k < c.difficulty ? '#d04020' : '#3a2a20'; ctx.fillRect(x + 120 + k * 8, y + 160, 6, 7); }
  });

  // ---- comparison chart (all four side by side)
  const cx = 10, cy = 210, cw = 236, ch = 228;
  ui.frame(ctx, cx, cy, cw, ch, th, { border: 3, panel: '#0e0c08' });
  drawText(ctx, 'COMPARISON', cx + 8, cy + 7, th.highlight);
  const max = {};
  for (const [, k] of STATS) max[k] = Math.max(...CLASS_ORDER.map((id) => HORSEMEN[id].base[k]));
  let ry = cy + 20;
  for (const [label, k] of [...STATS, ['SPEED', 'speed']]) {
    drawText(ctx, label, cx + 8, ry + 2, th.text);
    CLASS_ORDER.forEach((id, j) => {
      const c = HORSEMEN[id];
      const v = k === 'speed' ? SPEED[c.base.speed] : c.base[k];
      const frac = k === 'speed' ? v / 2 : v / max[k];
      const by = ry + j * 7;
      const isSel = id === sel;
      ctx.fillStyle = '#000'; ctx.fillRect(cx + 44, by, 132, 6);
      ctx.fillStyle = isSel ? c.colors.accent : '#5a5040'; ctx.fillRect(cx + 45, by + 1, Math.round(130 * frac), 4);
      if (isSel) drawText(ctx, k === 'speed' ? c.base.speed : `${v}${k === 'crit' ? '%' : ''}`, cx + 182, ry + 8, th.highlight);
    });
    ry += 34;
  }
  CLASS_ORDER.forEach((id, j) => { ctx.fillStyle = HORSEMEN[id].colors.accent; ctx.fillRect(cx + 8 + j * 56, cy + ch - 14, 6, 6); drawText(ctx, HORSEMEN[id].name.slice(0, 7), cx + 17 + j * 56, cy + ch - 14, id === sel ? th.highlight : th.textDim); });

  // ---- selected kit details
  const c = HORSEMEN[sel];
  const dx = 252, dy = 210, dw = 378, dh = 228;
  ui.frame(ctx, dx, dy, dw, dh, th, { border: 3, panel: '#0e0c08' });
  let y = dy + 7;
  drawText(ctx, `${c.name} - ${c.epithet}`, dx + 8, y, c.colors.accent); y += 10;
  for (const l of wrapText(c.lore, 60).slice(0, 2)) { drawText(ctx, l, dx + 8, y, th.textDim); y += 9; }
  y += 3;
  drawText(ctx, `MECHANIC: ${c.mechanic.name}`, dx + 8, y, '#ffd040'); y += 9;
  for (const l of wrapText(c.mechanic.desc, 60).slice(0, 2)) { drawText(ctx, l, dx + 8, y, th.text); y += 9; }
  drawText(ctx, `PASSIVE: ${c.passive.name}`, dx + 8, y, '#ffd040'); y += 9;
  for (const l of wrapText(c.passive.desc, 60).slice(0, 1)) { drawText(ctx, l, dx + 8, y, th.text); y += 9; }
  y += 3;
  [...c.skills, c.ultimate].forEach((id, i) => {
    const s = SKILLS[id];
    ctx.drawImage(g.sprites.skillIcons[id], dx + 8, y, 16, 16);
    drawText(ctx, `${i === 4 ? 'ULT' : i + 1} ${s.name}`, dx + 28, y, i === 4 ? '#ffe58a' : s.color);
    drawText(ctx, `${s.type.toUpperCase()}  ${s.consumeAll ? 'ALL (MIN ' + s.minResource + ')' : 'COST ' + s.cost}  CD ${s.cooldown}S`, dx + dw - 8, y, th.text, { align: 'right' });
    const d = s.desc.length > 56 ? s.desc.slice(0, 54) + '..' : s.desc;
    drawText(ctx, d, dx + 28, y + 9, th.textDim);
    y += 20;
  });

  // ---- buttons
  const items = [
    { label: `BEGIN AS ${c.name}`, run: () => g.confirmSelect() },
    { label: 'BACK', run: () => g.toTitle() },
  ];
  g.activeMenu = items;
  items.forEach((it, i) => ui.textButton(ctx, i === 0 ? 400 : 252, 446, i === 0 ? 230 : 140, 22, it.label, th, it.run, { selected: g.menuIndex === i }));
  drawText(ctx, 'A/D: CHOOSE', 10, 446, th.textDim);
  drawText(ctx, 'ENTER: BEGIN  ESC: BACK', 10, 458, th.textDim);
}
