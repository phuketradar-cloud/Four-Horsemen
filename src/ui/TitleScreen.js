import { keysFor, keyLabel } from '../core/Input.js';
import { HORSEMEN } from '../data/characters.js';

// Phase 6 main menu (title scene). Layers, back to front - all 2D:
//   1. art      assets/title/menu_bg.webp (concept art with its painted-in text removed, see
//               tools/clean-title-art.js), full window, CSS `cover`, slight mouse parallax
//   2. fx       low-resolution canvas: drifting embers, falling ash, fog banks, Blood Moon glow
//   3. ui       real HTML: title / subtitle (editable text), menu buttons, controls strip
// The game's 640x480 canvas stays on top but transparent in this scene; it only shows panels
// (OPTIONS, REBIND CONTROLS), yes/no prompts and notifications. Menu logic is the game's own:
// buttons and keyboard both drive g.activeMenu / g.menuIndex, so behaviour is identical.
const ART = { src: 'assets/title/menu_bg.webp', w: 1672, h: 940, moon: { x: 1385, y: 132, r: 96 } };

export class TitleScreen {
  constructor(game) {
    this.g = game;
    this.visible = false;
    this.items = [];
    this.saveInfo = null;
    this.pointer = { x: 0.5, y: 0.5 };
    this.particles = [];
    this._build();
  }

  // ------------------------------------------------------------------ DOM
  _build() {
    const root = document.createElement('div');
    root.id = 'title-screen';
    root.setAttribute('aria-label', 'Main menu');
    root.innerHTML = `
      <div class="ts-art" aria-hidden="true"></div>
      <canvas class="ts-fx" aria-hidden="true"></canvas>
      <div class="ts-shade" aria-hidden="true"></div>
      <div class="ts-ui">
        <header class="ts-title">
          <div class="ts-crest" aria-hidden="true"></div>
          <h1><span class="ts-t1">The Four Horsemen</span><span class="ts-t2">Apocalypse</span></h1>
          <p class="ts-sub"><span>Dungeons of the End</span></p>
        </header>
        <nav class="ts-menu" role="menu"></nav>
        <div class="ts-sound" hidden>Click or press any key to awaken the sound</div>
        <footer class="ts-controls" aria-label="Controls"></footer>
      </div>`;
    document.body.prepend(root);
    this.root = root;
    this.art = root.querySelector('.ts-art');
    this.fx = root.querySelector('.ts-fx');
    this.fctx = this.fx.getContext('2d');
    this.menu = root.querySelector('.ts-menu');
    this.controls = root.querySelector('.ts-controls');
    this.soundHint = root.querySelector('.ts-sound');
    // art: preload; if it fails the CSS gradient fallback stays (the menu keeps working)
    const img = new Image();
    img.onload = () => { this.art.style.backgroundImage = `url("${ART.src}")`; this.art.classList.add('loaded'); };
    img.onerror = () => console.warn('[title] menu art failed to load - using the plain backdrop');
    img.src = ART.src;
    // the first pointer press on the menu counts as the user gesture that unlocks audio
    root.addEventListener('pointerdown', () => { this.g.audio.unlock(); this.g.audio.startMusic(); });
    window.addEventListener('pointermove', (e) => { this.pointer.x = e.clientX / innerWidth; this.pointer.y = e.clientY / innerHeight; });
    window.addEventListener('resize', () => this._resizeFx());
    this._resizeFx();
  }

  _resizeFx() {
    // 1 fx pixel = 3 screen pixels: chunky pixel-art particles, and cheap to draw
    this.fx.width = Math.max(1, Math.ceil(innerWidth / 3));
    this.fx.height = Math.max(1, Math.ceil(innerHeight / 3));
  }

  // ------------------------------------------------------------------ menu model
  // Real actions only. QUIT is listed only when a host platform can actually close the game
  // (e.g. a desktop wrapper exposing window.__platform.quit); a browser tab cannot close itself.
  _buildItems() {
    const g = this.g;
    const legacy = this.saveInfo && g.saves.isLegacy();
    const items = [
      { id: 'new', label: 'New Game', run: () => g.openSelect() },
      { id: 'continue', label: legacy ? 'Continue (Old Save)' : 'Continue', run: () => g.loadGame(), disabled: !this.saveInfo,
        note: this.saveInfo ? `${HORSEMEN[this.saveInfo.hero?.classId]?.name || ''} · LV ${this.saveInfo.hero?.level || 1}` : 'No save found' },
      { id: 'options', label: 'Options', run: () => g.openPanel('options') },
    ];
    if (typeof window.__platform?.quit === 'function') items.push({ id: 'quit', label: 'Quit Game', run: () => g.ask('Quit the game?', () => window.__platform.quit()) });
    return items;
  }

  _renderMenu() {
    this.menu.innerHTML = '';
    this.buttons = this.items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ts-btn';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1; // keyboard navigation is the game's own (arrows / W S + Enter)
      b.disabled = !!it.disabled;
      b.innerHTML = `<span class="ts-btn-label">${it.label}</span>${it.note ? `<span class="ts-btn-note">${it.note}</span>` : ''}`;
      b.addEventListener('mouseenter', () => { if (!it.disabled && this.g.menuIndex !== i) { this.g.menuIndex = i; this.g.audio.play('ui'); } });
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the game canvas
      b.addEventListener('click', () => { if (it.disabled) { this.g.audio.play('deny'); return; } this.g.menuIndex = i; this.g.audio.play('confirm'); this._press(i); it.run(); });
      this.menu.appendChild(b);
      return b;
    });
  }
  _press(i) { const b = this.buttons?.[i]; if (!b) return; b.classList.add('is-pressed'); setTimeout(() => b.classList.remove('is-pressed'), 140); }

  // Controls strip from the LIVE key bindings (rebinding updates it); only implemented actions.
  _renderControls() {
    const map = this.g.input.keymap;
    const letters = (a) => keysFor(map, a).filter((k) => !/^Arrow|^Digit|^Numpad/.test(k)).map(keyLabel);
    const cap = (k) => `<kbd>${k === 'SPACE' ? 'SPACE' : k === 'ESCAPE' ? 'ESC' : k}</kbd>`;
    const move = ['forward', 'turnLeft', 'back', 'turnRight'].map((a) => letters(a)[0]).filter(Boolean);
    const groups = [
      [move.map(cap).join(''), 'Move'],
      [letters('attack').slice(0, 1).map(cap).join(''), 'Attack'],
      [letters('interact').slice(0, 1).map(cap).join(''), 'Interact'],
      [letters('guard').slice(0, 1).map(cap).join(''), 'Guard'],
      [cap('ESC'), 'Menu'],
    ].filter(([k]) => k);
    this.controls.innerHTML = groups.map(([k, v]) => `<span class="ts-ctl">${k}<em>${v}</em></span>`).join('<i aria-hidden="true"></i>');
  }

  // ------------------------------------------------------------------ per frame (from GameManager.render)
  sync() {
    const g = this.g;
    const show = g.scene === 'title';
    if (show !== this.visible) {
      this.visible = show;
      document.body.classList.toggle('title-mode', show);
      if (show) this.refresh();
      else { this.root.classList.remove('panel-open'); }
      if (show) this._loop();
    }
    if (!show) return;
    // the game canvas only takes the pointer when it shows something interactive
    const modal = !!(g.panel || g.confirm);
    this.root.classList.toggle('panel-open', modal);
    document.body.classList.toggle('canvas-interactive', modal || g.notices.list.some((n) => n.kind === 'error'));
    if (this._wasModal && !modal) this.refresh(); // back from OPTIONS: bindings / saves may have changed
    this._wasModal = modal;
    g.activeMenu = modal ? g.activeMenu : this.items;
    if (!modal && this.buttons) this.buttons.forEach((b, i) => b.classList.toggle('is-focused', i === g.menuIndex % this.items.length));
    this.soundHint.hidden = !!g.audio.ctx && g.audio.ctx.state === 'running';
  }

  refresh() {
    const g = this.g;
    this.saveInfo = g.saves.load(); // read once per visit, not every frame
    this.items = this._buildItems();
    if (this.items[g.menuIndex]?.disabled || g.menuIndex >= this.items.length) g.menuIndex = 0;
    this._renderMenu();
    this._renderControls();
  }

  // ------------------------------------------------------------------ atmosphere (fx canvas)
  _loop() {
    let last = performance.now();
    const frame = (now) => {
      if (!this.visible) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try { this._updateFx(dt, now / 1000); } catch (err) { console.warn('[title fx]', err); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // where the art's Blood Moon lands on screen (the art is drawn with background-size: cover)
  _moonOnScreen() {
    const s = Math.max(innerWidth / ART.w, innerHeight / ART.h);
    const ox = (innerWidth - ART.w * s) / 2, oy = (innerHeight - ART.h * s) / 2;
    return { x: ox + ART.moon.x * s, y: oy + ART.moon.y * s, r: ART.moon.r * s };
  }

  _updateFx(dt, t) {
    const c = this.fx, x = this.fctx, W = c.width, H = c.height;
    const calm = this.g.settings.reduceShake || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // parallax: the art moves less than the particle layer (depth without any 3D)
    const px = calm ? 0 : (this.pointer.x - 0.5), py = calm ? 0 : (this.pointer.y - 0.5);
    this.art.style.transform = `translate(${(-px * 12).toFixed(1)}px, ${(-py * 8).toFixed(1)}px) scale(1.035)`;
    c.style.transform = `translate(${(-px * 22).toFixed(1)}px, ${(-py * 14).toFixed(1)}px)`;
    x.clearRect(0, 0, W, H);
    // Blood Moon: slow pulsing glow
    const m = this._moonOnScreen(), mx = m.x / 3, my = m.y / 3, mr = m.r / 3;
    const pulse = 0.55 + Math.sin(t * 0.9) * 0.18 + Math.sin(t * 2.3) * 0.05;
    x.globalCompositeOperation = 'lighter';
    const glow = x.createRadialGradient(mx, my, mr * 0.85, mx, my, mr * 2.4);
    glow.addColorStop(0, `rgba(255,40,20,${0.28 * pulse})`); glow.addColorStop(0.45, `rgba(170,10,8,${0.12 * pulse})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(mx - mr * 2.5, my - mr * 2.5, mr * 5, mr * 5);
    // fog banks drifting along the ground and the mid distance
    for (let i = 0; i < 5; i++) {
      const fx = ((t * (4 + i * 1.7) + i * 211) % (W + 240)) - 120, fy = H * (0.62 + i * 0.07) + Math.sin(t * 0.3 + i) * 4;
      const r = W * (0.18 + (i % 3) * 0.05);
      const fg = x.createRadialGradient(fx, fy, 0, fx, fy, r);
      fg.addColorStop(0, `rgba(120,40,36,${0.09 - i * 0.008})`); fg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = fg; x.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
    // embers rising / ash falling (fixed pool, recycled - no allocation per frame)
    if (!this.particles.length) for (let i = 0; i < 140; i++) this.particles.push(this._spawn({}, W, H, true));
    for (const p of this.particles) {
      p.life -= dt;
      p.x += (p.vx + Math.sin(t * p.sw + p.ph) * p.sa) * dt; p.y += p.vy * dt;
      if (p.life <= 0 || p.y < -4 || p.y > H + 4 || p.x < -4 || p.x > W + 4) this._spawn(p, W, H, false);
      const flick = p.ember ? 0.55 + Math.sin(t * 9 + p.ph) * 0.45 : 0.7;
      x.globalAlpha = Math.max(0, Math.min(1, p.life * 0.8)) * flick * p.a;
      x.fillStyle = p.color;
      x.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }

  _spawn(p, W, H, anywhere) {
    const ember = Math.random() < 0.6;
    Object.assign(p, {
      ember,
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : ember ? H + 2 : -2,
      vx: ember ? (Math.random() - 0.5) * 3 : 2 + Math.random() * 3,
      vy: ember ? -(3 + Math.random() * 7) : 2 + Math.random() * 3,
      sw: 0.5 + Math.random(), sa: ember ? 2 + Math.random() * 3 : 1.5, ph: Math.random() * 7,
      life: 4 + Math.random() * 8, s: Math.random() < 0.15 ? 2 : 1,
      a: ember ? 0.9 : 0.35 + Math.random() * 0.3,
      color: ember ? (Math.random() < 0.3 ? '#ffd27a' : Math.random() < 0.6 ? '#ff7a2a' : '#e8341c') : (Math.random() < 0.5 ? '#8a8078' : '#5e5550'),
    });
    return p;
  }
}
