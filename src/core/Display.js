import { SCREEN, RESOLUTIONS } from '../data/config.js';

// Presents the 960x540 (16:9) logical frame on the visible canvas.
// - Integer factor (1920x1080 = 2x, 3840x2160 = 4x): one nearest-neighbour copy, every pixel square.
// - Any other size (1280x720 = 1.33x, 2560x1440 = 2.67x): "sharp bilinear" - nearest-neighbour up to the
//   next whole factor, then one smooth step down. Pixels stay square and evenly sized; only their
//   1px seams are softened, so pixel art is never stretched unevenly or blurred as a whole.
// - scaling 'integer': the largest whole factor that fits, letterboxed (pure nearest-neighbour).
// The canvas backing store is sized in DEVICE pixels, so HiDPI screens get the real resolution.
export class Display {
  constructor(canvas, source, settings) {
    this.canvas = canvas;          // visible <canvas id="game">
    this.source = source;          // logical 960x540 canvas the game draws on
    this.settings = settings;      // { resolution, scaling } (persisted with the other settings)
    this.ctx = canvas.getContext('2d');
    this.mid = null;               // intermediate nearest-neighbour canvas (sharp mode only)
    this.out = { w: SCREEN.w, h: SCREEN.h, k: 1, mode: 'integer' };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.layout());
      document.addEventListener('fullscreenchange', () => this.layout());
    }
    this.layout();
  }

  get fullscreen() { return typeof document !== 'undefined' && !!document.fullscreenElement; }

  // Largest 16:9 output (device px) allowed by the window and the chosen resolution.
  target() {
    const dpr = window.devicePixelRatio || 1;
    let w = window.innerWidth * dpr, h = window.innerHeight * dpr;
    const res = this.settings.resolution;
    if (res && res !== 'auto') {
      const [rw, rh] = res.split('x').map(Number);
      w = Math.min(w, rw); h = Math.min(h, rh);
    }
    const s = Math.min(w / SCREEN.w, h / SCREEN.h);
    return { s, dpr };
  }

  layout() {
    if (typeof window === 'undefined') return;
    const { s, dpr } = this.target();
    let k = s, mode;
    if (this.settings.scaling === 'integer' && s >= 1) { k = Math.floor(s); mode = 'integer'; }
    else if (Math.abs(s - Math.round(s)) < 0.002 && s >= 1) { k = Math.round(s); mode = 'integer'; }
    else mode = 'sharp';
    const w = Math.max(1, Math.floor(SCREEN.w * k)), h = Math.max(1, Math.floor(SCREEN.h * k));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.canvas.style.width = `${w / dpr}px`;
    this.canvas.style.height = `${h / dpr}px`;
    if (mode === 'sharp') {
      const m = Math.max(1, Math.ceil(k));
      if (!this.mid || this.mid.width !== SCREEN.w * m) { this.mid = document.createElement('canvas'); this.mid.width = SCREEN.w * m; this.mid.height = SCREEN.h * m; }
    } else this.mid = null;
    this.out = { w, h, k, mode };
  }

  present() {
    const c = this.ctx, { w, h, mode } = this.out;
    c.clearRect(0, 0, w, h); // the title scene keeps the canvas transparent over the HTML menu
    if (mode === 'integer' || !this.mid) {
      c.imageSmoothingEnabled = false;
      c.drawImage(this.source, 0, 0, w, h);
      return;
    }
    const m = this.mid, mc = m.getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.clearRect(0, 0, m.width, m.height);
    mc.drawImage(this.source, 0, 0, m.width, m.height);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(m, 0, 0, w, h);
  }

  label() {
    const { w, h, k, mode } = this.out;
    return `${w}x${h} (${mode === 'integer' ? k + 'X' : k.toFixed(2) + 'X SHARP'})`;
  }

  cycleResolution() {
    const i = RESOLUTIONS.indexOf(this.settings.resolution);
    this.settings.resolution = RESOLUTIONS[(i + 1) % RESOLUTIONS.length];
    this.layout();
  }

  toggleScaling() {
    this.settings.scaling = this.settings.scaling === 'integer' ? 'sharp' : 'integer';
    this.layout();
  }

  // Borderless fullscreen through the Fullscreen API (needs a recent key press / click). Some embedded
  // hosts never answer the request; after 1.5 s that counts as "not available" instead of hanging.
  async toggleFullscreen() {
    try {
      const req = this.fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
      await Promise.race([req, timeout]);
      return true;
    } catch { return false; }
  }
}
