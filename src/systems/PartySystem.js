import { HORSEMEN, CLASS_ORDER } from '../data/characters.js';
import { DIRS } from '../data/config.js';
import { PARTY_TUNING } from '../data/party.js';
import { CharacterStats } from './CharacterStats.js';
import { StatCalculator } from './StatCalculator.js';
import { EquipmentSystem } from './EquipmentSystem.js';
import { WeaponSystem } from './WeaponSystem.js';
import { ResourceManager } from './ResourceManager.js';
import { SkillSystem } from './SkillSystem.js';
import { LegendaryEffects } from './LegendaryEffects.js';
import { CompanionAI } from './CompanionAI.js';

// All four Horsemen in one party. Every Horseman owns a full set of the single-hero systems
// (stats, derived-stat calculator, equipment, weapon timing, class resource, skills + cooldowns,
// item effects, statuses, a body on the grid, a selected target). The game's `g.hero`, `g.weapons`,
// `g.player`... always point at ONE set:
//   - the controlled Horseman's set while the player acts (keyboard input, first-person camera);
//   - a companion's set inside withActor(member, fn), so the companion's attacks, skills and the
//     blows it takes go through the exact same CombatSystem / SkillSystem code and rules.
// Switching control simply re-points `g.*` to another member (setControlled).
const KEYS = ['hero', 'calc', 'equipment', 'weapons', 'resource', 'skills', 'legend', 'player', 'target'];
const MUTED_EFFECTS = new Set(['addShake', 'screenFlash', 'damageFrom', 'showBanner', 'sparkleColumn']);
const noop = () => {};

export class PartySystem {
  constructor(g) {
    this.g = g;
    this.ai = new CompanionAI(g, this);
    this.realEffects = g.effects;
    this.realFx = g.fx;
    // companions never shake / flash the player's screen or play full-screen skill art;
    // enemy-anchored damage numbers and bursts still show
    this.mutedEffects = new Proxy(g.effects, { get: (t, k) => (MUTED_EFFECTS.has(k) ? noop : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
    this.mutedFx = new Proxy(g.fx, { get: (t, k) => (typeof t[k] === 'function' ? noop : t[k]) });
    this.members = [];
    this.ctl = null;      // the Horseman the player controls
    this.current = null;  // whose systems `g.*` point at right now
    this.trail = [];      // leader cells, newest first (formation following)
  }

  // party mode is on unless the player chose SOLO (or a legacy test pinned solo play)
  get wanted() { return this.g.settings.party !== 'off' && !this.g.forceSolo; }
  get enabled() { return this.wanted && this.members.length > 1; }
  get companions() { return this.members.filter((m) => m !== this.ctl); }
  get companionCtx() { return !!this.current && this.current !== this.ctl; }
  byClass(id) { return this.members.find((m) => m.classId === id) || null; }

  // ---------------------------------------------------------------- context switching
  _capture(m) {
    const g = this.g;
    for (const k of KEYS) m[k] = g[k];
    m.statusMap = g.status.player;
  }
  _apply(m) {
    const g = this.g;
    for (const k of KEYS) g[k] = m[k];
    g.status.player = m.statusMap;
    const lead = m === this.ctl;
    g.effects = lead ? this.realEffects : this.mutedEffects;
    g.fx = lead ? this.realFx : this.mutedFx;
  }

  // Runs fn with `g.*` pointing at member m (nest-safe). Anything fn changes (target, body...) is kept.
  withActor(m, fn) {
    if (!m || m === this.current || !this.current) return fn();
    const prev = this.current;
    this._capture(prev);
    this._apply(m); this.current = m;
    try { return fn(); } finally {
      this._capture(m);
      this._apply(prev); this.current = prev;
    }
  }

  // ---------------------------------------------------------------- lifecycle
  _blank(classId) {
    return {
      classId, name: HORSEMEN[classId].name, color: HORSEMEN[classId].colors.accent, fallen: false,
      ai: { state: 'FOLLOW', think: 0, targetId: null, unreachable: new Map(), lastCast: -99, lastSeen: null, stuck: 0, lastPos: null },
      lastAction: null,
    };
  }

  // Wraps the game's current single-hero systems as the controlled (lead) Horseman.
  reset() {
    const lead = this._blank(this.g.hero.classId);
    this.members = [lead];
    this.ctl = this.current = lead;
    this._capture(lead);
    this.trail = [];
  }

  newGame() {
    this.reset();
    if (this.wanted) this.addCompanions();
  }

  // Creates the three other Horsemen at the leader's level with their class starting weapon.
  addCompanions(saved = null) {
    const lead = this.ctl, level = lead.hero.level;
    const order = CLASS_ORDER.filter((c) => c !== lead.classId);
    for (const cls of order) {
      if (this.byClass(cls)) continue;
      const s = saved?.members?.find((x) => x.classId === cls) || null;
      this.members.push(this._create(cls, level, s));
    }
    this.placeAround();
  }

  _create(classId, level, saved) {
    const g = this.g;
    const m = this._blank(classId);
    m.hero = new CharacterStats(g.bus);
    m.calc = new StatCalculator(g);
    m.hero.calc = m.calc;
    m.equipment = new EquipmentSystem(g.bus, g.inventory);
    m.equipment.game = g;
    m.weapons = new WeaponSystem(m.equipment);
    m.weapons.cooldownMult = g.weapons.cooldownMult; // reads g.status / g.hero, i.e. the acting member
    m.resource = new ResourceManager(g);
    m.skills = new SkillSystem(g);
    m.legend = new LegendaryEffects(g);
    m.statusMap = new Map();
    m.target = null;
    m.player = this._body(g.player);
    this.withActor(m, () => {
      m.hero.reset(classId);
      m.resource.reset(classId);
      if (saved?.hero) {
        m.hero.restore({ ...saved.hero, classId });
        m.resource.restore(saved.resource);
        m.equipment.restore(saved.equipment || {});
        m.equipment.validate();
        m.fallen = !!saved.fallen;
      } else {
        m.hero.level = Math.max(1, level);
        m.hero.skillPoints = Math.max(0, m.hero.level - 1);
        // starting weapon only: potions and spare gear stay in the shared bag
        for (const s of HORSEMEN[classId].startItems) {
          if (!s.equip) continue;
          const it = g.loot.create(s.item, s.rarity || 'common', 1);
          g.inventory.items.push(it);
          m.equipment.equip(it.uid);
        }
      }
      m.calc.invalidate();
      m.hero.hp = m.fallen ? 0 : saved?.hero ? Math.max(1, Math.min(m.hero.maxHp, saved.hero.hp ?? m.hero.maxHp)) : m.hero.maxHp;
    });
    return m;
  }

  _body(from) {
    return { x: from?.x ?? 0, y: from?.y ?? 0, dir: from?.dir ?? 0, guarding: false, guardStart: 0, guardUntil: 0, moveCD: 0, turnCD: 0, bob: 0, lastTurnAt: -10, lastBumpAt: -10 };
  }

  // PlayerController.reset made a new body for the controlled Horseman: adopt it, revive the fallen
  // with a share of their HP and gather everyone around the leader.
  onFloorStart() {
    if (!this.ctl || this.companionCtx) return;
    this.ctl.player = this.g.player;
    this.trail = [];
    if (!this.enabled) return;
    for (const m of this.companions) {
      if (!m.fallen) continue;
      m.fallen = false;
      this.withActor(m, () => { m.hero.hp = Math.max(1, Math.round(m.hero.maxHp * PARTY_TUNING.reviveFrac)); });
      this.g.log(`${m.name} rises again.`, m.color);
    }
    this.placeAround();
  }

  // Puts living companions on the nearest free walkable cells around the leader (breadth first).
  placeAround() {
    const g = this.g, p = g.player;
    if (!p || !this.enabled) return;
    const dm = g.dungeon, taken = new Set([`${p.x},${p.y}`]);
    const seen = new Set(taken), q = [[p.x, p.y]];
    const free = [];
    while (q.length && free.length < 3) {
      const [x, y] = q.shift();
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy, k = `${nx},${ny}`;
        if (seen.has(k) || !dm.isWalkable(nx, ny)) continue;
        seen.add(k);
        q.push([nx, ny]);
        if (!g.ai.enemyAt(nx, ny)) free.push([nx, ny]);
      }
      if (seen.size > 200) break;
    }
    let i = 0;
    for (const m of this.companions) {
      if (m.fallen) continue;
      const c = free[i++] || [p.x, p.y];
      Object.assign(m.player, { x: c[0], y: c[1], dir: p.dir, guarding: false, moveCD: 0 });
      m.ai.state = 'FOLLOW'; m.ai.stuck = 0;
    }
  }

  // ---------------------------------------------------------------- queries
  alive(m) { return !m.fallen && m.hero.hp > 0; }
  // living bodies on the grid, controlled Horseman first
  livingBodies() { return this.members.filter((m) => m === this.ctl || (this.enabled && this.alive(m))).map((m) => ({ member: m, body: m === this.ctl ? this.g.player : m.player })); }
  bodyOf(m) { return m === this.ctl && !this.companionCtx ? this.g.player : m.player; }
  // a companion standing on (x, y)
  memberAt(x, y) {
    if (!this.enabled) return null;
    return this.companions.find((m) => this.alive(m) && m.player.x === x && m.player.y === y) || null;
  }
  occupied(x, y, except = null) {
    if (!this.enabled) return false;
    return this.members.some((m) => m !== except && (m === this.ctl || this.alive(m)) && this.bodyOf(m).x === x && this.bodyOf(m).y === y);
  }
  ownerOf(uid) { return this.members.find((m) => m.equipment?.isEquipped(uid)) || null; }
  isEquipped(uid) { return this.members.some((m) => m.equipment?.isEquipped(uid)); }

  // ---------------------------------------------------------------- control
  // Hands direct control to another living Horseman; the previous one becomes AI-controlled.
  setControlled(m, quiet = false) {
    const g = this.g;
    if (!m || m === this.ctl || this.companionCtx || !this.enabled) return false;
    if (!this.alive(m)) { if (!quiet) g.log(`${m.name} has fallen and cannot be controlled.`, '#ff7a60'); return false; }
    const prev = this.ctl;
    this._capture(prev);
    prev.ai.state = 'FOLLOW'; prev.ai.targetId = null;
    prev.player.guarding = false;
    this.ctl = this.current = m;
    this._apply(m);
    m.player.guarding = false; m.player.moveCD = 0; m.player.turnCD = 0;
    g.controller.buffered = [];
    g.weapons.cancel?.();
    g.dungeon.reveal(m.player.x, m.player.y, m.player.dir);
    this.trail = [];
    if (!quiet) {
      g.log(`You take control of ${m.name}, ${HORSEMEN[m.classId].title}. ${prev.name} fights on its own.`, m.color);
      g.audio.play('select' + m.classId[0].toUpperCase() + m.classId.slice(1));
    }
    return true;
  }

  cycleControl(step = 1) {
    const order = this.members.slice().sort((a, b) => CLASS_ORDER.indexOf(a.classId) - CLASS_ORDER.indexOf(b.classId));
    let i = order.indexOf(this.ctl);
    for (let n = 0; n < order.length; n++) {
      i = (i + step + order.length) % order.length;
      if (order[i] !== this.ctl && this.alive(order[i])) return this.setControlled(order[i]);
    }
    return false;
  }

  // ---------------------------------------------------------------- combat hooks
  // An enemy finished its wind-up: the blow lands on the Horseman it is fighting.
  enemyStrike(e) {
    const g = this.g, m = e.aggro;
    if (this.enabled && m && m !== this.ctl && this.alive(m)) this.withActor(m, () => g.combat.enemyStrike(e));
    else g.combat.enemyStrike(e);
  }

  // A companion's HP reached 0 (called instead of the game-over path).
  onMemberFallen(m, by) {
    const g = this.g;
    if (!m || m.fallen) return;
    m.fallen = true;
    m.ai.state = 'FALLEN'; m.ai.targetId = null;
    m.player.guarding = false;
    m.lastAction = { text: 'FALLEN', t: g.time };
    for (const e of g.enemies) if (e.aggro === m) e.aggro = null;
    g.log(`${m.name} has fallen${by?.name ? ` to ${by.name}` : ''}! The others fight on.`, '#ff3020');
    g.notify(`${m.name} has fallen.`, { kind: 'warn' });
  }

  // The controlled Horseman fell: hand control to a living companion. false = nobody left (game over).
  onControlledFallen(by) {
    const g = this.g;
    if (!this.enabled) return false;
    const next = this.companions.find((m) => this.alive(m));
    if (!next) return false;
    const fallen = this.ctl;
    this._capture(fallen);
    fallen.fallen = true;
    fallen.ai.state = 'FALLEN';
    g.log(`${fallen.name} has fallen${by?.name ? ` to ${by.name}` : ''}!`, '#ff3020');
    g.notify(`${fallen.name} has fallen - you now lead ${next.name}.`, { kind: 'warn' });
    this.setControlled(next, true);
    g.log(`You take control of ${next.name}.`, next.color);
    return true;
  }

  // XP is shared by the whole party (fallen members included), so all four level together.
  gainXp(n) {
    for (const m of this.members) this.withActor(m, () => m.hero.gainXp(n));
  }

  // Camp: everyone is healed, revived and cleansed.
  restAll() {
    for (const m of this.members) {
      m.fallen = false;
      if (m === this.ctl) continue;
      this.withActor(m, () => { m.statusMap.clear(); m.hero.hp = m.hero.maxHp; });
      m.ai.state = 'FOLLOW';
    }
  }

  // Leader moved: remember the cell it left (formation following).
  onLeaderMoved(prev) {
    if (!prev || prev.x === undefined) return;
    this.trail.unshift({ x: prev.x, y: prev.y });
    if (this.trail.length > PARTY_TUNING.trail) this.trail.length = PARTY_TUNING.trail;
  }

  // Per frame (after the controlled Horseman's own update): companions tick their own weapon,
  // skills, resource, statuses and AI inside their context.
  // Work a companion triggered that belongs to the world (kill events -> gates, quests): runs after
  // the companions' turn, from the controlled Horseman's context.
  defer(fn) { (this.deferred ||= []).push(fn); }
  _flush() {
    const list = this.deferred || [];
    this.deferred = [];
    for (const fn of list) fn();
  }

  update(dt) {
    if (!this.enabled) return;
    const g = this.g;
    this._flush();
    for (const m of this.companions) {
      this.withActor(m, () => {
        g.weapons.update(dt);
        g.skills.update(dt);
        g.resource.update(dt, g.inCombat);
        g.hero.update(dt);
        g.status.updatePlayer();
        const b = g.player;
        b.moveCD = Math.max(0, b.moveCD - dt);
        if (b.guarding && g.time >= b.guardUntil) b.guarding = false;
        if (this.alive(m)) this.ai.update(m, dt);
        else if (!m.fallen && m.hero.hp <= 0) this.onMemberFallen(m, null);
      });
    }
    this._flush();
  }

  // Companion log lines: "You hit" -> "WAR hits", "hits you" -> "hits WAR"; lines without a
  // "you" get a "WAR: " prefix. Brief mode drops routine swings / blows (the party panel and
  // the floating damage numbers still show them). Returns null to drop the line.
  rewriteLog(text) {
    const m = this.current, name = m.name;
    if (this.g.settings.companionLog !== 'full' && /^(CRITICAL! )?(You hit|You miss|You strike at empty air|Reloading|LEVEL UP!|Autosaved)|hits you for|You (dodge|evade)/.test(text)) {
      m.lastAction = { text: text.replace(/^CRITICAL! /, 'CRIT ').replace(/^You /, '').replace(/ the /g, ' ').replace(/[.!]$/, ''), t: this.g.time };
      return null;
    }
    const verb = (v) => (v === 'are' ? 'is' : v === 'have' ? 'has' : /(s|sh|ch|x|z|o)$/.test(v) ? v + 'es' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : v + 's');
    let out = text.replace(/\bYou (\w+)/g, (_, v) => `${name} ${verb(v)}`).replace(/\byou\b/g, name).replace(/\b[Yy]our\b/g, `${name}'s`);
    if (out === text && !text.includes(name)) out = `${name}: ${text}`;
    m.lastAction = { text: out.replace(`${name}: `, '').replace(`${name} `, ''), t: this.g.time };
    return out;
  }

  // ---------------------------------------------------------------- render data
  // Companions visible to the renderer: grid cell, class, weapon pose, swinging?
  renderList() {
    if (!this.enabled) return [];
    return this.companions.filter((m) => this.alive(m)).map((m) => ({ x: m.player.x, y: m.player.y, classId: m.classId, name: m.name, color: m.color, weaponId: m.weapons.weaponId, swing: !!m.weapons.anim, guarding: m.player.guarding }));
  }

  // ---------------------------------------------------------------- save / load
  serialize() {
    if (!this.members.length) return null;
    this._capture(this.ctl);
    return {
      controlled: this.ctl.classId,
      members: this.companions.map((m) => ({ classId: m.classId, fallen: m.fallen, hero: m.hero.serialize(), resource: m.resource.serialize(), equipment: m.equipment.serialize() })),
    };
  }

  // After the controlled Horseman and the shared bag were restored. Old saves (no party block)
  // get fresh companions at the leader's level with their class starting weapon.
  restore(data) {
    this.reset();
    if (!this.wanted) return;
    this.addCompanions(data && Array.isArray(data.members) ? data : null);
  }
}
