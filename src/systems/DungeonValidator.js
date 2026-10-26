// DungeonValidator: proves a layout is navigable and winnable before a run starts.
// Reachability is checked in three states, never letting the player walk on collapsing floor:
//   R0  everything sealed (gates, secret walls, class seals, timed doors)  -> all mandatory rooms
//       before the gate and every part of the gate's key (guardian room / puzzle pieces) must be here,
//       and the goal (boss / stairs) must NOT be (no way around the gate).
//   R1  gates open, optional seals still closed -> goal room, boss, exit / stairs, hidden switches.
//   R2  everything open -> every room, chest and interactable feature.
// Also: room overlap, tiles inside walls, spawns on valid free tiles. Returns { ok, errors, stats }.
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function validateLayout(L) {
  const errors = [];
  const W = L.w || L.map[0].length, H = L.h || L.map.length;
  const ch = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? L.map[y][x] : '#');
  const K = (x, y) => y * W + x;
  const blocking = new Set();
  for (const c of L.chests || []) blocking.add(K(c.x, c.y));
  for (const f of L.features || []) if (f.blocking) blocking.add(K(f.x, f.y));
  const collapse = new Set((L.features || []).filter((f) => f.kind === 'collapse').map((f) => K(f.x, f.y)));
  const passable = (x, y, st) => {
    const c = ch(x, y);
    if (c === '.' || c === 'P' || /[kKB]/.test(c)) return !blocking.has(K(x, y)) && !collapse.has(K(x, y));
    if (c === 'D') return true;
    if (c === 'G') return st.gates;
    if (c === 'S') return st.secrets;
    if (c === 'W' || c === 'Q' || c === 'F' || c === 'O') return st.classDoors;
    if (c === 'L') return st.timed;
    return false;
  };
  const flood = (st) => {
    const seen = new Set();
    const s = L.start;
    if (!passable(s.x, s.y, { gates: true, secrets: true, classDoors: true, timed: true })) return seen;
    const q = [[s.x, s.y]]; seen.add(K(s.x, s.y));
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy, k = K(nx, ny);
        if (!seen.has(k) && passable(nx, ny, st)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return seen;
  };
  const R0 = flood({ gates: false, secrets: false, classDoors: false, timed: false });
  const R1 = flood({ gates: true, secrets: false, classDoors: false, timed: false });
  const R2 = flood({ gates: true, secrets: true, classDoors: true, timed: true });
  const roomIn = (room, R) => { for (let y = room.y1; y <= room.y2; y++) for (let x = room.x1; x <= room.x2; x++) if (R.has(K(x, y))) return true; return false; };
  const adj = (x, y, R) => R.has(K(x, y)) || DIRS4.some(([dx, dy]) => R.has(K(x + dx, y + dy)));

  if (!R2.size) errors.push('start tile is not walkable');
  // ---- geometry
  const rooms = L.rooms || [];
  for (const r of rooms) {
    if (r.x1 < 1 || r.y1 < 1 || r.x2 > W - 2 || r.y2 > H - 2) errors.push(`room ${r.id} out of bounds`);
    if (!L.generated) continue;
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) if (ch(x, y) !== '.' && !(r.type === 'boss' && ch(x, y) === '#')) errors.push(`room ${r.id} has a non-floor tile at ${x},${y}`);
  }
  if (L.generated) {
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      if (a.x1 - 1 <= b.x2 && b.x1 - 1 <= a.x2 && a.y1 - 1 <= b.y2 && b.y1 - 1 <= a.y2) errors.push(`rooms ${a.id} and ${b.id} overlap`);
    }
  }
  // ---- spawns
  const seenSpawn = new Set();
  for (const s of L.spawns || []) {
    const c = ch(s.x, s.y);
    if (!(c === '.' || /[kKB]/.test(c)) || blocking.has(K(s.x, s.y)) || collapse.has(K(s.x, s.y))) errors.push(`enemy ${s.sid || s.id} on an invalid tile ${s.x},${s.y}`);
    if (s.x === L.start.x && s.y === L.start.y) errors.push(`enemy ${s.sid || s.id} on the start tile`);
    if (seenSpawn.has(K(s.x, s.y))) errors.push(`two enemies share ${s.x},${s.y}`);
    seenSpawn.add(K(s.x, s.y));
  }
  for (const c of L.chests || []) if (ch(c.x, c.y) !== '.' && !/[CP]/.test(ch(c.x, c.y))) errors.push(`chest ${c.id} inside a wall`);

  const unreachableMandatory = [];
  if (L.generated) {
    // ---- mandatory progression (R0) and gate integrity
    const goal = rooms.find((r) => r.type === 'boss' || r.type === 'stairs');
    for (const r of rooms.filter((q) => q.main && q !== goal)) if (!roomIn(r, R0)) unreachableMandatory.push(r.id);
    for (const g of L.gates || []) if (!adj(g.x, g.y, R0)) errors.push(`gate at ${g.x},${g.y} cannot be reached`);
    if (goal && roomIn(goal, R0)) errors.push('goal room is reachable without opening its gate');
    for (const pz of L.puzzles || []) {
      const parts = (L.features || []).filter((f) => f.puzzle === pz.id && f.kind !== 'tablet');
      const R = pz.key ? R0 : R2;
      for (const f of parts) if (!(f.kind === 'plate' ? R.has(K(f.x, f.y)) : adj(f.x, f.y, R))) errors.push(`${pz.key ? 'key ' : ''}puzzle piece ${f.kind} at ${f.x},${f.y} unreachable`);
      if (parts.length !== 3) errors.push(`puzzle ${pz.id} has ${parts.length} pieces`);
    }
    // ---- goal (R1)
    if (goal && !roomIn(goal, R1)) unreachableMandatory.push(goal.id);
    for (const f of (L.features || []).filter((q) => q.kind === 'stairs' || q.kind === 'exit')) if (!adj(f.x, f.y, R1)) errors.push(`${f.kind} cannot be reached`);
    for (const s of (L.spawns || []).filter((q) => q.boss)) if (!R1.has(K(s.x, s.y))) errors.push('boss cannot be reached');
    for (const f of (L.features || []).filter((q) => q.kind === 'switch')) if (!adj(f.x, f.y, R1)) errors.push(`hidden switch at ${f.x},${f.y} is behind what it opens`);
    // ---- optional content (R2)
    for (const r of rooms) if (!roomIn(r, R2)) errors.push(`room ${r.id} (${r.type}) unreachable`);
    for (const c of L.chests || []) if (!adj(c.x, c.y, R2)) errors.push(`chest ${c.id} unreachable`);
    for (const f of (L.features || []).filter((q) => q.blocking || q.wall)) if (!adj(f.x, f.y, R2)) errors.push(`${f.kind} at ${f.x},${f.y} unreachable`);
    if (!(L.objectives || []).some((o) => !o.optional)) errors.push('no mandatory objective');
  } else {
    // hand-authored: every room must be reachable once gates and secrets are open
    for (const r of rooms) if (!roomIn(r, R2)) unreachableMandatory.push(r.id);
  }
  for (const id of unreachableMandatory) errors.push(`mandatory room ${id} unreachable`);

  const stats = {
    rooms: rooms.length, corridors: (L.edges || []).length, corridorTiles: L.corridorTiles || 0,
    reachableRooms: rooms.filter((r) => roomIn(r, R2)).length, unreachableMandatory,
    secretRooms: rooms.filter((r) => r.type === 'secret' || r.id === 'secret').length,
    enemySpawns: (L.spawns || []).length, chests: (L.chests || []).length, features: (L.features || []).length,
    size: `${W}x${H}`,
  };
  return { ok: errors.length === 0, errors, stats };
}
