import { LAYOUT, FULL } from '../data/config.js';
import { RARITIES } from '../data/items.js';
import { HORSEMEN } from '../data/characters.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { drawMap } from './HUD.js';

// Modal panels drawn over the viewport frame. All widgets are canvas-drawn (no HTML cards).
// (Inventory, equipment and crafting screens live in InventoryUI / EquipmentUI / CraftingUI.)
const P = LAYOUT.panel; // CLASSIC coordinates (drawn through GameManager._classic)
import { REBINDABLE, keysFor, keyLabel } from '../core/Input.js';

function panelBase(ctx, g, title) {
  g.ui.block(...FULL); // modal: swallow clicks elsewhere
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  g.ui.frame(ctx, P.x, P.y, P.w, P.h, g.theme, { border: 5 });
  drawText(ctx, title, P.x + P.w / 2, P.y + 9, g.theme.highlight, { align: 'center' });
  ctx.fillStyle = g.theme.bronzeDark; ctx.fillRect(P.x + 8, P.y + 19, P.w - 16, 1);
  g.ui.textButton(ctx, P.x + P.w - 24, P.y + 6, 15, 11, 'X', g.theme, () => g.closePanel());
}

// ------------------------------------------------------------------ formation
export function drawFormation(ctx, g) {
  const th = g.theme;
  panelBase(ctx, g, 'PARTY FORMATION');
  drawText(ctx, 'CLICK TWO SLOTS TO SWAP POSITIONS', P.x + P.w / 2, P.y + 26, th.text, { align: 'center' });
  for (let i = 0; i < 6; i++) {
    const colX = i < 3 ? P.x + 40 : P.x + 212;
    const y = P.y + 42 + (i % 3) * 82;
    const id = g.formation[i];
    const def = id ? HORSEMEN[id] : null;
    const sel = g.formationSel === i;
    const hov = g.ui.button(colX, y, 144, 76, () => g.formationClick(i));
    g.ui.box(ctx, colX, y, 144, 76, th, sel ? '#3a2c10' : hov ? '#1e170c' : '#100e09');
    const P2 = g.sprites.portraits;
    const lead = id && id === g.hero.classId;
    ctx.drawImage(!def ? P2.empty : lead ? P2[def.portrait] : P2[id + 'Sealed'], colX + 6, y + 12);
    drawText(ctx, `SLOT ${i + 1} ${i < 3 ? 'LEFT' : 'RIGHT'}`, colX + 6, y + 3, th.textDim);
    drawText(ctx, def ? def.name : 'EMPTY', colX + 56, y + 16, sel || lead ? th.highlight : th.text);
    drawText(ctx, def ? def.title.replace('THE ', '') : '', colX + 56, y + 27, th.textDim);
    drawText(ctx, def ? (lead ? def.role.split(' ')[0] : 'RESTING') : '-', colX + 56, y + 38, lead ? '#7ac060' : '#a04030');
    if (lead) drawText(ctx, `LV ${g.hero.level}`, colX + 56, y + 49, th.text);
  }
  drawText(ctx, 'ONE HORSEMAN RIDES PER RUN. PARTY PLAY: A LATER PHASE', P.x + P.w / 2, P.y + P.h - 16, th.textDim, { align: 'center' });
}

// ------------------------------------------------------------------ full map
export function drawMapPanel(ctx, g) {
  const th = g.theme;
  panelBase(ctx, g, g.dungeon.def.generated ? `MAP - ${g.dungeon.def.name} - FLOOR ${g.dungeon.def.floor + 1}/${g.dungeon.def.floors}` : 'DUNGEON MAP');
  const cs = Math.max(4, Math.min(12, Math.floor((P.w - 20) / g.dungeon.w), Math.floor((P.h - 60) / g.dungeon.h)));
  const ox = Math.round(P.x + P.w / 2 - (g.dungeon.w * cs) / 2), oy = P.y + 26;
  drawMap(ctx, g, ox, oy, cs, true);
  const legend = g.dungeon.def.generated
    ? [['#ff3a1a', 'YOU'], ['#e05030', 'FOE'], ['#f0c040', 'CHEST'], ['#b02a14', 'GATE'], ['#d0a020', 'SEAL'], ['#60c0e0', 'RUNE'], ['#ffffff', 'STAIRS'], ['#80d8ff', 'EXIT']]
    : [['#ff3a1a', 'YOU'], ['#e05030', 'ENEMY (SEEN)'], ['#f0c040', 'CHEST'], ['#a06a2a', 'DOOR'], ['#b02a14', 'GATE']];
  let lx = P.x + 18;
  const ly = P.y + P.h - 22;
  for (const [c, label] of legend) {
    ctx.fillStyle = c; ctx.fillRect(lx, ly, 6, 6);
    drawText(ctx, label, lx + 9, ly, th.text);
    lx += 9 + label.length * 6 + 14;
  }
}

// ------------------------------------------------------------------ pause / options / help
export function drawMenuList(ctx, g, items, x, y, w) {
  g.activeMenu = items;
  items.forEach((it, i) => {
    const sel = g.menuIndex === i;
    g.ui.textButton(ctx, x, y + i * 22, w, 17, it.label, g.theme, () => { g.menuIndex = i; it.run(); }, { selected: sel, disabled: it.disabled });
  });
}

export function drawPause(ctx, g) {
  panelBase(ctx, g, 'PAUSED');
  const camp = g.scene === 'camp';
  const items = [
    { label: 'RESUME', run: () => g.closePanel() },
    { label: 'SAVE GAME', run: () => g.saveGame() },
    { label: 'LOAD GAME', run: () => g.loadGame(), disabled: !g.saves.hasSave() },
    { label: 'OPTIONS', run: () => g.openPanel('options') },
    { label: 'CONTROLS', run: () => g.openPanel('help') },
  ];
  if (!camp) {
    items.push({ label: 'RETURN TO CAMP', run: () => { g.closePanel(); g.director.returnToCamp(); }, disabled: g.inCombat || g.combat.active });
    if (!g.dungeon.def.generated) items.push({ label: 'RESTART PROLOGUE (NEW HERO)', run: () => g.newGame() });
  }
  items.push({ label: 'NEW HORSEMAN', run: () => g.openSelect() }, { label: 'MAIN MENU', run: () => g.toTitle() });
  drawMenuList(ctx, g, items, P.x + P.w / 2 - 90, P.y + 30, 180);
  drawText(ctx, camp ? 'ESC: RESUME' : 'ESC: RESUME   O: OBJECTIVES', P.x + P.w / 2, P.y + P.h - 18, g.theme.textDim, { align: 'center' });
}

// ------------------------------------------------------------------ Phase 4: objectives / boss victory
export function drawObjectives(ctx, g) {
  const th = g.theme;
  const run = g.run, def = g.director.def;
  panelBase(ctx, g, 'OBJECTIVES');
  if (!run || !def) { drawText(ctx, 'NO ACTIVE DUNGEON RUN', P.x + P.w / 2, P.y + 60, th.textDim, { align: 'center' }); return; }
  let y = P.y + 28;
  drawText(ctx, `${def.name}`, P.x + 16, y, th.highlight); y += 11;
  drawText(ctx, `FLOOR ${run.floor + 1}/${def.floors}   DIFFICULTY ${run.difficulty.toUpperCase()}   SEED ${run.seed}`, P.x + 16, y, th.textDim); y += 16;
  const objs = g.director.objectives();
  if (!objs.length) { drawText(ctx, 'Clear the Chamber of the Seal (prologue).', P.x + 16, y, th.text); return; }
  drawText(ctx, 'MANDATORY', P.x + 16, y, th.bronzeLight); y += 11;
  for (const o of objs.filter((q) => !q.optional)) { for (const l of wrapText(`${o.done ? '[X]' : '[ ]'} ${o.label}`, 58)) { drawText(ctx, l, P.x + 20, y, o.done ? '#7ac060' : th.text); y += 10; } }
  if (run.floor < def.floors - 1) { drawText(ctx, `[ ] Floor ${def.floors}: defeat ${def.boss.replace(/_/g, ' ').toUpperCase()} and leave`, P.x + 20, y, th.textDim); y += 10; }
  y += 6;
  drawText(ctx, 'OPTIONAL (NEVER REQUIRED)', P.x + 16, y, th.bronzeLight); y += 11;
  for (const o of objs.filter((q) => q.optional)) { for (const l of wrapText(`${o.done ? '[X]' : '[ ]'} ${o.label}`, 58)) { drawText(ctx, l, P.x + 20, y, o.done ? '#7ac060' : th.textDim); y += 10; } }
  y += 6;
  drawText(ctx, `BOSS: ${run.bossDefeated ? 'DEFEATED' : g.bossCtl.active ? 'IN COMBAT' : 'ALIVE'}`, P.x + 16, y, run.bossDefeated ? '#7ac060' : '#ff9a60');
  g.ui.textButton(ctx, P.x + P.w - 150, P.y + P.h - 22, 130, 14, g.settings.objectives ? 'TRACKER: ON' : 'TRACKER: OFF', th, () => g.toggleSetting('objectives'));
}

export function drawVictory(ctx, g, t) {
  const th = g.theme, r = g.run?.bossReward;
  panelBase(ctx, g, 'VICTORY');
  if (!r) { drawText(ctx, 'THE GUARDIAN IS DEFEATED', P.x + P.w / 2, P.y + 60, th.highlight, { align: 'center' }); return; }
  drawText(ctx, r.name.toUpperCase(), P.x + P.w / 2, P.y + 30, Math.floor(t * 3) % 2 ? '#ffd040' : '#f0a020', { align: 'center', scale: 2 });
  drawText(ctx, 'IS DEFEATED', P.x + P.w / 2, P.y + 50, th.text, { align: 'center' });
  let y = P.y + 70;
  drawText(ctx, `+${r.xp} XP   +${r.gold} GOLD`, P.x + 30, y, '#e0c060'); y += 14;
  for (const it of r.items.slice(0, 12)) { drawText(ctx, `${it.name}${it.qty > 1 ? ' X' + it.qty : ''}`.slice(0, 56), P.x + 30, y, RARITIES[it.rarity]?.color || th.text); y += 10; }
  for (const n of r.learned || []) { drawText(ctx, `RECIPE LEARNED: ${n}`, P.x + 30, y, '#7ac060'); y += 10; }
  drawText(ctx, 'THE EXIT PORTAL HAS AWAKENED.', P.x + P.w / 2, P.y + P.h - 44, '#a8f0ff', { align: 'center' });
  g.ui.textButton(ctx, P.x + P.w / 2 - 50, P.y + P.h - 30, 100, 15, 'CONTINUE', th, () => g.closePanel());
}

// Phase 6 options: every row works from the keyboard (UP/DOWN select, LEFT/RIGHT change a volume,
// ENTER toggles) as well as the mouse. Settings persist immediately.
export function drawOptions(ctx, g) {
  const th = g.theme, s = g.settings;
  panelBase(ctx, g, 'OPTIONS');
  const vol = (label, key) => ({ label, key, adjust: (d) => g.setVolume(key, s[key] + d * 0.1), run: () => g.setVolume(key, s[key] >= 1 ? 0 : s[key] + 0.1) });
  const items = [
    vol('MASTER VOLUME', 'master'), vol('MUSIC VOLUME', 'music'), vol('EFFECTS VOLUME', 'sfx'), vol('AMBIENT VOLUME', 'ambient'),
    { label: s.muted ? 'SOUND: MUTED' : 'SOUND: ON', run: () => g.toggleMute() },
    { label: s.reduceShake ? 'SCREEN SHAKE: REDUCED' : 'SCREEN SHAKE: FULL', run: () => g.toggleSetting('reduceShake') },
    { label: s.reduceFlash ? 'FLASHING: REDUCED' : 'FLASHING: FULL', run: () => g.toggleSetting('reduceFlash') },
    { label: `COLORS: ${th.name}`, run: () => g.cycleTheme() },
    { label: `RESOLUTION: ${s.resolution === 'auto' ? 'AUTO' : s.resolution} - ${g.display.label()}`, run: () => g.cycleResolution() },
    { label: `SCALING: ${s.scaling === 'integer' ? 'INTEGER (LETTERBOX)' : 'SHARP FIT'}`, run: () => g.toggleScaling() },
    { label: g.display.fullscreen ? 'DISPLAY: FULLSCREEN [F11]' : 'DISPLAY: WINDOWED [F11]', run: () => g.toggleFullscreen() },
    { label: s.hotkeys === 'weapons' ? 'KEYS 1-4: WEAPONS' : 'KEYS 1-4: SKILLS', run: () => g.toggleHotkeys() },
    { label: 'REBIND CONTROLS', run: () => g.openPanel('keybinds') },
    { label: 'RESTORE DEFAULT SETTINGS', run: () => g.ask('Restore all audio and accessibility settings to their defaults?', () => g.resetSettings()) },
    { label: 'EXPORT SAVE (JSON)', run: () => g.exportSave(), disabled: g.scene !== 'playing' && g.scene !== 'camp' },
    { label: 'BACK', run: () => g.openPanel(g.scene === 'title' ? null : 'pause') },
  ];
  g.activeMenu = items;
  const x = P.x + 40, w = P.w - 80;
  items.forEach((it, i) => {
    const y = P.y + 24 + i * 18, sel = g.menuIndex === i;
    if (it.key) {
      if (sel) { ctx.fillStyle = '#2e2410'; ctx.fillRect(x, y - 1, w, 16); }
      drawText(ctx, it.label, x + 6, y + 3, sel ? th.highlight : th.text);
      g.ui.textButton(ctx, x + 128, y, 18, 14, '-', th, () => { g.menuIndex = i; it.adjust(-1); });
      g.ui.bar(ctx, x + 152, y + 4, 100, 6, s[it.key], th.bronze, '#120f09');
      g.ui.textButton(ctx, x + 258, y, 18, 14, '+', th, () => { g.menuIndex = i; it.adjust(1); });
      drawText(ctx, `${Math.round(s[it.key] * 100)}%`, x + w - 4, y + 3, sel ? th.highlight : th.textDim, { align: 'right' });
    } else g.ui.textButton(ctx, x, y, w, 15, it.label, th, () => { g.menuIndex = i; it.run(); }, { selected: sel, disabled: it.disabled });
  });
  drawText(ctx, 'UP/DOWN SELECT - LEFT/RIGHT VOLUME - ENTER CHANGE', P.x + P.w / 2, P.y + P.h - 14, th.textDim, { align: 'center' });
}

const ACTION_LABEL = { forward: 'MOVE FORWARD', back: 'STEP BACK', turnLeft: 'TURN LEFT', turnRight: 'TURN RIGHT', attack: 'ATTACK', interact: 'INTERACT', guard: 'GUARD / PARRY', quickPotion: 'DRINK POTION', target: 'NEXT TARGET', look: 'LOOK', inventory: 'INVENTORY', character: 'CHARACTER', skills: 'SKILLS', crafting: 'CRAFTING', map: 'MAP', journal: 'JOURNAL', objectives: 'OBJECTIVES', ultimate: 'ULTIMATE' };
export function drawKeybinds(ctx, g, t) {
  const th = g.theme;
  panelBase(ctx, g, 'REBIND CONTROLS');
  const map = g.input.keymap;
  const items = REBINDABLE.map((a) => ({ label: a, run: () => g.beginRebind(a) }));
  items.push({ label: 'RESET CONTROLS', run: () => g.resetKeybinds() }, { label: 'BACK', run: () => g.openPanel('options') });
  g.activeMenu = items;
  const x = P.x + 20, w = P.w - 40;
  items.forEach((it, i) => {
    const y = P.y + 24 + i * 15, sel = g.menuIndex === i;
    if (i < REBINDABLE.length) {
      const hov = g.ui.button(x, y - 1, w, 14, () => { g.menuIndex = i; it.run(); });
      if (sel || hov) { ctx.fillStyle = sel ? '#2e2410' : '#1a150c'; ctx.fillRect(x, y - 1, w, 14); }
      drawText(ctx, ACTION_LABEL[it.label] || it.label, x + 6, y + 2, sel ? th.highlight : th.text);
      const keys = keysFor(map, it.label).map(keyLabel);
      const waiting = g.rebinding === it.label;
      drawText(ctx, waiting ? (Math.floor(t * 3) % 2 ? 'PRESS A KEY... (ESC CANCELS)' : '') : keys.join(' / ') || 'UNBOUND', x + w - 6, y + 2, waiting ? '#ffd040' : keys.length ? '#c8bc98' : '#ff6050', { align: 'right' });
    } else g.ui.textButton(ctx, x + (i - REBINDABLE.length) * (w / 2 + 2), P.y + 24 + REBINDABLE.length * 15 + 4, w / 2 - 2, 15, it.label, th, () => { g.menuIndex = i; it.run(); }, { selected: sel });
  });
}

export const CONTROLS = [
  ['W / UP', 'MOVE FORWARD'], ['S / DOWN', 'STEP BACK'], ['A D / ARROWS', 'TURN LEFT/RIGHT'],
  ['SPACE (HOLD)', 'ATTACK - HOLD TO KEEP SWINGING'], ['F / RMB HOLD', 'GUARD - TIME IT TO PARRY'], ['E', 'PICK UP / OPEN DOOR / INTERACT'],
  ['1 - 4', 'CLASS SKILLS'], ['5 / R', 'ULTIMATE'], ['SHIFT + 1-4', 'SELECT WEAPON'],
  ['T / CLICK FOE', 'SELECT TARGET'], ['K', 'SKILLS + UPGRADES'], ['Q', 'DRINK HEALTH POTION'],
  ['TAB', 'INVENTORY'], ['I', 'CHARACTER & EQUIPMENT'], ['C', 'CRAFTING / DISMANTLE'], ['M / P', 'MAP / FORMATION'], ['L', 'LOOK (FIND SECRETS)'],
  ['O', 'OBJECTIVES'], ['G / B / V', 'FIGHT / QUICK CAST / NEXT WEAPON'], ['X / Z', 'ABOUT-FACE / RUN AWAY'],
  ['F11', 'FULLSCREEN'], ['ESC', 'PAUSE / CLOSE / RETURN TO CAMP'],
];

export function drawHelp(ctx, g) {
  const th = g.theme;
  panelBase(ctx, g, 'CONTROLS');
  CONTROLS.forEach(([k, v], i) => {
    drawText(ctx, k, P.x + 18, P.y + 24 + i * 13, th.highlight);
    drawText(ctx, v, P.x + 112, P.y + 24 + i * 13, th.text);
  });
  if (g.settings.hotkeys === 'weapons') drawText(ctx, 'HOTKEYS SWAPPED IN OPTIONS: 1-4 WEAPONS, SHIFT+1-4 SKILLS', P.x + 18, P.y + P.h - 16, '#ffd040');
}

// ------------------------------------------------------------------ full screens
export function drawTitle(ctx, g, t) {
  const th = g.theme;
  ctx.drawImage(g.sprites.title, 0, 0);
  g.ui.block(...FULL);
  const flick = 0.85 + Math.sin(t * 3) * 0.15;
  ctx.globalAlpha = flick;
  drawText(ctx, 'THE FOUR HORSEMEN', 320, 34, '#d8c8a0', { align: 'center', scale: 4, shadow: '#2a0402' });
  ctx.globalAlpha = 1;
  drawText(ctx, 'APOCALYPSE', 320, 72, '#d02a14', { align: 'center', scale: 5, shadow: '#000' });
  drawText(ctx, 'PHASE IV  ·  DUNGEONS OF THE END', 320, 114, '#a89a70', { align: 'center' });
  const hasSave = g.saves.hasSave();
  const items = [{ label: 'START GAME', run: () => g.openSelect() }];
  if (hasSave) items.push({ label: g.saves.isLegacy() ? 'CONTINUE (OLD SAVE)' : 'CONTINUE', run: () => g.loadGame() });
  items.push({ label: 'OPTIONS', run: () => g.openPanel('options') });
  drawMenuList(ctx, g, items, 240, 140, 160);
  // controls box
  const bx = 120, by = 362, bw = 400, bh = 108;
  ctx.globalAlpha = 0.85; g.ui.box(ctx, bx, by, bw, bh, th, '#080604'); ctx.globalAlpha = 1;
  drawText(ctx, 'CONTROLS', bx + bw / 2, by + 5, th.highlight, { align: 'center' });
  CONTROLS.slice(0, 14).forEach(([k, v], i) => {
    const cx = bx + 8 + (i % 2) * 196, cy = by + 17 + Math.floor(i / 2) * 12;
    drawText(ctx, k, cx, cy, th.bronzeLight);
    drawText(ctx, v.slice(0, 16), cx + 78, cy, th.text);
  });
  drawText(ctx, 'ENTER / CLICK TO BEGIN', 320, 222, Math.floor(t * 2) % 2 ? th.highlight : th.textDim, { align: 'center' });
}

export function drawGameOver(ctx, g) {
  const th = g.theme;
  g.ui.block(...FULL);
  ctx.globalAlpha = Math.min(0.85, g.sceneT * 0.8); ctx.fillStyle = '#100000'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  if (g.sceneT < 0.6) return;
  drawText(ctx, 'YOU HAVE FALLEN', 320, 110, '#d02a14', { align: 'center', scale: 4 });
  drawText(ctx, `SLAIN BY ${g.killedBy || 'THE DARK'}`, 320, 160, th.text, { align: 'center' });
  drawText(ctx, `LEVEL ${g.hero.level}   KILLS ${g.stats.kills}   XP ${g.stats.xpGained}`, 320, 176, th.textDim, { align: 'center' });
  const items = [];
  if (g.dungeon.def.generated) {
    // Phase 4 runs: your hero is kept; retry from the last autosave (floor start / boss checkpoint)
    drawText(ctx, 'YOUR HORSEMAN ENDURES. RETRY FROM THE LAST CHECKPOINT, OR RETREAT TO CAMP.', 320, 192, th.textDim, { align: 'center' });
    if (g.saves.hasSave()) items.push({ label: 'RETRY (LAST CHECKPOINT)', run: () => g.loadGame() });
    if (g.saves.hasSave()) items.push({ label: 'RETREAT TO CAMP', run: () => { g.loadGame(); if (g.scene === 'playing') g.director.returnToCamp(); } });
    items.push({ label: 'MAIN MENU', run: () => g.toTitle() });
  } else {
    items.push({ label: `RESTART AS ${g.hero.def.name}`, run: () => g.newGame() }, { label: 'CHOOSE HORSEMAN', run: () => g.openSelect() });
    if (g.saves.hasSave()) items.push({ label: 'LOAD LAST SAVE', run: () => g.loadGame() });
    items.push({ label: 'MAIN MENU', run: () => g.toTitle() });
  }
  drawMenuList(ctx, g, items, 220, 210, 200);
}

// Phase 4 dungeon completion summary (DungeonRewardManager output).
function drawRunComplete(ctx, g, t) {
  const th = g.theme, r = g.reward;
  g.ui.frame(ctx, 50, 24, 540, 432, th, { border: 6 });
  drawText(ctx, 'DUNGEON COMPLETE', 320, 38, Math.floor(t * 3) % 2 ? '#ffd040' : '#f0a020', { align: 'center', scale: 3 });
  drawText(ctx, `${r.title} - ${r.difficulty}${r.first ? '  (FIRST CLEAR)' : ''}`, 320, 66, r.diffColor, { align: 'center' });
  const rows = [['HORSEMAN', `${g.hero.def.name} LV ${g.hero.level}`], ['FLOORS', r.run.floors], ['ENEMIES SLAIN', r.run.kills], ['SECRETS FOUND', r.run.secrets], ['DAMAGE TAKEN', r.run.damage], ['TIME', `${Math.floor(r.run.time / 60)}M ${r.run.time % 60}S`]];
  rows.forEach(([k, v], i) => { drawText(ctx, k, 70, 86 + i * 11, th.textDim); drawText(ctx, String(v), 250, 86 + i * 11, th.highlight, { align: 'right' }); });
  let y = 86 + rows.length * 11 + 8;
  if (r.boss) {
    drawText(ctx, `${r.boss.name.toUpperCase()} DEFEATED`, 70, y, '#ff9a60'); y += 11;
    for (const it of r.boss.items.slice(0, 8)) { drawText(ctx, `${it.name}${it.qty > 1 ? ' X' + it.qty : ''}`.slice(0, 32), 74, y, RARITIES[it.rarity]?.color || th.text); y += 10; }
    for (const n of r.boss.learned || []) { drawText(ctx, `RECIPE: ${n}`.slice(0, 32), 74, y, '#7ac060'); y += 10; }
  }
  drawText(ctx, 'COMPLETION REWARD', 290, 86, th.bronzeLight);
  drawText(ctx, `+${r.xp} XP   +${r.gold} GOLD`, 290, 98, '#e0c060');
  let ry = 110;
  for (const it of r.items.slice(0, 10)) { drawText(ctx, `${it.name}${it.qty > 1 ? ' X' + it.qty : ''}`.slice(0, 44), 290, ry, RARITIES[it.rarity]?.color || th.text); ry += 10; }
  ry += 6;
  for (const n of r.notes) for (const l of wrapText(n, 46)) { drawText(ctx, l, 290, ry, n.startsWith('NEW') || n.startsWith('FIRST') ? '#7ac060' : th.text); ry += 10; }
  drawMenuList(ctx, g, [{ label: 'RETURN TO CAMP', run: () => g.toCamp() }, { label: 'MAIN MENU', run: () => { g.toCamp(); g.toTitle(); } }], 240, 404, 160);
}

export function drawCleared(ctx, g, t) {
  const th = g.theme;
  g.ui.block(...FULL);
  ctx.globalAlpha = Math.min(0.88, g.sceneT * 0.8); ctx.fillStyle = '#060402'; ctx.fillRect(...FULL); ctx.globalAlpha = 1;
  if (g.sceneT < 0.5) return;
  if (g.reward?.phase4) { drawRunComplete(ctx, g, t); return; }
  g.ui.frame(ctx, 70, 30, 500, 420, th, { border: 6 });
  drawText(ctx, 'DUNGEON CLEARED', 320, 46, Math.floor(t * 3) % 2 ? '#ffd040' : '#f0a020', { align: 'center', scale: 3 });
  drawText(ctx, 'THE FIRST SEAL IS BROKEN', 320, 74, th.text, { align: 'center' });
  const s = g.stats;
  const tm = Math.floor(s.playTime);
  const lines = [
    ['HORSEMAN', g.hero.def.name], ['LEVEL REACHED', g.hero.level], ['XP GAINED', s.xpGained], ['ENEMIES SLAIN', s.kills],
    ['SECRETS FOUND', `${s.secrets} / 1`], ['DAMAGE TAKEN', s.damageTaken], ['GOLD EARNED', s.goldEarned || 0],
    ['BEST FIND', RARITIES[s.bestRarity || 'common'].label], ['CRAFTED / SALVAGED', `${s.crafted || 0} / ${s.dismantled || 0}`], ['TIME', `${Math.floor(tm / 60)}M ${tm % 60}S`],
  ];
  lines.forEach(([k, v], i) => {
    drawText(ctx, k, 90, 94 + i * 12, th.textDim);
    drawText(ctx, String(v), 280, 94 + i * 12, th.highlight, { align: 'right' });
  });
  // completion reward
  let ry = 94 + lines.length * 12 + 10;
  if (g.reward) {
    drawText(ctx, 'REWARD OF THE SEAL', 90, ry, th.bronzeLight); ry += 11;
    drawText(ctx, `+${g.reward.xp} XP   +${g.reward.gold} GOLD`, 90, ry, '#e0c060'); ry += 10;
    for (const it of g.reward.items.slice(0, 6)) {
      for (const l of wrapText(`${it.name}${it.qty > 1 ? ' X' + it.qty : ''}`, 33).slice(0, 2)) { drawText(ctx, l, 90, ry, RARITIES[it.rarity].color); ry += 10; }
    }
  }
  drawText(ctx, 'ITEMS COLLECTED', 300, 94, th.bronzeLight);
  const agg = new Map();
  for (const it of s.itemsCollected) { const k = it.name + '|' + it.rarity; agg.set(k, { ...it, qty: (agg.get(k)?.qty || 0) + it.qty }); }
  [...agg.values()].slice(0, 22).forEach((it, i) => {
    drawText(ctx, `${it.name.slice(0, 40)}${it.qty > 1 ? ' X' + it.qty : ''}`, 300, 106 + i * 10, RARITIES[it.rarity].color);
  });
  if (!agg.size) drawText(ctx, 'NONE', 300, 106, th.textDim);
  drawMenuList(ctx, g, [{ label: 'TO THE CAMP (PHASE IV)', run: () => g.toCamp() }, { label: 'PLAY AGAIN (NEW HERO)', run: () => g.newGame() }, { label: 'CHOOSE HORSEMAN', run: () => g.openSelect() }, { label: 'MAIN MENU', run: () => g.toTitle() }], 220, 352, 200);
}
