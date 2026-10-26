import { CHAPTERS, QUESTS, NPCS, KEY_ITEMS, ENDINGS } from '../data/campaign.js';
import { LORE, LORE_BY_ID } from '../data/lore.js';
import { ITEM_DEFS } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';

const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const EVENT_TYPES = new Set(['kill', 'collect', 'craft', 'secret', 'puzzle']);

// Phase 5 campaign layer: chapters, quests, key items, codex (lore), bestiary and the ending record.
// Quest state per id: { status: 'active' | 'done', counts: [n per objective], talked: [objective idx] }.
//   - main quests start automatically when their chapter unlocks; side quests are accepted from NPCs
//   - STATE objectives (boss, complete, keyItem, lore, reach, deliver) are re-checked from permanent
//     progress at any time, so nothing done "early" is lost and nothing can be missed for good
//   - EVENT objectives count gameplay events while the quest is active (all of them are repeatable
//     in replayable dungeons, so they cannot be missed either)
//   - rewards are claimed once per save through DungeonProgress.claim('quest:<id>')
// Chapters unlock in CHAPTERS order when the previous chapter's main quest is done.
export class QuestManager {
  constructor(game) {
    this.game = game;
    this.reset();
    const bus = game.bus;
    bus.on('enemyKilled', (e) => this._onKill(e));
    bus.on('bossDefeated', (b) => this._onBoss(b));
    bus.on('materialsChanged', ({ id, delta }) => { if (delta > 0 && !this._granting) this._event('collect', (o) => o.material === id, delta); });
    bus.on('crafted', ({ recipe }) => this._event('craft', (o) => !o.recipe || o.recipe === recipe));
    bus.on('secretFound', () => this._event('secret', (o) => !o.dungeon || o.dungeon === this.game.run?.dungeonId));
    bus.on('puzzleSolved', () => this._event('puzzle', (o) => !o.dungeon || o.dungeon === this.game.run?.dungeonId));
    bus.on('dungeonCompleted', () => this.refresh());
    bus.on('floorReached', () => this.refresh());
  }

  reset() {
    this.quests = {};            // questId -> state
    this.keyItems = new Set();
    this.codex = new Set();      // discovered lore ids
    this.bestiary = {};          // enemy/boss id -> kills (seen = present)
    this.ending = null;          // 'seal' | 'claim'
    this.titleCard = null;       // chapter id waiting to be shown in the camp
    this.chapterSeen = new Set();
    this._granting = false;
  }

  // ------------------------------------------------------------------ lookups
  def(id) { return QUEST_BY_ID[id]; }
  state(id) { return this.quests[id] || null; }
  isDone(id) { return this.quests[id]?.status === 'done'; }
  isActive(id) { return this.quests[id]?.status === 'active'; }
  chapterIndex(id) { return CHAPTERS.findIndex((c) => c.id === id); }
  chapterUnlocked(id) {
    const i = this.chapterIndex(id);
    return i === 0 || (i > 0 && this.isDone(CHAPTERS[i - 1].mainQuest));
  }
  get currentChapter() {
    let cur = CHAPTERS[0];
    for (const c of CHAPTERS) if (this.chapterUnlocked(c.id)) cur = c;
    return cur;
  }
  get campaignComplete() { return this.isDone(CHAPTERS[CHAPTERS.length - 1].mainQuest); }
  activeQuests() { return QUESTS.filter((q) => this.isActive(q.id)); }
  available(q) { return !this.quests[q.id] && this.chapterUnlocked(q.chapter) && q.prereq.every((p) => this.isDone(p)); }

  // ------------------------------------------------------------------ starting quests
  // Main quests of unlocked chapters start by themselves (the story always has a thread to follow).
  startMainQuests() {
    for (const c of CHAPTERS) {
      if (!this.chapterUnlocked(c.id)) break;
      const q = this.def(c.mainQuest);
      if (q && this.available(q)) this.accept(q.id, true);
    }
  }
  accept(id, quiet = false) {
    const q = this.def(id);
    if (!q || !this.available(q)) return false;
    this.quests[id] = { status: 'active', counts: q.objectives.map(() => 0), talked: [] };
    if (!quiet) this.game.log(`Quest accepted: ${q.name}.`, '#ffd040');
    else this.game.log(`New quest: ${q.name}.`, '#ffd040');
    this.game.notify?.(`${q.side ? 'Side quest' : 'Main quest'} started: ${q.name}`, { kind: 'quest' });
    this.refresh();
    return true;
  }

  // ------------------------------------------------------------------ objectives
  // [current, needed] for one objective. State objectives read permanent progress.
  progressOf(q, i) {
    const o = q.objectives[i], st = this.quests[q.id], g = this.game, p = g.progress;
    if (st?.status === 'done') return [1, 1];
    switch (o.type) {
      case 'talk': return [st?.talked.includes(i) ? 1 : 0, 1];
      case 'boss': return [(p.bosses[o.boss] || 0) > 0 ? 1 : 0, 1];
      case 'complete': return [p.timesCompleted(o.dungeon, o.difficulty || null) > 0 ? 1 : 0, 1];
      case 'keyItem': return [this.keyItems.has(o.item) ? 1 : 0, 1];
      case 'deliver': return [0, 1]; // completed only by turning the quest in
      case 'reach': return [(p.deepest?.[o.dungeon] ?? -1) >= o.floor ? 1 : 0, 1];
      case 'lore': return [Math.min(o.count, LORE.filter((l) => l.chapter === o.chapter && this.codex.has(l.id)).length), o.count];
      default: return [Math.min(o.count || 1, st?.counts[i] || 0), o.count || 1];
    }
  }
  objectiveDone(q, i) { const [a, b] = this.progressOf(q, i); return a >= b; }
  // Everything except the hand-in is finished.
  readyToTurnIn(q) {
    if (!this.isActive(q.id)) return false;
    return q.objectives.every((o, i) => o.type === 'deliver' ? this.keyItems.has(o.item) : this.objectiveDone(q, i));
  }

  _event(type, match, n = 1) {
    let changed = false;
    for (const q of this.activeQuests()) q.objectives.forEach((o, i) => {
      if (o.type !== type || !match(o)) return;
      const st = this.quests[q.id];
      if (st.counts[i] >= (o.count || 1)) return;
      st.counts[i] = Math.min(o.count || 1, st.counts[i] + n);
      changed = true;
      this.game.log(`${q.name}: ${o.text} (${st.counts[i]}/${o.count || 1})`, '#e8c860');
      this.game.notify?.(`${q.name}: ${o.text} (${st.counts[i]}/${o.count || 1})`, { kind: 'quest', sound: st.counts[i] >= (o.count || 1) });
    });
    if (changed) this.refresh();
  }

  _onKill(e) {
    if (!e || e.summoned || e.illusion) return;
    const id = e.boss ? e.type : (e.archetype || e.type);
    this.bestiary[id] = (this.bestiary[id] || 0) + 1;
    if (!e.boss) this._event('kill', (o) => o.enemy === id);
  }

  _onBoss({ id }) {
    this.bestiary[id] = Math.max(1, this.bestiary[id] || 0);
    // boss-linked lore is a second discovery route besides the tablets
    for (const l of LORE) if (l.enemy === id && l.discovery.type === 'tablet') this.discover(l.id, true);
    this.refresh();
  }

  // Re-evaluates key items (granted from bosses already defeated), auto-completions and chapters.
  refresh() {
    const p = this.game.progress;
    this.startMainQuests();
    for (const q of this.activeQuests()) {
      for (const [boss, item] of Object.entries(q.grantOnBoss || {})) {
        if ((p.bosses[boss] || 0) > 0 && !this.keyItems.has(item) && p.claim(`keyitem:${item}`)) {
          this.keyItems.add(item);
          this.game.log(`Key item obtained: ${KEY_ITEMS[item].name}.`, '#ffe58a');
          this.game.notify?.(`Key item: ${KEY_ITEMS[item].name}`, { kind: 'quest' });
          this.game.effects?.showBanner?.(KEY_ITEMS[item].name.toUpperCase(), '#ffe58a', 1.8);
        }
      }
      // quests without a hand-in NPC complete as soon as every objective is done
      if (!q.turnIn && !q.ending && this.readyToTurnIn(q)) this.complete(q.id);
    }
  }

  // ------------------------------------------------------------------ NPCs
  // Talking: completes talk objectives, and returns what this NPC can offer right now.
  talk(npcId) {
    const npc = NPCS[npcId];
    if (!npc) return null;
    for (const q of this.activeQuests()) q.objectives.forEach((o, i) => {
      if (o.type === 'talk' && o.npc === npcId && !this.quests[q.id].talked.includes(i)) {
        this.quests[q.id].talked.push(i);
        this.game.log(`${q.name}: ${o.text} - done.`, '#e8c860');
      }
    });
    this.refresh();
    return this.dialogue(npcId);
  }
  dialogue(npcId) {
    const npc = NPCS[npcId], ch = this.campaignComplete ? 'done' : this.currentChapter.id;
    const line = npc.lines[ch] || npc.lines.default;
    const byClass = npc.byClass?.[this.game.hero.classId] || '';
    const offers = QUESTS.filter((q) => q.side && q.npc === npcId && this.available(q));
    const turnIns = QUESTS.filter((q) => q.turnIn === npcId && this.readyToTurnIn(q));
    const active = QUESTS.filter((q) => (q.npc === npcId || q.turnIn === npcId) && this.isActive(q.id) && !this.readyToTurnIn(q));
    return { npc, line, byClass, offers, turnIns, active };
  }

  // Hand a ready quest in (consumes delivered key items). Ending quests need a choice.
  turnIn(id, endingChoice = null) {
    const q = this.def(id);
    if (!q || !this.readyToTurnIn(q)) return false;
    if (q.ending && !ENDINGS[endingChoice]) return false;
    for (const o of q.objectives) if (o.type === 'deliver') this.keyItems.delete(o.item);
    if (q.ending) this.chooseEnding(endingChoice);
    return this.complete(id);
  }

  chooseEnding(id) {
    if (this.ending || !ENDINGS[id]) return false;
    this.ending = id;
    const e = ENDINGS[id];
    this.game.log(`${e.title}: ${e.text}`, '#ffd040');
    this.grant(e.reward, `ending:${id}`);
    return true;
  }

  complete(id) {
    const q = this.def(id), st = this.quests[id];
    if (!q || !st || st.status === 'done') return false;
    const chBefore = this.currentChapter.id;
    st.status = 'done';
    this.game.log(`QUEST COMPLETE: ${q.name}!`, '#ffd040');
    this.game.effects?.showBanner?.('QUEST COMPLETE', '#ffd040', 2);
    this.game.notify?.(`Quest complete: ${q.name}`, { kind: 'questDone' });
    this.grant(q.rewards, `quest:${id}`);
    this.game.bus.emit('questCompleted', { id });
    if (!q.side) {
      const next = CHAPTERS[this.chapterIndex(q.chapter) + 1];
      if (next && this.currentChapter.id !== chBefore) {
        this.titleCard = next.id;
        this.game.log(`${next.title}: ${next.name} has begun.`, '#ff9a40');
        this.game.notify?.(`New chapter unlocked - ${next.title}: ${next.name}`, { kind: 'chapter' });
      }
    }
    this.refresh();
    this.game.autosave?.('quest complete');
    return true;
  }

  // Grants a reward bundle exactly once per save (claim key). Returns false when already claimed.
  grant(r, claimKey) {
    const g = this.game;
    if (!r || !g.progress.claim(claimKey)) return false;
    this._granting = true;
    try {
      const lvl = g.hero.level;
      if (r.xp) g.grantXp(r.xp, 'quest');
      if (r.gold) { g.gold += r.gold; g.stats.goldEarned = (g.stats.goldEarned || 0) + r.gold; g.log(`+${r.gold} gold.`, '#ffd040'); }
      for (const [id, n] of Object.entries(r.materials || {})) g.giveItem(g.loot.create(id, 'common', n));
      for (const spec of r.items || []) {
        const d = ITEM_DEFS[spec.id];
        if (!d || (spec.classOnly && spec.classOnly !== g.hero.classId) || !g.loot.allowedForClass(d, g.hero.classId)) continue;
        const rarity = spec.rarity || (d.uniqueOnly === 'mythic' ? 'mythic' : d.uniqueOnly ? 'legendary' : 'rare');
        g.giveItem(g.loot.gen.generate({ baseId: d.id, rarity, ilvl: Math.max(lvl, d.minIlvl || 1), classHint: g.hero.classId }));
      }
      if (r.set) { const it = g.loot.setPiece(r.set, lvl); if (it) g.giveItem(it); }
      for (const rid of r.recipes || []) if (g.craft.unlockRecipe(rid)) g.log(`Recipe learned: ${RECIPES.find((x) => x.id === rid)?.name || rid}!`, '#7ac060');
      for (const k of r.keyItems || []) this.keyItems.add(k);
      for (const l of r.lore || []) this.discover(l);
    } finally { this._granting = false; }
    return true;
  }

  // ------------------------------------------------------------------ codex
  discover(loreId, quiet = false) {
    const l = LORE_BY_ID[loreId];
    if (!l || this.codex.has(loreId)) return false;
    this.codex.add(loreId);
    if (!quiet) this.game.log(`Codex: "${l.title}" recorded in your journal [J].`, '#a8d8f0');
    this.game.bus.emit('loreRead', { id: loreId });
    this.refresh();
    return true;
  }

  // ------------------------------------------------------------------ save
  serialize() {
    return { quests: this.quests, keyItems: [...this.keyItems], codex: [...this.codex], bestiary: this.bestiary, ending: this.ending, chapterSeen: [...this.chapterSeen] };
  }
  // Unknown ids are dropped and reported (same rule as DungeonProgress.restore).
  restore(s) {
    this.reset();
    const dropped = [];
    if (!s) return dropped;
    for (const [id, st] of Object.entries(s.quests || {})) {
      const q = this.def(id);
      if (!q || !st) { dropped.push(`quest ${id}`); continue; }
      this.quests[id] = {
        status: st.status === 'done' ? 'done' : 'active',
        counts: q.objectives.map((o, i) => Math.max(0, Math.min(o.count || 1, (st.counts?.[i] | 0)))),
        talked: (st.talked || []).filter((i) => q.objectives[i]?.type === 'talk'),
      };
    }
    for (const k of s.keyItems || []) if (KEY_ITEMS[k]) this.keyItems.add(k); else dropped.push(`key item ${k}`);
    for (const l of s.codex || []) if (LORE_BY_ID[l]) this.codex.add(l); else dropped.push(`lore ${l}`);
    for (const [id, n] of Object.entries(s.bestiary || {})) if (ENEMIES[id] || BOSSES[id]) this.bestiary[id] = Math.max(0, n | 0);
    this.ending = ENDINGS[s.ending] ? s.ending : null;
    this.chapterSeen = new Set((s.chapterSeen || []).filter((c) => this.chapterIndex(c) >= 0));
    return dropped;
  }
}

export { QUEST_BY_ID, EVENT_TYPES };
