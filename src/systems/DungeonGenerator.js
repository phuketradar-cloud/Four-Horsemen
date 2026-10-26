import { mulberry32, rngInt, rngWeighted } from '../core/rng.js';
import { DIFFICULTIES, CHAMPION_MODS } from '../data/difficulty.js';
import { BOSSES } from '../data/bosses.js';
import { validateLayout } from './DungeonValidator.js';

// DungeonGenerator: definition (data) + seed + floor + difficulty  ->  layout (map + rooms + content).
// Pipeline (each step is a function below):
//   1. pick config + seeded RNG        5. reserve start / goal (boss arena or stairs) / exit
//   2. room graph on a macro grid      6. encounters, chests, hazards, puzzles, class + secret rooms
//   3. carve rooms (+ authored arena)  7. torches, clues, objectives
//   4. corridors, doors, gates         8. validate -> regenerate (new attempt seed) if invalid
// Geometry rule that makes corridors safe: every room interior keeps a 2-tile margin inside its
// macro cell, and a corridor between two cells only runs inside those two cells and along their
// shared boundary line. So corridors can never cut into a third room or bypass a door/gate.
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const RUNE_SYMBOLS = ['BIRTH', 'BLOOD', 'BONE'];
export const CLASS_DOOR = { war: 'W', conquest: 'Q', famine: 'F', death: 'O' };
const CLASS_IDS = ['war', 'conquest', 'famine', 'death'];
const OPEN_TYPES = new Set(['start', 'combat', 'nest', 'elite', 'treasure', 'trap', 'rest', 'puzzle']);
const MAX_ATTEMPTS = 40;

const mix = (seed, floor, attempt) => (seed ^ Math.imul(floor + 1, 0x9e3779b1) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0;
const pickR = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// Enemy level for a floor (before room bonuses), including the difficulty offset.
export function floorLevel(def, floor, difficulty = 'normal') {
  const [a, b] = def.enemyLevels || [1, 1];
  const n = Math.max(1, (def.floors || 1) - 1);
  return Math.round(a + ((b - a) * floor) / n) + (DIFFICULTIES[difficulty]?.levelAdd || 0);
}

export function generateDungeon(def, { seed = 1, floor = 0, difficulty = 'normal', log = null } = {}) {
  const rejected = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(mix(seed, floor, attempt));
    let lay = null;
    try { lay = buildCandidate(def, rng, { floor, difficulty, seed, linear: attempt >= MAX_ATTEMPTS - 3 }); } catch (err) { rejected.push(`#${attempt}: ${err.message}`); continue; }
    if (!lay) { rejected.push(`#${attempt}: room graph could not be built`); continue; }
    const report = validateLayout(lay);
    lay.report = { ...report, attempts: attempt + 1, rejected };
    if (report.ok) return lay;
    rejected.push(`#${attempt}: ${report.errors.slice(0, 3).join('; ')}`);
    if (log) log(`[DungeonGenerator] ${def.id} floor ${floor + 1} seed ${seed}: layout #${attempt} rejected - ${report.errors[0]}`);
  }
  throw new Error(`Dungeon generation failed for ${def.id} (seed ${seed}, floor ${floor}): ${rejected.slice(-3).join(' | ')}`);
}

// ------------------------------------------------------------------ 2. room graph
function randomWalk(rng, cols, rows, len) {
  for (let t = 0; t < 80; t++) {
    const path = [[rngInt(rng, 0, cols - 1), rngInt(rng, 0, rows - 1)]];
    const used = new Set([path[0].join()]);
    while (path.length < len) {
      const [cx, cy] = path[path.length - 1];
      const opts = DIRS4.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !used.has(`${x},${y}`));
      if (!opts.length) break;
      const nxt = pickR(rng, opts);
      used.add(nxt.join()); path.push(nxt);
    }
    if (path.length === len) return path;
  }
  return null;
}
// Fallback: a snake through the grid is always valid.
function snakePath(cols, rows, len) {
  const out = [];
  for (let y = 0; y < rows && out.length < len; y++) for (let i = 0; i < cols && out.length < len; i++) out.push([y % 2 ? cols - 1 - i : i, y]);
  return out;
}

function buildGraph(def, rng, finalFloor, linear, floor = 0) {
  const G = def.generation;
  const len = Math.min(G.cols * G.rows - 2, linear ? G.mainPath[0] : rngInt(rng, G.mainPath[0], G.mainPath[1]));
  const path = linear ? snakePath(G.cols, G.rows, len) : randomWalk(rng, G.cols, G.rows, len);
  if (!path) return null;
  const nodes = [], byCell = new Map(), edges = [];
  const add = (cx, cy, type, extra = {}) => { const n = { id: `r${nodes.length}`, cx, cy, type, ...extra }; nodes.push(n); byCell.set(`${cx},${cy}`, n); return n; };
  const connect = (a, b, special = null) => edges.push({ a: a.id, b: b.id, special });
  const prog = def.progression || {};
  const keyKind = finalFloor ? prog.bossGate : prog.floorGate; // guardian | runes | plates
  const keyIndex = Math.max(1, len - 2);
  path.forEach(([cx, cy], i) => {
    let type = 'combat';
    if (i === 0) type = 'start';
    else if (i === len - 1) type = finalFloor ? 'boss' : 'stairs';
    else if (i === keyIndex) type = keyKind === 'guardian' ? 'elite' : 'puzzle';
    else if (rng() < 0.25) type = 'nest';
    const n = add(cx, cy, type, { main: true, index: i });
    if (i === keyIndex && keyKind !== 'guardian') n.puzzleKind = keyKind, n.key = true;
    if (i === keyIndex && keyKind === 'guardian') { n.key = true; n.miniboss = def.minibosses?.[floor] || null; }
    if (i > 0) connect(nodes[i - 1], n, i === len - 1 ? { side: 'b', ch: 'G', gate: true } : null);
  });
  const free = (n) => DIRS4.map(([dx, dy]) => [n.cx + dx, n.cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < G.cols && y < G.rows && !byCell.has(`${x},${y}`));
  const parents = (filter) => nodes.filter((n) => OPEN_TYPES.has(n.type) && !n.vault && free(n).length && (!filter || filter(n)));
  const attach = (type, extra = {}, filter = null) => {
    const ps = parents(filter);
    if (!ps.length) return null;
    const p = pickR(rng, ps);
    const [cx, cy] = pickR(rng, free(p));
    const n = add(cx, cy, type, { parent: p.id, ...extra });
    return { p, n };
  };
  // secret rooms (leaves) with a discovery method
  const nSecrets = rngInt(rng, ...(def.secretRooms || [1, 1]));
  for (let i = 0; i < nSecrets; i++) {
    const method = pickR(rng, ['wall', 'wall', 'switch', 'guardian']);
    const r = attach('secret', { method }, (p) => p.type !== 'start' || method === 'wall');
    if (r) connect(r.p, r.n, { side: 'b', ch: 'S', secret: true });
  }
  // one class-sealed room per floor (alternative: a hidden switch elsewhere opens it for any class)
  if (rng() < 0.9) {
    const cls = pickR(rng, CLASS_IDS);
    const r = attach('class', { cls });
    if (r) connect(r.p, r.n, { side: 'b', ch: CLASS_DOOR[cls], classDoor: cls });
  }
  // remaining optional branches
  const nBranches = rngInt(rng, ...G.branches);
  const pool = [{ value: 'treasure', weight: 3 }, { value: 'trap', weight: 2 }, { value: 'rest', weight: 1.2 }, { value: 'challenge', weight: 1.5 }, { value: 'puzzle', weight: 1 }];
  for (let i = 0; i < nBranches; i++) {
    const type = rngWeighted(rng, pool);
    const vault = type === 'treasure' && rng() < 0.35; // timed door + levers
    const r = attach(type, { vault, puzzleKind: type === 'puzzle' ? pickR(rng, def.puzzles || ['runes']) : undefined });
    if (r) connect(r.p, r.n, vault ? { side: 'b', ch: 'L', timed: true } : null);
  }
  // a few loops between ordinary rooms (never touching the goal, secret, class or vault rooms)
  for (let i = 0; i < (G.loops || 0); i++) {
    const cands = [];
    for (const a of nodes) for (const b of nodes) {
      if (a.id >= b.id || !OPEN_TYPES.has(a.type) || !OPEN_TYPES.has(b.type) || a.vault || b.vault) continue;
      if (Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy) !== 1) continue;
      if (edges.some((e) => (e.a === a.id && e.b === b.id) || (e.a === b.id && e.b === a.id))) continue;
      cands.push([a, b]);
    }
    if (cands.length) { const [a, b] = pickR(rng, cands); connect(a, b); }
  }
  return { nodes, edges, keyKind };
}

// ------------------------------------------------------------------ 3-8. layout
function buildCandidate(def, rng, { floor, difficulty, seed, linear }) {
  const G = def.generation, S = G.cellSize;
  const W = G.cols * S + 1, H = G.rows * S + 1;
  const finalFloor = floor === def.floors - 1;
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const graph = buildGraph(def, rng, finalFloor, linear, floor);
  if (!graph) return null;
  const { nodes, edges } = graph;
  const grid = Array.from({ length: H }, () => new Array(W).fill('#'));
  const set = (x, y, ch) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) grid[y][x] = ch; };
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : '#');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const boss = finalFloor ? BOSSES[def.boss] : null;
  const roomNames = def.rooms || {};
  const named = (type) => {
    const r = roomNames[type] || {};
    return { name: (r.names ? pickR(rng, r.names) : type.toUpperCase()).toUpperCase(), lore: r.lore ? pickR(rng, r.lore) : '' };
  };

  // ---- 3. rooms
  const rooms = [];
  for (const n of nodes) {
    const x0 = n.cx * S, y0 = n.cy * S, maxI = S - 3;
    let w, h;
    if (n.type === 'boss') { w = 7; h = 7; }
    else if (n.type === 'stairs' || n.type === 'secret' || n.type === 'class' || n.type === 'rest') { w = rngInt(rng, 3, 4); h = rngInt(rng, 3, 4); }
    else if (n.type === 'start') { w = rngInt(rng, 3, 5); h = rngInt(rng, 3, 5); }
    else if (n.type === 'puzzle' || n.type === 'trap' || n.type === 'elite' || n.type === 'challenge') { w = rngInt(rng, 4, maxI); h = rngInt(rng, 4, maxI); }
    else { w = rngInt(rng, G.roomSize[0], G.roomSize[1]); h = rngInt(rng, G.roomSize[0], G.roomSize[1]); }
    if (n.type === 'combat' && rng() < (G.narrowChance || 0)) { if (rng() < 0.5) w = 2; else h = 2; n.narrow = true; }
    w = Math.min(maxI, Math.max(2, w)); h = Math.min(maxI, Math.max(2, h));
    const x1 = n.type === 'boss' ? x0 + 2 : x0 + 2 + rngInt(rng, 0, maxI - w);
    const y1 = n.type === 'boss' ? y0 + 2 : y0 + 2 + rngInt(rng, 0, maxI - h);
    const nm = n.type === 'combat' && n.narrow && (roomNames.combat?.names || []).some((s) => /CORRIDOR/i.test(s)) ? { name: (roomNames.combat.names.find((s) => /CORRIDOR/i.test(s))).toUpperCase(), lore: 'A cramped passage. Nowhere to dodge.' } : named(n.type);
    const room = { id: n.id, type: n.type, name: nm.name, lore: nm.lore, x1, y1, x2: x1 + w - 1, y2: y1 + h - 1, cx: n.cx, cy: n.cy,
      main: !!n.main, key: !!n.key, optional: !n.main, miniboss: n.miniboss || null, cls: n.cls || null, method: n.method || null, vault: !!n.vault, puzzleKind: n.puzzleKind || null, doors: [] };
    n.room = room;
    rooms.push(room);
    for (let y = room.y1; y <= room.y2; y++) for (let x = room.x1; x <= room.x2; x++) set(x, y, '.');
    if (n.type === 'boss') boss.arena.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === '#') set(x1 + dx, y1 + dy, '#'); }));
  }
  const tmplChar = (room, x, y) => (room.type === 'boss' ? boss.arena[y - room.y1][x - room.x1] : '.');

  // ---- 4. corridors, doors, gates
  const gates = [], features = [], chests = [], spawns = [], puzzles = [];
  let corridorTiles = 0;
  const reserve = new Set(); // interior tiles kept clear (door entries)
  const K = (x, y) => `${x},${y}`;
  for (const e of edges) {
    let a = byId.get(e.a), b = byId.get(e.b);
    let flip = false;
    if (a.cx > b.cx || a.cy > b.cy) { [a, b] = [b, a]; flip = true; }
    const ra = a.room, rb = b.room;
    const specialOnB = e.special ? (e.special.side === 'b') !== flip : false; // special tile is on the (original) b room
    const horiz = a.cy === b.cy;
    const okRow = (room, x, y) => { const c = tmplChar(room, x, y); return c === '.' || c === '~'; };
    let da, db, path = [];
    if (horiz) {
      const X = (a.cx + 1) * S;
      const rowsA = []; for (let y = ra.y1; y <= ra.y2; y++) if (okRow(ra, ra.x2, y)) rowsA.push(y);
      const rowsB = []; for (let y = rb.y1; y <= rb.y2; y++) if (okRow(rb, rb.x1, y)) rowsB.push(y);
      const common = rowsA.filter((y) => rowsB.includes(y));
      const ya = common.length && rng() < 0.7 ? pickR(rng, common) : pickR(rng, rowsA);
      const yb = common.includes(ya) && rng() < 0.85 ? ya : pickR(rng, rowsB);
      da = [ra.x2 + 1, ya]; db = [rb.x1 - 1, yb];
      for (let x = da[0] + 1; x <= X; x++) path.push([x, ya]);
      for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) path.push([X, y]);
      for (let x = X; x <= db[0] - 1; x++) path.push([x, yb]);
      reserve.add(K(ra.x2, ya)); reserve.add(K(rb.x1, yb));
    } else {
      const Y = (a.cy + 1) * S;
      const colsA = []; for (let x = ra.x1; x <= ra.x2; x++) if (okRow(ra, x, ra.y2)) colsA.push(x);
      const colsB = []; for (let x = rb.x1; x <= rb.x2; x++) if (okRow(rb, x, rb.y1)) colsB.push(x);
      const common = colsA.filter((x) => colsB.includes(x));
      const xa = common.length && rng() < 0.7 ? pickR(rng, common) : pickR(rng, colsA);
      const xb = common.includes(xa) && rng() < 0.85 ? xa : pickR(rng, colsB);
      da = [xa, ra.y2 + 1]; db = [xb, rb.y1 - 1];
      for (let y = da[1] + 1; y <= Y; y++) path.push([xa, y]);
      for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) path.push([x, Y]);
      for (let y = Y; y <= db[1] - 1; y++) path.push([xb, y]);
      reserve.add(K(xa, ra.y2)); reserve.add(K(xb, rb.y1));
    }
    for (const [x, y] of path) { if (at(x, y) === '#') corridorTiles++; set(x, y, '.'); }
    const special = e.special;
    const plain = () => (rng() < 0.55 ? 'D' : '.');
    const chA = special && !specialOnB ? special.ch : plain();
    const chB = special && specialOnB ? special.ch : plain();
    set(da[0], da[1], chA); set(db[0], db[1], chB);
    ra.doors.push({ x: da[0], y: da[1], to: rb.id, ch: chA }); rb.doors.push({ x: db[0], y: db[1], to: ra.id, ch: chB });
    if (special?.gate) {
      const pos = specialOnB ? db : da;
      gates.push({ x: pos[0], y: pos[1], edge: [e.a, e.b] });
    }
    if (special?.secret) { const pos = specialOnB ? db : da; (specialOnB ? rb : ra).secretDoor = { x: pos[0], y: pos[1] }; }
    if (special?.classDoor) { const pos = specialOnB ? db : da; (specialOnB ? rb : ra).classDoor = { x: pos[0], y: pos[1], cls: special.classDoor }; }
    if (special?.timed) { const pos = specialOnB ? db : da; (specialOnB ? rb : ra).timedDoor = { x: pos[0], y: pos[1] }; }
    e.path = path; e.doors = [da, db];
  }

  // ---- 5. start / goal / exit
  const level0 = floorLevel(def, floor, difficulty);
  const occupied = new Set();
  const blockingAt = new Set();
  const interior = (room) => { const out = []; for (let y = room.y1; y <= room.y2; y++) for (let x = room.x1; x <= room.x2; x++) if (at(x, y) === '.') out.push([x, y]); return out; };
  const freeTiles = (room, { wallSide = false } = {}) => interior(room).filter(([x, y]) => !occupied.has(K(x, y)) && !reserve.has(K(x, y)) &&
    (!wallSide || x === room.x1 || x === room.x2 || y === room.y1 || y === room.y2));
  const take = (room, opts) => { const f = freeTiles(room, opts); if (!f.length) return null; const p = pickR(rng, f); occupied.add(K(p[0], p[1])); return p; };
  const addFeature = (f) => { f.id = f.id || `f${features.length}`; features.push(f); if (f.blocking) blockingAt.add(K(f.x, f.y)); occupied.add(K(f.x, f.y)); return f; };
  const startRoom = rooms.find((r) => r.type === 'start');
  const sx = Math.floor((startRoom.x1 + startRoom.x2) / 2), sy = Math.floor((startRoom.y1 + startRoom.y2) / 2);
  occupied.add(K(sx, sy));
  const door0 = startRoom.doors[0];
  const startDir = door0 ? (Math.abs(door0.x - sx) > Math.abs(door0.y - sy) ? (door0.x > sx ? 1 : 3) : (door0.y > sy ? 2 : 0)) : 1;
  const goal = rooms.find((r) => r.type === 'boss' || r.type === 'stairs');
  const keyRoom = rooms.find((r) => r.key);
  if (goal.type === 'stairs') {
    const p = [Math.floor((goal.x1 + goal.x2) / 2), Math.floor((goal.y1 + goal.y2) / 2)];
    occupied.add(K(...p));
    addFeature({ kind: 'stairs', x: p[0], y: p[1], blocking: true });
  } else {
    boss.arena.forEach((row, dy) => [...row].forEach((ch, dx) => {
      const x = goal.x1 + dx, y = goal.y1 + dy;
      if (ch === 'B') { occupied.add(K(x, y)); spawns.push({ x, y, boss: boss.id, level: (boss.level || level0) + (diff.levelAdd || 0), room: goal.id }); }
      if (ch === 'X') addFeature({ kind: 'exit', x, y, blocking: true, requires: 'boss' });
      if (ch === '~') addFeature({ kind: 'spectral', x, y, pattern: 'A', boss: true });
    }));
    // pattern B: the ring around the arena centre (forces the player to move when the floor shifts)
    const cx = goal.x1 + 3, cy = goal.y1 + 3;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) if (boss.hazardRingB && boss.arena[3 + dy][3 + dx] === '.') addFeature({ kind: 'spectral', x: cx + dx, y: cy + dy, pattern: 'B', boss: true, decal: true });
  }
  // the gate requirement
  const gate = gates[0];
  if (gate) {
    if (keyRoom.type === 'elite') gate.requires = { type: 'clear', room: keyRoom.id };
    else gate.requires = { type: 'puzzle', id: `pz_${keyRoom.id}` };
    gate.goal = goal.id;
  }

  // ---- 6. contents
  const enemyDefs = def.enemies || {};
  let sid = 0;
  const spawnGroup = (room, list, lvlAdd = 0, extra = {}) => {
    for (const type of list) {
      const p = take(room);
      if (!p) break;
      // variants: difficulty champions, plus a dungeon's own variant bias (Last Revelation: elite variants of earlier foes)
      const vChance = diff.eliteChance + (def.variantBias ? 0.22 : 0);
      const champ = room.type !== 'elite' && room.type !== 'challenge' && rng() < vChance ? pickR(rng, def.variantBias && rng() < 0.7 ? def.variantBias : Object.keys(CHAMPION_MODS)) : null;
      spawns.push({ sid: `${room.id}_${sid++}`, x: p[0], y: p[1], type, loot: enemyDefs[type]?.loot || null, level: level0 + lvlAdd, champion: champ, room: room.id, ...extra });
    }
  };
  const encounter = (kind) => [...rngWeighted(rng, (def.encounters[kind] || def.encounters.combat).map((g) => ({ value: g.group, weight: g.w })))];
  const pad = (group) => { for (let i = 0; i < (diff.extraEnemies || 0); i++) group.push(pickR(rng, group)); return group; };
  const chest = (room, table, lvlAdd = 1, extra = {}) => {
    const p = take(room, { wallSide: true }) || take(room);
    if (!p) return null;
    const c = { id: `c_${room.id}_${chests.length}`, x: p[0], y: p[1], table, level: level0 + lvlAdd, room: room.id, ...extra };
    chests.push(c); blockingAt.add(K(p[0], p[1]));
    return c;
  };
  const wallSpots = (room) => { // wall tiles bordering the interior (for runes, levers, switches)
    const out = [];
    for (let x = room.x1; x <= room.x2; x++) { out.push([x, room.y1 - 1, x, room.y1]); out.push([x, room.y2 + 1, x, room.y2]); }
    for (let y = room.y1; y <= room.y2; y++) { out.push([room.x1 - 1, y, room.x1, y]); out.push([room.x2 + 1, y, room.x2, y]); }
    return out.filter(([wx, wy, ix, iy]) => at(wx, wy) === '#' && at(ix, iy) === '.' && !blockingAt.has(K(ix, iy)) && wx > 0 && wy > 0 && wx < W - 1 && wy < H - 1);
  };
  // wall fixtures keep the floor tile in front of them clear, so they can always be used
  const wallTile = (room, ch) => {
    const ws = wallSpots(room).filter(([wx, wy, ix, iy]) => !occupied.has(K(wx, wy)) && !occupied.has(K(ix, iy)));
    if (!ws.length) return null;
    const w = pickR(rng, ws); set(w[0], w[1], ch); occupied.add(K(w[0], w[1])); if (ch !== 'T') reserve.add(K(w[2], w[3]));
    return w;
  };
  const hazardTiles = (room, kind, frac) => {
    // keep the straight route between this room's doors (and its chest) free of hazards
    const keep = new Set();
    const pts = room.doors.map((d) => [Math.min(room.x2, Math.max(room.x1, d.x)), Math.min(room.y2, Math.max(room.y1, d.y))]);
    for (let i = 1; i < pts.length; i++) {
      let [x, y] = pts[0]; const [tx, ty] = pts[i];
      while (x !== tx) { keep.add(K(x, y)); x += Math.sign(tx - x); }
      while (y !== ty) { keep.add(K(x, y)); y += Math.sign(ty - y); }
      keep.add(K(x, y));
    }
    if (pts.length === 1) keep.add(K(...pts[0]));
    for (const c of chests.filter((q) => q.room === room.id)) { // and a route to the room's chest
      let [x, y] = pts[0];
      while (x !== c.x) { keep.add(K(x, y)); x += Math.sign(c.x - x); }
      while (y !== c.y) { keep.add(K(x, y)); y += Math.sign(c.y - y); }
    }
    let n = 0;
    for (const [x, y] of interior(room)) {
      if (occupied.has(K(x, y)) || reserve.has(K(x, y)) || keep.has(K(x, y))) continue;
      if (rng() < frac) {
        addFeature({ kind, x, y, room: room.id, decal: true, pattern: kind === 'spectral' ? ((x + y) % 2 ? 'A' : 'B') : undefined });
        n++;
      }
    }
    return n;
  };

  for (const room of rooms) {
    switch (room.type) {
      case 'combat': {
        spawnGroup(room, pad(encounter('combat')));
        if (rng() < 0.22 && def.hazards?.ambient?.length && !room.narrow) hazardTiles(room, pickR(rng, def.hazards.ambient), 0.12);
        break;
      }
      case 'nest': spawnGroup(room, pad(encounter('nest'))); break;
      case 'elite': {
        if (room.miniboss) { // Phase 5: a miniboss guards this floor's gate (BossEncounterController, rewards once)
          const mb = BOSSES[room.miniboss];
          const p = take(room);
          if (!p) return null;
          spawns.push({ sid: `mb_${room.id}`, x: p[0], y: p[1], boss: mb.id, level: mb.level + (diff.levelAdd || 0), room: room.id, guardian: true });
          break;
        }
        spawnGroup(room, pad(encounter('elite')), 1, { guardian: room.key });
        break;
      }
      case 'challenge': {
        spawnGroup(room, encounter('challenge'), 2);
        chest(room, def.tables.secret, 3, { requiresClear: room.id, challenge: true });
        break;
      }
      case 'treasure': {
        chest(room, def.tables.chest, 1);
        if (room.vault) {
          // timed door: a lever outside (parent room) and one inside, so it can never trap anyone
          const parent = rooms.find((r) => r.id === nodes.find((n) => n.id === room.id).parent);
          const outside = parent && wallTile(parent, 'V');
          const inside = wallTile(room, 'V');
          if (outside) addFeature({ kind: 'lever', x: outside[0], y: outside[1], wall: true, target: room.id, duration: 10 });
          if (inside) addFeature({ kind: 'lever', x: inside[0], y: inside[1], wall: true, target: room.id, duration: 10 });
        } else if ((room.x2 - room.x1) * (room.y2 - room.y1) >= 9 && rng() < 0.5) chest(room, def.tables.chest, 1);
        break;
      }
      case 'trap': {
        const kind = pickR(rng, def.hazards?.trap || ['spikes']);
        room.hazard = kind;
        chest(room, def.tables.chest, 2, { trapReward: true });
        hazardTiles(room, kind, kind === 'spikes' || kind === 'spectral' ? 0.5 : 0.32);
        break;
      }
      case 'rest': { const p = take(room); if (p) addFeature({ kind: 'font', x: p[0], y: p[1], blocking: true, room: room.id }); break; }
      case 'secret': {
        chest(room, def.tables.secret, 2, { secret: true });
        const p = take(room);
        if (p && def.secretRecipes?.length && rng() < 0.6) addFeature({ kind: 'scroll', x: p[0], y: p[1], blocking: true, recipe: pickR(rng, def.secretRecipes), room: room.id });
        else if (p) addFeature({ kind: 'tablet', x: p[0], y: p[1], blocking: true, room: room.id, text: `${room.name}: ${room.lore}` });
        break;
      }
      case 'class': {
        chest(room, def.tables.classCache, 2, { classCache: room.cls });
        break;
      }
      case 'puzzle': {
        const pid = `pz_${room.id}`;
        const kind = room.puzzleKind || 'runes';
        const pz = { id: pid, kind, room: room.id, key: room.key, order: shuffle(rng, [0, 1, 2]) };
        if (kind === 'runes') {
          const spots = shuffle(rng, wallSpots(room)).filter((s, i, arr) => arr.findIndex((o) => o[0] === s[0] && o[1] === s[1]) === i);
          const chosen = [];
          for (const s of spots) { if (chosen.length >= 3) break; if (chosen.some((c) => Math.abs(c[0] - s[0]) + Math.abs(c[1] - s[1]) < 2)) continue; chosen.push(s); }
          if (chosen.length < 3) return null; // rejected: puzzle cannot be built here
          chosen.forEach((s, i) => { set(s[0], s[1], 'R'); occupied.add(K(s[0], s[1])); reserve.add(K(s[2], s[3])); addFeature({ kind: 'rune', x: s[0], y: s[1], wall: true, puzzle: pid, symbol: i }); });
          const p = take(room);
          if (!p) return null;
          addFeature({ kind: 'tablet', x: p[0], y: p[1], blocking: true, puzzle: pid, room: room.id, text: `The inscription reads: "Wake them in order - ${pz.order.map((i) => RUNE_SYMBOLS[i]).join(', then ')}."` });
        } else {
          for (let i = 0; i < 3; i++) { const p = take(room); if (!p) return null; addFeature({ kind: 'plate', x: p[0], y: p[1], decal: true, puzzle: pid, room: room.id }); }
          const p = take(room);
          if (p) addFeature({ kind: 'tablet', x: p[0], y: p[1], blocking: true, puzzle: pid, room: room.id, text: '"Press down all three stones of the old battle line, and the way will open."' });
        }
        puzzles.push(pz);
        if (!room.key) chest(room, def.tables.chest, 2, { requiresPuzzle: pid });
        break;
      }
      default: break;
    }
  }
  // secret discovery methods
  for (const room of rooms.filter((r) => r.type === 'secret')) {
    const parent = rooms.find((r) => r.id === nodes.find((n) => n.id === room.id).parent);
    const door = room.secretDoor;
    if (!door || !parent) continue;
    let method = room.method;
    if (method === 'switch') {
      const w = wallTile(parent, 'H');
      if (w) addFeature({ kind: 'switch', x: w[0], y: w[1], wall: true, opens: { x: door.x, y: door.y }, room: parent.id });
      else method = 'wall';
    }
    if (method === 'guardian') {
      const p = take(parent);
      const normals = Object.keys(enemyDefs).filter((t) => (def.encounters.combat || []).some((g) => g.group.includes(t)));
      const type = normals.length ? pickR(rng, normals) : Object.keys(enemyDefs)[0];
      if (p) spawns.push({ sid: `${parent.id}_${sid++}`, x: p[0], y: p[1], type, loot: enemyDefs[type]?.loot || null, level: level0 + 1, champion: 'armored', room: parent.id, guardsSecret: { x: door.x, y: door.y }, tombGuardian: true });
      else method = 'wall';
    }
    room.method = method;
    // a visual clue on the corridor floor in front of the hidden wall
    const out = DIRS4.map(([dx, dy]) => [door.x + dx, door.y + dy]).find(([x, y]) => at(x, y) === '.' && !(x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2));
    if (out) addFeature({ kind: 'scratch', x: out[0], y: out[1], decal: true });
  }
  // class rooms: alternative hidden switch elsewhere on the floor opens the seal for any Horseman
  for (const room of rooms.filter((r) => r.type === 'class')) {
    const hosts = rooms.filter((r) => OPEN_TYPES.has(r.type) && r.type !== 'start' && r.id !== room.id && !r.vault);
    const host = hosts.length ? pickR(rng, hosts) : null;
    const w = host && wallTile(host, 'H');
    if (w && room.classDoor) addFeature({ kind: 'switch', x: w[0], y: w[1], wall: true, opens: { x: room.classDoor.x, y: room.classDoor.y }, room: host.id, forClassRoom: room.id });
  }
  // Phase 5: one lore tablet per floor (codex entry chosen from the dungeon's lore pool, by seed)
  if (def.lorePool?.length) {
    const hosts = rooms.filter((r) => ['combat', 'treasure', 'rest', 'puzzle', 'secret'].includes(r.type) && !r.narrow);
    const h = hosts.length ? pickR(rng, hosts) : null;
    const p = h && take(h, { wallSide: true });
    if (p) addFeature({ kind: 'tablet', x: p[0], y: p[1], blocking: true, room: h.id, loreId: def.lorePool[(floor + Math.floor(rng() * def.lorePool.length)) % def.lorePool.length] });
  }
  // corrupted shrine for Famine (optional, any class can inspect it)
  const shrineHosts = rooms.filter((r) => (r.type === 'combat' || r.type === 'nest') && !r.narrow);
  if (shrineHosts.length && rng() < 0.75) { const h = pickR(rng, shrineHosts); const p = take(h, { wallSide: true }); if (p) addFeature({ kind: 'shrine', x: p[0], y: p[1], blocking: true, room: h.id }); }

  // ---- 7. torches and objectives
  for (const room of rooms) {
    const n = room.type === 'secret' ? 0 : rngInt(rng, 1, 2);
    for (let i = 0; i < n; i++) wallTile(room, 'T');
  }
  const objectives = [];
  const keyText = keyRoom.miniboss ? `Defeat ${BOSSES[keyRoom.miniboss].name} in the ${keyRoom.name}` : keyRoom.type === 'elite' ? `Slay the guardian of the ${keyRoom.name}` : keyRoom.puzzleKind === 'plates' ? `Press the pressure plates in the ${keyRoom.name}` : `Wake the runes of the ${keyRoom.name} in order`;
  objectives.push({ id: 'key', text: keyText, kind: keyRoom.type === 'elite' ? 'clear' : 'puzzle', room: keyRoom.id, puzzle: keyRoom.type === 'elite' ? null : `pz_${keyRoom.id}` });
  if (goal.type === 'stairs') objectives.push({ id: 'stairs', text: `Descend through ${goal.name}`, kind: 'stairs' });
  else { objectives.push({ id: 'boss', text: `Defeat ${boss.name}`, kind: 'boss' }); objectives.push({ id: 'exit', text: 'Leave through the exit portal', kind: 'exit' }); }
  const nSec = rooms.filter((r) => r.type === 'secret').length;
  if (nSec) objectives.push({ id: 'secrets', text: 'Discover secret rooms', kind: 'secrets', total: nSec, optional: true });
  for (const r of rooms.filter((q) => q.type === 'challenge')) objectives.push({ id: `ch_${r.id}`, text: `Clear the ${r.name}`, kind: 'clear', room: r.id, optional: true });
  for (const r of rooms.filter((q) => q.type === 'class')) objectives.push({ id: `cl_${r.id}`, text: `Open the ${r.name} (${r.cls.toUpperCase()} seal)`, kind: 'classRoom', room: r.id, optional: true });

  const map = grid.map((row) => row.join(''));
  spawns.forEach((s, i) => { s.id = i; s.sid = s.sid || `boss_${i}`; });
  return {
    id: def.id, defId: def.id, name: def.name, floor, floors: def.floors, finalFloor, seed, difficulty, generated: true,
    map, w: W, h: H, rooms, edges: edges.map((e) => ({ a: e.a, b: e.b, special: e.special?.ch || null, tiles: e.path.length })), corridorTiles,
    gates, features, chests, spawns, puzzles, objectives, level: level0, start: { x: sx, y: sy, dir: startDir },
    defaultRoom: { id: 'corridor', name: 'PASSAGE', lore: 'A narrow passage of old stone.' },
    floorItems: [], spawnChars: {}, boss: boss ? boss.id : null,
  };
}
