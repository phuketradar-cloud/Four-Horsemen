// Procedural Web Audio SFX + ambient drone + adaptive music (Phase 6). No audio files needed (no licensing
// concerns; every sound is an original synthesized placeholder). Each sound has a minimum retrigger
// interval and there is a global voice cap, so sounds never stack up. Buses: master -> sfx / music / ambient.
import { MusicEngine } from './MusicEngine.js';
const MIN_INTERVAL = {
  step: 0.12, hit: 0.05, crit: 0.06, sword: 0.08, axe: 0.15, crossbow: 0.15, dagger: 0.05, punch: 0.08,
  enemySwipe: 0.1, enemyHeavy: 0.2, windup: 0.2, boneDeath: 0.15, armorDeath: 0.2,
  pickup: 0.08, inventory: 0.12, levelUp: 0.5, hurt: 0.12, block: 0.08, parry: 0.15,
  door: 0.3, chest: 0.3, spell: 0.2, ui: 0.04, alert: 0.25, bump: 0.2, secret: 0.5, gate: 0.5, victory: 1, death: 1,
  // Phase 2 — Horsemen
  holyCast: 0.1, markApply: 0.2, debuff: 0.15, curse: 0.2, buff: 0.3, ultConquest: 1,
  warCry: 0.15, armorCrack: 0.15, groundSlam: 0.3, ultWar: 1,
  witherCast: 0.1, drain: 0.15, plagueCast: 0.2, fieldCast: 0.3, ultFamine: 1,
  soulRend: 0.1, wraith: 0.15, embrace: 0.2, ultDeath: 1, soulGain: 0.08,
  resourceFull: 0.6, resourceEmpty: 0.4, deny: 0.25, selectConquest: 0.3, selectWar: 0.3, selectFamine: 0.3, selectDeath: 0.3,
  // Phase 4
  bossIntro: 2, bossPhase: 1, bossCast: 0.3, bossDefeat: 2, summon: 0.5, barrier: 0.5, vulnerable: 0.4, spectral: 0.5,
  spikes: 0.2, spikeWarn: 0.4, collapse: 0.5, rumble: 0.4, rune: 0.15, runeFail: 0.4, plate: 0.15, lever: 0.3, puzzle: 1,
  craft: 0.2, enhance: 0.3, material: 0.06, stairs: 1, portal: 1, shrine: 0.6, font: 0.6,
  // Phase 6
  select: 0.15, miss: 0.08, hammer: 0.2, greatsword: 0.18, spear: 0.1, scythe: 0.18, bow: 0.12, magic: 0.15, heal: 0.3, xp: 0.25,
  itemDrop: 0.15, rareLoot: 0.4, legendaryLoot: 0.8, mythicLoot: 1, equip: 0.12, dialogue: 0.2, confirm: 0.1, trap: 0.3, dodge: 0.15,
  stagger: 0.2, resist: 0.15, weak: 0.15, potion: 0.3, quest: 0.6, questDone: 1, chapter: 2, saveOk: 1, saveFail: 1, notify: 0.3, error: 0.5,
  hitConquest: 0.08, hitWar: 0.1, hitFamine: 0.1, hitDeath: 0.1, execute: 0.3,
};
const MAX_VOICES = 14;

export class AudioManager {
  constructor(settings) {
    this.ctx = null;
    this.settings = settings; // { master, sfx, music, muted }
    this.last = {};
    this.voices = 0;
    this.drone = null;
    this.music = null;
    this.requested = {}; // name -> times a gameplay event asked for it (tests verify wiring through this)
    this.played = {};    // name -> times it actually sounded
    this.unknown = new Set();
  }

  stats() { return { requested: { ...this.requested }, played: { ...this.played }, unknown: [...this.unknown], musicState: this.musicState || null, voices: this.voices, musicNotes: this.music?.live || 0 }; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (err) { console.warn('[audio] unavailable - the game continues silently', err); this.ctx = null; return; }
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.sfxGain.connect(this.master); this.musicGain.connect(this.master); this.ambientGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    try { this.music = new MusicEngine(this.ctx, this.musicGain); if (this.musicState) this.music.setState(this.musicState, this.musicOpts || {}); } catch (err) { console.warn('[audio] music engine failed', err); this.music = null; }
    // shared noise buffer
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(s.sfx, t, 0.02);
    this.musicGain.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
    this.ambientGain.gain.setTargetAtTime((s.ambient ?? 0.6) * 0.5, t, 0.05);
  }

  // Adaptive music state (idempotent; safe to call every frame). Works before unlock (remembered).
  setMusic(state, opts = {}) {
    if (state === this.musicState && !opts.root) return;
    this.musicState = state; this.musicOpts = opts;
    if (this.music) try { this.music.setState(state, opts); } catch (err) { console.warn('[audio] music', err); }
  }
  stinger(id, then = null) {
    this.requested['stinger:' + id] = (this.requested['stinger:' + id] || 0) + 1;
    if (this.music && !this.settings.muted) try { this.music.stinger(id, then); } catch (err) { console.warn('[audio] stinger', err); }
  }

  // ---- primitives
  _env(gain, t0, a, peak, dur) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  _tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    this._env(g, t0, 0.005, peak, dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
    this._track(o, dur);
  }
  _noise(filterType, f0, f1, dur, peak = 0.3, delay = 0, q = 1) {
    const c = this.ctx, t0 = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    this._env(g, t0, 0.004, peak, dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
    this._track(src, dur);
  }
  _track(node) {
    this.voices++;
    node.onended = () => { this.voices = Math.max(0, this.voices - 1); };
  }

  play(name) {
    if (!name) return;
    this.requested[name] = (this.requested[name] || 0) + 1;
    if (!(name in MIN_INTERVAL) && !this.unknown.has(name)) { this.unknown.add(name); console.warn(`[audio] no sound defined for '${name}'`); }
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < (MIN_INTERVAL[name] ?? 0.05)) return;
    if (this.voices > MAX_VOICES) return;
    this.last[name] = now;
    this.played[name] = (this.played[name] || 0) + 1;
    try { this._sfx(name); } catch (e) { console.warn('sfx failed', name, e); }
  }

  _sfx(name) {
    switch (name) {
      case 'step': this._noise('lowpass', 420, 160, 0.12, 0.25); this._tone('sine', 70, 50, 0.08, 0.15); break;
      case 'bump': this._tone('sine', 90, 40, 0.15, 0.3); this._noise('lowpass', 300, 100, 0.1, 0.2); break;
      case 'sword': this._noise('bandpass', 1800, 5200, 0.16, 0.35, 0, 2); this._tone('triangle', 900, 1400, 0.1, 0.06, 0.02); break;
      case 'axe': this._noise('bandpass', 500, 1600, 0.3, 0.4, 0, 1.5); this._tone('sawtooth', 110, 60, 0.25, 0.12, 0.05); break;
      case 'dagger': this._noise('bandpass', 3000, 6500, 0.08, 0.3, 0, 3); break;
      case 'punch': this._noise('lowpass', 600, 200, 0.08, 0.3); break;
      case 'crossbow':
        this._tone('triangle', 520, 120, 0.18, 0.35); this._noise('highpass', 2500, 1200, 0.06, 0.3);
        this._noise('bandpass', 1500, 400, 0.2, 0.15, 0.03, 4); break;
      case 'hit': this._noise('lowpass', 1400, 200, 0.12, 0.5); this._tone('square', 160, 60, 0.08, 0.12); break;
      case 'crit': this._noise('lowpass', 2500, 200, 0.2, 0.6); this._tone('square', 300, 80, 0.15, 0.15); this._tone('sine', 1200, 600, 0.2, 0.08, 0.02); break;
      case 'block': this._tone('square', 880, 700, 0.12, 0.12); this._noise('highpass', 4000, 3000, 0.1, 0.25); break;
      case 'parry': this._tone('square', 1320, 990, 0.25, 0.14); this._tone('triangle', 1980, 1600, 0.35, 0.1, 0.03); this._noise('highpass', 5000, 3000, 0.12, 0.3); break;
      case 'enemySwipe': this._noise('bandpass', 900, 2600, 0.14, 0.3, 0, 1.5); break;
      case 'enemyHeavy': this._noise('bandpass', 300, 1200, 0.35, 0.45, 0, 1.2); this._tone('sawtooth', 80, 40, 0.3, 0.15); break;
      case 'windup': this._tone('sawtooth', 70, 140, 0.5, 0.08); this._noise('bandpass', 200, 800, 0.5, 0.08, 0, 3); break;
      case 'alert': this._tone('square', 300, 450, 0.08, 0.08); this._tone('square', 450, 450, 0.08, 0.08, 0.09); break;
      case 'hurt': this._tone('sawtooth', 180, 60, 0.25, 0.25); this._noise('lowpass', 900, 100, 0.2, 0.35); break;
      case 'boneDeath':
        for (let i = 0; i < 6; i++) this._noise('bandpass', 2000 + Math.random() * 2000, 1500, 0.05, 0.25, i * 0.06 + Math.random() * 0.03, 6);
        this._tone('sine', 200, 60, 0.4, 0.1); break;
      case 'armorDeath':
        this._noise('lowpass', 2000, 100, 0.8, 0.5); this._tone('square', 140, 40, 0.6, 0.15);
        for (let i = 0; i < 4; i++) this._tone('triangle', 600 + i * 230, 400, 0.15, 0.06, 0.1 + i * 0.12); break;
      case 'pickup': this._tone('square', 660, 660, 0.07, 0.1); this._tone('square', 990, 990, 0.12, 0.1, 0.07); break;
      case 'inventory': this._noise('bandpass', 700, 1200, 0.12, 0.2, 0, 2); this._noise('bandpass', 900, 600, 0.1, 0.15, 0.08, 2); break;
      case 'levelUp': [523, 659, 784, 1046].forEach((f, i) => this._tone('square', f, f, 0.16, 0.12, i * 0.1)); this._tone('triangle', 1046, 1046, 0.6, 0.12, 0.4); break;
      case 'door': this._tone('sawtooth', 90, 60, 0.6, 0.12); this._noise('bandpass', 400, 200, 0.6, 0.15, 0, 4); this._tone('sine', 60, 40, 0.2, 0.3, 0.55); break;
      case 'gate': this._tone('sawtooth', 50, 40, 1.4, 0.2); this._noise('lowpass', 600, 100, 1.4, 0.3); break;
      case 'chest': this._tone('sawtooth', 200, 120, 0.3, 0.1); this._tone('square', 784, 784, 0.1, 0.08, 0.3); this._tone('square', 1175, 1175, 0.2, 0.08, 0.38); break;
      case 'secret': [392, 466, 554, 740].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.1, i * 0.12)); break;
      case 'spell': this._noise('bandpass', 300, 3000, 0.5, 0.4, 0, 1); this._tone('sawtooth', 120, 480, 0.4, 0.12); break;
      case 'ui': this._tone('square', 1200, 1200, 0.03, 0.05); break;
      case 'victory': [392, 523, 659, 784, 1046].forEach((f, i) => this._tone('square', f, f, 0.3, 0.1, i * 0.18)); break;
      case 'death': [330, 262, 196, 131].forEach((f, i) => this._tone('sawtooth', f, f * 0.98, 0.45, 0.12, i * 0.35)); break;
      // ---- Conquest: bright, holy, metallic
      case 'holyCast': this._tone('triangle', 1320, 1760, 0.18, 0.12); this._noise('highpass', 6000, 4000, 0.15, 0.15); this._tone('sine', 2640, 2640, 0.25, 0.05, 0.05); break;
      case 'markApply': this._tone('square', 988, 988, 0.08, 0.08); this._tone('square', 1480, 1480, 0.2, 0.08, 0.08); break;
      case 'ultConquest': [784, 988, 1175, 1568].forEach((f, i) => this._tone('triangle', f, f, 0.5, 0.1, i * 0.06)); this._noise('highpass', 5000, 2000, 0.9, 0.3, 0.1); this._tone('sine', 196, 98, 0.9, 0.2); break;
      case 'selectConquest': [659, 988, 1319].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.08, i * 0.08)); break;
      // ---- War: low, brutal
      case 'warCry': this._tone('sawtooth', 110, 70, 0.3, 0.2); this._noise('bandpass', 400, 1800, 0.25, 0.35, 0, 1.2); break;
      case 'armorCrack': this._noise('highpass', 3000, 1500, 0.15, 0.4); this._tone('square', 220, 80, 0.2, 0.15); this._tone('triangle', 1700, 900, 0.15, 0.08, 0.03); break;
      case 'groundSlam': this._tone('sine', 70, 30, 0.7, 0.45); this._noise('lowpass', 900, 60, 0.8, 0.45); break;
      case 'ultWar': for (let i = 0; i < 3; i++) { this._tone('sawtooth', 90, 40, 0.35, 0.22, i * 0.18); this._noise('lowpass', 2000, 100, 0.3, 0.4, i * 0.18); } break;
      case 'selectWar': this._tone('sawtooth', 98, 82, 0.4, 0.15); this._noise('lowpass', 800, 200, 0.3, 0.2); break;
      // ---- Famine: hollow, decaying
      case 'witherCast': this._noise('bandpass', 900, 200, 0.4, 0.2, 0, 6); this._tone('sine', 330, 220, 0.4, 0.06); break;
      case 'drain': this._tone('sine', 300, 600, 0.4, 0.1); this._noise('bandpass', 400, 1200, 0.4, 0.12, 0, 4); break;
      case 'plagueCast': this._noise('lowpass', 600, 150, 0.6, 0.25); for (let i = 0; i < 4; i++) this._tone('sine', 140 + i * 12, 120, 0.1, 0.05, i * 0.1); break;
      case 'fieldCast': this._tone('sawtooth', 55, 52, 1.0, 0.12); this._noise('bandpass', 200, 600, 1.0, 0.15, 0, 2); break;
      case 'ultFamine': this._tone('sawtooth', 110, 55, 1.2, 0.15); this._noise('bandpass', 1500, 150, 1.2, 0.3, 0, 3); [440, 415, 392].forEach((f, i) => this._tone('triangle', f, f * 0.9, 0.4, 0.06, 0.3 + i * 0.2)); break;
      case 'selectFamine': this._noise('bandpass', 600, 200, 0.5, 0.15, 0, 5); this._tone('sine', 262, 247, 0.5, 0.06); break;
      // ---- Death: eerie, ghostly
      case 'soulRend': this._tone('sine', 880, 440, 0.25, 0.1); this._noise('highpass', 4000, 2000, 0.2, 0.15); break;
      case 'curse': this._tone('triangle', 233, 220, 0.6, 0.1); this._tone('triangle', 349, 330, 0.6, 0.06); break;
      case 'wraith': this._noise('bandpass', 2500, 500, 0.35, 0.2, 0, 3); this._tone('sine', 660, 990, 0.3, 0.06); break;
      case 'embrace': this._tone('sine', 196, 98, 0.5, 0.2); this._noise('lowpass', 1200, 200, 0.3, 0.3); break;
      case 'soulGain': this._tone('sine', 1047, 1568, 0.25, 0.06); break;
      case 'ultDeath': this._tone('sine', 110, 55, 1.4, 0.25); this._noise('bandpass', 3000, 300, 1.2, 0.25, 0, 2); [523, 494, 466, 440].forEach((f, i) => this._tone('triangle', f, f, 0.5, 0.05, 0.2 + i * 0.25)); break;
      case 'selectDeath': this._tone('sine', 220, 208, 0.7, 0.1); this._tone('sine', 330, 311, 0.7, 0.05, 0.1); break;
      // ---- resources / feedback
      case 'resourceFull': this._tone('triangle', 880, 1320, 0.2, 0.08); this._tone('triangle', 1320, 1760, 0.25, 0.06, 0.1); break;
      case 'resourceEmpty': this._tone('triangle', 440, 220, 0.2, 0.05); break;
      case 'deny': this._tone('square', 140, 120, 0.12, 0.08); break;
      // ---- Phase 4: dungeons, bosses, crafting
      case 'bossIntro': this._tone('sawtooth', 55, 41, 1.6, 0.25); this._noise('lowpass', 500, 80, 1.6, 0.35); [196, 185, 175].forEach((f, i) => this._tone('triangle', f, f * 0.97, 0.6, 0.08, 0.3 + i * 0.35)); break;
      case 'bossPhase': this._tone('sawtooth', 110, 55, 0.9, 0.2); this._noise('bandpass', 1500, 200, 0.8, 0.3, 0, 2); this._tone('square', 220, 330, 0.4, 0.06, 0.3); break;
      case 'bossCast': this._tone('triangle', 220, 440, 0.5, 0.08); this._noise('bandpass', 600, 2400, 0.5, 0.12, 0, 3); break;
      case 'bossDefeat': [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone('square', f, f, 0.35, 0.09, i * 0.15)); this._tone('sine', 65, 40, 1.4, 0.3); break;
      case 'summon': this._tone('sine', 110, 220, 0.6, 0.12); this._noise('lowpass', 800, 100, 0.6, 0.25); break;
      case 'barrier': this._tone('triangle', 880, 660, 0.5, 0.08); this._tone('sine', 1320, 1320, 0.6, 0.05, 0.1); break;
      case 'vulnerable': this._tone('square', 660, 990, 0.12, 0.08); this._tone('square', 990, 1320, 0.15, 0.08, 0.12); break;
      case 'spectral': this._noise('bandpass', 3000, 600, 0.6, 0.15, 0, 4); this._tone('sine', 523, 494, 0.6, 0.05); break;
      case 'spikes': this._noise('highpass', 5000, 3000, 0.12, 0.35); this._tone('square', 300, 180, 0.08, 0.08); break;
      case 'spikeWarn': this._tone('square', 1800, 1800, 0.04, 0.04); this._tone('square', 1800, 1800, 0.04, 0.04, 0.08); break;
      case 'collapse': this._noise('lowpass', 700, 60, 0.9, 0.45); this._tone('sine', 60, 30, 0.8, 0.3); break;
      case 'rumble': this._noise('lowpass', 250, 120, 0.5, 0.25); break;
      case 'rune': this._tone('triangle', 660, 880, 0.3, 0.08); this._tone('sine', 1320, 1320, 0.3, 0.04, 0.05); break;
      case 'runeFail': this._tone('sawtooth', 220, 110, 0.4, 0.12); this._noise('bandpass', 400, 200, 0.3, 0.15); break;
      case 'plate': this._noise('lowpass', 900, 300, 0.12, 0.3); this._tone('square', 180, 160, 0.08, 0.08); break;
      case 'lever': this._noise('bandpass', 1200, 600, 0.2, 0.25, 0, 3); this._tone('square', 300, 200, 0.1, 0.06); break;
      case 'puzzle': [440, 554, 659, 880].forEach((f, i) => this._tone('triangle', f, f, 0.25, 0.08, i * 0.1)); break;
      case 'craft': this._noise('bandpass', 3000, 1500, 0.15, 0.3, 0, 3); this._tone('square', 784, 784, 0.1, 0.06, 0.12); this._tone('square', 1175, 1175, 0.15, 0.06, 0.2); break;
      case 'enhance': this._noise('highpass', 4000, 2000, 0.2, 0.35); [523, 784, 1046].forEach((f, i) => this._tone('triangle', f, f, 0.2, 0.07, 0.1 + i * 0.08)); break;
      case 'material': this._tone('triangle', 880, 1100, 0.07, 0.06); break;
      case 'stairs': [330, 294, 262, 220].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.07, i * 0.12)); break;
      case 'portal': this._tone('sine', 220, 880, 1.0, 0.12); this._noise('bandpass', 800, 3000, 1.0, 0.15, 0, 2); break;
      case 'shrine': this._tone('sine', 300, 150, 0.8, 0.12); this._noise('bandpass', 400, 1200, 0.6, 0.12, 0, 4); break;
      case 'font': [523, 659, 784].forEach((f, i) => this._tone('sine', f, f, 0.5, 0.06, i * 0.08)); break;
      // ---- Phase 6: cues that were requested but silent before, weapons, loot, UI, story, saves
      case 'buff': this._tone('triangle', 523, 784, 0.25, 0.08); this._tone('sine', 1046, 1046, 0.25, 0.04, 0.08); break;
      case 'debuff': this._tone('sawtooth', 330, 196, 0.25, 0.07); this._noise('bandpass', 800, 300, 0.2, 0.1, 0, 3); break;
      case 'select': this._tone('square', 880, 880, 0.05, 0.06); this._tone('square', 1320, 1320, 0.08, 0.06, 0.05); break;
      case 'miss': this._noise('bandpass', 2600, 900, 0.14, 0.18, 0, 2); break;
      case 'hammer': this._noise('lowpass', 900, 120, 0.35, 0.45); this._tone('sine', 90, 40, 0.3, 0.3); this._tone('triangle', 400, 300, 0.08, 0.06, 0.02); break;
      case 'greatsword': this._noise('bandpass', 900, 3000, 0.28, 0.35, 0, 1.5); this._tone('sawtooth', 140, 80, 0.25, 0.1, 0.03); break;
      case 'spear': this._noise('bandpass', 2400, 4800, 0.12, 0.3, 0, 3); this._tone('triangle', 700, 500, 0.06, 0.05); break;
      case 'scythe': this._noise('bandpass', 1200, 4000, 0.3, 0.3, 0, 2); this._tone('sine', 660, 440, 0.25, 0.05, 0.05); break;
      case 'bow': this._tone('triangle', 330, 110, 0.14, 0.3); this._noise('highpass', 3500, 1800, 0.12, 0.25, 0.01); break;
      case 'magic': this._tone('sine', 440, 880, 0.3, 0.1); this._noise('bandpass', 1500, 4000, 0.3, 0.12, 0, 4); break;
      case 'heal': [392, 523, 659].forEach((f, i) => this._tone('sine', f, f * 1.01, 0.35, 0.07, i * 0.07)); break;
      case 'potion': this._noise('bandpass', 600, 1400, 0.25, 0.15, 0, 5); this._tone('sine', 523, 784, 0.3, 0.06, 0.15); break;
      case 'xp': this._tone('triangle', 1175, 1568, 0.08, 0.04); break;
      case 'itemDrop': this._tone('triangle', 330, 220, 0.12, 0.12); this._noise('lowpass', 1200, 300, 0.1, 0.12); break;
      case 'rareLoot': [659, 880, 1175].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.08, i * 0.07)); break;
      case 'legendaryLoot': [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.09, i * 0.08)); this._tone('sine', 131, 131, 1.0, 0.12); break;
      case 'mythicLoot': [466, 587, 698, 932, 1175].forEach((f, i) => this._tone('sawtooth', f, f, 0.3, 0.05, i * 0.1)); this._noise('highpass', 6000, 3000, 1.0, 0.15, 0.3); this._tone('sine', 117, 117, 1.4, 0.15); break;
      case 'equip': this._noise('bandpass', 1500, 3000, 0.08, 0.25, 0, 3); this._tone('square', 330, 330, 0.05, 0.05, 0.05); break;
      case 'dialogue': this._tone('triangle', 392, 392, 0.06, 0.05); this._tone('triangle', 523, 523, 0.08, 0.05, 0.06); break;
      case 'confirm': this._tone('square', 660, 660, 0.05, 0.06); this._tone('square', 990, 990, 0.1, 0.06, 0.05); break;
      case 'trap': this._noise('highpass', 4000, 2000, 0.15, 0.35); this._tone('square', 240, 120, 0.15, 0.1); break;
      case 'dodge': this._noise('bandpass', 1800, 600, 0.18, 0.2, 0, 2); this._tone('sine', 880, 660, 0.1, 0.04); break;
      case 'stagger': this._tone('square', 200, 100, 0.2, 0.12); this._noise('lowpass', 1500, 200, 0.2, 0.3); break;
      case 'resist': this._tone('triangle', 300, 280, 0.12, 0.08); this._noise('highpass', 3000, 2500, 0.08, 0.1); break;
      case 'weak': this._tone('square', 700, 1000, 0.08, 0.06); break;
      case 'quest': this._tone('triangle', 587, 587, 0.15, 0.08); this._tone('triangle', 880, 880, 0.25, 0.08, 0.12); break;
      case 'questDone': [523, 659, 784, 1046].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.09, i * 0.11)); break;
      case 'chapter': this._tone('sine', 65, 49, 1.8, 0.3); this._noise('lowpass', 400, 80, 1.6, 0.25); break;
      case 'saveOk': this._tone('sine', 784, 784, 0.08, 0.05); this._tone('sine', 1046, 1046, 0.12, 0.05, 0.08); break;
      case 'saveFail': this._tone('square', 220, 165, 0.3, 0.1); this._tone('square', 165, 110, 0.4, 0.1, 0.25); break;
      case 'notify': this._tone('triangle', 988, 988, 0.08, 0.05); break;
      case 'error': this._tone('square', 196, 185, 0.25, 0.1); break;
      case 'execute': this._tone('sine', 220, 55, 0.5, 0.2); this._noise('highpass', 5000, 1500, 0.3, 0.3); break;
      // Horseman accents layered on a CONNECTING basic hit (class identity, quiet)
      case 'hitConquest': this._tone('triangle', 1760, 1320, 0.08, 0.05); break;                 // bright, precise
      case 'hitWar': this._tone('sine', 82, 41, 0.22, 0.22); break;                                // low thump
      case 'hitFamine': this._noise('bandpass', 500, 180, 0.2, 0.12, 0, 6); break;                 // hollow decay
      case 'hitDeath': this._tone('sine', 660, 330, 0.18, 0.05); this._noise('highpass', 5000, 3000, 0.1, 0.06); break; // spectral whisper
      default: break;
    }
  }

  // Low ambient drone: started once, kept running, volume-controlled. setAmbience() re-tunes it
  // per dungeon theme (procedural; no copyrighted audio).
  startMusic() {
    if (!this.ctx || this.drone) return;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0.25;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const lfo = c.createOscillator(), lfoGain = c.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 160;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    this.droneOscs = [55, 55.4, 82.4, 110.2].map((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i < 2 ? 0.25 : 0.1;
      o.connect(g); g.connect(lp); o.start();
      return o;
    });
    lp.connect(out); out.connect(this.ambientGain); lfo.start();
    this.drone = out; this.droneLp = lp; this.droneLfo = lfo;
    if (this.pendingAmbience) this.setAmbience(this.pendingAmbience);
  }

  // music: { root (Hz), mode, tempo } from the dungeon definition's audio block.
  setAmbience(audio) {
    if (!audio) return;
    if (!this.ctx || !this.drone) { this.pendingAmbience = audio; return; }
    const m = audio.music || {}, root = m.root || 55, t = this.ctx.currentTime;
    const third = { minor: 1.189, phrygian: 1.06, locrian: 1.06, dorian: 1.189 }[m.mode] || 1.189;
    [root, root * 1.007, root * (m.mode === 'locrian' ? 1.414 : 1.498), root * 2 * third].forEach((f, i) => this.droneOscs[i].frequency.setTargetAtTime(f, t, 1.2));
    const cut = { crypt: 380, war: 520, blight: 300, spectral: 700 }[audio.ambience] || 380;
    this.droneLp.frequency.setTargetAtTime(cut, t, 1.5);
    this.droneLfo.frequency.setTargetAtTime(0.07 * (m.tempo || 1), t, 1.5);
  }
  // the dungeon's music block tunes the exploration track (root/mode)
  ambienceMusicOpts(audio) { const m = audio?.music || {}; return { root: m.root ? m.root * 2 : 110, mode: m.mode || 'minor' }; }
}
