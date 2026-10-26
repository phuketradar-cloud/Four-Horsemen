import { EQUIP_SLOTS, SLOT_DEFS, RARITY_ORDER, RARITIES, ITEM_DEFS } from '../data/items.js';
import { RECIPES, SELL_MULT } from '../data/recipes.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { drawItemTooltip, drawItemSlot } from './ItemTooltip.js';

// Inventory grid: sort, filter, compare, equip/unequip, use, sell, dismantle (with confirmation).
const M = { x: 4, y: 20, w: 632, h: 456 };
const GRID = { x: M.x + 8, y: M.y + 40, cell: 30, cols: 8, rows: 5 };
const SORTS = ['rarity', 'type', 'ilvl', 'value', 'name'];
const SLOT_FILTERS = ['all', ...EQUIP_SLOTS, 'material'];
const RARITY_FILTERS = ['any', ...RARITY_ORDER];

export function modalFrame(ctx, g, title) {
  g.ui.block(0, 0, 640, 480);
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); ctx.globalAlpha = 1;
  g.ui.frame(ctx, M.x, M.y, M.w, M.h, g.theme, { border: 5 });
  drawText(ctx, title, M.x + 10, M.y + 8, g.theme.highlight);
  g.ui.textButton(ctx, M.x + M.w - 24, M.y + 6, 15, 11, 'X', g.theme, () => g.closePanel());
  return M;
}

function selectedItem(g) { const uid = g.invState.sel; return uid != null ? g.inventory.get(uid) : null; }

export function doEquipToggle(g, item) {
  if (!item) return;
  if (g.equipment.isEquipped(item.uid)) g.unequipItem(item.uid);
  else if (item.def.slot) g.equipItem(item.uid);
}

export function doDismantle(g, item) {
  if (!item) return;
  const run = (confirmed) => {
    const r = g.craft.dismantle(item.uid, confirmed);
    if (r.confirm) { g.ask(r.confirm, () => run(true)); return; }
    g.log(r.msg, r.ok ? '#c8b070' : '#ff7a60');
    if (r.ok) { g.audio.play('armorCrack'); g.invState.sel = null; }
  };
  run(false);
}

export function doSell(g, item) {
  if (!item) return;
  const run = (confirmed) => {
    const r = g.craft.sell(item.uid, confirmed);
    if (r.confirm) { g.ask(r.confirm, () => run(true)); return; }
    g.log(r.msg, r.ok ? '#e0c060' : '#ff7a60');
    if (r.ok) { g.audio.play('pickup'); g.invState.sel = null; }
  };
  run(false);
}

export function drawInventory(ctx, g) {
  const th = g.theme, ui = g.ui, inv = g.inventory, st = g.invState;
  modalFrame(ctx, g, 'INVENTORY');
  drawText(ctx, `BAG ${inv.bagCount}/${inv.capacity}`, M.x + 120, M.y + 8, inv.bagFree <= 3 ? '#ff7a60' : th.text);
  ctx.drawImage(g.sprites.icons.gold, M.x + 200, M.y + 4);
  drawText(ctx, `${g.gold} GOLD`, M.x + 218, M.y + 8, '#e0c060');

  // toolbar: sort + filters
  drawText(ctx, 'SORT', M.x + 8, M.y + 26, th.textDim);
  SORTS.forEach((s, i) => ui.textButton(ctx, M.x + 36 + i * 42, M.y + 23, 40, 12, s.toUpperCase(), th, () => { st.sort = s; }, { selected: st.sort === s }));
  ui.textButton(ctx, M.x + 330, M.y + 6, 110, 12, `SLOT: ${st.slot === 'all' ? 'ALL' : st.slot === 'material' ? 'MATERIALS' : SLOT_DEFS[st.slot].short}`, th,
    () => { st.slot = SLOT_FILTERS[(SLOT_FILTERS.indexOf(st.slot) + 1) % SLOT_FILTERS.length]; });
  ui.textButton(ctx, M.x + 446, M.y + 6, 122, 12, `RARITY: ${st.rarity === 'any' ? 'ANY' : RARITIES[st.rarity].label}`, th,
    () => { st.rarity = RARITY_FILTERS[(RARITY_FILTERS.indexOf(st.rarity) + 1) % RARITY_FILTERS.length]; });

  // grid
  const view = inv.view(st);
  g.invView = view;
  for (let i = 0; i < GRID.cols * GRID.rows; i++) {
    const cx = GRID.x + (i % GRID.cols) * GRID.cell, cy = GRID.y + Math.floor(i / GRID.cols) * GRID.cell;
    const item = view[i] || null;
    const hov = ui.button(cx, cy, GRID.cell - 2, GRID.cell - 2, () => { if (item) { st.sel = item.uid; st.matSel = null; } });
    drawItemSlot(ctx, g, item, cx, cy, GRID.cell - 2, { selected: item && st.sel === item.uid, hover: hov });
  }
  if (view.length < inv.bagCount) drawText(ctx, `${inv.bagCount - view.length} HIDDEN BY FILTER`, GRID.x, GRID.y + 152, th.textDim);

  // equipped strip
  const ey = M.y + 206;
  drawText(ctx, 'EQUIPPED (CLICK TO INSPECT)', GRID.x, ey, th.bronzeLight);
  EQUIP_SLOTS.forEach((slot, i) => {
    const bx = GRID.x + i * 30, by = ey + 10;
    const it = g.equipment.itemIn(slot);
    const hov = ui.button(bx, by, 28, 28, () => { if (it) st.sel = it.uid; });
    drawItemSlot(ctx, g, it, bx, by, 28, { selected: it && st.sel === it.uid, hover: hov, label: slot === 'offHand' && g.equipment.offHandBlocked ? '2H' : '' });
    drawText(ctx, SLOT_DEFS[slot].short, bx + 14, by + 31, '#6a6250', { align: 'center' });
  });

  // Phase 4 material pouch (does not use bag slots)
  const my = M.y + 262;
  const mats = inv.materials.list();
  drawText(ctx, `MATERIAL POUCH (${mats.length} TYPES, NO BAG SLOTS)`, GRID.x, my, th.bronzeLight);
  mats.slice(0, 32).forEach((m, i) => {
    const x = GRID.x + (i % 8) * 30, y = my + 11 + Math.floor(i / 8) * 26;
    const hov = ui.button(x, y, 28, 24, () => { st.matSel = m.id; st.sel = null; });
    ctx.fillStyle = st.matSel === m.id ? '#3a2c10' : hov ? '#1e170c' : '#100e09'; ctx.fillRect(x, y, 28, 24);
    ctx.fillStyle = inv.materials.tierColor(m.id); ctx.fillRect(x, y + 23, 28, 1);
    ctx.drawImage(g.sprites.icons[m.def.icon] || g.sprites.icons.shard, x + 6, y + 1);
    drawText(ctx, String(m.qty), x + 27, y + 16, th.text, { align: 'right' });
    if (hov) ui.tooltip = { text: `${m.def.name} x${m.qty} (${(m.def.tier || '').toUpperCase()})`, x: x + 14, y: y - 4 };
  });
  if (!mats.length) drawText(ctx, 'EMPTY - ENEMIES AND CHESTS DROP MATERIALS', GRID.x, my + 14, '#4a4434');
  const pots = ['health_potion', 'greater_health_potion', 'dark_elixir', 'purifying_draught'].map((id) => `${ITEM_DEFS[id].name.replace(' Potion', '').toUpperCase()} ${inv.countOf(id)}`).join('  ');
  drawText(ctx, pots, GRID.x, M.y + M.h - 26, th.textDim);

  // details + compare + actions
  const item = selectedItem(g);
  const dx = M.x + 256, dw = M.w - 264;
  if (!item && st.matSel && inv.countOf(st.matSel) > 0) {
    drawMaterialDetail(ctx, g, st.matSel, dx, M.y + 22, dw);
  } else if (item) {
    drawItemTooltip(ctx, g, item, dx, M.y + 22, dw, { maxH: 368 });
    const by = M.y + M.h - 30;
    const eq = g.equipment.isEquipped(item.uid);
    const btns = [];
    if (item.def.slot) btns.push([eq ? 'UNEQUIP' : 'EQUIP', () => doEquipToggle(g, item), !eq && !g.equipment.canEquip(item).ok]);
    if (item.def.kind === 'consumable') btns.push(['USE', () => g.useItem(item.uid), false]);
    btns.push(['SELL', () => doSell(g, item), false]);
    if (item.def.slot) btns.push(['DISMANTLE', () => doDismantle(g, item), false]);
    if (item.def.slot) btns.push(['TEMPER', () => { g.craftSel = item.uid; g.openPanel('crafting'); }, false]);
    btns.forEach(([label, fn, dis], i) => ui.textButton(ctx, dx + i * 73, by, 70, 16, label, th, fn, { disabled: dis }));
  } else {
    drawText(ctx, 'SELECT AN ITEM TO SEE ITS STATS,', dx + dw / 2, M.y + 160, th.textDim, { align: 'center' });
    drawText(ctx, 'AFFIXES AND COMPARISON WITH YOUR GEAR', dx + dw / 2, M.y + 172, th.textDim, { align: 'center' });
  }
  drawText(ctx, 'ARROWS: SELECT  ENTER: EQUIP/USE  U: UNEQUIP  TAB/ESC: CLOSE  I: CHARACTER  C: CRAFTING', M.x + 8, M.y + M.h - 12, th.textDim);
}

// MaterialDefinition view: tier, stack limit, value, where it drops, what uses it; sell 1 / all.
export function drawMaterialDetail(ctx, g, id, x, y, w) {
  const th = g.theme, d = ITEM_DEFS[id], inv = g.inventory;
  g.ui.box(ctx, x, y, w, 380, th, '#0c0a07');
  ctx.drawImage(g.sprites.icons[d.icon], x + 8, y + 8);
  drawText(ctx, d.name.toUpperCase(), x + 30, y + 8, inv.materials.tierColor(id));
  drawText(ctx, `${(d.tier || 'basic').toUpperCase()} MATERIAL   ${inv.countOf(id)} / ${d.stack} CARRIED`, x + 30, y + 19, th.textDim);
  let yy = y + 36;
  for (const l of wrapText(d.desc || '', Math.floor((w - 16) / 6))) { drawText(ctx, l, x + 8, yy, th.text); yy += 10; }
  yy += 4;
  drawText(ctx, `SELL VALUE ${Math.max(1, Math.round(d.value * SELL_MULT))} GOLD EACH`, x + 8, yy, '#e0c060'); yy += 14;
  drawText(ctx, 'DROPS FROM', x + 8, yy, th.bronzeLight); yy += 10;
  const src = (d.sources || []).map((s) => s.replace(/_/g, ' ').toUpperCase());
  for (const l of wrapText(src.join(', ') || 'DISMANTLING / CRAFTING', Math.floor((w - 16) / 6)).slice(0, 5)) { drawText(ctx, l, x + 8, yy, th.text); yy += 10; }
  yy += 4;
  drawText(ctx, 'USED IN', x + 8, yy, th.bronzeLight); yy += 10;
  const uses = (d.usedIn || []).map((r) => RECIPES.find((q) => q.id === r)?.name || r);
  for (const l of wrapText(uses.join(', ') || 'TEMPERING / FUTURE RECIPES', Math.floor((w - 16) / 6)).slice(0, 5)) { drawText(ctx, l, x + 8, yy, th.text); yy += 10; }
  const sell = (n) => {
    const go = () => { const r = g.craft.sellMaterial(id, n); g.log(r.msg, r.ok ? '#e0c060' : '#ff7a60'); if (r.ok) g.audio.play('pickup'); };
    if (d.tier === 'boss' || d.tier === 'endgame') g.ask(`Sell ${Math.min(n, inv.countOf(id))} ${d.name}? It is rare and used in boss recipes.`, go); else go();
  };
  g.ui.textButton(ctx, x + 8, y + 356, 90, 16, 'SELL 1', th, () => sell(1));
  g.ui.textButton(ctx, x + 104, y + 356, 90, 16, 'SELL ALL', th, () => sell(inv.countOf(id)));
}

export function inventoryKey(g, action) {
  const view = g.invView || g.inventory.view(g.invState);
  if (!view.length) return;
  let i = Math.max(0, view.findIndex((it) => it.uid === g.invState.sel));
  const n = view.length;
  if (action === 'turnLeft') i = (i + n - 1) % n;
  else if (action === 'turnRight') i = (i + 1) % n;
  else if (action === 'forward') i = Math.max(0, i - GRID.cols);
  else if (action === 'back') i = Math.min(n - 1, i + GRID.cols);
  else if (action === 'confirm' || action === 'attack' || action === 'interact') {
    const it = g.inventory.get(g.invState.sel);
    if (it?.def.slot) doEquipToggle(g, it);
    else if (it?.def.kind === 'consumable') g.useItem(it.uid);
    return;
  } else if (action === 'unequip') {
    const it = g.inventory.get(g.invState.sel);
    if (it && g.equipment.isEquipped(it.uid)) g.unequipItem(it.uid);
    return;
  } else return;
  g.invState.sel = view[i].uid;
}
