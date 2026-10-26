import { DIRS } from '../data/config.js';

// Grid/tilemap state for the CURRENT floor: walls, doors, gates, secret walls, chests, features,
// exploration, LOS and pathing. Works for the hand-authored Phase 1 crypt and for generated
// Phase 4 layouts (same layout shape; see DungeonGenerator).
export const TILE = {
  FLOOR: 0, WALL: 1, TORCH: 2, DOOR: 3, GATE: 4, SECRET: 5,
  BARRIER: 6, SIGILDOOR: 7, ROOTDOOR: 8, SOULSEAL: 9, RUNE: 10, LEVER: 11, SWITCH: 12, TIMED: 13, PIT: 14,
};
const CHAR_TILE = {
  '#': TILE.WALL, T: TILE.TORCH, D: TILE.DOOR, G: TILE.GATE, S: TILE.SECRET,
  W: TILE.BARRIER, Q: TILE.SIGILDOOR, F: TILE.ROOTDOOR, O: TILE.SOULSEAL, R: TILE.RUNE, V: TILE.LEVER, H: TILE.SWITCH, L: TILE.TIMED, _: TILE.PIT,
};
// Door-like tiles: block until opened, then become passable floor.
const OPENABLE = new Set([TILE.DOOR, TILE.GATE, TILE.SECRET, TILE.BARRIER, TILE.SIGILDOOR, TILE.ROOTDOOR, TILE.SOULSEAL, TILE.TIMED]);
const KIND = {
  [TILE.WALL]: 'wall', [TILE.TORCH]: 'torch', [TILE.DOOR]: 'door', [TILE.GATE]: 'gate', [TILE.SECRET]: 'secret',
  [TILE.BARRIER]: 'barrier', [TILE.SIGILDOOR]: 'sigil', [TILE.ROOTDOOR]: 'roots', [TILE.SOULSEAL]: 'soulseal', [TILE.TIMED]: 'portcullis',
};
// Feature states that are persisted (everything else comes from the layout).
const FEATURE_STATE = ['used', 'lit', 'pressed', 'collapsed', 'found', 'pulled', 'solved'];

export class DungeonManager {
  constructor(layout) { this.load(layout); }

  // Switch to another layout (new floor / dungeon) and rebuild.
  load(layout) { this.def = layout; this.reset(); }

  // Rebuild everything from the immutable layout (used on new game / restart / floor change).
  reset() {
    const def = this.def;
    this.h = def.map.length;
    this.w = def.map[0].length;
    this.tiles = new Uint8Array(this.w * this.h);
    this.open = new Uint8Array(this.w * this.h); // 1 = door/gate/secret opened
    this.explored = new Uint8Array(this.w * this.h);
    this.spawns = [];
    this.chests = new Map();
    this.features = new Map();   // key -> feature (floor objects, decals and wall fixtures)
    this.featureList = [];
    this.timers = new Map();     // timed door key -> close time
    this.start = { x: def.start?.x ?? 1, y: def.start?.y ?? 1, dir: def.start?.dir ?? 1 };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = def.map[y][x];
        this.tiles[y * this.w + x] = CHAR_TILE[ch] ?? TILE.FLOOR;
        if (ch === 'P') { this.start.x = x; this.start.y = y; }
        if (def.spawnChars?.[ch]) this.spawns.push({ x, y, ...def.spawnChars[ch] });
      }
    }
    if (def.spawns) this.spawns = def.spawns.map((s) => ({ ...s }));
    def.chests.forEach((c, i) => this.chests.set(this.key(c.x, c.y), { ...c, id: c.id || `chest_${i}`, opened: false, level: c.level || def.level || 1 }));
    for (const f of def.features || []) {
      const st = { ...f };
      this.featureList.push(st);
      // decals can share a tile with nothing else; wall fixtures are keyed by their wall tile
      this.features.set(this.key(f.x, f.y), st);
    }
    this.puzzles = new Map((def.puzzles || []).map((p) => [p.id, { ...p, progress: 0, solved: false }]));
    this.gateState = (def.gates || []).map((g) => ({ ...g, unlocked: false }));
    this.visitedRooms = new Set();
  }

  key(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inBounds(x, y) ? this.tiles[this.key(x, y)] : TILE.WALL; }
  isOpened(x, y) { return this.inBounds(x, y) && this.open[this.key(x, y)] === 1; }
  featureAt(x, y) { return this.inBounds(x, y) ? this.features.get(this.key(x, y)) || null : null; }
  featuresOf(kind) { return this.featureList.filter((f) => f.kind === kind); }

  // Visual kind of a cell for the renderer; null = open space.
  wallKind(x, y) {
    const t = this.tile(x, y);
    if (t === TILE.FLOOR || t === TILE.PIT) return null;
    if (OPENABLE.has(t) && this.isOpened(x, y)) return null;
    if (t === TILE.RUNE) { const f = this.featureAt(x, y); return `rune${f?.symbol || 0}${f?.lit ? 'on' : ''}`; }
    if (t === TILE.LEVER) { const f = this.featureAt(x, y); return f?.pulled ? 'leverOn' : 'lever'; }
    if (t === TILE.SWITCH) { const f = this.featureAt(x, y); return f?.found ? 'switchOn' : 'switch'; }
    return KIND[t] || 'wall';
  }

  blocksSight(x, y) { return this.wallKind(x, y) !== null; }

  // Walkable ignoring creatures (chests and solid features block; pits block).
  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    if (this.wallKind(x, y) !== null) return false;
    if (this.tile(x, y) === TILE.PIT) return false;
    if (this.chests.get(this.key(x, y))) return false;
    const f = this.features.get(this.key(x, y));
    return !(f && f.blocking);
  }

  chestAt(x, y) { return this.chests.get(this.key(x, y)) || null; }

  openTile(x, y) { if (this.inBounds(x, y)) this.open[this.key(x, y)] = 1; }
  closeTile(x, y) { if (this.inBounds(x, y)) this.open[this.key(x, y)] = 0; }
  setPit(x, y) { if (this.inBounds(x, y)) this.tiles[this.key(x, y)] = TILE.PIT; }

  gateAt(x, y) { return this.gateState.find((g) => g.x === x && g.y === y) || null; }

  roomAt(x, y) {
    for (const r of this.def.rooms) if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) return r;
    return this.def.defaultRoom;
  }
  room(id) { return this.def.rooms.find((r) => r.id === id) || null; }

  // Timed doors: open now, close after `dur` seconds (never on top of the player or an enemy).
  openTimed(x, y, now, dur) { this.openTile(x, y); this.timers.set(this.key(x, y), now + dur); }
  updateTimers(now, occupiedFn) {
    const closed = [];
    for (const [k, t] of this.timers) {
      if (now < t) continue;
      const x = k % this.w, y = Math.floor(k / this.w);
      if (occupiedFn(x, y)) continue; // wait until the doorway is clear
      this.closeTile(x, y); this.timers.delete(k); closed.push({ x, y });
    }
    return closed;
  }

  // Bresenham line of sight between two cell centres (endpoints excluded).
  hasLOS(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (let i = 0; i < 96; i++) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && this.blocksSight(x, y)) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return false;
  }

  // BFS next step from (sx,sy) toward (tx,ty). `blocked(x,y)` excludes occupied cells.
  nextStep(sx, sy, tx, ty, blocked, maxNodes = 400) {
    if (sx === tx && sy === ty) return null;
    const prev = new Map();
    const startK = this.key(sx, sy);
    prev.set(startK, -1);
    const q = [startK];
    let found = -1;
    for (let qi = 0; qi < q.length && qi < maxNodes; qi++) {
      const k = q[qi];
      const x = k % this.w, y = Math.floor(k / this.w);
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy;
        const nk = this.key(nx, ny);
        if (prev.has(nk) || !this.inBounds(nx, ny)) continue;
        const isTarget = nx === tx && ny === ty;
        if (!isTarget && (!this.isWalkable(nx, ny) || blocked(nx, ny))) continue;
        prev.set(nk, k);
        if (isTarget) { found = nk; break; }
        q.push(nk);
      }
      if (found >= 0) break;
    }
    if (found < 0) return null;
    let k = found;
    while (prev.get(k) !== startK && prev.get(k) !== -1) k = prev.get(k);
    return { x: k % this.w, y: Math.floor(k / this.w) };
  }

  // Reveal cells around the player and down the facing corridor.
  reveal(px, py, dir) {
    const mark = (x, y) => { if (this.inBounds(x, y)) this.explored[this.key(x, y)] = 1; };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(px + dx, py + dy);
    const d = DIRS[dir];
    const rx = -d.dy, ry = d.dx;
    for (let i = 1; i <= 6; i++) {
      const cx = px + d.dx * i, cy = py + d.dy * i;
      mark(cx, cy); mark(cx + rx, cy + ry); mark(cx - rx, cy - ry);
      if (this.blocksSight(cx, cy)) break;
    }
  }
  isExplored(x, y) { return this.inBounds(x, y) && this.explored[this.key(x, y)] === 1; }

  serialize() {
    const feats = {};
    for (const f of this.featureList) {
      const s = {};
      for (const k of FEATURE_STATE) if (f[k]) s[k] = f[k];
      if (Object.keys(s).length) feats[f.id] = s;
    }
    const pits = [];
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === TILE.PIT) pits.push(i);
    return {
      open: Array.from(this.open), explored: Array.from(this.explored),
      chests: [...this.chests.values()].filter((c) => c.opened).map((c) => c.id),
      gates: this.gateState.map((g) => g.unlocked), visited: [...this.visitedRooms],
      features: feats, pits, puzzles: [...this.puzzles.values()].map((p) => ({ id: p.id, progress: p.progress, solved: p.solved })),
    };
  }
  restore(s) {
    if (!s) return;
    if (s.open?.length === this.open.length) this.open.set(s.open);
    if (s.explored?.length === this.explored.length) this.explored.set(s.explored);
    for (const c of this.chests.values()) c.opened = (s.chests || []).includes(c.id);
    (s.gates || []).forEach((u, i) => { if (this.gateState[i]) this.gateState[i].unlocked = u; });
    this.visitedRooms = new Set(s.visited || []);
    for (const f of this.featureList) Object.assign(f, s.features?.[f.id] || {});
    for (const i of s.pits || []) if (i >= 0 && i < this.tiles.length) this.tiles[i] = TILE.PIT;
    for (const p of s.puzzles || []) { const q = this.puzzles.get(p.id); if (q) { q.progress = p.progress | 0; q.solved = !!p.solved; } }
    // timed doors never stay open across a load
    for (const f of this.featureList) if (f.kind === 'lever') f.pulled = false;
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === TILE.TIMED) this.open[i] = 0;
  }
}
