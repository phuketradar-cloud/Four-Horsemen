// Tiny synchronous pub/sub used to decouple systems (combat -> UI, audio, log...).
export class EventBus {
  constructor() { this.handlers = new Map(); }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn); // Set => the same handler can never be registered twice
    return () => this.off(event, fn);
  }

  off(event, fn) { this.handlers.get(event)?.delete(fn); }

  emit(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (err) { console.error(`[EventBus] handler for "${event}" failed`, err); }
    }
  }
}
