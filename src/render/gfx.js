// Low-level pixel-art helpers: offscreen canvases, pixel plotting, outlines, tints.
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Pixel painter on a small canvas — only integer rects, so output stays crisp pixel art.
export class Pix {
  constructor(w, h) {
    const { c, ctx } = makeCanvas(w, h);
    this.c = c; this.ctx = ctx; this.w = w; this.h = h;
  }
  px(x, y, col) { this.ctx.fillStyle = col; this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  rect(x, y, w, h, col) { this.ctx.fillStyle = col; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  line(x0, y0, x1, y1, col, th = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.ctx.fillStyle = col;
    const o = Math.floor((th - 1) / 2);
    for (let guard = 0; guard < 2000; guard++) {
      this.ctx.fillRect(x0 - o, y0 - o, th, th);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  disc(cx, cy, r, col) {
    this.ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const hw = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
      this.ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  ellipse(cx, cy, rx, ry, col) {
    this.ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
      this.ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  poly(points, col) {
    // scanline fill for small convex/concave polygons
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
    this.ctx.fillStyle = col;
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) {
          xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.ctx.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1] - xs[i])), 1);
    }
  }
  // 1px dark outline around opaque pixels (classic sprite readability).
  outline(col = '#0a0806') {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data, w = this.w, h = this.h;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const [r, g, b] = hexToRgb(col);
    const marks = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push((y * w + x) * 4);
    }
    for (const i of marks) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }
}

// Flat-colour silhouette of a sprite (used for hit flash, distance fog, shadows).
const tintCache = new WeakMap();
export function tinted(src, color) {
  let m = tintCache.get(src);
  if (!m) { m = new Map(); tintCache.set(src, m); }
  let t = m.get(color);
  if (t) return t;
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  m.set(color, c);
  return c;
}
