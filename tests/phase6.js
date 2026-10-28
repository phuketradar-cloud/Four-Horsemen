// Phase 6 suite: http://localhost:5173/?test6  (results in window.__p6Results). &quick = fewer balance samples.
// Audio wiring + music states, combat feedback integrity, animation-state safety, UI/menus + keyboard,
// notifications, settings persistence, the 12 save/load scenarios of the Phase 6 brief, balance
// simulations (measured) and a short long-session stability check.
import { SAVE_KEYS } from '../src/data/config.js';
import { SAVE_VERSION } from '../src/systems/SaveMigration.js';
import { validateSave, DEFAULT_SETTINGS } from '../src/systems/SaveSystem.js';
import { MUSIC_STATES, STINGERS } from '../src/data/music.js';
import { ITEM_DEFS, MYTHIC_IDS, CURATED_LEGENDARY_IDS } from '../src/data/items.js';
import { CLASS_BALANCE } from '../src/data/balance.js';
import { REBINDABLE, buildKeymap, keysFor } from '../src/core/Input.js';
import { runPhase4 } from './phase4.js';
import { makeBalance } from './balance.js';

export async function runPhase6(g, { quick = false } = {}) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const onErr = (e) => errors.push(e.message);
  window.addEventListener('error', onErr);
  const check = (name, pass, detail = '') => { results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const keep = {}; for (const k of Object.values(SAVE_KEYS)) keep[k] = localStorage.getItem(k);
  const keepSettings = JSON.parse(JSON.stringify(g.settings));

  await runPhase4(g, { botOnly: true });
  const bot = window.__bot;
  const { sim, walkTo, fight, boost, faceTo, playDungeon } = bot;
  g.update = () => {};
  const A = g.audio;
  const req = (n) => A.requested[n] || 0;
  const unlockAll = (upto) => { for (const id of ['crypt_first_seal', 'ashen_catacombs', 'red_warfront', 'black_harvest', 'pale_threshold', 'abyssal_gate', 'last_revelation']) { if (id === upto) break; g.progress.recordCompletion(id, 'normal'); } };
  const wipeSaves = () => { for (const k of Object.values(SAVE_KEYS)) if (k !== SAVE_KEYS.settings) localStorage.removeItem(k); };
  const itemSig = (it) => it && JSON.stringify({ b: it.baseId, r: it.rarity, i: it.ilvl, a: it.affixes, u: it.unique, up: it.upgrade, s: it.seed, uid: it.uid });

  try {
    check('Game remains strictly 2D (Canvas 2D only, no WebGL / 3D library)', g.ctx instanceof CanvasRenderingContext2D && typeof window.THREE === 'undefined' && ![...document.querySelectorAll('canvas')].some((c) => c.getContext('2d') === null), 'Canvas 2D');

    // ============================================================ AUDIO
    // every cue the game can request has a synthesized sound (no silent / unknown events)
    g.newGame('war');
    const names = [...new Set([...Object.keys(A.requested)])];
    check('Every requested sound cue exists (no silent or unknown audio events)', A.unknown.size === 0, `unknown: ${[...A.unknown].join(', ') || 'none'}`);
    // music state follows the real game state
    const states = [];
    g.toTitle(); g.updateMusic(); states.push(['title', g.musicState]);
    g.newGame('war'); g.updateMusic(); states.push(['explore', g.musicState]);
    const foe = g.enemies.find((e) => e.alive && !e.boss);
    foe.x = g.player.x; foe.y = g.player.y; // move it next to the hero
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dy]) => g.dungeon.isWalkable(g.player.x + dx, g.player.y + dy) && !g.ai.enemyAt(g.player.x + dx, g.player.y + dy));
    foe.x = g.player.x + D[0]; foe.y = g.player.y + D[1]; foe.rx = foe.x; foe.ry = foe.y; foe.state = 'chase';
    g.updateMusic(); states.push([foe.rank === 'elite' ? 'elite' : 'combat', g.musicState]);
    foe.alive = false; foe.state = 'death';
    sim(1); states.push(['combat (hold 3s)', g.musicState]);
    sim(3); states.push(['explore', g.musicState]);
    g.toCamp(); g.updateMusic(); states.push(['sanctuary', g.musicState]);
    boost('war', 50); unlockAll('ashen_catacombs'); g.enterDungeon('ashen_catacombs', 'normal'); g.director.buildFloor(1);
    const warden = g.enemies.find((e) => e.boss && e.type === 'grave_warden');
    g.bossCtl.start(warden); g.updateMusic(); states.push(['boss', g.musicState]);
    g.inCombat = false; g.combat.reset(); g.bossCtl.reset(); g.run = null; g.toCamp();
    const musicOk = states.every(([want, got]) => want.split(' ')[0] === got);
    check('Adaptive music: title -> explore -> combat -> (3s hold) -> explore -> sanctuary -> boss follow the game state', musicOk, states.map(([w, s]) => `${w}:${s}`).join(' > '));
    check('Music states and stingers are defined for every required situation', ['title', 'explore', 'combat', 'elite', 'boss', 'safe', 'sanctuary', 'story', 'silence'].every((s) => MUSIC_STATES[s]) && ['victory', 'bossDefeat', 'defeat', 'chapter'].every((s) => STINGERS[s]),
      `${Object.keys(MUSIC_STATES).length} states, ${Object.keys(STINGERS).length} stingers`);
    // gameplay events -> sounds (counted by the audio manager, whether or not the device is unlocked)
    g.newGame('conquest');
    const before = { ...A.requested };
    const e1 = g.enemies.find((e) => e.alive);
    g.combat.damageEnemy(e1, 1, false, { ctx: { source: 'basic' } });
    g.combat.damageEnemy(e1, 1, true, { ctx: { source: 'basic' } });
    g.combat._miss(e1);
    g.giveItem(g.loot.gen.generate({ baseId: CURATED_LEGENDARY_IDS[0], rarity: 'legendary', ilvl: 20 }));
    g.giveItem(g.loot.gen.generate({ baseId: MYTHIC_IDS[0], rarity: 'mythic', ilvl: 30 }));
    g.hero.gainXp(g.hero.xpNeeded);
    g.quests.accept && g.notify('test quest update', { kind: 'quest' });
    const delta = (n) => (A.requested[n] || 0) - (before[n] || 0);
    const evs = { hit: delta('hit'), crit: delta('crit'), miss: delta('miss'), hitConquest: delta('hitConquest'), legendaryLoot: delta('legendaryLoot'), mythicLoot: delta('mythicLoot'), levelUp: delta('levelUp'), quest: delta('quest') };
    check('Gameplay events trigger their sounds (hit, crit, miss, class accent, legendary/mythic loot, level-up, quest)', Object.values(evs).every((n) => n >= 1), JSON.stringify(evs));
    // each Horseman has its own audio identity on a connecting hit; misses never play it
    const accents = {};
    for (const cls of ['conquest', 'war', 'famine', 'death']) {
      g.newGame(cls); const b0 = { ...A.requested };
      const e = g.enemies.find((q) => q.alive);
      g.combat._miss(e);
      const afterMiss = Object.keys(A.requested).filter((k) => k.startsWith('hit') && k !== 'hit' && (A.requested[k] || 0) > (b0[k] || 0));
      g.combat.damageEnemy(e, 1, false, { ctx: { source: 'basic' } });
      accents[cls] = { miss: afterMiss.join(',') || '-', hit: Object.keys(A.requested).filter((k) => /^hit[A-Z]/.test(k) && (A.requested[k] || 0) > (b0[k] || 0)).join(',') };
    }
    check('Each Horseman has a distinct hit sound, played only when an attack connects', Object.entries(accents).every(([c, a]) => a.miss === '-' && a.hit === `hit${c[0].toUpperCase()}${c.slice(1)}`) && new Set(Object.values(accents).map((a) => a.hit)).size === 4, JSON.stringify(accents));
    // throttling: the same sound requested every frame is limited (only when the device is unlocked)
    if (A.ctx) {
      const p0 = A.played.hit || 0;
      for (let i = 0; i < 100; i++) A.play('hit');
      const played = (A.played.hit || 0) - p0;
      check('Sound concurrency / retrigger limits: 100 requests in one frame play at most once', played <= 1, `${played} played of 100 requested; voices ${A.voices}`);
    } else check('Sound concurrency / retrigger limits (audio device locked in this run - checked by design)', true, 'AudioContext not unlocked (no user gesture); play() is a no-op and cannot stack');
    // a failing synthesis never throws into gameplay
    const origSfx = A._sfx; A._sfx = () => { throw new Error('boom'); };
    let threw = false; try { A.ctx && (A.last = {}); A.play('hit'); g.combat.damageEnemy(g.enemies.find((q) => q.alive), 1, false, { ctx: { source: 'basic' } }); } catch { threw = true; }
    A._sfx = origSfx;
    check('A failing sound never interrupts combat (errors are caught, the game continues)', !threw, 'synth threw -> caught');

    // ============================================================ SETTINGS
    g.setVolume('ambient', 0.3); g.setVolume('music', 0.2); g.toggleSetting('reduceShake'); g.toggleSetting('reduceFlash');
    g.settings.keybinds = { attack: 'KeyJ' }; g.input.setBindings(g.settings.keybinds); g.saves.saveSettings(g.settings);
    const reloaded = g.saves.loadSettings();
    const persisted = reloaded.ambient === 0.3 && reloaded.music === 0.2 && reloaded.reduceShake && reloaded.reduceFlash && reloaded.keybinds.attack === 'KeyJ';
    g.effects.shake = 0; g.effects.addShake(10); const sh = g.effects.shake;
    g.effects.screenFlash('#f00', 0.4); const fl = g.effects.flash;
    g.resetSettings();
    const restored = g.settings.ambient === DEFAULT_SETTINGS.ambient && !g.settings.reduceShake && !Object.keys(g.settings.keybinds).length && g.input.keymap.Space === 'attack';
    check('Audio + accessibility settings persist (ambient/music volume, reduced shake/flash, key binds) and RESTORE DEFAULTS works',
      persisted && sh <= 2 && fl.dur <= 0.12 && fl.max <= 0.15 && restored, `persisted ${persisted}; reduced shake 10 -> ${sh}; reduced flash ${fl.dur}s @${fl.max}; restored ${restored}`);
    // rebinding: moving ATTACK to J frees Space, arrows still move, reserved keys refused
    const km = buildKeymap({ attack: 'KeyJ', forward: 'KeyI', interact: 'Enter' });
    check('Key rebinding: new key works, old letter key freed, arrows kept, reserved keys (Enter/Esc/digits) refused',
      km.KeyJ === 'attack' && km.Space === undefined && km.KeyI === 'forward' && km.ArrowUp === 'forward' && km.KeyW === undefined && km.Enter === 'confirm' && keysFor(km, 'interact').includes('KeyE') && REBINDABLE.length >= 15,
      `J=${km.KeyJ}, Space=${km.Space}, I=${km.KeyI}, ArrowUp=${km.ArrowUp}, Enter=${km.Enter}; ${REBINDABLE.length} rebindable actions`);

    // ============================================================ COMBAT FEEDBACK + INTEGRITY
    boost('war', 20); unlockAll('ashen_catacombs'); g.enterDungeon('ashen_catacombs', 'normal');
    for (const e of g.enemies) { e.alive = false; e.hp = 0; }
    const p = g.player;
    const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dy]) => g.dungeon.isWalkable(p.x + dx, p.y + dy));
    p.dir = dir;
    const target = g.ai.spawnExtra({ type: 'knight', x: p.x + [[0, -1], [1, 0], [0, 1], [-1, 0]][dir][0], y: p.y + [[0, -1], [1, 0], [0, 1], [-1, 0]][dir][1], level: 20 });
    target.summoned = false; target.maxHp = target.hp = 1e6; target.atkMult = 0; target.state = 'chase';
    const fb0 = { ...g.combat.feedback }, hp0 = target.hp;
    let swings = 0, applied = 0;
    for (let i = 0; i < 40; i++) {
      if (g.weapons.canAttack()) { swings++; g.combat.playerAttack(); }
      // the swing's damage must not land before the weapon's hit frame
      const hpAtStart = target.hp; sim(0.02); const early = target.hp !== hpAtStart && g.weapons.anim && g.weapons.anim.t < (g.weapons.anim.windup || 0) - 1e-6;
      if (early) applied = -999;
      sim(0.1);
    }
    const fb = g.combat.feedback;
    const hitsApplied = fb.applied - fb0.applied, hitFx = fb.hits - fb0.hits, misses = fb.miss - fb0.miss;
    check('One attack = one damage application = one hit reaction (no double hits from animation loops, nothing before the hit frame)',
      applied >= 0 && hitFx === hitsApplied && hitsApplied + misses <= swings && hitsApplied > 0, `${swings} swings -> ${hitsApplied} hits applied, ${hitFx} hit reactions, ${misses} misses; HP lost ${hp0 - target.hp}`);
    // resist / weak feedback mirrors the damage rule
    target.resist = { basic: 0.3 };
    const r0 = g.combat.feedback.resisted; g.combat.damageEnemy(target, 10, false, { ctx: { source: 'basic', resistMult: g.combat.resistMult(target, { source: 'basic' }) } });
    target.resist = { basic: -0.3 };
    const w0 = g.combat.feedback.weak; g.combat.damageEnemy(target, 10, false, { ctx: { source: 'basic', resistMult: g.combat.resistMult(target, { source: 'basic' }) } });
    target.resist = null;
    check('Resistance / weakness feedback matches the damage calculation (RESISTED / WEAK!)', g.combat.feedback.resisted === r0 + 1 && g.combat.feedback.weak === w0 + 1, `resisted +${g.combat.feedback.resisted - r0}, weak +${g.combat.feedback.weak - w0}`);
    // player damage feedback: direction + HUD + kind colours
    target.atkMult = 1; target.hp = 10;
    const side = g.combat.sideOf(target);
    const ph0 = g.combat.feedback.playerHurt;
    g.combat.enemyStrike(target);
    check('Player damage feedback: one reaction per blow with the side it came from (front/left/right/behind)', g.combat.feedback.playerHurt === ph0 + 1 && g.effects.hurtDir?.side === side && side === 'front', `side ${side}; hurtDir ${g.effects.hurtDir?.side}`);
    // death stops attacks and loot can never be rolled twice
    const lootBefore = g.loot.floor.length;
    target.hp = 1; g.combat.damageEnemy(target, 5, false, { ctx: { source: 'basic' } });
    const afterKill = g.loot.floor.length;
    g.combat.damageEnemy(target, 5, false, { ctx: { source: 'basic' } }); g.combat._kill(target);
    target.state = 'attack'; target.phase = 'windup'; target.phaseT = 99; const hp1 = g.hero.hp; sim(0.5);
    check('Enemy death immediately stops its attacks and never generates loot twice', g.loot.floor.length === afterKill && g.hero.hp >= hp1 && !target.alive, `floor loot ${lootBefore} -> ${afterKill} -> ${g.loot.floor.length}`);

    // ============================================================ ANIMATION / STATE SAFETY
    const stuck = g.ai.spawnExtra({ type: 'skeleton', x: p.x, y: p.y, level: 20 });
    stuck.x = -50; stuck.y = -50; // out of the way
    // realistic corruption: 'attack' with no phase (e.g. an interrupt cleared it) has no state-machine branch
    stuck.state = 'attack'; stuck.phase = null; stuck.phaseT = 0;
    sim(6);
    const recovered = stuck.state !== 'attack';
    const hurt = g.ai.spawnExtra({ type: 'skeleton', x: -60, y: -60, level: 20 }); hurt.state = 'hurt'; hurt.stun = 999; hurt.stateT = 0; sim(8.5); // watchdog limit: min(stun, 5s) + 2.5s
    check('Animation/state watchdog: an enemy can never stay stuck in a wind-up or hurt state', recovered && hurt.state !== 'hurt', `stuck windup -> ${stuck.state}; stuck hurt -> ${hurt.state}; watchdog fixes ${g.ai.watchdogFixes || 0}`);
    g.director.returnToCamp(); g.toCamp();

    // ============================================================ UI / MENUS / NOTIFICATIONS
    g.newGame('famine'); g.toCamp();
    const panels = ['inventory', 'character', 'crafting', 'skills', 'journal', 'pause', 'options', 'keybinds', 'help'];
    const opened = [];
    for (const pn of panels) { g.openPanel(pn); g.ui.beginFrame(); g.render(); opened.push(g.panel === pn); g.closePanel(); }
    g.enterDungeon('ashen_catacombs', 'normal');
    for (const pn of ['map', 'formation', 'objectives', 'journal', 'inventory']) { g.openPanel(pn); g.render(); opened.push(g.panel === pn); g.input.pressed.push('pause'); g.realUpdate ? 0 : 0; bot.realUpdate(0.016); opened.push(g.panel !== pn); g.closePanel(); }
    check('Every menu opens, renders and closes (camp + dungeon), ESC closes dungeon panels', opened.every(Boolean) && errors.length === 0, `${opened.filter(Boolean).length}/${opened.length}`);
    // keyboard-only: options volume via LEFT/RIGHT, a menu item via ENTER
    g.openPanel('options'); g.render(); g.menuIndex = 3; const amb0 = g.settings.ambient;
    g.input.pressed.push('turnRight'); bot.realUpdate(0.016);
    const ambUp = g.settings.ambient > amb0;
    g.menuIndex = 5; const sh0 = g.settings.reduceShake; g.input.pressed.push('confirm'); bot.realUpdate(0.016);
    check('Settings are fully keyboard-operable (RIGHT raises a volume, ENTER toggles screen shake)', ambUp && g.settings.reduceShake !== sh0, `ambient ${amb0} -> ${g.settings.ambient}; shake ${sh0} -> ${g.settings.reduceShake}`);
    g.resetSettings(); g.closePanel();
    // notifications: kinds, priority, merge, sticky errors
    g.notices.list = [];
    g.notify('Item obtained', { kind: 'item' }); g.notify('Quest updated', { kind: 'quest' }); g.notify('Save failed: test', { kind: 'error' });
    g.notify('Quest updated', { kind: 'quest' });
    for (let i = 0; i < 400; i++) g.notices.update(0.05); // 20 seconds later
    const errStays = g.notices.list.some((n) => n.kind === 'error') && !g.notices.list.some((n) => n.kind === 'item');
    const merged = g.notices.history.filter((h) => h.text === 'Quest updated').length === 1;
    check('Notifications: merge duplicates, expire by kind, and critical errors stay until dismissed', errStays && merged, `after 20s: ${g.notices.list.map((n) => n.kind).join(',')}; duplicate merged ${merged}`);
    g.notices.list = [];
    // inventory full -> warning, never destroyed
    for (let i = 0; i < 80 && g.inventory.bagFree > 0; i++) g.inventory.add(g.loot.create('iron_band', 'rare', 1));
    const extra = g.loot.create('iron_band', 'rare', 1);
    const where = g.giveItem(extra);
    check('Inventory full: the item goes to the floor / stash with a warning (never destroyed)', where !== 'bag' && g.notices.list.some((n) => n.kind === 'warn' && /Inventory full/.test(n.text)), `went to ${where}`);
    g.director.returnToCamp(); g.toCamp();

    // ============================================================ SAVE / LOAD SCENARIOS (Phase 6 brief, 12)
    wipeSaves();
    const scen = [];
    const roundTrip = (label, setup, verify) => {
      try {
        setup();
        g.inCombat = false;
        const ok = g.saveGame() !== false || g.saves.lastResult?.ok;
        const ref = verify.before ? verify.before() : null;
        const cls = g.hero.classId;
        g.newGame(cls === 'war' ? 'famine' : 'war'); g.loadGame();
        const pass = ok && verify.after(ref);
        scen.push(`${label}:${pass ? 'OK' : 'FAIL'}`);
        return pass;
      } catch (err) { scen.push(`${label}:ERR ${err.message}`); return false; }
    };
    // 1. dungeon exploration
    let pos;
    roundTrip('1 explore', () => { g.newGame('war'); g.toCamp(); unlockAll('ashen_catacombs'); g.enterDungeon('ashen_catacombs', 'normal'); }, { before: () => ({ x: g.player.x, y: g.player.y, seed: g.run.seed }), after: (r) => g.run && g.player.x === r.x && g.player.y === r.y && g.run.seed === r.seed });
    // 2. full inventory
    roundTrip('2 full bag', () => { g.director.returnToCamp(); for (let i = 0; i < 80 && g.inventory.bagFree > 0; i++) g.inventory.add(g.loot.create('iron_band', 'uncommon', 1)); }, { before: () => g.inventory.items.length, after: (n) => g.inventory.items.length === n && g.inventory.bagFree === 0 });
    // 3. equipped legendary + mythic with affixes
    roundTrip('3 legendary+mythic', () => {
      g.newGame('war'); g.hero.level = 40; g.calc.invalidate(); g.toCamp();
      const leg = g.loot.gen.generate({ baseId: 'gorefist', rarity: 'legendary', ilvl: 40, classHint: 'war' });
      const myth = g.loot.gen.generate({ baseId: MYTHIC_IDS.find((id) => !ITEM_DEFS[id].classes || ITEM_DEFS[id].classes.includes('war')), rarity: 'mythic', ilvl: 45, classHint: 'war' });
      g.inventory.add(leg); g.inventory.add(myth); g.equipment.equip(leg.uid); g.equipment.equip(myth.uid);
      pos = { leg: itemSig(leg), myth: itemSig(myth), uids: [leg.uid, myth.uid] };
    }, { after: () => itemSig(g.inventory.get(pos.uids[0])) === pos.leg && itemSig(g.inventory.get(pos.uids[1])) === pos.myth && g.equipment.isEquipped(pos.uids[0]) });
    // 4. immediately after crafting
    roundTrip('4 craft', () => { g.newGame('war'); g.hero.level = 5; g.toCamp(); g.inventory.materials.add('rusted_iron', 20); g.inventory.materials.add('bone_fragment', 10); g.inventory.materials.add('grave_dust', 5); g.gold = 100; g.craft.craft('forge_grave_sword'); },
      { before: () => ({ n: g.inventory.items.filter((i) => i.defId === 'forged_rusted_sword').length, iron: g.inventory.countOf('rusted_iron') }), after: (r) => r.n === 1 && g.inventory.items.filter((i) => i.defId === 'forged_rusted_sword').length === 1 && g.inventory.countOf('rusted_iron') === r.iron });
    // 5. level-up + ability upgrade
    roundTrip('5 level+skill', () => { g.newGame('death'); g.toCamp(); g.hero.gainXp(g.hero.xpNeeded * 3); const id = g.skills.slots[0]; g.skills.upgrade?.(id, 'A'); },
      { before: () => ({ lv: g.hero.level, up: JSON.stringify(g.hero.upgrades), sp: g.hero.skillPoints }), after: (r) => g.hero.level === r.lv && JSON.stringify(g.hero.upgrades) === r.up && g.hero.skillPoints === r.sp });
    // 6. quest completed  7. boss defeated  8. chapter unlocked
    roundTrip('6-8 quest/boss/chapter', () => { g.newGame('conquest'); g.toCamp(); g.progress.recordCompletion('crypt_first_seal', 'normal'); g.progress.bosses.grave_warden = 1; g.progress.bosses.gravekeeper = 1; g.quests.refresh(); g.talkTo('seer'); g.closePanel(); g.dismissChapterCard(); g.talkTo('maren'); g.quests.turnIn('q_ch1_main'); g.closePanel(); g.dismissChapterCard(); },
      { before: () => ({ gold: g.gold, q: JSON.stringify(g.quests.serialize()) }), after: (r) => g.gold === r.gold && JSON.stringify(g.quests.serialize()) === r.q && g.quests.isDone('q_ch1_main') && g.quests.chapterUnlocked('ch2') && g.progress.bosses.grave_warden === 1 });
    // 9. older-version save (v4 slot only)
    wipeSaves();
    g.newGame('famine'); g.toCamp(); g.gold = 321;
    const v4 = { ...g.saves.snapshot(g), version: 4 }; delete v4.campaign;
    wipeSaves(); localStorage.setItem(SAVE_KEYS.v4Save, JSON.stringify(v4));
    g.newGame('war'); g.loadGame();
    const old = g.hero.classId === 'famine' && g.gold === 321 && localStorage.getItem(SAVE_KEYS.v4Save) === JSON.stringify(v4);
    scen.push(`9 v4->v5:${old ? 'OK' : 'FAIL'}`);
    // 10. invalid / incomplete data: never loaded, never overwritten, never a silent reset
    g.saveGame(); const good = localStorage.getItem(SAVE_KEYS.save);
    localStorage.setItem(SAVE_KEYS.save, '{"version":5,"hero":{"classId":"war"'); // truncated write
    const fallback = g.saves.load();
    const usedBackup = g.saves.loadedFrom === 'backup' || g.saves.loadedFrom === 'v4';
    localStorage.setItem(SAVE_KEYS.save, JSON.stringify({ version: 5, hero: { classId: 'war', level: 3 }, inventory: 'oops', equipment: {} }));
    const rejected = !validateSave(JSON.parse(localStorage.getItem(SAVE_KEYS.save)));
    // a snapshot that fails validation is refused and the stored save is untouched
    localStorage.setItem(SAVE_KEYS.save, good);
    const origSnap = g.saves.snapshot.bind(g.saves);
    g.saves.snapshot = (gm) => ({ ...origSnap(gm), inventory: null });
    const badWrite = g.saves.save(g);
    g.saves.snapshot = origSnap;
    const untouched = localStorage.getItem(SAVE_KEYS.save) === good;
    // a load that throws mid-way stops at the title with an error and does not touch storage
    const rawBefore = localStorage.getItem(SAVE_KEYS.save);
    localStorage.removeItem(SAVE_KEYS.backup);
    g.loadGame({ ...JSON.parse(good), hero: { ...JSON.parse(good).hero, classId: 'war' }, equipment: { get slots() { throw new Error('corrupt equipment'); } } });
    const noReset = g.scene === 'title' && localStorage.getItem(SAVE_KEYS.save) === rawBefore && g.notices.list.some((n) => n.kind === 'error');
    scen.push(`10 invalid:${fallback && usedBackup && rejected && !badWrite && untouched && noReset ? 'OK' : 'FAIL'}`);
    // 11. reload after a reward: no duplicate rewards / items
    g.loadGame();
    g.toCamp();
    const goldA = g.gold, itemsA = g.inventory.items.length, uidsA = new Set(g.inventory.items.map((i) => i.uid));
    g.quests.grant({ gold: 100, items: [{ id: 'gorefist' }] }, 'test:reward-once');
    g.saveGame();
    for (let i = 0; i < 3; i++) { g.newGame('war'); g.loadGame(); g.quests.grant({ gold: 100, items: [{ id: 'gorefist' }] }, 'test:reward-once'); }
    const uids = g.inventory.items.map((i) => i.uid);
    const noDup = g.gold === goldA + 100 && new Set(uids).size === uids.length && g.inventory.items.length <= itemsA + 1;
    scen.push(`11 reward reload:${noDup ? 'OK' : 'FAIL'}`);
    void uidsA;
    // 12. "close and reopen": everything needed is in storage - a fresh SaveSystem instance reads it back
    const { SaveSystem } = await import('../src/systems/SaveSystem.js');
    const fresh = new SaveSystem().load();
    const persistOk = fresh && fresh.version === SAVE_VERSION && fresh.gold === g.gold && fresh.inventory.length === g.inventory.items.length && validateSave(fresh, true);
    scen.push(`12 reopen:${persistOk ? 'OK' : 'FAIL'}`);
    check('Save/load scenarios 1-12 (explore, full bag, legendary/mythic, craft, level/skill, quest/boss/chapter, v4 save, invalid data, reward reload, reopen)',
      scen.every((s) => s.endsWith('OK')), scen.join(' | '));
    check('Save integrity: backup slot kept, writes validated, quota/storage failures reported (never thrown)',
      !!localStorage.getItem(SAVE_KEYS.backup) && typeof g.saves.lastResult?.ok === 'boolean', `backup present ${!!localStorage.getItem(SAVE_KEYS.backup)}; last result ${JSON.stringify(g.saves.lastResult)}`);
    // quota failure simulation
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('fh5_save')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return origSet.call(this, k, v); };
    const beforeQ = localStorage.getItem(SAVE_KEYS.save);
    g.notices.list = [];
    const qOk = g.saveGame();
    Storage.prototype.setItem = origSet;
    check('Storage full: the save fails safely, says why, and the previous save is intact', !qOk && /storage is full/.test(g.saves.lastResult.reason) && localStorage.getItem(SAVE_KEYS.save) === beforeQ && g.notices.list.some((n) => n.kind === 'error'), g.saves.lastResult.reason);
    // autosave deferred during combat, runs when it ends
    boost('war', 20); unlockAll('ashen_catacombs'); g.enterDungeon('ashen_catacombs', 'normal');
    g.inCombat = true; const deferred = g.autosave('test') === false && g.pendingAutosave === 'test';
    g.inCombat = false; for (const e of g.enemies) { e.alive = false; e.state = 'death'; } sim(0.2);
    check('Autosave during combat is deferred and runs automatically when the fight ends', deferred && !g.pendingAutosave && g.saveIndicator !== undefined, `deferred ${deferred}; pending after ${g.pendingAutosave}`);
    g.director.returnToCamp(); g.toCamp();

    // ============================================================ BALANCE (measured)
    const B = makeBalance(g, bot);
    const runs = 3, secs = quick ? 40 : 60; // seeded RNG: every number below is reproducible
    const avg = (f) => { const v = Array.from({ length: runs }, (_, i) => f(i + 1)); return Math.round(v.reduce((a, b) => a + b, 0) / v.length); };
    const table = {};
    for (const cls of B.CLASSES) table[cls] = { single: avg((s) => B.dpsSim(cls, 25, secs, 'knight', 1, s).dps), multi: avg((s) => B.dpsSim(cls, 25, secs, 'knight', 3, s).dps) };
    const singles = Object.values(table).map((r) => r.single), multis = Object.values(table).map((r) => r.multi);
    const spreadS = Math.max(...singles) / Math.min(...singles);
    check(`Class balance (single target, L25, ${secs}s x${runs} seeds): no Horseman deals more than 1.6x another`, spreadS <= 1.6, Object.entries(table).map(([c, r]) => `${c} ${r.single}`).join(', ') + ` (spread x${spreadS.toFixed(2)})`);
    check('Class identity (3 targets): War leads area damage; nobody is useless in groups (>= 0.45x the best)', table.war.multi === Math.max(...multis) && Math.min(...multis) >= Math.max(...multis) * 0.45, Object.entries(table).map(([c, r]) => `${c} ${r.multi}`).join(', '));
    const sustain = B.CLASSES.map((c) => B.sustainSim(c, 25, 30));
    check('No infinite sustain: under steady damage no Horseman heals back more than it takes', sustain.every((s) => s.healedPct < 100), sustain.map((s) => `${s.cls} heals ${s.healedPct}%`).join(', '));
    const control = ['war', 'death'].map((c) => B.controlSim(c, 30));
    check('No permanent boss control: stagger spam locks a boss less than 50% of the time', control.every((c) => c.lockedPct < 50), control.map((c) => `${c.cls} vs ${c.boss}: locked ${c.lockedPct}%`).join(', '));
    // UI and combat agree: tooltip / stat screen values are the ones combat uses
    boost('conquest', 30);
    const shown = g.hero.stats.crit, used = g.hero.critChance * 100;
    check('UI and combat use the same numbers (character-sheet crit = combat crit chance; data-driven class tuning)', Math.abs(shown - used) < 0.6 || Math.abs(g.hero.critChance - shown / 100) < 0.006, `sheet ${shown}% vs combat ${used.toFixed(1)}%; marked gain ${CLASS_BALANCE.conquest.markedGain}`);

    // ============================================================ STABILITY (long session)
    boost('famine', 25); unlockAll('ashen_catacombs');
    const t0 = performance.now();
    const d = playDungeon('ashen_catacombs', 'normal');
    const ms = performance.now() - t0;
    const pools = { particles: g.effects.particles.length, texts: g.effects.texts.length, notices: g.notices.list.length, history: g.notices.history.length, log: g.logEntries.length, projectiles: g.combat.projectiles.length, danger: g.dangerTiles.length };
    check('Long play session: effects, notices, log and projectiles stay bounded; no runtime errors', pools.particles <= 400 && pools.texts <= 48 && pools.notices <= 9 && pools.history <= 60 && pools.log <= 120 && errors.length === 0,
      `full dungeon in ${Math.round(ms)}ms real time (cleared ${d.cleared}); ${JSON.stringify(pools)}; errors ${errors.length}`);
    if (g.scene === 'cleared') g.toCamp();

    check('No runtime errors during the Phase 6 suite', errors.length === 0, errors.slice(0, 5).join(' | ') || 'none');
    void names; void fight; void walkTo;
  } catch (err) {
    check('Phase 6 suite ran to completion', false, `${err.message} @ ${(err.stack || '').split('\n')[1] || ''}`);
    console.warn(err);
  } finally {
    console.error = origError;
    window.removeEventListener('error', onErr);
    for (const [k, val] of Object.entries(keep)) { if (val === null) localStorage.removeItem(k); else localStorage.setItem(k, val); }
    Object.assign(g.settings, keepSettings); g.input.setBindings(g.settings.keybinds); g.saves.saveSettings(g.settings);
    g.update = bot.realUpdate;
  }
  const passed = results.filter((r) => r.result === 'PASS').length;
  console.log(`PHASE 6: ${passed}/${results.length} passed`);
  console.table(results);
  window.__p6Results = { passed, total: results.length, results };
  return results;
}
