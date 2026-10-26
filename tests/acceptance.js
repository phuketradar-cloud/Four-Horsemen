// Automated acceptance run (Phase 1 checklist, now per Horseman).
//   http://localhost:5173/?test            -> WAR, basic attacks only (Phase 1 regression)
//   http://localhost:5173/?test2           -> Phase 2 suite (tests/phase2.js) which reuses this per class
// A scripted bot plays the real systems (movement rules, combat, AI, loot, skills, UI clicks)
// with the main loop frozen and time stepped manually, then prints a PASS/FAIL table.
import { WEAPONS } from '../src/data/weapons.js';
import { HORSEMEN } from '../src/data/characters.js';
import { Input } from '../src/core/Input.js';

export async function runAcceptance(g, { classId = 'war', useSkills = false, standalone = true, autoEquip = null } = {}) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const onErr = (e) => errors.push(e.message);
  window.addEventListener('error', onErr);
  const tag = standalone ? '' : `[${HORSEMEN[classId].name}] `;
  const check = (name, pass, detail = '') => { results.push({ test: tag + name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };

  // ---- freeze the live loop; drive time manually
  const realUpdate = g.update.bind(g);
  g.update = () => {};
  let frame = 0;
  const sim = (sec) => {
    for (let t = 0; t < sec - 1e-9; t += 0.05) {
      g.ui.beginFrame(); realUpdate(0.05);
      if (++frame % 8 === 0) g.render(); // exercise rendering regularly
    }
  };
  const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const face = (d) => { g.player.dir = d; g.player.lastTurnAt = g.time; g.dungeon.reveal(g.player.x, g.player.y, d); };
  const faceTo = (x, y) => { const d = DIRV.findIndex(([a, b]) => a === x - g.player.x && b === y - g.player.y); if (d >= 0) face(d); };
  const step = () => { g.player.moveCD = 0; const ok = g.controller.step(1); sim(0.25); return ok; };
  const keyTap = (code, shiftKey = false) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey })); sim(0.05); window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey })); sim(0.05); };
  const weaponKey = (n) => keyTap(`Digit${n}`, g.settings.hotkeys !== 'weapons'); // Shift+1-4 = weapons by default

  // Bot combat: perfect-parry telegraphed blows, use class skills when allowed, else basic attacks.
  let botGuards = false;
  let knightWindupSeen = false;
  const hpChecks = []; // filled by the takeDamage probe below
  const trySkill = (e) => {
    if (!useSkills || !hpChecks.length) return false;
    if (e.type === 'knight' && e.rank === 'elite' && !knightWindupSeen) return false; // let the telegraph test happen first
    for (const i of [4, 0, 1, 2, 3]) {
      const id = g.skills.slots[i];
      if (g.skills.canUse(id).ok) return g.skills.use(id);
    }
    return false;
  };
  const fight = (maxSec = 40) => {
    for (let t = 0; t < maxSec; t += 0.05) {
      if (!g.hero.alive || g.scene !== 'playing') return;
      const e = g.combat.engaged;
      if (!e || !e.alive) {
        if (!g.combat.sideThreats.length) return;
        sim(0.05); continue;
      }
      if (g.hero.hp < g.hero.maxHp * 0.35 && g.inventory.countOf('health_potion')) g.usePotion();
      const windup = e.state === 'attack' && e.phase === 'windup';
      if (windup && e.type === 'knight') knightWindupSeen = true;
      if (botGuards && windup && e.phaseT >= e.def.windup - 0.22 && !g.player.guarding) g.player.guardUntil = g.time + 0.45;
      else if (e.rank === 'elite' && !knightWindupSeen) { /* wait for the knight's telegraph, then parry it */ }
      else if (!windup && !g.player.guarding && (botGuards || hpChecks.length > 0)) {
        if (!trySkill(e) && g.weapons.canAttack()) g.combat.playerAttack();
      }
      sim(0.05);
    }
  };
  // Walk to a cell (or next to an enemy), fighting anything that engages on the way.
  const walkTo = (tx, ty, adjacentOnly = false) => {
    for (let n = 0; n < 200; n++) {
      if (g.combat.active || g.combat.sideThreats.length) { fight(); sim(0.05); continue; }
      const p = g.player;
      const dist = Math.abs(p.x - tx) + Math.abs(p.y - ty);
      if ((adjacentOnly && dist === 1) || dist === 0) return true;
      const s = g.dungeon.nextStep(p.x, p.y, tx, ty, (x, y) => !!g.ai.enemyAt(x, y) && !(x === tx && y === ty));
      if (!s) return false;
      if (s.x === tx && s.y === ty && adjacentOnly) return true;
      faceTo(s.x, s.y);
      if (!step()) sim(0.3);
    }
    return false;
  };
  // Phase 3: optionally pick up drops and equip upgrades after each fight (equipment progression).
  const loot = () => {
    if (!autoEquip) return;
    for (let i = 0; i < 4; i++) {
      const p = g.player;
      const near = g.loot.floor.find((f) => Math.abs(f.x - p.x) + Math.abs(f.y - p.y) <= 3 && g.dungeon.hasLOS(p.x, p.y, f.x, f.y));
      if (!near) break;
      if (near.x !== p.x || near.y !== p.y) { walkTo(near.x, near.y, g.dungeon.isWalkable(near.x, near.y) ? false : true); faceTo(near.x, near.y); }
      if (!g.controller.interact()) break;
    }
    autoEquip(g);
  };
  const hunt = (e) => { for (let i = 0; i < 6 && e.alive && g.hero.alive; i++) { walkTo(e.x, e.y, true); faceTo(e.x, e.y); sim(0.5); fight(); } loot(); return !e.alive; };

  try {
    // ================================================================= 2D only
    const usesGL = [...document.querySelectorAll('canvas')].some((c) => c.getContext('2d') === null);
    check('Game is 2D only (Canvas 2D, no WebGL/3D library)', !usesGL && typeof window.THREE === 'undefined' && g.ctx instanceof CanvasRenderingContext2D, `ctx=${g.ctx.constructor.name}`);
    check('Served from local dev server', location.protocol.startsWith('http'), location.origin);

    // ================================================================= movement
    g.newGame(classId); sim(0.2);
    const sx = g.player.x;
    step(); const fwdOk = g.player.x === sx + 1;
    g.player.moveCD = 0; g.controller.step(-1); sim(0.25); const backOk = g.player.x === sx;
    const d0 = g.player.dir; keyTap('KeyA'); sim(0.3); const turnL = g.player.dir === (d0 + 3) % 4; keyTap('KeyD'); sim(0.3); const turnR = g.player.dir === d0;
    keyTap('KeyW'); sim(0.3); const keyMove = g.player.x === sx + 1;
    check('Move forward / back / turn left / right', fwdOk && backOk && turnL && turnR && keyMove, `fwd ${fwdOk} back ${backOk} turnL ${turnL} turnR ${turnR} key W ${keyMove}`);

    face(0); const wy = g.player.y; step(); step(); step();
    const wallOk = g.player.y >= 1 && g.dungeon.isWalkable(g.player.x, g.player.y);
    face(3); for (let i = 0; i < 6; i++) step();
    check('No walking through walls / out of bounds', wallOk && g.player.x >= 1 && g.dungeon.isWalkable(g.player.x, g.player.y), `stopped at ${g.player.x},${g.player.y} (from y=${wy})`);

    // ================================================================= weapons data
    const ws = ['sword', 'axe', 'crossbow', 'dagger'].map((k) => WEAPONS[k]);
    const sig = new Set(ws.map((w) => `${w.dmg}|${w.cooldown}|${w.range}|${w.kind}|${!!w.cleave}`));
    check('4 weapons have distinct stats & behaviour', sig.size === 4, ws.map((w) => `${w.id}:${w.dmg.join('-')}/${w.cooldown}s/r${w.range}${w.cleave ? '/cleave' : ''}${w.kind === 'ranged' ? '/projectile' : ''}`).join(' '));

    // ================================================================= combat room (skeletons)
    walkTo(5, 3); face(1); g.controller.openFront(); sim(0.2);
    walkTo(10, 4); face(2); g.controller.openFront(); sim(0.3);
    const hpStart = g.hero.hp;
    let damageEvents = 0;
    const origStrike = g.combat.enemyStrike.bind(g.combat);
    const strikesAfterDeath = [];
    g.combat.enemyStrike = (e) => { if (!e.alive) strikesAfterDeath.push(e.name); damageEvents++; origStrike(e); };
    const origTake = g.hero.takeDamage.bind(g.hero);
    g.hero.takeDamage = (n) => { const before = g.hero.hp; const dealt = origTake(n); hpChecks.push(g.hero.hp === Math.max(0, before - dealt) && dealt === Math.max(0, Math.round(n))); return dealt; };
    let parried = false;
    const origStagger = g.ai.stagger.bind(g.ai);
    g.ai.stagger = (e, d) => { if (g.player.guarding) parried = true; origStagger(e, d); };
    for (let i = 0; i < 8 && g.enemies.some((e) => e.alive && e.room === 'combat'); i++) {
      const e = g.enemies.find((q) => q.alive && q.room === 'combat');
      hunt(e);
      botGuards = true; // first fight: take a hit before striking back, then fight properly and parry
    }
    g.hero.takeDamage = origTake;
    const skelsDead = g.enemies.filter((e) => e.room === 'combat').every((e) => !e.alive);
    check('Player fights Hollow Skeletons', skelsDead, `combat-room skeletons slain: ${g.enemies.filter((e) => e.room === 'combat' && !e.alive).length}/3`);
    check('Enemies detect and attack the player', damageEvents > 0, `${damageEvents} enemy strikes resolved`);
    check('Player HP decreases correctly', hpChecks.length > 0 && hpChecks.every(Boolean), `${hpChecks.length} hits, all HP deltas exact: ${hpChecks.every(Boolean)}; start HP ${hpStart}, total damage ${g.stats.damageTaken}`);
    sim(2);
    check('Dead enemies stop attacking', strikesAfterDeath.length === 0 && g.enemies.filter((e) => !e.alive).every((e) => e.state === 'death'), `strikes by dead enemies: ${strikesAfterDeath.length}`);
    check('Player gains XP / levels up', g.hero.totalXp > 0 && g.hero.level >= 2, `level ${g.hero.level}, total XP ${g.hero.totalXp}`);

    // ================================================================= loot room + weapon keys
    walkTo(16, 3); face(1); g.controller.openFront(); sim(0.2);
    walkTo(19, 3); face(0);
    const invBefore = g.inventory.items.length;
    g.controller.interact(); sim(0.1);
    const gotXbow = g.inventory.items.some((i) => i.defId === 'hunter_crossbow');
    walkTo(22, 2); face(0); g.controller.interact(); sim(0.1); g.controller.interact(); sim(0.1);
    const gotAxe = g.inventory.items.some((i) => i.defId === 'war_axe');
    check('Pick up items into Inventory', gotXbow && gotAxe && g.inventory.items.length > invBefore, g.inventory.items.map((i) => `${i.name}x${i.qty}`).join(', '));
    g.controller.interact(); sim(0.1);
    const uids = g.inventory.items.map((i) => i.uid);
    check('Same item cannot be picked up twice', new Set(uids).size === uids.length && g.loot.itemsAt(22, 1).length === 0, `${uids.length} items, all unique uids; chest tile empty`);

    const switched = [];
    for (let s = 0; s < 4; s++) {
      if (!g.equipment.weaponSlots[s]) continue;
      weaponKey(s + 1);
      switched.push(g.equipment.active === s ? `${s + 1}:${g.weapons.current.def.id}` : `${s + 1}:FAILED`);
    }
    check('Switch weapons with keys (Shift+1-4)', switched.length >= 2 && !switched.some((x) => x.includes('FAILED')), switched.join(' '));

    // equip changes stats
    const before = g.weapons.current;
    const other = g.inventory.items.find((i) => i.def.type === 'weapon' && i.def.weaponId !== before.def.id);
    g.openPanel('inventory'); g.invSel = g.inventory.items.indexOf(other); sim(0.05); g.render();
    g.equipItem(other.uid); sim(0.05);
    const after = g.weapons.current;
    g.equipItem(other.uid); g.equipItem(other.uid);
    const slotsAfterDup = g.equipment.weaponSlots.filter((u) => u === other.uid).length;
    g.closePanel();
    check('Equip weapon changes stats (no double-stacking)', `${before.dmgMin}-${before.dmgMax}` !== `${after.dmgMin}-${after.dmgMax}` && slotsAfterDup === 1 && after.dmgMin === other.stats.dmgMin,
      `${before.def.id} ${before.dmgMin}-${before.dmgMax} -> ${after.def.id} ${after.dmgMin}-${after.dmgMax}; equip x3 => ${slotsAfterDup} slot`);

    // potion
    g.hero.hp = Math.max(1, g.hero.hp - 30);
    const potsBefore = g.inventory.countOf('health_potion');
    const hpb = g.hero.hp;
    g.usePotion();
    const expect = Math.min(g.hero.maxHp, hpb + 40);
    check('Health Potion restores HP correctly', g.hero.hp === expect && g.inventory.countOf('health_potion') === potsBefore - 1, `HP ${hpb} -> ${g.hero.hp} (expected ${expect}); potions ${potsBefore} -> ${g.inventory.countOf('health_potion')}`);

    // ================================================================= secret room
    walkTo(7, 8); face(3); g.controller.look(); sim(0.2);
    const secretOpen = g.dungeon.isOpened(6, 8);
    walkTo(3, 7); face(3); g.controller.interact(); sim(0.1); g.controller.interact(); sim(0.1);
    walkTo(3, 8); g.controller.interact(); sim(0.1);
    check('Secret room can be found (LOOK) and looted', secretOpen && g.inventory.items.some((i) => i.defId === 'cursed_dagger'), `secret ${secretOpen}`);

    // ================================================================= elite room: crossbow at range + knight
    const knight = g.enemies.find((e) => e.room === 'elite' && e.type === 'knight');
    walkTo(15, 7); face(2); g.controller.openFront(); sim(0.2);
    walkTo(15, 9);
    weaponKey(3);
    let rangedDetail = 'no target lined up';
    let rangedHit = false;
    for (let i = 0; i < 300 && !rangedHit && g.enemies.some((e) => e.alive && e.room === 'elite'); i++) {
      if (g.combat.active) { weaponKey(4); fight(); weaponKey(3); continue; }
      const p = g.player;
      const target = g.enemies.find((e) => e.alive && (e.x === p.x || e.y === p.y) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) >= 2 &&
        Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 6 && g.dungeon.hasLOS(p.x, p.y, e.x, e.y));
      if (target && g.weapons.canAttack()) {
        face(DIRV.findIndex(([a, b]) => a === Math.sign(target.x - p.x) && b === Math.sign(target.y - p.y)));
        const hp0 = target.hp, dist = Math.abs(target.x - p.x) + Math.abs(target.y - p.y);
        g.combat.playerAttack(); sim(0.6);
        rangedDetail = `${target.name} at ${dist} tiles: HP ${hp0} -> ${target.hp}`;
        rangedHit = target.hp < hp0;
      } else sim(0.1);
    }
    check('Crossbow hits a distant target (projectile)', rangedHit, rangedDetail);
    weaponKey(4); // dagger: no stagger, so the knight's telegraphed wind-up plays out
    const daggerOk = g.weapons.current.def.id === 'dagger';
    for (let i = 0; i < 8 && g.enemies.some((e) => e.alive && e.room === 'elite'); i++) hunt(g.enemies.find((e) => e.alive && e.room === 'elite'));
    check('Player fights Fallen Knight (telegraph + parry window)', !knight.alive && knightWindupSeen && parried, `knight slain: ${!knight.alive}; wind-up telegraph seen: ${knightWindupSeen}; perfect parry triggered: ${parried}`);
    check('Dagger from the secret room is usable (slot 4)', daggerOk, `active: ${g.weapons.current.def.id}`);
    const gate = g.dungeon.gateState[0];
    check('Sealed gate unlocks after elite room cleared', gate.unlocked, `gate unlocked: ${gate.unlocked}`);

    let rolls = 0; for (let i = 0; i < 200; i++) rolls += g.loot.rollDrops(knight).length;
    check('Enemies drop items', rolls > 0 && g.stats.kills >= 5, `${rolls} items from 200 knight drop rolls; kills ${g.stats.kills}`);

    // ================================================================= final chamber
    walkTo(18, 13); face(2); g.controller.openFront(); sim(0.4);
    const gateOpen = g.dungeon.isOpened(18, 14);
    for (let i = 0; i < 14 && g.enemies.some((e) => e.alive && e.room === 'final') && g.hero.alive; i++) {
      const e = g.enemies.filter((q) => q.alive && q.room === 'final').sort((a, b) => Math.abs(a.x - g.player.x) + Math.abs(a.y - g.player.y) - Math.abs(b.x - g.player.x) - Math.abs(b.y - g.player.y))[0];
      hunt(e);
    }
    sim(2.5);
    check('Dungeon Cleared shown after final room is cleared', g.scene === 'cleared', `scene=${g.scene}, gate opened ${gateOpen}, final enemies alive: ${g.enemies.filter((e) => e.alive && e.room === 'final').length}, LV ${g.hero.level}, HP ${Math.ceil(g.hero.hp)}/${g.hero.maxHp}, skills used ${g.stats.skillsUsed}`);
    g.render();
    check('UI shows HP / XP / Level / weapon', g.hero.level > 1 && !!g.weapons.current.name, `LV ${g.hero.level}, XP ${g.hero.xp}/${g.hero.xpNeeded}, HP ${Math.ceil(g.hero.hp)}/${g.hero.maxHp}, weapon ${g.weapons.current.name}`);
    if (useSkills) check('Class skills were used during the run', g.stats.skillsUsed > 0, `${g.stats.skillsUsed} skill casts`);
    const runSummary = {
      level: g.hero.level, hp: Math.ceil(g.hero.hp), maxHp: g.hero.maxHp, damageTaken: g.stats.damageTaken, skillsUsed: g.stats.skillsUsed, time: Math.round(g.stats.playTime), cleared: g.scene === 'cleared',
      equipped: Object.values(g.equipment.slots).filter(Boolean).length, gold: g.gold, bestFind: g.stats.bestRarity, atk: g.hero.atk, def: g.hero.defStat,
    };

    // ================================================================= restart & duplication
    g.combat.enemyStrike = origStrike; g.ai.stagger = origStagger;
    const busCounts = () => [...g.bus.handlers.values()].reduce((s, set) => s + set.size, 0);
    const busBefore = busCounts();
    for (let i = 0; i < 3; i++) { g.newGame(classId); sim(0.1); }
    const ids = new Set(g.enemies.map((e) => e.id));
    const startBag = HORSEMEN[classId].startItems.length;
    check('Restart leaves no duplicate enemies / loot / listeners', g.enemies.length === g.dungeon.spawns.length && ids.size === g.enemies.length && g.loot.floor.length === g.dungeon.def.floorItems.length && busCounts() === busBefore && g.inventory.items.length === startBag,
      `enemies ${g.enemies.length}/${g.dungeon.spawns.length}, floor loot ${g.loot.floor.length}, bus handlers ${busBefore}->${busCounts()}, bag ${g.inventory.items.length}/${startBag}`);
    let inputDup = false; try { new Input(g.canvas); inputDup = true; } catch { /* expected */ }
    check('Input listeners attached exactly once', !inputDup, 'second Input() construction is rejected');

    // ================================================================= death & restart
    walkTo(5, 3); face(1); g.controller.openFront(); walkTo(10, 4); face(2); g.controller.openFront();
    g.hero.hp = 3;
    step(); step(); // walk into the Ossuary Hall and do not fight back
    for (let i = 0; i < 400 && g.scene === 'playing'; i++) sim(0.05);
    const died = g.scene === 'gameover';
    g.newGame(classId); sim(0.1);
    check('Player death -> restart works', died && g.scene === 'playing' && g.hero.hp === g.hero.maxHp && g.hero.level === 1 && g.hero.classId === classId, `died: ${died}; after restart ${g.hero.classId} HP ${g.hero.hp}/${g.hero.maxHp}`);

    // ================================================================= save / load
    walkTo(4, 2);
    const okSave = g.saves.save(g);
    const pos = `${g.player.x},${g.player.y}`;
    g.newGame(classId); g.loadGame(); sim(0.1);
    check('Save / load via LocalStorage', okSave && `${g.player.x},${g.player.y}` === pos && g.hero.classId === classId, `saved at ${pos}, loaded at ${g.player.x},${g.player.y} as ${g.hero.classId}`);
    g.saves.clear();

    let audioOk = true; try { for (const s of ['step', 'sword', 'axe', 'crossbow', 'hit', 'enemySwipe', 'boneDeath', 'pickup', 'inventory', 'levelUp', 'hurt']) g.audio.play(s); } catch { audioOk = false; }
    check('Sound + effects run without errors', audioOk, g.audio.ctx ? `WebAudio state: ${g.audio.ctx.state}` : 'WebAudio starts on first user gesture');
    results.summary = runSummary;
  } catch (err) {
    check('Test harness completed', false, err.stack || err.message);
  }
  check('No console errors during run', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  g.update = realUpdate;
  console.error = origError;
  window.removeEventListener('error', onErr);
  if (standalone) {
    g.toTitle();
    window.__testResults = results;
    console.table(results);
  }
  return results;
}
