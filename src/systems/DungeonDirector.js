import { DUNGEONS } from '../data/dungeons/index.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { BOSSES } from '../data/bosses.js';
import { RECIPES, REFORGE } from '../data/recipes.js';
import { ITEM_DEFS } from '../data/items.js';
import { scaledXp } from '../data/progression.js';
import { LORE_BY_ID } from '../data/lore.js';
import { newSeed } from '../core/rng.js';
import { generateDungeon, floorLevel, RUNE_SYMBOLS } from './DungeonGenerator.js';
import { validateLayout } from './DungeonValidator.js';
import { TILE } from './DungeonManager.js';

// DungeonDirector: the Phase 4 glue. Owns
//   DungeonManager-level lifecycle  enter / resume / floors / return to camp / completion
//   run ledger                      every reward event id is claimed once per run (kills, chests,
//                                   secrets, puzzles, boss, completion); permanent once-per-save events
//                                   (first clears, scrolls, lore) use DungeonProgress.claim
//   DungeonObjectiveManager         objectives() derives live status from state, never stored twice
//   DungeonRewardManager            boss + completion rewards, first-clear bonuses, unlocks
//   SecretRoomManager / Discovery   secret walls, hidden switches, guardian-sealed tombs, class clues
//   class interactions              War barriers, Conquest sigils, Famine roots/shrines, Death seals
// Run state that must not be farmed (opened chests, dead enemies, found secrets) is kept until the
// run is completed: leaving for the camp suspends the run instead of resetting it.
const DIR_NAMES = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const CLASS_TILES = { [TILE.BARRIER]: 'war', [TILE.SIGILDOOR]: 'conquest', [TILE.ROOTDOOR]: 'famine', [TILE.SOULSEAL]: 'death' };
const CLASS_TEXT = {
  war: { look: 'A weakened barrier of rubble and old timber.', other: 'Only the strength of WAR could smash it. (A hidden switch elsewhere on this floor also opens it.)', open: 'You smash through the weakened barrier!' },
  conquest: { look: 'A sealed sigil door with a small golden target set high in the stone.', other: 'Only a precise shot could strike its target - CONQUEST sees the mechanism at once. (A hidden switch elsewhere also opens it.)', open: 'Your eye finds the hidden catch behind the sigil.' },
  famine: { look: 'A wall of black, blighted roots.', other: 'Only hunger could wither them - FAMINE drains such roots. (A hidden switch elsewhere also opens it.)', open: 'You drain the last life from the roots; they crumble to dust.' },
  death: { look: 'A seal of pale, bound souls.', other: 'The souls whisper for DEATH. (A hidden switch elsewhere also opens it.)', open: 'The bound souls recognise you and part like smoke.' },
};

export class DungeonDirector {
  constructor(game) { this.game = game; }
  get dm() { return this.game.dungeon; }
  get run() { return this.game.run; }
  get def() { return this.run ? DUNGEONS[this.run.dungeonId] : null; }
  get generated() { return !!this.dm?.def?.generated; }

  // ------------------------------------------------------------------ layouts
  layoutFor(def, seed, floor, difficulty) {
    if (def.authored) {
      const L = { ...def.authored, id: def.id, defId: def.id, name: def.name, generated: false, floor: 0, floors: 1, finalFloor: true, seed, difficulty };
      L.report = validateLayout(L);
      return L;
    }
    return generateDungeon(def, { seed, floor, difficulty, log: (m) => console.warn(m) });
  }

  // ------------------------------------------------------------------ run lifecycle
  newRun(dungeonId, difficulty = 'normal', seed = newSeed()) {
    const g = this.game;
    return {
      dungeonId, difficulty, seed: seed >>> 0, floor: 0, ledger: new Set(), floors: {}, bossDefeated: false,
      stats0: { kills: g.stats.kills, xp: g.stats.xpGained, secrets: g.stats.secrets, gold: g.stats.goldEarned || 0, damage: g.stats.damageTaken, time: g.stats.playTime },
      startedAt: Date.now(),
    };
  }
  serializeRun(r = this.run) {
    if (!r) return null;
    return { dungeonId: r.dungeonId, difficulty: r.difficulty, seed: r.seed, floor: r.floor, ledger: [...r.ledger], floors: r.floors, bossDefeated: r.bossDefeated, stats0: r.stats0, bossReward: r.bossReward || null };
  }
  restoreRun(s) {
    if (!s || !DUNGEONS[s.dungeonId] || !DIFFICULTIES[s.difficulty]) return null;
    const floors = DUNGEONS[s.dungeonId].floors || 1;
    return {
      dungeonId: s.dungeonId, difficulty: s.difficulty, seed: s.seed >>> 0, floor: Math.max(0, Math.min(floors - 1, s.floor | 0)),
      ledger: new Set(Array.isArray(s.ledger) ? s.ledger : []), floors: s.floors || {}, bossDefeated: !!s.bossDefeated,
      stats0: s.stats0 || { kills: 0, xp: 0, secrets: 0, gold: 0, damage: 0, time: 0 }, bossReward: s.bossReward || null,
    };
  }
  claim(key) {
    const r = this.run;
    if (!r) return true;
    if (r.ledger.has(key)) { console.warn(`[DungeonDirector] duplicate reward event ignored: ${key}`); return false; }
    r.ledger.add(key);
    return true;
  }
  claimKill(e) { return e.sid && this.run ? this.claim(`kill:${this.run.floor}:${e.sid}`) : true; }

  // Build (or rebuild) the active floor of the current run; restores its snapshot when it has one.
  buildFloor(floor, { restore = true } = {}) {
    const g = this.game, run = this.run, def = this.def;
    run.floor = floor;
    const layout = this.layoutFor(def, run.seed, floor, run.difficulty);
    g.dungeon.load(layout);
    g.renderer.setTheme(def.theme);
    g.audio.setAmbience(def.audio);
    g.ai.spawnAll(g.dungeon.spawns);
    g.loot.resetFloor(layout);
    g.combat.reset(); g.effects.clear(); g.bossCtl.reset(); g.hazards.reset();
    g.controller.reset(g.dungeon.start);
    g.target = null;
    const snap = restore ? run.floors[floor] : null;
    if (snap) {
      g.dungeon.restore(snap.dungeon);
      g.ai.restore(snap.enemies || []);
      g.loot.restoreFloor(snap.loot || { floor: [] });
      if (snap.player && g.dungeon.isWalkable(snap.player.x, snap.player.y)) Object.assign(g.player, { x: snap.player.x, y: snap.player.y, dir: (snap.player.dir | 0) % 4 });
      g.dungeon.reveal(g.player.x, g.player.y, g.player.dir);
    }
    // a defeated boss stays defeated, its exit stays open
    if (run.bossDefeated) for (const gate of g.dungeon.gateState) { gate.unlocked = true; }
    return layout;
  }
  snapshotFloor() {
    const g = this.game, run = this.run;
    if (!run) return;
    run.floors[run.floor] = { dungeon: g.dungeon.serialize(), enemies: g.ai.serialize(), loot: g.loot.serializeFloor(), player: { x: g.player.x, y: g.player.y, dir: g.player.dir } };
  }

  // From the camp (or a test): start a fresh run, or resume the suspended one.
  enter(dungeonId, difficulty = null) {
    const g = this.game, p = g.progress, def = DUNGEONS[dungeonId];
    if (!def) return { ok: false, msg: 'Unknown dungeon.' };
    if (!p.isUnlocked(dungeonId)) return { ok: false, msg: p.unlockReason(dungeonId) };
    const suspended = p.runs[dungeonId];
    let run;
    if (suspended) {
      run = this.restoreRun(suspended);
      delete p.runs[dungeonId];
    } else {
      const diff = difficulty || p.selected[dungeonId] || 'normal';
      if (!p.difficultyUnlocked(dungeonId, diff)) return { ok: false, msg: p.unlockReason(dungeonId, diff) };
      run = this.newRun(dungeonId, diff);
    }
    g.run = run;
    g.beginScene('playing');
    const layout = this.buildFloor(run.floor);
    this._reached();
    g.log(`${def.name}${def.floors > 1 ? ` - floor ${run.floor + 1}/${def.floors}` : ''} (${DIFFICULTIES[run.difficulty].name}).`, '#ffd040');
    g.log(def.lore, '#c8b890');
    if (suspended) g.log('You return to where you left off. Opened chests and slain foes stay that way until the run is completed.', '#a89a70');
    const warn = this.levelWarning(dungeonId, run.difficulty);
    if (warn) g.log(warn.text, warn.color);
    g.effects.showBanner(def.name, def.theme.accent, 2.2);
    g.onPlayerMoved();
    g.autosave('entered dungeon');
    return { ok: true, layout };
  }

  levelWarning(dungeonId, difficulty = 'normal') {
    const g = this.game, def = DUNGEONS[dungeonId];
    const lvl = g.hero.level, [lo] = def.recommended, enemy = floorLevel(def, 0, difficulty);
    if (lvl + 8 <= lo) return { text: `DANGER: recommended level ${def.recommended.join('-')}; you are level ${lvl}. Enemies here are level ${enemy}+.`, color: '#ff4030', danger: true };
    if (lvl + 3 <= lo) return { text: `Warning: recommended level ${def.recommended.join('-')}; you are level ${lvl}.`, color: '#ffb040' };
    return null;
  }

  descend() {
    const g = this.game, run = this.run, def = this.def;
    if (!run || run.floor >= (def.floors || 1) - 1) return false;
    if (g.inCombat) { g.log('You cannot take the stairs with enemies on your heels!', '#ff7a60'); return true; }
    this.snapshotFloor();
    this.claim(`floor:${run.floor}`);
    g.audio.play('stairs');
    this.buildFloor(run.floor + 1);
    this._reached();
    g.grantXp(Math.round((def.completionXp || 100) * 0.2), `reached floor ${run.floor + 1}`);
    g.effects.showBanner(`FLOOR ${run.floor + 1}`, def.theme.accent, 1.8);
    g.log(`You descend to floor ${run.floor + 1} of ${def.floors}.`, '#ffd040');
    g.onPlayerMoved();
    g.autosave('new floor');
    return true;
  }

  // Phase 5: deepest floor (quest 'reach' objectives) + event for listeners.
  _reached() {
    const g = this.game, run = this.run;
    g.progress.reachFloor(run.dungeonId, run.floor);
    g.bus.emit('floorReached', { dungeonId: run.dungeonId, floor: run.floor });
  }

  // Suspend the run (state kept exactly) and go to the camp.
  returnToCamp() {
    const g = this.game;
    if (g.inCombat || g.combat.active) { g.log('You cannot leave in the middle of a fight.', '#ff7a60'); return false; }
    if (this.run && !this.run.done) {
      this.snapshotFloor();
      g.progress.runs[this.run.dungeonId] = this.serializeRun();
      g.log('Run suspended. Return to continue exactly where you stopped.', '#a89a70');
    }
    g.run = null;
    g.toCamp();
    return true;
  }

  // ------------------------------------------------------------------ objectives
  objectives() {
    const g = this.game, run = this.run, dm = this.dm;
    if (!run || !this.generated) return [];
    const L = dm.def;
    const out = [];
    for (const o of L.objectives || []) {
      let done = false, progress = '';
      if (o.kind === 'clear') done = g.enemies.filter((e) => e.room === o.room && !e.summoned).every((e) => !e.alive);
      if (o.kind === 'puzzle') done = !!dm.puzzles.get(o.puzzle)?.solved;
      if (o.kind === 'stairs') done = false;
      if (o.kind === 'boss') done = run.bossDefeated;
      if (o.kind === 'exit') done = !!run.done;
      if (o.kind === 'secrets') { const n = this.secretsFoundOnFloor(); done = n >= o.total; progress = ` (${n}/${o.total})`; }
      if (o.kind === 'classRoom') { const r = dm.room(o.room); done = !!(r?.classDoor && dm.isOpened(r.classDoor.x, r.classDoor.y)); }
      out.push({ ...o, done, label: o.text + progress });
    }
    return out;
  }
  currentObjective() { return this.objectives().find((o) => !o.optional && !o.done) || null; }
  secretsFoundOnFloor() {
    const dm = this.dm;
    return dm.def.rooms.filter((r) => r.type === 'secret' && r.secretDoor && dm.isOpened(r.secretDoor.x, r.secretDoor.y)).length;
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, dm = this.dm;
    if (!this.run || !this.generated) return;
    for (const gate of dm.gateState) {
      if (gate.unlocked || gate.requires?.type !== 'clear') continue;
      if (g.enemies.filter((e) => e.room === gate.requires.room).every((e) => !e.alive)) this.unlockGate(gate, 'The guardian falls - the sealed gate unlocks!');
    }
    const closed = dm.updateTimers(g.time, (x, y) => (g.player.x === x && g.player.y === y) || g.enemies.some((e) => e.alive && e.x === x && e.y === y));
    if (closed.length) {
      for (const f of dm.featuresOf('lever')) f.pulled = false;
      g.audio.play('gate');
      g.log('A portcullis slams shut.', '#c8b890');
    }
    g.hazards.update(dt);
  }

  unlockGate(gate, msg) {
    const g = this.game;
    if (gate.unlocked) return;
    gate.unlocked = true;
    g.audio.play('gate');
    g.effects.showBanner('THE WAY OPENS', '#ff9a40', 1.8);
    g.log(msg, '#ff9a40');
    if (this.claim(`gate:${this.run.floor}:${gate.x},${gate.y}`)) g.grantXp(Math.round(30 + 5 * (this.dm.def.level || 1)), 'objective complete');
  }

  // ------------------------------------------------------------------ events
  onPlayerMoved() {
    const g = this.game, p = g.player, dm = this.dm;
    if (!this.run || !this.generated) return;
    const f = dm.featureAt(p.x, p.y);
    if (f?.kind === 'plate') g.puzzles.stepOn(f);
    const room = dm.roomAt(p.x, p.y);
    if (room.id !== this.lastRoom) { this.lastRoom = room.id; this.onRoomEntered(room); }
  }

  onRoomEntered(room) {
    const g = this.game, dm = this.dm, cls = g.hero.classId;
    g.legend.onRoomEnter?.();
    g.bus.emit('roomEntered', { room: room.id, type: room.type });
    if (room.type === 'boss' && !this.run.bossDefeated && !g.inCombat && this.claim(`checkpoint:${this.run.floor}`)) {
      g.autosave('checkpoint before the boss');
      g.log('Checkpoint saved before the boss. If you fall, LOAD LAST SAVE to try again.', '#7ac060');
    }
    // class perception (optional clues; progression never depends on them)
    const secretNeighbours = dm.def.rooms.filter((r) => r.type === 'secret' && r.secretDoor && !dm.isOpened(r.secretDoor.x, r.secretDoor.y) && dm.def.edges.some((e) => (e.a === room.id && e.b === r.id) || (e.b === room.id && e.a === r.id)));
    if (cls === 'death') for (const s of secretNeighbours) {
      if (!this.claim(`clue:${this.run.floor}:${s.id}`)) continue;
      dm.explored[dm.key(s.secretDoor.x, s.secretDoor.y)] = 1;
      g.log(`A spirit whispers: "A forgotten tomb lies beyond the ${this.dirTo(room, s.secretDoor)} wall..." (marked on your map)`, '#a8d8f0');
    }
    if (cls === 'conquest') for (const f of dm.featureList.filter((q) => q.kind === 'switch' && q.room === room.id && !q.found && !q.spotted)) {
      f.spotted = true; dm.explored[dm.key(f.x, f.y)] = 1;
      g.log(`Your hunter's eye spots a suspicious mechanism in the ${this.dirTo(room, f)} wall.`, '#f0d070');
    }
    if (cls === 'famine') for (const r of dm.def.rooms.filter((q) => (q.type === 'treasure' || q.type === 'class') && dm.def.edges.some((e) => (e.a === room.id && e.b === q.id) || (e.b === room.id && e.a === q.id)))) {
      if (!this.claim(`trace:${this.run.floor}:${r.id}`)) continue;
      g.log(`You smell old grain and hoarded stores to the ${this.dirTo(room, { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 })}.`, '#b0b040');
    }
    if (cls === 'war' && room.type === 'challenge' && this.claim(`warcry:${this.run.floor}:${room.id}`)) g.log('A worthy fight! WAR earns extra spoils from challenge rooms.', '#ff6040');
  }
  dirTo(room, pt) {
    const cx = (room.x1 + room.x2) / 2, cy = (room.y1 + room.y2) / 2, dx = pt.x - cx, dy = pt.y - cy;
    return Math.abs(dx) > Math.abs(dy) ? DIR_NAMES[dx > 0 ? 1 : 3] : DIR_NAMES[dy > 0 ? 2 : 0];
  }

  onEnemyKilled(e) {
    const g = this.game;
    if (e.guardsSecret && this.generated) {
      const { x, y } = e.guardsSecret;
      if (!this.dm.isOpened(x, y)) { g.log('As the tomb guardian falls, a hidden wall crumbles!', '#b25ae0'); this.discoverSecret(x, y, 'guardian'); }
    }
  }

  onBossStarted(e) {
    const g = this.game;
    for (const gate of this.dm.gateState) if (gate.goal === e.room && this.dm.isOpened(gate.x, gate.y)) {
      gate.sealed = true; this.dm.closeTile(gate.x, gate.y);
      g.log('The arena gate slams shut behind you!', '#ff6040');
    }
  }

  // BossRewardManager: called once from CombatSystem._kill (rewards rolled once by LootSystem).
  onBossDefeated(e, loot) {
    const g = this.game, run = this.run, bdef = BOSSES[e.type];
    g.bossCtl.onBossDeath(e);
    for (const gate of this.dm.gateState) if (gate.sealed) { gate.sealed = false; gate.unlocked = true; this.dm.openTile(gate.x, gate.y); }
    if (bdef.miniboss) { // Phase 5 miniboss: rewards once, opens its floor's gate, never the exit
      if (run && !this.claim(`miniboss:${run.floor}:${e.type}`)) return;
      const names = [];
      for (const it of loot.items) { names.push(it.name + (it.qty > 1 ? ' x' + it.qty : '')); g.giveItem(it); }
      g.progress.bosses[e.type] = (g.progress.bosses[e.type] || 0) + 1;
      g.audio.play('bossDefeat');
      g.effects.showBanner(`${bdef.name.toUpperCase()} FALLS`, '#ffd040', 2.2);
      g.log(`${bdef.name} is defeated! ${names.length ? 'Rewards: ' + names.join(', ') : ''}${loot.gold ? `, ${loot.gold} gold` : ''}.`, '#ffd040');
      g.bus.emit('bossDefeated', { id: e.type, miniboss: true, dungeonId: run?.dungeonId });
      g.autosave('miniboss defeated', true);
      return;
    }
    if (!run || !this.claim('boss')) return;
    run.bossDefeated = true;
    const items = [];
    for (const it of loot.items) { items.push({ name: it.name, rarity: it.rarity, qty: it.qty }); g.giveItem(it); }
    g.progress.bosses[e.type] = (g.progress.bosses[e.type] || 0) + 1;
    const learned = [];
    for (const rid of bdef.unlockRecipes || []) if (g.craft.unlockRecipe(rid)) learned.push(RECIPES.find((r) => r.id === rid)?.name || rid);
    run.bossReward = { name: bdef.name, items, gold: loot.gold, xp: g.xpFor(e), learned };
    g.audio.play('bossDefeat');
    g.effects.showBanner('VICTORY', '#ffd040', 3);
    g.effects.sparkleColumn(192, 160, '#ffd040', 60);
    g.log(`${bdef.name} is destroyed! Rewards: ${items.map((i) => i.name + (i.qty > 1 ? ' x' + i.qty : '')).join(', ')}${loot.gold ? `, ${loot.gold} gold` : ''}.`, '#ffd040');
    for (const n of learned) g.log(`Recipe learned: ${n}!`, '#7ac060');
    g.log('The exit portal awakens. [E] on it to leave the dungeon.', '#a8f0ff');
    g.bus.emit('bossDefeated', { id: e.type, miniboss: false, dungeonId: run.dungeonId });
    g.panel = null; g.openPanel('victory');
    g.autosave('boss defeated', true);
  }

  // ------------------------------------------------------------------ interaction (front tile)
  // Returns true when this tile/feature was handled (PlayerController falls back otherwise).
  interact(x, y) {
    const g = this.game, dm = this.dm, t = dm.tile(x, y), cls = g.hero.classId;
    if (!this.generated) return false;
    const f = dm.featureAt(x, y);
    if (CLASS_TILES[t] && !dm.isOpened(x, y)) {
      const need = CLASS_TILES[t], txt = CLASS_TEXT[need];
      if (cls === need) { this.openClassDoor(x, y, txt.open); if (need === 'famine') g.resource.gain(20); }
      else { g.log(`${txt.look} ${txt.other}`, '#c8b890'); g.audio.play('bump'); }
      return true;
    }
    if (t === TILE.TIMED && !dm.isOpened(x, y)) { g.log('A lowered portcullis. A lever must raise it.', '#c8b890'); g.audio.play('bump'); return true; }
    if (t === TILE.GATE) {
      const gate = dm.gateAt(x, y);
      if (gate?.sealed) { g.log('The arena gate is sealed until the fight ends.', '#ff6040'); g.audio.play('bump'); return true; }
      if (gate && !gate.unlocked) { g.log(`Sealed. ${this.currentObjective()?.label || ''}`.trim(), '#ff6040'); g.audio.play('bump'); return true; }
      return false; // unlocked: normal gate opening
    }
    if (t === TILE.SECRET && !dm.isOpened(x, y)) return this.handleSecretWall(x, y);
    if (t === TILE.RUNE && f) return g.puzzles.touchRune(f);
    if (t === TILE.LEVER && f) return g.puzzles.pullLever(f);
    if (t === TILE.SWITCH && f) return this.pressSwitch(f);
    if (!f) return false;
    switch (f.kind) {
      case 'stairs':
        if (!this.descend()) g.log('The stairs lead nowhere.', '#8c8467');
        return true;
      case 'exit':
        if (!this.run.bossDefeated) { g.log(`The exit portal is sealed while ${BOSSES[this.dm.def.boss]?.name || 'the guardian'} lives.`, '#ff6040'); g.audio.play('bump'); return true; }
        this.completeRun();
        return true;
      case 'tablet':
        if (f.loreId && LORE_BY_ID[f.loreId]) { // Phase 5 codex tablet
          const l = LORE_BY_ID[f.loreId];
          g.log(`${l.title}: ${l.text}`, '#e8d8b0');
          if (g.quests?.discover(l.id)) g.grantXp(15, 'lore');
          return true;
        }
        g.log(f.text || 'Faded inscriptions cover the stone.', '#e8d8b0');
        if (g.progress.lore && !g.progress.lore.has(`${this.run.dungeonId}:${f.text}`)) { g.progress.lore.add(`${this.run.dungeonId}:${f.text}`); g.grantXp(10, 'lore'); }
        return true;
      case 'font':
        if (f.used) { g.log('The blessed water has run dry for now.', '#8c8467'); return true; }
        if (!this.claim(`font:${this.run.floor}:${f.id}`)) return true;
        f.used = true;
        { const healed = g.hero.heal(g.hero.maxHp * 0.4); g.resource.gain(g.resource.max * 0.3); g.status.remove('player', 'blighted'); g.status.remove('player', 'cursed'); g.audio.play('font'); g.log(`You drink from the blessed font. +${healed} HP, resource restored, Blight and Curses washed away.`, '#60ff80'); }
        return true;
      case 'shrine':
        if (f.used) { g.log('The shrine is drained and silent.', '#8c8467'); return true; }
        if (cls !== 'famine') { g.log('A corrupted shrine, thick with blight. FAMINE could drain its hoarded power.', '#b0b040'); return true; }
        if (!this.claim(`shrine:${this.run.floor}:${f.id}`)) return true;
        f.used = true;
        { const { items } = g.loot.rollTable('shrine_drain', this.dm.def.level || 1); g.resource.gain(30); for (const it of items) g.giveItem(it); g.audio.play('shrine'); g.log(`You drain the corrupted shrine: +30 Plague, ${items.map((i) => i.name + (i.qty > 1 ? ' x' + i.qty : '')).join(', ')}.`, '#b0b040'); }
        return true;
      case 'scroll': {
        if (f.used) { g.log('Only dust remains here.', '#8c8467'); return true; }
        if (!this.claim(`scroll:${this.run.floor}:${f.id}`)) return true;
        f.used = true;
        const rec = RECIPES.find((r) => r.id === f.recipe) || (f.recipe === REFORGE.recipe ? { name: REFORGE.name } : null);
        if (g.craft.unlockRecipe(f.recipe)) { g.audio.play('secret'); g.effects.showBanner('RECIPE LEARNED', '#7ac060', 1.6); g.log(`An ancient recipe scroll: you learn ${rec?.name || f.recipe}!`, '#7ac060'); }
        else { g.giveItem(g.loot.create('ancient_relic_dust', 'common', 1)); g.log(`You already know ${rec?.name || 'this recipe'}. The scroll crumbles into Ancient Relic Dust.`, '#c0a050'); }
        return true;
      }
      default: return false;
    }
  }

  // LOOK at the front tile. Returns true when described here.
  look(x, y) {
    const g = this.game, dm = this.dm, t = dm.tile(x, y);
    if (!this.generated) return false;
    const f = dm.featureAt(x, y);
    if (CLASS_TILES[t] && !dm.isOpened(x, y)) { const txt = CLASS_TEXT[CLASS_TILES[t]]; g.log(`${txt.look} ${g.hero.classId === CLASS_TILES[t] ? '[E] to open it.' : txt.other}`, '#c8b890'); return true; }
    if (t === TILE.SWITCH && f && !f.found) { g.log('An unusual symbol is carved into this stone, worn smooth by many hands... [E] to press it.', '#f0d070'); f.spotted = true; return true; }
    if (t === TILE.RUNE && f) { g.log(`A rune of ${RUNE_SYMBOLS[f.symbol]}${f.lit ? ', glowing' : ''}. [E] to touch it.`, '#a8d8f0'); return true; }
    if (t === TILE.LEVER) { g.log('A rusted lever. [E] to pull it.', '#c8b890'); return true; }
    if (t === TILE.TIMED && !dm.isOpened(x, y)) { g.log('A heavy portcullis. Somewhere there is a lever for it.', '#c8b890'); return true; }
    if (t === TILE.SECRET && !dm.isOpened(x, y)) return this.handleSecretWall(x, y, true);
    if (f?.kind === 'tablet') { g.log(f.loreId ? `An inscribed tablet: "${LORE_BY_ID[f.loreId]?.title}". [E] to read it.` : f.text, '#e8d8b0'); return true; }
    if (f?.kind === 'stairs') { g.log('Stairs lead deeper. [E] to descend.', '#c8b890'); return true; }
    if (f?.kind === 'exit') { g.log(this.run.bossDefeated ? 'The exit portal hums. [E] to leave.' : 'A dead portal. It will wake when the guardian falls.', '#a8f0ff'); return true; }
    if (f?.kind === 'font') { g.log(f.used ? 'An empty blessed font.' : 'A blessed font of clean water. [E] to drink.', '#60ff80'); return true; }
    if (f?.kind === 'shrine') { g.log('A corrupted famine shrine.', '#b0b040'); return true; }
    if (f?.kind === 'scroll') { g.log(f.used ? 'Dust.' : 'An ancient scroll case. [E] to read it.', '#c0a050'); return true; }
    return false;
  }

  // Secret walls: inspecting works for 'wall' secrets; 'switch' and 'guardian' secrets give a clue instead.
  handleSecretWall(x, y, looking = false) {
    const g = this.game, dm = this.dm;
    const room = dm.def.rooms.find((r) => r.secretDoor && r.secretDoor.x === x && r.secretDoor.y === y);
    const method = room?.method || 'wall';
    if (method === 'switch') { g.log('Cracked masonry, but it will not budge. There must be a hidden mechanism in this room.', '#b25ae0'); return true; }
    if (method === 'guardian') { g.log('Old scratches on the floor... something armoured keeps watch over this wall. Defeat it.', '#b25ae0'); return true; }
    if (looking) g.log('You notice a draft seeping through cracks in this wall...', '#b25ae0');
    this.discoverSecret(x, y, 'inspection');
    return true;
  }

  pressSwitch(f) {
    const g = this.game, dm = this.dm;
    if (f.found) { g.log('The hidden switch has already been pressed.', '#8c8467'); return true; }
    f.found = true;
    g.audio.play('lever');
    const { x, y } = f.opens;
    const t = dm.tile(x, y);
    if (t === TILE.SECRET) { g.log('You press the hidden switch. Stone grinds open nearby...', '#b25ae0'); this.discoverSecret(x, y, 'switch'); }
    else if (CLASS_TILES[t]) this.openClassDoor(x, y, 'You press the hidden switch. Somewhere, a sealed door grinds open.');
    return true;
  }

  // DiscoverySystem: a secret is discovered exactly once (tile + run ledger), with banner + sound.
  discoverSecret(x, y, how) {
    const g = this.game, dm = this.dm;
    if (dm.isOpened(x, y)) return false;
    dm.openTile(x, y);
    if (!this.claim(`secret:${this.run.floor}:${x},${y}`)) return false;
    g.audio.play('secret');
    g.effects.showBanner('SECRET FOUND!', '#b25ae0', 1.6);
    g.stats.secrets++;
    g.progress.secretsFound++;
    g.grantXp(Math.round(40 + 3 * (dm.def.level || 1)), `secret found (${how})`);
    dm.reveal(g.player.x, g.player.y, g.player.dir);
    g.bus.emit('secretFound', { x, y, how });
    return true;
  }

  openClassDoor(x, y, msg) {
    const g = this.game, dm = this.dm;
    if (dm.isOpened(x, y)) return false;
    dm.openTile(x, y);
    g.audio.play('secret');
    g.effects.showBanner('SEAL OPENED', '#f0d070', 1.4);
    g.log(msg, '#f0d070');
    if (this.claim(`classdoor:${this.run.floor}:${x},${y}`)) g.grantXp(Math.round(30 + 3 * (dm.def.level || 1)), 'sealed room opened');
    dm.reveal(g.player.x, g.player.y, g.player.dir);
    return true;
  }

  // Conquest's precision: any projectile striking a sigil door's target opens it.
  onProjectileHitWall(x, y) {
    if (!this.generated || this.dm.tile(x, y) !== TILE.SIGILDOOR || this.dm.isOpened(x, y)) return false;
    this.openClassDoor(x, y, 'Your bolt strikes the golden target - the sigil door swings open!');
    return true;
  }

  // Locked chests (challenge rewards, optional puzzle rewards). Returns a reason or null.
  chestLocked(chest) {
    const g = this.game;
    if (chest.requiresClear && g.enemies.some((e) => e.alive && e.room === chest.requiresClear)) return 'Bound by iron bands. Defeat every foe in this room to open it.';
    if (chest.requiresPuzzle && !this.dm.puzzles.get(chest.requiresPuzzle)?.solved) return 'Locked by a mechanism. Solve this room\'s puzzle to open it.';
    return null;
  }
  // Extra spoils: the matching class opening its own cache, War in challenge rooms.
  chestBonus(chest) {
    const g = this.game, cls = g.hero.classId, out = [];
    if (chest.classCache && chest.classCache === cls) { out.push(g.loot.rollEquipment('secret', chest.level)); out.push(g.loot.create('ancient_alloy', 'common', 1)); }
    if (chest.challenge && cls === 'war') { out.push(g.loot.rollEquipment('elite', chest.level)); out.push(g.loot.create('ancient_alloy', 'common', 1)); }
    return out.filter(Boolean);
  }

  // ------------------------------------------------------------------ completion (DungeonRewardManager)
  completeRun() {
    const g = this.game, run = this.run, def = this.def, p = g.progress;
    if (!run || run.done) return false;
    if (!this.claim('complete')) return false;
    run.done = true;
    const diff = DIFFICULTIES[run.difficulty];
    const level = floorLevel(def, def.floors - 1, run.difficulty) + 2;
    const notes = [];
    const { items, gold } = g.loot.rollTable(def.tables.completion, level);
    // optional objectives raise the reward (exploration is rewarded, never required)
    const optional = this.objectives().filter((o) => o.optional);
    const optDone = optional.filter((o) => o.done).length;
    for (let i = 0; i < optDone; i++) items.push(g.loot.create('ancient_alloy', 'common', 1));
    if (optDone) notes.push(`Optional objectives completed on the last floor: ${optDone}/${optional.length} (+${optDone} Ancient Alloy).`);
    const baseXp = Math.round((def.completionXp || 150) * diff.xpMult);
    const xp = scaledXp(baseXp, def.enemyLevels[1] + diff.levelAdd, g.hero.level);
    if (xp < baseXp) notes.push(`Completion XP reduced to ${Math.round((xp / baseXp) * 100)}%: you are ${g.hero.level - def.enemyLevels[1] - diff.levelAdd} levels above this dungeon.`);
    let bonusGold = 0;
    const first = p.claim(`firstclear:${def.id}:${run.difficulty}`);
    if (first) {
      bonusGold = Math.round((def.completionXp || 150) * 0.5);
      const set = g.loot.setPieceFor(g.hero.classId, level);
      if (set) items.push(set);
      notes.push(`FIRST ${diff.name} CLEAR: +${bonusGold} gold and a set piece.`);
    }
    for (const it of items) g.giveItem(it, { preferStash: false });
    g.gold += gold + bonusGold;
    g.stats.goldEarned = (g.stats.goldEarned || 0) + gold + bonusGold;
    g.grantXp(xp, `${def.name} completed`);
    const unlocked = p.recordCompletion(def.id, run.difficulty);
    for (const id of unlocked) notes.push(`NEW DUNGEON UNLOCKED: ${DUNGEONS[id].name}.`);
    g.bus.emit('dungeonCompleted', { id: def.id, difficulty: run.difficulty });
    const nextDiff = ['normal', 'veteran', 'nightmare'][['normal', 'veteran', 'nightmare'].indexOf(run.difficulty) + 1];
    if (nextDiff && p.timesCompleted(def.id, run.difficulty) === 1) notes.push(`${DIFFICULTIES[nextDiff].name} difficulty unlocked for ${def.name}.`);
    const s = g.stats, s0 = run.stats0;
    g.reward = {
      phase4: true, dungeonId: def.id, title: def.name, difficulty: diff.name, diffColor: diff.color,
      items: items.map((i) => ({ name: i.name, rarity: i.rarity, qty: i.qty })), gold: gold + bonusGold, xp, notes, boss: run.bossReward, first,
      run: { kills: s.kills - s0.kills, secrets: s.secrets - s0.secrets, damage: s.damageTaken - s0.damage, time: Math.round(s.playTime - s0.time), floors: def.floors },
    };
    g.audio.play('portal');
    g.audio.stinger('victory');
    g.lastRun = run;
    g.run = null;
    g.scene = 'cleared'; g.sceneT = 0; g.menuIndex = 0; g.panel = null;
    g.effects.showBanner('DUNGEON COMPLETE', '#ffd040', 2.5);
    g.autosave('dungeon completed', true);
    return true;
  }
}
