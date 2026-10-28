import { makeCanvas, tinted, hash2, BAYER4, hexToRgb } from './gfx.js';
import { drawText } from './PixelFont.js';
import { VIEW, LAYOUT, DIRS } from '../data/config.js';
import { RARITIES } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { buildTextures } from './Textures.js';
import { TILE } from '../systems/DungeonManager.js';

// Classic Wizardry-style first-person view rendered purely with 2D canvas operations:
// pre-shaded wall bitmaps are stretched into rectangles (front faces) or 1px column strips
// (side faces) — no 3D engine, no WebGL. Sprites are 2D billboards scaled by distance.
const W = LAYOUT.view.w, H = LAYOUT.view.h;
const CX = W / 2, CY = H / 2;
const F = VIEW.focal;

const ease = (p) => 1 - Math.pow(1 - p, 3);
const lerp = (a, b, t) => a + (b - a) * t;

export function shadeLevel(z) {
  return Math.max(0, Math.min(VIEW.shadeLevels - 1, Math.floor((z - 1.2) * 1.05)));
}

export class DungeonRenderer {
  constructor(textures, sprites) {
    this.tex = textures;
    this.spr = sprites;
    const { c, ctx } = makeCanvas(W, H);
    this.canvas = c; this.ctx = ctx;
    this.bg = [this._buildFloorCeil(0), this._buildFloorCeil(1)];
    this.vignette = this._buildVignette();
    this.themeId = 'crypt';
    this.themeCache = { crypt: { tex: this.tex, bg: this.bg, vig: this.vignette } };
  }

  // Phase 4: per-dungeon palette (walls, floor, ceiling, combat vignette), built once and cached.
  setTheme(theme) {
    const id = theme?.id || 'crypt';
    if (this.themeId === id) return;
    if (!this.themeCache[id]) this.themeCache[id] = { tex: buildTextures(theme), bg: [this._buildFloorCeil(0, theme), this._buildFloorCeil(1, theme)], vig: this._buildVignette(theme.vignette) };
    const c = this.themeCache[id];
    this.tex = c.tex; this.bg = c.bg; this.vignette = c.vig; this.themeId = id;
  }

  _buildFloorCeil(parity, theme = null) {
    const fm = theme?.floor || [1, 1, 1], cm = theme?.ceil || [1, 1, 1];
    const { c, ctx } = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - CY;
      const floor = dy > 0;
      const z = (0.5 * F) / Math.abs(dy || 0.01);
      for (let x = 0; x < W; x++) {
        const X = ((x + 0.5 - CX) * z) / F;
        const tz = z + parity * 0.5;
        const gx = X + 0.5, gz = tz;
        const fx = gx - Math.floor(gx), fz = gz - Math.floor(gz);
        const tileH = hash2(Math.floor(gx * 2), Math.floor(gz * 2), floor ? 21 : 33);
        let r, g, b;
        if (floor) {
          const grout = fx < 0.03 || fz < 0.03 || Math.abs(fx - 0.5) < 0.015 || Math.abs(fz - 0.5) < 0.015;
          r = 58 + tileH * 18; g = 54 + tileH * 14; b = 42 + tileH * 10;
          if (grout) { r = 22; g = 20; b = 15; }
          r *= fm[0]; g *= fm[1]; b *= fm[2];
        } else {
          const beam = Math.abs(fz - 0.5) < 0.06;
          r = 34 + tileH * 10; g = 32 + tileH * 9; b = 28 + tileH * 6;
          if (beam) { r = 44; g = 30; b = 18; }
          if (fx < 0.03) { r = 16; g = 15; b = 12; }
          r *= cm[0]; g *= cm[1]; b *= cm[2];
        }
        const bay = BAYER4[(y & 3) * 4 + (x & 3)];
        let f = Math.max(0, 1 - Math.min(0.97, (z - 0.9) / 7.2) + (bay - 0.5) * 0.1);
        f = Math.min(1, f);
        const i = (y * W + x) * 4;
        img.data[i] = Math.round((r * f) / 6) * 6;
        img.data[i + 1] = Math.round((g * f) / 6) * 6;
        img.data[i + 2] = Math.round((b * f) / 6) * 6;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  _buildVignette(color = '#460402') {
    const { c, ctx } = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const [vr, vg, vb] = hexToRgb(color);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - CX) / CX, dy = (y - CY) / CY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const bay = BAYER4[(y & 3) * 4 + (x & 3)];
      const i = (y * W + x) * 4;
      if (d > 0.75 + bay * 0.35) { img.data[i] = vr; img.data[i + 1] = vg; img.data[i + 2] = vb; img.data[i + 3] = 200; }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- main view
  render(game, t) {
    const ctx = this.ctx;
    const p = game.player;
    const dm = game.dungeon;
    const fwd = DIRS[p.dir];
    const right = { dx: -fwd.dy, dy: fwd.dx };
    this.view = { px: p.x, py: p.y, fwd, right };
    ctx.drawImage(this.bg[(p.x + p.y) & 1], 0, 0);

    // bucket sprites per cell
    const buckets = new Map();
    const add = (cx, cy, s) => { const k = cy * 1000 + cx; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(s); };
    for (const e of game.enemies) {
      if (!e.alive && !e.dying) continue;
      e.screen = null;
      add(e.x, e.y, { type: 'enemy', e });
    }
    for (const it of game.loot.floor) add(it.x, it.y, { type: 'item', it });
    for (const c of dm.chests.values()) add(c.x, c.y, { type: 'chest', c });
    for (const pr of game.combat.projectiles) add(Math.round(pr.x), Math.round(pr.y), { type: 'proj', pr });
    for (const f of dm.featureList || []) if (f.blocking) add(f.x, f.y, { type: 'feature', f });
    for (const a of game.party?.renderList() || []) add(a.x, a.y, { type: 'ally', a }); // companions in view
    this.danger = new Map((game.dangerTiles || []).map((d) => [d.y * 1000 + d.x, d]));

    const L = VIEW.lateral;
    const order = [];
    for (let x = -L; x <= -1; x++) order.push(x);
    for (let x = L; x >= 1; x--) order.push(x);
    order.push(0);

    for (let d = VIEW.maxDepth; d >= 0; d--) {
      for (const x of order) {
        const wx = p.x + fwd.dx * d + right.dx * x;
        const wy = p.y + fwd.dy * d + right.dy * x;
        const kind = dm.wallKind(wx, wy);
        if (kind) {
          if (d === 0 && x === 0) continue;
          // side face (toward the centre column), only if the neighbour toward centre is open
          if (x !== 0) {
            const s = x < 0 ? 1 : -1;
            const nx = wx + right.dx * s, ny = wy + right.dy * s;
            if (!dm.wallKind(nx, ny)) this._side(kind, d, x < 0 ? x + 0.5 : x - 0.5, t);
          }
          if (d >= 1) {
            const bx = wx - fwd.dx, by = wy - fwd.dy;
            if (!dm.wallKind(bx, by)) this._front(kind, d, x, t);
          }
        } else {
          this._drawDecals(wx, wy, game, t);
          const list = buckets.get(wy * 1000 + wx);
          if (list) this._drawCellSprites(list, game, t);
        }
      }
    }
    return this.canvas;
  }

  _front(kind, d, x, t) {
    const z = d;
    const x0 = Math.floor(CX + ((x - 0.5) * F) / z), x1 = Math.ceil(CX + ((x + 0.5) * F) / z);
    if (x1 < 0 || x0 > W) return;
    const top = Math.floor(CY - (0.5 * F) / z), h = Math.ceil(F / z);
    this.ctx.drawImage(this.tex.shaded[kind][shadeLevel(z)], 0, 0, 64, 64, x0, top, x1 - x0, h);
    if (kind === 'torch') this._flame(CX + (x * F) / z, CY - (0.22 * F) / z, 0.16 * F / z, t, z);
  }

  _side(kind, d, X, t) {
    const zNear = Math.max(d, 0.08), zFar = d + 1;
    let a = CX + (X * F) / zFar, b = CX + (X * F) / zNear;
    if (a > b) [a, b] = [b, a];
    const c0 = Math.max(0, Math.floor(a)), c1 = Math.min(W, Math.ceil(b));
    const shaded = this.tex.shaded[kind];
    for (let c = c0; c < c1; c++) {
      const den = c + 0.5 - CX;
      if (Math.abs(den) < 0.001) continue;
      const z = (X * F) / den;
      if (z < zNear - 0.001 || z > zFar + 0.001) continue;
      let u = z - d;
      if (X > 0) u = 1 - u;
      const col = Math.max(0, Math.min(63, Math.floor(u * 64)));
      const top = Math.floor(CY - (0.5 * F) / z), h = Math.ceil(F / z);
      this.ctx.drawImage(shaded[shadeLevel(z)], col, 0, 1, 64, c, top, 1, h);
    }
    if (kind === 'torch') {
      const z = d + 0.5;
      if (z > 0.6) this._flame(CX + (X * F) / z, CY - (0.22 * F) / z, (0.12 * F) / z, t, z);
    }
  }

  _flame(x, y, size, t, z) {
    const ctx = this.ctx;
    const f = this.spr.flame[Math.floor(t * 8 + x) & 3];
    const s = Math.max(1, size / 12);
    const glow = 0.5 + Math.sin(t * 9 + x) * 0.1;
    ctx.globalAlpha = Math.max(0, glow * (1 - z / 8));
    const r = size * 1.8;
    ctx.drawImage(this._glow('#ff8a2a', 24, 24), Math.round(x - r), Math.round(y - r * 0.9), Math.round(r * 2), Math.round(r * 2));
    ctx.globalAlpha = 1;
    ctx.drawImage(f, Math.round(x - f.width * s / 2), Math.round(y - f.height * s * 0.8), Math.round(f.width * s), Math.round(f.height * s));
  }

  _project(wx, wy) {
    const { px, py, fwd, right } = this.view;
    const rx = wx - px, ry = wy - py;
    const z = rx * fwd.dx + ry * fwd.dy + 0.5;
    const X = rx * right.dx + ry * right.dy;
    return { z, X };
  }

  _billboard(img, wx, wy, heightUnits, opts = {}) {
    const { z, X } = this._project(wx, wy);
    if (z < 0.45) return null;
    const hpx = (heightUnits * F) / z;
    const scale = hpx / img.height;
    const w = img.width * scale;
    const foot = CY + (0.5 * F) / z - (opts.lift || 0) * F / z;
    const x = CX + (X * F) / z - w / 2 + (opts.ox || 0);
    const y = foot - hpx;
    const ctx = this.ctx;
    const dx = Math.round(x), dy = Math.round(y), dw = Math.round(w), dh = Math.round(hpx);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    const lvl = shadeLevel(z);
    if (lvl > 0) {
      ctx.globalAlpha = (opts.alpha ?? 1) * (lvl / (VIEW.shadeLevels - 1)) * 0.9;
      ctx.drawImage(tinted(img, '#000'), dx, dy, dw, dh);
    }
    if (opts.flash > 0) {
      ctx.globalAlpha = Math.min(1, opts.flash);
      ctx.drawImage(tinted(img, '#ffffff'), dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
    return { x: dx, y: dy, w: dw, h: dh, z };
  }

  // ---------------------------------------------------------------- Phase 4 floor decals
  // Projects the cell's floor square (inset by `s`) and fills it: plates, spikes, cracked floor,
  // pits, blight pools, spectral fire, scratch clues and boss danger markers.
  _quad(wx, wy, s = 0.5) {
    return [[-s, -s], [s, -s], [s, s], [-s, s]].map(([dx, dy]) => {
      let { z, X } = this._project(wx + dx, wy + dy);
      z = Math.max(0.22, z);
      return [CX + (X * F) / z, CY + (0.5 * F) / z];
    });
  }
  _fill(pts, color, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  _floorPoint(wx, wy, ox, oy) { let { z, X } = this._project(wx + ox, wy + oy); z = Math.max(0.3, z); return { x: CX + (X * F) / z, y: CY + (0.5 * F) / z, z }; }

  _drawDecals(wx, wy, game, t) {
    const dm = game.dungeon;
    const { z } = this._project(wx, wy);
    if (z < 0.2) return;
    const fade = Math.max(0.25, 1 - z / 9);
    if (dm.tile(wx, wy) === TILE.PIT) {
      this._fill(this._quad(wx, wy, 0.48), '#000000', 1);
      this._fill(this._quad(wx, wy, 0.5), '#140c06', 0.5);
    }
    const f = dm.featureAt(wx, wy);
    if (f && f.decal) {
      const ctx = this.ctx;
      switch (f.kind) {
        case 'plate':
          this._fill(this._quad(wx, wy, 0.34), f.pressed ? '#1e1a14' : '#6a6050', fade);
          this._fill(this._quad(wx, wy, 0.27), f.pressed ? '#2a2620' : '#8a7e66', fade);
          break;
        case 'spikes': {
          const ph = game.hazards.spikePhase();
          this._fill(this._quad(wx, wy, 0.4), '#2a2620', fade * 0.9);
          const pts = [[-0.2, -0.2], [0.2, -0.2], [0, 0], [-0.2, 0.2], [0.2, 0.2]];
          for (const [ox, oy] of pts) {
            const p = this._floorPoint(wx, wy, ox, oy);
            const h = ph === 'up' ? (0.3 * F) / p.z : ph === 'warn' ? (0.05 * F) / p.z : 1;
            ctx.fillStyle = ph === 'down' ? '#141210' : '#d0d0d0';
            ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - h), Math.max(1, Math.round(3 / p.z)), Math.round(h));
          }
          break;
        }
        case 'collapse': {
          const crumbling = game.hazards.crumbling.has(f);
          if (f.collapsed) break;
          this._fill(this._quad(wx, wy, 0.46), crumbling && Math.floor(t * 16) % 2 ? '#5a2a10' : '#3a2a1a', fade);
          ctx.strokeStyle = '#0a0604'; ctx.lineWidth = 1; ctx.beginPath();
          const a = this._floorPoint(wx, wy, -0.35, -0.1), b = this._floorPoint(wx, wy, 0, 0.05), c = this._floorPoint(wx, wy, 0.3, -0.3), d = this._floorPoint(wx, wy, 0.1, 0.35);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.moveTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.stroke();
          break;
        }
        case 'blight':
          this._fill(this._quad(wx, wy, 0.44), '#1e4a06', fade * 0.9);
          this._fill(this._quad(wx, wy, 0.3), '#4a8a12', fade * (0.5 + Math.sin(t * 3 + wx) * 0.2));
          if (Math.floor(t * 4 + wx * 3 + wy) % 6 === 0) { const p = this._floorPoint(wx, wy, 0.1, 0); ctx.fillStyle = '#b0e040'; ctx.fillRect(Math.round(p.x), Math.round(p.y - 3), 2, 2); }
          break;
        case 'spectral': {
          const st = game.hazards.spectralState(f);
          if (st === 'on') { this._fill(this._quad(wx, wy, 0.46), '#60d8ff', fade * (0.45 + Math.sin(t * 12 + wx) * 0.12)); this._fill(this._quad(wx, wy, 0.25), '#e0ffff', fade * 0.5); }
          else if (st === 'warn') { if (Math.floor(t * 10) % 2) this._fill(this._quad(wx, wy, 0.46), '#60d8ff', fade * 0.3); }
          else this._fill(this._quad(wx, wy, 0.46), '#4a6a7a', fade * 0.18);
          break;
        }
        case 'scratch': {
          ctx.strokeStyle = '#b8b0a0'; ctx.globalAlpha = fade * 0.7; ctx.lineWidth = 1; ctx.beginPath();
          for (const o of [-0.15, 0, 0.15]) { const a = this._floorPoint(wx, wy, o - 0.12, -0.25), b = this._floorPoint(wx, wy, o + 0.12, 0.25); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
          ctx.stroke(); ctx.globalAlpha = 1;
          break;
        }
        default: break;
      }
    }
    const d = this.danger?.get(wy * 1000 + wx);
    if (d) {
      const k = Math.min(1, (game.time - d.start) / Math.max(0.1, d.until - d.start));
      this._fill(this._quad(wx, wy, 0.47), d.color, 0.25 + k * 0.4 + (Math.floor(t * 8) % 2) * 0.1);
      this._fill(this._quad(wx, wy, 0.47 * k), '#ffffff', 0.25);
    }
  }

  _drawFeature(f, game) {
    const F2 = this.spr.features;
    if (!F2) return;
    const img = {
      stairs: F2.stairs, exit: game.run?.bossDefeated ? F2.exitOn : F2.exitOff, tablet: F2.tablet,
      font: f.used ? F2.fontUsed : F2.font, shrine: f.used ? F2.shrineUsed : F2.shrine, scroll: f.used ? F2.scrollUsed : F2.scroll,
    }[f.kind];
    if (!img) return;
    const h = { stairs: 0.42, exit: 0.95, tablet: 0.45, font: 0.36, shrine: 0.55, scroll: 0.42 }[f.kind] || 0.4;
    this._billboard(img, f.x, f.y, h);
  }

  _drawCellSprites(list, game, t) {
    // chests / features first (back), then items, enemies, projectiles
    const rank = { feature: 0, chest: 0, item: 1, ally: 2, enemy: 2, proj: 3 };
    list.sort((a, b) => rank[a.type] - rank[b.type]);
    let itemIdx = 0;
    for (const s of list) {
      if (s.type === 'feature') this._drawFeature(s.f, game);
      else if (s.type === 'chest') {
        this._billboard(s.c.opened ? this.spr.chest.open : this.spr.chest.closed, s.c.x, s.c.y, 0.32);
      } else if (s.type === 'item') {
        this._drawFloorItem(s.it, itemIdx++, t);
      } else if (s.type === 'enemy') {
        this._drawEnemy(s.e, game, t);
      } else if (s.type === 'proj') {
        this._drawProjectile(s.pr);
      } else if (s.type === 'ally') {
        this._drawAlly(s.a, t);
      }
    }
  }

  // A companion Horseman seen from behind (the combat back-view art), with a small name tag.
  _drawAlly(a, t) {
    const set = this.spr.player?.[a.classId] || this.spr.player?.war;
    if (!set) return;
    const frames = set[WEAPONS[a.weaponId]?.fp || a.weaponId] || set.sword;
    const img = frames[a.swing ? 1 : 0];
    const r = this._billboard(img, a.x, a.y, 0.82, { ox: a.swing ? Math.sin(t * 30) * 2 : 0 });
    if (r && r.h > 24) drawText(this.ctx, a.name, r.x + r.w / 2, r.y - 9, a.color, { align: 'center' });
    if (r && a.guarding) { const sh = this.spr.ui.shield_hi; this.ctx.drawImage(sh, Math.round(r.x + r.w / 2 - 6), Math.round(r.y + r.h * 0.35), 12, 12); }
  }

  // Ordered-dither elliptical glow, denser toward the centre (cached per colour).
  _glow(color, w = 32, h = 10) {
    this.glows = this.glows || new Map();
    const key = `${color}|${w}x${h}`;
    let c = this.glows.get(key);
    if (c) return c;
    const m = makeCanvas(w, h);
    m.ctx.fillStyle = color;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1 && BAYER4[(y & 3) * 4 + (x & 3)] < (1 - d) * 1.3) m.ctx.fillRect(x, y, 1, 1);
    }
    this.glows.set(key, m.c);
    return m.c;
  }

  _drawFloorItem(it, idx, t) {
    const off = [[0, 0], [-0.18, 0.1], [0.18, 0.05], [0, 0.2]][idx % 4];
    const { fwd, right } = this.view;
    const wx = it.x + right.dx * off[0] + fwd.dx * off[1];
    const wy = it.y + right.dy * off[0] + fwd.dy * off[1];
    const { z, X } = this._project(wx, wy);
    if (z < 0.45) return;
    const rar = RARITIES[it.item.rarity] || RARITIES.common;
    const ctx = this.ctx;
    const sx = CX + (X * F) / z, foot = CY + (0.5 * F) / z;
    const bob = Math.sin(t * 3 + it.uid) * 0.02;
    // dithered rarity glow pool on the floor
    const gw = (0.26 * F) / z, gh = (0.07 * F) / z;
    ctx.globalAlpha = (0.35 + rar.glow * 0.5) * (0.8 + Math.sin(t * 4 + it.uid) * 0.2) * Math.max(0.25, 1 - z / 8);
    ctx.drawImage(this._glow(rar.color), Math.round(sx - gw), Math.round(foot - gh), Math.round(gw * 2), Math.round(gh * 2));
    ctx.globalAlpha = 1;
    const icon = this.spr.icons[it.item.def.icon] || this.spr.icons.shard;
    this._billboard(icon, wx, wy, 0.16, { lift: 0.04 + bob });
    if (rar.glow > 0.3 && Math.floor(t * 6 + it.uid) % 5 === 0) {
      const sp = (0.15 * F) / z;
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(sx + (hash2(Math.floor(t * 6), it.uid, 1) - 0.5) * sp * 2), Math.round(foot - sp * (1 + hash2(it.uid, Math.floor(t * 6), 2))), 1, 1);
    }
    if (it.spawnT !== undefined && t - it.spawnT < 0.5) {
      ctx.globalAlpha = 1 - (t - it.spawnT) * 2;
      ctx.fillStyle = rar.color;
      const r = ((0.35 * F) / z) * (t - it.spawnT) * 2;
      ctx.fillRect(Math.round(sx - 1), Math.round(foot - r * 2), 2, Math.round(r * 2));
      ctx.globalAlpha = 1;
    }
  }

  enemyFrame(e, t) {
    const set = this.spr[e.spriteKey];
    if (e.state === 'attack') {
      if (e.phase === 'windup') return set.windup;
      if (e.phase === 'strike') return set.attack;
    }
    if (e.state === 'hurt' || e.dying) return set.hurt;
    if (e.moveAnim > 0) return set.walk[Math.floor(t * 6) & 1];
    return set.idle[Math.floor(t * 2 + e.id) & 1];
  }

  _drawEnemy(e, game, t) {
    const img = this.enemyFrame(e, t);
    let h = e.def.scale, alpha = 1;
    if (e.dying) { const k = Math.min(1, e.deathT / 0.8); h *= 1 - k * 0.7; alpha = 1 - k; }
    // hurt shake + a short recoil on every connecting hit (Phase 6), both screen-space only
    const shakeX = (e.state === 'hurt' ? Math.sin(t * 60) * 2 : 0) + (e.recoil > 0 ? Math.sin(e.recoil * 70) * 3 * Math.min(1, e.recoil * 6) : 0);
    const r = this._billboard(img, e.rx, e.ry, h, { flash: e.flash * 5, ox: shakeX, alpha });
    if (r) {
      e.screen = r;
      if (e.state === 'detect' && !e.dying) drawText(this.ctx, '!', r.x + r.w / 2, r.y - 10, '#ffd040', { align: 'center', scale: 2 });
      if (e.state === 'attack' && e.phase === 'windup' && Math.floor(t * 10) % 2 === 0) drawText(this.ctx, '!!', r.x + r.w / 2, r.y - 10, '#ff3020', { align: 'center', scale: 2 });
      if (e.alive && e.hp < e.maxHp && !game.combat.active) {
        const bw = Math.max(16, Math.min(60, r.w));
        this.ctx.fillStyle = '#000'; this.ctx.fillRect(Math.round(r.x + r.w / 2 - bw / 2) - 1, r.y - 4, bw + 2, 4);
        this.ctx.fillStyle = '#b02010'; this.ctx.fillRect(Math.round(r.x + r.w / 2 - bw / 2), r.y - 3, Math.round(bw * e.hp / e.maxHp), 2);
      }
      if (e.alive && !game.combat.active) {
        this.drawStatusRow(this.ctx, game, e, r.x + r.w / 2, r.y - 14, false, t);
        this.drawSigils(this.ctx, game, e, r.x + r.w / 2, r.y, t);
      }
      if (e.alive && game.target === e && !game.combat.active) {
        // selected-target brackets
        const c = Math.floor(t * 4) % 2 ? '#ffe58a' : '#d8b56d';
        const x0 = r.x - 2, y0 = r.y - 2, x1 = r.x + r.w + 1, y1 = r.y + r.h + 1;
        this.ctx.fillStyle = c;
        for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
          this.ctx.fillRect(x, y, 6 * dx || 1, 1); this.ctx.fillRect(x, y, 1, 6 * dy || 1);
        }
      }
    }
  }

  // Small status chips: glyph in the status colour + remaining stacks. Readable at 1x.
  drawStatusRow(ctx, game, e, cx, y, verbose, t) {
    const list = game.status.list(e);
    if (!list.length) return;
    const w = verbose ? 0 : list.length * 11;
    let x = verbose ? 0 : Math.round(cx - w / 2);
    if (verbose) {
      const labels = list.map((s) => `${s.def.name}${s.stacks > 1 ? ' X' + s.stacks : ''} ${Math.ceil(s.left)}S`);
      const total = labels.reduce((a, l) => a + l.length * 6 + 14, 0);
      x = Math.max(8, Math.round(cx - total / 2));
      list.forEach((s, i) => {
        if (x + labels[i].length * 6 + 12 > W - 8) { x = 8; y += 11; } // wrap at the view edge
        const blink = s.left < 1.5 && Math.floor(t * 6) % 2;
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, 9, 9);
        ctx.fillStyle = blink ? '#444' : s.def.color; ctx.fillRect(x + 1, y + 1, 7, 7);
        drawText(ctx, s.def.glyph, x + 2, y + 1, '#000', { shadow: false });
        drawText(ctx, labels[i], x + 12, y + 1, s.def.color);
        x += labels[i].length * 6 + 14;
      });
      return;
    }
    for (const s of list) {
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, 10, 10);
      ctx.fillStyle = s.def.color; ctx.fillRect(x + 1, y + 1, 8, 8);
      drawText(ctx, s.stacks > 1 ? String(s.stacks) : s.def.glyph, x + 2, y + 2, '#000', { shadow: false });
      x += 11;
    }
  }

  // Big readable marks over the head: Conquest's crown mark, Death's grave sigil.
  drawSigils(ctx, game, e, cx, top, t) {
    const bob = Math.round(Math.sin(t * 4) * 2);
    if (game.status.has(e, 'mark')) {
      const y = top - 28 + bob;
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 8, y - 1, 17, 9);
      ctx.fillStyle = '#f0d070'; ctx.fillRect(cx - 7, y + 3, 15, 4);
      for (const dx of [-7, -2, 3, 7]) ctx.fillRect(cx + dx, y, 1, 3);
      ctx.fillStyle = '#c02010'; ctx.fillRect(cx, y + 4, 1, 2);
    }
    if (game.status.has(e, 'grave_mark')) {
      const y = top - 30 + bob;
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 5, y - 1, 11, 15);
      ctx.fillStyle = '#a8d8f0'; ctx.fillRect(cx - 1, y, 3, 13); ctx.fillRect(cx - 4, y + 3, 9, 3);
    }
  }

  _drawProjectile(pr) {
    const { z, X } = this._project(pr.x, pr.y);
    if (z < 0.4) return;
    const ctx = this.ctx;
    const sx = CX + (X * F) / z, sy = CY + (0.08 * F) / z;
    if (pr.kind === 'fire') {
      const r = Math.max(2, (0.1 * F) / z);
      ctx.fillStyle = '#c0300c'; ctx.fillRect(Math.round(sx - r), Math.round(sy - r), Math.round(r * 2), Math.round(r * 2));
      ctx.fillStyle = '#ffa030'; ctx.fillRect(Math.round(sx - r * 0.6), Math.round(sy - r * 0.6), Math.round(r * 1.2), Math.round(r * 1.2));
      ctx.fillStyle = '#fff0b0'; ctx.fillRect(Math.round(sx - r * 0.25), Math.round(sy - r * 0.25), Math.max(1, Math.round(r * 0.5)), Math.max(1, Math.round(r * 0.5)));
    } else {
      const len = Math.max(2, (0.12 * F) / z), wdt = Math.max(1, Math.round((0.012 * F) / z));
      ctx.fillStyle = '#8a6a40'; ctx.fillRect(Math.round(sx - wdt / 2), Math.round(sy), wdt, Math.round(len));
      ctx.fillStyle = '#d8d8d8'; ctx.fillRect(Math.round(sx - wdt / 2), Math.round(sy), wdt, Math.max(1, Math.round(len * 0.25)));
    }
  }

  // ---------------------------------------------------------------- first-person weapon
  // react: { hurt } (0..0.35s) - the weapon arm jolts down when the player is struck (Phase 6)
  renderWeapon(ctx, ws, t, moveBob, react = {}) {
    const id = WEAPONS[ws.weaponId]?.fp || ws.weaponId; // Phase 5 behaviours reuse sprites
    const a = ws.anim; // { type, t, dur, windup }
    const p = a ? Math.min(1, a.t / a.dur) : 0;
    const jolt = Math.max(0, react.hurt || 0) / 0.35;
    const bob = Math.sin(t * 2.2) * 2 + moveBob * 6 + jolt * 22;
    ctx.save();
    if (id === 'crossbow') {
      const reload = ws.cooldownLeft > 0 && !a;
      const img = reload ? this.spr.fp.crossbowEmpty : this.spr.fp.crossbow;
      let y = H - img.height * 2 + 18 + bob;
      if (a) y += Math.sin(p * Math.PI) * 14;
      if (reload) y += 60 * Math.min(1, ws.cooldownLeft / ws.cooldown);
      ctx.drawImage(img, Math.round(CX - img.width), Math.round(y), img.width * 2, img.height * 2);
    } else {
      const img = this.spr.fp[id] || this.spr.fp.fists;
      const s = 2;
      let ang = -0.25, ox = 0, oy = 0, sc = 1;
      if (a) {
        if (a.type === 'slash') {
          const k = ease(p);
          ang = lerp(0.35, -1.5, k); ox = lerp(10, -150, k); oy = Math.sin(k * Math.PI) * -30;
        } else if (a.type === 'heavy') {
          const wu = a.windup / a.dur;
          if (p < wu) { const k = p / wu; ang = lerp(-0.25, 0.6, k); oy = lerp(0, 30, k); ox = lerp(0, 20, k); }
          else { const k = ease((p - wu) / (1 - wu)); ang = lerp(0.6, -1.9, k); ox = lerp(20, -170, k); oy = lerp(30, 10, k) - Math.sin(k * Math.PI) * 40; }
        } else if (a.type === 'stab') {
          const k = Math.sin(p * Math.PI);
          ang = -0.1; ox = -60 * k; oy = -50 * k; sc = 1 + 0.25 * k;
        }
      }
      const pivX = img.width / 2, pivY = img.height * 0.82;
      const baseX = CX + 106 + ox, baseY = H + 14 + bob + oy; // right hand, anchored to the view centre
      ctx.translate(Math.round(baseX), Math.round(baseY));
      ctx.rotate(ang + jolt * 0.35);
      ctx.drawImage(img, Math.round(-pivX * s * sc), Math.round(-pivY * s * sc), Math.round(img.width * s * sc), Math.round(img.height * s * sc));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // slash trail
      if (a && (a.type === 'slash' || (a.type === 'heavy' && p > a.windup / a.dur))) {
        const k0 = a.type === 'slash' ? p : (p - a.windup / a.dur) / (1 - a.windup / a.dur);
        if (k0 > 0.1 && k0 < 0.9) {
          ctx.globalAlpha = 0.7 * Math.sin(k0 * Math.PI);
          ctx.fillStyle = a.type === 'heavy' ? '#ffd8a0' : '#f0f0ff';
          for (let i = 0; i < 26; i++) {
            const u = i / 25;
            const xx = lerp(CX + 152, CX - 132, u * k0 + (1 - k0) * 0.2);
            const yy = H * 0.55 - Math.sin(u * Math.PI) * 70 + (a.type === 'heavy' ? 20 : 0);
            ctx.fillRect(Math.round(xx), Math.round(yy), 4, 3);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- combat scene overlay
  renderCombat(ctx, game, t) {
    const e = game.combat.engaged;
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#060202'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    ctx.drawImage(this.vignette, 0, 0);
    // arena floor shadow
    ctx.fillStyle = '#0c0604';
    for (let i = 0; i < 6; i++) ctx.fillRect(CX - 120 + i * 8, H - 52 + i * 3, 240 - i * 16, 3);
    if (e) {
      const img = this.enemyFrame(e, t);
      let sc = e.def.combatScale;
      let alpha = 1, ox = 0, oy = 0;
      if (e.dying) { const k = Math.min(1, e.deathT / 0.8); alpha = 1 - k; oy = k * 30; sc *= 1 - k * 0.15; }
      if (e.state === 'hurt') ox = Math.sin(t * 70) * 4;
      if (e.state === 'attack' && e.phase === 'strike') { sc *= 1.06; oy -= 4; }
      const w = img.width * sc, h = img.height * sc;
      const x = Math.round(CX + 20 - w / 2 + ox), y = Math.round(H - 40 - h + oy);
      if (e.state === 'attack' && e.phase === 'windup') {
        const red = tinted(img, '#ff2010');
        ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.3;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.drawImage(red, x + dx, y + dy, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, Math.round(w), Math.round(h));
      if (e.flash > 0) { ctx.globalAlpha = Math.min(1, e.flash * 5) * alpha; ctx.drawImage(tinted(img, '#ffffff'), x, y, Math.round(w), Math.round(h)); }
      ctx.globalAlpha = 1;
      e.screen = { x, y, w: Math.round(w), h: Math.round(h), z: 1.5 };

      // name + HP bar
      drawText(ctx, e.name, CX, 8, e.boss ? '#ff9a60' : e.champ ? e.champ.color : e.variant ? '#ff7050' : '#e8d8b0', { align: 'center' });
      ctx.fillStyle = '#000'; ctx.fillRect(CX - 106, 18, 212, 8);
      ctx.fillStyle = '#3a0a06'; ctx.fillRect(CX - 105, 19, 210, 6);
      ctx.fillStyle = '#c02a14'; ctx.fillRect(CX - 105, 19, Math.round(210 * Math.max(0, e.hp) / e.maxHp), 6);
      ctx.fillStyle = '#ff6a40'; ctx.fillRect(CX - 105, 19, Math.round(210 * Math.max(0, e.hp) / e.maxHp), 1);
      drawText(ctx, `${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}${e.rank !== 'normal' ? '  ' + e.rank.toUpperCase() : ''}`, CX, 29, '#c8b890', { align: 'center' });
      this.drawStatusRow(ctx, game, e, CX, 58, true, t);
      this.drawSigils(ctx, game, e, x + w / 2, y + 10, t);
      if (e.state === 'attack' && e.phase === 'windup') {
        const k = Math.min(1, e.phaseT / (e.curWindup || e.def.windup * (e.windupMult || 1)));
        ctx.fillStyle = '#000'; ctx.fillRect(CX - 66, 40, 132, 6);
        ctx.fillStyle = '#ffb020'; ctx.fillRect(CX - 65, 41, Math.round(130 * k), 4);
        const melee = !e.boss || game.bossCtl._state(e).attack?.a.kind === 'melee';
        const msg = e.castName ? (melee ? `${e.castName.toUpperCase()}! GUARD [F]` : `${e.castName.toUpperCase()}! MOVE!`) : e.def.heavy ? 'HEAVY BLOW! GUARD [F]' : 'STRIKE INCOMING!';
        if (Math.floor(t * 8) % 2 === 0) drawText(ctx, msg, CX, 49, '#ffd040', { align: 'center' });
      }
    }
    // player (back view)
    const ws = game.weapons;
    const lunge = ws.anim ? Math.sin(Math.min(1, ws.anim.t / ws.anim.dur) * Math.PI) : 0;
    const set = this.spr.player[game.hero.classId] || this.spr.player.war;
    const pimg = (set[WEAPONS[ws.weaponId]?.fp || ws.weaponId] || set.sword)[lunge > 0.3 ? 1 : 0];
    const ps = 2.4;
    const guardOff = game.player.guarding ? 6 : 0;
    ctx.drawImage(pimg, Math.round(CX - 174 + lunge * 26), Math.round(H - pimg.height * ps + 26 - lunge * 10 + guardOff), Math.round(pimg.width * ps), Math.round(pimg.height * ps));
    if (game.player.guarding) {
      const sh = this.spr.ui.shield_hi;
      ctx.drawImage(sh, CX - 102, H - 120, 24, 24);
      drawText(ctx, 'GUARD', CX - 90, H - 92, '#9ad0ff', { align: 'center' });
    }
    // side threats
    const sides = game.combat.sideThreats || [];
    for (const s of sides) {
      if (Math.floor(t * 4) % 2) continue;
      if (s === 'left') drawText(ctx, '< ENEMY', 6, CY + 20, '#ff5030', { scale: 1 });
      if (s === 'right') drawText(ctx, 'ENEMY >', W - 48, CY + 20, '#ff5030', { scale: 1 });
      if (s === 'behind') drawText(ctx, 'ENEMY BEHIND!', CX, H - 14, '#ff5030', { align: 'center' });
    }
  }
}
