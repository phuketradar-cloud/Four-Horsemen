import { drawText, wrapText } from '../render/PixelFont.js';

// Phase 6 notification center: one consistent place for item / quest / chapter / level / craft /
// equipment / inventory / save messages. Each kind has a colour, priority, duration and sound.
// Errors are STICKY: they stay until clicked (or replaced by the same message), so a failed save
// can never flash by unread. Identical messages within 1.5s merge (xN) instead of stacking.
export const NOTICE_KINDS = {
  info: { color: '#d8c8a0', prio: 1, dur: 3, sound: null },
  item: { color: '#c8c0a8', prio: 1, dur: 2.5, sound: null },
  rare: { color: '#5a8ff0', prio: 2, dur: 3.5, sound: 'rareLoot' },
  epic: { color: '#b25ae0', prio: 3, dur: 4, sound: 'rareLoot' },
  legendary: { color: '#f29a2a', prio: 4, dur: 5, sound: 'legendaryLoot' },
  mythic: { color: '#ff5a6e', prio: 5, dur: 6, sound: 'mythicLoot' },
  quest: { color: '#e8c860', prio: 2, dur: 3, sound: 'quest' },
  questDone: { color: '#ffd040', prio: 4, dur: 4.5, sound: 'questDone' },
  chapter: { color: '#ff9a40', prio: 5, dur: 5, sound: null },
  level: { color: '#ffd040', prio: 4, dur: 4, sound: null },
  craft: { color: '#7ac060', prio: 2, dur: 3, sound: null },
  equip: { color: '#c8b070', prio: 1, dur: 2, sound: null },
  warn: { color: '#ff9a60', prio: 3, dur: 5, sound: 'notify' },
  save: { color: '#7ac060', prio: 1, dur: 2, sound: 'saveOk' },
  error: { color: '#ff5a4a', prio: 6, dur: Infinity, sound: 'saveFail' },
};
const MAX_VISIBLE = 4;

export class NoticeCenter {
  constructor(audio) { this.audio = audio; this.list = []; this.history = []; }
  reset() { this.list = this.list.filter((n) => n.kind === 'error'); } // errors survive a scene change

  push(text, { kind = 'info', sound = true } = {}) {
    const k = NOTICE_KINDS[kind] ? kind : 'info';
    const def = NOTICE_KINDS[k];
    const same = this.list.find((n) => n.text === text && n.kind === k && n.t < 1.5);
    if (same) { same.count++; same.t = 0; return same; }
    const n = { text, kind: k, color: def.color, prio: def.prio, dur: def.dur, t: 0, count: 1 };
    this.list.push(n);
    this.history.push({ text, kind: k });
    if (this.history.length > 60) this.history.shift();
    if (sound && def.sound) this.audio?.play(def.sound);
    // too many: drop the oldest LOW-priority one (never an error)
    while (this.list.filter((x) => x.kind !== 'error').length > 8) {
      const victim = [...this.list].filter((x) => x.kind !== 'error').sort((a, b) => a.prio - b.prio || b.t - a.t)[0];
      this.list.splice(this.list.indexOf(victim), 1);
    }
    return n;
  }

  update(dt) {
    for (const n of this.list) n.t += dt;
    this.list = this.list.filter((n) => n.t < n.dur);
  }
  dismiss(n) { const i = this.list.indexOf(n); if (i >= 0) this.list.splice(i, 1); }

  // Top-right stack (screen space). Highest priority first; errors are clickable to dismiss.
  draw(ctx, ui, x = 634, y = 28, w = 236) {
    const shown = [...this.list].sort((a, b) => b.prio - a.prio || a.t - b.t).slice(0, MAX_VISIBLE);
    let yy = y;
    for (const n of shown) {
      const lines = wrapText(n.text + (n.count > 1 ? ` x${n.count}` : ''), Math.floor((w - 12) / 6)).slice(0, 3);
      const h = 6 + lines.length * 9 + (n.kind === 'error' ? 9 : 0);
      const fade = n.dur === Infinity ? 1 : Math.min(1, n.t * 6, (n.dur - n.t) * 2);
      const slide = Math.max(0, 1 - n.t * 6) * 30;
      ctx.globalAlpha = Math.max(0, fade) * 0.88;
      ctx.fillStyle = '#0a0806'; ctx.fillRect(x - w + slide, yy, w, h);
      ctx.fillStyle = n.color; ctx.fillRect(x - w + slide, yy, 2, h);
      ctx.globalAlpha = Math.max(0, fade);
      lines.forEach((l, i) => drawText(ctx, l, x - w + 7 + slide, yy + 4 + i * 9, n.color));
      if (n.kind === 'error') {
        drawText(ctx, 'CLICK TO DISMISS', x - 6 + slide, yy + h - 9, '#8c8467', { align: 'right' });
        ui?.button(x - w, yy, w, h, () => this.dismiss(n));
      }
      ctx.globalAlpha = 1;
      yy += h + 3;
    }
    return yy - y;
  }
}
