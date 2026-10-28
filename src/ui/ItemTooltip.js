import { RARITIES, SLOT_DEFS } from '../data/items.js';
import { AFFIXES } from '../data/affixes.js';
import { LEGENDARY_EFFECTS } from '../data/legendaryEffects.js';
import { SETS } from '../data/sets.js';
import { HORSEMEN } from '../data/characters.js';
import { STAT_NAMES } from '../data/formulas.js';
import { LAYOUT, FULL } from '../data/config.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { baseStatsOf } from '../systems/ItemGenerator.js';
import { compareItem } from '../systems/ItemComparison.js';
import { setBonusesFor } from '../systems/SetBonusManager.js';

// ItemTooltipUI + shared item widgets (slot box, toasts, confirm dialog).
const KIND_LABEL = { weapon: 'WEAPON', armor: 'ARMOR', offhand: 'OFF-HAND', ring: 'RING', relic: 'RELIC', consumable: 'CONSUMABLE', material: 'MATERIAL' };
const fmt = (k, v) => `${v > 0 ? '+' : ''}${v}${STAT_NAMES[k]?.startsWith('%') ? '' : ' '}${STAT_NAMES[k] || k}`;

export function tooltipLines(g, item, { compare = true } = {}) {
  const L = [];
  const d = item.def, r = RARITIES[item.rarity];
  const push = (text, color = '#c8bc98') => L.push([text, color]);
  push(item.name + (item.upgrade ? ` +${item.upgrade}` : ''), r.color);
  push(`${r.label} ${KIND_LABEL[d.kind] || ''}${d.slot ? ' - ' + SLOT_DEFS[d.slot].label : ''}${item.twoHanded ? ' - TWO-HANDED' : ''}`, '#8c8467');
  if (d.catalog) push(`${d.category.toUpperCase()} - ${d.tierAdj.toUpperCase()} TIER${d.tags?.length ? ' [' + d.tags.join(', ').toUpperCase() + ']' : ''}`, '#8c8467');
  if (d.uniqueOnly === 'legendary' || d.uniqueOnly === 'mythic') push(d.uniqueOnly === 'mythic' ? 'MYTHIC UNIQUE' : 'CURATED LEGENDARY', r.color);
  if (d.slot) push(`ITEM LV ${item.ilvl}   REQUIRES LV ${item.reqLevel}`, g.hero.level < item.reqLevel ? '#ff6050' : '#a89a70');
  if (item.classes) push(`CLASS: ${item.classes.map((c) => HORSEMEN[c].name).join(' / ')}`, item.classes.includes(g.hero.classId) ? '#a8d870' : '#ff6050');
  if (d.kind === 'weapon') push(`DAMAGE ${item.stats.dmgMin}-${item.stats.dmgMax}   CRIT ${Math.round(item.stats.crit * 100)}%   ${item.stats.cooldown}S`, '#e8dcc0');
  if (d.heal) push(`RESTORES ${d.heal} HP`, '#60ff80');
  if (d.resource) push(`RESTORES ${Math.round(d.resource * 100)}% CLASS RESOURCE`, '#a0a0ff');
  for (const [k, v] of Object.entries(baseStatsOf(item))) push(fmt(k, v), '#e8dcc0');
  if (item.affixes?.length) push('- AFFIXES -', '#5a6a8a');
  for (const af of item.affixes || []) {
    const a = AFFIXES[af.id];
    const clsTag = a.cls && !item.classes ? ` (${HORSEMEN[a.cls].name})` : '';
    const usable = !a.cls || a.cls === g.hero.classId;
    push(`${a.desc.replace('{v}', af.value)}${clsTag}`, usable ? '#7aa8ff' : '#4a5a7a');
  }
  if (item.unique) {
    const e = LEGENDARY_EFFECTS[item.unique];
    const usable = !e.cls || e.cls === g.hero.classId;
    push(item.rarity === 'mythic' ? '- MYTHIC EFFECT -' : '- UNIQUE EFFECT -', '#8a6a3a');
    push(`${e.name.toUpperCase()}: ${e.desc}${usable ? '' : ` (${HORSEMEN[e.cls]?.name || e.cls} ONLY)`}`, !usable ? '#6a5040' : item.rarity === 'mythic' ? '#ff7a8a' : '#f2a040');
  }
  if (item.setId) {
    const set = SETS[item.setId];
    const equipped = setBonusesFor(g.calc.equippedItems()).find((s) => s.set.id === set.id);
    push(`SET: ${set.name} (${equipped ? equipped.count : 0}/${set.pieces.length})`, set.color);
    for (const b of set.bonuses) push(` (${b.count}) ${b.desc}`, equipped && equipped.count >= b.count ? '#a8d870' : '#5a5444');
  }
  if (d.kind === 'material' || d.kind === 'consumable') push(`STACK ${item.qty}/${d.stack}`, '#8c8467');
  push(d.desc, '#7a7260');
  if (d.slot) {
    const y = g.craft.dismantleYield(item);
    push(`SELL ${Math.max(1, Math.round(item.value * 0.25))} G   SALVAGE: ${Object.entries(y).map(([id, n]) => `${n} ${id.replace('_', ' ')}`).join(', ')}`, '#8c8467');
  } else push(`SELL ${Math.max(1, Math.round(item.value * item.qty * 0.25))} G`, '#8c8467');
  if (compare && d.slot && !g.equipment.isEquipped(item.uid)) {
    const c = compareItem(g, item);
    if (c) {
      push(c.current ? `VS EQUIPPED: ${c.current.name}` : 'VS EMPTY SLOT', '#d8b56d');
      if (c.blocked) push(c.blocked, '#ff6050');
      if (!c.deltas.length) push('NO STAT CHANGE', '#8c8467');
      for (const x of c.deltas) push(x.note ? x.label : `${x.label} ${x.before} > ${x.after} (${x.diff > 0 ? '+' : ''}${x.diff})`, x.note ? '#ff9a60' : x.better ? '#60e060' : '#ff5a4a');
    }
  }
  return L;
}

// Draws a tooltip box; long lines wrap. Returns the height used (clipped to maxH).
export function drawItemTooltip(ctx, g, item, x, y, w, opts = {}) {
  const maxChars = Math.floor((w - 10) / 6);
  const lines = [];
  for (const [t, c] of tooltipLines(g, item, opts)) for (const l of wrapText(t, maxChars)) lines.push([l, c]);
  const maxH = opts.maxH || 400;
  const h = Math.min(maxH, lines.length * 9 + 8);
  g.ui.box(ctx, x, y, w, h, g.theme, '#0c0a06');
  const rar = RARITIES[item.rarity];
  ctx.fillStyle = rar.border; ctx.fillRect(x, y, w, 2);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  lines.forEach(([l, c], i) => drawText(ctx, l, x + 5, y + 5 + i * 9, c));
  ctx.restore();
  return h;
}

// Inventory/equipment slot: rarity frame, icon, stack count, temper level, unusable marker.
export function drawItemSlot(ctx, g, item, x, y, size, { selected = false, hover = false, label = null } = {}) {
  const th = g.theme;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
  ctx.fillStyle = selected ? '#3a2c10' : hover ? '#221a0c' : '#120f09'; ctx.fillRect(x, y, size, size);
  if (item) {
    const r = RARITIES[item.rarity];
    ctx.fillStyle = r.border; ctx.fillRect(x, y, size, 1); ctx.fillRect(x, y + size - 1, size, 1); ctx.fillRect(x, y, 1, size); ctx.fillRect(x + size - 1, y, 1, size);
    if (r.glow > 0.5) { ctx.globalAlpha = 0.18; ctx.fillStyle = r.color; ctx.fillRect(x + 1, y + 1, size - 2, size - 2); ctx.globalAlpha = 1; }
    // Legendary / Mythic: one restrained glint travelling around the frame (never a flashing slot)
    if (item.rarity === 'legendary' || item.rarity === 'mythic') {
      const per = (size - 1) * 4, k = Math.floor(((g.realTime || 0) * (item.rarity === 'mythic' ? 40 : 28)) % per);
      const [gx, gy] = k < size - 1 ? [x + k, y] : k < 2 * (size - 1) ? [x + size - 1, y + k - (size - 1)] : k < 3 * (size - 1) ? [x + size - 1 - (k - 2 * (size - 1)), y + size - 1] : [x, y + size - 1 - (k - 3 * (size - 1))];
      ctx.fillStyle = '#fff4d0'; ctx.fillRect(gx - 1, gy - 1, 2, 2);
    }
    const icon = g.sprites.icons[item.def.icon] || g.sprites.icons.shard;
    const s = size >= 30 ? 1.5 : 1;
    ctx.drawImage(icon, Math.round(x + size / 2 - 8 * s), Math.round(y + size / 2 - 8 * s), 16 * s, 16 * s);
    if (item.qty > 1) drawText(ctx, String(item.qty), x + size - 2, y + size - 9, '#fff', { align: 'right' });
    if (item.upgrade) drawText(ctx, `+${item.upgrade}`, x + size - 2, y + 2, '#ffd040', { align: 'right' });
    if (g.equipment.isEquipped(item.uid)) drawText(ctx, 'E', x + 2, y + 2, th.highlight);
    if (item.def.slot && !g.equipment.canEquip(item).ok && !g.equipment.isEquipped(item.uid)) { ctx.fillStyle = '#c02010'; ctx.fillRect(x + 2, y + size - 4, size - 4, 2); }
  } else if (label) {
    drawText(ctx, label, x + size / 2, y + size / 2 - 3, '#4a4434', { align: 'center' });
  }
  if (selected) { ctx.fillStyle = th.highlight; ctx.fillRect(x - 1, y - 1, size + 2, 1); ctx.fillRect(x - 1, y + size, size + 2, 1); }
}

// Loot notifications in the viewport (non-blocking).
export function drawToasts(ctx, g, ox = 0, oy = 0) {
  g.toasts.forEach((t, i) => {
    const a = Math.min(1, (4 - t.t) * 2);
    const w = Math.min(LAYOUT.view.w - 20, t.text.length * 6 + 26);
    const x = 6 + ox, y = 6 + oy + i * 15;
    ctx.globalAlpha = Math.max(0, a) * 0.85;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, 13);
    ctx.fillStyle = (RARITIES[t.rarity] || RARITIES.common).border; ctx.fillRect(x, y, 2, 13);
    ctx.globalAlpha = Math.max(0, a);
    drawText(ctx, '+', x + 6, y + 3, t.color);
    drawText(ctx, t.text, x + 14, y + 3, t.color);
    ctx.globalAlpha = 1;
  });
}

// Modal yes/no dialog for destructive actions.
export function drawConfirm(ctx, g) {
  const th = g.theme, ui = g.ui;
  ui.block(...FULL);
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  const lines = wrapText(g.confirm.text, 44);
  const w = 290, h = 50 + lines.length * 10, x = 320 - w / 2, y = 200 - h / 2;
  ui.frame(ctx, x, y, w, h, th, { border: 4 });
  lines.forEach((l, i) => drawText(ctx, l, 320, y + 12 + i * 10, th.text, { align: 'center' }));
  ui.textButton(ctx, x + 40, y + h - 26, 90, 16, 'YES [ENTER]', th, () => { const c = g.confirm; g.confirm = null; c.onYes(); });
  ui.textButton(ctx, x + w - 130, y + h - 26, 90, 16, 'NO [ESC]', th, () => { g.confirm = null; });
}
