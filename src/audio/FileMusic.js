import { MUSIC_FILES, MUSIC_BASE, MUSIC_FILE_TUNING } from '../data/musicFiles.js';

// Looped music files (data/musicFiles.js) played through the music bus, so the MUSIC / MASTER
// volume and mute settings apply. Files are streamed (<audio> element), not decoded into memory,
// and only loaded the first time their state is wanted. Until a file can play - or if it fails -
// pick() returns null and AudioManager keeps the synthesized track for that state.
export class FileMusic {
  constructor(ctx, out, files = MUSIC_FILES, base = MUSIC_BASE, tuning = MUSIC_FILE_TUNING) {
    this.ctx = ctx; this.out = out; this.files = files; this.base = base; this.tuning = tuning;
    this.tracks = {};      // key -> { el, gain, ready, failed, vol }
    this.current = null;   // key of the track fading in / playing
    this.onReady = null;   // called when a file finishes loading (AudioManager re-routes)
  }

  // first listed key (variant before plain state) whose file can play now; starts loading listed ones
  pick(keys) {
    for (const key of keys) {
      if (!this.files[key]) continue;
      const tr = this._track(key);
      if (tr.ready && !tr.failed) return key; // still loading: try the next key; onReady re-routes
    }
    return null;
  }

  _track(key) {
    if (this.tracks[key]) return this.tracks[key];
    const def = this.files[key], file = typeof def === 'string' ? def : def.file;
    const el = new Audio(); el.loop = true; el.preload = 'auto';
    const gain = this.ctx.createGain(); gain.gain.value = 0; gain.connect(this.out);
    const tr = { el, gain, ready: false, failed: false, vol: (def.gain ?? 1) * (this.tuning.gain ?? 1) };
    el.addEventListener('canplay', () => { if (tr.ready) return; tr.ready = true; this.onReady?.(key); }, { once: true });
    el.addEventListener('error', () => { tr.failed = true; console.warn(`[music] ${file}: not found - keeping the synthesized track`); this.onReady?.(key); }, { once: true });
    try { this.ctx.createMediaElementSource(el).connect(gain); } catch (err) { tr.failed = true; console.warn('[music] file playback unavailable', err); }
    el.src = this.base + file;
    this.tracks[key] = tr;
    return tr;
  }

  play(key) {
    if (key === this.current) return;
    const t = this.ctx.currentTime, tc = (this.tuning.fade ?? 1.5) / 3;
    this._fadeOutOthers(key, t, tc);
    const tr = this._track(key);
    if ((this.tuning.restart || []).includes(key.split(':')[0])) try { tr.el.currentTime = 0; } catch { /* not seekable yet */ }
    clearTimeout(tr.pauseTimer);
    tr.el.play().catch((err) => console.warn('[music] play blocked', err));
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setTargetAtTime(tr.vol, t, tc);
    this.current = key;
  }

  stop() {
    if (!this.current) return;
    this._fadeOutOthers(null, this.ctx.currentTime, (this.tuning.fade ?? 1.5) / 3);
    this.current = null;
  }

  _fadeOutOthers(keep, t, tc) {
    for (const [k, tr] of Object.entries(this.tracks)) {
      if (k === keep) continue;
      tr.gain.gain.cancelScheduledValues(t);
      tr.gain.gain.setTargetAtTime(0, t, tc);
      clearTimeout(tr.pauseTimer);
      tr.pauseTimer = setTimeout(() => { if (this.current !== k) tr.el.pause(); }, tc * 6000);
    }
  }

  // dip under a stinger, then come back if the same track is still wanted
  duck(seconds) {
    const tr = this.tracks[this.current];
    if (!tr) return;
    const t = this.ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setTargetAtTime(0.0001, t, 0.1);
    tr.gain.gain.setTargetAtTime(tr.vol, t + Math.max(0.2, seconds), 0.6);
  }
}
