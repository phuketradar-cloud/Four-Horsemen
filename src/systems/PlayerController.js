import { DIRS, TUNING, LAYOUT } from '../data/config.js';
import { TILE } from './DungeonManager.js';
import { PROGRESSION } from '../data/progression.js';

// Tile-step movement, turning, interaction (doors, gates, secrets, chests, loot) and guard state.
export class PlayerController {
  constructor(game) { this.game = game; }

  reset(start) {
    this.game.player = {
      x: start.x, y: start.y, dir: start.dir,
      guarding: false, guardStart: 0, guardUntil: 0,
      moveCD: 0, turnCD: 0, bob: 0, lastTurnAt: -10, lastBumpAt: -10,
    };
    this.buffered = [];
    this.game.dungeon.reveal(start.x, start.y, start.dir);
    this.game.party?.onFloorStart(); // companions gather around the new start cell
  }

  get p() { return this.game.player; }

  front(n = 1) { const d = DIRS[this.p.dir]; return { x: this.p.x + d.dx * n, y: this.p.y + d.dy * n }; }

  update(dt, input) {
    const g = this.game, p = this.p;
    p.moveCD = Math.max(0, p.moveCD - dt);
    p.turnCD = Math.max(0, p.turnCD - dt);
    p.bob = Math.max(0, p.bob - dt * 4);
    // guard: held key OR a timed guard from the DEFEND command
    const wantGuard = input.isHeld('guard') || g.time < p.guardUntil;
    if (wantGuard && !p.guarding && g.hero.alive) { p.guarding = true; p.guardStart = g.time; }
    if (!wantGuard) p.guarding = false;
    // taps pressed during a cooldown run in order as soon as it ends
    const b = this.buffered[0];
    if (b) {
      if (b.kind === 'step' && p.moveCD <= 0) { this.buffered.shift(); this.step(b.sign); }
      else if (b.kind === 'turn' && p.turnCD <= 0) { this.buffered.shift(); this.turn(b.sign); }
    }
    // held movement repeats
    if (p.moveCD <= 0) {
      if (input.isHeld('forward')) this.step(1);
      else if (input.isHeld('back')) this.step(-1);
    }
    if (p.turnCD <= 0) {
      if (input.isHeld('turnLeft')) this.turn(-1);
      else if (input.isHeld('turnRight')) this.turn(1);
    }
  }

  // Key taps: act now, or queue (max 3) while cooling down so quick taps are never lost.
  requestStep(sign) { this._request('step', sign, this.p.moveCD); }
  requestTurn(sign) { this._request('turn', sign, this.p.turnCD); }
  _request(kind, sign, cd) {
    if (cd <= 0 && !this.buffered.length) { if (kind === 'step') this.step(sign); else this.turn(sign); return; }
    if (this.buffered.length < 3) this.buffered.push({ kind, sign });
  }

  step(sign) {
    const g = this.game, p = this.p;
    if (p.moveCD > 0 || !g.hero.alive) return false;
    if (g.status.has('player', 'petrified')) { p.moveCD = 0.2; this._bump('You are PETRIFIED and cannot move! (turning still works)'); return false; }
    const d = DIRS[sign > 0 ? p.dir : (p.dir + 2) % 4];
    const nx = p.x + d.dx, ny = p.y + d.dy;
    p.moveCD = TUNING.moveRepeat;
    const blocker = g.ai.enemyAt(nx, ny);
    if (blocker) { this._bump(`The ${blocker.name} blocks your path.`); return false; }
    if (!g.dungeon.isWalkable(nx, ny)) {
      const kind = g.dungeon.wallKind(nx, ny);
      const feat = g.dungeon.featureAt(nx, ny);
      if (kind === 'door') this._bump('A heavy door. [E] to open.');
      else if (kind === 'gate') this._bump('A sealed gate bars the way.');
      else if (kind === 'portcullis') this._bump('A lowered portcullis. Find its lever.');
      else if (['barrier', 'sigil', 'roots', 'soulseal'].includes(kind)) this._bump('A sealed way. [L] to look, [E] to try it.');
      else if (g.dungeon.tile(nx, ny) === TILE.PIT) this._bump('A gaping pit where the floor collapsed.');
      else if (g.dungeon.chestAt(nx, ny)) this._bump('A chest. [E] to open.');
      else if (feat?.blocking) this._bump(`${feat.kind === 'exit' ? 'The exit portal' : feat.kind === 'stairs' ? 'Stairs' : 'Something'} stands here. [E] to use it.`);
      else this._bump('Cold stone blocks your way.');
      return false;
    }
    p.moveCD = g.hero.moveRepeat || TUNING.moveRepeat; // class movement speed (Conquest is fast)
    p.prevX = p.x; p.prevY = p.y;
    // party play: a companion in the way swaps places with you (never blocks you)
    const ally = g.party?.memberAt(nx, ny);
    if (ally) { ally.player.x = p.x; ally.player.y = p.y; ally.player.moveCD = 0.25; }
    p.x = nx; p.y = ny;
    g.party?.onLeaderMoved({ x: p.prevX, y: p.prevY });
    p.bob = 1;
    g.audio.play('step');
    g.dungeon.reveal(p.x, p.y, p.dir);
    // materials are gathered automatically when you walk over them (concise toast per pickup)
    const mats = g.loot.itemsAt(p.x, p.y).filter((f) => f.item.def.kind === 'material');
    if (mats.length) this.pickup(mats, true);
    g.onPlayerMoved();
    return true;
  }

  // Collapsing floor: put the player back where they came from.
  pushBack() {
    const g = this.game, p = this.p;
    if (p.prevX !== undefined && g.dungeon.isWalkable(p.prevX, p.prevY) && !g.ai.enemyAt(p.prevX, p.prevY)) { p.x = p.prevX; p.y = p.prevY; }
    else {
      for (const d of DIRS) { const x = p.x + d.dx, y = p.y + d.dy; if (g.dungeon.isWalkable(x, y) && !g.ai.enemyAt(x, y)) { p.x = x; p.y = y; break; } }
    }
    g.dungeon.reveal(p.x, p.y, p.dir);
  }

  _bump(msg) {
    const g = this.game, p = this.p;
    if (g.time - p.lastBumpAt > 0.8) { g.log(msg, '#8c8467'); g.audio.play('bump'); }
    p.lastBumpAt = g.time;
  }

  turn(sign) {
    const g = this.game, p = this.p;
    if (p.turnCD > 0) return;
    p.dir = (p.dir + sign + 4) % 4;
    p.turnCD = TUNING.turnRepeat;
    p.lastTurnAt = g.time;
    g.dungeon.reveal(p.x, p.y, p.dir);
  }

  aboutFace() { const p = this.p; p.dir = (p.dir + 2) % 4; p.lastTurnAt = this.game.time; this.game.dungeon.reveal(p.x, p.y, p.dir); }

  defend(seconds = 0.8) { this.p.guardUntil = this.game.time + seconds; }

  // E / OPEN DOOR / USE on the world. Returns true if something happened.
  interact() {
    const g = this.game, p = this.p;
    if (!g.hero.alive) return false;
    // 1) loot on our own tile, 2) loot in front, 3) front tile features
    const here = g.loot.itemsAt(p.x, p.y);
    if (here.length) return this.pickup(here);
    const f = this.front();
    const there = g.loot.itemsAt(f.x, f.y);
    if (there.length) return this.pickup(there);
    return this.openFront() || (g.log('Nothing to interact with here.', '#8c8467'), false);
  }

  pickup(entries, auto = false) {
    const g = this.game;
    let got = 0;
    for (const entry of entries) {
      const item = entry.item;
      // reserve the slot check before removing from the floor so nothing is lost
      if (!g.inventory.fits(item)) {
        if (item.def.kind === 'material') { g.log(`Your material pouch cannot hold more ${item.name} (max ${item.def.stack}). Left on the floor.`, '#ff7a60'); continue; }
        if (!auto) g.log(`Your pack is full (${g.inventory.bagCount}/${g.inventory.capacity})! Sell or dismantle something first.`, '#ff7a60');
        break;
      }
      const taken = g.loot.take(entry.uid);
      if (!taken) continue; // already gone — impossible to double-pick
      const qty = taken.qty;
      const res = g.inventory.add(taken);
      if (!res.ok) { g.loot.drop(entry.x, entry.y, [taken]); g.log('Your pack is full!', '#ff7a60'); break; }
      got++;
      g.stats.itemsCollected.push({ name: taken.name, rarity: taken.rarity, qty });
      if (res.material) { g.toast({ ...taken, qty, rarity: taken.rarity }, g.inventory.materials.tierColor(taken.defId)); g.audio.play('material'); continue; }
      g.log(`Picked up ${taken.name}${taken.qty > 1 ? ' x' + taken.qty : ''}.`, g.rarityColor(taken.rarity));
      g.toast(taken);
      // auto-ready the first usable weapon of a category so the 1-4 hotbar fills naturally
      const eq = g.equipment;
      if (taken.def.kind === 'weapon' && !eq.weaponSlots[eq.hotbarIndexFor(taken)] && eq.canEquip(taken).ok) {
        eq.weaponSlots[eq.hotbarIndexFor(taken)] = taken.uid;
        eq._sync();
        eq._changed(taken);
        g.log(`${taken.name} readied in slot [${eq.hotbarIndexFor(taken) + 1}].`, '#c8b070');
      }
    }
    if (got) g.audio.play('pickup');
    return got > 0;
  }

  openFront() {
    const g = this.game, dm = g.dungeon;
    const f = this.front();
    if (g.director.interact(f.x, f.y)) return true; // Phase 4 features, seals, puzzles, stairs, exit
    const t = dm.tile(f.x, f.y);
    if (dm.isOpened(f.x, f.y) && (t === TILE.DOOR || t === TILE.GATE)) { g.log('The way is already open.', '#8c8467'); return true; }
    if (t === TILE.DOOR) {
      dm.openTile(f.x, f.y);
      g.audio.play('door');
      g.log('The door groans open.', '#c8b890');
      g.dungeon.reveal(this.p.x, this.p.y, this.p.dir);
      return true;
    }
    if (t === TILE.GATE) {
      const gate = dm.gateAt(f.x, f.y);
      if (gate && gate.unlocked) {
        dm.openTile(f.x, f.y);
        g.audio.play('gate');
        g.log('The sealed gate grinds open...', '#ff9a40');
        g.dungeon.reveal(this.p.x, this.p.y, this.p.dir);
      } else {
        g.log('A blood sigil seals this gate. Slay the guardians of the Hall of the Fallen.', '#ff6040');
        g.audio.play('bump');
      }
      return true;
    }
    if (t === TILE.SECRET && !dm.isOpened(f.x, f.y)) { this.revealSecret(f); return true; }
    const chest = dm.chestAt(f.x, f.y);
    if (chest) {
      if (chest.opened) { g.log('The chest is empty.', '#8c8467'); return true; }
      const lock = g.director.chestLocked(chest);
      if (lock) { g.log(lock, '#ff9a60'); g.audio.play('bump'); return true; }
      if (g.run && !g.director.claim(`chest:${g.run.floor}:${chest.id}`)) { chest.opened = true; return true; }
      const { items, gold } = g.loot.openChest(chest); // rolled once; opened flag set inside
      if (g.director.generated) items.push(...g.director.chestBonus(chest));
      g.loot.drop(f.x, f.y, items, g.realTime);
      if (gold) { g.gold += gold; g.stats.goldEarned = (g.stats.goldEarned || 0) + gold; }
      g.audio.play('chest');
      if (chest.trapReward || chest.secret || chest.classCache || chest.challenge) g.stats.chests = (g.stats.chests || 0) + 1;
      g.effects.burst(LAYOUT.view.w / 2, 230, ['#f0c040', '#fff0b0'], 20, { speed: 80 });
      g.log(`The chest creaks open: ${items.map((i) => i.name).join(', ')}${gold ? `, ${gold} gold` : ''}. [E] to take.`, '#f0c040');
      g.grantXp(PROGRESSION.explorationXp.chest, 'treasure');
      return true;
    }
    return false;
  }

  revealSecret(f) {
    const g = this.game;
    g.dungeon.openTile(f.x, f.y);
    g.audio.play('secret');
    g.effects.showBanner('SECRET FOUND!', '#b25ae0', 1.6);
    g.log('A loose stone gives way... a hidden passage!', '#b25ae0');
    g.stats.secrets++;
    g.grantXp(PROGRESSION.explorationXp.secret, 'secret found');
    g.dungeon.reveal(this.p.x, this.p.y, this.p.dir);
  }

  look() {
    const g = this.game, dm = g.dungeon;
    const f = this.front();
    const kind = dm.wallKind(f.x, f.y);
    const e = g.ai.enemyAt(f.x, f.y);
    if (e) { g.log(`${e.name} (LV ${e.level}): HP ${Math.ceil(e.hp)}/${e.maxHp}. ${e.def.desc || (e.def.heavy ? 'Its blows are slow but crushing. Guard [F] as it raises its blade.' : 'Brittle bones. Strike fast.')}${e.champ ? ` ${e.champ.name}: ${e.champ.desc}` : ''}`, '#e8d8b0'); return; }
    if (g.director.look(f.x, f.y)) return;
    if (kind === 'secret') { g.log('You notice a draft seeping through cracks in this wall...', '#b25ae0'); this.revealSecret(f); return; }
    if (kind === 'door') { g.log('A banded oak door.', '#c8b890'); return; }
    if (kind === 'gate') { const gate = dm.gateAt(f.x, f.y); g.log(gate?.unlocked ? 'The sigil is broken. The gate can be opened.' : 'An iron gate sealed by a burning sigil.', '#ff9a40'); return; }
    if (kind === 'torch') { g.log('A torch gutters in its iron sconce.', '#f0a040'); return; }
    if (kind === 'wall') { g.log('Ancient carved stone, slick with moss.', '#8c8467'); return; }
    const items = g.loot.itemsAt(f.x, f.y);
    if (items.length) { g.log(`On the floor: ${items.map((i) => i.item.name).join(', ')}.`, '#c8b070'); return; }
    if (dm.chestAt(f.x, f.y)) { g.log('An iron-bound chest.', '#c8b070'); return; }
    const room = dm.roomAt(this.p.x, this.p.y);
    g.log(`${room.name}: ${room.lore}`, '#a89a70');
  }
}
