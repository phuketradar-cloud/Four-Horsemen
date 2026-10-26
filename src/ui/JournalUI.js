import { CHAPTERS, NPCS, KEY_ITEMS, ENDINGS } from '../data/campaign.js';
import { LORE } from '../data/lore.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { ITEM_DEFS } from '../data/items.js';
import { SETS } from '../data/sets.js';
import { drawText, wrapText } from '../render/PixelFont.js';

// Phase 5 UI: journal [J] (quests, codex, bestiary, chapters/ending), NPC dialogue and chapter
// title cards. Mouse-first; UP/DOWN + ENTER work on the action lists (g.activeMenu).
const J = { x: 20, y: 18, w: 600, h: 444 };
const TABS = [['quests', 'QUESTS'], ['codex', 'CODEX'], ['bestiary', 'BESTIARY'], ['chapters', 'CHAPTERS']];
const RANK_LABEL = { normal: 'COMMON', elite: 'ELITE', boss: 'BOSS' };

function frame(ctx, g, title) {
  const ui = g.ui, th = g.theme;
  ui.block(0, 0, 640, 480);
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); ctx.globalAlpha = 1;
  ui.frame(ctx, J.x, J.y, J.w, J.h, th, { border: 5, panel: '#0c0a07' });
  drawText(ctx, title, J.x + J.w / 2, J.y + 9, th.highlight, { align: 'center' });
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(J.x + 8, J.y + 19, J.w - 16, 1);
  ui.textButton(ctx, J.x + J.w - 24, J.y + 6, 15, 11, 'X', th, () => g.closePanel());
}

function para(ctx, text, x, y, color, chars, maxY = 9999) {
  for (const l of wrapText(text, chars)) { if (y > maxY) break; drawText(ctx, l, x, y, color); y += 9; }
  return y;
}

// ------------------------------------------------------------------ journal
export function drawJournal(ctx, g, t) {
  const th = g.theme, ui = g.ui, js = g.journalState, q = g.quests;
  const ch = q.currentChapter;
  frame(ctx, g, `JOURNAL - ${ch.title}: ${ch.name}`);
  TABS.forEach(([id, label], i) => {
    ui.textButton(ctx, J.x + 12 + i * 100, J.y + 26, 94, 14, label, th, () => { js.tab = id; js.sel = null; js.page = 0; }, { selected: js.tab === id });
  });
  const listX = J.x + 12, listY = J.y + 48, detX = J.x + 228, detW = J.w - 240;
  let rows = [];
  if (js.tab === 'quests') {
    const all = Object.keys(q.quests).map((id) => q.def(id)).filter(Boolean);
    const active = all.filter((d) => q.isActive(d.id)).sort((a, b) => a.side - b.side);
    const done = all.filter((d) => q.isDone(d.id));
    rows = [...active.map((d) => ({ id: d.id, label: `${d.side ? 'SIDE' : 'MAIN'} ${d.name}`, color: q.readyToTurnIn(d) ? '#7ac060' : d.side ? th.text : '#ffd040' })),
      ...done.map((d) => ({ id: d.id, label: `DONE ${d.name}`, color: '#6a6250' }))];
  } else if (js.tab === 'codex') {
    rows = LORE.map((l) => ({ id: l.id, label: q.codex.has(l.id) ? l.title : '? ? ?', color: q.codex.has(l.id) ? th.text : '#4a4436', locked: !q.codex.has(l.id) }));
  } else if (js.tab === 'bestiary') {
    const ids = [...Object.keys(ENEMIES).filter((id) => !ENEMIES[id].illusion), ...Object.keys(BOSSES)];
    rows = ids.map((id) => { const d = ENEMIES[id] || BOSSES[id], seen = id in q.bestiary; return { id, label: seen ? d.name : '? ? ?', color: seen ? (BOSSES[id] ? '#ff9a60' : th.text) : '#4a4436', locked: !seen }; });
  } else {
    rows = CHAPTERS.map((c) => ({ id: c.id, label: `${c.title}  ${c.name}`, color: q.chapterUnlocked(c.id) ? (q.isDone(c.mainQuest) ? '#7ac060' : '#ffd040') : '#4a4436', locked: !q.chapterUnlocked(c.id) }));
  }
  // list (paged)
  const per = 34, pages = Math.max(1, Math.ceil(rows.length / per));
  js.page = Math.min(js.page, pages - 1);
  const shown = rows.slice(js.page * per, js.page * per + per);
  if (!js.sel || !rows.some((r) => r.id === js.sel)) js.sel = rows[0]?.id || null;
  shown.forEach((r, i) => {
    const y = listY + i * 11;
    const hov = ui.button(listX, y - 1, 208, 11, () => { js.sel = r.id; });
    if (js.sel === r.id || hov) { ctx.fillStyle = js.sel === r.id ? '#2e2410' : '#1a150c'; ctx.fillRect(listX, y - 1, 208, 11); }
    drawText(ctx, r.label.toUpperCase().slice(0, 34), listX + 3, y + 1, r.color);
  });
  if (!rows.length) drawText(ctx, js.tab === 'quests' ? 'NO QUESTS YET' : 'NOTHING RECORDED', listX + 3, listY, th.textDim);
  if (pages > 1) {
    ui.textButton(ctx, listX, J.y + J.h - 22, 40, 13, '<', th, () => { js.page = Math.max(0, js.page - 1); });
    drawText(ctx, `${js.page + 1}/${pages}`, listX + 104, J.y + J.h - 19, th.textDim, { align: 'center' });
    ui.textButton(ctx, listX + 168, J.y + J.h - 22, 40, 13, '>', th, () => { js.page = Math.min(pages - 1, js.page + 1); });
  }
  g.activeMenu = rows.map((r) => ({ label: r.label, run: () => { js.sel = r.id; } }));
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(detX - 8, listY - 4, 1, J.h - 60);

  // detail
  const sel = rows.find((r) => r.id === js.sel);
  let y = listY;
  const maxY = J.y + J.h - 16, chars = Math.floor(detW / 6);
  if (!sel) return;
  if (js.tab === 'quests') {
    const d = q.def(sel.id), st = q.state(sel.id);
    drawText(ctx, d.name.toUpperCase(), detX, y, '#ffd040'); y += 11;
    const chap = CHAPTERS.find((c) => c.id === d.chapter);
    drawText(ctx, `${d.side ? 'SIDE QUEST' : 'MAIN QUEST'} - ${chap.title}${NPCS[d.npc] ? ` - GIVEN BY ${NPCS[d.npc].name.toUpperCase()}` : ''}`, detX, y, th.textDim); y += 13;
    y = para(ctx, d.desc, detX, y, th.text, chars, maxY) + 6;
    drawText(ctx, 'OBJECTIVES', detX, y, th.bronzeLight); y += 11;
    d.objectives.forEach((o, i) => {
      const [a, b] = q.progressOf(d, i), done = st?.status === 'done' || a >= b;
      const prog = b > 1 ? ` (${a}/${b})` : '';
      const label = o.type === 'deliver' ? `${o.text}${q.keyItems.has(o.item) ? ' - READY' : ''}` : `${o.text}${prog}`;
      y = para(ctx, `${done ? '[X]' : '[ ]'} ${label}`, detX + 4, y, done ? '#7ac060' : th.text, chars - 1, maxY) + 1;
    });
    if (st?.status === 'active' && q.readyToTurnIn(d) && d.turnIn) { y += 4; drawText(ctx, `RETURN TO ${NPCS[d.turnIn].name.toUpperCase()} AT THE CAMP`, detX, y, '#7ac060'); y += 11; }
    y += 6;
    drawText(ctx, 'REWARDS', detX, y, th.bronzeLight); y += 11;
    const r = d.rewards, parts = [];
    if (r.xp) parts.push(`${r.xp} XP`);
    if (r.gold) parts.push(`${r.gold} GOLD`);
    for (const [m, n] of Object.entries(r.materials || {})) parts.push(`${ITEM_DEFS[m]?.name || m} x${n}`);
    for (const it of r.items || []) if ((!it.classOnly || it.classOnly === g.hero.classId) && g.loot.allowedForClass(ITEM_DEFS[it.id], g.hero.classId)) parts.push(ITEM_DEFS[it.id].name);
    if (r.set) parts.push(`${SETS[r.set]?.name || r.set} set piece`);
    for (const rc of r.recipes || []) parts.push(`recipe: ${rc.replace(/_/g, ' ')}`);
    if (r.lore?.length) parts.push(`${r.lore.length} codex entr${r.lore.length > 1 ? 'ies' : 'y'}`);
    y = para(ctx, parts.join(', ').toUpperCase(), detX + 4, y, '#e0c060', chars - 1, maxY);
    if (st?.status === 'done') { y += 6; drawText(ctx, 'COMPLETED - REWARD CLAIMED', detX, y, '#7ac060'); }
    if (q.keyItems.size) {
      y = Math.max(y + 14, maxY - 12 - q.keyItems.size * 10);
      drawText(ctx, 'KEY ITEMS', detX, y, th.bronzeLight); y += 10;
      for (const k of q.keyItems) { drawText(ctx, KEY_ITEMS[k].name.toUpperCase(), detX + 4, y, '#ffe58a'); y += 10; }
    }
  } else if (js.tab === 'codex') {
    const l = LORE.find((x) => x.id === sel.id);
    if (sel.locked) { drawText(ctx, 'UNDISCOVERED', detX, y, th.textDim); y += 12; para(ctx, hintFor(l), detX, y, '#6a6250', chars); return; }
    drawText(ctx, l.title.toUpperCase(), detX, y, '#a8d8f0'); y += 11;
    drawText(ctx, CHAPTERS.find((c) => c.id === l.chapter)?.title || '', detX, y, th.textDim); y += 13;
    y = para(ctx, l.text, detX, y, th.text, chars, maxY) + 8;
    const links = [l.npc && NPCS[l.npc]?.name, l.enemy && (BOSSES[l.enemy] || ENEMIES[l.enemy])?.name].filter(Boolean);
    if (links.length) { drawText(ctx, `SEE ALSO: ${links.join(', ').toUpperCase()}`, detX, y, th.textDim); y += 11; }
    if (l.canon) para(ctx, `SOURCE NOTE: ${l.canon}`, detX, y, '#6a6250', chars, maxY);
  } else if (js.tab === 'bestiary') {
    const d = ENEMIES[sel.id] || BOSSES[sel.id];
    if (sel.locked) { drawText(ctx, 'NOT YET ENCOUNTERED', detX, y, th.textDim); return; }
    const spr = g.sprites[d.sprite]?.idle?.[0];
    if (spr && spr.width) { const s = Math.min(1, 120 / spr.height, 120 / spr.width); ctx.drawImage(spr, detX + detW - spr.width * s - 4, y, spr.width * s, spr.height * s); }
    drawText(ctx, d.name.toUpperCase(), detX, y, BOSSES[sel.id] ? '#ff9a60' : '#e8d8b0'); y += 11;
    const cat = d.category || (d.endgameBoss ? 'endgame boss' : d.chapterBoss ? 'chapter boss' : d.miniboss ? 'miniboss' : RANK_LABEL[d.rank] || d.rank);
    drawText(ctx, `${String(cat).toUpperCase()}  LV ${d.level || 1}`, detX, y, th.textDim); y += 11;
    drawText(ctx, `DEFEATED: ${q.bestiary[sel.id] || 0}`, detX, y, th.text); y += 13;
    if (d.title) { drawText(ctx, d.title, detX, y, th.textDim); y += 12; }
    y = para(ctx, d.lore || 'No record beyond its name.', detX, y, th.text, chars - 22, maxY) + 6;
    const res = d.resist ? Object.entries(d.resist).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join('  ') : 'NONE';
    drawText(ctx, `RESISTANCES: ${res}`, detX, y, th.textDim); y += 10;
    const sr = d.statusRules ? Object.entries(d.statusRules).map(([k, v]) => `${k.toUpperCase()} ${v === 'immune' ? 'IMMUNE' : 'x' + v}`).join('  ') : 'NORMAL';
    drawText(ctx, `STATUS: ${sr}`.slice(0, chars), detX, y, th.textDim); y += 10;
    if (d.attacks) { y += 4; drawText(ctx, 'KNOWN ATTACKS', detX, y, th.bronzeLight); y += 10; y = para(ctx, Object.values(d.attacks).map((a) => a.name).join(', '), detX, y, th.text, chars, maxY); }
    if (d.abilities) { y += 4; drawText(ctx, 'ABILITIES', detX, y, th.bronzeLight); y += 10; para(ctx, d.abilities.map((a) => a.name || a.kind).join(', '), detX, y, th.text, chars, maxY); }
  } else {
    const c = CHAPTERS.find((x) => x.id === sel.id);
    drawText(ctx, `${c.title}: ${c.name}`, detX, y, '#ff9a40'); y += 14;
    if (sel.locked) { para(ctx, `Locked. Complete the main quest of ${CHAPTERS[q.chapterIndex(c.id) - 1].title} first.`, detX, y, th.textDim, chars); return; }
    y = para(ctx, c.intro, detX, y, th.text, chars, maxY) + 8;
    const main = q.def(c.mainQuest);
    drawText(ctx, `MAIN QUEST: ${main.name.toUpperCase()} - ${q.isDone(main.id) ? 'COMPLETE' : q.isActive(main.id) ? 'IN PROGRESS' : 'NOT STARTED'}`, detX, y, q.isDone(main.id) ? '#7ac060' : '#ffd040'); y += 11;
    for (const sid of c.side) { const s = q.def(sid); drawText(ctx, `SIDE: ${s.name.toUpperCase()} - ${q.isDone(sid) ? 'COMPLETE' : q.isActive(sid) ? 'IN PROGRESS' : 'AVAILABLE FROM ' + NPCS[s.npc].name.toUpperCase()}`, detX, y, q.isDone(sid) ? '#7ac060' : th.text); y += 10; }
    if (c.id === CHAPTERS[CHAPTERS.length - 1].id && q.ending) {
      y += 10;
      const e = ENDINGS[q.ending];
      drawText(ctx, `ENDING RECORD: ${e.title}`, detX, y, '#ffd040'); y += 12;
      para(ctx, e.text, detX, y, th.text, chars, maxY);
    }
  }
}

function hintFor(l) {
  if (!l) return '';
  if (l.discovery.type === 'tablet') return 'Found on an inscribed tablet somewhere in this chapter\'s dungeon.' + (l.enemy ? ' Defeating its subject may also reveal it.' : '');
  if (l.discovery.type === 'quest') return 'Earned by completing a quest.';
  if (l.discovery.type === 'ending') return 'Recorded when the story ends.';
  return 'Unknown.';
}

// ------------------------------------------------------------------ NPC dialogue (camp)
export function drawDialogue(ctx, g, t) {
  const th = g.theme, ui = g.ui, q = g.quests;
  const d = q.dialogue(g.talkNpc);
  if (!d) { g.closePanel(); return; }
  const B = { x: 60, y: 70, w: 520, h: 330 };
  ui.block(0, 0, 640, 480);
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); ctx.globalAlpha = 1;
  ui.frame(ctx, B.x, B.y, B.w, B.h, th, { border: 5, panel: '#0c0a07' });
  ui.textButton(ctx, B.x + B.w - 24, B.y + 6, 15, 11, 'X', th, () => g.closePanel());
  const por = g.sprites.npcPortraits?.[d.npc.portrait];
  if (por) ctx.drawImage(por, B.x + 12, B.y + 12, 64, 64);
  drawText(ctx, d.npc.name.toUpperCase(), B.x + 88, B.y + 14, '#ffd040', { scale: 1 });
  drawText(ctx, d.npc.title, B.x + 88, B.y + 26, th.textDim);
  let y = B.y + 40;
  y = para(ctx, `"${d.line}"`, B.x + 88, y, th.text, 70) + 3;
  if (d.byClass) y = para(ctx, d.byClass, B.x + 88, y, g.hero.def.colors?.accent || th.highlight, 70);
  y = Math.max(y, B.y + 86) + 6;
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(B.x + 10, y, B.w - 20, 1); y += 8;
  const actions = [];
  for (const qd of d.turnIns) {
    if (qd.ending) {
      drawText(ctx, `${qd.name.toUpperCase()}: THE LAST SEAL IS IN YOUR HAND. WHAT DO YOU DO?`, B.x + 14, y, '#ffd040'); y += 12;
      for (const e of Object.values(ENDINGS)) actions.push({ label: e.id === 'seal' ? 'SEAL THE ABYSS FOREVER' : 'KEEP THE SEAL - BECOME THE FIFTH RIDER', run: () => g.quests.turnIn(qd.id, e.id), color: '#ffd040' });
    } else actions.push({ label: `TURN IN: ${qd.name}`, run: () => g.quests.turnIn(qd.id), color: '#7ac060' });
  }
  for (const qd of d.offers) actions.push({ label: `ACCEPT: ${qd.name}`, run: () => g.quests.accept(qd.id), tip: qd.desc });
  for (const qd of d.active) {
    const next = qd.objectives.find((o, i) => !q.objectiveDone(qd, i) && o.type !== 'deliver');
    drawText(ctx, `${qd.name.toUpperCase()}: ${(next?.text || 'Return when you have it.').toUpperCase()}`.slice(0, 84), B.x + 14, y, th.textDim); y += 10;
  }
  if (d.offers.length) for (const qd of d.offers) { y = para(ctx, `${qd.name}: ${qd.desc}`, B.x + 14, y + 2, th.text, 82, B.y + B.h - 60); }
  actions.push({ label: 'FAREWELL', run: () => g.closePanel() });
  const by = B.y + B.h - 12 - actions.length * 17;
  actions.forEach((a, i) => {
    const hov = ui.textButton(ctx, B.x + 14, by + i * 17, B.w - 28, 14, a.label.toUpperCase().slice(0, 80), th, a.run, { selected: g.menuIndex % actions.length === i });
    if (hov && a.tip) ui.tooltip = { text: a.tip, x: B.x + B.w / 2, y: by + i * 17 - 6 };
  });
  g.activeMenu = actions;
}

// ------------------------------------------------------------------ chapter title card
export function drawChapterCard(ctx, g, t) {
  const c = CHAPTERS.find((x) => x.id === g.quests.titleCard);
  if (!c) { g.closePanel(); return; }
  g.ui.block(0, 0, 640, 480);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
  drawText(ctx, c.title, 320, 150, '#a0823e', { align: 'center', scale: 2 });
  drawText(ctx, c.name, 320, 180, '#ff9a40', { align: 'center', scale: 3 });
  let y = 230;
  for (const l of wrapText(c.intro, 70)) { drawText(ctx, l, 320, y, '#d8c8a0', { align: 'center' }); y += 11; }
  const main = g.quests.def(c.mainQuest);
  if (main) drawText(ctx, `NEW QUEST: ${main.name.toUpperCase()}`, 320, y + 16, '#ffd040', { align: 'center' });
  if (Math.floor(t * 2) % 2) drawText(ctx, 'PRESS ENTER OR CLICK TO CONTINUE', 320, 400, '#8c8467', { align: 'center' });
  g.ui.button(0, 0, 640, 480, () => g.dismissChapterCard(), { sound: false });
  g.activeMenu = [{ label: 'continue', run: () => g.dismissChapterCard() }];
}
