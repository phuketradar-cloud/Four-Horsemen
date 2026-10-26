import { drawText } from './PixelFont.js';

// Fixed-size pools for particles and floating numbers: no per-frame allocation, no leaks.
// Coordinates are in inner-viewport space.
const MAX_PARTICLES = 400;
const MAX_TEXTS = 48;
const MAX_OVERLAYS = 24;

export class Effects {
  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));
    this.texts = Array.from({ length: MAX_TEXTS }, () => ({ active: false }));
    this.overlays = Array.from({ length: MAX_OVERLAYS }, () => ({ active: false })); // skill FX drawables
    this.shake = 0;
    this.flash = { color: '#f00', t: 0, dur: 0 };
    this.banner = null; // { text, color, t, dur }
  }

  clear() {
    for (const p of this.particles) p.active = false;
    for (const t of this.texts) t.active = false;
    for (const o of this.overlays) o.active = false;
    this.shake = 0; this.flash.t = 0; this.banner = null; this.hurtDir = null;
  }

  _slot(pool) {
    for (const p of pool) if (!p.active) return p;
    // pool full: recycle the oldest
    let oldest = pool[0];
    for (const p of pool) if (p.age > oldest.age) oldest = p;
    return oldest;
  }

  burst(x, y, color, count = 10, opts = {}) {
    const speed = opts.speed ?? 60, life = opts.life ?? 0.6, gravity = opts.gravity ?? 160, size = opts.size ?? 2;
    for (let i = 0; i < count; i++) {
      const p = this._slot(this.particles);
      const a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      Object.assign(p, {
        active: true, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.lift ?? 30),
        life: life * (0.6 + Math.random() * 0.6), age: 0, color: Array.isArray(color) ? color[i % color.length] : color,
        g: gravity, size: size + (Math.random() < 0.3 ? 1 : 0), drag: opts.drag ?? 0.9,
      });
    }
  }

  sparkleColumn(x, y, color, count = 30) {
    for (let i = 0; i < count; i++) {
      const p = this._slot(this.particles);
      Object.assign(p, {
        active: true, x: x + (Math.random() - 0.5) * 60, y: y + Math.random() * 40, vx: 0, vy: -30 - Math.random() * 60,
        life: 0.8 + Math.random() * 0.8, age: 0, color, g: -20, size: 2, drag: 1,
      });
    }
  }

  // draw(ctx, k, age): k = 0..1 progress. delay postpones the start.
  overlay(dur, draw, delay = 0) {
    const o = this._slot(this.overlays);
    Object.assign(o, { active: true, age: -delay, life: dur, draw });
  }

  text(x, y, str, color = '#fff', scale = 2, life = 0.9) {
    const t = this._slot(this.texts);
    Object.assign(t, { active: true, x, y, str, color, scale, life, age: 0, vy: -38 });
  }

  // Phase 6 accessibility applied centrally (settings = the game's live settings object):
  // reduced shake caps/scales every shake; reduced flashing shortens flashes and lowers their opacity.
  addShake(amount) { if (this.settings?.reduceShake) amount = Math.min(2, amount * 0.35); this.shake = Math.max(this.shake, amount); }
  screenFlash(color, dur = 0.25) { if (this.settings?.reduceFlash) dur = Math.min(dur, 0.12); this.flash = { color, t: dur, dur, max: this.settings?.reduceFlash ? 0.15 : 0.45 }; }
  // Damage-direction cue: a short red edge on the side the blow came from (front/left/right/behind).
  damageFrom(side, color = '#ff2010') { this.hurtDir = { side, t: 0, dur: 0.55, color }; }
  showBanner(text, color = '#ffe58a', dur = 2) { this.banner = { text, color, t: 0, dur }; }

  update(dt) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) { p.active = false; continue; }
      p.vx *= Math.pow(p.drag, dt * 60); p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const o of this.overlays) {
      if (!o.active) continue;
      o.age += dt;
      if (o.age >= o.life) o.active = false;
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.life) { t.active = false; continue; }
      t.y += t.vy * dt; t.vy *= 0.94;
    }
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.flash.t > 0) this.flash.t -= dt;
    if (this.hurtDir) { this.hurtDir.t += dt; if (this.hurtDir.t >= this.hurtDir.dur) this.hurtDir = null; }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
  }

  render(ctx, w, h) {
    for (const o of this.overlays) {
      if (!o.active || o.age < 0) continue;
      ctx.save();
      try { o.draw(ctx, Math.min(1, o.age / o.life), o.age); } catch (err) { o.active = false; console.error(err); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, (1 - p.age / p.life) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      if (!t.active) continue;
      const k = t.age / t.life;
      if (k > 0.7 && Math.floor(t.age * 20) % 2) continue; // retro blink-out
      const pop = t.age < 0.08 ? 1.5 : 1;
      drawText(ctx, t.str, t.x, t.y, t.color, { scale: Math.round(t.scale * pop), align: 'center', shadow: '#000' });
    }
    if (this.flash.t > 0) {
      ctx.globalAlpha = Math.max(0, this.flash.t / this.flash.dur) * (this.flash.max ?? 0.45);
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    const hd = this.hurtDir;
    if (hd && hd.t < hd.dur) {
      const k = 1 - hd.t / hd.dur, th = 10;
      ctx.fillStyle = hd.color;
      for (let i = 0; i < 4; i++) { // soft 4-step gradient edge
        ctx.globalAlpha = k * (0.55 - i * 0.12) * (this.settings?.reduceFlash ? 0.5 : 1);
        const d = i * (th / 4);
        if (hd.side === 'left') ctx.fillRect(d, 0, th / 4, h);
        else if (hd.side === 'right') ctx.fillRect(w - d - th / 4, 0, th / 4, h);
        else if (hd.side === 'behind') ctx.fillRect(0, h - d - th / 4, w, th / 4);
        else ctx.fillRect(0, d, w, th / 4);
      }
      ctx.globalAlpha = 1;
    }
    if (this.banner) {
      const b = this.banner;
      const a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.75;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, h / 2 - 24, w, 40);
      ctx.globalAlpha = Math.max(0, a);
      drawText(ctx, b.text, w / 2, h / 2 - 14, b.color, { scale: 3, align: 'center' });
      ctx.globalAlpha = 1;
    }
  }
}
