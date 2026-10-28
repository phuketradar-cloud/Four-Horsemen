// Party combat suite: http://localhost:5173/?test8  (results in window.__p8Results).
// All four Horsemen fight together: one controlled, three AI companions running through the same
// combat / skill systems. Covers the 10 acceptance points of the brief plus rule integrity
// (single damage per swing, no wall walking / overlaps, unreachable targets, falling, saves, solo).
import { SCREEN, DIRS } from '../src/data/config.js';
import { CLASS_ORDER } from '../src/data/characters.js';
import { runPhase4 } from './phase4.js';

export async function runPhase8(g) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const check = (name, pass, detail = '') => { results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const keepSettings = JSON.parse(JSON.stringify(g.settings));
  const keepSave = { ...localStorage };

  await runPhase4(g, { botOnly: true });
  const bot = window.__bot;
  const real = bot.realUpdate;
  g.update = () => {};
  const step = (sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) { g.ui.beginFrame(); real(dt); } };
  const P = g.party;
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const origAi = g.ai.update.bind(g.ai);

  // attack / hit ledger: who swung, who damaged whom (wraps the shared systems once)
  const ledger = { swings: [], hits: [] };
  const origDmg = g.combat.damageEnemy.bind(g.combat);
  g.combat.damageEnemy = (e, amount, crit, o = {}) => { if (e.alive && !o.dot) ledger.hits.push({ by: P.current?.classId, id: e.id, src: o.ctx?.source || 'other', amount, t: g.time }); return origDmg(e, amount, crit, o); };
  const origAttack = g.combat.playerAttack.bind(g.combat);
  g.combat.playerAttack = () => { const ok = origAttack(); if (ok) ledger.swings.push({ by: P.current.classId, attack: g.weapons.anim?.attack, t: g.time }); return ok; };
  const reset = () => { ledger.swings.length = 0; ledger.hits.length = 0; };

  // a fresh party game with every foe removed; returns helpers to place foes
  const arena = (cls = 'war', level = 12) => {
    g.settings.party = 'on'; g.forceSolo = false;
    g.newGame(cls);
    for (const m of P.members) P.withActor(m, () => { m.hero.level = level; m.calc.invalidate(); m.hero.hp = m.hero.maxHp; });
    g.ai.update = origAi;
    for (const e of g.enemies) e.alive = false;
    g.input.heldKeys.clear(); g.input.pressed = [];
    reset();
    return g.enemies;
  };
  // revive a foe as a sturdy dummy at (x, y)
  const foe = (x, y, { hp = 400, passive = false } = {}) => {
    const e = g.enemies.find((q) => !q.alive && !q.boss && !q.used);
    e.used = true;
    Object.assign(e, { alive: true, dying: false, x, y, rx: x, ry: y, hp, maxHp: hp, state: passive ? 'idle' : 'chase', phase: null, aggro: null, statuses: new Map() });
    e.def = { ...e.def, evade: 0, block: 0, evasion: 0, detectRange: passive ? 0 : e.def.detectRange };
    return e;
  };
  // free walkable cells around a point, nearest first
  const freeCells = (cx, cy, n) => {
    const out = [], seen = new Set([`${cx},${cy}`]), q = [[cx, cy]];
    while (q.length && out.length < n) {
      const [x, y] = q.shift();
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy, k = `${nx},${ny}`;
        if (seen.has(k) || !g.dungeon.isWalkable(nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
        if (!P.occupied(nx, ny) && !g.ai.enemyAt(nx, ny)) out.push([nx, ny]);
      }
    }
    return out;
  };
  // the starting chamber is small; use the largest open room for fights
  const roomCenter = () => {
    const rooms = g.dungeon.def.rooms || [];
    const area = (r) => (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
    const r = rooms.filter((q) => q.x1 !== undefined).sort((a, b) => area(b) - area(a))[0];
    if (!r) return { x: g.player.x, y: g.player.y };
    const c = { x: Math.floor((r.x1 + r.x2) / 2), y: Math.floor((r.y1 + r.y2) / 2) };
    if (g.dungeon.isWalkable(c.x, c.y)) return c;
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) if (g.dungeon.isWalkable(x, y)) return { x, y };
    return { x: g.player.x, y: g.player.y };
  };
  const teleportParty = (c) => {
    Object.assign(g.player, { x: c.x, y: c.y });
    P.trail = [];
    P.placeAround();
    g.dungeon.reveal(g.player.x, g.player.y, g.player.dir);
  };

  try {
    // ============================================================ 1-3, 6: everybody fights, one controlled
    arena('war');
    check('Party mode: all four Horsemen are in the party, each with its own systems and weapon', P.enabled && P.members.length === 4 && CLASS_ORDER.every((c) => P.byClass(c))
      && new Set(P.members.map((m) => m.hero)).size === 4 && new Set(P.members.map((m) => m.weapons)).size === 4 && new Set(P.members.map((m) => m.skills)).size === 4,
      P.members.map((m) => `${m.name}:${m.weapons.weaponId}`).join(' '));
    // the foe stands in the open middle of the largest room (four free sides); the party arrives from the west
    const mid = roomCenter();
    teleportParty({ x: mid.x - 3, y: mid.y });
    const big = foe(mid.x, mid.y, { hp: 5000 });
    // the player faces it and holds SPACE; nobody gives the companions any input
    const dirTo = (e) => DIRS.findIndex((d) => d.dx === Math.sign(e.x - g.player.x) && d.dy === Math.sign(e.y - g.player.y) && (d.dx === 0 || d.dy === 0));
    step(6);
    const by = (c) => ledger.hits.filter((h) => h.by === c && h.id === big.id).length;
    const companionsOnBig = P.companions.filter((m) => by(m.classId) > 0).map((m) => m.name);
    check('AI companions attack automatically when a foe is in range (no input given)', companionsOnBig.length >= 2, `companions that hit the foe in 6 s: ${companionsOnBig.join(', ') || 'none'}`);
    // player joins in: walk next to it and hold SPACE
    const adjCell = freeCells(big.x, big.y, 6).find(([x, y]) => man({ x, y }, big) === 1);
    if (adjCell) { g.player.x = adjCell[0]; g.player.y = adjCell[1]; }
    g.player.dir = Math.max(0, dirTo(big));
    reset();
    g.input.pressed.push('attack'); g.input.heldKeys.add('Space');
    step(6);
    g.input.heldKeys.delete('Space');
    const attackers = [...new Set(ledger.hits.filter((h) => h.id === big.id).map((h) => h.by))];
    const ctlSwings = ledger.swings.filter((s) => s.by === P.ctl.classId).length;
    check('All four Horsemen damage the same enemy at the same time', attackers.length === 4, `attackers in 6 s: ${attackers.join(', ')}`);
    check('Holding SPACE keeps the controlled Horseman swinging (companions add their own swings)', ctlSwings >= 6, `${P.ctl.name} swings: ${ctlSwings}; all swings: ${ledger.swings.length}`);
    g.render();
    check('Exactly one Horseman is controlled; the controlled body is the first-person camera', P.members.filter((m) => m === P.ctl).length === 1 && g.player === P.ctl.player && g.renderer.view && g.renderer.view.px === g.player.x && g.renderer.view.py === g.player.y);
    // every swing resolves on its own: never more than one damage application per foe per swing
    const multi = ledger.swings.filter((s) => s.attack && s.attack.hit && s.attack.hit.size > 1 && !s.attack.weapon?.def?.cleave);
    check('Each attack resolves independently and damages a foe at most once', !multi.length && ledger.swings.every((s) => !s.attack || [...(s.attack.hit || [])].length <= 3), `${ledger.swings.length} swings checked`);

    // ============================================================ 4: target distribution
    arena('conquest');
    teleportParty(roomCenter());
    const ring = freeCells(g.player.x, g.player.y, 14).filter(([x, y]) => man({ x, y }, g.player) >= 2).slice(0, 3);
    const trio = ring.map(([x, y]) => foe(x, y, { hp: 3000 }));
    step(4);
    const targets = new Set(P.companions.map((m) => m.ai.targetId).filter((id) => id !== null));
    const struck = new Set(ledger.hits.filter((h) => P.companions.some((m) => m.classId === h.by)).map((h) => h.id));
    check('With several foes the companions spread their targets', targets.size >= 2 && struck.size >= 2, `distinct companion targets: ${targets.size}, foes struck by companions: ${struck.size}/${trio.length}`);

    // ============================================================ 7: follow outside combat
    arena('war');
    teleportParty(roomCenter());
    const route = [];
    for (let i = 0; i < 12; i++) {
      const d = DIRS.findIndex((v) => g.dungeon.isWalkable(g.player.x + v.dx, g.player.y + v.dy) && !g.ai.enemyAt(g.player.x + v.dx, g.player.y + v.dy) && !route.some((r) => r.x === g.player.x + v.dx && r.y === g.player.y + v.dy));
      if (d < 0) break;
      g.player.dir = d; g.player.moveCD = 0;
      if (g.controller.step(1)) route.push({ x: g.player.x, y: g.player.y });
      step(0.3);
    }
    step(2);
    const dists = P.companions.map((m) => man(m.player, g.player));
    check('Companions follow the leader in formation outside combat', route.length >= 5 && dists.every((d) => d <= 3) && P.companions.every((m) => m.ai.state === 'FOLLOW'), `leader walked ${route.length} cells; companion distances ${dists.join('/')}`);
    const walk = P.companions.every((m) => g.dungeon.isWalkable(m.player.x, m.player.y));
    const cells = P.members.map((m) => `${P.bodyOf(m).x},${P.bodyOf(m).y}`);
    check('Companions never stand in walls or on each other / the leader', walk && new Set(cells).size === 4, cells.join(' '));
    // they never block the leader: stepping into a companion swaps places
    const comp = P.companions[0];
    const dd = DIRS.findIndex((v) => v.dx === comp.player.x - g.player.x && v.dy === comp.player.y - g.player.y);
    let swapped = 'not adjacent';
    if (dd >= 0) { const was = { x: g.player.x, y: g.player.y }; g.player.dir = dd; g.player.moveCD = 0; g.controller.step(1); swapped = g.player.x === comp.player.x && g.player.y === comp.player.y ? 'overlap!' : comp.player.x === was.x && comp.player.y === was.y ? 'swapped' : 'moved'; }
    else { const nb = freeCells(g.player.x, g.player.y, 4)[0]; comp.player.x = nb[0]; comp.player.y = nb[1]; const d2 = DIRS.findIndex((v) => v.dx === nb[0] - g.player.x && v.dy === nb[1] - g.player.y); const was = { x: g.player.x, y: g.player.y }; g.player.dir = d2; g.player.moveCD = 0; g.controller.step(1); swapped = comp.player.x === was.x && comp.player.y === was.y ? 'swapped' : 'blocked'; }
    check('A companion in the way swaps places with the leader instead of blocking', swapped === 'swapped', swapped);

    // ============================================================ 8: switching control
    arena('war');
    teleportParty(roomCenter());
    const warBody = g.player;
    g.input.pressed.push('control4'); step(0.05); // F4 = Death
    const deathM = P.byClass('death'), warM = P.byClass('war');
    const okSwitch = P.ctl === deathM && g.hero === deathM.hero && g.weapons === deathM.weapons && g.skills === deathM.skills && g.player === deathM.player && g.player !== warBody && warM.player === warBody;
    // input now drives Death only; War is under AI
    const before = { d: { ...g.player }, w: { x: warBody.x, y: warBody.y } };
    const fd = DIRS.findIndex((v) => g.dungeon.isWalkable(g.player.x + v.dx, g.player.y + v.dy) && !P.occupied(g.player.x + v.dx, g.player.y + v.dy));
    g.player.dir = fd; g.player.moveCD = 0;
    g.input.pressed.push('forward'); step(0.05);
    const deathMoved = g.player.x !== before.d.x || g.player.y !== before.d.y;
    step(1.5);
    check('Switching (F1-F4) moves direct control and hands the previous Horseman to the AI', okSwitch && deathMoved && warM.ai.state && P.companions.includes(warM) && !P.companions.includes(deathM),
      `controlled: ${P.ctl.name}; War AI state: ${warM.ai.state}; Death moved by input: ${deathMoved}`);
    g.input.pressed.push('controlNext'); step(0.05);
    check('` cycles control through the living Horsemen', P.ctl !== deathM && g.player === P.ctl.player, `now ${P.ctl.name}`);

    // ============================================================ 9: HP, abilities, results per Horseman
    arena('war', 14);
    teleportParty(roomCenter());
    const target = P.byClass('famine');
    const fc = freeCells(target.player.x, target.player.y, 6).find(([x, y]) => man({ x, y }, target.player) === 1 && man({ x, y }, g.player) > 1);
    let hurt = 'no cell';
    if (fc) {
      const brute = foe(fc[0], fc[1], { hp: 4000 });
      brute.aggro = target;
      const hp0 = target.hero.hp, lead0 = g.hero.hp;
      for (let i = 0; i < 80 && target.hero.hp === hp0; i++) step(0.1);
      hurt = `${target.name} HP ${hp0} -> ${target.hero.hp}, leader HP ${lead0} -> ${g.hero.hp}, aggro: ${brute.aggro?.name}`;
      check('Enemies attack companions too; the damage goes to that Horseman only', target.hero.hp < hp0 && g.hero.hp === lead0, hurt);
    } else check('Enemies attack companions too; the damage goes to that Horseman only', false, hurt);
    // abilities: each companion's own skill system / cooldowns / resource
    reset();
    const casts = {};
    const origUse = {};
    const own = []; // each cast: the cooldown starts on THAT companion's skill system, the cost on its resource
    for (const m of P.companions) {
      origUse[m.classId] = m.skills.use.bind(m.skills);
      m.skills.use = (id) => {
        const r0 = g.resource.value, others = P.members.filter((o) => o !== m).map((o) => o.skills.cooldowns.remaining(id));
        const ok = origUse[m.classId](id);
        if (ok) { casts[m.classId] = (casts[m.classId] || 0) + 1; own.push(g.skills === m.skills && m.skills.cooldowns.remaining(id) > 0 && others.every((v) => v === 0) && (g.resource.value !== r0 || m.skills.params(id).cost === 0)); }
        return ok;
      };
    }
    for (const m of P.companions) P.withActor(m, () => { g.resource.value = g.resource.max; });
    const near = freeCells(g.player.x, g.player.y, 14).filter(([x, y]) => man({ x, y }, g.player) >= 2).slice(0, 3).map(([x, y]) => foe(x, y, { hp: 2500 }));
    step(10);
    for (const m of P.companions) m.skills.use = origUse[m.classId];
    check('Companions use their own class abilities (own costs and cooldowns)', Object.keys(casts).length >= 2 && own.length && own.every(Boolean), `casts: ${JSON.stringify(casts)}; own cooldown + cost each time: ${own.filter(Boolean).length}/${own.length}; foes: ${near.length}`);
    // kills are attributed and XP is shared
    arena('war', 5);
    teleportParty(roomCenter());
    const weakOnes = freeCells(g.player.x, g.player.y, 10).filter(([x, y]) => man({ x, y }, g.player) >= 2).slice(0, 3).map(([x, y]) => foe(x, y, { hp: 20 }));
    const xp0 = P.members.map((m) => m.hero.totalXp);
    step(8);
    const kills = P.members.map((m) => `${m.name}:${m.kills || 0}`).join(' ');
    const shared = P.members.every((m, i) => m.hero.totalXp > xp0[i]) && new Set(P.members.map((m) => m.hero.totalXp)).size === 1;
    const killLines = g.logEntries.filter((l) => / falls to (CONQUEST|FAMINE|DEATH)!/.test(l.text)).length;
    const companionKills = P.companions.reduce((s, m) => s + (m.kills || 0), 0);
    check('Kills are credited to the Horseman who landed them; XP is shared by the party', weakOnes.every((e) => !e.alive) && companionKills > 0 && killLines === companionKills && shared, `${kills}; XP equal for all four: ${shared}; companion kill lines: ${killLines}`);
    check('The combat log names the acting companion ("WAR hits", "CONQUEST: ...")', g.logEntries.some((l) => /^(CONQUEST|WAR|FAMINE|DEATH)[: ]/.test(l.text)), g.logEntries.filter((l) => /^(CONQUEST|WAR|FAMINE|DEATH)[: ]/.test(l.text)).slice(-2).map((l) => l.text).join(' | '));

    // ============================================================ rules: unreachable, falling, frame rate
    arena('war');
    teleportParty(roomCenter());
    // a foe behind a wall with no path: companions give up on it instead of chasing forever
    let walled = null;
    for (let y = 1; y < g.dungeon.h - 1 && !walled; y++) for (let x = 1; x < g.dungeon.w - 1 && !walled; x++) {
      if (g.dungeon.isWalkable(x, y)) continue;
      if (man({ x, y }, g.player) <= 4 && !g.ai.enemyAt(x, y)) walled = { x, y };
    }
    if (walled) {
      const ghost = foe(walled.x, walled.y, { hp: 999 });
      ghost.state = 'chase';
      step(4);
      const stuckOn = P.companions.filter((m) => m.ai.targetId === ghost.id && m.ai.state === 'APPROACH').length;
      check('Unreachable foes are dropped (no endless chasing / swinging at air)', stuckOn === 0 && ledger.hits.every((h) => h.id !== ghost.id), `companions still chasing it: ${stuckOn}`);
      ghost.alive = false;
    } else check('Unreachable foes are dropped (no endless chasing / swinging at air)', false, 'no wall cell found');
    // the controlled Horseman falls -> control passes on; a companion falls -> the rest fight on
    arena('war');
    teleportParty(roomCenter());
    const famine = P.byClass('famine');
    P.withActor(famine, () => { g.hero.hp = 1; });
    const killer = foe(...freeCells(famine.player.x, famine.player.y, 6).find(([x, y]) => man({ x, y }, famine.player) === 1), { hp: 9999 });
    killer.aggro = famine;
    for (let i = 0; i < 5 && !famine.fallen; i++) P.enemyStrike(killer); // the strike EnemyAI issues at the end of a wind-up
    step(1);
    const famineFell = famine.fallen && g.scene === 'playing' && !P.renderList().some((a) => a.classId === 'famine') && P.companions.filter((m) => P.alive(m)).length === 2;
    killer.alive = false;
    const lead = P.ctl;
    g.hurtPlayer(99999, { label: 'test', nonLethal: false, flat: true });
    const handed = g.scene === 'playing' && lead.fallen && P.ctl !== lead && P.alive(P.ctl);
    for (const m of P.members) if (m !== P.ctl) { m.fallen = true; m.hero.hp = 0; }
    g.hurtPlayer(99999, { label: 'test', nonLethal: false, flat: true });
    check('A fallen companion leaves the others fighting; if the controlled one falls control passes on; all four down = game over', famineFell && handed && g.scene === 'gameover', `famine fell: ${famineFell}, control passed: ${handed}, final scene: ${g.scene}`);
    // decisions are time based: the same fight at 30 and 144 fps gives similar companion output
    const rate = (dt) => {
      arena('war');
      teleportParty(roomCenter());
      const s = freeCells(g.player.x, g.player.y, 12).filter(([x, y]) => man({ x, y }, g.player) >= 2)[0];
      foe(s[0], s[1], { hp: 8000 });
      step(6, dt);
      return ledger.swings.filter((w) => w.by !== P.ctl.classId).length;
    };
    const r30 = rate(1 / 30), r144 = rate(1 / 144);
    check('Companion AI is frame-rate independent (30 vs 144 fps)', Math.abs(r30 - r144) <= Math.max(2, Math.round(r30 * 0.25)), `companion swings in 6 s: 30fps ${r30}, 144fps ${r144}`);

    // ============================================================ saves, solo, interface
    arena('war', 9);
    P.withActor(P.byClass('death'), () => { g.hero.hp = 7; });
    g.takeControl('conquest');
    const snap = g.saves.snapshot(g);
    g.loadGame(JSON.parse(JSON.stringify(snap)));
    check('Save / load keeps the whole party (who is controlled, companion HP, levels, gear)', P.ctl.classId === 'conquest' && P.members.length === 4 && P.byClass('death').hero.hp === 7 && P.byClass('war').weapons.weaponId === 'sword' && P.members.every((m) => m.hero.level === 9),
      `controlled ${P.ctl.name}, death HP ${P.byClass('death').hero.hp}, levels ${P.members.map((m) => m.hero.level).join('/')}`);
    g.setPartyOption('party', 'off');
    arena('war'); g.settings.party = 'off'; g.newGame('war');
    check('OPTIONS: PARTY SOLO restores single-Horseman play (no companions on the grid)', !P.enabled && P.members.length === 1 && !P.occupied(g.player.x + 1, g.player.y), `members: ${P.members.length}`);
    g.settings.party = 'on';
    arena('war');
    let drawErr = null;
    try { g.render(); for (const p of ['inventory', 'character', 'skills', 'formation', 'map', 'options', 'help']) { g.openPanel(p); g.render(); } g.closePanel(); g.takeControl('famine'); g.render(); g.toCamp(); g.render(); } catch (err) { drawErr = err.message; }
    check('First-person view, retro HUD and 16:9 frame intact with the party (all panels render)', !drawErr && g.screen.width === SCREEN.w && g.screen.height === SCREEN.h && !errors.length, drawErr || errors[0] || '960x540, panels + camp rendered');
  } catch (err) {
    check('Phase 8 suite ran to completion', false, `${err.message} @ ${(err.stack || '').split('\n')[1] || ''}`);
    console.warn(err);
  } finally {
    console.error = origError;
    g.combat.damageEnemy = origDmg; g.combat.playerAttack = origAttack; g.ai.update = origAi;
    g.input.heldKeys.clear();
    Object.assign(g.settings, keepSettings); g.saves.saveSettings(g.settings);
    for (const k of Object.keys(localStorage)) if (!(k in keepSave)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(keepSave)) localStorage.setItem(k, v);
    g.update = real;
  }
  const passed = results.filter((r) => r.result === 'PASS').length;
  console.log(`PHASE 8 (party combat): ${passed}/${results.length} passed`);
  console.table(results);
  window.__p8Results = { passed, total: results.length, results };
  return results;
}
