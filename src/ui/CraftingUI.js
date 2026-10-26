import { RECIPES, RECIPE_CATEGORIES, TEMPER } from '../data/recipes.js';
import { ITEM_DEFS, RARITIES, RARITY_ORDER, isStackable } from '../data/items.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { modalFrame, doDismantle } from './InventoryUI.js';
import { drawItemSlot, drawItemTooltip } from './ItemTooltip.js';

// CraftingInterface (Phase 4). Two tabs:
//   RECIPES  categories -> recipe list -> detail: every ingredient with have/need, level, station,
//            unlock condition, output preview; CRAFT is disabled until every requirement is met.
//   ENHANCE  pick gear -> temper (+N/5) with exact cost and a current -> projected stat preview,
//            confirmed before paying; reforge affixes (special outcome); dismantle with yield preview.
function costRows(g, mats, gold) {
  const rows = Object.entries(mats || {}).map(([id, n]) => ({ id, label: ITEM_DEFS[id].name, have: g.inventory.countOf(id), need: n }));
  if (gold) rows.push({ id: 'gold', label: 'Gold', have: g.gold, need: gold });
  return rows;
}
function drawCostRows(ctx, g, rows, x, y) {
  for (const r of rows) {
    const ok = r.have >= r.need;
    if (r.id !== 'gold') ctx.drawImage(g.sprites.icons[ITEM_DEFS[r.id].icon], x, y - 4);
    else ctx.drawImage(g.sprites.icons.gold, x, y - 4);
    drawText(ctx, `${r.label.toUpperCase()}`, x + 20, y, g.theme.text);
    drawText(ctx, `${r.have}/${r.need}`, x + 230, y, ok ? '#60c060' : '#ff6050', { align: 'right' });
    y += 17;
  }
  return y;
}
function preview(g, r) {
  if (!r.out.item) return null;
  const level = Math.max(1, g.hero.level), d = ITEM_DEFS[r.out.item];
  const ilvl = isStackable(d) ? 1 : Math.max(r.out.ilvl || 1, level);
  const key = `${r.id}|${ilvl}`;
  g.craftPreviews = g.craftPreviews || new Map();
  if (!g.craftPreviews.has(key)) g.craftPreviews.set(key, g.loot.gen.generate({ baseId: r.out.item, rarity: r.out.rarity || 'common', ilvl, qty: r.out.qty || 1, uid: -1, seed: 12345, classHint: g.hero.classId }));
  return g.craftPreviews.get(key);
}

export function drawCrafting(ctx, g) {
  const th = g.theme, ui = g.ui, cs = g.craftState;
  const M = modalFrame(ctx, g, 'CRAFTING');
  drawText(ctx, g.craft.atForge ? 'AT THE CAMP FORGE' : 'IN THE FIELD: FORGE RECIPES NEED THE CAMP', M.x + 90, M.y + 8, g.craft.atForge ? '#7ac060' : '#ffb060');
  drawText(ctx, `GOLD ${g.gold}`, M.x + M.w - 34, M.y + 8, '#e0c060', { align: 'right' });
  [['recipes', 'RECIPES'], ['enhance', 'ENHANCE / REFORGE / SALVAGE']].forEach(([id, label], i) => ui.textButton(ctx, M.x + 8 + i * 130, M.y + 22, i ? 200 : 124, 14, label, th, () => { cs.tab = id; }, { selected: cs.tab === id }));
  if (cs.tab === 'enhance') drawEnhance(ctx, g, M);
  else drawRecipes(ctx, g, M);
  drawText(ctx, 'GREEN = YOU HAVE ENOUGH, RED = MISSING.  NOTHING IS USED UNLESS THE CRAFT SUCCEEDS.  C/ESC: CLOSE', M.x + 8, M.y + M.h - 12, th.textDim);
}

function drawRecipes(ctx, g, M) {
  const th = g.theme, ui = g.ui, cs = g.craftState;
  RECIPE_CATEGORIES.forEach((c, i) => ui.textButton(ctx, M.x + 8 + i * 88, M.y + 42, 84, 13, c.label, th, () => { cs.cat = c.id; cs.recipe = null; }, { selected: cs.cat === c.id }));
  const list = RECIPES.filter((r) => r.category === cs.cat);
  if (!cs.recipe || !list.some((r) => r.id === cs.recipe)) cs.recipe = list[0]?.id || null;
  list.forEach((r, i) => {
    const y = M.y + 62 + i * 30;
    const chk = g.craft.check(r), unlocked = g.craft.isUnlocked(r);
    const hov = ui.button(M.x + 8, y, 230, 27, () => { cs.recipe = r.id; });
    ui.box(ctx, M.x + 8, y, 230, 27, th, cs.recipe === r.id ? '#2e2410' : hov ? '#1a150c' : '#0e0c08');
    const out = r.out.item ? ITEM_DEFS[r.out.item] : null;
    ctx.drawImage(g.sprites.icons[out?.icon || (r.out.relic ? 'shardRelic' : 'helm')], M.x + 13, y + 6);
    drawText(ctx, unlocked ? r.name : `${r.name}`, M.x + 34, y + 5, !unlocked ? '#5a5244' : chk.ok ? '#7ac060' : th.text);
    drawText(ctx, !unlocked ? 'LOCKED' : chk.ok ? 'READY TO CRAFT' : `LV ${r.level || 1}${r.station === 'forge' ? '  FORGE' : ''}`, M.x + 34, y + 16, !unlocked ? '#8a4030' : chk.ok ? '#60c060' : th.textDim);
  });
  if (!list.length) drawText(ctx, 'NO RECIPES IN THIS CATEGORY', M.x + 12, M.y + 70, th.textDim);
  // detail
  const r = RECIPES.find((q) => q.id === cs.recipe);
  if (!r) return;
  const x = M.x + 250, w = M.w - 258;
  let y = M.y + 62;
  ui.box(ctx, x, y - 4, w, 352, th, '#0c0a07');
  drawText(ctx, r.name, x + 8, y + 2, th.highlight); y += 13;
  for (const l of wrapText(r.desc, Math.floor((w - 16) / 6))) { drawText(ctx, l, x + 8, y, th.text); y += 10; }
  y += 4;
  const unlocked = g.craft.isUnlocked(r);
  drawText(ctx, `LEVEL ${r.level || 1}${g.hero.level < (r.level || 1) ? ` (YOU: ${g.hero.level})` : ''}`, x + 8, y, g.hero.level >= (r.level || 1) ? th.text : '#ff6050');
  drawText(ctx, `STATION: ${r.station === 'forge' ? 'CAMP FORGE' : 'ANYWHERE'}`, x + 150, y, r.station === 'forge' && !g.craft.atForge ? '#ff6050' : th.text); y += 12;
  drawText(ctx, 'RESULT: GUARANTEED (NO FAILURE CHANCE)', x + 8, y, '#a8d8f0'); y += 14;
  if (!unlocked) { for (const l of wrapText(`LOCKED: ${g.craft.unlockText(r)}`, Math.floor((w - 16) / 6))) { drawText(ctx, l, x + 8, y, '#ff9a60'); y += 10; } y += 4; }
  drawText(ctx, 'INGREDIENTS', x + 8, y, th.bronzeLight); y += 14;
  y = drawCostRows(ctx, g, costRows(g, r.cost, r.gold), x + 8, y);
  const chk = g.craft.check(r);
  ui.textButton(ctx, x + 8, M.y + M.h - 44, 120, 16, 'CRAFT', th, () => {
    const res = g.craft.craft(r.id);
    g.log(res.msg, res.ok ? '#c8b070' : '#ff7a60');
    if (res.ok) { g.effects.text?.(192, 120, 'CRAFTED', '#7ac060', 2); }
    else g.audio.play('deny');
  }, { disabled: !chk.ok, selected: chk.ok });
  if (!chk.ok) drawText(ctx, chk.reasons[0].length > 32 ? chk.reasons[0].slice(0, 31) + '..' : chk.reasons[0], x + 136, M.y + M.h - 39, '#ff9a60');
  const pv = preview(g, r);
  if (pv && !isStackable(pv.def)) drawItemTooltip(ctx, g, pv, x + 8, y + 4, w - 16, { compare: true, maxH: M.y + M.h - 52 - (y + 4) });
  else if (r.out.equipment || r.out.relic) drawText(ctx, 'OUTPUT: RANDOM ITEM AT YOUR LEVEL (UNCOMMON+)', x + 8, y + 6, th.textDim);
}

function drawEnhance(ctx, g, M) {
  const th = g.theme, ui = g.ui;
  drawText(ctx, 'SELECT GEAR', M.x + 8, M.y + 44, th.bronzeLight);
  const gear = g.inventory.items.filter((i) => i.def.slot).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl);
  gear.slice(0, 40).forEach((it, i) => {
    const x = M.x + 8 + (i % 8) * 30, yy = M.y + 56 + Math.floor(i / 8) * 30;
    const hov = ui.button(x, yy, 28, 28, () => { g.craftSel = it.uid; });
    drawItemSlot(ctx, g, it, x, yy, 28, { selected: g.craftSel === it.uid, hover: hov, label: it.upgrade ? `+${it.upgrade}` : '' });
  });
  const sel = g.craftSel != null ? g.inventory.get(g.craftSel) : null;
  if (!sel) { drawText(ctx, 'CHOOSE AN ITEM ON THE LEFT', M.x + 300, M.y + 140, th.textDim); return; }
  const x = M.x + 256, w = M.w - 264;
  let y = M.y + 44;
  drawText(ctx, `${sel.name}  +${sel.upgrade || 0}/${TEMPER.maxLevel}`, x, y, RARITIES[sel.rarity].color); y += 14;
  // ---- temper
  const pv = g.craft.temperPreview(sel);
  if (pv) {
    drawText(ctx, `TEMPER TO +${(sel.upgrade || 0) + 1}: +${Math.round(TEMPER.statPerLevel * 100)}% BASE STATS / DAMAGE. SUCCESS: GUARANTEED`, x, y, th.text); y += 12;
    for (const [k, a, b] of pv.rows.slice(0, 5)) { drawText(ctx, `${String(k).toUpperCase()}: ${a} -> ${b}`, x + 6, y, '#7ac060'); y += 9; }
    y += 4;
    y = drawCostRows(ctx, g, costRows(g, pv.cost.mats, pv.cost.gold), x, y + 4);
    const miss = g.craft.missing(pv.cost.mats, pv.cost.gold);
    ui.textButton(ctx, x + w - 96, M.y + 44, 92, 15, 'TEMPER', th, () => {
      g.ask(`Temper ${sel.name} to +${(sel.upgrade || 0) + 1}? Cost: ${g.craft.describe(pv.cost.mats)}, ${pv.cost.gold} gold.`, () => {
        const r = g.craft.temper(sel.uid);
        g.log(r.msg, r.ok ? '#ffd040' : '#ff7a60');
      });
    }, { disabled: !!miss.length, selected: !miss.length });
  } else { drawText(ctx, `FULLY TEMPERED (+${TEMPER.maxLevel} IS THE CAP)`, x, y, '#ffd040'); y += 14; }
  // ---- reforge
  y += 2;
  const why = g.craft.canReforge(sel);
  const rc = g.craft.reforgeCost(sel);
  drawText(ctx, 'REFORGE AFFIXES (NEW ROLLS, KEEPS BASE, RARITY, LEVEL, TEMPER)', x, y, th.bronzeLight); y += 11;
  if (why) { for (const l of wrapText(why, Math.floor(w / 6))) { drawText(ctx, l, x, y, '#ff9a60'); y += 9; } }
  else {
    drawText(ctx, `COST: ${g.craft.describe(rc.mats)}, ${rc.gold} GOLD`, x, y, g.craft.missing(rc.mats, rc.gold).length ? '#ff6050' : '#60c060');
    ui.textButton(ctx, x + w - 96, y - 3, 92, 13, 'REFORGE', th, () => g.ask(`Re-roll all affixes of ${sel.name}? The current rolls are lost.`, () => { const r = g.craft.reforge(sel.uid); g.log(r.msg, r.ok ? '#d080ff' : '#ff7a60'); }), { disabled: !!g.craft.missing(rc.mats, rc.gold).length });
    y += 11;
  }
  // ---- salvage
  y += 2;
  const yld = g.craft.dismantleYield(sel);
  for (const l of wrapText(`SALVAGE: ${g.craft.describe(yld)}`, Math.floor((w - 100) / 6)).slice(0, 2)) { drawText(ctx, l, x, y, th.textDim); y += 9; }
  ui.textButton(ctx, x + w - 96, y - 16, 92, 13, 'DISMANTLE', th, () => doDismantle(g, sel));
  drawItemTooltip(ctx, g, sel, x, y + 4, w, { compare: false, maxH: M.y + M.h - 20 - (y + 4) });
}
