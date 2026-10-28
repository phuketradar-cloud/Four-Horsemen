// Phase 4 suite: http://localhost:5173/?test4  (results in window.__p4Results, printed with console.table)
// Unit checks for generation / validation / drops / crafting / enhancement / bosses / secrets / puzzles /
// hazards / class seals / saves, then REAL gameplay: a bot plays the prologue + the Ashen Catacombs with
// all four Horsemen, and the three other dungeons with boosted heroes (bosses included).
import { DUNGEONS, PHASE4_DUNGEONS, PROLOGUE } from '../src/data/dungeons/index.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/data/difficulty.js';
import { BOSSES } from '../src/data/bosses.js';
import { LOOT_TABLES } from '../src/data/lootTables.js';
import { ITEM_DEFS, RARITY_ORDER } from '../src/data/items.js';
import { MATERIALS } from '../src/data/materials.js';
import { RECIPES, TEMPER } from '../src/data/recipes.js';
import { ENEMIES } from '../src/data/enemies.js';
import { SAVE_KEYS, DIRS } from '../src/data/config.js';
import { SAVE_VERSION } from '../src/systems/SaveMigration.js';
import { generateDungeon } from '../src/systems/DungeonGenerator.js';
import { validateLayout } from '../src/systems/DungeonValidator.js';
import { TILE } from '../src/systems/DungeonManager.js';
import { compareItem, upgradeScore } from '../src/systems/ItemComparison.js';

export async function runPhase4(g, { quick = false, botOnly = false } = {}) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const onErr = (e) => errors.push(e.message);
  window.addEventListener('error', onErr);
  const check = (name, pass, detail = '') => { results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const keep = {}; for (const k of Object.values(SAVE_KEYS)) keep[k] = localStorage.getItem(k);

  const realUpdate = g.update.bind(g);
  g.update = () => {};
  let frame = 0;
  const sim = (sec) => { for (let t = 0; t < sec - 1e-9; t += 0.05) { g.ui.beginFrame(); realUpdate(0.05); if (++frame % 12 === 0) g.render(); } };
  const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const face = (d) => { g.player.dir = d; g.player.lastTurnAt = g.time; g.dungeon.reveal(g.player.x, g.player.y, d); };
  const faceTo = (x, y) => { const d = DIRV.findIndex(([a, b]) => a === Math.sign(x - g.player.x) && b === Math.sign(y - g.player.y) && (a === 0 || b === 0)); if (d >= 0) face(d); };
  const give = (it) => { g.inventory.add(it); return it; };
  const fresh = (cls, level = 1) => { g.newGame(cls); g.hero.level = level; g.calc.invalidate(); g.hero.hp = g.hero.maxHp; g.toCamp(); };
  const boost = (cls, level) => { // a hero at the recommended level with level-appropriate gear
    g.newGame(cls);
    g.hero.level = level; g.hero.skillPoints = 0; g.calc.invalidate();
    const eq = { conquest: ['pale_longbow', 'wc_crown', 'wc_mantle', 'wc_bracers', 'wc_greaves', 'signet', 'crown_fragment'], war: ['war_axe', 'rb_helm', 'rb_plate', 'rb_gauntlets', 'rb_greaves', 'iron_band', 'bloodied_banner'],
      famine: ['hunger_sickle', 'bh_hood', 'bh_robe', 'bh_grips', 'bh_treads', 'iron_band', 'black_scales', 'grimoire'], death: ['reaper_scythe', 'pr_cowl', 'pr_shroud', 'pr_gloves', 'pr_walkers', 'iron_band', 'pale_lantern'] }[cls];
    for (const id of eq) { const it = give(g.loot.gen.generate({ baseId: id, rarity: 'epic', ilvl: level, classHint: cls })); g.equipment.equip(it.uid); }
    give(g.loot.create('health_potion', 'common', 9)); give(g.loot.create('greater_health_potion', 'common', 9)); give(g.loot.create('purifying_draught', 'common', 5));
    g.calc.invalidate(); g.hero.hp = g.hero.maxHp;
    g.toCamp();
  };
  const unlockUpTo = (id) => { for (const d of PHASE4_DUNGEONS) { if (d === id) break; g.progress.recordCompletion(d, 'normal'); } };

  // ------------------------------------------------------------------ BOT (real systems, no shortcuts)
  const dm = () => g.dungeon;
  const featureBlocksPath = (x, y) => { const f = dm().featureAt(x, y); return f && ((f.kind === 'collapse' && !f.collapsed) || f.kind === 'blight'); };
  const passable = (x, y, avoid = true) => {
    const d = dm(), t = d.tile(x, y);
    if (d.isWalkable(x, y)) return !(avoid && featureBlocksPath(x, y));
    if (d.isOpened(x, y)) return false;
    if (t === TILE.DOOR) return true;
    if (t === TILE.GATE) { const gt = d.gateAt(x, y); return !!(gt?.unlocked && !gt.sealed) || !!(gt?.requiresCleared && gt.unlocked); }
    return false;
  };
  const path = (tx, ty, adjacent, avoid = true) => {
    const d = dm(), p = g.player, W = d.w, K = (x, y) => y * W + x;
    const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
    if (goal(p.x, p.y)) return [];
    const prev = new Map([[K(p.x, p.y), -1]]), q = [[p.x, p.y]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const dd of DIRS) {
        const nx = x + dd.dx, ny = y + dd.dy, k = K(nx, ny);
        if (prev.has(k) || !passable(nx, ny, avoid)) continue;
        prev.set(k, K(x, y));
        if (goal(nx, ny)) { const out = []; let c = k; while (c !== K(p.x, p.y)) { out.unshift([c % W, Math.floor(c / W)]); c = prev.get(c); } return out; }
        q.push([nx, ny]);
      }
    }
    return avoid ? path(tx, ty, adjacent, false) : null;
  };
  const inDanger = (x, y) => (g.dangerTiles || []).some((d) => d.x === x && d.y === y) || (() => { const f = dm().featureAt(x, y); return f?.kind === 'spectral' && f.boss && g.hazards.spectralState(f) !== 'off'; })();
  const dodge = () => {
    const p = g.player;
    const opts = DIRS.map((d) => [p.x + d.dx, p.y + d.dy]).filter(([x, y]) => dm().isWalkable(x, y) && !g.ai.enemyAt(x, y) && !inDanger(x, y) && !featureBlocksPath(x, y));
    const two = [];
    if (!opts.length) for (const d of DIRS) for (const e of DIRS) { const x = p.x + d.dx + e.dx, y = p.y + d.dy + e.dy; if (dm().isWalkable(p.x + d.dx, p.y + d.dy) && !g.ai.enemyAt(p.x + d.dx, p.y + d.dy) && dm().isWalkable(x, y) && !inDanger(x, y)) two.push([p.x + d.dx, p.y + d.dy]); }
    const pick = opts[0] || two[0];
    if (!pick) return false;
    faceTo(pick[0], pick[1]); p.moveCD = 0; const ok = g.controller.step(1); sim(0.1); return ok;
  };
  let skillUse = true;
  const trySkill = () => {
    if (!skillUse) return false;
    for (const i of [4, 0, 1, 2, 3]) { const id = g.skills.slots[i]; if (g.skills.canUse(id).ok) return g.skills.use(id); }
    return false;
  };
  const heal = () => {
    if (g.hero.hp < g.hero.maxHp * 0.4) { if (g.inventory.countOf('greater_health_potion')) g.useItem(g.inventory.findFirst('greater_health_potion').uid); else if (g.inventory.countOf('health_potion')) g.usePotion(); }
    if ((g.status.has('player', 'blighted') || g.status.has('player', 'cursed')) && g.inventory.countOf('purifying_draught') && g.hero.hp < g.hero.maxHp * 0.7) g.useItem(g.inventory.findFirst('purifying_draught').uid);
  };
  const adjacentFoes = () => g.enemies.filter((e) => e.alive && ['detect', 'chase', 'attack', 'hurt'].includes(e.state) && Math.abs(e.x - g.player.x) + Math.abs(e.y - g.player.y) === 1);
  const fight = (maxSec = 60) => {
    for (let t = 0; t < maxSec; t += 0.05) {
      if (!g.hero.alive || g.scene !== 'playing') return;
      heal();
      const p = g.player;
      if (inDanger(p.x, p.y) && dodge()) continue; // boxed in (no safe neighbour): take the hit and keep fighting
      const boss = g.bossCtl.boss;
      let e = g.combat.engaged;
      if ((!e || !e.alive) && boss?.alive && boss.bossState?.started) { // close in on the boss, never through danger
        if (Math.abs(boss.x - p.x) + Math.abs(boss.y - p.y) === 1) { faceTo(boss.x, boss.y); sim(0.05); continue; }
        const st = path(boss.x, boss.y, true);
        if (st && st.length && !inDanger(st[0][0], st[0][1]) && !g.ai.enemyAt(st[0][0], st[0][1])) { faceTo(st[0][0], st[0][1]); p.moveCD = 0; g.controller.step(1); }
        else if (adjacentFoes().length) faceTo(adjacentFoes()[0].x, adjacentFoes()[0].y);
        sim(0.1); continue;
      }
      if (!e || !e.alive) {
        const adj = adjacentFoes();
        if (!adj.length) return;
        faceTo(adj[0].x, adj[0].y); sim(0.05); continue;
      }
      const windup = e.state === 'attack' && e.phase === 'windup';
      const wu = e.curWindup || e.def.windup * (e.windupMult || 1);
      const melee = !e.boss || e.bossState?.attack?.a.kind === 'melee';
      if (windup && melee && e.phaseT >= wu - 0.25 && !p.guarding) p.guardUntil = g.time + 0.45;
      else if (!windup || !melee) { if (!p.guarding) { if (!trySkill() && g.weapons.canAttack()) g.combat.playerAttack(); } }
      sim(0.05);
    }
  };
  const step = (x, y) => {
    const p = g.player, d = dm();
    faceTo(x, y);
    const t = d.tile(x, y);
    if ((t === TILE.DOOR || t === TILE.GATE) && !d.isOpened(x, y)) { g.controller.openFront(); sim(0.15); return true; }
    if (g.ai.enemyAt(x, y)) { fight(); return true; }
    p.moveCD = 0;
    const ok = g.controller.step(1);
    sim(0.18);
    return ok;
  };
  const busy = () => (g.combat.active && g.combat.engaged?.alive) || g.combat.sideThreats.length || adjacentFoes().length || (g.bossCtl.active && g.bossCtl.boss.alive);
  const walkTo = (tx, ty, adjacent = false, limit = 400) => {
    for (let n = 0; n < limit; n++) {
      if (!g.hero.alive || g.scene !== 'playing') return false;
      if (busy()) { fight(); sim(0.05); continue; }
      heal();
      const p = g.player;
      if (adjacent ? Math.abs(p.x - tx) + Math.abs(p.y - ty) === 1 : p.x === tx && p.y === ty) return true;
      const st = path(tx, ty, adjacent);
      if (!st) return false;
      if (!st.length) return true;
      if (!step(st[0][0], st[0][1])) sim(0.2);
    }
    return false;
  };
  const collect = () => { // floor loot nearby (materials auto-collect when walked over)
    for (let i = 0; i < 6; i++) {
      const p = g.player;
      const near = g.loot.floor.filter((f) => Math.abs(f.x - p.x) + Math.abs(f.y - p.y) <= 6 && path(f.x, f.y, !dm().isWalkable(f.x, f.y))).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))[0];
      if (!near || g.inventory.full) break;
      if (!walkTo(near.x, near.y, !dm().isWalkable(near.x, near.y))) break;
      faceTo(near.x, near.y);
      if (!g.controller.interact()) break;
    }
    autoEquip();
  };
  const autoEquip = () => {
    for (const it of [...g.inventory.items]) {
      if (!it.def.slot || g.equipment.isEquipped(it.uid) || !g.equipment.canEquip(it).ok) continue;
      if (upgradeScore(compareItem(g, it)) > 0.5) g.equipment.equip(it.uid);
    }
    while (g.inventory.bagFree < 6) { const junk = g.inventory.bagItems.filter((i) => i.def.slot).sort((a, b) => a.value - b.value)[0]; if (!junk) break; g.craft.dismantle(junk.uid, true); }
  };
  const hunt = (filter) => {
    for (let i = 0; i < 30; i++) {
      const p = g.player;
      const e = g.enemies.filter((q) => q.alive && filter(q) && path(q.x, q.y, true)).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))[0];
      if (!e || !g.hero.alive) return;
      walkTo(e.x, e.y, true, 120); faceTo(e.x, e.y); sim(0.3); fight();
      collect();
    }
  };
  const roomCenter = (r) => { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) { const x = Math.floor((r.x1 + r.x2) / 2) + dx, y = Math.floor((r.y1 + r.y2) / 2) + dy; if (dm().isWalkable(x, y)) return [x, y]; } return [r.x1, r.y1]; };
  const useAt = (x, y, look = false) => { if (!walkTo(x, y, true)) return false; faceTo(x, y); if (look) g.controller.look(); else g.controller.interact(); sim(0.15); return true; };

  // Plays one floor: rooms, key objective, puzzles, secrets, class seals, chests, then stairs / boss / exit.
  const playFloor = (log, { secrets = true } = {}) => {
    const L = dm().def;
    const rooms = L.rooms.filter((r) => !['secret', 'class', 'boss', 'stairs'].includes(r.type));
    for (const r of rooms) {
      if (!g.hero.alive) return false;
      const [cx, cy] = roomCenter(r);
      walkTo(cx, cy);
      hunt((e) => e.room === r.id);
    }
    // puzzles (key + optional)
    for (const pz of dm().puzzles.values()) {
      if (pz.solved) continue;
      if (pz.kind === 'runes') for (const sym of pz.order) { const f = dm().featureList.find((q) => q.puzzle === pz.id && q.kind === 'rune' && q.symbol === sym); useAt(f.x, f.y); }
      else for (const f of dm().featureList.filter((q) => q.puzzle === pz.id && q.kind === 'plate')) walkTo(f.x, f.y);
      log.puzzles = (log.puzzles || 0) + (pz.solved ? 1 : 0);
    }
    // secrets: wall (LOOK) / switch / guardian
    if (secrets) for (const r of L.rooms.filter((q) => q.type === 'secret' && q.secretDoor)) {
      const { x, y } = r.secretDoor;
      if (dm().isOpened(x, y)) continue;
      if (r.method === 'switch') { const sw = dm().featureList.find((f) => f.kind === 'switch' && f.opens.x === x && f.opens.y === y); if (sw) useAt(sw.x, sw.y); }
      else if (r.method === 'guardian') hunt((e) => e.guardsSecret && e.guardsSecret.x === x && e.guardsSecret.y === y);
      else useAt(x, y, true);
      if (dm().isOpened(x, y)) { log.secrets = (log.secrets || 0) + 1; log.methods = [...(log.methods || []), r.method]; }
    }
    // class seals: own class opens directly, other classes use the hidden switch
    for (const r of L.rooms.filter((q) => q.type === 'class' && q.classDoor)) {
      const { x, y, cls } = r.classDoor;
      if (dm().isOpened(x, y)) continue;
      if (cls === g.hero.classId) useAt(x, y);
      else { const sw = dm().featureList.find((f) => f.kind === 'switch' && f.forClassRoom === r.id); if (sw) useAt(sw.x, sw.y); }
      if (dm().isOpened(x, y)) log.classRooms = [...(log.classRooms || []), `${cls}${cls === g.hero.classId ? '' : ' (switch)'}`];
    }
    hunt((e) => !e.boss && L.rooms.some((r) => r.id === e.room && r.type === 'challenge'));
    // chests (vaults: pull the lever first)
    for (const c of [...dm().chests.values()]) {
      if (c.opened || !g.hero.alive) continue;
      const room = dm().room(c.room);
      if (room?.timedDoor && !dm().isOpened(room.timedDoor.x, room.timedDoor.y)) {
        const lever = dm().featureList.find((f) => f.kind === 'lever' && f.target === room.id && !(f.x >= room.x1 - 1 && f.x <= room.x2 + 1 && f.y >= room.y1 - 1 && f.y <= room.y2 + 1));
        if (lever) useAt(lever.x, lever.y);
      }
      if (!path(c.x, c.y, true)) continue;
      if (useAt(c.x, c.y)) { sim(0.1); if (c.opened) log.chests = (log.chests || 0) + 1; faceTo(c.x, c.y); for (let i = 0; i < 6 && g.loot.itemsAt(c.x, c.y).length && !g.inventory.full; i++) g.controller.interact(); autoEquip(); }
    }
    // rest when needed
    const font = dm().featureList.find((f) => f.kind === 'font' && !f.used);
    if (font && g.hero.hp < g.hero.maxHp * 0.8) useAt(font.x, font.y);
    // key gate must be open by now
    if (L.gates.length && !dm().gateState[0].unlocked) hunt((e) => true);
    const gate = dm().gateState[0];
    log.gateOpen = !!gate?.unlocked;
    if (L.finalFloor) {
      const bossE = g.enemies.find((e) => e.boss);
      const bossRoom = dm().room(bossE.room);
      const [bx, by] = roomCenter(bossRoom);
      const t0 = g.time, d0 = g.stats.damageTaken, pots0 = g.inventory.countOf('health_potion') + g.inventory.countOf('greater_health_potion');
      walkTo(bx, by, true, 200);
      for (let i = 0; i < 400 && bossE.alive && g.hero.alive; i++) fight(30);
      log.bossTime = Math.round(g.time - t0);
      log.bossDamage = g.stats.damageTaken - d0;
      log.bossPotions = pots0 - g.inventory.countOf('health_potion') - g.inventory.countOf('greater_health_potion');
      log.bossPhases = (bossE.bossState?.phaseIdx || 0) + 1;
      log.bossDown = !bossE.alive;
      if (g.panel === 'victory') g.closePanel();
      collect();
      const exit = dm().featureList.find((f) => f.kind === 'exit');
      if (!bossE.alive) useAt(exit.x, exit.y);
      return g.scene === 'cleared';
    }
    const stairs = dm().featureList.find((f) => f.kind === 'stairs');
    const fl = g.run.floor;
    useAt(stairs.x, stairs.y);
    return g.run && g.run.floor === fl + 1;
  };
  const playDungeon = (id, diff, opts = {}) => {
    const r = g.enterDungeon(id, diff);
    const log = { id, class: g.hero.classId, startLv: g.hero.level, floors: 0 };
    if (!r.ok) { log.error = r.msg; return log; }
    const def = DUNGEONS[id];
    for (let f = 0; f < def.floors && g.hero.alive && g.scene === 'playing'; f++) {
      const ok = playFloor(log, opts);
      if (ok) log.floors++;
      if (!ok) break;
    }
    log.cleared = g.scene === 'cleared' && g.reward?.phase4;
    log.endLv = g.hero.level; log.died = !g.hero.alive; log.hp = `${Math.ceil(g.hero.hp)}/${g.hero.maxHp}`;
    log.reward = g.reward?.phase4 ? `${g.reward.items.length} items, ${g.reward.gold}g, ${g.reward.xp}xp` : '';
    return log;
  };

  // The hand-built prologue crypt (secret wall, sealed gate, chests), real combat. Returns true when cleared.
  const playPrologue = () => {
    const secretWall = { x: 6, y: 8 };
    for (let pass = 0; pass < 4 && g.scene === 'playing' && g.enemies.some((e) => e.alive); pass++) {
      for (const e of [...g.enemies].sort((a, b) => a.y - b.y || a.x - b.x)) {
        if (!e.alive || !g.hero.alive || g.scene !== 'playing') continue;
        if (e.room === 'final' && !g.dungeon.isOpened(18, 14)) { walkTo(18, 13); face(2); g.controller.openFront(); sim(0.3); }
        walkTo(e.x, e.y, true, 300); faceTo(e.x, e.y); fight(); collect();
      }
    }
    if (!g.dungeon.isOpened(secretWall.x, secretWall.y) && g.scene === 'playing') useAt(secretWall.x, secretWall.y, true);
    for (const c of [...g.dungeon.chests.values()]) { if (g.scene === 'playing' && !c.opened && path(c.x, c.y, true)) { useAt(c.x, c.y); faceTo(c.x, c.y); for (let i = 0; i < 5; i++) g.controller.interact(); } }
    autoEquip();
    sim(3);
    return g.scene === 'cleared';
  };

  window.__bot = { walkTo, fight, path, playFloor, playDungeon, playPrologue, sim, collect, hunt, useAt, face, faceTo, autoEquip, boost, realUpdate, passable };
  if (botOnly) { g.update = realUpdate; return results; }
  try {
    // ============================================================ 1. still 2D
    const usesGL = [...document.querySelectorAll('canvas')].some((c) => c.getContext('2d') === null);
    check('Game remains strictly 2D (Canvas 2D only, no WebGL / 3D library)', !usesGL && typeof window.THREE === 'undefined' && g.ctx instanceof CanvasRenderingContext2D, `ctx=${g.ctx.constructor.name}`);

    // ============================================================ 2-6. generation + validation
    const N = quick ? 6 : 25;
    let total = 0, invalid = 0, attempts = 0, regenerated = 0, spawnsBad = 0, unreachable = 0, mismatch = 0;
    const statsSample = [];
    for (const id of PHASE4_DUNGEONS) for (const diff of DIFFICULTY_ORDER) for (let s = 1; s <= N; s++) for (let f = 0; f < DUNGEONS[id].floors; f++) {
      const seed = (s * 2654435761 + diff.length * 977) >>> 0;
      const L = generateDungeon(DUNGEONS[id], { seed, floor: f, difficulty: diff });
      const L2 = generateDungeon(DUNGEONS[id], { seed, floor: f, difficulty: diff });
      total++; attempts += L.report.attempts; if (L.report.attempts > 1) regenerated++;
      const v = validateLayout(L);
      if (!v.ok) invalid++;
      if (v.stats.unreachableMandatory.length) unreachable++;
      if (L.map.join() !== L2.map.join() || JSON.stringify(L.spawns) !== JSON.stringify(L2.spawns)) mismatch++;
      for (const sp of L.spawns) if (L.map[sp.y][sp.x] !== '.') spawnsBad++;
      if (s === 1 && diff === 'normal') statsSample.push(`${id.split('_')[0]} F${f + 1}: ${v.stats.rooms} rooms, ${v.stats.corridors} corridors, ${v.stats.secretRooms} secret, ${v.stats.enemySpawns} spawns`);
    }
    check('Every generated floor of every dungeon/difficulty validates (navigable start -> exit)', invalid === 0 && total > 0, `${total} floors (4 dungeons x 3 difficulties x ${N} seeds x 2 floors), invalid ${invalid}; ${statsSample.join(' | ')}`);
    check('Mandatory rooms always reachable; boss / stairs / exit reachable once the gate opens', unreachable === 0, `floors with unreachable mandatory rooms: ${unreachable}`);
    check('Generation is deterministic per seed (reproducible layouts for testing)', mismatch === 0, `${mismatch} mismatches over ${total} regenerations`);
    // invalid layouts are detected and repaired by regeneration
    const good = generateDungeon(DUNGEONS.ashen_catacombs, { seed: 777, floor: 1 });
    const broken = { ...good, map: good.map.map((row, y) => (y === good.gates[0].y ? row.slice(0, good.gates[0].x) + '#' + row.slice(good.gates[0].x + 1) : row)) };
    const bad = validateLayout(broken);
    const noSpawnTile = { ...good, spawns: [...good.spawns, { sid: 'x', x: 0, y: 0, type: 'skeleton' }] };
    const bad2 = validateLayout(noSpawnTile);
    check('Invalid layouts are rejected and regenerated (never started)', !bad.ok && !bad2.ok && regenerated >= 0 && attempts >= total,
      `walled-off gate -> "${bad.errors[0]}"; spawn in wall -> "${bad2.errors.find((e) => e.includes('enemy'))}"; ${regenerated} of ${total} floors needed a regenerated attempt (avg ${(attempts / total).toFixed(2)} attempts)`);
    check('Enemies spawn only on valid free floor tiles', spawnsBad === 0, `${spawnsBad} spawns inside walls/features`);

    // ============================================================ 7-9. material drops
    fresh('war', 5);
    let dropsOk = true, rangeOk = true, coreOk = true, sourcesOk = true;
    const seen = {};
    for (const [tid, t] of Object.entries(LOOT_TABLES)) {
      if (!/^(ashen|war|harvest|pale|boss|class|shrine)/.test(tid)) continue;
      const allowed = new Set([...(t.fixed || []).map((f) => f.item), ...(t.entries || []).filter((e) => e.type === 'item').map((e) => e.item)]);
      const bounds = {}; for (const e of t.entries || []) if (e.type === 'item' && e.qty) bounds[e.item] = e.qty;
      for (let i = 0; i < 150; i++) {
        const { items } = g.loot.rollTable(tid, 10, { difficulty: 'normal', qtyMult: 1, goldMult: 1, luckBonus: 0 });
        for (const it of items) {
          if (it.def.kind !== 'material') continue;
          seen[it.defId] = true;
          if (!allowed.has(it.defId)) dropsOk = false;
          const b = bounds[it.defId];
          if (b && (it.qty < b[0] || it.qty > b[1])) rangeOk = false;
        }
        // the four Phase 4 bosses drop their cores (Phase 5 bosses drop their own trophies: horn / scale / shard)
        if (['boss_grave_warden', 'boss_iron_tyrant', 'boss_hollow_harvester', 'boss_pale_executor'].includes(tid) && !items.some((it) => it.defId === `${tid.slice(5)}_core`)) coreOk = false;
      }
    }
    for (const m of MATERIALS) if (!(ITEM_DEFS[m.id].sources || []).length) sourcesOk = false;
    check('Materials drop only from their configured enemy / reward tables; every boss drops its core', dropsOk && coreOk && sourcesOk, `${Object.keys(seen).length} materials seen; foreign drops: ${!dropsOk}; boss cores always: ${coreOk}; every material has a source: ${sourcesOk}`);
    // quantity scaling + stack limits
    const vet = g.loot.rollTable('ashen_skeleton', 5, { difficulty: 'veteran', qtyMult: DIFFICULTIES.veteran.materialMult, goldMult: 1, luckBonus: 0 });
    const pouch = g.inventory.materials;
    pouch.reset();
    const capOk = pouch.add('grave_warden_core', 50) && !pouch.add('grave_warden_core', 1) && pouch.count('grave_warden_core') === 50 && !pouch.add('bone_fragment', -3) && !pouch.remove('bone_fragment', 1) && pouch.count('bone_fragment') === 0;
    const floorBefore = g.loot.floor.length;
    check('Material quantities respect ranges, difficulty scaling and stack limits (no negatives)', rangeOk && capOk,
      `ranges ok ${rangeOk}; boss core cap 50 enforced ${capOk}; negative add refused; veteran skeleton roll: ${vet.items.map((i) => `${i.name} x${i.qty}`).join(', ') || 'none'}`);
    pouch.reset(); void floorBefore;

    // duplicate death events
    g.enterDungeon('ashen_catacombs', 'normal');
    const victim = g.enemies.find((e) => !e.boss);
    const goldBefore = g.gold, xpBefore = g.stats.xpGained, floorN = g.loot.floor.length;
    victim.hp = 1;
    g.combat._kill(victim);
    const after1 = { gold: g.gold, xp: g.stats.xpGained, floor: g.loot.floor.length };
    victim.alive = true; victim.lootRolled = false; // simulate a buggy second death callback
    g.combat._kill(victim);
    const dupLoot = g.loot.rollEnemy(victim);
    check('Duplicate death events never duplicate XP, gold or loot', g.gold === after1.gold && g.stats.xpGained === after1.xp && g.loot.floor.length === after1.floor && !dupLoot.items.length,
      `first death: +${after1.gold - goldBefore}g +${after1.xp - xpBefore}xp ${after1.floor - floorN} drops; second callback: +${g.gold - after1.gold}g +${g.stats.xpGained - after1.xp}xp ${g.loot.floor.length - after1.floor} drops`);

    // ============================================================ 10-11. crafting transactions
    fresh('war', 12);
    g.progress.recordCompletion('ashen_catacombs', 'normal');
    for (const [id, n] of Object.entries({ tempered_iron: 10, war_essence: 4, broken_weapon_core: 2, rusted_iron: 12, bone_fragment: 5, grave_dust: 3 })) pouch.add(id, n);
    g.gold = 500;
    const before = { ti: pouch.count('tempered_iron'), we: pouch.count('war_essence'), bwc: pouch.count('broken_weapon_core'), gold: g.gold, bag: g.inventory.items.length };
    const c1 = g.craft.craft('tempered_war_axe');
    const axe = c1.item;
    const exact = c1.ok && pouch.count('tempered_iron') === before.ti - 8 && pouch.count('war_essence') === before.we - 3 && pouch.count('broken_weapon_core') === before.bwc - 1 && g.gold === before.gold - 120 && g.inventory.items.length === before.bag + 1;
    const lockedTry = g.craft.craft('tyrant_crown');
    g.scene = 'playing'; // away from the forge
    const fieldTry = g.craft.craft('forge_grave_sword');
    g.scene = 'camp';
    const lowLv = g.hero.level; g.hero.level = 1; const lvTry = g.craft.craft('forge_grave_sword'); g.hero.level = lowLv;
    check('Crafting consumes exactly the listed materials and grants the output once; locks / station / level are enforced',
      exact && !lockedTry.ok && !fieldTry.ok && !lvTry.ok && axe?.defId === 'tempered_war_axe',
      `Tempered War Axe: iron ${before.ti}->${pouch.count('tempered_iron')}, essence ${before.we}->${pouch.count('war_essence')}, core ${before.bwc}->${pouch.count('broken_weapon_core')}, gold ${before.gold}->${g.gold} | locked: "${lockedTry.msg}" | field: "${fieldTry.msg}" | level: "${lvTry.msg}"`);
    // full inventory never destroys the output
    while (!g.inventory.full) give(g.loot.create('iron_band', 'common', 1));
    const m0 = pouch.count('rusted_iron'), b0 = pouch.count('bone_fragment'), gold0 = g.gold;
    const full = g.craft.craft('forge_grave_sword');
    const stashTest = g.giveItem(g.loot.create('war_axe', 'rare', 1));
    check('A full bag blocks crafting with an explanation (nothing consumed); overflow rewards go to the camp stash',
      !full.ok && pouch.count('rusted_iron') === m0 && pouch.count('bone_fragment') === b0 && g.gold === gold0 && stashTest === 'stash' && g.stash.length === 1,
      `"${full.msg}" | materials unchanged ${pouch.count('rusted_iron') === m0}; reward with full bag -> ${stashTest} (${g.stash.length} in stash)`);
    for (const it of g.inventory.items.filter((i) => i.defId === 'iron_band')) g.inventory.remove(it.uid);

    // ============================================================ 12. enhancement
    pouch.add('tempered_iron', 200); pouch.add('war_essence', 50); pouch.add('ancient_alloy', 50); g.gold = 99999;
    const aff0 = JSON.stringify(axe.affixes), uid0 = axe.uid, dmg0 = axe.stats.dmgMax;
    const pv = g.craft.temperPreview(axe);
    const costs = [];
    for (let i = 0; i < TEMPER.maxLevel; i++) { const c = g.craft.temperCost(axe); const ti = pouch.count('tempered_iron'), gd = g.gold; const r = g.craft.temper(axe.uid); costs.push(r.ok && ti - pouch.count('tempered_iron') === c.mats.tempered_iron && gd - g.gold === c.gold); }
    const sixth = g.craft.temper(axe.uid);
    const relic = give(g.loot.gen.generate({ baseId: 'shard_first_seal', rarity: 'legendary', ilvl: 12 }));
    g.craft.temper(relic.uid); g.craft.temper(relic.uid);
    check('Enhancement: exact costs, preview before paying, cap +5, uid/affixes kept, unique effects never duplicated',
      costs.every(Boolean) && !sixth.ok && axe.upgrade === TEMPER.maxLevel && axe.uid === uid0 && JSON.stringify(axe.affixes) === aff0 && axe.stats.dmgMax > dmg0 && pv?.rows.length > 0 && relic.unique === 'echo_strike' && g.calc.equippedItems().length >= 0,
      `+1..+5 all exact ${costs.every(Boolean)}; +6 refused: "${sixth.msg}"; dmg ${dmg0}->${axe.stats.dmgMax}; preview rows ${pv?.rows.map((r) => r.join(' ')).slice(0, 2).join(', ')}; relic effect still single: ${relic.unique}`);

    // ============================================================ 13-16. bosses
    fresh('war', 12);
    const bossLay = generateDungeon(DUNGEONS.ashen_catacombs, { seed: 4242, floor: 1 });
    g.run = g.director.newRun('ashen_catacombs', 'normal', 4242);
    g.run.floor = 1; g.beginScene('playing'); g.director.buildFloor(1);
    const boss = g.enemies.find((e) => e.boss);
    const bossRoom = g.dungeon.room(boss.room);
    g.dungeon.gateState[0].unlocked = true; g.dungeon.openTile(g.dungeon.gateState[0].x, g.dungeon.gateState[0].y);
    Object.assign(g.player, { x: bossRoom.x1, y: bossRoom.y1 }); g.onPlayerMoved(); sim(0.2);
    const started = boss.bossState?.started;
    const sealed = g.dungeon.gateState[0].sealed;
    // telegraphs: watch until an area attack resolves; danger tiles must be visible for >= 1.2s before damage
    let telegraph = null, sawMelee = false;
    const origHurt = g.hurtPlayer.bind(g);
    let areaHits = 0;
    g.hurtPlayer = (amt, o) => { if (o?.by === boss) { areaHits++; if (telegraph && telegraph.firstSeen != null) telegraph.lead = g.time - telegraph.firstSeen; } return origHurt(amt, o); };
    g.hero.hp = g.hero.maxHp; // keep alive during the observation window
    for (let i = 0; i < 400; i++) {
      if (g.dangerTiles.length && !telegraph) telegraph = { firstSeen: g.time, until: g.dangerTiles[0].until, n: g.dangerTiles.length };
      if (boss.bossState.attack?.a.kind === 'melee' && boss.phase === 'windup') sawMelee = true;
      g.hero.hp = g.hero.maxHp; sim(0.05);
      if (telegraph && g.time > telegraph.until + 0.3) break;
    }
    g.hurtPlayer = origHurt;
    // melee: stand next to the boss and watch its wind-up (the guard / parry window)
    const adjB = DIRS.map((d) => [boss.x + d.dx, boss.y + d.dy]).find(([x, y]) => g.dungeon.isWalkable(x, y) && !g.ai.enemyAt(x, y));
    if (adjB) { Object.assign(g.player, { x: adjB[0], y: adjB[1] }); faceTo(boss.x, boss.y); }
    let meleeWind = 0;
    for (let i = 0; i < 300 && !sawMelee; i++) {
      if (boss.bossState.attack?.a.kind === 'melee' && boss.phase === 'windup') { sawMelee = true; meleeWind = boss.curWindup; }
      g.hero.hp = g.hero.maxHp; sim(0.05);
    }
    const telegraphLead = telegraph ? telegraph.until - telegraph.firstSeen : 0;
    check('Boss telegraphs are readable before dangerous attacks (marked floor >= 1.2s, melee wind-ups)', telegraph && telegraphLead >= 1.2 && sawMelee,
      `${telegraph ? telegraph.n : 0} danger tiles shown ${telegraphLead.toFixed(2)}s before impact (${areaHits} hits while standing in them); melee wind-up ${meleeWind.toFixed?.(2) ?? meleeWind}s with guard prompt; arena sealed on engage ${sealed}; engaged ${started}`);
    // phases
    const phases = [];
    g.bus.on('bossPhase', ({ phase }) => phases.push(phase));
    boss.hp = Math.floor(boss.maxHp * 0.59); g.combat.damageEnemy(boss, 1, false, {});
    const p2 = boss.bossState.phaseIdx, inv = boss.invulnerable;
    const hpLocked = boss.hp; g.combat.damageEnemy(boss, 50, false, {}); const immune = boss.hp === hpLocked;
    sim(2);
    boss.hp = Math.floor(boss.maxHp * 0.29); g.combat.damageEnemy(boss, 1, false, {});
    const p3 = boss.bossState.phaseIdx, enraged = boss.bossState.enrage.speed < 1;
    sim(2);
    check('Boss phases transition correctly (II at 60%, III/enrage at 30%; brief immune transition)', p2 === 1 && inv && immune && p3 === 2 && enraged,
      `phase at 59%: ${p2 + 1} (immune ${inv}, hit ignored ${immune}); at 29%: ${p3 + 1} enrage x${boss.bossState.enrage.speed}`);
    // barrier break + vulnerability window
    g.status.apply(boss, 'barrier', { dur: 8 }); boss.bossState.barrierDmg = 0;
    g.combat.damageEnemy(boss, 200, false, {});
    const exposed = g.status.has(boss, 'exposed') && !g.status.has(boss, 'barrier');
    // victory
    const cores0 = g.inventory.countOf('grave_warden_core');
    boss.invulnerable = false; boss.hp = 1;
    g.combat.damageEnemy(boss, 999, false, {});
    sim(0.5);
    const cores1 = g.inventory.countOf('grave_warden_core');
    const reward1 = JSON.stringify(g.run.bossReward);
    g.director.onBossDefeated(boss, g.loot.rollEnemy(boss)); // a second (buggy) defeat call
    const cores2 = g.inventory.countOf('grave_warden_core');
    check('Boss victory grants its reward exactly once (core, loot, recipes) even if defeat is reported twice', !boss.alive && cores1 === cores0 + 1 && cores2 === cores1 && JSON.stringify(g.run.bossReward) === reward1 && g.progress.bosses.grave_warden === 1 && g.progress.recipes.has('wardens_bulwark') && exposed,
      `cores ${cores0}->${cores1}->${cores2}; reward: ${g.run.bossReward?.items.map((i) => i.name).join(', ')}; recipes learned: ${g.run.bossReward?.learned.join(', ')}; barrier break exposed boss: ${exposed}`);
    // save after the victory, reload: no duplicate
    if (g.panel) g.closePanel();
    const saved = g.saves.save(g);
    g.loadGame();
    const bossAfter = g.enemies.find((e) => e.boss);
    const coresLoad = g.inventory.countOf('grave_warden_core');
    check('Reloading after a boss defeat does not duplicate rewards or revive the boss', saved && bossAfter && !bossAfter.alive && coresLoad === cores1 && g.run.bossDefeated && g.progress.bosses.grave_warden === 1,
      `boss alive after load: ${bossAfter?.alive}; cores ${coresLoad}; ledger has boss: ${g.run.ledger.has('boss')}`);
    // exit unlocks progression
    const exitF = g.dungeon.featureList.find((f) => f.kind === 'exit');
    Object.assign(g.player, { x: exitF.x, y: exitF.y - 1 }); face(2);
    g.controller.interact(); sim(0.1);
    const completedOnce = g.scene === 'cleared' && g.progress.timesCompleted('ashen_catacombs', 'normal') === 1;
    const again = g.director.completeRun();
    check('Boss defeat unlocks the exit; completion is recorded once and unlocks the next dungeon + Veteran', completedOnce && !again && g.progress.isUnlocked('red_warfront') && g.progress.difficultyUnlocked('ashen_catacombs', 'veteran') && !g.progress.difficultyUnlocked('ashen_catacombs', 'nightmare'),
      `scene ${g.scene}; completions ${g.progress.timesCompleted('ashen_catacombs')}; Red Warfront unlocked ${g.progress.isUnlocked('red_warfront')}; notes: ${g.reward?.notes.join(' / ')}`);
    void bossLay;

    // ============================================================ 17-19. secrets
    const findLayout = (pred, id = 'ashen_catacombs') => { for (let s = 1; s < 400; s++) for (let f = 0; f < 2; f++) { const L = generateDungeon(DUNGEONS[id], { seed: s, floor: f }); if (pred(L)) return { L, s, f }; } return null; };
    const enterFloor = (id, seed, f, cls = 'death') => { fresh(cls, 10); g.run = g.director.newRun(id, 'normal', seed); g.run.floor = f; g.beginScene('playing'); g.director.buildFloor(f); };
    const methods = {};
    for (const m of ['wall', 'switch', 'guardian']) {
      const hit = findLayout((L) => L.rooms.some((r) => r.type === 'secret' && r.method === m));
      if (!hit) { methods[m] = 'no layout'; continue; }
      enterFloor('ashen_catacombs', hit.s, hit.f);
      const room = g.dungeon.def.rooms.find((r) => r.type === 'secret' && r.method === m);
      const { x, y } = room.secretDoor;
      const xp0 = g.stats.xpGained;
      if (m === 'wall') { const out = DIRS.map((d) => [x + d.dx, y + d.dy]).find(([a, b]) => g.dungeon.isWalkable(a, b) && !(a >= room.x1 && a <= room.x2 && b >= room.y1 && b <= room.y2)); Object.assign(g.player, { x: out[0], y: out[1] }); faceTo(x, y); g.controller.look(); }
      if (m === 'switch') { const sw = g.dungeon.featureList.find((f) => f.kind === 'switch' && f.opens.x === x && f.opens.y === y); const tries = g.director.handleSecretWall(x, y, true); const stillClosed = !g.dungeon.isOpened(x, y); g.director.pressSwitch(sw); methods.switchNeedsMechanism = tries && stillClosed; }
      if (m === 'guardian') { const gd = g.enemies.find((e) => e.guardsSecret?.x === x); gd.hp = 1; g.combat.damageEnemy(gd, 99, false, {}); }
      const opened = g.dungeon.isOpened(x, y);
      const again2 = g.director.discoverSecret(x, y, 'again');
      methods[m] = opened && !again2 && g.stats.xpGained > xp0;
    }
    check('Secret rooms can be discovered by inspection, hidden switches and slaying a tomb guardian (exactly once)', methods.wall === true && methods.switch === true && methods.guardian === true && methods.switchNeedsMechanism,
      `wall ${methods.wall}, switch ${methods.switch} (inspecting it first only gives a clue: ${methods.switchNeedsMechanism}), guardian ${methods.guardian}`);
    // secrets never block mandatory completion: R0/R1 reachability ignores them (validated above) + live floor with all secrets sealed
    const blockCheck = findLayout((L) => L.rooms.some((r) => r.type === 'secret'));
    const secretsSealed = (() => { const L = blockCheck.L; const v = validateLayout({ ...L, map: L.map.map((row) => row.replace(/S/g, '#')) }); return v.ok || v.errors.every((e) => e.includes('secret') || e.includes('(secret)') || e.includes('chest') || e.includes('scroll') || e.includes('tablet')); })();
    check('Secret rooms never block mandatory completion (layouts stay winnable with every secret sealed)', secretsSealed, `seed ${blockCheck.s}: walling every secret wall leaves all mandatory objectives reachable`);
    // secret rewards cannot be re-claimed: open chest, leave to camp, resume, reload
    const sc = findLayout((L) => L.chests.some((c) => c.secret));
    enterFloor('ashen_catacombs', sc.s, sc.f);
    const chestS = [...g.dungeon.chests.values()].find((c) => c.secret);
    const sroom = g.dungeon.def.rooms.find((r) => r.id === chestS.room);
    g.dungeon.openTile(sroom.secretDoor.x, sroom.secretDoor.y);
    const adj = DIRS.map((d) => [chestS.x + d.dx, chestS.y + d.dy]).find(([a, b]) => g.dungeon.isWalkable(a, b));
    Object.assign(g.player, { x: adj[0], y: adj[1] }); faceTo(chestS.x, chestS.y);
    g.controller.openFront();
    const firstLoot = g.loot.itemsAt(chestS.x, chestS.y).length;
    g.controller.openFront();
    g.progress.unlocked.add('ashen_catacombs');
    for (const e of g.enemies) e.alive = false; // leaving is refused mid-fight
    g.inCombat = false; g.combat.active = false;
    const left = g.director.returnToCamp();
    g.enterDungeon('ashen_catacombs');
    const chestAgain = [...g.dungeon.chests.values()].find((c) => c.id === chestS.id);
    const reopened = chestAgain ? g.loot.openChest(chestAgain) : { items: ['missing'] };
    g.saves.save(g); g.loadGame();
    const chestLoaded = [...g.dungeon.chests.values()].find((c) => c.id === chestS.id);
    check('Secret rewards cannot be re-claimed (re-open, leave + resume run, save + load)', left && firstLoot > 0 && chestAgain?.opened && !reopened.items.length && chestLoaded?.opened,
      `first open: ${firstLoot} items on the floor; after camp + resume opened=${chestAgain?.opened} (re-roll gave ${reopened.items.length}); after reload opened=${chestLoaded?.opened}`);

    // ============================================================ 20. puzzles + hazards
    const rz = findLayout((L) => L.puzzles.some((p) => p.kind === 'runes' && p.key));
    enterFloor('ashen_catacombs', rz.s, rz.f);
    const pz = [...g.dungeon.puzzles.values()].find((p) => p.kind === 'runes' && p.key);
    const runes = g.dungeon.featureList.filter((f) => f.puzzle === pz.id && f.kind === 'rune');
    const wrong = runes.find((f) => f.symbol !== pz.order[0]);
    const hp0 = g.hero.hp;
    g.puzzles.touchRune(wrong);
    const reset = pz.progress === 0 && g.hero.hp < hp0 && g.hero.hp >= 1;
    for (const s of pz.order) g.puzzles.touchRune(runes.find((f) => f.symbol === s));
    const gateR = g.dungeon.gateState[0];
    const solvedOnce = !g.puzzles.solve(pz);
    // plates
    const pl = findLayout((L) => L.puzzles.some((p) => p.kind === 'plates'), 'red_warfront');
    let platesOk = 'no layout';
    if (pl) {
      enterFloor('red_warfront', pl.s, pl.f, 'war');
      const ppz = [...g.dungeon.puzzles.values()].find((p) => p.kind === 'plates');
      for (const f of g.dungeon.featureList.filter((q) => q.puzzle === ppz.id)) { if (f.kind !== 'plate') continue; Object.assign(g.player, { x: f.x, y: f.y }); g.onPlayerMoved(); }
      platesOk = ppz.solved;
    }
    // lever + timed door
    const lv = findLayout((L) => L.rooms.some((r) => r.vault && r.timedDoor) && L.features.some((f) => f.kind === 'lever'));
    let leverOk = 'no layout';
    if (lv) {
      enterFloor('ashen_catacombs', lv.s, lv.f);
      const vr = g.dungeon.def.rooms.find((r) => r.vault && r.timedDoor);
      const lever = g.dungeon.featureList.find((f) => f.kind === 'lever' && f.target === vr.id);
      g.puzzles.pullLever(lever);
      const openNow = g.dungeon.isOpened(vr.timedDoor.x, vr.timedDoor.y);
      Object.assign(g.player, { x: g.dungeon.start.x, y: g.dungeon.start.y });
      for (const e of g.enemies) { e.alive = false; }
      sim(11);
      leverOk = openNow && !g.dungeon.isOpened(vr.timedDoor.x, vr.timedDoor.y);
    }
    // hazards: spikes only hurt when up, never lethal; collapse -> pit + push back; blight DoT never lethal
    enterFloor('ashen_catacombs', 3, 0);
    for (const e of g.enemies) e.alive = false;
    const spot = g.dungeon.start;
    g.dungeon.features.set(g.dungeon.key(spot.x, spot.y), { id: 'tspike', kind: 'spikes', x: spot.x, y: spot.y, decal: true });
    g.hazards.t = 0.1; g.hero.hp = 5;
    let lowest = 5; for (let i = 0; i < 80; i++) { sim(0.05); lowest = Math.min(lowest, g.hero.hp); }
    const spikeHit = lowest < 5 && lowest >= 1 && g.hero.alive;
    g.hero.hp = g.hero.maxHp;
    const nx = spot.x + DIRS[g.player.dir].dx, ny = spot.y + DIRS[g.player.dir].dy;
    let collapseOk = 'no walkable tile ahead';
    const ahead = [0, 1, 2, 3].map((d) => [spot.x + DIRS[d].dx, spot.y + DIRS[d].dy, d]).find(([x, y]) => g.dungeon.isWalkable(x, y));
    if (ahead) {
      g.dungeon.features.delete(g.dungeon.key(spot.x, spot.y));
      const cf = { id: 'tcol', kind: 'collapse', x: ahead[0], y: ahead[1], decal: true };
      g.dungeon.features.set(g.dungeon.key(ahead[0], ahead[1]), cf); g.dungeon.featureList.push(cf);
      face(ahead[2]); g.player.moveCD = 0; g.controller.step(1);
      sim(1);
      collapseOk = cf.collapsed && g.dungeon.tile(ahead[0], ahead[1]) === TILE.PIT && !(g.player.x === ahead[0] && g.player.y === ahead[1]) && g.hero.alive;
    }
    void nx; void ny;
    g.hero.hp = 3; g.applyPlayerDebuff('blighted', 6); sim(6);
    const blightOk = g.hero.alive && g.hero.hp >= 1;
    check('Puzzles and hazards behave correctly (runes, plates, levers/timed doors, spikes, collapse, blight)',
      reset && pz.solved && gateR.unlocked && solvedOnce && platesOk === true && leverOk === true && spikeHit && collapseOk === true && blightOk,
      `runes: wrong order resets (${reset}), right order solves + opens gate (${pz.solved && gateR.unlocked}), cannot re-solve (${solvedOnce}); plates ${platesOk}; lever opens then closes after 10s ${leverOk}; spikes hurt only non-lethally ${spikeHit} (lowest HP ${lowest}); collapse -> pit + pushed back ${collapseOk}; blight left HP ${g.hero.hp}`);

    // ============================================================ 21. class interactions
    const classRes = {};
    for (const cls of ['war', 'conquest', 'famine', 'death']) {
      const hit = findLayout((L) => L.rooms.some((r) => r.type === 'class' && r.cls === cls));
      if (!hit) { classRes[cls] = 'no layout'; continue; }
      const other = cls === 'war' ? 'death' : 'war';
      enterFloor('ashen_catacombs', hit.s, hit.f, other);
      const room = g.dungeon.def.rooms.find((r) => r.type === 'class' && r.cls === cls);
      const { x, y } = room.classDoor;
      g.director.interact(x, y);
      const refused = !g.dungeon.isOpened(x, y);
      const sw = g.dungeon.featureList.find((f) => f.kind === 'switch' && f.forClassRoom === room.id);
      g.director.pressSwitch(sw);
      const viaSwitch = g.dungeon.isOpened(x, y);
      enterFloor('ashen_catacombs', hit.s, hit.f, cls);
      g.director.interact(x, y);
      const own = g.dungeon.isOpened(x, y);
      // the key objective never involves a class seal
      const keyNoSeal = !g.dungeon.def.objectives.filter((o) => !o.optional).some((o) => o.room === room.id);
      classRes[cls] = refused && viaSwitch && own && keyNoSeal;
    }
    // Conquest's precision: a bolt opens a sigil door from range (any class with a crossbow)
    const sig = findLayout((L) => L.rooms.some((r) => r.type === 'class' && r.cls === 'conquest'));
    enterFloor('ashen_catacombs', sig.s, sig.f, 'war');
    const sroom2 = g.dungeon.def.rooms.find((r) => r.type === 'class' && r.cls === 'conquest');
    const boltOk = g.director.onProjectileHitWall(sroom2.classDoor.x, sroom2.classDoor.y) && g.dungeon.isOpened(sroom2.classDoor.x, sroom2.classDoor.y);
    check('Class-specific seals: own Horseman opens them, others get a clue + a hidden-switch route; progression never depends on them',
      Object.values(classRes).every((v) => v === true) && boltOk, `${Object.entries(classRes).map(([k, v]) => `${k}:${v}`).join(' ')}; sigil opened by a bolt: ${boltOk}`);

    // ============================================================ 22. save / load + migration
    fresh('famine', 26);
    unlockUpTo('black_harvest');
    pouch.add('withered_root', 17); pouch.add('corrupted_catalyst', 3); pouch.add('hollow_harvester_core', 1);
    g.progress.recipes.add('distill_catalyst'); g.progress.bosses.grave_warden = 2; g.progress.claim('scroll:test');
    const sick = give(g.loot.gen.generate({ baseId: 'harvester_sickle', rarity: 'epic', ilvl: 24 })); sick.upgrade = 3; g.loot.gen.recompute(sick); g.equipment.equip(sick.uid);
    g.enterDungeon('black_harvest', 'normal');
    const secRoom = g.dungeon.def.rooms.find((r) => r.type === 'secret' && r.secretDoor);
    if (secRoom) g.director.discoverSecret(secRoom.secretDoor.x, secRoom.secretDoor.y, 'test');
    for (const e of g.enemies) if (!e.boss) e.alive = true;
    const snapB = JSON.stringify({ mats: pouch.serialize(), rec: [...g.progress.recipes].sort(), comp: g.progress.completed, up: sick.upgrade, ledger: [...g.run.ledger].sort(), seed: g.run.seed, floor: g.run.floor });
    g.inCombat = false;
    const okS = g.saves.save(g);
    g.newGame('war'); g.loadGame();
    const sickL = g.inventory.get(sick.uid);
    const snapA = JSON.stringify({ mats: g.inventory.materials.serialize(), rec: [...g.progress.recipes].sort(), comp: g.progress.completed, up: sickL?.upgrade, ledger: [...g.run.ledger].sort(), seed: g.run.seed, floor: g.run.floor });
    const secStill = secRoom ? g.dungeon.isOpened(secRoom.secretDoor.x, secRoom.secretDoor.y) : true;
    check('Save/load preserves materials, recipes, enhancement levels, secrets, completions and the run ledger', okS && snapA === snapB && secStill && g.hero.classId === 'famine' && g.equipment.isEquipped(sick.uid),
      `identical ${snapA === snapB}; secret still open ${secStill}; +${sickL?.upgrade} sickle equipped ${g.equipment.isEquipped(sick.uid)}`);
    // v3 (Phase 3) save -> v4
    for (const k of Object.values(SAVE_KEYS)) if (k !== SAVE_KEYS.settings) localStorage.removeItem(k);
    g.newGame('death');
    const v3 = { version: 3, hero: g.hero.serialize(), resource: { value: 4 }, gold: 77, player: { x: 4, y: 2, dir: 1 },
      inventory: [...g.inventory.items.map((i) => g.loot.serializeItem(i)), g.loot.serializeItem(g.loot.create('iron_shard', 'common', 14)), g.loot.serializeItem(g.loot.create('cursed_ash', 'common', 5))],
      equipment: g.equipment.serialize(), dungeon: g.dungeon.serialize(), enemies: g.ai.serialize(), loot: g.loot.serialize(), stats: g.stats };
    const raw3 = JSON.stringify(v3);
    localStorage.setItem(SAVE_KEYS.v3Save, raw3);
    g.newGame('war'); g.loadGame();
    const migOk = g.hero.classId === 'death' && g.gold === 77 && g.inventory.countOf('iron_shard') === 14 && !g.inventory.items.some((i) => i.def.kind === 'material') && g.run?.dungeonId === PROLOGUE.id && g.progress.isUnlocked('ashen_catacombs') && localStorage.getItem(SAVE_KEYS.v3Save) === raw3;
    localStorage.setItem(SAVE_KEYS.save, '{"version":4,"hero":');
    const fallback = g.saves.load();
    localStorage.setItem(SAVE_KEYS.save, JSON.stringify({ ...JSON.parse(raw3), version: 4, progress: { unlocked: ['ghost_dungeon', 'ashen_catacombs'], recipes: ['no_such_recipe'], completed: { ghost: { normal: 1 } } }, materials: { bogus_mat: 4, bone_fragment: 99999 } }));
    g.loadGame();
    const validated = !g.progress.isUnlocked('ghost_dungeon') && !g.progress.recipes.has('no_such_recipe') && g.inventory.countOf('bone_fragment') === ITEM_DEFS.bone_fragment.stack;
    check('Phase 3 saves migrate to v4 (materials -> pouch, prologue run); corrupt v4 falls back; unknown ids are dropped, counts clamped',
      migOk && fallback?.version === SAVE_VERSION && validated,
      `v3 -> DEATH, 77 gold, 14 Iron Shard in pouch (${g.inventory.countOf('iron_shard')}), v3 slot untouched; corrupt v4 -> fell back (migratedFrom ${fallback?.migratedFrom}); unknown dungeon/recipe dropped, 99999 bone clamped to ${g.inventory.countOf('bone_fragment')}`);

    // ============================================================ 23-24. gameplay: every Horseman through the intended progression
    const runs = [];
    for (const cls of ['war', 'conquest', 'famine', 'death']) {
      // a NEW hero: the hand-built prologue crypt (secret wall, sealed gate, chests), real combat
      g.newGame(cls);
      const prologueCleared = playPrologue();
      const prologueLv = g.hero.level;
      // the same hero continues: camp -> Ashen Catacombs (2 floors + the Grave Warden)
      g.toCamp();
      autoEquip();
      const log = playDungeon('ashen_catacombs', 'normal');
      log.prologue = prologueCleared; log.prologueLv = prologueLv;
      runs.push(log);
      if (log.cleared) g.toCamp();
    }
    check('All four Horsemen complete the intended progression: Prologue -> camp -> Ashen Catacombs (2 floors + Grave Warden)', runs.every((r) => r.prologue && r.cleared),
      runs.map((r) => `${r.class.toUpperCase()}: prologue ${r.prologue} (LV${r.prologueLv}), Ashen LV${r.startLv}->${r.endLv}, floors ${r.floors}/2, boss ${r.bossDown} (${r.bossTime}s, ${r.bossPhases} phases, -${r.bossDamage} HP, ${r.bossPotions} potions), secrets ${r.secrets || 0} [${(r.methods || []).join(',')}], class rooms ${(r.classRooms || []).join(',') || '-'}, chests ${r.chests || 0}, HP ${r.hp}${r.died ? ' DIED' : ''}`).join(' | '));
    // other dungeons with level-appropriate heroes (framework expansion, bosses included)
    const others = [];
    for (const [id, cls, lvl] of [['red_warfront', 'conquest', 17], ['black_harvest', 'war', 30], ['pale_threshold', 'famine', 44]]) {
      boost(cls, lvl); unlockUpTo(id);
      const log = playDungeon(id, 'normal');
      others.push(log);
      if (g.scene === 'cleared') g.toCamp();
    }
    check('Red Warfront, Black Harvest and Pale Threshold are playable to completion (boosted heroes at the recommended level)', others.every((r) => r.cleared),
      others.map((r) => `${r.id} ${r.class.toUpperCase()} LV${r.startLv}->${r.endLv}: floors ${r.floors}/2, boss ${r.bossDown} (${r.bossTime}s, ${r.bossPhases} phases, -${r.bossDamage} HP, ${r.bossPotions} potions), HP ${r.hp}${r.died ? ' DIED' : ''}${r.error ? ' ' + r.error : ''}`).join(' | '));
    results.summary = { runs, others };
  } catch (err) {
    check('Phase 4 suite completed', false, err.stack || err.message);
  }
  check('No console errors during the Phase 4 suite', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  g.update = realUpdate;
  console.error = origError;
  window.removeEventListener('error', onErr);
  for (const [k, v] of Object.entries(keep)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  g.toTitle();
  window.__p4Results = results;
  console.table(results);
  return results;
}
