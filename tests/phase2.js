// Phase 2 acceptance suite: http://localhost:5173/?test2
// 1) Data/kit checks for all four Horsemen.
// 2) Pipeline checks per class in a controlled encounter: cost, cooldown, invalid use,
//    damage / heal / buff / debuff application, unique mechanic, passive, safeguards.
// 3) Progression + upgrades + save/load persistence, Phase 1 save migration.
// 4) Stress: random skill spam can't produce negative resources, overheal or cooldown loops.
// 5) A full bot dungeon run per Horseman (reuses the Phase 1 harness, skills enabled).
import { HORSEMEN, CLASS_ORDER, RESOURCES } from '../src/data/characters.js';
import { SKILLS } from '../src/data/skills.js';
import { CLASS_BALANCE } from '../src/data/balance.js';
import { STATUSES } from '../src/data/statuses.js';
import { SAVE_KEYS } from '../src/data/config.js';
import { MECHANICS } from '../src/systems/HorsemanMechanics.js';
import { SAVE_VERSION } from '../src/systems/SaveMigration.js';
import { runAcceptance } from './acceptance.js';

const OPS = new Set(['damage', 'drain', 'status', 'buff', 'clear']);
const TARGETS = new Set(['front', 'focus', 'line', 'arc', 'encounter', 'self']);
const FIELDS = ['id', 'name', 'desc', 'cls', 'type', 'cost', 'cooldown', 'target', 'range', 'scaling', 'effects', 'upgrades', 'icon', 'fx', 'sfx'];

export async function runPhase2(g) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const check = (name, pass, detail = '') => results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) });

  const realUpdate = g.update.bind(g);
  g.update = () => {};
  const sim = (sec) => { for (let t = 0; t < sec - 1e-9; t += 0.05) { g.ui.beginFrame(); realUpdate(0.05); } };

  // Controlled encounter: player at (10,4) facing S; skeletons moved to (10,5) [front] and (10,7) [line].
  const setup = (cls, level = 4) => {
    g.newGame(cls);
    g.hero.level = level; // fixture: unlock the kit for this level
    g.hero.hp = g.hero.maxHp;
    g.dungeon.openTile(10, 5); g.dungeon.openTile(6, 3);
    Object.assign(g.player, { x: 10, y: 4, dir: 2 });
    const sk = g.enemies.filter((e) => e.room === 'combat');
    // sturdy training dummies so debuffs/lockouts are observable after the damage lands
    const place = (e, x, y) => Object.assign(e, { x, y, rx: x, ry: y, state: 'idle', stateT: 0, wait: 99, maxHp: 500, hp: 500 });
    place(sk[0], 10, 5); place(sk[1], 10, 7); place(sk[2], 12, 9);
    g.ai.update = () => {}; // enemies stand still during unit checks (instance override)
    return { front: sk[0], far: sk[1] };
  };
  const restoreAI = () => { delete g.ai.update; };

  try {
    // ============================================================ 1. data / kits
    const stats = CLASS_ORDER.map((c) => JSON.stringify(HORSEMEN[c].base));
    check('Four Horsemen with distinct base stats', new Set(stats).size === 4, CLASS_ORDER.map((c) => `${c}: HP${HORSEMEN[c].base.hp} ATK${HORSEMEN[c].base.atk} DEF${HORSEMEN[c].base.def} CRIT${HORSEMEN[c].base.crit}%`).join(' | '));
    check('Each class has its own resource (no shared mana)', new Set(CLASS_ORDER.map((c) => HORSEMEN[c].resource)).size === 4, CLASS_ORDER.map((c) => `${c}:${RESOURCES[HORSEMEN[c].resource].name} max ${RESOURCES[HORSEMEN[c].resource].max}`).join(' '));
    const kitIssues = [];
    for (const c of CLASS_ORDER) {
      const d = HORSEMEN[c];
      if (d.skills.length !== 4 || !d.ultimate || !d.passive?.name || !d.mechanic?.name) kitIssues.push(`${c}: kit incomplete`);
      if (!MECHANICS[c] || !Object.keys(MECHANICS[c]).length) kitIssues.push(`${c}: no mechanic hooks`);
      for (const id of [...d.skills, d.ultimate]) {
        const s = SKILLS[id];
        if (!s) { kitIssues.push(`${id} missing`); continue; }
        for (const f of FIELDS) if (s[f] === undefined) kitIssues.push(`${id}.${f} missing`);
        if (s.cls !== c) kitIssues.push(`${id} wrong class`);
        if (!TARGETS.has(s.target)) kitIssues.push(`${id} bad target`);
        for (const e of s.effects) { if (!OPS.has(e.op)) kitIssues.push(`${id} op ${e.op} not implemented`); if (e.status && !STATUSES[e.status]) kitIssues.push(`${id} status ${e.status} undefined`); }
        if (typeof g.fx[s.fx] !== 'function') kitIssues.push(`${id} fx ${s.fx} missing`);
        if (!s.upgrades.A || !s.upgrades.B) kitIssues.push(`${id} needs 2 upgrade choices`);
        if (!g.sprites.skillIcons[id]) kitIssues.push(`${id} icon missing`);
      }
      if (!SKILLS[d.ultimate].ultimate || !SKILLS[d.ultimate].consumeAll) kitIssues.push(`${c} ultimate not flagged`);
    }
    check('Each Horseman: 1 passive + 4 skills + 1 ultimate, all implemented (no placeholders)', !kitIssues.length, kitIssues.join('; ') || '20 skills: fields, ops, statuses, fx, icons, 2 upgrades each');

    // ============================================================ 2. pipeline per class
    for (const cls of CLASS_ORDER) {
      const N = HORSEMEN[cls].name;
      const { front, far } = setup(cls, 4);
      const r = g.resource;
      const slots = g.skills.slots;
      const notes = [];
      let costOk = true, cdOk = true, effOk = true;
      for (let i = 0; i < 5; i++) {
        const id = slots[i];
        const p = g.skills.params(id);
        // prerequisites for conditional skills
        if (p.requiresStatus) g.status.apply(front, p.requiresStatus, { dur: 10, stacks: 3 });
        g.skills.cooldowns.reset();
        r.value = r.max;
        front.hp = front.maxHp; far.hp = far.maxHp;
        const hpF = front.hp, hpFar = far.hp, heroHp0 = (g.hero.hp = Math.max(1, g.hero.maxHp - 40));
        const before = r.value;
        const ok = g.skills.use(id);
        const spent = before - r.value;
        const expectSpent = p.consumeAll ? before : p.cost;
        if (!ok || Math.abs(spent - expectSpent) > 1e-6) { costOk = false; notes.push(`${id}: used=${ok} spent ${spent} expected ${expectSpent}`); }
        // immediate re-use must be blocked by cooldown (and must not spend)
        const v2 = r.value;
        const again = g.skills.use(id);
        if (again || r.value !== v2) { cdOk = false; notes.push(`${id}: cooldown did not block`); }
        sim(0.8); // let projectiles / volleys land
        const dealt = (hpF - front.hp) + (hpFar - far.hp) + (front.alive ? 0 : 1) + (far.alive ? 0 : 1);
        const hasDmg = p.effects.some((e) => e.op === 'damage' || e.op === 'drain');
        const statusOp = p.effects.find((e) => e.op === 'status');
        const buffOp = p.effects.find((e) => e.op === 'buff');
        const drainOp = p.effects.find((e) => e.op === 'drain');
        if (hasDmg && dealt <= 0) { effOk = false; notes.push(`${id}: no damage`); }
        if (statusOp && !g.enemies.some((e) => e.statuses.has(statusOp.status)) && statusOp.status !== 'stagger') { effOk = false; notes.push(`${id}: ${statusOp.status} not applied`); }
        if (buffOp && !g.status.has('player', buffOp.status) && buffOp.status !== 'wraith') { effOk = false; notes.push(`${id}: buff missing`); }
        if (buffOp && buffOp.status === 'wraith' && !g.status.has('player', 'wraith') && g.time < 1.6) { effOk = false; }
        if (drainOp && g.hero.hp <= heroHp0) { effOk = false; notes.push(`${id}: no heal`); }
        // revive enemies for the next skill
        for (const e of [front, far]) { if (!e.alive) Object.assign(e, { alive: true, dying: false, hp: e.maxHp, state: 'idle' }); e.statuses.clear(); }
        g.status.reset();
      }
      check(`${N}: skills consume the correct resource`, costOk, notes.filter((n) => n.includes('spent')).join('; ') || `5/5 costs exact (${RESOURCES[HORSEMEN[cls].resource].name})`);
      check(`${N}: cooldowns block repeated activation`, cdOk, notes.filter((n) => n.includes('cooldown')).join('; ') || '5/5 blocked, no resource spent');
      check(`${N}: skill effects apply (damage / heal / buff / debuff)`, effOk, notes.filter((n) => !n.includes('spent') && !n.includes('cooldown')).join('; ') || 'all 5 effects observed');

      // invalid use: insufficient resource / dead hero / locked skill
      g.skills.cooldowns.reset();
      const costly = slots.find((id) => g.skills.params(id).cost > 0) || slots[4];
      r.value = 0;
      const lowOk = !g.skills.use(costly) && r.value === 0;
      g.hero.hp = 0; r.value = r.max;
      const deadOk = !g.skills.use(slots[0]);
      g.hero.hp = g.hero.maxHp;
      g.hero.level = 1;
      const lockedOk = !g.skills.use(slots[4]) && /unlocks at level/i.test(g.skills.lastFail?.reason || '');
      g.hero.level = 4;
      check(`${N}: invalid skill use is refused (no resource / dead / locked)`, lowOk && deadOk && lockedOk, `no-resource ${lowOk}, dead ${deadOk}, locked ${lockedOk}; reason shown: "${g.skills.lastFail?.reason}"`);
      restoreAI();
    }

    // ============================================================ 3. unique mechanics + passives
    {
      // CONQUEST — Mark of Dominion + Unbroken Will + empowered attack
      const { front } = setup('conquest', 2);
      const r = g.resource; r.value = 0;
      g.weapons.readyAt = {};
      g.combat.damageEnemy(front, 1, false, { ctx: { source: 'basic' } });
      const unmarked = r.value;
      g.status.apply(front, 'mark', { dur: 10 });
      g.combat.damageEnemy(front, 1, false, { ctx: { source: 'basic' } });
      const marked = r.value - unmarked;
      const critBonus = MECHANICS.conquest.critBonus(g, front);
      r.value = r.max;
      const ctx = { source: 'basic' };
      const mult = MECHANICS.conquest.outgoingMult(g, front, ctx);
      const markedTaken = g.status.dmgTakenMult(front);
      // Phase 6: values come from data/balance.js (marked gain tuned 15 -> 12; the empowered shot now spends Dominion)
      const CBq = CLASS_BALANCE.conquest;
      const spentOk = r.value === r.max - CBq.empoweredCost;
      check('CONQUEST mechanic: marks build Dominion, empower at max, +crit vs marked', unmarked === CBq.basicGain && marked === CBq.markedGain && critBonus === CBq.markCritBonus && mult === CBq.empoweredMult && ctx.empowered && spentOk && markedTaken === 1.25,
        `unmarked hit +${unmarked}, marked hit +${marked}, crit bonus ${critBonus}, empowered x${mult} (spent ${CBq.empoweredCost}: ${spentOk}), marked takes x${markedTaken}`);
      const other = g.enemies.find((e) => e.room === 'elite');
      g.status.apply(other, 'mark', { dur: 10 });
      check('CONQUEST: only one target can be Marked at a time', !g.status.has(front, 'mark') && g.status.has(other, 'mark'), 'marking a second foe clears the first');
      restoreAI();
    }
    {
      // WAR — Battle Fury + Blood and Iron (rate limited) + decay out of combat
      const { front } = setup('war', 2);
      const r = g.resource; r.value = 0;
      g.combat.damageEnemy(front, 1, false, { ctx: { source: 'basic' } });
      const onHit = r.value;
      r.value = 0;
      Object.assign(front, { state: 'attack', phase: 'strike' });
      g.combat.enemyStrike(front);
      const first = r.value;
      g.combat.enemyStrike(front); // same instant: rate limiter must block
      const second = r.value - first;
      sim(0.7);
      const before = r.value; g.combat.enemyStrike(front); const third = r.value - before;
      r.value = 80;
      const mult = MECHANICS.war.outgoingMult(g);
      g.combat.active = false;
      g.enemies.forEach((e) => { e.state = 'idle'; });
      Object.assign(g.player, { x: 2, y: 1 });
      g.resource.outOfCombatT = 0;
      for (let t = 0; t < 5; t += 0.05) g.resource.update(0.05, false);
      check('WAR mechanic: Fury from dealing + taking damage, rate-limited, decays out of combat', onHit === 8 && first === 16 && second === 0 && third === 16 && mult === 1.2 && g.resource.value < 80,
        `hit +${onHit}, hurt +${first} (10 +6 passive), instant repeat +${second}, after 0.7s +${third}, 80 Fury = x${mult} dmg, decayed to ${Math.round(g.resource.value)}`);
      restoreAI();
    }
    {
      // FAMINE — Withering cap + weakened damage + heal cap/budget + Nothing Is Wasted once
      const { front } = setup('famine', 4);
      for (let i = 0; i < 4; i++) g.status.apply(front, 'wither', { dur: 10, stacks: 2 });
      const stacks = g.status.stacks(front, 'wither');
      const atkMult = g.status.enemyAtkMult(front);
      g.hero.hp = 10;
      const cast = { healed: 0 };
      g.skills._drainHeal(front, 1000, { healFrac: 1, healCap: 18, bossHealMult: 0.5 }, cast);
      const capped = cast.healed;
      let total = capped;
      for (let k = 0; k < 6; k++) { const c = { healed: 0 }; g.skills._drainHeal(front, 1000, { healFrac: 1, healCap: 18 }, c); total += c.healed; }
      const r = g.resource; r.value = 0;
      MECHANICS.famine.onKill(g, front); MECHANICS.famine.onKill(g, front);
      check('FAMINE mechanic: Withering max 5 stacks, weakens foes, drain heal capped, passive once per foe', stacks === 5 && Math.abs(atkMult - 0.7) < 1e-9 && capped === 18 && total <= 60 && r.value === 15,
        `stacks ${stacks}/5, enemy dmg x${atkMult.toFixed(2)}, single drain healed ${capped} (cap 18), 7 drains healed ${total} (budget 60/20s), double kill event -> +${r.value} Plague`);
      // plague DoT refreshes instead of stacking
      g.status.apply(front, 'plague', { dur: 8, power: 3, perStack: 1.5 });
      g.status.apply(front, 'plague', { dur: 8, power: 3, perStack: 1.5 });
      check('FAMINE: Black Plague refreshes, never stacks', g.status.stacks(front, 'plague') === 1, `plague stacks ${g.status.stacks(front, 'plague')}`);
      restoreAI();
    }
    {
      // DEATH — Souls by rank, capped, never farmable; Soul Rend lockout; execute thresholds
      const { front } = setup('death', 4);
      const r = g.resource; r.value = 0;
      front.alive = false;
      MECHANICS.death.onKill(g, front); const normal = r.value;
      MECHANICS.death.onKill(g, front); const repeat = r.value - normal;
      const boss = g.enemies.find((e) => e.rank === 'boss');
      MECHANICS.death.onKill(g, boss); const bossGain = r.value - normal;
      r.value = 9; const elite = g.enemies.find((e) => e.rank === 'elite'); MECHANICS.death.onKill(g, elite);
      const capped = r.value;
      // execute: boss at 20% must NOT get the multiplier (boss threshold 15%), normal at 20% must
      const eff = g.skills.params('deaths_embrace').effects[0];
      const below = (e, frac) => frac < (e.rank === 'boss' ? eff.execute.bossThreshold : eff.execute.threshold);
      check('DEATH mechanic: Souls by rank (+1 passive), capped at 10, one payout per foe; boss execute threshold lower',
        normal === 2 && repeat === 0 && bossGain === 4 && capped === 10 && !below(boss, 0.2) && below(boss, 0.1) && below(front, 0.2),
        `normal kill +${normal}, repeat +${repeat}, boss +${bossGain}, cap ${capped}/10, boss@20% execute=${below(boss, 0.2)}, normal@20% execute=${below(front, 0.2)}`);
      // Soul Rend lockout
      front.alive = true; front.hp = front.maxHp; front.soulsClaimed = false; front.statuses.clear();
      g.status.apply(front, 'grave_mark', { dur: 30 });
      r.value = 0; g.skills.cooldowns.reset();
      g.skills.use('soul_rend'); sim(0.3);
      const g1 = r.value;
      g.skills.cooldowns.reset(); g.skills.use('soul_rend'); sim(0.3);
      check('DEATH: Soul Rend soul gain has a per-foe lockout', g1 === 1 && r.value === 1, `first rend +${g1}, immediate second rend +${r.value - g1}`);
      // Wraith Step evades and counters
      g.status.apply('player', 'wraith', { dur: 2, data: { dmg: [12, 18], scale: 0.8 } });
      Object.assign(front, { state: 'attack', phase: 'strike' });
      const hp0 = g.hero.hp, ehp = front.hp;
      g.combat.enemyStrike(front);
      check('DEATH: Wraith Step evades the blow and counterattacks', g.hero.hp === hp0 && front.hp < ehp && !g.status.has('player', 'wraith'), `hero HP ${hp0} -> ${g.hero.hp}, enemy HP ${ehp} -> ${front.hp}`);
      restoreAI();
    }
    {
      // Control safeguards: rank-scaled stun + stun immunity (no lock loops); boss per-hit cap
      setup('war', 4);
      const boss = g.enemies.find((e) => e.rank === 'boss');
      const r1 = g.status.apply(boss, 'stagger', { dur: 1.2 });
      const dur = g.status.get(boss, 'stagger').dur;
      const r2 = g.status.apply(boss, 'stagger', { dur: 1.2 });
      const res = g.combat.finalizeDamage(boss, 99999, { source: 'skill', critChance: 0 });
      check('Safeguards: control shortened on bosses, stun immunity, boss per-hit damage cap', r1.applied && Math.abs(dur - 0.42) < 1e-6 && !r2.applied && res.dmg <= Math.ceil(boss.maxHp * 0.3),
        `boss stagger ${dur.toFixed(2)}s (x0.35), re-stun ${r2.reason}, 99999 raw -> ${res.dmg} (cap ${Math.ceil(boss.maxHp * 0.3)})`);
      restoreAI();
    }

    // ============================================================ 4. progression, upgrades, save, migration
    {
      g.newGame('conquest');
      g.hero.gainXp(40 + 95);
      const lvl = g.hero.level, pts = g.hero.skillPoints;
      const cdBefore = g.skills.params('piercing_judgment').cooldown;
      const okA = g.skills.upgrade('piercing_judgment', 'A');
      const dupB = g.skills.upgrade('piercing_judgment', 'B');
      const cdAfter = g.skills.params('piercing_judgment').cooldown;
      const noPoints = (g.hero.skillPoints = 0, g.skills.upgrade('mark_of_crown', 'A'));
      g.hero.skillPoints = 1;
      check('Level-up grants skill points; upgrades apply, are exclusive and never duplicate', lvl === 3 && pts === 2 && okA && !dupB && cdAfter === cdBefore + 2 && !noPoints,
        `level ${lvl}, points ${pts}, Heavy Judgment cd ${cdBefore}s -> ${cdAfter}s, second choice refused ${!dupB}, no-points refused ${!noPoints}`);
      g.resource.value = 0; // Dominion is non-persistent: reloads at its start value
      g.saves.save(g);
      g.newGame('war');
      g.loadGame();
      check('Character selection + level + upgrades + skill points persist in saves', g.hero.classId === 'conquest' && g.hero.level === 3 && g.hero.upgrades.piercing_judgment === 'A' && g.hero.skillPoints === 1 && g.resource.def.id === 'dominion',
        `loaded ${g.hero.classId} LV${g.hero.level}, upgrades ${JSON.stringify(g.hero.upgrades)}, points ${g.hero.skillPoints}, resource ${g.resource.def.name} ${g.resource.value}`);
      g.newGame('death'); g.resource.value = 7; g.saves.save(g); g.newGame('war'); g.loadGame();
      check('Persistent resources survive save/load (Souls)', g.hero.classId === 'death' && g.resource.value === 7, `souls after load: ${g.resource.value}`);
      g.saves.clear();

      // Phase 1 (v1) save migration
      const v1 = { version: 1, hero: { charId: 'war', level: 3, xp: 12, totalXp: 300, stats: { str: 8, dex: 6, vit: 7, lck: 3 }, hp: 50, mp: 20 }, player: { x: 4, y: 2, dir: 1 },
        inventory: [{ uid: 900, defId: 'rusted_sword', rarity: 'common', qty: 1 }], equipment: { slots: { mainHand: 900 }, weaponSlots: [900, null, null, null], active: 0 },
        dungeon: null, enemies: [], loot: { nextUid: 901, floor: [] }, stats: { kills: 3, xpGained: 300, itemsCollected: [], secrets: 0, damageTaken: 10, playTime: 60 }, formation: ['war', 'famine', null, 'pestilence', 'death', null] };
      const prevV1 = localStorage.getItem(SAVE_KEYS.legacySave);
      const prevV2 = localStorage.getItem(SAVE_KEYS.v2Save); // Phase 3+: newer slots are read first
      const prevV3 = SAVE_KEYS.v3Save ? localStorage.getItem(SAVE_KEYS.v3Save) : null; // Phase 4: the v3 slot too
      localStorage.removeItem(SAVE_KEYS.v2Save);
      if (SAVE_KEYS.v3Save) localStorage.removeItem(SAVE_KEYS.v3Save);
      if (SAVE_KEYS.saveTmp) localStorage.removeItem(SAVE_KEYS.saveTmp);
      g.dungeon.reset();
      v1.dungeon = g.dungeon.serialize();
      const raw = JSON.stringify(v1);
      localStorage.setItem(SAVE_KEYS.legacySave, raw);
      localStorage.removeItem(SAVE_KEYS.save);
      const legacyFlag = g.saves.isLegacy();
      g.loadGame();
      const ok = g.hero.classId === 'war' && g.hero.level === 3 && g.hero.skillPoints === 2 && g.inventory.items[0]?.defId === 'rusted_sword' && g.player.x === 4;
      const untouched = localStorage.getItem(SAVE_KEYS.legacySave) === raw;
      g.saves.save(g);
      const untouched2 = localStorage.getItem(SAVE_KEYS.legacySave) === raw;
      check('Phase 1 save migrates safely (v1 -> v2) and the v1 slot is never overwritten', legacyFlag && ok && untouched && untouched2,
        `detected legacy ${legacyFlag}; loaded WAR LV${g.hero.level} with ${g.hero.skillPoints} refunded points; v1 untouched after load ${untouched} and after save ${untouched2}`);
      localStorage.setItem(SAVE_KEYS.save, '{"version":99}');
      const future = g.saves.load();
      check('Unknown/corrupt save versions are refused instead of corrupting the game', !future || future.version === SAVE_VERSION, future ? `v99 refused; fell back to an older slot (migrated to v${future.version})` : 'refused');
      if (prevV1 === null) localStorage.removeItem(SAVE_KEYS.legacySave); else localStorage.setItem(SAVE_KEYS.legacySave, prevV1);
      if (prevV2 !== null) localStorage.setItem(SAVE_KEYS.v2Save, prevV2);
      if (prevV3 !== null) localStorage.setItem(SAVE_KEYS.v3Save, prevV3);
      g.saves.clear();
    }

    // ============================================================ 5. stress: spam every skill in a live fight
    for (const cls of CLASS_ORDER) {
      g.newGame(cls);
      g.hero.gainXp(1000);
      Object.assign(g.player, { x: 10, y: 6, dir: 2 }); g.dungeon.openTile(10, 5);
      let minR = Infinity, maxR = -Infinity, overheal = false, cdJump = false;
      const lastCd = {};
      let healed0 = g.stats.healed || 0, window0 = g.time, maxWindowHeal = 0;
      for (let t = 0; t < 40; t += 0.05) {
        const i = Math.floor(Math.random() * 5);
        g.skills.use(g.skills.slots[i]);
        if (Math.random() < 0.3 && g.weapons.canAttack()) g.combat.playerAttack();
        g.ui.beginFrame(); realUpdate(0.05);
        if (!g.hero.alive || g.scene !== 'playing') { g.hero.hp = g.hero.maxHp; g.scene = 'playing'; }
        minR = Math.min(minR, g.resource.value); maxR = Math.max(maxR, g.resource.value);
        if (g.hero.hp > g.hero.maxHp) overheal = true;
        for (const id of g.skills.slots) { const rem = g.skills.cooldowns.remaining(id); if (lastCd[id] !== undefined && rem > 0 && lastCd[id] > 0 && rem < lastCd[id] - 0.051) cdJump = true; lastCd[id] = rem; }
        if (g.time - window0 >= 20) { maxWindowHeal = Math.max(maxWindowHeal, (g.stats.healed || 0) - healed0); healed0 = g.stats.healed || 0; window0 = g.time; }
        if (!g.enemies.some((e) => e.alive)) break;
      }
      const budget = HORSEMEN[cls].healBudget;
      check(`${HORSEMEN[cls].name}: stress - no negative/overflow resource, no overheal, no cooldown resets`, minR >= 0 && maxR <= g.resource.max && !overheal && !cdJump && (!budget || maxWindowHeal <= budget.max),
        `resource range ${Math.floor(minR)}..${Math.floor(maxR)}/${g.resource.max}, overheal ${overheal}, cd jumps ${cdJump}${budget ? `, max drain heal per 20s ${maxWindowHeal}/${budget.max}` : ''}, skills cast ${g.stats.skillsUsed}`);
    }

    // ============================================================ 6. UI / FX / audio smoke
    {
      g.newGame('famine'); g.hero.gainXp(1000);
      const front = g.enemies[0];
      g.status.apply(front, 'wither', { dur: 10, stacks: 3 }); g.status.apply(front, 'plague', { dur: 8, power: 3 });
      let fxOk = true;
      try {
        for (const s of Object.values(SKILLS)) { g.fx.play(s.fx, [front], g.skills.params(s.id)); g.audio.play(s.sfx); }
        g.fx.soulCollect(front); g.fx.drain(front);
        for (const n of ['resourceFull', 'resourceEmpty', 'deny', 'soulGain', 'selectConquest', 'selectWar', 'selectFamine', 'selectDeath']) g.audio.play(n);
        g.effects.update(0.1);
        g.render();
        g.openPanel('skills'); g.ui.beginFrame(); g.render();
        g.closePanel(); g.openSelect(); g.render(); g.toTitle();
      } catch (e) { fxOk = false; console.error(e); }
      check('Class FX, audio cues, skill bar, skill panel and selection screen render without errors', fxOk, `${Object.keys(SKILLS).length} skill FX + sounds played; overlays pooled (max ${g.effects.overlays.length})`);
    }
  } catch (err) {
    check('Phase 2 unit suite completed', false, err.stack || err.message);
  }
  g.update = realUpdate;
  console.error = origError;

  // ============================================================ 7. full dungeon run per Horseman
  const runs = {};
  for (const cls of CLASS_ORDER) {
    const r = await runAcceptance(g, { classId: cls, useSkills: true, standalone: false });
    runs[cls] = { passed: r.filter((x) => x.result === 'PASS').length, total: r.length, summary: r.summary };
    for (const x of r) if (x.result !== 'PASS' || /Cleared|skills were used|Knight/.test(x.test)) results.push(x);
  }
  check('Full dungeon run completes with all four Horsemen (Phase 1 checklist per class)', CLASS_ORDER.every((c) => runs[c].passed === runs[c].total),
    CLASS_ORDER.map((c) => `${c} ${runs[c].passed}/${runs[c].total} (LV${runs[c].summary?.level}, dmg taken ${runs[c].summary?.damageTaken}, skills ${runs[c].summary?.skillsUsed}, ${runs[c].summary?.time}s)`).join(' | '));
  check('No console errors during Phase 2 unit suite', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  g.toTitle();
  window.__p2Results = results;
  window.__p2Runs = runs;
  console.table(results);
  return results;
}
