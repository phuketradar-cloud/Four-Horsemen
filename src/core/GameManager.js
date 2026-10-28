import { EventBus } from './EventBus.js';
import { Input } from './Input.js';
import { Display } from './Display.js';
import { chance } from './rng.js';
import { LAYOUT, TUNING, DIRS, SCREEN, CLASSIC } from '../data/config.js';
import { DUNGEON_1 } from '../data/dungeon.js';
import { HORSEMEN, CLASS_ORDER, buildFormation } from '../data/characters.js';
import { PROGRESSION, scaledXp } from '../data/progression.js';
import { RARITIES, RARITY_ORDER, ITEM_DEFS } from '../data/items.js';
import { THEMES } from '../data/themes.js';
import { LOOT_TABLES } from '../data/lootTables.js';
import { RECIPES, REFORGE } from '../data/recipes.js';
import { indexMaterialUsage } from '../data/materials.js';
import { DUNGEONS, PROLOGUE, DUNGEON_ORDER } from '../data/dungeons/index.js';
import { STATUSES } from '../data/statuses.js';
import { AudioManager } from '../audio/AudioManager.js';
import { buildTextures } from '../render/Textures.js';
import { buildSprites } from '../render/SpriteFactory.js';
import { loadPortraitArt } from '../render/PortraitArt.js';
import { DungeonRenderer } from '../render/DungeonRenderer.js';
import { Effects } from '../render/Effects.js';
import { DungeonManager, TILE } from '../systems/DungeonManager.js';
import { PlayerController } from '../systems/PlayerController.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { EnemyAI } from '../systems/EnemyAI.js';
import { LootSystem } from '../systems/LootSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { CharacterStats } from '../systems/CharacterStats.js';
import { SaveSystem, DEFAULT_SETTINGS } from '../systems/SaveSystem.js';
import { ResourceManager } from '../systems/ResourceManager.js';
import { StatusEffectManager } from '../systems/StatusEffectManager.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { SkillFX } from '../render/SkillFX.js';
import { UIManager } from '../ui/UIManager.js';
import * as HUD from '../ui/HUD.js';
import * as Panels from '../ui/Panels.js';
import { drawSkillBar, drawSkillPanel } from '../ui/SkillUI.js';
import { drawCharacterSelect } from '../ui/CharacterSelect.js';
import { StatCalculator } from '../systems/StatCalculator.js';
import { LegendaryEffects } from '../systems/LegendaryEffects.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { DungeonProgress } from '../systems/DungeonProgress.js';
import { DungeonDirector } from '../systems/DungeonDirector.js';
import { BossEncounterController } from '../systems/BossEncounterController.js';
import { HazardManager } from '../systems/HazardManager.js';
import { PuzzleManager } from '../systems/PuzzleManager.js';
import { EnemyAbilities } from '../systems/EnemyAbilities.js';
import { QuestManager } from '../systems/QuestManager.js';
import { drawJournal, drawDialogue, drawChapterCard } from '../ui/JournalUI.js';
import { NoticeCenter } from '../ui/Notifications.js';
import { TitleScreen } from '../ui/TitleScreen.js';
import { drawText } from '../render/PixelFont.js';
import { drawInventory, inventoryKey } from '../ui/InventoryUI.js';
import { drawEquipment } from '../ui/EquipmentUI.js';
import { drawCrafting } from '../ui/CraftingUI.js';
import { drawCamp } from '../ui/CampUI.js';
import { drawConfirm, drawToasts } from '../ui/ItemTooltip.js';

// Material sources / recipe usage are derived once from the data (MaterialDefinition.sources/usedIn).
indexMaterialUsage(ITEM_DEFS, LOOT_TABLES, RECIPES);

// Owns the main loop, scene/panel state and wires every system together.
// All systems are constructed exactly once; newGame() only resets their data.
// Scenes: title | select | camp (Phase 4 hub) | playing | gameover | cleared
export class GameManager {
  constructor(canvas) {
    this.canvas = canvas; // visible canvas; everything is drawn on the logical 960x540 `screen`
    this.bus = new EventBus();
    this.saves = new SaveSystem();
    this.settings = this.saves.loadSettings();
    this.screen = document.createElement('canvas');
    this.screen.width = SCREEN.w; this.screen.height = SCREEN.h;
    this.ctx = this.screen.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.display = new Display(canvas, this.screen, this.settings);
    this.audio = new AudioManager(this.settings);
    this.input = new Input(canvas, () => { this.audio.unlock(); if (this.scene !== 'title') this.audio.startMusic(); }, () => this.settings.hotkeys);
    this.input.setBindings(this.settings.keybinds);
    this.ui = new UIManager(this.input, this.audio);
    this.textures = buildTextures();
    this.sprites = buildSprites();
    // painted Horseman portraits replace the drawn ones once loaded (drawn ones stay as fallback)
    this.portraitsReady = loadPortraitArt(this.sprites).catch(() => []);
    this.renderer = new DungeonRenderer(this.textures, this.sprites);
    // Phase 6 main menu (HTML layers over the cleaned concept art); skipped where there is no DOM
    try { this.titleScreen = typeof document !== 'undefined' && document.body ? new TitleScreen(this) : null; } catch (err) { console.warn('[title] menu unavailable, using the canvas title', err); this.titleScreen = null; }
    this.effects = new Effects();
    this.effects.settings = this.settings; // reduced shake / flashing applied centrally

    this.dungeon = new DungeonManager(DUNGEON_1);
    this.enemies = [];
    this.player = null;
    this.hero = new CharacterStats(this.bus);
    this.inventory = new InventorySystem(this.bus);
    this.equipment = new EquipmentSystem(this.bus, this.inventory);
    this.weapons = new WeaponSystem(this.equipment);
    this.loot = new LootSystem(this.bus, this);
    this.combat = new CombatSystem(this);
    this.ai = new EnemyAI(this);
    this.controller = new PlayerController(this);
    // Phase 2 — Horsemen
    this.status = new StatusEffectManager(this);
    this.resource = new ResourceManager(this);
    this.skills = new SkillSystem(this);
    this.fx = new SkillFX(this);
    // Phase 3 — deep RPG: derived stats, item effects, crafting
    this.calc = new StatCalculator(this);
    this.hero.calc = this.calc;
    this.equipment.game = this;
    this.inventory.isEquipped = (uid) => this.equipment.isEquipped(uid);
    this.legend = new LegendaryEffects(this);
    this.craft = new CraftingSystem(this);
    // Phase 4 — dungeons, bosses, secrets, hazards, progression
    this.progress = new DungeonProgress();
    this.director = new DungeonDirector(this);
    this.bossCtl = new BossEncounterController(this);
    this.hazards = new HazardManager(this);
    this.puzzles = new PuzzleManager(this);
    // Phase 5 — enemy abilities, campaign (chapters, quests, codex, bestiary)
    this.abilities = new EnemyAbilities(this);
    this.quests = new QuestManager(this);
    this.journalState = { tab: 'quests', sel: null, page: 0 };
    this.talkNpc = null;     // NPC id while the dialogue panel is open
    this.run = null;         // active run (dungeon id, seed, difficulty, floor, ledger) or null in camp
    this.stash = [];          // camp stash: overflow storage so rewards are never destroyed
    this.dangerTiles = [];    // boss telegraphs painted on the floor
    this.campSel = 'ashen_catacombs';
    this.gold = 0;
    this.toasts = [];
    this.notices = new NoticeCenter(this.audio); // Phase 6 notifications
    this.confirm = null;     // { text, onYes } modal
    this.invState = { sort: 'rarity', slot: 'all', rarity: 'any', sel: null, page: 0 };
    this.equipSel = 'mainHand';
    this.craftSel = null;
    this.craftState = { tab: 'recipes', cat: 'weapons', recipe: null, page: 0 };
    this.reward = null;      // dungeon completion reward summary
    // weapon cooldown: buffs (Blood Rush) x attack speed (DEX/gear, capped)
    this.weapons.cooldownMult = () => this.status.playerMult('atkSpeedMult') * (1 - (this.hero.stats?.atkSpeed || 0) / 100);
    this.classId = 'war';
    this.selectIndex = CLASS_ORDER.indexOf('war');
    this.target = null;
    this.skillSel = null;
    this.inCombat = false;

    this.scene = 'title';
    this.sceneT = 0;
    this.panel = null;
    this.time = 0;
    this.realTime = 0;
    this.logEntries = [];
    this.logScroll = 0; this.logScrollMax = 0;
    this.menuIndex = 0;
    this.invSel = 0;
    this.formation = buildFormation(this.classId);
    this.formationSel = -1;
    this.stats = this._freshStats();
    this.activeMenu = null;
    this.errorShown = false;
    this.clearedT = 0;
    this.killedBy = null;

    this.holdAttack = { lastAt: -Infinity, count: 0 }; // hold-SPACE auto attack (see _updateHeldAttack)
    this._subscribe();
    this.hero.reset('war');
    this.resource.reset('war');
  }

  get theme() { return THEMES[this.settings.theme % THEMES.length]; }
  rarityColor(r) { return (RARITIES[r] || RARITIES.common).color; }
  _freshStats() { return { kills: 0, xpGained: 0, itemsCollected: [], secrets: 0, damageTaken: 0, playTime: 0, markedHits: 0, healed: 0, skillsUsed: 0, goldEarned: 0, dismantled: 0, crafted: 0, bestRarity: 'common', chests: 0 }; }
  get inDungeonRun() { return !!this.run && this.scene !== 'camp'; }
  get inGeneratedRun() { return this.inDungeonRun && !!this.dungeon.def.generated; }

  // XP for a kill after level-difference scaling (see progression.js).
  xpFor(e) { return scaledXp(e.xp, e.level || 1, this.hero.level); }

  // Non-blocking loot notification (top-left of the viewport).
  toast(item, color = null) {
    if (!item) return;
    this.toasts.push({ text: `${item.name}${item.qty > 1 ? ' x' + item.qty : ''}`, color: color || this.rarityColor(item.rarity), rarity: item.rarity, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
    if (RARITY_ORDER.indexOf(item.rarity) > RARITY_ORDER.indexOf(this.stats.bestRarity || 'common')) this.stats.bestRarity = item.rarity;
    const tier = RARITY_ORDER.indexOf(item.rarity);
    if (tier >= 2 && item.def?.slot) this.notify(`${(RARITIES[item.rarity]?.label || item.rarity).toUpperCase()}: ${item.name}`, { kind: ['rare', 'epic', 'legendary', 'mythic'][Math.min(3, tier - 2)] });
    else this.audio.play(item.def?.kind === 'material' ? 'material' : 'itemDrop');
  }

  // Phase 6: central notifications (see ui/Notifications.js). kind: info|item|rare|epic|legendary|mythic|
  // quest|questDone|chapter|level|craft|equip|warn|save|error. Errors stay until dismissed.
  notify(text, opts = {}) { return this.notices.push(text, opts); }
  updateNotices(dt) { this.notices.update(dt); }

  ask(text, onYes) { this.confirm = { text, onYes }; }

  // Grants an item safely: bag / material pouch -> floor at your feet (in a dungeon) -> camp stash.
  // Nothing is ever destroyed because the bag is full.
  giveItem(item) {
    if (!item) return 'none';
    const qty = item.qty;
    const r = this.inventory.fits(item) ? this.inventory.add(item) : { ok: false };
    if (r.ok) { this.toast({ ...item, qty }); return 'bag'; }
    if (this.scene === 'playing' && this.player && this.run) {
      this.loot.drop(this.player.x, this.player.y, [item], this.realTime);
      this.log(`No room for ${item.name}: left at your feet.`, '#ff9a60');
      this.notify(`Inventory full: ${item.name} left at your feet.`, { kind: 'warn' });
      return 'floor';
    }
    this.stash.push(item);
    this.log(`No room for ${item.name}: sent to the camp stash.`, '#ff9a60');
    this.notify(`Inventory full: ${item.name} sent to the camp stash.`, { kind: 'warn' });
    return 'stash';
  }

  // Take everything that fits from the camp stash.
  takeStash() {
    let n = 0;
    for (const it of [...this.stash]) {
      if (!this.inventory.fits(it)) continue;
      const qty = it.qty;
      if (this.inventory.add(it).ok) { this.stash.splice(this.stash.indexOf(it), 1); this.toast({ ...it, qty }); n++; }
    }
    this.log(n ? `Took ${n} item(s) from the stash.${this.stash.length ? ` ${this.stash.length} still waiting (bag full).` : ''}` : 'Nothing from the stash fits in your bag.', n ? '#7ac060' : '#ff7a60');
  }

  // Environmental / boss-area damage through the normal defence rules. nonLethal leaves 1 HP.
  hurtPlayer(amount, { kind = 'physical', label = 'something', nonLethal = true, quiet = false, by = null, flat = false } = {}) {
    if (!this.hero.alive || amount <= 0) return 0;
    const s = this.hero.stats || {};
    let dmg = amount * this.status.playerMult('dmgTakenMult');
    if (!flat) {
      if (kind === 'physical') dmg -= this.hero.defense * this.status.playerMult('defMult');
      else dmg *= 1 - (s.resist || 0) / 100;
      dmg *= 1 - (s.damageReduction || 0) / 100;
    }
    dmg = Math.max(1, Math.round(dmg));
    if (nonLethal) dmg = Math.min(dmg, Math.max(0, this.hero.hp - 1));
    if (dmg <= 0) return 0;
    const dealt = this.hero.takeDamage(dmg);
    this.stats.damageTaken += dealt;
    if (!quiet) {
      this.audio.play('hurt');
      this.effects.screenFlash(kind === 'blight' ? '#40a000' : kind === 'dark' ? '#6020a0' : '#c00000', this.settings.reduceFx ? 0.12 : 0.3);
      this.effects.addShake(this.settings.reduceFx ? 1 : 4);
      // Phase 6: number colour tells the damage kind apart (physical / blight / dark-curse / fire)
      this.effects.text(LAYOUT.view.w / 2 - 90, LAYOUT.view.h - 70, `-${dealt}`, { blight: '#90d040', dark: '#b080f0', fire: '#ff9030' }[kind] || '#ff4030', 2);
      if (by?.x != null) this.effects.damageFrom(this.combat.sideOf(by), kind === 'blight' ? '#60c020' : kind === 'dark' ? '#8040e0' : '#ff2010');
      this.hurtFlash = 0.35;
      this.log(`${label[0].toUpperCase() + label.slice(1)} hits you for ${dealt}.`, '#ff7a60');
    }
    if (this.hero.alive) this.legend.onDamaged(by, dealt);
    if (!this.hero.alive) this.onPlayerDeath(by || { name: label });
    return dealt;
  }

  // Player debuffs are shortened by Status Resist.
  applyPlayerDebuff(id, dur) {
    const def = STATUSES[id];
    if (!def || !this.hero.alive) return;
    const d = dur * (1 - (this.hero.stats?.statusResist || 0) / 100);
    if (d <= 0.2) return;
    const fresh = !this.status.has('player', id);
    this.status.apply('player', id, { dur: d });
    if (fresh) this.log(`You are ${def.name} for ${d.toFixed(1)}s!`, def.color);
  }

  // Autosave at safe points. In combat it is deferred (pendingAutosave) and runs as soon as the
  // fight ends. A small SAVING indicator shows on success; failures raise a sticky error (once/30s).
  autosave(reason = '', force = false) {
    if (this._loading || !this.hero.alive || !(this.scene === 'playing' || this.scene === 'camp' || this.scene === 'cleared')) return false;
    if (!force && this.scene === 'playing' && (this.inCombat || this.combat.active || this.bossCtl.active)) { this.pendingAutosave = reason || 'after combat'; return false; }
    const ok = this.saves.save(this);
    this.pendingAutosave = null;
    this.saveIndicator = { t: 0, ok };
    if (ok && reason) this.log(`Autosaved (${reason}).`, '#5a8a50');
    if (!ok && this.realTime - (this._lastSaveError ?? -99) > 30) {
      this._lastSaveError = this.realTime;
      this.notify(`Autosave failed: ${this.saves.lastResult?.reason || 'storage unavailable'}. Your previous save is intact.`, { kind: 'error' });
    }
    return ok;
  }

  exportSave() {
    try {
      const blob = new Blob([this.saves.exportJSON(this)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `four-horsemen-${this.hero.classId}-lv${this.hero.level}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.log('Save exported as a JSON file.', '#7ac060');
    } catch (err) { this.log('Export failed.', '#ff7a60'); console.warn(err); }
  }

  _subscribe() {
    // Subscribed once in the constructor — restarts never add duplicate listeners.
    this.bus.on('skillUsed', () => { this.stats.skillsUsed++; });
    this.bus.on('levelUp', ({ level, hpGain }) => {
      this.log(`LEVEL UP! You reach level ${level}. Max HP +${hpGain}. +1 skill point [K].`, '#ffd040');
      const unlocked = this.skills.slots.filter((id) => this.skills.unlockLevel(id) === level);
      for (const id of unlocked) this.log(`New power unlocked: ${this.skills.params(id).name}!`, '#ffe58a');
      this.effects.showBanner(`LEVEL ${level}!`, '#ffd040', 1.8);
      this.notify(`Level ${level}! +1 skill point - open SKILLS [K] to spend it.`, { kind: 'level' });
      this.effects.sparkleColumn(LAYOUT.view.w / 2, LAYOUT.view.h / 2, '#ffd040', 50);
      this.audio.play('levelUp');
      // restore part of the class resource; equipment and resource type are untouched
      this.resource.gain(this.resource.max * PROGRESSION.resourceOnLevelUp);
      if (PROGRESSION.autosaveOnLevelUp && this.scene === 'playing' && !this.inCombat && !this.combat.active && this.hero.alive) {
        if (this.saves.save(this)) this.log('Progress saved.', '#7ac060');
      }
    });
    this.bus.on('enemyKilled', (e) => { this._checkRooms(); this.director.onEnemyKilled(e); });
    this.bus.on('bossStarted', (e) => this.director.onBossStarted(e));
    this.bus.on('crafted', ({ item }) => {
      this.audio.play('craft');
      this.notify(`Crafted ${item?.name || 'item'}${item?.qty > 1 ? ' x' + item.qty : ''}.`, { kind: 'craft' });
      if (this.scene === 'camp') this.autosave('crafting');
    });
    this.bus.on('craftFailed', ({ msg }) => { this.audio.play('deny'); this.notify(msg || 'Cannot craft that.', { kind: 'warn', sound: false }); });
    this.bus.on('equipmentChanged', () => this.audio.play('equip'));
    this.bus.on('bossDefeated', ({ miniboss }) => this.audio.stinger(miniboss ? 'victory' : 'bossDefeat'));
    this.bus.on('enhanced', () => this.audio.play('enhance'));
  }

  _roomCleared(roomId) { return this.enemies.filter((e) => e.room === roomId).every((e) => !e.alive); }

  // Phase 1 crypt rules (hand-authored prologue): sigil gate + "clear the final room" completion.
  _checkRooms() {
    if (this.dungeon.def.generated) return;
    for (const gate of this.dungeon.gateState) {
      if (!gate.unlocked && gate.requiresCleared && this._roomCleared(gate.requiresCleared)) {
        gate.unlocked = true;
        this.audio.play('gate');
        this.effects.showBanner('THE SIGIL SHATTERS', '#ff6040', 1.8);
        this.log('A distant crack echoes - the blood sigil on the sealed gate has shattered!', '#ff9a40');
        this.grantXp(PROGRESSION.objectiveXp.eliteRoomCleared, 'objective: Hall of the Fallen');
      }
    }
    if (this.clearedT <= 0 && !this.reward && this.dungeon.def.clearRoom && this._roomCleared(this.dungeon.def.clearRoom)) {
      this.clearedT = TUNING.clearedDelay;
      this.log('The last guardian falls. The First Seal breaks!', '#ffd040');
      this.grantDungeonReward();
    }
  }

  // Completion reward: rolled once (this.reward guards it), goes to the bag or the floor.
  grantDungeonReward() {
    if (this.reward) return;
    const { items, gold } = this.loot.rollTable(this.dungeon.def.completionTable, (this.dungeon.def.level || 1) + 4);
    this.reward = { items: items.map((i) => ({ name: i.name, rarity: i.rarity, qty: i.qty })), gold, xp: PROGRESSION.objectiveXp.dungeonCleared };
    this.gold += gold;
    this.stats.goldEarned += gold;
    for (const it of items) {
      const r = this.inventory.fits(it) ? this.inventory.add(it) : { ok: false };
      if (!r.ok) this.loot.drop(this.player.x, this.player.y, [it], this.realTime);
      this.toast(it);
      this.stats.itemsCollected.push({ name: it.name, rarity: it.rarity, qty: it.qty });
    }
    this.grantXp(PROGRESSION.objectiveXp.dungeonCleared, 'objective: First Seal broken');
    this.log(`Reward: ${items.map((i) => i.name).join(', ')} and ${gold} gold.`, '#ffd040');
    // Phase 4: the prologue counts as a completion (run ends; progression recorded once per clear)
    if (this.run && this.director.claim('complete')) {
      this.progress.recordCompletion(PROLOGUE.id, 'normal');
      this.run.done = true;
      this.bus.emit('dungeonCompleted', { id: PROLOGUE.id, difficulty: 'normal' });
      this.audio.stinger('victory');
    }
  }

  // ------------------------------------------------------------------ lifecycle
  // New character. One Horseman per character; the class is fixed (no mid-combat switching).
  // dungeonId defaults to the hand-authored prologue crypt (Phase 1-3 flow and tests).
  newGame(classId = this.classId, dungeonId = PROLOGUE.id) {
    this.classId = HORSEMEN[classId] ? classId : 'war';
    const cls = HORSEMEN[this.classId];
    this.progress.reset();
    this.loot.gen.reset();
    this.inventory.reset();
    this.equipment.reset();
    this.weapons.reset();
    this.hero.reset(this.classId);
    this.resource.reset(this.classId);
    this.status.reset();
    this.skills.reset();
    this.legend.reset();
    this.quests.reset();
    this.abilities.petrifyImmuneUntil = 0;
    this.pendingAutosave = null; this._lastFight = null;
    this.notices.reset();
    this.talkNpc = null;
    this.journalState = { tab: 'quests', sel: null, page: 0 };
    this.stash = [];
    this.stats = this._freshStats();
    this.run = this.director.newRun(dungeonId, 'normal', dungeonId === PROLOGUE.id ? 0 : undefined);
    this.director.buildFloor(0);
    for (const s of cls.startItems) {
      const it = this.loot.create(s.item, s.rarity || 'common', s.qty || 1);
      this.inventory.add(it);
      if (s.equip) this.equipment.equip(it.uid);
    }
    this.calc.invalidate();
    this.hero.hp = this.hero.maxHp;
    this.gold = 0;
    this.toasts = []; this.confirm = null; this.reward = null;
    this.invState = { sort: 'rarity', slot: 'all', rarity: 'any', sel: null, page: 0 };
    this.formation = buildFormation(this.classId);
    this.formationSel = -1;
    this.target = null; this.skillSel = null;
    this.logEntries = []; this.logScroll = 0;
    this.scene = 'playing'; this.sceneT = 0;
    this.panel = null;
    this.time = 0; this.clearedT = 0; this.killedBy = null;
    this.invSel = 0; this.menuIndex = 0;
    this.input.clearAll();
    this.log('THE FOUR HORSEMEN: APOCALYPSE', '#d02a14');
    this.log(`${cls.name}, ${cls.title}, descends into the ${DUNGEONS[dungeonId].name.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())}.`, cls.colors.accent);
    this.log(`${cls.mechanic.name}: ${cls.mechanic.desc}`, '#c8b070');
    this.log('Skills: 1-4, ultimate: 5. K opens skills. T or click a foe to target.', '#a89a70');
    this.quests.startMainQuests(); // PROLOGUE: The First Omen
    this.quests.chapterSeen.add('prologue');
    this.onPlayerMoved();
    this.audio.unlock();
    this.audio.startMusic();
  }

  beginScene(name) {
    this.scene = name; this.sceneT = 0; this.panel = null; this.menuIndex = 0;
    this.confirm = null; this.clearedT = 0; this.killedBy = null; this.reward = null;
    this.toasts = []; this.dangerTiles = [];
    this.input.clearAll();
  }

  // Camp (Phase 4 hub): safe place to pick dungeons, craft at the forge and manage gear.
  toCamp() {
    this.run = null;
    this.beginScene('camp');
    this.status.reset();
    this.hero.hp = this.hero.maxHp;
    this.audio.setAmbience({ ambience: 'crypt', music: { root: 65, mode: 'dorian', tempo: 0.6 } });
    if (!this.progress.isUnlocked(this.campSel)) this.campSel = 'ashen_catacombs';
    this.menuIndex = this._lastMenuIndex = Math.max(0, DUNGEON_ORDER.indexOf(this.campSel));
    this.autosave('camp');
    this.showChapterCard();
  }

  // Phase 5: a newly unlocked chapter is introduced once, by a title card in the camp.
  showChapterCard() {
    const q = this.quests;
    if (this.scene !== 'camp') return;
    if (q.titleCard && q.chapterSeen.has(q.titleCard)) q.titleCard = null;
    if (q.titleCard) { this.panel = null; this.openPanel('chapter'); this.audio.stinger('chapter', 'story'); }
  }
  dismissChapterCard() {
    const q = this.quests;
    if (q.titleCard) q.chapterSeen.add(q.titleCard);
    q.titleCard = null;
    this.closePanel();
    this.menuIndex = this._lastMenuIndex = Math.max(0, DUNGEON_ORDER.indexOf(this.campSel));
  }

  // Phase 5: talk to an NPC of the Last Sanctuary (camp only).
  talkTo(npcId) {
    if (this.scene !== 'camp') return null;
    const d = this.quests.talk(npcId);
    if (!d) return null;
    this.talkNpc = npcId;
    this.audio.play('dialogue');
    this.panel = null;
    this.openPanel('dialogue');
    return d;
  }

  enterDungeon(id, difficulty = null) {
    const r = this.director.enter(id, difficulty);
    if (!r.ok) { this.log(r.msg, '#ff7a60'); this.audio.play('deny'); }
    return r;
  }

  toTitle() { this.scene = 'title'; this.panel = null; this.menuIndex = 0; this.input.clearAll(); }

  openSelect() {
    this.scene = 'select'; this.sceneT = 0; this.panel = null; this.menuIndex = 0;
    this.selectIndex = Math.max(0, CLASS_ORDER.indexOf(this.classId));
    this.input.clearAll();
  }
  chooseCard(i) {
    const n = CLASS_ORDER.length;
    this.selectIndex = ((i % n) + n) % n;
    const id = CLASS_ORDER[this.selectIndex];
    this.audio.unlock();
    this.audio.play('select' + id[0].toUpperCase() + id.slice(1));
  }
  confirmSelect() { this.newGame(CLASS_ORDER[this.selectIndex]); }

  // ------------------------------------------------------------------ skills & targeting
  useSkill(slot) {
    const id = this.skills.slots[slot];
    if (id) this.skills.use(id);
  }

  // CAST command: ultimate if ready, otherwise the first skill that can fire.
  quickCast() {
    const order = [4, 0, 1, 2, 3];
    for (const i of order) { const id = this.skills.slots[i]; if (this.skills.canUse(id).ok) { this.skills.use(id); return; } }
    this.skills.use(this.skills.slots[0]); // reports why nothing could be cast
  }

  setTarget(e) {
    if (!e || !e.alive) return;
    this.target = e;
    this.log(`Target: ${e.name}.`, '#ffe58a');
    this.audio.play('ui');
  }

  cycleTarget() {
    const p = this.player;
    const vis = this.enemies.filter((e) => e.alive && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 7 && this.dungeon.hasLOS(p.x, p.y, e.x, e.y))
      .sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
    if (!vis.length) { this.target = null; this.log('No foe in sight to target.', '#8c8467'); return; }
    const i = vis.indexOf(this.target);
    this.setTarget(vis[(i + 1) % vis.length]);
  }

  grantXp(n, why) {
    if (!n) return;
    this.hero.gainXp(n);
    this.stats.xpGained += n;
    this.log(`+${n} XP (${why}).`, '#c8b070');
  }

  saveGame() {
    if (this.scene !== 'camp' && (this.scene !== 'playing' || !this.hero.alive)) return false;
    if (this.scene === 'playing' && (this.combat.active || this.bossCtl.active)) {
      this.log('You cannot save in the heat of battle.', '#ff7a60');
      this.notify('Cannot save during a fight - the game will autosave when it ends.', { kind: 'warn' });
      this.pendingAutosave = 'after combat';
      return false;
    }
    const ok = this.saves.save(this);
    this.saveIndicator = { t: 0, ok };
    if (ok) { this.log('Game saved.', '#7ac060'); this.notify('Game saved.', { kind: 'save' }); }
    else { this.log('Saving failed.', '#ff7a60'); this.notify(`Save failed: ${this.saves.lastResult?.reason || 'storage unavailable'}. Your previous save is intact.`, { kind: 'error' }); }
    return ok;
  }

  loadGame(given = null, fromBackup = false) {
    const data = given || this.saves.load();
    if (!data) {
      this.log('No saved game found.', '#ff7a60');
      if (this.saves.damaged?.length) this.notify(`Save data is damaged (${this.saves.damaged.join(', ')}) and could not be loaded. A copy was kept; nothing was overwritten.`, { kind: 'error' });
      return;
    }
    this._loading = true; // nothing autosaves a half-restored game
    try {
      this.newGame(data.hero.classId);
      this.hero.restore(data.hero);
      this.resource.restore(data.resource);
      const recipeIds = new Set([...RECIPES.map((r) => r.id), REFORGE.recipe]);
      const dropped = this.progress.restore(data.progress, recipeIds);
      // Phase 5 campaign: restored, then every state objective is re-derived from progress
      this.logEntries = [];
      dropped.push(...this.quests.restore(data.campaign));
      if (!data.campaign) this.quests.chapterSeen.add('prologue');
      this.quests.refresh();
      // validate items: unknown definitions are reported, duplicate uids are dropped,
      // Phase 1-3 material stacks move into the material pouch
      this.inventory.reset();
      const unknownMats = this.inventory.materials.restore(data.materials || {});
      const lost = [...unknownMats], seen = new Set();
      for (const s of data.inventory) {
        if (seen.has(s.uid)) continue;
        const it = this.loot.restoreItem(s);
        if (!it) { lost.push(s.baseId || s.defId || '?'); continue; }
        seen.add(it.uid);
        if (it.def.kind === 'material') { this.inventory.materials.add(it.defId, Math.min(it.qty, this.inventory.materials.room(it.defId))); continue; }
        this.inventory.items.push(it);
      }
      this.stash = [];
      for (const s of data.stash || []) { const it = this.loot.restoreItem(s); if (it && !seen.has(it.uid)) { seen.add(it.uid); this.stash.push(it); } }
      this.equipment.restore(data.equipment || {});
      const fixed = this.equipment.validate();
      this.gold = Math.max(0, data.gold | 0);
      this.stats = { ...this._freshStats(), ...data.stats };
      this.formation = buildFormation(this.classId); // formation is derived from the chosen Horseman
      this.calc.invalidate();
      const run = data.scene === 'camp' ? null : this.director.restoreRun(data.run || { dungeonId: PROLOGUE.id, difficulty: 'normal', seed: 0, floor: 0 });
      if (run) {
        this.run = run;
        this.director.buildFloor(run.floor, { restore: false });
        this.loot.restore(data.loot || { floor: [] });
        this.loot.floor = this.loot.floor.filter((f) => !seen.has(f.uid)); // an item can't be both carried and on the floor
        this.dungeon.restore(data.dungeon);
        this.ai.restore(data.enemies || []);
        if (data.player) Object.assign(this.player, { x: data.player.x | 0, y: data.player.y | 0, dir: (data.player.dir | 0) % 4 });
        this.scene = 'playing';
      } else {
        this.loot.restore({ nextUid: data.loot?.nextUid || 1, floor: [] });
        this.run = null;
        this.beginScene('camp');
      }
      this.hero.clampHp(); // derived stats recalculated, never trusted from the save
      this.logEntries = [];
      this.log(`Game loaded: ${this.hero.def.name}, level ${this.hero.level}. ${run ? 'The dungeon remembers you.' : 'You rest at the camp.'}`, '#7ac060');
      if (data.migratedFrom === 1) this.log(`Phase I save migrated: ${this.hero.skillPoints} skill point(s) granted. Open skills with K.`, '#ffd040');
      if (data.migratedFrom && data.migratedFrom < 3) this.log('Older save migrated: items upgraded with item levels and affixes. Your original save is untouched.', '#ffd040');
      if (data.migratedFrom && data.migratedFrom < 4) this.log('Phase III save migrated to v4: materials moved to your pouch; the Ashen Catacombs await at the camp. Your original save is untouched.', '#ffd040');
      if (data.migratedFrom && data.migratedFrom < 5) {
        this.log('Save migrated to v5 (Phase V campaign). Your original save is untouched.', '#ffd040');
        for (const line of data.migrationReport || []) this.log(`  - ${line}`, '#c8b070');
        this.lastMigrationReport = data.migrationReport || [];
      }
      if (lost.length) this.log(`${lost.length} unknown item(s) could not be restored: ${lost.join(', ')}.`, '#ff7a60');
      if (dropped.length) this.log(`Ignored unknown progression data: ${dropped.join(', ')}.`, '#ff7a60');
      if (fixed.length) this.log(`Unequipped invalid gear: ${fixed.join(', ')}.`, '#ff7a60');
      if (this.player) this.dungeon.reveal(this.player.x, this.player.y, this.player.dir);
      if (run) this.onPlayerMoved();
      if (this.saves.loadedFrom === 'backup' || fromBackup) this.notify('Your latest save was damaged - restored the previous (backup) save.', { kind: 'warn' });
      this.lastLoadOk = true;
    } catch (err) {
      // Phase 6: never silently reset progress. Try the backup once; otherwise stop at the title
      // screen with a sticky error. Nothing autosaves on the title screen, so the stored save is untouched.
      console.warn('[save] load failed', err);
      this._loading = false;
      const backup = !fromBackup ? this.saves.loadBackup() : null;
      if (backup) { this.loadGame(backup, true); return; }
      this.lastLoadOk = false;
      this.toTitle();
      this.notify(`Could not load the save (${err.message}). Your save data was NOT changed. Export it from OPTIONS to keep a copy.`, { kind: 'error' });
    } finally { this._loading = false; }
  }

  onPlayerMoved() {
    const p = this.player;
    const room = this.dungeon.roomAt(p.x, p.y);
    if (!this.dungeon.visitedRooms.has(room.id)) {
      this.dungeon.visitedRooms.add(room.id);
      this.log(`${room.name}: ${room.lore}`, '#c8b890');
      if (this.dungeon.visitedRooms.size > 1) {
        this.effects.showBanner(room.name, this.theme.bronzeLight, 1.4);
        this.grantXp(PROGRESSION.explorationXp.room, 'discovery');
      }
    }
    this.director.onPlayerMoved();
  }

  onPlayerDeath(by) {
    if (this.scene !== 'playing') return;
    this.killedBy = by ? by.name.toUpperCase() : null;
    this.scene = 'gameover'; this.sceneT = 0; this.panel = null; this.menuIndex = 0;
    this.player.guarding = false;
    this.dangerTiles = [];
    this.audio.play('death');
    this.audio.stinger('defeat');
    this.log('You have fallen...', '#ff3020');
  }

  log(text, color = '#d9cfa8') {
    this.logEntries.push({ text, color });
    if (this.logEntries.length > 120) this.logEntries.shift();
    this.logScroll = 0;
  }

  // ------------------------------------------------------------------ actions
  fight() {
    const c = this.controller;
    const f = c.front();
    if (this.ai.enemyAt(f.x, f.y)) { this.combat.playerAttack(); return; }
    for (let i = 2; i <= 4; i++) {
      const cell = c.front(i);
      if (this.dungeon.blocksSight(cell.x, cell.y)) break;
      if (this.ai.enemyAt(cell.x, cell.y)) { this.player.moveCD = 0; c.step(1); this.log('You advance to engage!', '#ff9040'); return; }
    }
    this.log('No foe stands before you.', '#8c8467');
  }

  runAway() {
    const threatened = this.combat.active || this.combat.sideThreats.length > 0;
    this.player.moveCD = 0;
    if (!threatened) { this.controller.step(-1); return; }
    if (chance(0.6)) {
      const back = DIRS[(this.player.dir + 2) % 4];
      const ok = this.controller.step(-1);
      if (ok) {
        this.log('You break away from the fight!', '#9ad0ff');
        for (const e of this.enemies) if (e.alive && e.state === 'attack' && !e.boss) { e.state = 'chase'; e.phase = null; e.moveT = -0.6; }
      } else this.log(`No room to flee ${back.name.toLowerCase()}!`, '#ff7a60');
    } else {
      this.player.moveCD = 0.8;
      this.log('You stumble and fail to escape!', '#ff7a60');
    }
  }

  usePotion() {
    const pot = this.inventory.findFirst('health_potion') || this.inventory.findFirst('greater_health_potion');
    if (!pot) { this.log('You have no Health Potions.', '#ff7a60'); return; }
    this.useItem(pot.uid);
  }

  useItem(uid) {
    const it = this.inventory.get(uid);
    if (!it || it.def.type !== 'consumable') return;
    if (!this.hero.alive) return;
    if (it.def.resource) { // Dark Elixir: restore a share of the class resource
      if (this.resource.full) { this.log(`Your ${this.resource.def.name} is already full.`, '#8c8467'); return; }
      const got = this.resource.gain(this.resource.max * it.def.resource);
      this.inventory.consume(uid, 1);
      this.audio.play('drain');
      this.log(`You drink a Dark Elixir. +${Math.round(got)} ${this.resource.def.name}.`, this.resource.def.color);
      return;
    }
    if (it.def.cure) { // Purifying Draught
      const bad = ['blighted', 'cursed', 'sundered'].filter((id) => this.status.has('player', id));
      if (!bad.length && this.hero.hp >= this.hero.maxHp) { this.log('You are neither hurt nor afflicted.', '#8c8467'); return; }
      for (const id of bad) this.status.remove('player', id);
      const healed = this.hero.heal(this.hero.maxHp * (it.def.healPct || 0));
      this.inventory.consume(uid, 1);
      this.audio.play('font');
      this.log(`You drink a Purifying Draught. ${bad.length ? 'Afflictions cleansed. ' : ''}+${healed} HP.`, '#60ff80');
      return;
    }
    if (this.hero.hp >= this.hero.maxHp) { this.log('You are already at full health.', '#8c8467'); return; }
    const healed = this.hero.heal(it.def.heal);
    this.inventory.consume(uid, 1);
    this.audio.play('pickup');
    this.effects.text(LAYOUT.view.w / 2 - 90, LAYOUT.view.h - 70, `+${healed}`, '#60ff80', 2);
    this.effects.burst(LAYOUT.view.w / 2, LAYOUT.view.h - 40, ['#60ff80', '#c0ffc0'], 18, { speed: 60, lift: 50, gravity: -40 });
    this.log(`You drink a ${it.def.name}. +${healed} HP.`, '#60ff80');
    if (this.invSel >= this.inventory.items.length) this.invSel = Math.max(0, this.inventory.items.length - 1);
  }

  equipItem(uid) {
    const res = this.equipment.equip(uid);
    this.log(res.msg, res.ok ? '#c8b070' : '#8c8467');
    if (res.ok) { this.weapons.cancel(); this.audio.play('inventory'); }
  }

  unequipItem(uid) {
    const res = this.equipment.unequip(uid);
    this.log(res.msg, res.ok ? '#c8b070' : '#8c8467');
    if (res.ok) { this.weapons.cancel(); this.audio.play('inventory'); }
  }

  selectWeapon(idx) {
    if (this.equipment.active === idx && this.equipment.weaponSlots[idx]) return;
    if (this.equipment.select(idx)) {
      this.weapons.cancel();
      this.audio.play('inventory');
      this.log(`You ready the ${this.weapons.current.name}.`, '#c8b070');
    } else this.log(`No weapon in slot ${idx + 1}.`, '#8c8467');
  }

  cycleWeapon(step) {
    if (this.equipment.cycle(step)) {
      this.weapons.cancel();
      this.audio.play('inventory');
      this.log(`You ready the ${this.weapons.current.name}.`, '#c8b070');
    } else this.log('You carry no other weapon.', '#8c8467');
  }

  formationClick(i) {
    if (this.formationSel < 0) { this.formationSel = i; return; }
    if (this.formationSel !== i) {
      const f = this.formation;
      [f[this.formationSel], f[i]] = [f[i], f[this.formationSel]];
      this.log(`Swapped party slots ${this.formationSel + 1} and ${i + 1}.`, '#c8b070');
    }
    this.formationSel = -1;
  }

  // ------------------------------------------------------------------ panels & settings
  openPanel(name) {
    if (!name) { this.closePanel(); return; }
    if (this.scene === 'gameover' || this.scene === 'cleared') return;
    if (this.scene === 'title' && name !== 'options' && name !== 'keybinds') return;
    if (this.scene === 'camp' && ['map', 'formation', 'objectives', 'victory'].includes(name)) return;
    if (name === 'dialogue' && (this.scene !== 'camp' || !this.talkNpc)) return;
    if (this.panel === 'chapter' && name !== 'chapter') return; // the title card is dismissed first
    if (name === 'inventory') this.audio.play('inventory');
    this.panel = name; this.menuIndex = 0; this.formationSel = -1;
    if (this.player) this.player.guarding = false;
  }
  closePanel() {
    const was = this.panel;
    this.panel = null; this.menuIndex = 0; this.activeMenu = null;
    if (was === 'dialogue') { this.talkNpc = null; this.showChapterCard(); }
  }
  togglePanel(name) { if (this.panel === name) this.closePanel(); else this.openPanel(name); }

  // ------------------------------------------------------------------ Phase 6: adaptive music
  // Chooses the music state from the real game state every frame (idempotent in the engine).
  // Combat -> exploration waits 3s without a threat, so short gaps never flap the music.
  _desiredMusic() {
    if (this.scene === 'title' || this.scene === 'select') return ['title'];
    if (this.panel === 'chapter') return ['story'];
    if (this.scene === 'camp') return ['sanctuary'];
    if (this.scene === 'gameover') return ['silence'];
    if (this.scene === 'cleared') return ['safe'];
    if (!this.player) return ['explore'];
    const p = this.player;
    if (this.bossCtl.active) { this._lastFight = { t: this.time, state: 'boss' }; return ['boss']; }
    const foes = this.enemies.filter((e) => e.alive && !e.illusion && ['detect', 'chase', 'attack', 'hurt'].includes(e.state) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 6);
    if (foes.length) { this._lastFight = { t: this.time, state: foes.some((e) => e.rank === 'elite' || e.champion) ? 'elite' : 'combat' }; return [this._lastFight.state]; }
    if (this._lastFight && this.time - this._lastFight.t < 3) return [this._lastFight.state];
    const room = this.dungeon.roomAt(p.x, p.y);
    if (room?.type === 'rest') return ['safe'];
    const audio = this.run ? DUNGEONS[this.run.dungeonId]?.audio : null;
    return ['explore', this.audio.ambienceMusicOpts(audio)];
  }
  updateMusic() {
    const [state, opts] = this._desiredMusic();
    if (state !== this.musicState || (opts && opts.root !== this._musicRoot)) {
      this.musicState = state; this._musicRoot = opts?.root;
      this.audio.setMusic(state, opts || {});
    }
  }

  // Restores audio + accessibility defaults (keeps colors and hotkey mode).
  resetSettings() {
    const keep = { theme: this.settings.theme, hotkeys: this.settings.hotkeys };
    Object.assign(this.settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), keep);
    this.display.layout();
    this.input.setBindings(this.settings.keybinds);
    this.audio.applyVolumes();
    this.saves.saveSettings(this.settings);
    this.notify('Settings restored to defaults.', { kind: 'info' });
  }

  // Key rebinding (Phase 6): captures the next key press for an action, persists it in settings.
  beginRebind(action) {
    this.rebinding = action;
    this.input.capture = (code) => {
      this.rebinding = null;
      if (code === 'Escape') return;
      if (/^(Enter|NumpadEnter|Tab|Digit[0-9]|Numpad[0-9]|Arrow.*)$/.test(code)) { this.notify(`${code} is reserved and cannot be bound.`, { kind: 'warn' }); return; }
      this.settings.keybinds = { ...this.settings.keybinds, [action]: code };
      for (const [a, c] of Object.entries(this.settings.keybinds)) if (a !== action && c === code) delete this.settings.keybinds[a];
      this.input.setBindings(this.settings.keybinds);
      this.saves.saveSettings(this.settings);
      this.audio.play('confirm');
    };
  }
  resetKeybinds() { this.settings.keybinds = {}; this.input.setBindings({}); this.saves.saveSettings(this.settings); this.notify('Controls restored to defaults.', { kind: 'info' }); }

  setVolume(key, v) {
    this.settings[key] = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
    this.audio.applyVolumes();
    this.saves.saveSettings(this.settings);
  }
  toggleHotkeys() {
    this.settings.hotkeys = this.settings.hotkeys === 'weapons' ? 'skills' : 'weapons';
    this.saves.saveSettings(this.settings);
  }
  toggleSetting(key) { this.settings[key] = !this.settings[key]; this.saves.saveSettings(this.settings); }
  cycleResolution() { this.display.cycleResolution(); this.saves.saveSettings(this.settings); }
  toggleScaling() { this.display.toggleScaling(); this.saves.saveSettings(this.settings); }
  toggleMute() { this.settings.muted = !this.settings.muted; this.audio.applyVolumes(); this.saves.saveSettings(this.settings); }
  cycleTheme() {
    this.settings.theme = (this.settings.theme + 1) % THEMES.length;
    this.saves.saveSettings(this.settings);
    if (this.scene === 'playing') this.log(`Interface colors: ${this.theme.name}.`, this.theme.bronzeLight);
  }

  getPrompt() {
    if (this.panel || this.scene !== 'playing') return null;
    if (this.combat.active) return this.weapons.current.def.kind === 'ranged' ? 'SPACE FIRE  F GUARD  S RETREAT' : 'SPACE ATTACK  F GUARD  S RETREAT';
    const p = this.player, c = this.controller, dm = this.dungeon;
    const here = this.loot.itemsAt(p.x, p.y);
    if (here.length) return `[E] TAKE ${here[0].item.name}${here.length > 1 ? ' +' + (here.length - 1) : ''}`;
    const f = c.front();
    const there = this.loot.itemsAt(f.x, f.y);
    if (there.length) return `[E] TAKE ${there[0].item.name}${there.length > 1 ? ' +' + (there.length - 1) : ''}`;
    const kind = dm.wallKind(f.x, f.y);
    if (kind === 'door') return '[E] OPEN DOOR';
    if (kind === 'gate') { const gate = dm.gateAt(f.x, f.y); return gate?.sealed ? 'ARENA SEALED' : gate?.unlocked ? '[E] OPEN GATE' : 'SEALED GATE'; }
    const classDoor = { barrier: 'war', sigil: 'conquest', roots: 'famine', soulseal: 'death' }[kind];
    if (classDoor) return this.hero.classId === classDoor ? `[E] ${{ war: 'SMASH BARRIER', conquest: 'TRIP THE SIGIL', famine: 'DRAIN THE ROOTS', death: 'COMMAND THE SOULS' }[classDoor]}` : `SEALED (${classDoor.toUpperCase()})`;
    if (kind === 'portcullis') return 'PORTCULLIS - FIND THE LEVER';
    if (kind && kind.startsWith('rune')) return '[E] TOUCH RUNE';
    if (kind === 'lever' || kind === 'leverOn') return '[E] PULL LEVER';
    if (kind === 'switch') { const sw = dm.featureAt(f.x, f.y); return sw?.spotted ? '[E] PRESS THE SYMBOL' : null; }
    const ch = dm.chestAt(f.x, f.y);
    if (ch && !ch.opened) return this.director.chestLocked(ch) ? 'LOCKED CHEST' : '[E] OPEN CHEST';
    const feat = dm.featureAt(f.x, f.y);
    if (feat) {
      if (feat.kind === 'stairs') return '[E] DESCEND';
      if (feat.kind === 'exit') return this.run?.bossDefeated ? '[E] LEAVE THE DUNGEON' : 'PORTAL SEALED';
      if (feat.kind === 'tablet') return '[E] READ';
      if (feat.kind === 'font' && !feat.used) return '[E] DRINK';
      if (feat.kind === 'shrine' && !feat.used) return this.hero.classId === 'famine' ? '[E] DRAIN SHRINE' : 'CORRUPTED SHRINE';
      if (feat.kind === 'scroll' && !feat.used) return '[E] READ SCROLL';
    }
    return null;
  }

  // ------------------------------------------------------------------ loop
  start() {
    if (this.running) return; // guard against double loops
    this.running = true;
    this.last = performance.now();
    // rAF drives the loop; a slow timer fallback keeps it alive where rAF is suspended
    // (e.g. embedded/background previews). Whichever fires first runs the frame, once.
    const schedule = () => {
      let fired = false;
      const run = () => { if (fired) return; fired = true; frame(performance.now()); };
      requestAnimationFrame(run);
      setTimeout(run, 100);
    };
    const frame = (ts) => {
      const dt = Math.max(0, Math.min(0.05, (ts - this.last) / 1000));
      this.last = ts;
      try {
        this.ui.beginFrame();
        this.update(dt);
        this.render();
      } catch (err) {
        console.error(err);
        if (!this.errorShown) { this.errorShown = true; this.log(`Internal error: ${err.message}`, '#ff3020'); }
      }
      schedule();
    };
    schedule();
  }

  _menuKeys(actions) {
    const items = this.activeMenu;
    if (!items || !items.length) return;
    for (const a of actions) {
      if ((a === 'turnLeft' || a === 'turnRight') && items[this.menuIndex % items.length]?.adjust) { items[this.menuIndex % items.length].adjust(a === 'turnLeft' ? -1 : 1); this.audio.play('ui'); continue; }
      // up/down skip disabled entries (e.g. CONTINUE without a save), wrapping around
      const step = (d) => { let i = this.menuIndex; for (let n = 0; n < items.length; n++) { i = (i + d + items.length) % items.length; if (!items[i]?.disabled) break; } this.menuIndex = i; this.audio.play('ui'); };
      if (a === 'forward' || a === 'menuUp') step(-1);
      else if (a === 'back' || a === 'menuDown') step(1);
      else if (a === 'confirm' || a === 'attack' || a === 'interact') { const it = items[this.menuIndex % items.length]; if (it && !it.disabled) { this.audio.play('confirm'); it.run(); } else if (it) this.audio.play('deny'); return; }
    }
  }

  // Shared modal-panel input (playing + camp). Returns true when a panel consumed the frame.
  // Hold ATTACK (SPACE / pad A): the press itself swings through the normal edge action; while it stays
  // held, another swing starts once the weapon is ready again AND TUNING.attackRepeat has passed since
  // the last swing. Nothing is queued: each frame either starts a swing or does nothing, so releasing
  // the key stops further swings at once (a swing already in motion still lands its single impact).
  // Game time drives it, so the rate is the same at any frame rate.
  _updateHeldAttack(input) {
    const h = this.holdAttack;
    h.held = input.isHeld('attack');
    if (!h.held || this.panel || this.confirm || this.scene !== 'playing') return;
    if (!this.combat.canPlayerAct() || !this.weapons.canAttack()) return;
    if (this.time - this.combat.lastAttackAt < TUNING.attackRepeat) return;
    if (this.combat.playerAttack()) h.count++;
  }

  // F11 / OPTIONS: borderless fullscreen (Fullscreen API), then re-fit the output.
  toggleFullscreen() {
    this.display.toggleFullscreen().then((ok) => { if (!ok) this.notify('Fullscreen is not available here.', { kind: 'warn' }); this.display.layout(); });
  }

  _panelInput(actions) {
    if (this.confirm) { // modal yes/no: Enter = yes, Esc = no
      for (const a of actions) {
        if (a === 'confirm') { const c = this.confirm; this.confirm = null; c.onYes(); return true; }
        if (a === 'pause') { this.confirm = null; return true; }
      }
      return true;
    }
    if (!this.panel) return false;
    for (const a of actions) {
      if (a === 'pause') { if (this.input.capture) return true; this.panel === 'keybinds' ? this.openPanel('options') : this.panel === 'options' || this.panel === 'help' ? this.openPanel('pause') : this.closePanel(); return true; }
      if (a === 'crafting' && this.panel !== 'pause') { this.togglePanel('crafting'); return true; }
      if (a === 'inventory') { this.togglePanel('inventory'); return true; }
      if (a === 'character' && this.panel !== 'pause') { this.togglePanel('character'); return true; }
      if (a === 'map' && this.panel !== 'pause') { this.togglePanel('map'); return true; }
      if (a === 'formation' && this.panel !== 'pause') { this.togglePanel('formation'); return true; }
      if (a === 'skills' && this.panel !== 'pause') { this.togglePanel('skills'); return true; }
      if (a === 'objectives' && this.panel !== 'pause') { this.togglePanel('objectives'); return true; }
      if (a === 'journal' && this.panel !== 'pause') { this.togglePanel('journal'); return true; }
      if (this.panel === 'victory' && (a === 'confirm' || a === 'interact')) { this.closePanel(); return true; }
      if (this.panel === 'inventory') inventoryKey(this, a);
    }
    if (['pause', 'options', 'keybinds', 'dialogue', 'journal', 'chapter'].includes(this.panel)) this._menuKeys(actions);
    return true;
  }

  update(dt) {
    this.realTime += dt;
    this.sceneT += dt;
    this.updateMusic();
    this.updateNotices(dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.saveIndicator) { this.saveIndicator.t += dt; if (this.saveIndicator.t > 1.6) this.saveIndicator = null; }
    const input = this.input;
    input.pollGamepad();
    this.ui.processClicks(input.consumeClicks());
    const wheel = input.consumeWheel();
    const actions = input.consumePressed();
    if (actions.includes('fullscreen')) this.toggleFullscreen();
    if (wheel &&this.ui.hover(LAYOUT.log.x, LAYOUT.log.y, LAYOUT.log.w, LAYOUT.log.h)) {
      this.logScroll = Math.max(0, Math.min(this.logScrollMax, this.logScroll - wheel));
    }
    // Unequip shortcut inside inventory
    if (this.panel === 'inventory' && input.heldKeys.has('KeyU') && !this._uHeld) { this._uHeld = true; actions.push('unequip'); }
    if (!input.heldKeys.has('KeyU')) this._uHeld = false;

    if (this.scene === 'title') {
      if (this.confirm) { this._panelInput(actions); this.effects.update(dt); return; } // yes/no modal (e.g. restore defaults)
      if (this.panel === 'options' || this.panel === 'keybinds') {
        if (actions.includes('pause')) { if (this.panel === 'keybinds') this.openPanel('options'); else this.closePanel(); } else this._menuKeys(actions);
      } else this._menuKeys(actions);
      this.effects.update(dt);
      return;
    }
    if (this.scene === 'select') {
      for (const a of actions) {
        if (a === 'turnLeft') this.chooseCard(this.selectIndex - 1);
        else if (a === 'turnRight') this.chooseCard(this.selectIndex + 1);
        else if (a === 'pause') { this.toTitle(); return; }
        else if (a === 'confirm' || a === 'attack') { if (this.menuIndex === 1) this.toTitle(); else this.confirmSelect(); return; }
        else if (a === 'forward' || a === 'back' || a === 'menuUp' || a === 'menuDown') this.menuIndex = this.menuIndex ? 0 : 1;
      }
      this.effects.update(dt);
      return;
    }
    if (this.scene === 'gameover' || this.scene === 'cleared') {
      this._menuKeys(actions);
      this.effects.update(dt);
      return;
    }
    for (const tt of this.toasts) tt.t += dt;
    this.toasts = this.toasts.filter((tt) => tt.t < 4);
    if (this.scene === 'camp') {
      if (!this._panelInput(actions)) {
        for (const a of actions) {
          if (a === 'inventory') { this.openPanel('inventory'); return; }
          if (a === 'character') { this.openPanel('character'); return; }
          if (a === 'crafting') { this.openPanel('crafting'); return; }
          if (a === 'skills') { this.openPanel('skills'); return; }
          if (a === 'journal') { this.openPanel('journal'); return; }
          if (a === 'pause') { this.openPanel('pause'); return; }
        }
        this._menuKeys(actions);
      }
      this.effects.update(dt);
      return;
    }

    // ---- playing
    if (this._panelInput(actions)) { this.effects.update(dt); return; } // world simulation is paused while any panel is open

    for (const a of actions) {
      switch (a) {
        case 'forward': this.controller.requestStep(1); break;
        case 'back': this.controller.requestStep(-1); break;
        case 'turnLeft': this.controller.requestTurn(-1); break;
        case 'turnRight': this.controller.requestTurn(1); break;
        case 'attack': this.combat.playerAttack(); break;
        case 'interact': this.controller.interact(); break;
        case 'weapon1': case 'weapon2': case 'weapon3': case 'weapon4': this.selectWeapon(Number(a.slice(-1)) - 1); break;
        case 'nextWeapon': this.cycleWeapon(1); break;
        case 'prevWeapon': this.cycleWeapon(-1); break;
        case 'inventory': this.openPanel('inventory'); return;
        case 'character': this.openPanel('character'); return;
        case 'map': this.openPanel('map'); return;
        case 'formation': this.openPanel('formation'); return;
        case 'objectives': this.openPanel('objectives'); return;
        case 'journal': this.openPanel('journal'); return;
        case 'pause': this.openPanel('pause'); return;
        case 'skill1': case 'skill2': case 'skill3': case 'skill4': this.useSkill(Number(a.slice(-1)) - 1); break;
        case 'ultimate': this.useSkill(4); break;
        case 'target': this.cycleTarget(); break;
        case 'skills': this.openPanel('skills'); return;
        case 'crafting': this.openPanel('crafting'); return;
        case 'quickPotion': this.usePotion(); break;
        case 'look': this.controller.look(); break;
        // former COMMANDS-menu entries (the popup is gone; each has a key, see CONTROLS in Panels.js)
        case 'fight': this.fight(); break;
        case 'cast': this.quickCast(); break;
        case 'aboutFace': this.controller.aboutFace(); break;
        case 'runAway': this.runAway(); break;
        default: break;
      }
      if (this.scene !== 'playing') return;
    }

    this.controller.update(dt, input);
    this._updateHeldAttack(input);
    this.time += dt;
    this.stats.playTime += dt;
    this.weapons.update(dt);
    this.ai.update(dt);
    this.combat.update(dt);
    this.status.update(dt);
    this.skills.update(dt);
    // "in combat" = engaged, or any aware foe within 5 tiles; drives Fury/Dominion decay
    const p = this.player;
    this.inCombat = this.combat.active || this.bossCtl.active || this.enemies.some((e) => e.alive && ['detect', 'chase', 'attack', 'hurt'].includes(e.state) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 5);
    this.resource.update(dt, this.inCombat);
    if (this.target && !this.target.alive) this.target = null;
    this.hero.update(dt);
    if (this.scene === 'playing') this.director.update(dt);
    if (this.pendingAutosave && !this.inCombat && !this.combat.active && !this.bossCtl.active && this.scene === 'playing') this.autosave(this.pendingAutosave);
    this.dangerTiles = this.dangerTiles.filter((d) => d.until > this.time - 0.05);
    this.effects.update(dt);
    if (this.clearedT > 0) {
      this.clearedT -= dt;
      if (this.clearedT <= 0 && this.scene === 'playing') {
        this.scene = 'cleared'; this.sceneT = 0; this.menuIndex = 0;
        this.effects.showBanner('DUNGEON CLEARED', '#ffd040', 2.5);
        this.audio.play('victory');
      }
    }
  }

  _drawPanel(ctx, t) {
    if (this.panel === 'inventory') drawInventory(ctx, this, t);
    else if (this.panel === 'skills') drawSkillPanel(ctx, this, t);
    else if (this.panel === 'character') drawEquipment(ctx, this, t);
    else if (this.panel === 'crafting') drawCrafting(ctx, this, t);
    else if (this.panel === 'formation') Panels.drawFormation(ctx, this);
    else if (this.panel === 'map') Panels.drawMapPanel(ctx, this);
    else if (this.panel === 'pause') Panels.drawPause(ctx, this);
    else if (this.panel === 'options') Panels.drawOptions(ctx, this);
    else if (this.panel === 'keybinds') Panels.drawKeybinds(ctx, this, t);
    else if (this.panel === 'help') Panels.drawHelp(ctx, this);
    else if (this.panel === 'objectives') Panels.drawObjectives(ctx, this);
    else if (this.panel === 'victory') Panels.drawVictory(ctx, this, t);
    else if (this.panel === 'journal') drawJournal(ctx, this, t);
    else if (this.panel === 'dialogue') drawDialogue(ctx, this, t);
    else if (this.panel === 'chapter') drawChapterCard(ctx, this, t);
    else this.activeMenu = null;
  }

  // Draws a screen composed on the original 640x480 grid (panels, select, camp) centred on the 16:9
  // frame: canvas translate + the same offset for click regions / hover / tooltips.
  _classic(ctx, fn) {
    const before = this.ui.tooltip;
    ctx.save();
    ctx.translate(CLASSIC.x, CLASSIC.y);
    this.ui.setOrigin(CLASSIC.x, CLASSIC.y);
    try { fn(); } finally {
      this.ui.setOrigin(0, 0);
      ctx.restore();
    }
    const tip = this.ui.tooltip;
    if (tip && tip !== before) { tip.x += CLASSIC.x; tip.y += CLASSIC.y; }
  }

  render() {
    this._renderFrame();
    this.display.present();
  }

  _renderFrame() {
    const ctx = this.ctx;
    const t = this.realTime;
    ctx.imageSmoothingEnabled = false;
    this.titleScreen?.sync();
    if (this.scene === 'title') {
      // Phase 6: the HTML/CSS main menu (ui/TitleScreen.js) draws art + title + buttons; this canvas
      // is transparent here and only shows panels, prompts and notifications on top of it.
      if (this.titleScreen) ctx.clearRect(0, 0, SCREEN.w, SCREEN.h);
      else { ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h); this._classic(ctx, () => Panels.drawTitle(ctx, this, t)); } // fallback (no DOM)
      this._classic(ctx, () => {
        if (this.panel === 'options') Panels.drawOptions(ctx, this);
        if (this.panel === 'keybinds') Panels.drawKeybinds(ctx, this, t);
        if (this.confirm) drawConfirm(ctx, this);
      });
      this._drawOverlays(ctx, t);
      this.ui.drawTooltip(ctx, this.theme);
      return;
    }
    if (this.scene === 'select') {
      ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
      this._classic(ctx, () => drawCharacterSelect(ctx, this, t));
      return;
    }
    if (this.scene === 'camp') {
      ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
      this._classic(ctx, () => {
        drawCamp(ctx, this, t);
        this._drawPanel(ctx, t);
        drawToasts(ctx, this, 140, 30);
        if (this.confirm) drawConfirm(ctx, this);
      });
      this._drawOverlays(ctx, t);
      this.ui.drawTooltip(ctx, this.theme);
      return;
    }
    HUD.drawBackground(ctx, this);
    HUD.drawTopStrip(ctx, this);
    HUD.drawParty(ctx, this, t);
    HUD.drawViewFrame(ctx, this);

    // first-person viewport (rendered to its own 2D canvas, then framed)
    const V = LAYOUT.view;
    const view = this.renderer.render(this, t);
    const vctx = this.renderer.ctx;
    if (this.combat.active) this.renderer.renderCombat(vctx, this, t);
    else if (this.hero.alive) this.renderer.renderWeapon(vctx, this.weapons, t, this.player.bob, { hurt: this.hurtFlash || 0 });
    if (this.player.guarding && !this.combat.active) {
      vctx.drawImage(this.sprites.ui.shield_hi, 12, V.h - 30, 24, 24);
    }
    this.effects.render(vctx, V.w, V.h);
    HUD.drawPrompt(vctx, this, this.getPrompt(), t);
    HUD.drawBossBar(vctx, this, t);
    HUD.drawPlayerStatus(vctx, this, t);
    const trackerH = HUD.drawObjectiveTracker(vctx, this) || 0;
    drawToasts(vctx, this, 0, trackerH);
    const sh = this.settings.reduceFx || this.settings.reduceShake ? Math.min(2, this.effects.shake) : this.effects.shake;
    const ox = sh ? Math.round((Math.random() - 0.5) * sh) : 0, oy = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
    if (sh) { ctx.fillStyle = '#000'; ctx.fillRect(V.x, V.y, V.w, V.h); }
    ctx.drawImage(view, V.x + ox, V.y + oy);
    ctx.restore();
    // click a visible foe to make it the skill target
    if (!this.panel && this.scene === 'playing') {
      for (const e of this.enemies) {
        if (!e.alive || !e.screen) continue;
        const s = e.screen;
        const x = Math.max(V.x, V.x + s.x), y = Math.max(V.y, V.y + s.y);
        const w = Math.min(V.x + V.w, V.x + s.x + s.w) - x, h = Math.min(V.y + V.h, V.y + s.y + s.h) - y;
        if (w > 2 && h > 2) this.ui.button(x, y, w, h, () => this.setTarget(e), { sound: false });
      }
    }

    HUD.drawViewFrameOrnaments(ctx, this);
    HUD.drawMinimap(ctx, this);
    HUD.drawUtility(ctx, this);
    HUD.drawLog(ctx, this);
    HUD.drawWeaponHud(ctx, this);
    drawSkillBar(ctx, this, t);

    this._classic(ctx, () => {
      this._drawPanel(ctx, t);
      if (this.scene === 'gameover') Panels.drawGameOver(ctx, this, t);
      if (this.scene === 'cleared') Panels.drawCleared(ctx, this, t);
      if (this.confirm) drawConfirm(ctx, this);
    });
    this._drawOverlays(ctx, t);
    this.ui.drawTooltip(ctx, this.theme);
  }

  // Phase 6 screen-space overlays shared by every scene: notifications + the saving indicator.
  _drawOverlays(ctx, t) {
    // in a dungeon: the viewport's top-right (below the boss bar row); elsewhere: top-right of the screen
    if (this.scene === 'playing' && !this.panel) this.notices.draw(ctx, this.ui, LAYOUT.view.x + LAYOUT.view.w - 4, LAYOUT.view.y + 44, 240);
    else this.notices.draw(ctx, this.ui, SCREEN.w - 4, this.panel ? 46 : 28, 214); // below a panel's title / close button
    const si = this.saveIndicator;
    if (si) {
      const a = Math.min(1, (1.6 - si.t) * 2);
      ctx.globalAlpha = Math.max(0, a);
      // bottom-right of the viewport in a dungeon, bottom-right of the screen elsewhere (never over buttons)
      const [x, y] = this.scene === 'playing' ? [LAYOUT.view.x + LAYOUT.view.w - 96, LAYOUT.view.y + LAYOUT.view.h - 14] : [SCREEN.w - 100, 6];
      ctx.fillStyle = '#0a0806'; ctx.fillRect(x - 4, y - 3, 92, 14);
      ctx.fillStyle = si.ok ? '#7ac060' : '#ff5a4a';
      if (si.ok) { const k = Math.floor(t * 8) % 4; for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 3, y + 3 - (i === k ? 2 : 0), 2, 2); }
      else ctx.fillRect(x, y, 8, 8);
      drawText(ctx, si.ok ? 'SAVED' : 'SAVE FAILED', x + 16, y, si.ok ? '#7ac060' : '#ff5a4a');
      ctx.globalAlpha = 1;
    }
  }
}
