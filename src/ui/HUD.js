import { LAYOUT, DIRS, SCREEN } from '../data/config.js';
import { HORSEMEN } from '../data/characters.js';
import { RARITIES } from '../data/items.js';
import { drawText, wrapText } from '../render/PixelFont.js';
import { TILE } from '../systems/DungeonManager.js';

// The classic 1990s screen on a 16:9 frame: top strip, three party slots per side, framed viewport,
// minimap, round utility buttons, skill bar, event log and weapon panel. Everything reads live game
// state. (The floating COMMANDS popup is gone: every command has its own key, see Panels CONTROLS.)
const WEAPON_SLOT_NAMES = ['SWORD', 'AXE', 'XBOW', 'DAGGER'];
const WEAPON_ICON = ['sword', 'axe', 'crossbow', 'dagger'];

export function drawBackground(ctx, g) {
  ctx.fillStyle = g.ui.stonePattern(ctx, g.theme);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
}

export function drawTopStrip(ctx, g) {
  const th = g.theme, ui = g.ui, L = LAYOUT.top;
  ui.frame(ctx, L.x, L.y, L.w, L.h, th, { border: 2, panel: th.panel });
  const btns = [
    ['pause', 'PAUSE (ESC)', () => g.openPanel('pause')],
    ['save', 'SAVE GAME', () => g.saveGame()],
    ['sound', g.settings.muted ? 'UNMUTE' : 'MUTE', () => g.toggleMute()],
    ['help', 'CONTROLS', () => g.openPanel('help')],
  ];
  btns.forEach(([glyph, label, fn], i) => {
    const x = 4 + i * 16, y = 2;
    const hov = ui.button(x, y, 14, 14, fn);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 16, 16);
    ctx.fillStyle = hov ? th.bronze : th.stoneMid; ctx.fillRect(x, y, 14, 14);
    ctx.fillStyle = hov ? th.bronzeLight : th.stoneLight; ctx.fillRect(x, y, 14, 1); ctx.fillRect(x, y, 1, 14);
    ctx.drawImage(g.sprites.ui[hov ? glyph + '_hi' : glyph], x + 1, y + 1);
    if (glyph === 'sound' && g.settings.muted) { ctx.fillStyle = '#c02010'; ctx.fillRect(x + 2, y + 6, 10, 2); }
    if (hov) ui.tooltip = { text: label, x: x + 7, y: 22 };
  });
  const room = g.player ? g.dungeon.roomAt(g.player.x, g.player.y) : null;
  const lay = g.dungeon.def;
  const where = lay.generated ? `${lay.name.replace('THE ', '')} F${lay.floor + 1}/${lay.floors}` : lay.name;
  drawText(ctx, 'THE FOUR HORSEMEN', 74, 6, th.highlight);
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(180, 4, 1, 10);
  drawText(ctx, (where + (room ? ' · ' + room.name : '')).slice(0, 78), 188, 6, th.bronzeLight);
  if (g.player) {
    const t = Math.floor(g.stats.playTime);
    const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    drawText(ctx, `${g.gold}G`, 704, 6, '#e0c060', { align: 'right' });
    drawText(ctx, `KILLS ${g.stats.kills}`, 778, 6, th.text, { align: 'right' });
    drawText(ctx, `${mm}:${ss}`, 836, 6, th.textDim, { align: 'right' });
    // compass
    const x = SCREEN.w - 110;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, 2, 108, 14);
    ctx.fillStyle = th.panelLight; ctx.fillRect(x, 3, 106, 12);
    drawText(ctx, `▲ ${DIRS[g.player.dir].name}`, x + 53, 6, th.highlight, { align: 'center' });
  }
}

// ------------------------------------------------------------------ Phase 4: boss bar + objective tracker
// Drawn inside the first-person viewport (viewport coordinates).
export function drawBossBar(vctx, g, t) {
  const e = g.bossCtl.boss;
  if (!e || !e.alive || !e.bossState?.started || g.combat.active) return;
  // centred across the top of the viewport
  const w = 360, W = LAYOUT.view.w, x = Math.round((W - w) / 2);
  vctx.globalAlpha = 0.8; vctx.fillStyle = '#000'; vctx.fillRect(x - 4, 2, w + 8, 34); vctx.globalAlpha = 1;
  drawText(vctx, `${e.name.toUpperCase()} - ${g.bossCtl.phaseName(e)}`.slice(0, 44), W / 2, 5, '#ff9a60', { align: 'center' });
  vctx.fillStyle = '#3a0a06'; vctx.fillRect(x, 15, w, 6);
  vctx.fillStyle = e.invulnerable ? '#a8d8f0' : '#c02a14'; vctx.fillRect(x, 15, Math.round(w * Math.max(0, e.hp) / e.maxHp), 6);
  const tags = [];
  if (e.invulnerable) tags.push(['PHASE SHIFT - IMMUNE', '#a8d8f0']);
  if (g.status.has(e, 'barrier')) tags.push(['BARRIER', '#a8d8f0']);
  if (g.status.has(e, 'iron_skin')) tags.push(['IRON SKIN', '#a0a8b0']);
  if (g.status.has(e, 'exposed')) tags.push([Math.floor(t * 6) % 2 ? 'VULNERABLE!' : 'VULNERABLE', '#ffd040']);
  if (e.castName) tags.push([`${e.castName.toUpperCase()}...`, '#ff6040']);
  let tx = W / 2 - tags.reduce((s, [s2]) => s + s2.length * 6 + 10, 0) / 2;
  for (const [s, c] of tags) { drawText(vctx, s, tx, 25, c); tx += s.length * 6 + 10; }
}

// Phase 6: the player's active buffs / debuffs with remaining time (bottom-left of the viewport).
// Buffs have a green edge, debuffs a red one; the glyph colour is the status colour.
export function drawPlayerStatus(vctx, g, t) {
  const list = g.status.list('player');
  if (!list.length) return;
  const V = LAYOUT.view, y = V.h - 50;
  list.slice(0, 6).forEach((s, i) => {
    const x = 4 + i * 38, bad = !!s.def?.debuff;
    const blink = s.left < 2 && s.left !== Infinity && Math.floor(t * 6) % 2;
    vctx.globalAlpha = 0.75; vctx.fillStyle = '#000'; vctx.fillRect(x, y, 36, 12); vctx.globalAlpha = 1;
    vctx.fillStyle = bad ? '#c03020' : '#40a040'; vctx.fillRect(x, y + 11, 36, 1);
    drawText(vctx, (s.def?.name || s.id).slice(0, 3), x + 2, y + 3, blink ? '#ffffff' : s.def?.color || '#fff');
    if (Number.isFinite(s.left) && s.left < 999) drawText(vctx, `${Math.ceil(s.left)}`, x + 34, y + 3, '#c8bc98', { align: 'right' });
    if (s.stacks > 1) drawText(vctx, `x${s.stacks}`, x + 34, y - 7, '#ffd040', { align: 'right' });
  });
}

// Top-left of the viewport (notifications use the top-right). Returns its height so the
// loot toasts can stack below it.
export function drawObjectiveTracker(vctx, g) {
  if (!g.settings.objectives || g.combat.active || !g.inGeneratedRun || g.bossCtl.active) return 0;
  const cur = g.director.currentObjective();
  const opt = g.director.objectives().filter((o) => o.optional && !o.done);
  const lines = [[cur ? `> ${cur.label}` : '> Floor objectives complete', cur ? '#ffe58a' : '#7ac060']];
  if (opt.length) lines.push([`+ ${opt.length} optional [O]`, '#a89a70']);
  const wrapped = [];
  for (const [s, c] of lines) for (const l of wrapText(s, 44).slice(0, 2)) wrapped.push([l, c]);
  const bw = Math.max(...wrapped.map(([s]) => s.length)) * 6 + 10, bh = wrapped.length * 9 + 6;
  vctx.globalAlpha = 0.6; vctx.fillStyle = '#000'; vctx.fillRect(4, 4, bw, bh); vctx.globalAlpha = 1;
  wrapped.forEach(([s, c], i) => drawText(vctx, s, 9, 7 + i * 9, c));
  return bh + 4;
}

// ------------------------------------------------------------------ party portraits
export function drawParty(ctx, g, t) {
  for (let i = 0; i < 6; i++) {
    const col = i < 3 ? LAYOUT.leftPanel : LAYOUT.rightPanel;
    const x = col.x, y = col.y + (i % 3) * (col.slotH + col.gap);
    drawPartySlot(ctx, g, g.formation[i], x, y, col.w, col.slotH, i, t);
  }
}

function drawPartySlot(ctx, g, charId, x, y, w, h, index, t) {
  const th = g.theme, ui = g.ui;
  const def = charId ? HORSEMEN[charId] : null;
  const isHero = def && charId === g.hero.classId;
  ui.frame(ctx, x, y, w, h, th, { border: 3 });
  ui.button(x, y, w, h, () => (isHero ? g.openPanel('character') : g.openPanel('formation')));
  // portrait well
  ctx.fillStyle = '#000'; ctx.fillRect(x + 4, y + 4, 46, 54);
  const P = g.sprites.portraits;
  const img = !def ? P.empty : isHero ? P[def.portrait] : P[charId + 'Sealed'];
  ctx.drawImage(img, x + 5, y + 5);
  if (isHero) {
    const hero = g.hero;
    const fb = hero.feedback;
    if (fb.t > 0) {
      ctx.globalAlpha = Math.min(0.6, fb.t * 1.4);
      ctx.fillStyle = { damage: '#ff0000', heal: '#30ff60', level: '#ffd040', cast: '#4080ff' }[fb.type] || '#fff';
      ctx.fillRect(x + 5, y + 5, 44, 52);
      ctx.globalAlpha = 1;
    }
    if (!hero.alive) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#300000'; ctx.fillRect(x + 5, y + 5, 44, 52); ctx.globalAlpha = 1;
      drawText(ctx, 'DEAD', x + 27, y + 27, '#ff3020', { align: 'center' });
    }
    ui.bar(ctx, x + 53, y + 5, 5, 52, hero.hp / hero.maxHp, hero.hp / hero.maxHp < 0.3 ? '#ff3a1a' : '#b01c10', '#200604', true);
    const res = g.resource;
    ui.bar(ctx, x + 61, y + 5, 5, 52, res.value / res.max, res.def.color, res.def.dark, true);
    drawText(ctx, `LV${hero.level}`, x + 70, y + 6, th.highlight, {});
    drawText(ctx, 'HP', x + 70, y + 16, '#e05040');
    drawText(ctx, `${Math.ceil(hero.hp)}`, x + 112, y + 16, th.text, { align: 'right' });
    drawText(ctx, res.def.short.slice(0, 3), x + 70, y + 26, res.def.color);
    drawText(ctx, `${Math.floor(res.value)}`, x + 112, y + 26, res.pulse > 0 ? '#ffffff' : th.text, { align: 'right' });
    const lowHp = hero.hp / hero.maxHp < 0.3;
    const buffs = g.status.list('player');
    const status = !hero.alive ? ['DEAD', '#ff3020'] : buffs.length ? [buffs[0].def.name.split(' ')[0].slice(0, 6), buffs[0].def.color]
      : g.player.guarding ? ['GUARD', '#9ad0ff'] : lowHp ? ['HURT', Math.floor(t * 4) % 2 ? '#ff3020' : '#a02010'] : g.combat.active ? ['FIGHT', '#ff9040'] : ['OK', '#7ac060'];
    drawText(ctx, status[0], x + 70, y + 38, status[1]);
    if (hero.skillPoints > 0) drawText(ctx, `SP${hero.skillPoints}`, x + 112, y + 48, Math.floor(t * 2) % 2 ? '#ffd040' : '#a08020', { align: 'right' });
    // status-effect pips (future poison etc.)
    if (fb.type === 'level' && fb.t > 0) drawText(ctx, 'UP!', x + 112, y + 6, '#ffd040', { align: 'right' });
    drawText(ctx, def.name, x + 5, y + 61, th.highlight);
    drawText(ctx, def.role, x + 5, y + 70, th.textDim);
    ui.bar(ctx, x + 5, y + 80, 108, 2, hero.xp / hero.xpNeeded, '#d0a030', '#1a1408');
    // numbered weapon indicators 1-4
    for (let s = 0; s < 4; s++) {
      const bx = x + 5 + s * 27, by = y + 85;
      const uid = g.equipment.weaponSlots[s];
      const active = g.equipment.active === s && uid;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, 26, 16);
      ctx.fillStyle = active ? th.bronze : th.panelLight; ctx.fillRect(bx, by, 24, 14);
      drawText(ctx, String(s + 1), bx + 2, by + 4, active ? '#1a1206' : th.textDim, { shadow: false });
      if (uid) {
        const item = g.inventory.get(uid);
        ctx.drawImage(g.sprites.icons[WEAPON_ICON[s]], bx + 9, by - 1);
        if (item && item.rarity !== 'common') { ctx.fillStyle = RARITIES[item.rarity].color; ctx.fillRect(bx + 1, by + 12, 22, 1); }
      }
    }
    // active status effects (3-letter chip + a drain bar for the time left) and the weapon in hand
    if (h >= 130) {
      const sy = y + 104;
      if (!buffs.length) drawText(ctx, 'NO EFFECTS', x + 5, sy + 3, '#5a5444');
      buffs.slice(0, 4).forEach((s, k) => {
        const cx = x + 5 + k * 27, bad = !!s.def?.debuff;
        ctx.fillStyle = '#000'; ctx.fillRect(cx - 1, sy - 1, 26, 14);
        ctx.fillStyle = '#16120a'; ctx.fillRect(cx, sy, 24, 12);
        ctx.fillStyle = bad ? '#c03020' : '#40a040'; ctx.fillRect(cx, sy, 24, 1);
        const blink = s.left < 2 && Number.isFinite(s.left) && Math.floor(t * 6) % 2;
        drawText(ctx, (s.def?.name || s.id).slice(0, 3), cx + 3, sy + 3, blink ? '#ffffff' : s.def?.color || '#fff', { shadow: false });
        if (Number.isFinite(s.left) && s.dur) { ctx.fillStyle = s.def?.color || '#fff'; ctx.fillRect(cx, sy + 11, Math.max(1, Math.round(24 * Math.min(1, s.left / s.dur))), 1); }
      });
      if (buffs.length > 4) drawText(ctx, `+${buffs.length - 4}`, x + 112, sy + 3, th.textDim, { align: 'right' });
      const cur = g.weapons.current;
      drawText(ctx, cur.name.toUpperCase().slice(0, 18), x + 5, y + 120, (RARITIES[cur.rarity] || RARITIES.common).color);
    }
  } else {
    ui.bar(ctx, x + 53, y + 5, 5, 52, 0, '#444', '#141414', true);
    ui.bar(ctx, x + 61, y + 5, 5, 52, 0, '#444', '#141414', true);
    if (def) {
      drawText(ctx, 'RESTS', x + 70, y + 6, '#a04030');
      drawText(ctx, 'NOT IN', x + 70, y + 20, th.textDim);
      drawText(ctx, 'THIS', x + 70, y + 29, th.textDim);
      drawText(ctx, 'RUN', x + 70, y + 38, th.textDim);
      drawText(ctx, def.name, x + 5, y + 61, th.textDim);
      drawText(ctx, def.title, x + 5, y + 70, '#5a5444');
    } else {
      drawText(ctx, 'EMPTY', x + 70, y + 6, th.textDim);
      drawText(ctx, 'SLOT ' + (index + 1), x + 5, y + 61, th.textDim);
      drawText(ctx, 'NO MEMBER', x + 5, y + 70, '#5a5444');
    }
    for (let s = 0; s < 4; s++) { ctx.fillStyle = '#000'; ctx.fillRect(x + 4 + s * 27, y + 84, 26, 16); ctx.fillStyle = '#16140e'; ctx.fillRect(x + 5 + s * 27, y + 85, 24, 14); }
    if (h >= 130 && def) drawText(ctx, 'SEALED', x + w / 2, y + 112, '#7a4030', { align: 'center' });
  }
}

// ------------------------------------------------------------------ viewport frame
export function drawViewFrame(ctx, g) {
  const th = g.theme, F = LAYOUT.viewFrame, V = LAYOUT.view;
  g.ui.frame(ctx, F.x, F.y, F.w, F.h, th, { fill: false, border: 6 });
  ctx.fillStyle = '#000'; ctx.fillRect(V.x - 2, V.y - 2, V.w + 4, V.h + 4);
  ctx.fillStyle = th.bronzeDark; ctx.fillRect(V.x - 1, V.y - 1, V.w + 2, V.h + 2);
}

export function drawViewFrameOrnaments(ctx, g) {
  const th = g.theme, F = LAYOUT.viewFrame;
  for (let i = 1; i < 9; i++) {
    const x = F.x + Math.round((F.w * i) / 9);
    for (const y of [F.y + 1, F.y + F.h - 5]) {
      ctx.fillStyle = th.bronzeDark; ctx.fillRect(x - 2, y + 1, 5, 2); ctx.fillRect(x - 1, y, 3, 4);
      ctx.fillStyle = th.bronzeLight; ctx.fillRect(x, y + 1, 1, 2);
    }
  }
  // carved skull keystone
  const cx = F.x + F.w / 2, y = F.y - 1;
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 7, y, 14, 9);
  ctx.fillStyle = th.bronze; ctx.fillRect(cx - 6, y + 1, 12, 7);
  ctx.fillStyle = th.bronzeLight; ctx.fillRect(cx - 6, y + 1, 12, 1);
  ctx.fillStyle = '#1a1206'; ctx.fillRect(cx - 4, y + 3, 3, 2); ctx.fillRect(cx + 1, y + 3, 3, 2); ctx.fillRect(cx - 1, y + 6, 2, 1);
}

// ------------------------------------------------------------------ minimap
export function drawMinimap(ctx, g) {
  const th = g.theme, M = LAYOUT.minimap;
  g.ui.frame(ctx, M.x, M.y, M.w, M.h, th, { border: 4, panel: '#3a2e1c' });
  g.ui.button(M.x, M.y, M.w, M.h, () => g.openPanel('map'));
  // large generated floors: a window centred on the player (26 x 25 cells)
  const cols = 26, rows = 25, dm = g.dungeon;
  const wx = dm.w <= cols ? 0 : Math.max(0, Math.min(dm.w - cols, g.player.x - (cols >> 1)));
  const wy = dm.h <= rows ? 0 : Math.max(0, Math.min(dm.h - rows, g.player.y - (rows >> 1)));
  ctx.save(); ctx.beginPath(); ctx.rect(M.x + 6, M.y + 10, cols * 4 + 2, rows * 4 + 2); ctx.clip();
  drawMap(ctx, g, M.x + 7 - wx * 4, M.y + 11 - wy * 4, 4, false);
  ctx.restore();
  drawText(ctx, 'N', M.x + M.w / 2, M.y + 3, th.highlight, { align: 'center' });
}

// Shared by minimap and full map panel.
export function drawMap(ctx, g, ox, oy, cs, full) {
  const dm = g.dungeon, p = g.player;
  ctx.fillStyle = '#2a2016'; ctx.fillRect(ox - 1, oy - 1, dm.w * cs + 2, dm.h * cs + 2);
  for (let y = 0; y < dm.h; y++) for (let x = 0; x < dm.w; x++) {
    if (!dm.isExplored(x, y)) continue;
    const t = dm.tile(x, y);
    const kind = dm.wallKind(x, y);
    let col;
    if (kind === 'wall' || kind === 'torch' || kind === 'secret') col = '#5a4628';
    else if (kind === 'door') col = '#a06a2a';
    else if (kind === 'gate' || kind === 'portcullis') col = '#b02a14';
    else if (kind === 'barrier' || kind === 'sigil' || kind === 'roots' || kind === 'soulseal') col = '#d0a020';
    else if (kind && (kind.startsWith('rune') || kind.startsWith('lever'))) col = '#60c0e0';
    else if (kind === 'switch' || kind === 'switchOn') col = dm.featureAt(x, y)?.spotted || dm.featureAt(x, y)?.found ? '#f0d070' : '#5a4628';
    else if (t === TILE.PIT) col = '#100c08';
    else if (t === TILE.DOOR || t === TILE.GATE) col = '#d8bc84';
    else col = '#c8b086';
    ctx.fillStyle = col;
    ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs);
    if (!kind && cs >= 4 && (x + y) % 2 === 0) { ctx.fillStyle = '#bca478'; ctx.fillRect(ox + x * cs, oy + y * cs, 1, 1); }
    if (kind === 'torch' && cs >= 8) { ctx.fillStyle = '#ff9030'; ctx.fillRect(ox + x * cs + cs / 2 - 1, oy + y * cs + cs / 2 - 1, 2, 2); }
    const f = dm.featureAt(x, y);
    if (f && !kind) {
      const fc = { stairs: '#ffffff', exit: '#80d8ff', font: '#60ff80', shrine: '#80c030', tablet: '#e8d8b0', scroll: '#c0a050', spikes: '#8a8a8a', blight: '#4a8a12', spectral: '#60d8ff', collapse: '#6a4a2a', plate: f.pressed ? '#3a3020' : '#8a7e66' }[f.kind];
      if (fc) { ctx.fillStyle = fc; ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, Math.max(1, cs - 2), Math.max(1, cs - 2)); }
    }
  }
  for (const c of dm.chests.values()) if (dm.isExplored(c.x, c.y)) { ctx.fillStyle = c.opened ? '#7a6030' : '#f0c040'; ctx.fillRect(ox + c.x * cs + 1, oy + c.y * cs + 1, cs - 2, cs - 2); }
  for (const it of g.loot.floor) if (dm.isExplored(it.x, it.y)) { ctx.fillStyle = RARITIES[it.item.rarity].color; ctx.fillRect(ox + it.x * cs + cs / 2 - 1, oy + it.y * cs + cs / 2 - 1, 2, 2); }
  for (const d of g.dangerTiles || []) { ctx.fillStyle = Math.floor(g.realTime * 8) % 2 ? d.color : '#ffffff'; ctx.fillRect(ox + d.x * cs, oy + d.y * cs, cs, cs); }
  for (const e of g.enemies) {
    if (!e.alive || !dm.isExplored(e.x, e.y)) continue;
    if (!dm.hasLOS(p.x, p.y, e.x, e.y)) continue; // only enemies you can currently see
    ctx.fillStyle = e.boss ? '#ff00ff' : e.def.heavy ? '#ff2a10' : '#e05030';
    ctx.fillRect(ox + e.x * cs + 1, oy + e.y * cs + 1, Math.max(2, cs - 2), Math.max(2, cs - 2));
  }
  // player arrow
  const px = ox + p.x * cs, py = oy + p.y * cs;
  ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, cs + 2, cs + 2);
  ctx.fillStyle = '#ff3a1a'; ctx.fillRect(px, py, cs, cs);
  const d = DIRS[p.dir];
  ctx.fillStyle = '#fff0b0';
  const ax = px + cs / 2 - 0.5 + d.dx * (cs / 2), ay = py + cs / 2 - 0.5 + d.dy * (cs / 2);
  ctx.fillRect(Math.round(ax - (cs >= 8 ? 1 : 0)), Math.round(ay - (cs >= 8 ? 1 : 0)), cs >= 8 ? 3 : 1, cs >= 8 ? 3 : 1);
  if (cs < 8) ctx.fillRect(Math.round(px + cs / 2 - 0.5 + d.dx * (cs / 2 + 1)), Math.round(py + cs / 2 - 0.5 + d.dy * (cs / 2 + 1)), 1, 1);
}

// ------------------------------------------------------------------ utility buttons
export function drawUtility(ctx, g) {
  const th = g.theme, ui = g.ui, S = g.sprites.ui;
  const U = LAYOUT.utilLeft;
  ui.frame(ctx, U.x, U.y, U.w, U.h, th, { border: 2, fill: false, studs: false });
  const cx = U.x + U.w / 2;
  ui.roundButton(ctx, cx, U.y + 19, 14, S.bag, S.bag_hi, th, () => g.togglePanel('inventory'), 'INVENTORY [TAB]');
  ui.roundButton(ctx, cx, U.y + 58, 14, S.person, S.person_hi, th, () => g.togglePanel('character'), 'CHARACTER [I]');
  ui.roundButton(ctx, cx, U.y + 97, 14, S.formation, S.formation_hi, th, () => g.togglePanel('formation'), 'FORMATION [P]');
  const R = LAYOUT.utilRight;
  ui.frame(ctx, R.x, R.y, R.w, R.h, th, { border: 3, fill: false });
  const btns = [
    [S.skills, S.skills_hi, () => g.togglePanel('skills'), `SKILLS [K]${g.hero.skillPoints ? ' - ' + g.hero.skillPoints + ' POINTS' : ''}`],
    [S.anvil, S.anvil_hi, () => g.togglePanel('crafting'), 'CRAFTING [C]'],
    [S.map, S.map_hi, () => g.togglePanel('map'), 'MAP [M]'],
    [S.potion, S.potion_hi, () => g.usePotion(), `POTION [Q] x${g.inventory.countOf('health_potion')}`],
    [S.gear, S.gear_hi, () => g.openPanel('options'), 'OPTIONS'],
    [S.pause, S.pause_hi, () => g.openPanel('pause'), 'PAUSE [ESC]'],
  ];
  btns.forEach(([a, b, fn, label], i) => ui.roundButton(ctx, R.x + 14 + i * 25, R.y + R.h / 2, 11, a, b, th, fn, label));
  const pots = g.inventory.countOf('health_potion');
  drawText(ctx, String(pots), R.x + 96, R.y + R.h / 2 + 7, pots ? '#ff8a70' : th.textDim);
  if (g.hero.skillPoints) { ctx.fillStyle = Math.floor(g.realTime * 3) % 2 ? '#ffd040' : '#a08020'; ctx.fillRect(R.x + 21, R.y + 14, 4, 4); }
}

// ------------------------------------------------------------------ message log
export function drawLog(ctx, g) {
  const th = g.theme, L = LAYOUT.log, ui = g.ui;
  ui.frame(ctx, L.x, L.y, L.w, L.h, th, { border: 4, panel: '#0e0c08' });
  const maxChars = Math.floor((L.w - 28) / 6);
  const lines = [];
  for (const e of g.logEntries) for (const ln of wrapText(e.text, maxChars)) lines.push({ text: ln, color: e.color });
  const visible = Math.floor((L.h - 12) / 9);
  g.logScrollMax = Math.max(0, lines.length - visible);
  g.logScroll = Math.min(g.logScroll, g.logScrollMax);
  const start = Math.max(0, lines.length - visible - g.logScroll);
  const slice = lines.slice(start, start + visible);
  slice.forEach((ln, i) => {
    const age = start + i >= lines.length - 2 && g.logScroll === 0;
    drawText(ctx, ln.text, L.x + 8, L.y + 7 + i * 9, age ? ln.color : dim(ln.color), { shadow: '#000' });
  });
  // scroll controls
  const bx = L.x + L.w - 16;
  const up = ui.button(bx, L.y + 6, 10, 12, () => { g.logScroll = Math.min(g.logScrollMax, g.logScroll + 3); });
  const dn = ui.button(bx, L.y + L.h - 18, 10, 12, () => { g.logScroll = Math.max(0, g.logScroll - 3); });
  for (const [yy, hov, glyph] of [[L.y + 6, up, '▲'], [L.y + L.h - 18, dn, '▼']]) {
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, yy - 1, 12, 14);
    ctx.fillStyle = hov ? th.bronze : th.stoneMid; ctx.fillRect(bx, yy, 10, 12);
    drawText(ctx, glyph, bx + 2, yy + 3, hov ? '#1a1206' : th.bronzeLight, { shadow: false });
  }
  ctx.fillStyle = th.stoneDeep; ctx.fillRect(bx + 4, L.y + 20, 2, L.h - 40);
  if (g.logScrollMax > 0) {
    const k = 1 - g.logScroll / g.logScrollMax;
    ctx.fillStyle = th.bronze; ctx.fillRect(bx + 3, L.y + 20 + Math.round(k * (L.h - 46)), 4, 6);
  }
}
function dim(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

// ------------------------------------------------------------------ weapon panel
export function drawWeaponHud(ctx, g) {
  const th = g.theme, W = LAYOUT.weaponHud, ui = g.ui;
  ui.frame(ctx, W.x, W.y, W.w, W.h, th, { border: 3 });
  ui.button(W.x, W.y, W.w, W.h, () => g.openPanel('inventory'));
  const cur = g.weapons.current;
  ctx.fillStyle = '#000'; ctx.fillRect(W.x + 5, W.y + 5, 36, 36);
  ctx.fillStyle = '#16120a'; ctx.fillRect(W.x + 6, W.y + 6, 34, 34);
  const rar = RARITIES[cur.rarity];
  if (cur.item && rar.glow > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = rar.color; ctx.fillRect(W.x + 6, W.y + 6, 34, 34); ctx.globalAlpha = 1; }
  const icon = cur.item ? g.sprites.icons[cur.item.def.icon] : null;
  if (icon) ctx.drawImage(icon, W.x + 7, W.y + 7, 32, 32);
  else drawText(ctx, 'FIST', W.x + 23, W.y + 20, th.textDim, { align: 'center' });
  drawText(ctx, cur.def.name, W.x + 46, W.y + 6, rar.color);
  drawText(ctx, `${cur.dmgMin}-${cur.dmgMax} DMG`, W.x + 46, W.y + 15, th.text);
  drawText(ctx, cur.def.speedLabel.split(' ')[0], W.x + 148, W.y + 15, th.textDim, { align: 'right' });
  const left = g.weapons.cooldownLeft;
  const ready = left <= 0 && !g.weapons.anim;
  ui.bar(ctx, W.x + 46, W.y + 26, 102, 4, ready ? 1 : 1 - left / cur.cooldown, ready ? '#7ac060' : '#c08030', '#140e06');
  drawText(ctx, ready ? 'READY' : cur.def.kind === 'ranged' ? 'RELOADING' : 'RECOVER', W.x + 46, W.y + 33, ready ? '#7ac060' : '#c08030');
  for (let s = 0; s < 4; s++) {
    const has = !!g.equipment.weaponSlots[s];
    const act = g.equipment.active === s && has;
    const bx = W.x + 6 + s * 9;
    drawText(ctx, String(s + 1), bx, W.y + 44, act ? th.highlight : has ? th.text : '#4a4434', { shadow: false });
  }
  drawText(ctx, WEAPON_SLOT_NAMES[g.equipment.active] ? `SLOT ${g.equipment.active + 1}` : '', W.x + 148, W.y + 44, th.textDim, { align: 'right' });
}

// ------------------------------------------------------------------ in-view prompt
export function drawPrompt(ctx, g, text, t) {
  if (!text) return;
  const w = text.length * 6 + 10;
  const x = Math.round(LAYOUT.view.w / 2 - w / 2), y = LAYOUT.view.h - 22;
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, 13); ctx.globalAlpha = 1;
  ctx.fillStyle = g.theme.bronze; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 12, w, 1);
  drawText(ctx, text, x + 5, y + 3, Math.floor(t * 2) % 2 ? g.theme.highlight : g.theme.bronzeLight, { shadow: false });
}
