import { MUSIC_STATES, STINGERS, SCALES } from '../data/music.js';

// Adaptive procedural music (Phase 6). One lookahead scheduler (Web Audio clock, 25 ms timer)
// plays the CURRENT state only; every state has its own gain bus so a change crossfades
// (old bus fades out, its last notes ring out, nothing overlaps for long). Stingers are one-shots
// that then return to the requested state. Any failure only silences music - it never throws.
const LOOKAHEAD = 0.15, TICK_MS = 25, MAX_NOTES = 24;

export class MusicEngine {
  constructor(ctx, out) {
    this.ctx = ctx; this.out = out;
    this.buses = {};            // state -> GainNode
    this.state = null;          // requested (logical) state
    this.playing = null;        // state the scheduler is currently writing notes for
    this.override = null;       // dungeon root/mode for 'explore'
    this.bar = 0; this.step = 0; this.next = 0;
    this.live = 0;              // sounding notes (concurrency cap)
    this.sting = null;
    this.timer = setInterval(() => { try { this._tick(); } catch (err) { console.warn('[music]', err); } }, TICK_MS);
  }

  dispose() { clearInterval(this.timer); }

  _bus(name) {
    if (!this.buses[name]) { const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.out); this.buses[name] = g; }
    return this.buses[name];
  }

  // Idempotent: calling every frame with the same state does nothing.
  setState(name, opts = {}) {
    if (!MUSIC_STATES[name]) name = 'silence';
    if (opts.root || opts.mode) this.override = { root: opts.root, mode: opts.mode };
    if (name === this.state) return false;
    this.state = name;
    if (this.sting) { this.sting.then = name; return true; } // applied when the stinger ends
    this._switch(name);
    return true;
  }

  _switch(name) {
    const t = this.ctx.currentTime, def = MUSIC_STATES[name];
    for (const [k, bus] of Object.entries(this.buses)) if (k !== name) { bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, (def.fade || 1.5) / 3); }
    const bus = this._bus(name);
    bus.gain.cancelScheduledValues(t);
    bus.gain.setTargetAtTime(def.gain ?? 1, t, (def.fade || 1.5) / 3);
    this.playing = name; this.bar = 0; this.step = 0; this.next = t + 0.05;
  }

  stinger(id, then = null) {
    const s = STINGERS[id];
    if (!s) return;
    const t = this.ctx.currentTime;
    for (const bus of Object.values(this.buses)) { bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, 0.15); }
    const bus = this._bus('__stinger');
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(1, t);
    const stepDur = 60 / s.tempo / 4;
    let end = 0;
    for (const [at, inst, deg, oct, len] of s.notes) {
      const freq = this._freq({ deg, oct }, s.root, s.mode);
      this._voice(inst, freq, t + 0.05 + at * stepDur, len * stepDur, 0.5, bus);
      end = Math.max(end, at + len);
    }
    this.playing = null;
    this.sting = { until: t + 0.05 + end * stepDur + 0.4, then: then ?? s.then ?? this.state };
  }

  _freq(n, root, mode) {
    const sc = SCALES[mode] || SCALES.minor;
    const semi = n.semi !== undefined ? n.semi : sc[((n.deg % 7) + 7) % 7] + 12 * Math.floor(n.deg / 7);
    return root * Math.pow(2, (semi + 12 * (n.oct || 0)) / 12);
  }

  _tick() {
    const c = this.ctx;
    if (c.state !== 'running') return;
    if (this.sting) {
      if (c.currentTime < this.sting.until) return;
      const then = this.sting.then || this.state || 'silence';
      this.sting = null; this.state = then; this._switch(then);
    }
    const name = this.playing;
    if (!name) return;
    const def = MUSIC_STATES[name], pat = (def.alias ? MUSIC_STATES[def.alias] : def).pattern;
    const root = (name === 'explore' && this.override?.root) || def.root || 55;
    const mode = (name === 'explore' && this.override?.mode) || def.mode || 'minor';
    const stepDur = 60 / def.tempo / 4;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05; // tab was asleep: resync, never burst
    while (this.next < c.currentTime + LOOKAHEAD) {
      let seed = (this.bar * 131 + this.step * 17 + 7) >>> 0;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (const n of pat(this.step, this.bar, rnd)) {
        const freq = n.inst === 'kick' || n.inst === 'snare' || n.inst === 'hat' ? 0 : this._freq(n, root, mode);
        this._voice(n.inst, freq, this.next, (n.len || 1) * stepDur, n.vel ?? 0.5, this._bus(name));
      }
      this.next += stepDur;
      if (++this.step >= 16) { this.step = 0; this.bar++; }
    }
  }

  // Instruments: small, cheap voice graphs; every node stops itself (no leaks).
  _voice(inst, freq, t0, dur, vel, bus) {
    if (this.live >= MAX_NOTES && !['kick', 'snare', 'hat'].includes(inst)) return;
    const c = this.ctx, g = c.createGain();
    g.connect(bus);
    const nodes = [];
    const osc = (type, f, detune = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune; nodes.push(o); return o; };
    const env = (a, peak, rel) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.setValueAtTime(Math.max(0.0002, peak), t0 + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel); };
    let end = t0 + dur + 0.6;
    switch (inst) {
      case 'pad': case 'choir': {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = inst === 'choir' ? 1300 : 700; lp.connect(g);
        for (const d of inst === 'choir' ? [-9, 0, 9] : [-6, 6]) osc(inst === 'choir' ? 'triangle' : 'sawtooth', freq, d).connect(lp);
        env(inst === 'choir' ? 0.6 : 0.4, 0.06 * vel, 0.8); end = t0 + dur + 1; break;
      }
      case 'bass': { osc('triangle', freq).connect(g); osc('sine', freq / 2).connect(g); env(0.02, 0.22 * vel, 0.15); break; }
      case 'bell': { osc('sine', freq).connect(g); osc('sine', freq * 2.76, 0).connect(g); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12 * vel, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.6, dur)); end = t0 + Math.max(0.6, dur) + 0.1; break; }
      case 'stab': { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t0); lp.frequency.exponentialRampToValueAtTime(500, t0 + dur); lp.connect(g); osc('sawtooth', freq, -5).connect(lp); osc('sawtooth', freq, 5).connect(lp); env(0.01, 0.1 * vel, 0.1); break; }
      case 'kick': { const o = osc('sine', 110); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.18); o.connect(g); g.gain.setValueAtTime(0.5 * vel, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25); end = t0 + 0.3; break; }
      case 'snare': case 'hat': {
        const src = c.createBufferSource(); src.buffer = this.noise || (this.noise = this._noiseBuf());
        const f = c.createBiquadFilter(); f.type = inst === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = inst === 'hat' ? 7000 : 1800; src.connect(f); f.connect(g);
        const d = inst === 'hat' ? 0.05 : 0.16;
        g.gain.setValueAtTime((inst === 'hat' ? 0.12 : 0.3) * vel, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        src.start(t0); src.stop(t0 + d + 0.02); nodes.push(null); end = t0 + d + 0.05;
        this._track(src, g); return;
      }
      default: { osc('sine', freq).connect(g); env(0.05, 0.1 * vel, 0.3); }
    }
    for (const o of nodes) if (o) { o.start(t0); o.stop(end); }
    this._track(nodes.find(Boolean), g);
  }
  _track(node, g) {
    if (!node) return;
    this.live++;
    node.onended = () => { this.live = Math.max(0, this.live - 1); try { g.disconnect(); } catch { /* already gone */ } };
  }
  _noiseBuf() {
    const len = this.ctx.sampleRate * 0.5, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
}
