import { RUNE_SYMBOLS } from './DungeonGenerator.js';

// PuzzleManager: rune sequences, latching pressure plates and lever-driven timed doors.
// Clues are always readable (an inscription tablet states the rune order / plate rule). A puzzle is
// solved exactly once (dungeon puzzle state + run ledger), so nothing can grant its reward twice.
// A wrong rune resets the sequence with a small, non-lethal curse - never a dead end.
export class PuzzleManager {
  constructor(game) { this.game = game; }
  get dm() { return this.game.dungeon; }

  puzzle(id) { return this.dm.puzzles.get(id) || null; }

  // E on a rune wall.
  touchRune(f) {
    const g = this.game, pz = this.puzzle(f.puzzle);
    if (!pz) return false;
    if (pz.solved) { g.log(`The ${RUNE_SYMBOLS[f.symbol]} rune glows steadily. The sequence is complete.`, '#a89a70'); return true; }
    if (f.lit) { g.log(`The ${RUNE_SYMBOLS[f.symbol]} rune is already awake.`, '#a89a70'); return true; }
    const expected = pz.order[pz.progress];
    if (f.symbol === expected) {
      f.lit = true; pz.progress++;
      g.audio.play('rune');
      g.log(`The ${RUNE_SYMBOLS[f.symbol]} rune wakes (${pz.progress}/3).`, '#a8d8f0');
      if (pz.progress >= pz.order.length) this.solve(pz);
    } else {
      pz.progress = 0;
      for (const r of this.dm.featureList) if (r.puzzle === pz.id && r.kind === 'rune') r.lit = false;
      g.audio.play('runeFail');
      const dealt = g.hurtPlayer(g.hero.maxHp * 0.06, { kind: 'dark', label: 'a rune backlash', nonLethal: true, quiet: true });
      g.log(`Wrong order! The runes flare and go dark (-${dealt} HP). Read the inscription again.`, '#ff7a60');
    }
    return true;
  }

  // Player stepped on a tile: latch plates.
  stepOn(f) {
    const g = this.game;
    if (f.kind !== 'plate' || f.pressed) return;
    const pz = this.puzzle(f.puzzle);
    f.pressed = true;
    g.audio.play('plate');
    if (!pz) return;
    const plates = this.dm.featureList.filter((q) => q.puzzle === pz.id && q.kind === 'plate');
    const down = plates.filter((q) => q.pressed).length;
    g.log(`A pressure plate sinks with a heavy click (${down}/${plates.length}).`, '#c8b890');
    if (down >= plates.length && !pz.solved) this.solve(pz);
  }

  solve(pz) {
    const g = this.game;
    if (pz.solved) return false;
    pz.solved = true;
    if (!g.director.claim(`puzzle:${g.run.floor}:${pz.id}`)) return false;
    g.audio.play('puzzle');
    g.effects.showBanner('PUZZLE SOLVED', '#a8d8f0', 1.6);
    g.grantXp(Math.round(30 + 4 * (g.dungeon.def.level || 1)), 'puzzle solved');
    if (pz.key) {
      for (const gate of this.dm.gateState) if (gate.requires?.type === 'puzzle' && gate.requires.id === pz.id) g.director.unlockGate(gate, 'The mechanism turns: a sealed gate opens somewhere ahead.');
    } else {
      g.log('A hidden compartment slides open: the puzzle chest is unlocked.', '#a8d8f0');
    }
    g.bus.emit('puzzleSolved', pz);
    return true;
  }

  // Lever: opens the timed door of its vault for `duration` seconds.
  pullLever(f) {
    const g = this.game, room = this.dm.room(f.target);
    const door = room?.timedDoor;
    if (!door) return false;
    f.pulled = true;
    this.dm.openTimed(door.x, door.y, g.time, f.duration || 10);
    g.audio.play('lever');
    g.audio.play('gate');
    g.log(`You pull the lever. The portcullis of the ${room.name} rises - it will fall again in ${f.duration || 10} seconds!`, '#ffd040');
    return true;
  }
}
