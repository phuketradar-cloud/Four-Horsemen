// Phase 6 balance harness: repeatable, measurable combat simulations using the REAL game systems
// (skills, cooldowns, resources, mechanics, gear, resistances) driven by the shared Phase 4 bot.
//   dpsSim     sustained damage per second of each Horseman against a training dummy for N seconds
//              (resource generated / spent, casts, crits) - used to compare class output
//   sustainSim healing per second while taking steady damage (detects infinite sustain loops)
//   controlSim fraction of time a boss spends stunned/staggered under maximum control spam
//   matrix     every Horseman through every chapter dungeon at the recommended level (clear, time,
//              deaths, potions) - the "can every class finish the campaign" check
// Results are plain objects so the README / ?test6 can print them.
import { DUNGEONS, DUNGEON_ORDER } from '../src/data/dungeons/index.js';

const CLASSES = ['war', 'conquest', 'famine', 'death'];

export function makeBalance(g, bot) {
  const { sim, boost, playDungeon, playPrologue } = bot;
  const unlockAll = (upto) => { for (const id of DUNGEON_ORDER) { if (id === upto) break; g.progress.recordCompletion(id, 'normal'); } };

  // Clears the current floor of enemies and puts a dummy of `type`/`level` in front of the hero.
  const dummy = (type, level) => {
    for (const e of g.enemies) { e.alive = false; e.hp = 0; }
    const p = g.player, D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let dir = D.findIndex(([dx, dy]) => g.dungeon.isWalkable(p.x + dx, p.y + dy));
    if (dir < 0) dir = 0;
    p.dir = dir;
    const e = g.ai.spawnExtra({ type, x: p.x + D[dir][0], y: p.y + D[dir][1], level });
    e.summoned = false; e.state = 'chase'; e.maxHp = e.hp = 1e9; e.atkMult = 0;
    return e;
  };
  const act = () => {
    for (const i of [4, 0, 1, 2, 3]) { const id = g.skills.slots[i]; if (id && g.skills.canUse(id).ok) { g.skills.use(id); return 'skill'; } }
    if (g.weapons.canAttack()) { g.combat.playerAttack(); return 'basic'; }
    return null;
  };

  // targets > 1: extra dummies stand diagonally/beside the first one (area skills and cleaves can
  // reach them); dps counts damage dealt to ALL dummies.
  // Seeded Math.random for the duration of a sim (crits, procs, damage rolls) -> reproducible numbers.
  const seeded = (seed, fn) => {
    const orig = Math.random;
    let s = (seed * 2654435761) >>> 0 || 1;
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { Math.random = orig; }
  };

  function dpsSim(cls, level, secs = 30, enemy = 'knight', targets = 1, seed = null) {
    if (seed != null) return seeded(seed * 97 + level, () => dpsSim(cls, level, secs, enemy, targets, null));
    boost(cls, level); unlockAll('ashen_catacombs');
    g.enterDungeon('ashen_catacombs', 'normal');
    const take = g.hero.takeDamage; g.hero.takeDamage = () => 0;
    const e = dummy(enemy, level);
    const extra = [];
    if (targets > 1) {
      const p = g.player, fx = e.x - p.x, fy = e.y - p.y; // forward vector
      for (const [sx, sy] of [[-fy, fx], [fy, -fx], [fx * 2, fy * 2]].slice(0, targets - 1)) {
        const [x, y] = sx === fx * 2 ? [p.x + sx, p.y + sy] : [e.x + sx, e.y + sy];
        if (!g.dungeon.isWalkable(x, y) || g.ai.enemyAt(x, y)) continue;
        const d2 = g.ai.spawnExtra({ type: enemy, x, y, level }); d2.summoned = false; d2.state = 'chase'; d2.atkMult = 0; extra.push(d2);
      }
    }
    const extraPool = extra.map((q) => { q.maxHp = q.hp = Math.round(q.def.hp * 40 * (1 + 0.13 * Math.max(0, level - (q.def.level || 1)))); return q.maxHp; });
    // a big but finite dummy: it passes through every HP band (execute < 35% included) and refills
    // at 12% so it never dies (no kill rewards, no on-kill effects distorting the numbers)
    const pool = Math.round(e.def.hp * 40 * (1 + 0.13 * Math.max(0, level - (e.def.level || 1))));
    e.maxHp = e.hp = pool;
    const t0 = g.time; let casts = 0, basics = 0, spent = 0, last = g.resource.value, dmg = 0;
    for (let t = 0; t < secs; t += 0.05) {
      if (e.hp < pool * 0.12) { dmg += pool - e.hp; e.hp = pool; }
      const r = act(); if (r === 'skill') casts++; if (r === 'basic') basics++;
      if (g.resource.value < last) spent += last - g.resource.value;
      last = g.resource.value;
      sim(0.05);
      if (!e.alive) { dmg += pool; e.alive = true; e.dying = false; e.hp = pool; e.state = 'chase'; }
      extra.forEach((q, i) => { if (q.hp < extraPool[i] * 0.12 || !q.alive) { dmg += extraPool[i] - Math.max(0, q.hp); q.hp = extraPool[i]; q.alive = true; q.dying = false; q.state = 'chase'; } });
    }
    g.hero.takeDamage = take;
    dmg += pool - e.hp;
    extra.forEach((q, i) => { dmg += extraPool[i] - q.hp; });
    const out = { cls, level, targets: 1 + extra.length, dps: Math.round(dmg / (g.time - t0)), casts, basics, resourceSpent: Math.round(spent), maxResource: g.resource.max };
    g.combat.reset(); g.toCamp();
    return out;
  }

  // Steady incoming damage (5% max HP / s) for `secs`: how much of it does the class heal back?
  function sustainSim(cls, level, secs = 30) {
    boost(cls, level); unlockAll('ashen_catacombs');
    g.enterDungeon('ashen_catacombs', 'normal');
    const e = dummy('skeleton', level);
    e.maxHp = e.hp = 1e9; // a punching bag that never dies (no on-kill healing either)
    let taken = 0, healed = 0, hp = g.hero.hp;
    for (let t = 0; t < secs; t += 0.05) {
      const before = g.hero.hp;
      if (g.hero.hp > g.hero.maxHp * 0.2) { const d = g.hero.takeDamage(Math.max(1, Math.round(g.hero.maxHp * 0.05 * 0.05))); taken += d; }
      act(); sim(0.05);
      if (g.hero.hp > before) healed += g.hero.hp - before;
      hp = g.hero.hp;
    }
    const out = { cls, level, healedPct: Math.round((healed / Math.max(1, taken)) * 100), hpEnd: Math.round((hp / g.hero.maxHp) * 100) };
    g.combat.reset(); g.toCamp();
    return out;
  }

  // Control spam on a boss: how much of 30s is it unable to act (stunned / staggered)?
  function controlSim(cls, level, bossDungeon = 'ashen_catacombs') {
    boost(cls, level); unlockAll(bossDungeon);
    g.enterDungeon(bossDungeon, 'normal');
    g.director.buildFloor(DUNGEONS[bossDungeon].floors - 1);
    const boss = g.enemies.find((q) => q.boss && !q.miniboss);
    const take = g.hero.takeDamage; g.hero.takeDamage = () => 0;
    g.bossCtl.start(boss);
    boss.maxHp = boss.hp = 1e9;
    let locked = 0;
    for (let t = 0; t < 30; t += 0.05) {
      g.status.apply(boss, 'stagger', { dur: 2 }); // worst case: a stagger every frame
      if (g.status.has(boss, 'stagger') || boss.state === 'hurt') locked += 0.05;
      sim(0.05);
    }
    g.hero.takeDamage = take;
    const out = { cls, boss: boss.type, lockedPct: Math.round((locked / 30) * 100) };
    g.inCombat = false; g.combat.reset(); g.bossCtl.reset(); g.run = null; g.toCamp();
    return out;
  }

  // Every Horseman through every chapter dungeon at its recommended level (boosted, real bot play).
  function matrix(classes = CLASSES, dungeons = DUNGEON_ORDER.filter((d) => !DUNGEONS[d].prologue)) {
    const rows = [];
    for (const id of dungeons) for (const cls of classes) {
      const lvl = Math.min(50, DUNGEONS[id].recommended[1] - 1);
      boost(cls, lvl); unlockAll(id);
      const pots0 = g.inventory.countOf('health_potion') + g.inventory.countOf('greater_health_potion');
      const d = playDungeon(id, 'normal');
      rows.push({ dungeon: id, cls, lvl, cleared: !!d.cleared, died: !!d.died, floors: `${d.floors}/${DUNGEONS[id].floors}`, bossTime: d.bossTime, potions: pots0 - g.inventory.countOf('health_potion') - g.inventory.countOf('greater_health_potion') });
      if (g.scene === 'cleared' || g.scene === 'gameover') g.toCamp();
    }
    return rows;
  }

  function prologueAll() {
    return CLASSES.map((cls) => { g.newGame(cls); const ok = playPrologue(); const lv = g.hero.level; if (g.scene === 'cleared') g.toCamp(); return { cls, cleared: ok, level: lv }; });
  }

  return { dpsSim, sustainSim, controlSim, matrix, prologueAll, CLASSES };
}
