// Phase 3 acceptance suite: http://localhost:5173/?test3
// Unit checks for item generation, probabilities, attributes, equipment rules, comparison,
// stacking, dismantling, crafting, sets, legendary effects, class synergy, save/load + migration,
// loop safety — then a full bot dungeon run per Horseman that picks up loot and equips upgrades.
import { HORSEMEN, CLASS_ORDER } from '../src/data/characters.js';
import { RARITIES, RARITY_ORDER, EQUIP_SLOTS } from '../src/data/items.js';
import { AFFIXES } from '../src/data/affixes.js';
import { RARITY_TABLES, MYTHIC_SOURCES } from '../src/data/lootTables.js';
import { PROGRESSION, scaledXp } from '../src/data/progression.js';
import { SAVE_KEYS } from '../src/data/config.js';
import { SAVE_VERSION } from '../src/systems/SaveMigration.js';
import { SETS } from '../src/data/sets.js';
import { TEMPER } from '../src/data/recipes.js';
import { affixRange } from '../src/systems/ItemGenerator.js';
import { compareItem, upgradeScore } from '../src/systems/ItemComparison.js';
import { runAcceptance } from './acceptance.js';

export async function runPhase3(g) {
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  const check = (name, pass, detail = '') => results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) });

  const realUpdate = g.update.bind(g);
  g.update = () => {};
  const sim = (sec) => { for (let t = 0; t < sec - 1e-9; t += 0.05) { g.ui.beginFrame(); realUpdate(0.05); } };
  const fresh = (cls = 'war', level = 10) => {
    g.newGame(cls);
    g.hero.level = level; g.calc.invalidate(); g.hero.hp = g.hero.maxHp;
    g.ai.update = () => {}; // enemies hold still for unit checks
  };
  const gen = (baseId, rarity = 'rare', ilvl = 5, seed = 12345) => g.loot.gen.generate({ baseId, rarity, ilvl, seed, classHint: g.hero.classId });
  const give = (it) => { g.inventory.add(it); return it; };
  const noCrit = { source: 'basic', critChance: -10 };

  try {
    // ============================================================ 1. progression
    fresh('war', 1);
    g.hero.gainXp(10_000_000);
    const capped = g.hero.level === PROGRESSION.maxLevel && g.hero.xp === 0;
    // same level, 2 levels below (free gap), 9 below, 49 below
    const xpScale = [scaledXp(100, 5, 5), scaledXp(100, 3, 5), scaledXp(100, 1, 10), scaledXp(100, 1, 50)];
    fresh('war', 1);
    const atk1 = g.hero.atk, hp1 = g.hero.maxHp;
    g.resource.value = 0;
    g.hero.gainXp(40);
    const lvlOk = g.hero.level === 2 && g.hero.atk > atk1 && g.hero.maxHp > hp1 && g.resource.value > 0;
    check('Level/XP: cap 50 (configurable), anti-farm scaling, level-up recalculates stats + restores resource',
      capped && xpScale[0] === 100 && xpScale[1] === 100 && xpScale[2] < 100 && xpScale[3] >= 10 && lvlOk,
      `cap ${PROGRESSION.maxLevel} reached ${capped}; XP same lv ${xpScale[0]}, -2 lv ${xpScale[1]}, -9 lv ${xpScale[2]}, -49 lv ${xpScale[3]} (min 10%); LV2 ATK ${atk1}->${g.hero.atk}, HP ${hp1}->${g.hero.maxHp}, resource restored ${Math.round(g.resource.value)}`);

    // ============================================================ 2. attributes -> derived stats
    fresh('war', 1);
    const base = g.calc.compute();
    const fake = (mods) => ({ uid: -1, def: { slot: 'ring' }, mods });
    const withAttr = (k) => g.calc.compute({ ring: fake({ [k]: 10 }) });
    const S = withAttr('str'), V = withAttr('vit'), I = withAttr('int'), W = withAttr('wis'), L = withAttr('lck'), Dx = withAttr('dex');
    const capT = g.calc.compute({ ring: fake({ crit: 999, atkSpeed: 999, evasion: 999, resEff: 999, damageReduction: 999 }) });
    const pctT = g.calc.compute({ ring: fake({ hp: 10, hpPct: 10 }) });
    const attrOk =
      Math.abs(S.atk - base.atk - 5) < 1e-6 && Math.abs(S.armorPen - 1.5) < 1e-6 &&
      V.hp === base.hp + 40 && Math.abs(V.def - base.def - 2.5) < 1e-6 &&
      Math.abs(I.skillPower - 15) < 1e-6 && I.atk === base.atk &&
      Math.abs(W.resEff - 5) < 1e-6 && Math.abs(W.statusResist - 6) < 1e-6 && Math.abs(W.resist - 4) < 1e-6 &&
      Math.abs(L.crit - base.crit - 2.5) < 1e-6 && L.lootLuck > base.lootLuck &&
      Math.abs(Dx.accuracy - base.accuracy - 4) < 1e-6 && Math.abs(Dx.atkSpeed - 2) < 1e-6 &&
      capT.crit === 60 && capT.atkSpeed === 40 && capT.evasion === 30 && capT.resEff === 30 && capT.damageReduction === 40 &&
      pctT.hp === Math.round((base.hp + 10) * 1.1);
    check('Primary attributes drive the right derived stats; flat vs % separate; caps hold',
      attrOk, `+10 STR: ATK +${(S.atk - base.atk).toFixed(1)}, PEN ${S.armorPen} | +10 VIT: HP +${V.hp - base.hp}, DEF +${(V.def - base.def).toFixed(2)} | +10 INT: SP ${I.skillPower}%, ATK unchanged ${I.atk === base.atk} | +10 WIS: eff ${W.resEff}% sres ${W.statusResist}% res ${W.resist}% | +10 LCK: crit +${(L.crit - base.crit).toFixed(2)} | caps crit ${capT.crit} AS ${capT.atkSpeed} EVA ${capT.evasion} DR ${capT.damageReduction} | +10 HP +10% HP => ${pctT.hp}`);
    check('Level-1 Horsemen without gear keep exactly the Phase 2 base stats',
      CLASS_ORDER.every((c) => { fresh(c, 1); const s = g.calc.compute(); const b = HORSEMEN[c].base; return s.hp === b.hp && s.atk === b.atk && s.def === b.def && s.crit === b.crit; }),
      CLASS_ORDER.map((c) => `${c} ${HORSEMEN[c].base.hp}/${HORSEMEN[c].base.atk}/${HORSEMEN[c].base.def}/${HORSEMEN[c].base.crit}%`).join(' '));

    // ============================================================ 3. eight slots + hand rules + requirements
    fresh('war', 10);
    const pieces = { head: 'iron_helm', chest: 'breastplate', hands: 'gauntlets', legs: 'greaves', offHand: 'war_talisman', ring: 'iron_band', relic: 'shard_first_seal', mainHand: 'knight_longsword' };
    const filled = [];
    for (const [slot, id] of Object.entries(pieces)) { const it = give(gen(id, 'uncommon', 6)); const r = g.equipment.equip(it.uid); if (r.ok && g.equipment.slots[slot] === it.uid) filled.push(slot); }
    check('All eight equipment slots accept and hold their items', filled.length === 8 && EQUIP_SLOTS.every((s) => g.equipment.slots[s]), `filled: ${filled.join(', ')}`);

    const talisman = g.equipment.itemIn('offHand');
    const axe = give(gen('war_axe', 'rare', 6));
    const r2h = g.equipment.equip(axe.uid);
    const stowed = !g.equipment.slots.offHand && g.inventory.has(talisman.uid) && !g.equipment.isEquipped(talisman.uid);
    const blockOff = g.equipment.equip(talisman.uid);
    const grimoire = give(gen('grimoire', 'rare', 6));
    const classBlock = g.equipment.canEquip(grimoire);
    const tooHigh = give(gen('iron_helm', 'common', 30));
    const lvlBlock = g.equipment.canEquip(tooHigh);
    // full bag: unequipping (and stowing an off-hand for a 2H weapon) must be refused, never delete
    g.equipment.select(0);  // longsword (1H) active again
    g.equipment.equip(talisman.uid);
    const cap0 = g.inventory.capacity;
    g.inventory.capacity = g.inventory.bagCount;
    const fullUnequip = g.equipment.unequip(talisman.uid);
    const full2H = g.equipment.select(1); // axe would need to stow the talisman
    const stillThere = g.equipment.slots.offHand === talisman.uid && g.inventory.has(talisman.uid);
    g.inventory.capacity = cap0;
    check('Main/off-hand rules: 2H stows off-hand to the bag, blocks new off-hand; class + level requirements; full bag refuses safely',
      r2h.ok && stowed && !blockOff.ok && !classBlock.ok && !lvlBlock.ok && !fullUnequip.ok && !full2H && stillThere,
      `2H equip ${r2h.ok}, off-hand stowed (kept in bag) ${stowed}, off-hand while 2H: "${blockOff.msg}" | "${classBlock.msg}" | "${lvlBlock.msg}" | full bag: unequip "${fullUnequip.msg}", 2H swap refused ${!full2H}, item kept ${stillThere}`);

    // ============================================================ 4. equipment changes real combat numbers
    fresh('war', 10);
    const dummy = g.enemies.find((e) => e.type === 'skeleton');
    Object.assign(dummy, { hp: 1e6, maxHp: 1e6 });
    const avgHit = (n = 600) => { let s = 0; for (let i = 0; i < n; i++) s += g.combat.finalizeDamage(dummy, 20 + g.hero.atk * 0.4, noCrit).dmg; return s / n; };
    const d0 = avgHit(), hp0 = g.hero.maxHp, red0 = g.hero.defense;
    const gloves = give(gen('gauntlets', 'epic', 10, 777)); gloves.mods = { atk: 10, def: 4, hp: 20 }; // fixture: known numbers
    g.equipment.equip(gloves.uid);
    const d1 = avgHit(), hp1b = g.hero.maxHp, red1 = g.hero.defense;
    const wsBefore = g.weapons.current.dmgMax;
    const better = give(gen('knight_longsword', 'legendary', 10));
    g.equipment.equip(better.uid);
    check('Equipping changes the stats combat actually uses (damage, HP, blow reduction, weapon)',
      d1 > d0 + 3 && hp1b === hp0 + 20 && red1 > red0 && g.weapons.current.dmgMax > wsBefore,
      `avg hit ${d0.toFixed(1)} -> ${d1.toFixed(1)}, max HP ${hp0} -> ${hp1b}, blow reduction ${red0.toFixed(2)} -> ${red1.toFixed(2)}, weapon max ${wsBefore} -> ${g.weapons.current.dmgMax}`);

    // ============================================================ 5. generation: rarities, affix rules, names, determinism
    fresh('conquest', 20);
    const seenR = new Set();
    for (let i = 0; i < 4000 && seenR.size < 6; i++) { const it = g.loot.rollEquipment('boss', 10); if (it) seenR.add(it.rarity); }
    check('All six rarity tiers are generated through valid sources (boss table)', seenR.size === 6, [...seenR].join(', '));

    const issues = [];
    let n = 0, withAff = 0;
    for (const t of ['ordinary', 'elite', 'boss', 'chest', 'secret', 'reward', 'crafted']) {
      for (let i = 0; i < 300; i++) {
        const lvl = 1 + (i % 25);
        const it = i % 7 === 0 ? g.loot.rollRelic(t, lvl) : g.loot.rollEquipment(t, lvl);
        if (!it) continue;
        n++;
        const d = it.def, r = RARITIES[it.rarity];
        if (it.affixes.length) withAff++;
        const groups = new Set();
        if (it.affixes.length > r.affixes[1]) issues.push(`${it.name}: too many affixes`);
        for (const af of it.affixes) {
          const a = AFFIXES[af.id];
          if (!a.slots.includes(d.slot)) issues.push(`${a.id} on ${d.slot}`);
          if (it.ilvl < a.minIlvl || it.ilvl > a.maxIlvl) issues.push(`${a.id} ilvl ${it.ilvl}`);
          if (!a.rarities.includes(it.rarity)) issues.push(`${a.id} on ${it.rarity}`);
          if (a.cls && !(d.classes ? d.classes.includes(a.cls) : it.classHint === a.cls)) issues.push(`${a.id} class`);
          if (groups.has(a.group)) issues.push(`dup group ${a.group}`); groups.add(a.group);
          const [lo, hi] = affixRange(a, it.ilvl);
          if (af.value < +lo.toFixed(a.dec) - 1e-9 || af.value > +hi.toFixed(a.dec) + 1e-9) issues.push(`${a.id}=${af.value} outside [${lo.toFixed(2)},${hi.toFixed(2)}]`);
        }
        // names only use affixes the item really has
        if (!d.uniqueOnly) {
          const pre = it.affixes.find((x) => AFFIXES[x.id].kind === 'prefix'), suf = it.affixes.find((x) => AFFIXES[x.id].kind === 'suffix');
          const expect = `${pre ? AFFIXES[pre.id].name + ' ' : ''}${d.name}${suf ? ' ' + AFFIXES[suf.id].name : ''}`;
          if (it.name !== expect) issues.push(`name ${it.name} != ${expect}`);
        }
      }
    }
    check('Affixes obey slot / item level / rarity / class / exclusive-group rules and roll inside their ranges', !issues.length, issues.slice(0, 4).join('; ') || `${n} items checked, ${withAff} with affixes`);
    check('Generated names match the affixes the item actually has', !issues.some((x) => x.startsWith('name')), 'prefix/suffix in name <=> affix present');
    const a1 = g.loot.gen.generate({ baseId: 'breastplate', rarity: 'epic', ilvl: 12, seed: 4242, classHint: 'war' });
    const a2 = g.loot.gen.generate({ baseId: 'breastplate', rarity: 'epic', ilvl: 12, seed: 4242, classHint: 'war' });
    const a3 = g.loot.gen.generate({ baseId: 'breastplate', rarity: 'epic', ilvl: 12, seed: 4243, classHint: 'war' });
    check('Generation is deterministic for a given seed (seed stored on every item)',
      JSON.stringify([a1.name, a1.affixes, a1.mods]) === JSON.stringify([a2.name, a2.affixes, a2.mods]) && JSON.stringify(a1.affixes) !== JSON.stringify(a3.affixes),
      `seed 4242 twice: identical; seed 4243: different (${a1.name} / ${a3.name})`);
    const lowLeg = gen('breastplate', 'legendary', 2, 9), highCom = gen('breastplate', 'common', 20, 9);
    check('Item level scales base stats; rarity scales affixes (high-lv common vs low-lv legendary differ by stats, not just colour)',
      highCom.mods.def > lowLeg.mods.def - (lowLeg.affixes.find((x) => x.id === 'stalwart')?.value || 0) && lowLeg.affixes.length >= 3 && highCom.affixes.length === 0,
      `common iLv20 DEF ${highCom.mods.def} (0 affixes) vs legendary iLv2 DEF ${lowLeg.mods.def} (${lowLeg.affixes.length} affixes + ${lowLeg.unique})`);

    // ============================================================ 6. probabilities
    const sums = Object.keys(RARITY_TABLES).map((t) => { const p = g.loot.rarityDistribution(t, 0); return [t, Object.values(p).reduce((s, v) => s + v, 0), p]; });
    const normOk = sums.every(([, s, p]) => Math.abs(s - 1) < 1e-9 && Object.values(p).every((v) => v >= 0));
    let common = 0, mythicOrd = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) { const r = g.loot.rollRarity('ordinary', 0); if (r === 'common') common++; if (r === 'mythic') mythicOrd++; }
    const pOrd = g.loot.rarityDistribution('ordinary', 0);
    const pLuck = g.loot.rarityDistribution('boss', 0.25), pBoss = g.loot.rarityDistribution('boss', 0), pHuge = g.loot.rarityDistribution('boss', 99);
    check('Loot probabilities are normalised and match the configured weights (Monte Carlo)',
      normOk && Math.abs(common / N - pOrd.common) < 0.015,
      `${sums.length} tables sum to 1; ordinary common expected ${(pOrd.common * 100).toFixed(1)}%, rolled ${(common / N * 100).toFixed(1)}% over ${N}`);
    check('Mythic restrictions: never from ordinary/elite/chest/crafted; luck is bounded and never raises Mythic',
      mythicOrd === 0 && ['ordinary', 'elite', 'chest', 'crafted'].every((t) => g.loot.rarityDistribution(t, 0.25).mythic === 0) && MYTHIC_SOURCES.includes('boss') &&
      pLuck.legendary > pBoss.legendary && Math.abs(pHuge.legendary - pLuck.legendary) < 1e-12 && pLuck.mythic <= pBoss.mythic,
      `ordinary mythic rolls ${mythicOrd}/${N}; boss legendary ${(pBoss.legendary * 100).toFixed(2)}% -> luck ${(pLuck.legendary * 100).toFixed(2)}% (luck 99 clamps to same), mythic ${(pBoss.mythic * 100).toFixed(2)}% -> ${(pLuck.mythic * 100).toFixed(2)}%`);

    // ============================================================ 7. loot exactly once per event
    fresh('war', 5);
    const sk = g.enemies.find((e) => e.type === 'skeleton');
    const first = g.loot.rollEnemy(sk), second = g.loot.rollEnemy(sk);
    const chest = [...g.dungeon.chests.values()][0];
    const c1 = g.loot.openChest(chest), c2 = g.loot.openChest(chest);
    const floorBefore = JSON.stringify(g.loot.floor.map((f) => f.uid));
    const invBefore = JSON.stringify(g.inventory.items.map((i) => i.uid));
    g.openPanel('inventory'); g.ui.beginFrame(); g.render(); g.closePanel(); g.openPanel('inventory'); g.ui.beginFrame(); g.render(); g.closePanel();
    const kn = g.enemies.find((e) => e.type === 'knight');
    kn.hp = 1; g.combat.damageEnemy(kn, 5, false, {}); const dropped = g.loot.itemsAt(kn.x, kn.y).length;
    g.combat.damageEnemy(kn, 5, false, {}); const droppedAgain = g.loot.itemsAt(kn.x, kn.y).length;
    check('Loot is generated once per reward event (enemy, chest) and opening the inventory never re-rolls',
      second.items.length === 0 && second.gold === 0 && c2.items.length === 0 && c1.items.length >= 2 && floorBefore === JSON.stringify(g.loot.floor.filter((f) => f.x !== kn.x || f.y !== kn.y).map((f) => f.uid)) &&
      invBefore === JSON.stringify(g.inventory.items.map((i) => i.uid)) && dropped === droppedAgain,
      `enemy roll #1 ${first.items.length} items/${first.gold}g, #2 ${second.items.length}; chest #1 ${c1.items.length}, #2 ${c2.items.length}; knight drop ${dropped}, after a second hit ${droppedAgain}`);

    // ============================================================ 8. comparison signs
    fresh('war', 10);
    const cur = give(gen('breastplate', 'common', 5, 1)); cur.mods = { def: 10, hp: 10 }; g.equipment.equip(cur.uid);
    const cand = give(gen('breastplate', 'common', 5, 2)); cand.mods = { atk: 5, hp: 10 };
    const cmp = compareItem(g, cand);
    const dAtk = cmp.deltas.find((d) => d.key === 'atk'), dDef = cmp.deltas.find((d) => d.key === 'def'), dHp = cmp.deltas.find((d) => d.key === 'hp');
    const allHonest = cmp.deltas.every((d) => d.note || (d.better === (d.after > d.before)));
    check('Item comparison shows real +/- changes (green only when the final stat improves)',
      dAtk?.better && dAtk.diff > 0 && dDef && !dDef.better && dDef.diff < 0 && !dHp && allHonest,
      `ATK ${dAtk?.before}->${dAtk?.after} (green), DEF ${dDef?.before}->${dDef?.after} (red), equal HP not listed, every delta honest ${allHonest}`);

    // ============================================================ 9. stacking
    fresh('war', 10);
    const e1 = give(gen('iron_band', 'rare', 5, 11)), e2 = give(gen('iron_band', 'rare', 5, 12)), e3 = give(gen('iron_band', 'rare', 5, 11));
    const p1 = g.loot.create('health_potion', 'common', 2), p2 = g.loot.create('health_potion', 'common', 3);
    give(p1); give(p2);
    const m1 = g.loot.create('iron_shard', 'common', 5), m2 = g.loot.create('iron_shard', 'common', 7); give(m1); give(m2);
    const rings = g.inventory.items.filter((i) => i.defId === 'iron_band');
    check('Stacking: equipment (even identical rolls) never merges; potions and materials stack',
      rings.length === 3 && new Set(rings.map((r) => r.uid)).size === 3 && g.inventory.items.filter((i) => i.defId === 'health_potion').length === 1 && g.inventory.countOf('health_potion') === 6 && g.inventory.countOf('iron_shard') === 12 && !g.inventory.canStack(e1, e3),
      `rings ${rings.length} separate (two share a seed), potions ${g.inventory.countOf('health_potion')} in 1 stack, shards ${g.inventory.countOf('iron_shard')}; ${e2.name}`);

    // ============================================================ 10. dismantle / sell / craft / temper
    fresh('war', 10);
    const junk = give(gen('greaves', 'rare', 6, 5));
    const y = g.craft.dismantleYield(junk);
    const before = Object.fromEntries(Object.keys(y).map((k) => [k, g.inventory.countOf(k)]));
    const d1r = g.craft.dismantle(junk.uid), d2r = g.craft.dismantle(junk.uid);
    const gained = Object.keys(y).every((k) => g.inventory.countOf(k) === before[k] + y[k]);
    const leg = give(gen('breastplate', 'legendary', 6, 6));
    const needConfirm = g.craft.dismantle(leg.uid);
    const worn = give(gen('iron_helm', 'common', 6, 7)); g.equipment.equip(worn.uid);
    const wornConfirm = g.craft.dismantle(worn.uid);
    const wornDone = g.craft.dismantle(worn.uid, true);
    check('Dismantling consumes the item exactly once; Legendary/equipped need confirmation',
      d1r.ok && !d2r.ok && gained && !g.inventory.has(junk.uid) && !!needConfirm.confirm && g.inventory.has(leg.uid) && !!wornConfirm.confirm && wornDone.ok && !g.equipment.slots.head && !g.inventory.has(worn.uid),
      `1st: ${d1r.msg} | 2nd: "${d2r.msg}" | legendary: "${needConfirm.confirm}" | equipped: confirm then ok ${wornDone.ok}`);

    fresh('war', 10);
    give(g.loot.create('iron_shard', 'common', 5)); g.gold = 20;
    const pots0 = g.inventory.countOf('health_potion');
    const craftOk = g.craft.craft('brew_potion');
    const shardsAfter = g.inventory.countOf('iron_shard'), goldAfter = g.gold;
    const craftFail = g.craft.craft('forge_equipment');
    const unchanged = g.inventory.countOf('iron_shard') === shardsAfter && g.gold === goldAfter;
    const sword = g.equipment.activeItem();
    give(g.loot.create('iron_shard', 'common', 20)); g.gold = 500;
    const dmg0 = sword.stats.dmgMax;
    const cost = TEMPER.cost(sword);
    const sh0 = g.inventory.countOf('iron_shard'), g0 = g.gold;
    const tOk = g.craft.temper(sword.uid);
    check('Crafting consumes exactly the listed materials; insufficient materials change nothing; tempering upgrades +8%',
      craftOk.ok && shardsAfter === 3 && goldAfter === 15 && g.inventory.countOf('health_potion') === pots0 + 1 && !craftFail.ok && unchanged &&
      tOk.ok && sword.upgrade === 1 && sword.stats.dmgMax >= dmg0 && g.inventory.countOf('iron_shard') === sh0 - cost.mats.iron_shard && g.gold === g0 - cost.gold,
      `potion: shards 5->3, gold 20->15 | forge refused: "${craftFail.msg}" | temper: ${tOk.msg}, max dmg ${dmg0}->${sword.stats.dmgMax}, paid ${JSON.stringify(cost)}`);

    // ============================================================ 11. sets
    fresh('war', 10);
    const set = SETS.red_battlefield;
    const pcs = set.pieces.map((id, i) => give(gen(id, 'epic', 8, 100 + i)));
    const hpA = g.hero.maxHp;
    g.equipment.equip(pcs[0].uid); const s1 = g.hero.stats.sets[0];
    g.equipment.equip(pcs[1].uid); const s2 = g.hero.stats.sets[0]; const hpB = g.hero.maxHp;
    // same two pieces with the set id stripped => no +10% HP bonus
    const strip = (it) => ({ ...it, setId: null });
    const hpNoBonus = g.calc.compute({ head: strip(pcs[0]), chest: strip(pcs[1]) }).hp;
    g.equipment.equip(pcs[2].uid); g.equipment.equip(pcs[3].uid); const s4 = g.hero.stats.sets[0];
    const dupHelm = give(gen('rb_helm', 'epic', 8, 999)); g.equipment.equip(dupHelm.uid); const sDup = g.hero.stats.sets[0];
    g.equipment.unequip(pcs[1].uid); const s3 = g.hero.stats.sets[0];
    check('Set bonuses activate at 2 / 4 pieces, deactivate on removal, never double-count',
      s1.active.length === 0 && s2.active.length === 1 && s4.active.length === 2 && sDup.count === 4 && s3.count === 3 && s3.active.length === 1 && !s3.active.some((b) => b.count === 4) &&
      Math.abs(hpB - hpNoBonus * 1.1) <= 1.2, // +10% HP (both sides rounded)
      `1pc ${s1.active.length}, 2pc ${s2.active.length} (HP ${hpNoBonus} without set -> ${hpB} with +10%), 4pc ${s4.active.length}, duplicate helm still ${sDup.count}/4, after removing one: ${s3.count}/4 with ${s3.active.length} bonus`);

    // ============================================================ 12. legendary effects: ICDs + limits
    fresh('war', 10);
    const ring = give(gen('iron_band', 'legendary', 8, 31)); ring.unique = 'vampiric'; g.equipment.equip(ring.uid);
    const tgt = g.enemies.find((e) => e.type === 'skeleton'); Object.assign(tgt, { hp: 1e6, maxHp: 1e6 });
    g.hero.hp = 10;
    for (let i = 0; i < 20; i++) g.legend.onBasicHit(tgt, { source: 'basic' }, 10);
    const procs1 = g.legend.procs.get('vampiric') || 0;
    sim(1.6);
    g.legend.onBasicHit(tgt, { source: 'basic' }, 10);
    const procs2 = g.legend.procs.get('vampiric') || 0;
    const relic = give(gen('shard_first_seal', 'rare', 8, 32)); g.equipment.equip(relic.uid);
    const hp0e = tgt.hp;
    for (let i = 0; i < 8; i++) g.combat.damageEnemy(tgt, 10, false, { ctx: { source: 'basic' } });
    const echoes = g.legend.procs.get('echo_strike') || 0;
    const echoDmg = hp0e - tgt.hp;
    check('Legendary effects respect internal cooldowns and limits (no proc chains)',
      procs1 === 1 && procs2 === 2 && echoes === 2 && echoDmg === 80 + 2 * 5,
      `Vampiric: 20 hits in one instant -> ${procs1} heal, after 1.6s -> ${procs2}; Echo: 8 hits -> ${echoes} echoes (${echoDmg} dmg, echoes never echo)`);

    // ============================================================ 13. class synergy, all four Horsemen
    const syn = {};
    {
      fresh('conquest', 10);
      const e = g.enemies.find((q) => q.type === 'skeleton'); Object.assign(e, { hp: 1e6, maxHp: 1e6 });
      g.status.apply(e, 'mark', { dur: 99 });
      const b = g.combat.finalizeDamage(e, 100, noCrit).dmg;
      const it = give(gen('pale_circlet', 'rare', 8)); it.mods = { markedDmg: 20 }; g.equipment.equip(it.uid);
      const a = g.combat.finalizeDamage(e, 100, noCrit).dmg;
      const other = give(gen('pale_longbow', 'rare', 8));
      syn.conquest = [a > b, `marked hit ${b}->${a}`];
      fresh('war', 10); syn.restrict = !g.equipment.canEquip(other).ok;
    }
    {
      fresh('war', 10);
      const e = g.enemies.find((q) => q.type === 'skeleton'); Object.assign(e, { hp: 1e6, maxHp: 1e6 });
      const ctx = { source: 'skill', skill: { target: 'arc' }, critChance: -10 };
      const b = g.combat.finalizeDamage(e, 100, ctx).dmg;
      g.resource.value = 0; g.combat.damageEnemy(e, 1, false, { ctx: { source: 'basic' } }); const f0 = g.resource.value;
      const it = give(gen('gauntlets', 'rare', 8)); it.mods = { areaDmg: 30, resGain: 25 }; g.equipment.equip(it.uid);
      const a = g.combat.finalizeDamage(e, 100, ctx).dmg;
      g.resource.value = 0; g.combat.damageEnemy(e, 1, false, { ctx: { source: 'basic' } }); const f1 = g.resource.value;
      syn.war = [a > b && f1 === f0 * 1.25, `cleave-type hit ${b}->${a}, Fury per hit ${f0}->${f1}`];
    }
    {
      fresh('famine', 10);
      const e = g.enemies.find((q) => q.type === 'skeleton'); Object.assign(e, { hp: 1e6, maxHp: 1e6 });
      for (let i = 0; i < 5; i++) g.status.apply(e, 'wither', { dur: 30, stacks: 2 });
      const st0 = g.status.stacks(e, 'wither');
      const scales = give(gen('black_scales', 'rare', 8)); g.equipment.equip(scales.uid);
      for (let i = 0; i < 5; i++) g.status.apply(e, 'wither', { dur: 30, stacks: 2 });
      const st1 = g.status.stacks(e, 'wither');
      const hood = give(gen('plague_hood', 'rare', 8)); hood.mods = { dotDmg: 50 }; g.equipment.equip(hood.uid);
      g.status.apply(e, 'plague', { dur: 10, power: 10, perStack: 0 });
      const hpP = e.hp; sim(1.05); const tick = hpP - e.hp;
      syn.famine = [st0 === 5 && st1 === 6 && tick >= 15, `Withering cap ${st0}->${st1} (Black Scales), plague tick ${tick} (base 10 + DoT gear + skill power)`];
    }
    {
      fresh('death', 10);
      const e = g.enemies.find((q) => q.type === 'skeleton'); Object.assign(e, { hp: 1e6, maxHp: 1e6 });
      g.status.apply(e, 'grave_mark', { dur: 99 });
      const b = g.combat.finalizeDamage(e, 100, noCrit).dmg;
      const it = give(gen('plague_hood', 'rare', 8)); it.mods = { curseDmg: 25, resGain: 20 }; g.equipment.equip(it.uid);
      const a = g.combat.finalizeDamage(e, 100, noCrit).dmg;
      g.resource.value = 0;
      for (let i = 0; i < 5; i++) g.resource.gain(1);
      syn.death = [a > b && g.resource.value === 6, `cursed hit ${b}->${a}; 5 x 1 Soul with +20% gain = ${g.resource.value} (fractions carried, never free per kill)`];
    }
    check('Class-specific gear bonuses work for all four Horsemen (via existing statuses/skills/resources)',
      syn.conquest[0] && syn.war[0] && syn.famine[0] && syn.death[0] && syn.restrict,
      `CONQUEST ${syn.conquest[1]} | WAR ${syn.war[1]} | FAMINE ${syn.famine[1]} | DEATH ${syn.death[1]} | class-locked item refused for WAR: ${syn.restrict}`);

    // ============================================================ 14. save / load integrity
    fresh('famine', 12);
    const gear = ['plague_hood', 'ash_robe', 'hand_wraps', 'shadow_boots', 'grimoire', 'signet', 'black_scales', 'hunger_sickle'].map((id, i) => give(gen(id, RARITY_ORDER[1 + (i % 4)], 10, 500 + i)));
    for (const it of gear) g.equipment.equip(it.uid);
    gear[0].upgrade = 2; g.loot.gen.recompute(gear[0]); g.equipment._changed();
    g.gold = 321;
    const snap = (x) => g.inventory.items.map((i) => g.loot.serializeItem(i)).sort((a, b) => a.uid - b.uid);
    const invS = JSON.stringify(snap()), eqS = JSON.stringify(g.equipment.serialize()), statS = JSON.stringify(g.calc.compute(null).hp + '|' + g.calc.compute(null).atk);
    const saved = g.saves.save(g);
    g.newGame('war'); g.loadGame();
    const invL = JSON.stringify(snap()), eqL = JSON.stringify(g.equipment.serialize()), statL = JSON.stringify(g.calc.compute(null).hp + '|' + g.calc.compute(null).atk);
    const uids = g.inventory.items.map((i) => i.uid);
    check('Save/load preserves all 8 slots, every affix roll, uniques, temper and gold; stats recalculated identically',
      saved && invS === invL && eqS === eqL && statS === statL && g.gold === 321 && new Set(uids).size === uids.length && g.hero.classId === 'famine',
      `${uids.length} items, ${Object.values(g.equipment.slots).filter(Boolean).length} slots, stats ${statL}, gold ${g.gold}`);
    g.saves.clear();

    // migration v2 -> v3 + validation + corrupt data
    const keep = {}; for (const k of Object.values(SAVE_KEYS)) keep[k] = localStorage.getItem(k);
    for (const k of Object.entries(SAVE_KEYS).filter(([n]) => n !== 'settings').map(([, v]) => v)) localStorage.removeItem(k); // every save slot (Phase 4 adds v3 / temp)
    g.newGame('death'); g.dungeon.reset();
    const v2 = {
      version: 2, hero: { classId: 'death', level: 4, xp: 10, totalXp: 300, hp: 60, skillPoints: 3, upgrades: { soul_rend: 'A' } }, resource: { value: 5 },
      player: { x: 4, y: 2, dir: 1 },
      inventory: [{ uid: 50, defId: 'war_axe', rarity: 'rare', qty: 1 }, { uid: 51, defId: 'health_potion', rarity: 'common', qty: 2 }, { uid: 51, defId: 'health_potion', rarity: 'common', qty: 2 }, { uid: 52, defId: 'removed_item_xyz', rarity: 'epic', qty: 1 }],
      equipment: { slots: { helmet: null, mainHand: 50, gloves: null }, weaponSlots: [null, 50, null, null], active: 1 },
      dungeon: g.dungeon.serialize(), enemies: [], loot: { nextUid: 60, floor: [] }, stats: { kills: 2 },
    };
    const raw2 = JSON.stringify(v2);
    localStorage.setItem(SAVE_KEYS.v2Save, raw2);
    g.newGame('war'); g.loadGame();
    const axe2 = g.inventory.get(50);
    const migOk = g.hero.classId === 'death' && g.hero.level === 4 && axe2 && axe2.ilvl === 1 && axe2.affixes.length === 2 && g.equipment.slots.mainHand === 50 &&
      g.inventory.items.filter((i) => i.uid === 51).length === 1 && !g.inventory.get(52) && localStorage.getItem(SAVE_KEYS.v2Save) === raw2;
    const axeAgain = g.loot.restoreItem({ uid: 50, defId: 'war_axe', rarity: 'rare', qty: 1 });
    localStorage.setItem(SAVE_KEYS.save, '{"version":3,"hero":{"classId":"war"');
    const corrupt = g.saves.load();
    check('Phase 2 save migrates to v3 (deterministic affixes, renamed slots, duplicates/unknown items handled); old slot untouched; corrupt JSON refused',
      migOk && JSON.stringify(axeAgain.affixes) === JSON.stringify(axe2.affixes) && corrupt?.version === SAVE_VERSION && corrupt.migratedFrom === 2,
      `DEATH LV${g.hero.level}, war axe -> ${axe2?.name} (${axe2?.affixes.length} affixes, same on reload), duplicate uid dropped, unknown item reported, v2 slot unchanged; corrupt v3 -> fell back to ${corrupt ? 'v2 slot' : 'nothing'}`);
    for (const [k, v] of Object.entries(keep)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }

    // ============================================================ 15. loop safety under stress
    fresh('war', 20);
    for (const [id, u] of [['iron_band', 'vampiric'], ['breastplate', 'thorns'], ['greaves', 'second_wind']]) { const it = give(gen(id, 'legendary', 15)); it.unique = u; g.equipment.equip(it.uid); }
    const wb = give(g.loot.mythicFor('war', 18)); g.equipment.equip(wb.uid);
    const rel = give(gen('bloodied_banner', 'epic', 15)); g.equipment.equip(rel.uid);
    delete g.ai.update;
    Object.assign(g.player, { x: 10, y: 6, dir: 2 }); g.dungeon.openTile(10, 5);
    let overheal = false, bad = false, t0 = g.time;
    for (let t = 0; t < 30; t += 0.05) {
      if (g.weapons.canAttack()) g.combat.playerAttack();
      if (Math.random() < 0.2) g.skills.use(g.skills.slots[Math.floor(Math.random() * 5)]);
      g.ui.beginFrame(); realUpdate(0.05);
      if (g.scene !== 'playing') { g.scene = 'playing'; g.hero.hp = g.hero.maxHp; }
      if (g.hero.hp > g.hero.maxHp) overheal = true;
      if (g.resource.value < 0 || g.resource.value > g.resource.max) bad = true;
    }
    const secs = g.time - t0;
    const vp = g.legend.procs.get('vampiric') || 0, sw = g.legend.procs.get('second_wind') || 0, wbP = g.legend.procs.get('worldbreaker') || 0;
    check('No item effect or skill creates infinite healing, resource or damage loops (30s stress)',
      !overheal && !bad && vp <= secs / 1.5 + 1 && sw <= 1 && wbP <= secs / 2 + 1,
      `${secs.toFixed(0)}s: vampiric ${vp} (max ${Math.floor(secs / 1.5) + 1}), second wind ${sw} (max 1), worldbreaker ${wbP} (max ${Math.floor(secs / 2) + 1}), HP never above max, resource in range`);

    // ============================================================ 16. UI smoke
    let uiOk = true;
    try {
      for (const p of ['inventory', 'character', 'crafting', 'skills']) { g.openPanel(p); g.ui.beginFrame(); g.render(); }
      g.invState.sel = g.inventory.items[0].uid; g.openPanel('inventory'); g.ui.beginFrame(); g.render();
      g.ask('Test confirm?', () => {}); g.ui.beginFrame(); g.render(); g.confirm = null;
      g.toast(g.inventory.items[0]); g.closePanel(); g.ui.beginFrame(); g.render();
    } catch (e) { uiOk = false; console.error(e); }
    check('Inventory, equipment, crafting, tooltip, confirm and loot toast screens render', uiOk, 'all panels drawn');
  } catch (err) {
    check('Phase 3 unit suite completed', false, err.stack || err.message);
  }
  delete g.ai.update;
  g.update = realUpdate;
  console.error = origError;
  g.saves.clear();

  // ============================================================ 17. full dungeon with equipment progression
  const autoEquip = (game) => {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const it of game.inventory.bagItems.filter((i) => i.def.slot)) {
        if (upgradeScore(compareItem(game, it)) > 0.5 && game.equipment.equip(it.uid).ok) changed = true;
      }
      if (!changed) break;
    }
  };
  const runs = {};
  for (const cls of CLASS_ORDER) {
    const r = await runAcceptance(g, { classId: cls, useSkills: true, standalone: false, autoEquip });
    runs[cls] = { passed: r.filter((x) => x.result === 'PASS').length, total: r.length, summary: r.summary };
    for (const x of r) if (x.result !== 'PASS') results.push(x);
  }
  check('Full dungeon completed by all four Horsemen with loot pickup + auto-equipped upgrades (Phase 1 checklist each)',
    CLASS_ORDER.every((c) => runs[c].passed === runs[c].total && runs[c].summary?.equipped >= 2),
    CLASS_ORDER.map((c) => { const s = runs[c].summary || {}; return `${c} ${runs[c].passed}/${runs[c].total} LV${s.level} slots ${s.equipped} best ${s.bestFind} ATK ${s.atk} DEF ${s.def} gold ${s.gold}`; }).join(' | '));
  check('No console errors during the Phase 3 suite', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  g.toTitle();
  window.__p3Results = results;
  window.__p3Runs = runs;
  console.table(results);
  return results;
}
