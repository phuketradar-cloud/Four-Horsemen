import { LAYOUT, FULL } from '../data/config.js';
import { SKILLS } from '../data/skills.js';
import { drawText, wrapText } from '../render/PixelFont.js';

// SkillBarUI (always visible above the log) + SkillTreeUI (K / skills panel).
const B = LAYOUT.skillBar;
const P = LAYOUT.panel; // skills panel: CLASSIC coordinates

export function hotkeyLabel(g, i) {
  if (i === 4) return '5';
  return g.settings.hotkeys === 'weapons' ? `S${i + 1}` : String(i + 1);
}

export function drawSkillBar(ctx, g, t) {
  const th = g.theme, ui = g.ui, sk = g.skills;
  ui.frame(ctx, B.x, B.y, B.w, B.h, th, { border: 3, panel: '#0e0c08' });
  const slots = sk.slots;
  let tip = null;
  slots.forEach((id, i) => {
    const s = SKILLS[id];
    const x = B.x + 6 + i * 30, y = B.y + 6;
    const unlocked = sk.isUnlocked(id);
    const p = sk.params(id);
    const left = sk.cooldowns.remaining(id);
    const affordable = p.consumeAll ? g.resource.value >= p.minResource : g.resource.value >= p.cost;
    const ready = unlocked && left <= 0 && affordable;
    const hov = ui.button(x - 1, y - 1, 26, 26, () => g.useSkill(i), { sound: false });
    const failing = sk.lastFail && sk.lastFail.id === id && g.realTime - sk.lastFail.t < 0.4;
    // frame: ultimate gets gold, pulsing when ready
    const ult = i === 4;
    ctx.fillStyle = failing ? '#ff3020' : ult ? (ready && Math.floor(t * 3) % 2 ? '#ffe58a' : '#a8834a') : hov ? th.bronzeLight : th.bronzeDark;
    ctx.fillRect(x - 1, y - 1, 26, 26);
    ctx.fillStyle = '#0a0806'; ctx.fillRect(x, y, 24, 24);
    if (unlocked) {
      ctx.drawImage(g.sprites.skillIcons[id], x, y);
      if (!affordable) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#600000'; ctx.fillRect(x, y, 24, 24); ctx.globalAlpha = 1; }
      if (left > 0) {
        const f = sk.cooldowns.fraction(id);
        ctx.globalAlpha = 0.72; ctx.fillStyle = '#000'; ctx.fillRect(x, y, 24, Math.ceil(24 * f)); ctx.globalAlpha = 1;
        drawText(ctx, left >= 10 ? String(Math.ceil(left)) : left.toFixed(1), x + 12, y + 9, '#ffffff', { align: 'center' });
      }
      const cost = p.consumeAll ? `${p.minResource}+` : p.cost ? String(p.cost) : '';
      if (cost && left <= 0) drawText(ctx, cost, x + 24, y + 17, affordable ? g.resource.def.color : '#ff5040', { align: 'right' });
    } else {
      ctx.fillStyle = '#2a2418'; ctx.fillRect(x + 8, y + 9, 8, 7); ctx.fillRect(x + 9, y + 5, 2, 4); ctx.fillRect(x + 13, y + 5, 2, 4); ctx.fillRect(x + 9, y + 4, 6, 2);
      drawText(ctx, `L${sk.unlockLevel(id)}`, x + 12, y + 17, th.textDim, { align: 'center' });
    }
    drawText(ctx, hotkeyLabel(g, i), x + 1, y + 1, th.highlight);
    if (hov) tip = { id, i, x, unlocked, p };
  });

  // resource readout
  const r = g.resource, rx = B.x + 160, rw = B.w - 166;
  const pulse = r.pulse > 0 && Math.floor(t * 20) % 2;
  drawText(ctx, r.def.name, rx, B.y + 6, pulse ? '#ffffff' : r.def.color);
  drawText(ctx, `${Math.floor(r.value)}/${r.max}`, rx + rw, B.y + 6, th.text, { align: 'right' });
  if (r.def.pips) {
    for (let k = 0; k < r.max; k++) {
      const px = rx + k * Math.floor(rw / r.max);
      ctx.fillStyle = '#000'; ctx.fillRect(px, B.y + 17, 12, 12);
      ctx.fillStyle = k < Math.floor(r.value) ? r.def.color : r.def.dark; ctx.fillRect(px + 1, B.y + 18, 10, 10);
      if (k < Math.floor(r.value)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 3, B.y + 20, 2, 2); }
    }
  } else {
    ui.bar(ctx, rx, B.y + 18, rw, 7, r.value / r.max, r.def.color, r.def.dark);
    if (r.full) drawText(ctx, g.hero.classId === 'conquest' ? 'EMPOWERED' : 'MAX', rx + rw / 2, B.y + 27, '#ffffff', { align: 'center' });
  }

  if (tip) drawSkillTooltip(ctx, g, tip);
}

function drawSkillTooltip(ctx, g, tip) {
  const th = g.theme, s = SKILLS[tip.id];
  const sk = g.skills;
  const lines = [];
  lines.push([`${s.name}${tip.i === 4 ? ' (ULTIMATE)' : ''}`, s.color]);
  if (!tip.unlocked) lines.push([`UNLOCKS AT LEVEL ${sk.unlockLevel(tip.id)}`, '#ff8060']);
  lines.push([sk.summary(tip.p).map(([k, v]) => `${k} ${v}`).join('  '), th.text]);
  for (const l of wrapText(s.desc, 52).slice(0, 3)) lines.push([l, th.textDim]);
  if (g.hero.upgrades[tip.id]) lines.push([`UPGRADE: ${s.upgrades[g.hero.upgrades[tip.id]].name}`, '#ffd040']);
  const w = Math.min(330, Math.max(...lines.map(([l]) => l.length)) * 6 + 10);
  const h = lines.length * 9 + 6;
  const V = LAYOUT.view, x = Math.max(V.x, Math.min(V.x + V.w - w, tip.x - 20)), y = B.y - h - 4;
  g.ui.box(ctx, x, y, w, h, th, '#0c0a06');
  lines.forEach(([l, c], k) => drawText(ctx, l, x + 5, y + 4 + k * 9, c));
}

// ------------------------------------------------------------------ skills panel
export function drawSkillPanel(ctx, g) {
  const th = g.theme, ui = g.ui, sk = g.skills, h = g.hero;
  ui.block(...FULL);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  ui.frame(ctx, P.x, P.y, P.w, P.h, th, { border: 5 });
  drawText(ctx, `${h.def.name} - SKILLS`, P.x + 10, P.y + 9, th.highlight);
  drawText(ctx, `SKILL POINTS: ${h.skillPoints}`, P.x + P.w - 30, P.y + 9, h.skillPoints ? '#ffd040' : th.textDim, { align: 'right' });
  ui.textButton(ctx, P.x + P.w - 24, P.y + 6, 15, 11, 'X', th, () => g.closePanel());
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(P.x + 8, P.y + 19, P.w - 16, 1);

  // passive line
  drawText(ctx, `PASSIVE: ${h.def.passive.name}`, P.x + 10, P.y + 23, '#ffd040');
  drawText(ctx, wrapText(h.def.passive.desc, 60)[0], P.x + 10, P.y + 32, th.textDim);

  const rowH = 50, y0 = P.y + 42;
  let hoverChoice = null;
  sk.slots.forEach((id, i) => {
    const s = SKILLS[id];
    const y = y0 + i * rowH;
    const unlocked = sk.isUnlocked(id);
    const chosen = h.upgrades[id];
    ui.box(ctx, P.x + 8, y, P.w - 16, rowH - 3, th, i === 4 ? '#18120a' : '#100e09');
    ctx.drawImage(g.sprites.skillIcons[id], P.x + 12, y + 4);
    if (!unlocked) { ctx.globalAlpha = 0.65; ctx.fillStyle = '#000'; ctx.fillRect(P.x + 12, y + 4, 24, 24); ctx.globalAlpha = 1; }
    drawText(ctx, hotkeyLabel(g, i), P.x + 13, y + 32, th.highlight);
    drawText(ctx, s.name, P.x + 42, y + 3, unlocked ? s.color : th.textDim);
    const p = sk.params(id);
    const meta = `${s.type.toUpperCase()}  ${p.consumeAll ? 'ALL ' + g.resource.def.short + ' (MIN ' + p.minResource + ')' : 'COST ' + p.cost}  CD ${p.cooldown}S  ${unlocked ? '' : 'LV ' + sk.unlockLevel(id)}`;
    drawText(ctx, meta, P.x + 42, y + 12, unlocked ? th.text : '#8a5040');
    wrapText(s.desc, 34).slice(0, 3).forEach((l, k) => drawText(ctx, l, P.x + 42, y + 21 + k * 8, th.textDim));
    // upgrade options (exclusive A / B)
    ['A', 'B'].forEach((c, k) => {
      const u = s.upgrades[c];
      const bx = P.x + 258, by = y + 3 + k * 22, bw = 122, bh = 19;
      const can = sk.canUpgrade(id, c);
      const isChosen = chosen === c;
      const sel = g.skillSel && g.skillSel.id === id && g.skillSel.choice === c;
      const hov = ui.button(bx, by, bw, bh, () => { g.skillSel = { id, choice: c }; });
      if (hov) hoverChoice = { id, choice: c };
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = isChosen ? '#4a3a10' : sel ? '#3a2c10' : hov ? '#221a0c' : '#0e0c08';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = isChosen ? '#ffd040' : sel ? th.highlight : th.bronzeDark; ctx.fillRect(bx, by, bw, 1);
      const col = isChosen ? '#ffd040' : chosen ? '#4a4434' : can.ok ? th.text : th.textDim;
      drawText(ctx, `${c}: ${u.name}`.slice(0, 20), bx + 3, by + 2, col);
      drawText(ctx, u.desc.slice(0, 20), bx + 3, by + 10, chosen && !isChosen ? '#3a3628' : '#8c8467');
    });
  });

  // preview + confirm
  const pick = g.skillSel || hoverChoice;
  const py = P.y + P.h - 44;
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(P.x + 8, py - 3, P.w - 16, 1);
  if (pick) {
    const s = SKILLS[pick.id], u = s.upgrades[pick.choice];
    const before = sk.summary(sk.params(pick.id, null)), after = sk.summary(sk.params(pick.id, pick.choice));
    const diff = after.filter(([k, v], idx) => before[idx] && String(before[idx][1]) !== String(v)).map(([k, v]) => `${k} ${before.find((b) => b[0] === k)?.[1] ?? '-'} > ${v}`);
    drawText(ctx, `PREVIEW ${s.name}: ${u.name}`, P.x + 10, py, s.color);
    drawText(ctx, (diff.join('   ') || u.desc).slice(0, 62), P.x + 10, py + 10, th.text);
    const can = sk.canUpgrade(pick.id, pick.choice);
    if (g.skillSel) {
      ui.textButton(ctx, P.x + P.w - 92, py + 21, 82, 15, 'CONFIRM', th, () => { if (sk.upgrade(pick.id, pick.choice)) g.skillSel = null; }, { disabled: !can.ok });
      if (!can.ok) drawText(ctx, can.reason.slice(0, 50), P.x + 10, py + 25, '#ff8060');
    } else drawText(ctx, 'CLICK AN UPGRADE TO SELECT, THEN CONFIRM', P.x + 10, py + 25, th.textDim);
  } else {
    drawText(ctx, `UPGRADES OPEN AT LV ${sk.upgradeLevel(sk.slots[0])} (ULTIMATE LV ${sk.upgradeLevel(sk.slots[4])}). ONE CHOICE PER SKILL.`, P.x + 10, py + 2, th.textDim);
    drawText(ctx, 'K / ESC: CLOSE', P.x + 10, py + 14, th.textDim);
  }
}
