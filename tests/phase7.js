// UI redesign + continuous attack suite: http://localhost:5173/?test7  (results in window.__p7Results).
// 16:9 layout + output scaling maths, COMMANDS popup removal (and every command still reachable by key),
// hold-SPACE continuous attacks (repeat, release, cooldown, single damage per swing, frame-rate
// independence, stun / death / panel stops, target death) and a layout overlap check.
import { SCREEN, CLASSIC, LAYOUT, TUNING, KEYMAP, VIEW } from '../src/data/config.js';
import { Display } from '../src/core/Display.js';
import * as HUD from '../src/ui/HUD.js';
import { CONTROLS } from '../src/ui/Panels.js';
import { runPhase4 } from './phase4.js';

export async function runPhase7(g) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const check = (name, pass, detail = '') => { results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const keepSettings = JSON.parse(JSON.stringify(g.settings));

  await runPhase4(g, { botOnly: true });
  const bot = window.__bot;
  const real = bot.realUpdate;
  g.update = () => {};
  const step = (sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) { g.ui.beginFrame(); real(dt); } };
  const hold = (on) => { if (on) g.input.heldKeys.add('Space'); else g.input.heldKeys.delete('Space'); };
  const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // hero facing an open cell; returns that cell
  const faceOpen = () => {
    for (let d = 0; d < 4; d++) {
      const x = g.player.x + DIRV[d][0], y = g.player.y + DIRV[d][1];
      if (g.dungeon.isWalkable(x, y) && !g.ai.enemyAt(x, y)) { bot.face(d); return { x, y }; }
    }
    return null;
  };
  // a passive training dummy in front of the hero (AI paused so only the player acts)
  const dummyAhead = (hp = 1e6) => {
    const c = faceOpen();
    const e = g.enemies.find((q) => q.alive && !q.boss);
    for (const q of g.enemies) if (q !== e) q.alive = false;
    Object.assign(e, { x: c.x, y: c.y, rx: c.x, ry: c.y, hp, maxHp: hp, state: 'idle', phase: null });
    e.def = { ...e.def, evade: 0, block: 0 };
    return e;
  };
  // records every swing that actually starts (time + the attack object)
  const swings = [];
  const origBegin = g.weapons.begin.bind(g.weapons);
  g.weapons.begin = (attack, onImpact) => { swings.push({ t: g.time, attack }); return origBegin(attack, onImpact); };
  const origAi = g.ai.update.bind(g.ai);
  const origMult = g.weapons.cooldownMult;
  const freshArena = (cls = 'war') => {
    g.newGame(cls); g.scene = 'playing'; g.panel = null;
    g.ai.update = () => {}; g.weapons.cooldownMult = origMult;
    g.hero.hp = g.hero.maxHp; // AI is paused: nothing hurts the hero
    swings.length = 0; hold(false); g.input.pressed = [];
  };

  try {
    // ============================================================ 1-3. 16:9, resolutions, no distortion
    check('Logical frame is native 16:9 (960x540) and the game draws on it with Canvas 2D', SCREEN.w * 9 === SCREEN.h * 16 && g.screen.width === 960 && g.screen.height === 540 && g.ctx instanceof CanvasRenderingContext2D, `${g.screen.width}x${g.screen.height}`);
    const src = document.createElement('canvas'); src.width = SCREEN.w; src.height = SCREEN.h;
    const sx = src.getContext('2d');
    for (let y = 0; y < SCREEN.h; y++) for (let x = 0; x < SCREEN.w; x += 1) if ((x + y) % 2 === 0) { sx.fillStyle = '#ff0000'; sx.fillRect(x, y, 1, 1); } else { sx.fillStyle = '#0000ff'; sx.fillRect(x, y, 1, 1); }
    const fit = (w, h, scaling = 'sharp') => {
      const c = document.createElement('canvas');
      const d = new Display(c, src, { resolution: 'auto', scaling });
      d.target = () => ({ s: Math.min(w / SCREEN.w, h / SCREEN.h), dpr: 1 });
      d.layout(); d.present();
      return { d, c };
    };
    const sizes = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
    const outs = sizes.map(([w, h]) => { const { d } = fit(w, h); return `${w}x${h}->${d.out.w}x${d.out.h} ${d.out.mode}`; });
    const r720 = fit(1280, 720), r1080 = fit(1920, 1080), r4k = fit(3840, 2160);
    check('1280x720 and 1920x1080 fill the output exactly at 16:9 (1080p = integer 2x)', r720.d.out.w === 1280 && r720.d.out.h === 720 && r1080.d.out.w === 1920 && r1080.d.out.h === 1080 && r1080.d.out.mode === 'integer' && r1080.d.out.k === 2, outs.join(' | '));
    // integer output: every logical pixel becomes an exact k x k block (checkerboard source)
    const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)).join(',');
    let blocksOk = true;
    for (const [lx, ly] of [[0, 0], [1, 0], [37, 91], [480, 270], [959, 539]]) {
      const want = (lx + ly) % 2 === 0 ? '255,0,0' : '0,0,255';
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (px(r1080.c, lx * 2 + dx, ly * 2 + dy) !== want) blocksOk = false;
    }
    check('Integer scaling copies pixels exactly (1080p: every logical pixel is a clean 2x2 block, no smoothing)', blocksOk);
    // non-integer outputs keep the exact aspect (no stretch) and go through a whole-number nearest-neighbour stage
    const sharpOk = sizes.every(([w, h]) => { const { d } = fit(w, h); return Math.abs(d.out.w / d.out.h - 16 / 9) < 0.004 && (d.out.mode === 'integer' || (d.mid && d.mid.width % SCREEN.w === 0 && d.mid.width / SCREEN.w === Math.ceil(d.out.k))); });
    const intMode = fit(2560, 1440, 'integer');
    check('Higher / non-integer resolutions keep 16:9 proportions; 1440p sharp = 3x nearest then one smooth step, integer mode = 2x letterboxed', sharpOk && intMode.d.out.w === 1920 && intMode.d.out.k === 2 && r4k.d.out.k === 4 && r4k.d.out.mode === 'integer', `1440p integer -> ${intMode.d.out.w}x${intMode.d.out.h}; 4K -> ${r4k.d.out.k}x`);
    // windowed / fullscreen: Fullscreen API wired, layout re-runs on fullscreenchange, F11 + OPTIONS entry
    let relayout = 0; const origLayout = g.display.layout.bind(g.display); g.display.layout = () => { relayout++; origLayout(); };
    document.dispatchEvent(new Event('fullscreenchange')); window.dispatchEvent(new Event('resize'));
    g.display.layout = origLayout;
    check('Fullscreen / windowed: F11 + OPTIONS toggle the Fullscreen API; the output re-fits on fullscreen change and window resize', KEYMAP.F11 === 'fullscreen' && typeof g.toggleFullscreen === 'function' && typeof document.documentElement.requestFullscreen === 'function' && relayout >= 1,
      `re-fits seen: ${relayout} (listeners also on the real Display); real fullscreen needs a user key press - checked by hand`);

    // ============================================================ 4-5. COMMANDS popup removed, commands kept
    freshArena('war');
    g.render();
    check('COMMANDS popup removed (no drawer, no layout slot, no command list / menu index in the game)', HUD.drawCommandMenu === undefined && LAYOUT.commandMenu === undefined && g.commands === undefined && g.commandIndex === undefined && typeof g.runCommand === 'undefined');
    const got = {};
    const press = (a, dt = 0.05) => { g.input.pressed.push(a); g.ui.beginFrame(); real(dt); };
    { const d0 = g.player.dir; press('aboutFace'); got.TURN = g.player.dir === (d0 + 2) % 4; }
    { const n0 = g.logEntries.length; press('look'); got.LOOK = g.logEntries.length > n0; }
    { swings.length = 0; dummyAhead(); press('fight'); got.FIGHT = swings.length === 1; step(2); }
    { swings.length = 0; press('attack'); got.ATTACK = swings.length === 1; step(2); }
    { g.hero.level = 30; g.calc.invalidate(); g.resource.value = g.resource.max; const u0 = g.stats.skillsUsed; press('cast'); got.CAST = g.stats.skillsUsed > u0; step(2); }
    { const a0 = g.equipment.active; g.equipment.weaponSlots[1] = g.equipment.weaponSlots[1] || g.equipment.weaponSlots[0]; press('nextWeapon'); got['SWAP WEAPONS'] = g.equipment.active !== a0 || g.logEntries.at(-1)?.text.includes('other weapon'); }
    { g.hero.hp = g.hero.maxHp - 50; const pots = g.inventory.countOf('health_potion'); press('quickPotion'); got.USE = pots === 0 || g.inventory.countOf('health_potion') === pots - 1; }
    { g.input.heldKeys.add('KeyF'); g.ui.beginFrame(); real(0.05); got.DEFEND = g.player.guarding; g.input.heldKeys.delete('KeyF'); step(0.2); }
    { for (const e of g.enemies) e.alive = false; const c = faceOpen(); const p0 = { x: g.player.x, y: g.player.y }; g.player.moveCD = 0; press('forward'); step(0.4); got['MOVE TO'] = g.player.x !== p0.x || g.player.y !== p0.y || !c; }
    { const p0 = { x: g.player.x, y: g.player.y }; g.player.moveCD = 0; press('runAway'); step(0.4); got['RETREAT / RUN AWAY'] = g.player.x !== p0.x || g.player.y !== p0.y; }
    { press('formation'); got['SWAP POSITIONS'] = g.panel === 'formation'; press('pause'); got.CANCEL = g.panel === null; }
    { const n0 = g.logEntries.length; press('interact'); got['OPEN DOOR / INTERACT'] = g.logEntries.length > n0 || g.dungeon.def != null; }
    check('Every former COMMANDS entry still works from its key (LOOK RETREAT FIGHT ATTACK DEFEND CAST USE SWAP TURN MOVE OPEN CANCEL)', Object.values(got).every(Boolean), Object.entries(got).map(([k, v]) => `${k}:${v ? 'ok' : 'NO'}`).join(' '));
    const listed = ['SPACE', 'G /', 'X / Z', 'F / RMB', 'E', 'Q', 'ESC', 'F11'].every((k) => CONTROLS.some(([key]) => key.startsWith(k)));
    check('The CONTROLS panel lists the keys that replace the menu', listed && ['fight', 'aboutFace', 'runAway', 'nextWeapon', 'cast'].every((a) => Object.values(KEYMAP).includes(a)));

    // ============================================================ 6-8. hold SPACE
    freshArena('war');
    const dummy = dummyAhead();
    press('attack'); hold(true); step(4); // the press swings once, holding keeps swinging
    const heldCount = swings.length;
    const iv = swings.slice(1).map((s, i) => s.t - swings[i].t);
    const need = Math.max(TUNING.attackRepeat, g.weapons.current.cooldown);
    check('Holding SPACE repeats attacks automatically (one key press, no re-pressing)', heldCount >= 5, `${heldCount} swings in 4 s with ${g.weapons.current.name} (cooldown ${g.weapons.current.cooldown}s)`);
    hold(false); const atRelease = swings.length; step(3);
    check('Releasing SPACE schedules no further attacks', swings.length === atRelease, `${swings.length - atRelease} swings after release`);
    check('Repeat rate respects max(attackRepeat, weapon cooldown) - nothing faster, no queued burst', iv.every((d) => d >= need - 1e-6) && Math.max(...iv) <= need + 0.05 + 1e-6, `need ${need.toFixed(2)}s, intervals ${[...new Set(iv.map((d) => d.toFixed(2)))].join('/')}`);
    // fast weapon: the configured repeat interval is the floor; slow weapon: its own cooldown is
    const rate = (mult, dt) => { freshArena('war'); dummyAhead(); g.weapons.cooldownMult = () => mult; press('attack', dt); hold(true); step(6, dt); hold(false); const ts = swings.map((s) => s.t); return { n: ts.length, min: Math.min(...ts.slice(1).map((t, i) => t - ts[i])) }; };
    const fast = rate(0.2, 0.05), slow = rate(2, 0.05);
    check('Configurable repeat: fast weapon capped at attackRepeat, slow weapon held back by its cooldown', fast.min >= TUNING.attackRepeat - 1e-6 && slow.min >= 0.6 * 2 - 1e-6 && TUNING.attackRepeat >= 0.45 && TUNING.attackRepeat <= 0.65, `attackRepeat ${TUNING.attackRepeat}s: fast min ${fast.min.toFixed(2)}s, slow min ${slow.min.toFixed(2)}s`);
    const f30 = rate(1, 1 / 30), f144 = rate(1, 1 / 144), f20 = rate(1, 0.05);
    check('Same attack speed at 20 / 30 / 144 fps (game-time driven, not per frame)', Math.max(f30.n, f144.n, f20.n) - Math.min(f30.n, f144.n, f20.n) <= 1, `6 s held: 20fps ${f20.n}, 30fps ${f30.n}, 144fps ${f144.n} swings`);

    // ============================================================ 9-10. one damage per swing, feedback in sync
    freshArena('war');
    const tgt = dummyAhead();
    const hits = []; const origDmg = g.combat.damageEnemy.bind(g.combat);
    g.combat.damageEnemy = (e, dmg, crit, o) => { const hp0 = e.hp; const r = origDmg(e, dmg, crit, o); hits.push({ id: e.id, t: g.time, dropped: hp0 - e.hp, anim: !!g.weapons.anim }); return r; };
    const misses0 = g.combat.feedback?.miss || 0;
    const fury0 = g.resource.value, log0 = g.logEntries.length;
    press('attack'); hold(true); step(5); hold(false); step(1.5);
    g.combat.damageEnemy = origDmg;
    const misses = (g.combat.feedback?.miss || 0) - misses0;
    const perSwing = swings.map((s) => s.attack.hit.size);
    check('Each swing applies damage at most once (impact fires once per animation; hits + misses = swings)', perSwing.every((n) => n <= 1) && hits.length + misses === swings.length && hits.every((h) => h.id === tgt.id), `${swings.length} swings -> ${hits.length} hits + ${misses} misses`);
    check('Weapon animation, HP, Fury and log stay in sync with every hit', hits.every((h) => h.anim && h.dropped > 0) && g.resource.value > fury0 && g.logEntries.length > log0 && tgt.hp < tgt.maxHp,
      `HP ${Math.round(tgt.maxHp - tgt.hp)} lost over ${hits.length} hits, Fury ${Math.round(fury0)} -> ${Math.round(g.resource.value)}, +${g.logEntries.length - log0} log lines`);

    // ============================================================ stops: stun, death, panel; target dies
    const stops = {};
    freshArena('war'); dummyAhead();
    g.status.apply('player', 'stagger', { dur: 3 }); press('attack'); hold(true); step(2); stops.stunned = swings.length === 0; hold(false);
    freshArena('war'); dummyAhead(); g.hero.hp = 0; hold(true); step(1.5); stops.dead = swings.length === 0; hold(false);
    freshArena('war'); dummyAhead(); g.openPanel('inventory'); hold(true); step(1.5); stops.panel = swings.length === 0; hold(false); g.closePanel();
    freshArena('war'); dummyAhead(); g.input.heldKeys.add('KeyF'); hold(true); step(1.5); stops.guarding = swings.length === 0; hold(false); g.input.heldKeys.delete('KeyF');
    check('Held attack stops while stunned, dead, guarding or with a panel open', Object.values(stops).every(Boolean), JSON.stringify(stops));
    freshArena('war');
    const weak = dummyAhead(1);
    const dmgAfter = []; const origDmg2 = g.combat.damageEnemy.bind(g.combat);
    g.combat.damageEnemy = (e, ...r) => { if (!e.alive) dmgAfter.push(e.id); return origDmg2(e, ...r); };
    press('attack'); hold(true); step(4); hold(false);
    g.combat.damageEnemy = origDmg2;
    const airLogs = g.logEntries.filter((l) => l.text.includes('empty air')).length;
    check('When the target dies, swings continue at empty air with no damage to the corpse (existing empty-attack rule)', !weak.alive && dmgAfter.length === 0 && airLogs >= 1, `target alive: ${weak.alive}, hits on corpse: ${dmgAfter.length}, empty-air lines (throttled): ${airLogs}`);

    // ============================================================ 11. layout: nothing overlaps or leaves the screen
    const rects = Object.entries(LAYOUT).filter(([k]) => !['view', 'panel', 'leftPanel', 'rightPanel'].includes(k)).map(([k, r]) => ({ k, ...r }));
    for (const side of ['leftPanel', 'rightPanel']) { const c = LAYOUT[side]; rects.push({ k: side, x: c.x, y: c.y, w: c.w, h: c.slotH * 3 + c.gap * 2 }); }
    const inside = rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= SCREEN.w && r.y + r.h <= SCREEN.h);
    const clash = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) clash.push(`${a.k}/${b.k}`);
    }
    const V = LAYOUT.view, F = LAYOUT.viewFrame, P = LAYOUT.panel;
    const viewIn = V.x > F.x && V.y > F.y && V.x + V.w < F.x + F.w && V.y + V.h < F.y + F.h;
    const panelIn = P.x >= 0 && P.y >= 0 && P.x + P.w <= CLASSIC.w && P.y + P.h <= CLASSIC.h && CLASSIC.x + CLASSIC.w <= SCREEN.w && CLASSIC.y + CLASSIC.h <= SCREEN.h;
    check('HUD regions stay on screen and never overlap; viewport sits inside its frame; panels fit the centred 640x480 area', inside && !clash.length && viewIn && panelIn, clash.join(', ') || `view ${V.w}x${V.h} (was 384x328), focal ${VIEW.focal}`);
    // every scene + panel renders without throwing at the new size
    freshArena('war'); g.ai.update = origAi;
    const panels = ['inventory', 'character', 'skills', 'crafting', 'formation', 'map', 'pause', 'options', 'keybinds', 'help', 'objectives', 'journal'];
    let drawErr = null;
    try { g.render(); for (const p of panels) { g.openPanel(p); g.render(); } g.closePanel(); g.toCamp(); g.render(); g.openPanel('inventory'); g.render(); g.closePanel(); g.scene = 'select'; g.render(); g.toTitle(); g.render(); } catch (err) { drawErr = err.message; }
    check('Every scene and panel renders at 960x540 without errors', !drawErr && !errors.length, drawErr || errors[0] || `${panels.length} panels + camp + select + title`);
  } catch (err) {
    check('Phase 7 suite ran to completion', false, `${err.message} @ ${(err.stack || '').split('\n')[1] || ''}`);
    console.warn(err);
  } finally {
    console.error = origError;
    g.weapons.begin = origBegin; g.ai.update = origAi; g.weapons.cooldownMult = origMult;
    hold(false);
    Object.assign(g.settings, keepSettings); g.saves.saveSettings(g.settings);
    g.update = real;
  }
  const passed = results.filter((r) => r.result === 'PASS').length;
  console.log(`PHASE 7 (UI 16:9 + hold attack): ${passed}/${results.length} passed`);
  console.table(results);
  window.__p7Results = { passed, total: results.length, results };
  return results;
}
