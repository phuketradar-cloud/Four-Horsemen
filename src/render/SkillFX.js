import { LAYOUT } from '../data/config.js';
import { BAYER4 } from './gfx.js';

// CombatFeedback: each Horseman's visual language, built from pixel particles and short-lived
// overlays (pooled in Effects). Kept lightweight and below the HUD so it never hides HP/skills.
const W = LAYOUT.view.w, H = LAYOUT.view.h;
const ORIGIN = { x: W / 2 + 40, y: H - 30 };
const PORTRAIT = { x: 10, y: 10 }; // souls / drains fly toward the hero (upper-left)

function px(ctx, x, y, s, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), s, s); }

// Pixel line made of squares (keeps the retro look; no anti-aliased strokes).
function pline(ctx, x0, y0, x1, y1, s, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, s * 0.8)));
  for (let i = 0; i <= n; i++) px(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, s, c);
}

function arc(ctx, cx, cy, r, a0, a1, progress, s, c) {
  const n = 40;
  for (let i = 0; i <= n * progress; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, c);
  }
}

export class SkillFX {
  constructor(game) { this.game = game; }
  get fx() { return this.game.effects; }
  point(e) { return e ? this.game.combat.screenPoint(e) : { x: W / 2, y: H / 2 - 20 }; }

  play(id, targets = [], p = {}) {
    const fn = this[id];
    if (typeof fn === 'function') fn.call(this, targets, p);
  }

  // ------------------------------------------------ CONQUEST — white/gold light
  streak(from, to, dur, delay, core = '#ffffff', glow = '#f0d070') {
    this.fx.overlay(dur, (ctx, k) => {
      const head = Math.min(1, k * 1.6), tail = Math.max(0, k * 1.6 - 0.5);
      const x0 = from.x + (to.x - from.x) * tail, y0 = from.y + (to.y - from.y) * tail;
      const x1 = from.x + (to.x - from.x) * head, y1 = from.y + (to.y - from.y) * head;
      ctx.globalAlpha = 1 - k * 0.5;
      pline(ctx, x0, y0, x1, y1, 3, glow);
      pline(ctx, x0, y0, x1, y1, 1, core);
    }, delay);
  }
  goldBolt(targets) {
    const far = targets[targets.length - 1];
    this.streak(ORIGIN, this.point(far), 0.35, 0);
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y, ['#ffffff', '#f0d070'], 10, { speed: 70 }); }
  }
  volley(targets, p) {
    const q = this.point(targets[0]);
    const n = (p.effects?.[0]?.hits) || 3;
    for (let i = 0; i < n; i++) this.streak({ x: 40 + Math.random() * (W - 80), y: H - 10 }, q, 0.3, i * 0.12, '#ffffff', '#c8e0ff');
  }
  markSigil(targets) {
    const e = targets[0];
    this.fx.overlay(0.6, (ctx, k) => {
      const q = this.point(e);
      const r = 18 - k * 8;
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + k * 2; px(ctx, q.x + Math.cos(a) * r, q.y - 10 + Math.sin(a) * r, 3, '#f0d070'); }
    });
  }
  decree(targets) {
    const e = targets[0];
    this.fx.overlay(0.6, (ctx, k) => {
      const q = this.point(e);
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pline(ctx, q.x + Math.cos(a) * 6, q.y + Math.sin(a) * 6, q.x + Math.cos(a) * (10 + k * 30), q.y + Math.sin(a) * (10 + k * 30), 2, '#e8c060'); }
    });
  }
  worldConqueror(targets) {
    const q = this.point(targets[0]);
    for (let i = 0; i < 12; i++) {
      const from = i % 2 ? { x: Math.random() * W, y: 0 } : { x: i % 4 ? 0 : W, y: Math.random() * H * 0.6 };
      this.streak(from, q, 0.35, i * 0.07);
    }
    this.fx.burst(q.x, q.y, ['#ffffff', '#f0d070', '#fff0b0'], 40, { speed: 140 });
    this.fx.addShake(5);
  }

  // ------------------------------------------------ WAR — red impact, heavy arcs
  redArc(targets) {
    this.fx.overlay(0.3, (ctx, k) => {
      ctx.globalAlpha = 1 - k * 0.7;
      arc(ctx, W / 2, H * 0.9, 150, Math.PI * 1.05, Math.PI * 1.95, Math.min(1, k * 2), 4, '#ff3020');
      arc(ctx, W / 2, H * 0.9, 146, Math.PI * 1.05, Math.PI * 1.95, Math.min(1, k * 2), 2, '#ffd0a0');
    });
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y + 10, ['#ff3020', '#ff8a30', '#ffd040'], 14, { speed: 100 }); }
    this.fx.addShake(4);
  }
  groundCrack() {
    const cracks = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI + (i / 6) * Math.PI;
      const pts = [[W / 2, H - 10]];
      for (let s = 1; s <= 6; s++) pts.push([W / 2 + Math.cos(a) * s * 26 + (Math.random() - 0.5) * 12, H - 10 + Math.sin(a) * s * 9 * 0.6]);
      return pts;
    });
    this.fx.overlay(0.9, (ctx, k) => {
      ctx.globalAlpha = 1 - k;
      for (const pts of cracks) for (let i = 1; i < pts.length; i++) pline(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 2, i < 3 ? '#ff6020' : '#601008');
    });
    this.fx.burst(W / 2, H - 20, ['#5a4632', '#8a6a4a', '#ff6020'], 30, { speed: 120, angle: -Math.PI / 2, spread: Math.PI });
    this.fx.addShake(9);
  }
  bloodAura() {
    this.fx.sparkleColumn(W / 2, H - 50, '#ff3020', 30);
    this.fx.overlay(0.8, (ctx, k) => {
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = '#a00000';
      for (let y = 0; y < H; y += 2) for (let x = 0; x < 6; x++) if (BAYER4[(y & 3) * 4 + (x & 3)] > k) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(W - 1 - x, y, 1, 1); }
    });
  }
  redApocalypse(targets) {
    for (let w = 0; w < 3; w++) {
      this.fx.overlay(0.3, (ctx, k) => {
        ctx.globalAlpha = (1 - k) * 0.9;
        arc(ctx, W / 2, H * 0.95, 160 - w * 20, Math.PI * (1.05 + w * 0.05), Math.PI * 1.95, Math.min(1, k * 2.2), 5, w % 2 ? '#ff8a30' : '#ff2010');
      }, w * 0.18);
    }
    this.groundCrack();
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y, ['#ff2010', '#ffd040'], 24, { speed: 150 }); }
  }

  // ------------------------------------------------ FAMINE — smoke, withering, drain
  witherTouch(targets) {
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y, ['#b0b040', '#6a7020', '#2a1e30'], 18, { speed: 40, gravity: 60, lift: 0, life: 1 }); }
  }
  drain(e) {
    const q = this.point(e);
    for (let i = 0; i < 14; i++) {
      const sx = q.x + (Math.random() - 0.5) * 20, sy = q.y + (Math.random() - 0.5) * 20;
      const d = 0.5 + Math.random() * 0.4;
      this.fx.overlay(d, (ctx, k) => {
        const x = sx + (ORIGIN.x - 120 - sx) * k, y = sy + (ORIGIN.y - sy) * k - Math.sin(k * Math.PI) * 30;
        ctx.globalAlpha = 1 - k * 0.4;
        px(ctx, x, y, 2, i % 2 ? '#80ff60' : '#b0b040');
      }, i * 0.03);
    }
  }
  plagueCloud(targets) {
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y, ['#60b030', '#3a6a20', '#1a2a10'], 26, { speed: 25, gravity: -25, lift: 10, size: 3, life: 1.4, drag: 0.95 }); }
  }
  starveField() {
    this.fx.overlay(1.4, (ctx, k) => {
      const a = Math.sin(k * Math.PI);
      ctx.fillStyle = '#3a1a50';
      for (let y = H - 80; y < H; y++) {
        const hw = (W / 2) * Math.sqrt(Math.max(0, 1 - ((H - y - 40) / 40) ** 2));
        for (let x = Math.floor(W / 2 - hw); x < W / 2 + hw; x++) if (BAYER4[(y & 3) * 4 + (x & 3)] < a * 0.6) ctx.fillRect(x, y, 1, 1);
      }
    });
    this.fx.burst(W / 2, H - 40, ['#2a1e30', '#6a4a8a', '#b0b040'], 40, { speed: 90, gravity: -20, lift: 20, size: 3, life: 1.2 });
  }
  lastHarvest(targets) {
    this.fx.overlay(0.8, (ctx, k) => {
      ctx.globalAlpha = 0.55 * Math.sin(k * Math.PI);
      ctx.fillStyle = '#0a0a04';
      const x = -W + k * W * 2;
      ctx.fillRect(Math.round(x), 0, W, H);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 12; i++) px(ctx, x + W - 2, (i / 12) * H + ((k * 400) % 20), 2, '#d0d060');
    });
    for (const e of targets) this.drain(e);
  }

  // ------------------------------------------------ DEATH — wisps, pale scythes, sigils
  soulRend(targets) {
    for (const e of targets) {
      const q = this.point(e);
      this.fx.overlay(0.3, (ctx, k) => {
        ctx.globalAlpha = 1 - k;
        pline(ctx, q.x - 30 + k * 10, q.y - 30, q.x + 30 - k * 10, q.y + 30, 3, '#a8d8f0');
        pline(ctx, q.x - 30 + k * 10, q.y - 30, q.x + 30 - k * 10, q.y + 30, 1, '#ffffff');
      });
      this.fx.burst(q.x, q.y, ['#c0e8ff', '#80c0e0'], 12, { speed: 60, gravity: -30 });
    }
  }
  graveSigil(targets) {
    const e = targets[0];
    this.fx.overlay(0.9, (ctx, k) => {
      const q = this.point(e);
      ctx.globalAlpha = 1 - k;
      const s = 10 + k * 14;
      pline(ctx, q.x, q.y - s - 10, q.x, q.y + s - 10, 2, '#a8d8f0');
      pline(ctx, q.x - s * 0.6, q.y - 14, q.x + s * 0.6, q.y - 14, 2, '#a8d8f0');
    });
  }
  wraith() {
    const dur = 1.6;
    this.fx.overlay(dur, (ctx, k) => {
      ctx.fillStyle = '#c0e8ff';
      const a = 0.5 * (1 - k);
      for (let y = 0; y < H; y += 1) for (let x = 0; x < 10; x++) if (BAYER4[(y & 3) * 4 + (x & 3)] < a * (1 - x / 10)) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(W - 1 - x, y, 1, 1); }
    });
    this.fx.sparkleColumn(W / 2, H - 40, '#c0e8ff', 20);
  }
  scythe(targets) {
    this.fx.overlay(0.4, (ctx, k) => {
      ctx.globalAlpha = 1 - k * 0.6;
      arc(ctx, W * 0.75, H * 0.2, 170, Math.PI * 0.55, Math.PI * 1.1, Math.min(1, k * 2), 4, '#a8d8f0');
      arc(ctx, W * 0.75, H * 0.2, 166, Math.PI * 0.55, Math.PI * 1.1, Math.min(1, k * 2), 1, '#ffffff');
    });
    for (const e of targets) { const q = this.point(e); this.fx.burst(q.x, q.y, ['#c0e8ff', '#e8f8ff'], 14, { speed: 80 }); }
  }
  finalSilence(targets) {
    this.fx.overlay(1.3, (ctx, k) => {
      ctx.globalAlpha = 0.4 * Math.sin(k * Math.PI);
      ctx.fillStyle = '#04080c';
      ctx.fillRect(0, 0, W, H);
    });
    this.scythe(targets);
    this.fx.overlay(0.4, (ctx, k) => {
      ctx.globalAlpha = 1 - k * 0.6;
      arc(ctx, W * 0.25, H * 0.2, 170, Math.PI * 0.45, Math.PI * -0.1, Math.min(1, k * 2), 4, '#e8f8ff');
    }, 0.35);
    for (const e of targets) this.soulCollect(e, 6);
    this.fx.addShake(6);
  }
  soulCollect(e, n = 4) {
    const q = this.point(e);
    for (let i = 0; i < n; i++) {
      const d = 0.7 + Math.random() * 0.3;
      const wob = Math.random() * 6;
      this.fx.overlay(d, (ctx, k) => {
        const x = q.x + (PORTRAIT.x - q.x) * k + Math.sin(k * 12 + wob) * 6, y = q.y + (PORTRAIT.y - q.y) * k;
        ctx.globalAlpha = 1 - k * 0.3;
        px(ctx, x, y, 3, '#80c0e0'); px(ctx, x + 1, y + 1, 1, '#ffffff');
      }, i * 0.08);
    }
  }
}
