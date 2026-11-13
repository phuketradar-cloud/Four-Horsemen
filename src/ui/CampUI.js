import { FULL } from '../data/config.js';
import { DUNGEONS, DUNGEON_ORDER } from '../data/dungeons/index.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty.js';
import { BOSSES } from '../data/bosses.js';
import { LOOT_TABLES } from '../data/lootTables.js';
import { ITEM_DEFS } from '../data/items.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { floorLevel } from '../systems/DungeonGenerator.js';
import { NPCS } from '../data/campaign.js';
import { drawNpcFace, NPC_FACE } from '../render/NpcArt.js';

// The Pale Camp (Phase 4 hub): pick a dungeon and difficulty, see recommended levels, warnings,
// boss status, local materials and rewards; craft at the forge; manage gear; retrieve the stash.
// Keyboard: up/down select a dungeon, ENTER twice to enter; TAB / I / C / K panels; ESC pause.
const LIST = { x: 12, y: 44, w: 220, h: 46, step: 49 };
// NPC faces: a big column in the empty left margin of the 16:9 screen (x < 0 in CLASSIC coordinates)
const NPC_COL = { x: -122, y: 4, w: NPC_FACE.w, h: NPC_FACE.h, step: 96 };
const DET = { x: 244, y: 44, w: 384, h: 330 };

// Painted camp backdrop: first file found of CAMP_BG.files; dim = black overlay so panels stay readable.
export const CAMP_BG = { files: ['assets/camp/sanctuary.jpg', 'assets/camp/sanctuary.webp', 'assets/camp/sanctuary.png'], dim: 0.5, img: null, tried: false };
function campBackground() {
  if (!CAMP_BG.tried && typeof Image !== 'undefined') {
    CAMP_BG.tried = true;
    const tryAt = (i) => { if (i >= CAMP_BG.files.length) return; const im = new Image(); im.onload = () => { CAMP_BG.img = im; }; im.onerror = () => tryAt(i + 1); im.src = CAMP_BG.files[i]; };
    tryAt(0);
  }
  return CAMP_BG.img;
}

function materialsOf(def) {
  const ids = new Set();
  for (const key of ['enemies']) for (const e of Object.values(def[key] || {})) for (const en of LOOT_TABLES[e.loot]?.entries || []) if (en.type === 'item' && ITEM_DEFS[en.item]?.kind === 'material') ids.add(en.item);
  if (def.boss) for (const f of LOOT_TABLES[`boss_${def.boss}`]?.fixed || []) ids.add(f.item);
  return [...ids];
}

export function drawCamp(ctx, g, t) {
  const th = g.theme, ui = g.ui, p = g.progress;
  // backdrop: painted sanctuary (assets/camp/sanctuary.*) dimmed under the UI, else the plain floor
  const bg = campBackground();
  if (bg) {
    const [fx0, fy0, fw, fh] = FULL, sc = Math.max(fw / bg.width, fh / bg.height);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bg, fx0 + (fw - bg.width * sc) / 2, fy0 + (fh - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    ctx.restore();
    ctx.globalAlpha = CAMP_BG.dim; ctx.fillStyle = '#050302'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#0a0806'; ctx.fillRect(...FULL);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? '#141008' : '#1a140c'; ctx.fillRect(FULL[0], 380 + i * 3, FULL[2], 3); }
  }
  // campfire
  const fx = 40, fy = 30;
  for (let i = 0; i < 6; i++) { const h = 10 + Math.sin(t * 9 + i) * 4 + (i % 3) * 3; ctx.fillStyle = ['#ff6a20', '#ffb030', '#ffe080'][i % 3]; ctx.fillRect(fx - 9 + i * 3, fy - h, 3, h); }
  ctx.fillStyle = '#4a3020'; ctx.fillRect(fx - 12, fy, 26, 3);
  ui.block(...FULL);
  drawText(ctx, 'THE LAST SANCTUARY', 320, 8, '#d8c8a0', { align: 'center', scale: 2 });
  const ch = g.quests.currentChapter;
  drawText(ctx, g.quests.campaignComplete ? 'THE STORY IS TOLD - THE WORLD ENDURES' : `${ch.title}: ${ch.name}`, 320, 28, '#ff9a40', { align: 'center' });

  // ---- NPCs of the sanctuary (talk: quests, story, class lines)
  Object.values(NPCS).forEach((npc, i) => {
    const x = NPC_COL.x, y = NPC_COL.y + i * NPC_COL.step, w = NPC_COL.w, h = NPC_COL.h;
    const hov = ui.button(x, y, w, h, () => g.talkTo(npc.id));
    drawNpcFace(ctx, g.sprites.npcPortraits?.[npc.portrait], x, y, w, h);
    // name strip along the bottom of the face
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + h - 11, w - 2, 10); ctx.globalAlpha = 1;
    drawText(ctx, npc.name.toUpperCase().replace(/^(ELDER|BROTHER|THE) /, ''), x + w / 2, y + h - 10, hov ? '#ffd040' : '#d8c8a0', { align: 'center' });
    const d = g.quests.dialogue(npc.id);
    const mark = d.turnIns.length ? ['?', '#7ac060'] : d.offers.length ? ['!', '#ffd040'] : null;
    if (mark) { ctx.fillStyle = '#000'; ctx.fillRect(x + w - 12, y + 2, 10, 12); drawText(ctx, mark[0], x + w - 7, y + 4, mark[1], { align: 'center' }); }
    if (hov) { ctx.strokeStyle = '#ffd040'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.lineWidth = 1; ui.tooltip = { text: `${npc.name} - ${npc.title}${mark ? (mark[0] === '?' ? ' (QUEST READY)' : ' (NEW QUEST)') : ''}`, x: x + w / 2 + 70, y: y + h / 2 }; }
  });
  drawText(ctx, 'TALK: CLICK A FACE', NPC_COL.x + NPC_COL.w / 2, NPC_COL.y + 5 * NPC_COL.step, th.textDim, { align: 'center' });
  drawText(ctx, 'J: JOURNAL', NPC_COL.x + NPC_COL.w / 2, NPC_COL.y + 5 * NPC_COL.step + 10, th.textDim, { align: 'center' });

  // ---- dungeon list
  const items = [];
  DUNGEON_ORDER.forEach((id, i) => {
    const def = DUNGEONS[id];
    const y = LIST.y + i * LIST.step;
    const sel = g.campSel === id, unlocked = p.isUnlocked(id);
    const hov = ui.button(LIST.x, y, LIST.w, LIST.h, () => { g.campSel = id; g.menuIndex = i; });
    ui.box(ctx, LIST.x, y, LIST.w, LIST.h, th, sel ? '#2e2410' : hov ? '#1a150c' : '#0e0c08');
    ctx.fillStyle = unlocked ? def.theme.accent : '#3a3428'; ctx.fillRect(LIST.x + 3, y + 3, 3, LIST.h - 6);
    drawText(ctx, def.prologue ? `PROLOGUE` : `CHAPTER ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][def.order] || def.order}`, LIST.x + 12, y + 4, th.textDim);
    drawText(ctx, def.name.replace('THE ', '').slice(0, 30), LIST.x + 12, y + 14, unlocked ? th.highlight : '#5a5244');
    drawText(ctx, `LV ${def.recommended[0]}-${def.recommended[1]}${def.floors > 1 ? `  ${def.floors} FLOORS` : ''}`, LIST.x + 12, y + 24, th.text);
    const done = p.timesCompleted(id);
    const run = p.runs[id];
    const status = !unlocked ? 'LOCKED' : run ? `RUN IN PROGRESS (F${run.floor + 1})` : done ? `CLEARED x${done}` : 'NEW';
    drawText(ctx, status, LIST.x + 12, y + 34,!unlocked ? '#8a4030' : run ? '#ffd040' : done ? '#7ac060' : '#a8d8f0');
    if (def.boss && (p.bosses[def.boss] || 0) > 0) drawText(ctx, 'BOSS SLAIN', LIST.x + LIST.w - 8, y + 6, '#ff9a60', { align: 'right' });
    items.push({ label: def.name, run: () => { if (g.campSel === id && unlocked) g.enterDungeon(id, p.selected[id]); else g.campSel = id; } });
  });
  g.activeMenu = items;
  if (DUNGEON_ORDER[g.menuIndex] && g.menuIndex !== DUNGEON_ORDER.indexOf(g.campSel) && g._lastMenuIndex !== g.menuIndex) g.campSel = DUNGEON_ORDER[g.menuIndex];
  g._lastMenuIndex = g.menuIndex;

  // ---- detail panel
  const def = DUNGEONS[g.campSel] || DUNGEONS.ashen_catacombs;
  const id = def.id;
  ui.frame(ctx, DET.x, DET.y, DET.w, DET.h, th, { border: 4, panel: '#0e0c08' });
  let y = DET.y + 10;
  drawText(ctx, def.name, DET.x + 12, y, def.theme.accent, { scale: 1 }); y += 12;
  for (const l of wrapText(def.lore, 60)) { drawText(ctx, l, DET.x + 12, y, th.text); y += 9; }
  for (const l of wrapText(def.description || '', 60)) { drawText(ctx, l, DET.x + 12, y, th.textDim); y += 9; }
  y += 4;
  const unlocked = p.isUnlocked(id);
  if (!unlocked) {
    drawText(ctx, `LOCKED: ${p.unlockReason(id)}`, DET.x + 12, y, '#ff7a60');
    drawFooter(ctx, g, t);
    return;
  }
  const run = p.runs[id];
  const diffSel = run ? run.difficulty : p.selected[id] || 'normal';
  drawText(ctx, `RECOMMENDED LEVEL ${def.recommended[0]}-${def.recommended[1]}   YOU: LV ${g.hero.level}   ENEMIES: LV ${floorLevel(def, 0, diffSel)}-${floorLevel(def, def.floors - 1, diffSel)}`, DET.x + 12, y, th.highlight); y += 11;
  const warn = g.director.levelWarning(id, diffSel);
  if (warn) { for (const l of wrapText(warn.text, 60)) { drawText(ctx, l, DET.x + 12, y, warn.color); y += 9; } }
  if (g.hero.level > def.enemyLevels[1] + DIFFICULTIES[diffSel].levelAdd + 2) { for (const l of wrapText(`Over-levelled: kill XP here is reduced (-15% per level beyond +2). Completion XP too. Shown in the log when it happens.`, 60)) { drawText(ctx, l, DET.x + 12, y, '#a89a70'); y += 9; } }
  if (def.boss) { const b = BOSSES[def.boss]; drawText(ctx, `BOSS: ${b.name.toUpperCase()}  (${p.bosses[def.boss] ? `SLAIN x${p.bosses[def.boss]}` : 'UNDEFEATED'})`, DET.x + 12, y, '#ff9a60'); y += 11; }
  // materials found here
  const mats = materialsOf(def);
  if (mats.length) {
    drawText(ctx, 'MATERIALS:', DET.x + 12, y + 4, th.textDim);
    mats.slice(0, 12).forEach((m, i) => {
      const x = DET.x + 82 + i * 22;
      ctx.drawImage(g.sprites.icons[ITEM_DEFS[m].icon], x, y, 16, 16);
      if (ui.hover(x, y, 16, 16)) ui.tooltip = { text: `${ITEM_DEFS[m].name} (have ${g.inventory.countOf(m)})`, x: x + 8, y: y + 20 };
    });
    y += 22;
  }
  // difficulty selector
  drawText(ctx, run ? 'DIFFICULTY (LOCKED WHILE A RUN IS IN PROGRESS):' : 'DIFFICULTY:', DET.x + 12, y, th.textDim); y += 11;
  DIFFICULTY_ORDER.forEach((d, i) => {
    const D = DIFFICULTIES[d], ok = p.difficultyUnlocked(id, d) && !run;
    const x = DET.x + 12 + i * 122;
    const hov = ui.textButton(ctx, x, y, 116, 15, `${D.name}${p.timesCompleted(id, d) ? ' *' : ''}`, th, () => { if (ok) p.selected[id] = d; else g.audio.play('deny'); }, { selected: diffSel === d, disabled: !ok && diffSel !== d });
    if (hov) ui.tooltip = { text: ok || diffSel === d ? `${D.desc} Rewards x${D.materialMult} materials.` : p.unlockReason(id, d) || 'Finish the current run first.', x: x + 58, y: y + 20 };
  });
  y += 20;
  for (const l of wrapText(DIFFICULTIES[diffSel].desc, 60)) { drawText(ctx, l, DET.x + 12, y, DIFFICULTIES[diffSel].color); y += 9; }
  if (!def.prologue && !p.claimed.has(`firstclear:${id}:${diffSel}`)) { drawText(ctx, `FIRST ${DIFFICULTIES[diffSel].name} CLEAR BONUS AVAILABLE`, DET.x + 12, y, '#7ac060'); y += 10; }
  if (def.prologue) { for (const l of wrapText('Replaying the prologue starts a NEW hero (Phase 1 rules). Use PAUSE > NEW HORSEMAN or the title screen for that.', 60)) { drawText(ctx, l, DET.x + 12, y, th.textDim); y += 9; } }
  // enter / resume
  if (!def.prologue) {
    const label = run ? `RESUME RUN - FLOOR ${run.floor + 1} (${run.difficulty.toUpperCase()})` : `ENTER ${def.name.replace('THE ', '')}`;
    ui.textButton(ctx, DET.x + 12, DET.y + DET.h - 26, DET.w - 24, 18, label, th, () => g.enterDungeon(id, diffSel), { selected: true });
  }
  drawFooter(ctx, g, t);
}

function drawFooter(ctx, g) {
  const th = g.theme, ui = g.ui;
  const y = 386;
  ui.frame(ctx, 244, y, 384, 88, th, { border: 3, panel: '#0e0c08' });
  const P2 = g.sprites.portraits;
  ctx.drawImage(P2[g.hero.def.portrait], 252, y + 8, 44, 52);
  drawText(ctx, `${g.hero.def.name}  LV ${g.hero.level}`, 304, y + 10, th.highlight);
  drawText(ctx, `HP ${Math.ceil(g.hero.hp)}/${g.hero.maxHp}   GOLD ${g.gold}`, 304, y + 21, th.text);
  drawText(ctx, `XP ${g.hero.xp}/${g.hero.xpNeeded}   SKILL POINTS ${g.hero.skillPoints}`, 304, y + 32, th.textDim);
  const btns = [
    ['BAG', () => g.togglePanel('inventory'), 'INVENTORY [TAB]'], ['GEAR', () => g.togglePanel('character'), 'CHARACTER [I]'],
    ['FORGE', () => g.togglePanel('crafting'), 'CRAFT AT THE FORGE [C]'], ['SKILLS', () => g.togglePanel('skills'), 'SKILLS [K]'],
    ['AUTO EQUIP', () => g.autoEquipBest(!!g.party?.enabled), g.party?.enabled ? 'BEST GEAR FOR THE WHOLE PARTY [SHIFT+Y]' : 'WEAR THE BEST GEAR IN YOUR BAG [Y]'],
    [`STASH ${g.stash.length}`, () => g.takeStash(), 'TAKE OVERFLOW ITEMS FROM THE STASH'], ['JOURNAL', () => g.togglePanel('journal'), 'QUESTS, CODEX, BESTIARY [J]'], ['SAVE', () => g.saveGame(), 'SAVE'], ['MENU', () => g.openPanel('pause'), 'PAUSE MENU [ESC]'],
  ];
  btns.forEach(([label, fn, tip], i) => {
    const x = 252 + (i % 5) * 74, yy = y + 48 + Math.floor(i / 5) * 18;
    const hov = ui.textButton(ctx, x, yy, 70, 15, label, th, fn, { disabled: label.startsWith('STASH') && !g.stash.length, selected: label === 'AUTO EQUIP' });
    if (hov) ui.tooltip = { text: tip, x: x + 35, y: yy - 6 };
  });
  drawText(ctx, 'UP/DOWN: SELECT  ENTER x2: ENTER  TAB/I/C/K/J: PANELS', 12, 466, th.textDim);
}
