// Skill cooldowns keyed by skill id, measured in simulation time (pauses with the game).
// Only start() sets a cooldown; nothing in the game shortens a running one, so there are
// no reset loops by construction.
export class CooldownManager {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.cd = new Map(); }
  start(id, dur) { this.cd.set(id, { readyAt: this.game.time + dur, dur }); }
  remaining(id) { const c = this.cd.get(id); return c ? Math.max(0, c.readyAt - this.game.time) : 0; }
  ready(id) { return this.remaining(id) <= 0; }
  fraction(id) { const c = this.cd.get(id); return c && c.dur > 0 ? this.remaining(id) / c.dur : 0; }
}
