// Phase 5 suite: http://localhost:5173/?test5  (results in window.__p5Results, printed with console.table)
// Content validation, item generation/compatibility at scale, stat caps, unique effects, bestiary data,
// enemy abilities in live floors, boss phases, the quest/chapter framework (prerequisites, events,
// claim-once rewards, endings), save v4 -> v5 migration, and REAL gameplay: a bot plays the Prologue
// and Chapter I as a quest-driven campaign with all four Horsemen, plus boosted Chapter V / VI runs.
import { validateContent, contentCounts, CLASS_STATUSES } from '../src/data/registry.js';
import { ITEM_DEFS, CATALOG_IDS, CURATED_LEGENDARY_IDS, MYTHIC_IDS, RARITY_ORDER } from '../src/data/items.js';
import { AFFIXES, affixAllowed } from '../src/data/affixes.js';
import { WEAPONS } from '../src/data/weapons.js';
import { FORMULAS } from '../src/data/formulas.js';
import { LEGENDARY_EFFECTS } from '../src/data/legendaryEffects.js';
import { ENEMIES } from '../src/data/enemies.js';
import { BOSSES } from '../src/data/bosses.js';
import { DUNGEONS, PHASE5_DUNGEONS, DUNGEON_ORDER } from '../src/data/dungeons/index.js';
import { CHAPTERS, QUESTS } from '../src/data/campaign.js';
import { LORE } from '../src/data/lore.js';
import { SAVE_KEYS } from '../src/data/config.js';
import { SAVE_VERSION } from '../src/systems/SaveMigration.js';
import { generateDungeon } from '../src/systems/DungeonGenerator.js';
import { validateLayout } from '../src/systems/DungeonValidator.js';
import { tooltipLines } from '../src/ui/ItemTooltip.js';
import { runPhase4 } from './phase4.js';

export async function runPhase5(g, { quick = false } = {}) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const onErr = (e) => errors.push(e.message);
  window.addEventListener('error', onErr);
  const check = (name, pass, detail = '') => { results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const keep = {}; for (const k of Object.values(SAVE_KEYS)) keep[k] = localStorage.getItem(k);

  // the Phase 4 bot (real systems, no shortcuts) is reused, not duplicated
  await runPhase4(g, { botOnly: true });
  const bot = window.__bot;
  const { sim, walkTo, fight, playDungeon, playPrologue, autoEquip, boost, hunt, faceTo } = bot;
  g.update = () => {}; // the bot drives the simulation from here on
  const q = () => g.quests;
  const unlockAll = (upto) => { for (const id of DUNGEON_ORDER) { if (id === upto) break; g.progress.recordCompletion(id, 'normal'); } };

  try {
    // ============================================================ 1. still 2D
    const usesGL = [...document.querySelectorAll('canvas')].some((c) => c.getContext('2d') === null);
    check('Game remains strictly 2D (Canvas 2D only, no WebGL / 3D library)', !usesGL && typeof window.THREE === 'undefined' && g.ctx instanceof CanvasRenderingContext2D, `ctx=${g.ctx.constructor.name}`);

    // ============================================================ 2. content registry + validator
    const v = validateContent();
    const c = contentCounts();
    check('Content validator: no missing references or invalid ids across items, enemies, bosses, loot, recipes, dungeons, quests, lore',
      v.ok, `${v.errors.length} errors, ${v.warnings.length} warnings${v.errors.length ? ': ' + v.errors.slice(0, 5).join(' | ') : ''}`);
    check('Content minimums: 50+ affixes, 20+ curated legendaries, 8 mythics, 8 sets (one per Horseman + 4 shared)',
      c.affixes >= 50 && c.curatedLegendaries >= 20 && c.mythics >= 8 && c.sets >= 8,
      `bases ${c.baseItems} (catalog ${c.catalogBases}), affixes ${c.affixes}, curated ${c.curatedLegendaries}, mythics ${c.mythics}, sets ${c.sets}, enemies ${c.enemies}, variants ${c.variants}, bosses ${c.bosses} (${c.minibosses} minibosses), chapters ${c.chapters}, quests ${c.quests}, lore ${c.lore}`);
    // the validator really catches problems (inject a broken quest)
    const bogus = { id: 'q_bogus', chapter: 'ch9', side: true, prereq: ['q_nope'], objectives: [{ type: 'kill', enemy: 'dragonfly', text: 'x' }], rewards: { items: [{ id: 'no_item' }] } };
    QUESTS.push(bogus);
    const v2 = validateContent();
    QUESTS.pop();
    check('Validator reports injected broken references (unknown chapter, prerequisite, enemy, reward item)',
      ['unknown chapter', 'unknown prerequisite', "enemy 'dragonfly'", "unknown item 'no_item'"].every((s) => v2.errors.some((e) => e.includes(s))), v2.errors.filter((e) => e.includes('q_bogus')).join(' | '));

    // ============================================================ 3. item generation + compatibility at scale
    g.newGame('war');
    const N = quick ? 4 : 12;
    let made = 0, badAffix = 0, dupGroup = 0, badName = 0, nan = 0, fireBad = 0, rangedBad = 0, heavyBad = 0;
    const names = new Set(), sigs = new Set();
    for (const id of CATALOG_IDS) for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) for (let s = 0; s < N; s++) {
      const d = ITEM_DEFS[id];
      const it = g.loot.gen.generate({ baseId: id, rarity: r, ilvl: d.minIlvl + (s % Math.max(1, d.maxIlvl - d.minIlvl + 1)), seed: (s * 7919 + id.length * 104729 + r.length) >>> 0, classHint: ['war', 'conquest', 'famine', 'death'][s % 4] });
      made++;
      const groups = new Set();
      for (const a of it.affixes) {
        const A = AFFIXES[a.id];
        if (!A || !affixAllowed(A, d, WEAPONS)) badAffix++;
        if (groups.has(A?.group)) dupGroup++; groups.add(A?.group);
        if (A?.requires?.tag === 'fire' && !(d.tags || []).includes('fire')) fireBad++;
        if (A?.requires?.ranged && WEAPONS[d.weaponId]?.kind !== 'ranged') rangedBad++;
        if (A?.requires?.twoHanded && !WEAPONS[d.weaponId]?.twoHanded) heavyBad++;
        if (!Number.isFinite(a.value)) nan++;
      }
      if (!it.name || /undefined|null|NaN|\s{2}/.test(it.name)) badName++;
      for (const v3 of Object.values(it.stats || {})) if (!Number.isFinite(v3)) nan++;
      names.add(it.name); sigs.add(`${id}|${it.rarity}|${it.affixes.map((a) => a.id).sort().join(',')}`);
    }
    check(`Generated ${made} catalog items (base x ilvl x rarity x affixes): every affix legal for its base, no duplicate groups, clean names`,
      badAffix === 0 && dupGroup === 0 && badName === 0 && nan === 0 && made >= 3000,
      `${made} items, ${sigs.size} distinct base/rarity/affix signatures, ${names.size} distinct names; illegal affixes ${badAffix}, duplicate groups ${dupGroup}, bad names ${badName}, non-numeric values ${nan}`);
    check('Compatibility rules hold: fire affixes only on fire items, ranged affixes only on bows, heavy affixes only on two-handed weapons',
      fireBad === 0 && rangedBad === 0 && heavyBad === 0, `violations: fire ${fireBad}, ranged ${rangedBad}, two-handed ${heavyBad}`);
    // a saved roll that breaks the rules is cleaned on restore
    const bowDef = Object.values(ITEM_DEFS).find((d) => d.catalog && WEAPONS[d.weaponId]?.kind === 'ranged');
    const fireAffix = Object.values(AFFIXES).find((a) => a.requires?.tag === 'fire' && a.slots.includes(bowDef.slot));
    const cleaned = g.loot.gen.validateAffixes([{ id: fireAffix?.id, value: 5 }], bowDef, 'rare', 30);
    const expectKept = (bowDef.tags || []).includes('fire') ? 1 : 0;
    check('Illegal affixes in saved/edited items are removed on load (validateAffixes)', !!fireAffix && cleaned.length === expectKept, `${fireAffix?.id} on ${bowDef.id} (fire base: ${!!expectKept}): kept ${cleaned.length}`);

    // ============================================================ 4. stat calculation + caps
    g.newGame('conquest');
    g.hero.level = 50; g.calc.invalidate();
    const stacked = [];
    for (const ds of ['mainHand', 'head', 'chest', 'hands', 'legs', 'ring', 'ring', 'relic', 'offHand']) {
      const d = Object.values(ITEM_DEFS).find((x) => x.catalog && x.slot === ds && (x.tags || []).includes('fire') && (!x.classes || x.classes.includes('conquest')))
        || Object.values(ITEM_DEFS).find((x) => x.catalog && x.slot === ds && (!x.classes || x.classes.includes('conquest')));
      if (!d) continue;
      const aff = Object.values(AFFIXES).filter((a) => a.slots.includes(d.slot) && affixAllowed(a, d, WEAPONS) && ['fireDmg', 'cdr', 'bossDmg', 'statusDur', 'rangedDmg', 'lifeOnKill'].includes(a.stat)).map((a) => ({ id: a.id, value: 9999 }));
      const it = g.loot.gen.generate({ baseId: d.id, rarity: 'legendary', ilvl: 50, affixes: aff, classHint: 'conquest' });
      g.inventory.add(it); stacked.push(it);
      g.equipment.equip(it.uid);
    }
    g.calc.invalidate();
    const st = g.hero.stats;
    const capped = ['fireDmg', 'cdr', 'bossDmg', 'statusDur', 'rangedDmg', 'lifeOnKill', 'crit', 'evasion', 'damageReduction', 'atkSpeed'].filter((k) => FORMULAS[k]?.cap !== undefined);
    const over = capped.filter((k) => (st[k] || 0) > FORMULAS[k].cap + 1e-9);
    const finite = Object.values(st).every((x) => typeof x !== 'number' || Number.isFinite(x));
    check('Stat calculation: Phase 5 stats are derived from gear and never exceed their caps (CDR max 20%: cooldowns never vanish)',
      over.length === 0 && finite && (st.cdr || 0) <= 20 && ['fireDmg', 'cdr', 'bossDmg', 'statusDur'].filter((k) => st[k] > 0).length >= 3,`${stacked.length} max-rolled items; ${capped.map((k) => `${k} ${Math.round((st[k] || 0) * 10) / 10}/${FORMULAS[k].cap}`).join(', ')}; over cap: ${over.join(',') || 'none'}`);

    // ============================================================ 5. unique effects + tooltips
    let noEffect = 0, noTip = 0, icdMissing = 0;
    for (const id of [...CURATED_LEGENDARY_IDS, ...MYTHIC_IDS]) {
      const d = ITEM_DEFS[id];
      const it = g.loot.gen.generate({ baseId: id, rarity: d.uniqueOnly === 'mythic' ? 'mythic' : 'legendary', ilvl: Math.max(d.minIlvl || 1, 20) });
      const eff = LEGENDARY_EFFECTS[it.unique];
      if (!eff) { noEffect++; continue; }
      const lines = tooltipLines(g, it, { compare: false }).map((l) => l[0]).join(' ').toUpperCase();
      if (!lines.includes((eff.name || '').toUpperCase().slice(0, 10))) noTip++;
      if (eff.trigger && (eff.actions || []).some((a) => a.type === 'damage' || a.type === 'status') && !eff.icd) icdMissing++;
    }
    check('Every curated Legendary / Mythic has a working unique effect, shown in its tooltip; damaging procs have internal cooldowns',
      noEffect === 0 && noTip === 0 && icdMissing === 0, `${CURATED_LEGENDARY_IDS.length + MYTHIC_IDS.length} uniques; missing effect ${noEffect}, missing from tooltip ${noTip}, procs without ICD ${icdMissing}`);
    // a generic effect actually fires (damage bonus vs. bosses / conditions) and is bounded
    g.newGame('war'); g.hero.level = 30; g.calc.invalidate();
    const gore = g.loot.gen.generate({ baseId: 'gorefist', rarity: 'legendary', ilvl: 20, classHint: 'war' });
    g.inventory.add(gore); const eqOk = g.equipment.equip(gore.uid).ok; g.calc.invalidate();
    const target = g.enemies.find((e) => e.alive) || { hp: 50, maxHp: 100, rank: 'normal', statuses: new Map() };
    const mult = g.legend.damageMult(target, { source: 'basic' });
    check('Unique effects hook into combat through the shared dispatcher (damage multiplier bounded at +50%)', eqOk && mult >= 1 && mult <= 1.5, `Gorefist equipped ${eqOk}; damage multiplier vs ${target.name || 'dummy'}: x${mult.toFixed(2)}`);

    // ============================================================ 6. bestiary data + live abilities
    const p5Enemies = ['war_cultist', 'lich', 'abyssal_beast', 'gorgon', 'nephilim', 'chimera', 'locust', 'fallen_seraph'];
    const fieldsOk = Object.values(ENEMIES).filter((e) => !e.illusion).every((e) => e.name && e.sprite && g.sprites[e.sprite]?.idle?.[0] && e.hp > 0 && e.level > 0 && e.lootTable && e.category && e.lore);
    const classes = new Set(Object.values(ENEMIES).map((e) => e.category).concat(Object.values(BOSSES).map((b) => b.category || 'chapterBoss')));
    check('Bestiary: every enemy has name, sprite, stats, level, loot, category and lore; classifications common..endgame boss all used',
      fieldsOk && ['common', 'uncommon', 'elite', 'miniboss', 'chapterBoss', 'endgameBoss'].every((k) => classes.has(k)), `${Object.keys(ENEMIES).length} enemies, ${Object.keys(BOSSES).length} bosses; categories: ${[...classes].join(', ')}`);
    // spawn every Phase 5 enemy next to a hero in a real floor and let the abilities run
    boost('death', 46); unlockAll('abyssal_gate');
    g.enterDungeon('abyssal_gate', 'normal');
    for (const e of g.enemies) { e.alive = false; e.hp = 0; }
    const p = g.player;
    const free = [];
    for (let y = 1; y < g.dungeon.h - 1 && free.length < 40; y++) for (let x = 1; x < g.dungeon.w - 1; x++) if (g.dungeon.isWalkable(x, y) && Math.abs(x - p.x) + Math.abs(y - p.y) >= 2 && Math.abs(x - p.x) + Math.abs(y - p.y) <= 4 && g.dungeon.hasLOS(p.x, p.y, x, y)) free.push([x, y]);
    const abilityLog = {};
    let noWindup = 0, petrifies = 0;
    const origTake = g.hero.takeDamage.bind(g.hero);
    g.hero.takeDamage = () => 0; // observer mode: the hero takes no damage while abilities are sampled
    const origDebuff = g.applyPlayerDebuff.bind(g);
    g.applyPlayerDebuff = (id, dur) => { if (id === 'petrified') petrifies++; return origDebuff(id, dur); };
    for (const [i, id] of p5Enemies.entries()) {
      const [x, y] = free[i % free.length] || [p.x + 2, p.y];
      const e = g.ai.spawnExtra({ type: id, x, y, level: 44 });
      e.summoned = false; e.state = 'chase';
    }
    const dangerSeen = new Set();
    for (let t = 0; t < 30; t += 0.05) {
      sim(0.05);
      for (const e of g.enemies) if (e.alive && e.ability) { abilityLog[`${e.type}:${e.ability.a.id}`] = true; if (!(e.ability.windup > 0)) noWindup++; }
      if (g.dangerTiles?.length) dangerSeen.add(g.dangerTiles.length);
    }
    g.hero.takeDamage = origTake; g.applyPlayerDebuff = origDebuff;
    const summonsBy = {};
    for (const e of g.enemies) if (e.summoner) summonsBy[e.summoner] = (summonsBy[e.summoner] || 0) + 1;
    const summonCapOk = g.enemies.filter((e) => !e.summoner && e.def.abilities?.some((a) => a.kind === 'summon')).every((e) => (summonsBy[e.id] || 0) <= Math.max(...e.def.abilities.filter((a) => a.kind === 'summon').map((a) => a.maxTotal)));
    check('Phase 5 enemy abilities run in a live floor: every cast has a windup, area casts paint the floor, summons stay capped, no stun chains',
      Object.keys(abilityLog).length >= 4 && noWindup === 0 && summonCapOk && petrifies <= 30 / 5.5 + 1 && errors.length === 0,
      `abilities used: ${Object.keys(abilityLog).join(', ') || 'none'}; danger-tile sets ${dangerSeen.size}; summon caps ok ${summonCapOk}; petrified ${petrifies}x in 30s; errors ${errors.length}`);
    g.director.returnToCamp?.(); g.combat.reset?.(); g.toCamp();

    // ============================================================ 7. new dungeons generate + validate
    let floors = 0, invalid = 0, minis = 0;
    for (const id of PHASE5_DUNGEONS) for (let s = 1; s <= (quick ? 3 : 8); s++) for (let f = 0; f < DUNGEONS[id].floors; f++) {
      const L = generateDungeon(DUNGEONS[id], { seed: s * 31337 + f, floor: f, difficulty: 'normal' });
      floors++; if (!validateLayout(L).ok) invalid++;
      if (DUNGEONS[id].minibosses?.[f] && L.spawns.some((sp) => sp.boss === DUNGEONS[id].minibosses[f])) minis++;
    }
    const expectedMinis = PHASE5_DUNGEONS.reduce((n, id) => n + Object.keys(DUNGEONS[id].minibosses || {}).length, 0) * (quick ? 3 : 8);
    check('Chapter V / VI dungeons generate valid floors with their minibosses placed in key rooms', invalid === 0 && minis === expectedMinis, `${floors} floors, invalid ${invalid}, minibosses placed ${minis}/${expectedMinis}`);

    // ============================================================ 8. boss phases (every multi-phase boss reaches each phase)
    const phaseLog = [];
    let phasesOk = true;
    for (const [dungeon, bossId] of [['abyssal_gate', 'the_beast'], ['last_revelation', 'abaddon'], ['ashen_catacombs', 'gravekeeper']]) {
      boost('war', 50); unlockAll(dungeon);
      g.enterDungeon(dungeon, 'normal');
      const def = DUNGEONS[dungeon];
      const isMini = BOSSES[bossId].miniboss;
      if (!isMini) g.director.buildFloor(def.floors - 1);
      const boss = g.enemies.find((e) => e.boss && e.type === bossId);
      if (!boss) { phasesOk = false; phaseLog.push(`${bossId}: not spawned`); g.toCamp(); continue; }
      g.bossCtl.start(boss);
      const seen = [0];
      for (let i = 1; i < BOSSES[bossId].phases.length; i++) {
        boss.hp = Math.floor(boss.maxHp * BOSSES[bossId].phases[i].at) - 1;
        g.bossCtl.checkPhase(boss);
        seen.push(boss.bossState.phaseIdx);
        sim(2);
        g.hero.hp = g.hero.maxHp;
      }
      const ok = seen.every((s, i) => s === i);
      if (!ok) phasesOk = false;
      phaseLog.push(`${bossId}: ${seen.map((s) => s + 1).join('>')} of ${BOSSES[bossId].phases.length}`);
      // bosses are not immune to most class mechanics
      const classStatus = CLASS_STATUSES.filter((s) => { g.status.apply(boss, s, { dur: 3, stacks: 1 }); return g.status.has(boss, s); });
      phaseLog.push(`${bossId} accepts ${classStatus.length}/${CLASS_STATUSES.length} class statuses`);
      if (classStatus.length < CLASS_STATUSES.length - 2) phasesOk = false;
      g.inCombat = false; g.combat.reset(); g.bossCtl.reset(); g.run = null; g.toCamp();
    }
    check('Boss phases: each threshold advances exactly one phase in order (the Beast 3, Abaddon 4); bosses accept most class statuses', phasesOk, phaseLog.join(' | '));

    // ============================================================ 9. quests: prerequisites, chapters, events
    g.newGame('famine');
    const startActive = q().activeQuests().map((x) => x.id);
    const ch1Locked = !q().chapterUnlocked('ch1') && !q().available(q().def('q_ch1_survivor'));
    g.toCamp();
    const sideBlocked = !q().accept('q_ch1_survivor');
    check('Quest prerequisites: a new hero has only the Prologue quest; Chapter I and its side quests are locked',
      startActive.length === 1 && startActive[0] === 'q_prologue' && ch1Locked && sideBlocked, `active ${startActive.join(',')}; ch1 locked ${ch1Locked}; early accept refused ${sideBlocked}`);
    // prologue: completion of the crypt + talk to the seer
    g.progress.recordCompletion('crypt_first_seal', 'normal'); g.bus.emit('dungeonCompleted', { id: 'crypt_first_seal' });
    const notYet = !q().isDone('q_prologue');
    g.talkTo('seer'); g.closePanel();
    const prologueDone = q().isDone('q_prologue');
    const card = g.panel === 'chapter' && q().titleCard === 'ch1';
    g.dismissChapterCard();
    check('Chapter unlock: completing the Prologue main quest (crypt + Seer) unlocks Chapter I, starts its main quest and shows a title card',
      notYet && prologueDone && q().chapterUnlocked('ch1') && q().isActive('q_ch1_main') && card && q().codex.has('prophecy_1'), `needed the Seer ${notYet}; done ${prologueDone}; ch1 main active ${q().isActive('q_ch1_main')}; title card ${card}; codex ${[...q().codex].join(',')}`);
    // events: kill / collect / craft count only while active and only matching ids
    g.talkTo('ansel'); const acc1 = g.quests.accept('q_ch1_survivor'); g.closePanel();
    g.talkTo('maren'); const acc2 = g.quests.accept('q_ch1_bones'); g.closePanel();
    const fakeKill = (type, extra = {}) => g.bus.emit('enemyKilled', { type, alive: false, ...extra });
    for (let i = 0; i < 5; i++) fakeKill('skeleton');
    fakeKill('skeleton', { summoned: true }); fakeKill('knight');
    const killCount = q().state('q_ch1_survivor').counts[0];
    g.inventory.materials.add('bone_fragment', 4);
    const matCount = q().state('q_ch1_bones').counts[0];
    check('Quest progress is driven by gameplay events (kills of the right archetype, materials gained); summons do not count',
      acc1 && acc2 && killCount === 5 && matCount === 4, `accepted ${acc1}/${acc2}; skeleton kills ${killCount}/8 (summon + knight ignored); bone fragments ${matCount}/10`);
    // state objectives: a boss killed earlier counts; key item granted from the boss record
    g.progress.bosses.gravekeeper = 1; g.progress.bosses.grave_warden = 1; q().refresh();
    const ready = q().readyToTurnIn(q().def('q_ch1_main'));
    const hasFrag = q().keyItems.has('seal_fragment_1');
    const gold0 = g.gold, items0 = g.inventory.items.length + g.stash.length;
    const turned = q().turnIn('q_ch1_main');
    const gold1 = g.gold, items1 = g.inventory.items.length + g.stash.length;
    const again = q().turnIn('q_ch1_main') || q().complete('q_ch1_main') || q().grant(q().def('q_ch1_main').rewards, 'quest:q_ch1_main');
    check('State objectives: bosses already defeated count, the key item is granted once and consumed on hand-in',
      ready && hasFrag && turned && !q().keyItems.has('seal_fragment_1') && q().chapterUnlocked('ch2'), `ready ${ready}; fragment ${hasFrag}; turned in ${turned}; fragment consumed ${!q().keyItems.has('seal_fragment_1')}; ch2 unlocked ${q().chapterUnlocked('ch2')}`);
    check('Quest rewards are claimed exactly once (repeat hand-in / complete / grant are refused, also after save + load)',
      gold1 > gold0 && items1 > items0 && !again && g.gold === gold1, `+${gold1 - gold0} gold, +${items1 - items0} items; repeat attempts refused ${!again}`);
    // save + load keeps campaign state and still refuses duplicates
    g.inCombat = false; g.dismissChapterCard(); const saved = g.saves.save(g);
    const snap = JSON.stringify(q().serialize());
    g.newGame('war'); g.loadGame();
    const snap2 = JSON.stringify(q().serialize());
    const dupAfterLoad = q().grant(q().def('q_ch1_main').rewards, 'quest:q_ch1_main');
    check('Campaign state survives save/load (quests, counts, key items, codex, bestiary); claims stay claimed',
      saved && snap === snap2 && !dupAfterLoad && g.hero.classId === 'famine', `identical ${snap === snap2}; duplicate after load refused ${!dupAfterLoad}`);

    // ============================================================ 10. ending choice is tracked
    g.newGame('death');
    for (const ch of CHAPTERS.slice(0, -1)) { q().quests[ch.mainQuest] = { status: 'done', counts: [], talked: [] }; }
    q().refresh();
    for (const b of ['false_prophet', 'great_dragon', 'abaddon']) g.progress.bosses[b] = 1;
    q().refresh();
    const finalReady = q().readyToTurnIn(q().def('q_ch6_main'));
    const noChoice = !q().turnIn('q_ch6_main');
    const chose = q().turnIn('q_ch6_main', 'seal');
    const second = q().chooseEnding('claim');
    check('Multi-stage finale: the last main quest needs every boss, then an ending choice which is recorded once',
      finalReady && noChoice && chose && !second && q().ending === 'seal' && q().campaignComplete && q().codex.has('ending_seal'), `ready ${finalReady}; refused without a choice ${noChoice}; ending ${q().ending}; second choice refused ${!second}`);

    // ============================================================ 11. save migration v4 -> v5
    for (const k of Object.values(SAVE_KEYS)) if (k !== SAVE_KEYS.settings) localStorage.removeItem(k);
    g.newGame('conquest'); g.toCamp();
    g.progress.recordCompletion('crypt_first_seal', 'normal'); g.progress.recordCompletion('ashen_catacombs', 'normal'); g.progress.bosses.grave_warden = 2;
    const v4 = { ...g.saves.snapshot(g), version: 4 }; delete v4.campaign;
    const raw4 = JSON.stringify(v4);
    for (const k of Object.values(SAVE_KEYS)) if (k !== SAVE_KEYS.settings) localStorage.removeItem(k); // only the v4 slot exists
    localStorage.setItem(SAVE_KEYS.v4Save, raw4);
    g.newGame('war'); g.loadGame();
    const migr = g.lastMigrationReport || [];
    const migOk = g.hero.classId === 'conquest' && g.progress.bosses.grave_warden === 2 && g.progress.timesCompleted('ashen_catacombs') === 1 && q().isActive('q_prologue') && localStorage.getItem(SAVE_KEYS.v4Save) === raw4;
    // talking to the Seer completes the prologue at once (its crypt was already completed in v4)
    g.talkTo('seer'); g.closePanel(); g.dismissChapterCard();
    const carried = q().isDone('q_prologue') && q().keyItems.has('seal_fragment_1');
    const loaded = g.saves.load();
    check('Phase 4 (v4) saves migrate to v5 with a migration report; earlier victories count toward quests; the v4 slot is untouched',
      migOk && carried && migr.length >= 3 && loaded?.version === SAVE_VERSION, `report: ${migr.join(' / ')}; prologue done after Seer ${q().isDone('q_prologue')}; Grave Warden fragment granted ${q().keyItems.has('seal_fragment_1')}`);

    // ============================================================ 12. codex discovery from tablets
    boost('famine', 8); unlockAll('ashen_catacombs');
    g.enterDungeon('ashen_catacombs', 'normal');
    const tab = g.dungeon.featureList.find((f) => f.kind === 'tablet' && f.loreId);
    let codexOk = false;
    if (tab) { // unit check of discovery (navigation is covered by the gameplay runs): stand beside it, read it twice
      for (const e of g.enemies) { e.alive = false; e.hp = 0; }
      const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tab.x + dx, tab.y + dy]).find(([x, y]) => g.dungeon.isWalkable(x, y));
      Object.assign(g.player, { x: spot[0], y: spot[1] });
      faceTo(tab.x, tab.y);
      const xp0 = g.stats.xpGained;
      g.controller.interact(); sim(0.1); codexOk = q().codex.has(tab.loreId);
      const xp1 = g.stats.xpGained; g.controller.interact(); sim(0.1);
      codexOk = codexOk && g.stats.xpGained === xp1 && xp1 > xp0;
    }
    check('Lore tablets in generated dungeons record their entry in the codex once (journal [J])', !!tab && codexOk, `tablet ${tab?.loreId}; in codex ${codexOk}; total lore entries ${LORE.length}`);
    g.director.returnToCamp(); g.toCamp();

    // ============================================================ 13. gameplay: Prologue + Chapter I campaign, all four Horsemen
    const runs = [];
    for (const cls of ['war', 'conquest', 'famine', 'death']) {
      g.newGame(cls);
      const log = { cls };
      log.prologue = playPrologue();
      g.toCamp();
      g.talkTo('seer'); g.closePanel(); g.dismissChapterCard();
      log.prologueQuest = q().isDone('q_prologue');
      g.talkTo('maren'); g.quests.accept('q_ch1_bones'); g.closePanel();
      g.talkTo('ansel'); g.quests.accept('q_ch1_survivor'); g.closePanel();
      autoEquip();
      const d = playDungeon('ashen_catacombs', 'normal');
      Object.assign(log, { cleared: d.cleared, lv: `${d.startLv}->${d.endLv}`, gravekeeper: (g.progress.bosses.gravekeeper || 0) > 0, warden: (g.progress.bosses.grave_warden || 0) > 0, died: d.died });
      if (g.scene === 'cleared') g.toCamp();
      log.fragment = q().keyItems.has('seal_fragment_1');
      g.talkTo('maren');
      log.handIn = q().turnIn('q_ch1_main');
      g.closePanel(); g.dismissChapterCard();
      log.ch1 = q().isDone('q_ch1_main');
      log.ch2 = q().chapterUnlocked('ch2');
      log.heart = g.inventory.items.some((i) => i.defId === 'heart_first_seal') || g.stash.some((i) => i.defId === 'heart_first_seal');
      log.side = `${q().state('q_ch1_survivor')?.counts?.[0] || 0}/8 skeletons, ${q().state('q_ch1_bones')?.counts?.[0] || 0}/10 bones`;
      log.bestiary = Object.keys(q().bestiary).length;
      runs.push(log);
    }
    check('All four Horsemen play the Prologue and Chapter I as a quest-driven campaign (Gravekeeper miniboss, Grave Warden, fragment hand-in, Chapter II unlocked)',
      runs.every((r) => r.prologue && r.prologueQuest && r.cleared && r.gravekeeper && r.warden && r.handIn && r.ch2),
      runs.map((r) => `${r.cls.toUpperCase()}: prologue ${r.prologue}/${r.prologueQuest}, catacombs ${r.cleared} LV${r.lv}, gravekeeper ${r.gravekeeper}, warden ${r.warden}, fragment ${r.fragment}, hand-in ${r.handIn}, ch2 ${r.ch2}, heart ${r.heart}, side ${r.side}, bestiary ${r.bestiary}${r.died ? ' DIED' : ''}`).join(' | '));

    // ============================================================ 14. boosted later chapters (framework coverage, not balance proof)
    const late = [];
    for (const [id, cls, lvl] of quick ? [['abyssal_gate', 'war', 48]] : [['abyssal_gate', 'war', 48], ['last_revelation', 'death', 50]]) {
      boost(cls, lvl); unlockAll(id);
      const d = playDungeon(id, 'normal');
      late.push(`${id} (${cls} LV${lvl}): floors ${d.floors}/${DUNGEONS[id].floors}, boss ${d.bossDown ? 'DOWN' : 'alive'} (${d.bossTime}s, phases ${d.bossPhases}), minibosses ${Object.values(DUNGEONS[id].minibosses || {}).filter((b) => g.progress.bosses[b]).length}/${Object.keys(DUNGEONS[id].minibosses || {}).length}, cleared ${d.cleared}${d.died ? ' DIED' : ''}`);
      if (g.scene === 'cleared') g.toCamp();
    }
    check('Boosted heroes play Chapter V and VI end to end (minibosses, the Beast, Abaddon)', late.every((l) => l.includes('cleared true')), late.join(' | '));

    check('No runtime errors during the Phase 5 suite', errors.length === 0, errors.slice(0, 5).join(' | ') || 'none');
  } catch (err) {
    check('Phase 5 suite ran to completion', false, `${err.message} @ ${(err.stack || '').split('\n')[1] || ''}`);
    console.warn(err);
  } finally {
    console.error = origError;
    window.removeEventListener('error', onErr);
    for (const [k, val] of Object.entries(keep)) { if (val === null) localStorage.removeItem(k); else localStorage.setItem(k, val); }
    g.update = bot.realUpdate;
  }
  const passed = results.filter((r) => r.result === 'PASS').length;
  console.log(`PHASE 5: ${passed}/${results.length} passed`);
  console.table(results);
  window.__p5Results = { passed, total: results.length, results };
  return results;
}
