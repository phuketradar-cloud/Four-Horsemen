import { EQUIP_SLOTS, SLOT_DEFS, RARITIES } from '../data/items.js';
import { FORMULAS, STAT_LABELS, ATTRS, ATTR_LABELS } from '../data/formulas.js';
import { LEGENDARY_EFFECTS } from '../data/legendaryEffects.js';
import { activeEffectIds } from '../systems/LegendaryEffects.js';
import { compareItem } from '../systems/ItemComparison.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { modalFrame, doEquipToggle } from './InventoryUI.js';
import { drawItemTooltip, drawItemSlot } from './ItemTooltip.js';

// Character & equipment screen: portrait, progression, attributes, eight slots, derived stats
// (hover = formula), set bonuses, active item effects, slot candidates with live deltas.
export function drawEquipment(ctx, g) {
  const th = g.theme, ui = g.ui, h = g.hero, s = h.stats;
  const M = modalFrame(ctx, g, 'CHARACTER & EQUIPMENT');
  let hoverDoc = null;

  // ---------------------------------------------------------------- left: portrait + progression + attributes
  const lx = M.x + 8;
  ctx.fillStyle = '#000'; ctx.fillRect(lx - 1, M.y + 21, 46, 54);
  ctx.drawImage(g.sprites.portraits[h.def.portrait], lx, M.y + 22);
  drawText(ctx, `${h.def.name}`, lx + 50, M.y + 24, h.def.colors.accent);
  drawText(ctx, h.def.title.replace('THE ', ''), lx + 50, M.y + 34, th.textDim);
  drawText(ctx, `LEVEL ${h.level}`, lx + 50, M.y + 46, '#ffd040');
  drawText(ctx, `SP ${h.skillPoints}`, lx + 50, M.y + 56, h.skillPoints ? '#ffd040' : th.textDim);
  let y = M.y + 82;
  drawText(ctx, `XP ${h.xp}/${h.xpNeeded}`, lx, y, th.text); y += 8;
  ui.bar(ctx, lx, y, 134, 3, h.xp / h.xpNeeded, '#d0a030', '#1a1408'); y += 8;
  drawText(ctx, `HP ${Math.ceil(h.hp)}/${h.maxHp}`, lx, y, '#e05040'); y += 9;
  drawText(ctx, `${g.resource.def.name} ${Math.floor(g.resource.value)}/${g.resource.max}`, lx, y, g.resource.def.color); y += 9;
  drawText(ctx, `GOLD ${g.gold}`, lx, y, '#e0c060'); y += 13;
  drawText(ctx, 'ATTRIBUTES', lx, y, th.bronzeLight); y += 10;
  for (const a of ATTRS) {
    const total = s.attrs[a];
    const gear = s.add[a] || 0;
    drawText(ctx, ATTR_LABELS[a], lx, y, th.text);
    drawText(ctx, String(Math.floor(total)), lx + 60, y, th.highlight, { align: 'right' });
    if (gear) drawText(ctx, `(+${gear} GEAR)`, lx + 66, y, '#60c060');
    y += 9;
  }

  // ---------------------------------------------------------------- middle: eight slots
  const mx = M.x + 152;
  drawText(ctx, 'EQUIPMENT', mx, M.y + 22, th.bronzeLight);
  EQUIP_SLOTS.forEach((slot, i) => {
    const col = i < 4 ? 0 : 1, row = i % 4;
    const bx = mx + col * 124, by = M.y + 32 + row * 40;
    const it = g.equipment.itemIn(slot);
    const sel = g.equipSel === slot;
    const hov = ui.button(bx, by, 120, 36, () => { g.equipSel = slot; });
    ui.box(ctx, bx, by, 120, 36, th, sel ? '#2a2010' : hov ? '#1c160c' : '#0e0c08');
    drawItemSlot(ctx, g, it, bx + 4, by + 4, 28, { selected: sel, label: slot === 'offHand' && g.equipment.offHandBlocked ? '2H' : '' });
    drawText(ctx, SLOT_DEFS[slot].label, bx + 36, by + 4, th.textDim);
    const name = it ? it.name : slot === 'offHand' && g.equipment.offHandBlocked ? 'BLOCKED (2H)' : slot === 'mainHand' ? 'BARE HANDS' : '- EMPTY -';
    const lines = wrapText(name, 13).slice(0, 2);
    lines.forEach((l, k) => drawText(ctx, l, bx + 36, by + 14 + k * 9, it ? RARITIES[it.rarity].color : '#4a4434'));
  });

  // set bonuses + active item effects
  let sy = M.y + 196;
  drawText(ctx, 'SET BONUSES', mx, sy, th.bronzeLight); sy += 10;
  if (!s.sets.length) { drawText(ctx, 'NONE EQUIPPED', mx, sy, '#4a4434'); sy += 9; }
  for (const st of s.sets) {
    drawText(ctx, `${st.set.name} ${st.count}/${st.set.pieces.length}`, mx, sy, st.set.color); sy += 9;
    for (const b of st.set.bonuses) for (const l of wrapText(`(${b.count}) ${b.desc}`, 39).slice(0, 2)) { drawText(ctx, l, mx + 4, sy, st.count >= b.count ? '#a8d870' : '#4a4434'); sy += 9; }
  }
  sy += 3;
  drawText(ctx, 'ITEM EFFECTS', mx, sy, th.bronzeLight); sy += 10;
  const effects = [...activeEffectIds(s.items, h.classId)];
  if (!effects.length) { drawText(ctx, 'NONE', mx, sy, '#4a4434'); sy += 9; }
  for (const id of effects) {
    const e = LEGENDARY_EFFECTS[id];
    for (const l of wrapText(`${e.name.toUpperCase()}: ${e.desc}`, 40).slice(0, 2)) { drawText(ctx, l, mx, sy, '#f2a040'); sy += 9; }
  }

  // ---------------------------------------------------------------- right: derived stats
  const rx = M.x + 410;
  drawText(ctx, 'DERIVED STATS (HOVER: FORMULA)', rx, M.y + 22, th.bronzeLight);
  STAT_LABELS.forEach(([k, label, suf], i) => {
    const yy = M.y + 33 + i * 10;
    const hov = ui.hover(rx, yy - 1, 214, 10);
    if (hov) { ctx.fillStyle = '#221a0c'; ctx.fillRect(rx - 2, yy - 2, 216, 10); hoverDoc = FORMULAS[k]?.doc || (k === 'def' ? FORMULAS.def.doc : null); }
    drawText(ctx, label, rx, yy, th.text);
    const v = s[k];
    drawText(ctx, `${typeof v === 'number' ? +v.toFixed(1) : v}${suf === '%' ? '%' : suf === '%+' ? '%' : ''}`, rx + 212, yy, th.highlight, { align: 'right' });
  });
  const cur = g.weapons.current;
  drawText(ctx, `WEAPON ${cur.dmgMin}-${cur.dmgMax} +${(h.atk * 0.4).toFixed(1)} ATK`, rx, M.y + 210, th.text);
  drawText(ctx, `HIT CHANCE vs SKELETON ${Math.round(Math.min(100, Math.max(60, s.accuracy - 5)))}%`, rx, M.y + 220, th.textDim);
  drawText(ctx, `BLOW REDUCTION ${s.blowReduction}`, rx, M.y + 230, th.textDim);

  // ---------------------------------------------------------------- bottom: selected slot + candidates
  const by = M.y + 296;
  const slot = g.equipSel;
  const equipped = g.equipment.itemIn(slot);
  if (equipped) {
    drawItemTooltip(ctx, g, equipped, M.x + 8, by - 30, 236, { compare: false, maxH: 186 });
    ui.textButton(ctx, M.x + 152, by + 136, 90, 15, 'UNEQUIP', th, () => g.unequipItem(equipped.uid));
  }
  const cx = M.x + 250, cw = M.w - 258;
  drawText(ctx, `${SLOT_DEFS[slot].label}: ITEMS IN YOUR BAG`, cx, by - 26, th.bronzeLight);
  const cands = g.inventory.bagItems.filter((it) => it.def.slot === slot).sort((a, b) => b.ilvl - a.ilvl);
  if (!cands.length) drawText(ctx, 'NOTHING FOR THIS SLOT', cx, by - 14, '#4a4434');
  cands.slice(0, 6).forEach((it, i) => {
    const yy = by - 16 + i * 26;
    const hov = ui.button(cx, yy, cw, 24, () => doEquipToggle(g, it));
    ui.box(ctx, cx, yy, cw, 24, th, hov ? '#221a0c' : '#0e0c08');
    drawItemSlot(ctx, g, it, cx + 2, yy + 2, 20, {});
    drawText(ctx, it.name.slice(0, 30), cx + 26, yy + 3, RARITIES[it.rarity].color);
    const c = compareItem(g, it);
    if (c?.blocked) drawText(ctx, c.blocked.slice(0, 58), cx + 26, yy + 13, '#ff6050');
    else {
      let x = cx + 26;
      for (const d of (c?.deltas || []).filter((q) => !q.note).slice(0, 4)) {
        const txt = `${d.label.split(' ')[0]} ${d.diff > 0 ? '+' : ''}${d.diff}`;
        drawText(ctx, txt, x, yy + 13, d.better ? '#60e060' : '#ff5a4a');
        x += txt.length * 6 + 8;
      }
      if (c && !c.deltas.length) drawText(ctx, 'NO CHANGE', x, yy + 13, th.textDim);
    }
  });
  if (cands.length > 6) drawText(ctx, `+${cands.length - 6} MORE IN INVENTORY`, cx, by + 142, th.textDim);

  // footer: formula of hovered stat / hints
  const fy = M.y + M.h - 12;
  if (hoverDoc) drawText(ctx, hoverDoc.slice(0, 102), M.x + 8, fy, '#ffe58a');
  else drawText(ctx, 'CLICK A SLOT, THEN AN ITEM TO EQUIP.  GREEN = REAL IMPROVEMENT, RED = LOSS.  I/ESC: CLOSE  TAB: INVENTORY', M.x + 8, fy, th.textDim);
}
