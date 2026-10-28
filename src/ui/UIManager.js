import { makeCanvas, hash2, BAYER4, hexToRgb } from '../render/gfx.js';
import { drawText } from '../render/PixelFont.js';

// Immediate-mode click regions + reusable carved-stone / bronze widgets.
// Regions registered while drawing frame N receive the clicks processed at the start of frame N+1.
export class UIManager {
  constructor(input, audio) {
    this.input = input;
    this.audio = audio;
    this.regions = [];
    this.next = [];
    this.patterns = new Map();
    this.ox = 0; this.oy = 0; // drawing origin (screens composed on the 640x480 grid, see GameManager._classic)
  }

  beginFrame() { this.regions = this.next; this.next = []; }

  setOrigin(x, y) { this.ox = x; this.oy = y; }

  // Registers a clickable rect (in current origin coordinates); returns hover state for drawing.
  button(x, y, w, h, onClick, opts = {}) {
    this.next.push({ x: x + this.ox, y: y + this.oy, w, h, onClick, sound: opts.sound !== false });
    return this.hover(x, y, w, h);
  }

  // Swallows clicks over an area (modal backdrops).
  block(x, y, w, h) { this.next.push({ x: x + this.ox, y: y + this.oy, w, h, onClick: null }); }

  hover(x, y, w, h) {
    const m = this.input.mouse, mx = m.x - this.ox, my = m.y - this.oy;
    return mx >= x && my >= y && mx < x + w && my < y + h;
  }

  processClicks(clicks) {
    for (const c of clicks) {
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const r = this.regions[i];
        if (c.x >= r.x && c.y >= r.y && c.x < r.x + r.w && c.y < r.y + r.h) {
          if (r.onClick) { if (r.sound) this.audio.play('ui'); r.onClick(c); }
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- drawing kit
  stonePattern(ctx, theme) {
    let pat = this.patterns.get(theme.id);
    if (pat) return pat;
    const { c, ctx: p } = makeCanvas(64, 64);
    const L = hexToRgb(theme.stoneLight), M = hexToRgb(theme.stoneMid), D = hexToRgb(theme.stoneDark);
    const img = p.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const n = hash2(x >> 1, y >> 1, 77) * 0.6 + hash2(x, y, 78) * 0.4;
      const b = BAYER4[(y & 3) * 4 + (x & 3)];
      const v = n + (b - 0.5) * 0.25;
      const col = v > 0.72 ? L : v > 0.32 ? M : D;
      const i = (y * 64 + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    p.putImageData(img, 0, 0);
    // faint carved cracks
    p.fillStyle = theme.stoneDeep;
    for (let i = 0; i < 6; i++) {
      let x = Math.floor(hash2(i, 1, 9) * 64), y = Math.floor(hash2(i, 2, 9) * 64);
      for (let k = 0; k < 8; k++) { p.fillRect(x & 63, y & 63, 1, 1); x += hash2(i, k, 4) > 0.5 ? 1 : 0; y += 1; }
    }
    pat = ctx.createPattern(c, 'repeat');
    this.patterns.set(theme.id, pat);
    return pat;
  }

  // Weathered stone frame with bevel, bronze inner trim and corner studs.
  frame(ctx, x, y, w, h, theme, opts = {}) {
    const b = opts.border ?? 4;
    ctx.fillStyle = this.stonePattern(ctx, theme);
    ctx.fillRect(x, y, w, h);
    // bevel
    ctx.fillStyle = theme.stoneLight; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = theme.stoneDeep; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
    if (opts.fill !== false) {
      ctx.fillStyle = theme.stoneDeep; ctx.fillRect(x + b - 1, y + b - 1, w - b * 2 + 2, h - b * 2 + 2);
      ctx.fillStyle = theme.bronzeDark; ctx.fillRect(x + b, y + b, w - b * 2, h - b * 2);
      ctx.fillStyle = opts.panel || theme.panel; ctx.fillRect(x + b + 1, y + b + 1, w - b * 2 - 2, h - b * 2 - 2);
      ctx.fillStyle = theme.bronze; ctx.fillRect(x + b, y + b, w - b * 2, 1); ctx.fillRect(x + b, y + b, 1, h - b * 2);
    }
    if (opts.studs !== false) {
      for (const [sx, sy] of [[x + 1, y + 1], [x + w - 4, y + 1], [x + 1, y + h - 4], [x + w - 4, y + h - 4]]) {
        ctx.fillStyle = theme.bronzeDark; ctx.fillRect(sx, sy, 3, 3);
        ctx.fillStyle = theme.bronzeLight; ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  // Thin bronze-edged dark box (command menu, tooltips).
  box(ctx, x, y, w, h, theme, bg) {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = theme.bronzeDark; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = bg || theme.panel; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = theme.bronze; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  }

  // Rectangular carved button with label.
  textButton(ctx, x, y, w, h, label, theme, onClick, opts = {}) {
    const hov = this.button(x, y, w, h, onClick);
    const sel = opts.selected || hov;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = sel ? theme.bronze : theme.stoneMid; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = sel ? theme.bronzeLight : theme.stoneLight; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = theme.stoneDeep; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
    const col = opts.disabled ? theme.textDim : sel ? '#1a1206' : theme.text;
    drawText(ctx, label, x + w / 2, y + Math.floor((h - 7) / 2), col, { align: 'center', shadow: sel ? false : '#000' });
    return hov;
  }

  // Round engraved metal button (utility controls).
  roundButton(ctx, cx, cy, r, glyph, glyphHi, theme, onClick, label) {
    const hov = this.button(cx - r, cy - r, r * 2, r * 2, onClick);
    const ring = (rad, col) => {
      ctx.fillStyle = col;
      for (let yy = -rad; yy <= rad; yy++) {
        const hw = Math.floor(Math.sqrt(rad * rad - yy * yy));
        ctx.fillRect(cx - hw, cy + yy, hw * 2 + 1, 1);
      }
    };
    ring(r, '#000');
    ring(r - 1, theme.bronzeDark);
    ring(r - 2, hov ? theme.bronzeLight : theme.bronze);
    ring(r - 4, theme.bronzeDark);
    ring(r - 5, hov ? '#3a2c16' : '#241a0c');
    ctx.fillStyle = theme.bronzeLight; ctx.fillRect(cx - r + 4, cy - 2, 1, 4); ctx.fillRect(cx - 2, cy - r + 3, 4, 1);
    const g = hov ? glyphHi : glyph;
    ctx.drawImage(g, cx - 6, cy - 6);
    if (hov && label) this.tooltip = { text: label, x: cx, y: cy - r - 10 };
    return hov;
  }

  drawTooltip(ctx, theme) {
    if (!this.tooltip) return;
    const t = this.tooltip;
    const w = t.text.length * 6 + 8;
    const x = Math.max(2, Math.min(ctx.canvas.width - 2 - w, t.x - w / 2));
    this.box(ctx, x, t.y, w, 11, theme, '#0c0a06');
    drawText(ctx, t.text, x + 4, t.y + 2, theme.highlight);
    this.tooltip = null;
  }

  bar(ctx, x, y, w, h, frac, fg, bg = '#1a0a06', vertical = false) {
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg;
    if (vertical) { const fh = Math.round(h * frac); ctx.fillRect(x, y + h - fh, w, fh); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y + h - fh, 1, fh); }
    else { const fw = Math.round(w * frac); ctx.fillRect(x, y, fw, h); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, fw, 1); }
  }
}
