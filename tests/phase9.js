// Auto-equip suite: http://localhost:5173/?test9  (results in window.__p9Results).
// Checks systems/AutoEquip.js and GameManager.autoEquipBest: best gear really is chosen (by the real
// StatCalculator), nothing the hero cannot use is worn, the readied weapon type is kept, running it
// twice changes nothing, and in party play every Horseman is equipped without sharing an item.
import { ITEM_DEFS } from '../src/data/items.js';
import { autoEquip, bestLoadout, gearScore } from '../src/systems/AutoEquip.js';

export async function runPhase9(g) {
  const results = [];
  const check = (name, pass, detail = '') => results.push({ test: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) });
  const keepSettings = JSON.parse(JSON.stringify(g.settings));
  const keepSave = { ...localStorage };
  const gen = g.loot.gen;
  const defs = Object.values(ITEM_DEFS);
  const make = (pred, o = {}) => { const d = defs.find((x) => x.slot && !x.uniqueOnly && pred(x)); return d ? gen.generate({ baseId: d.id, rarity: 'common', ilvl: 5, ...o }) : null; };
  const add = (it) => { if (it) g.inventory.add(it); return it; };
  const score = () => gearScore(g.calc.get(), g.equipment.activeItem(), g.hero.classId);

  try {
    // ---- solo
    g.settings.party = 'off'; g.forceSolo = true;
    g.newGame('war');
    g.hero.level = 20; g.calc.invalidate();
    const eq = g.equipment;
    const startActive = eq.active;
    const before = score();
    const weak = add(make((d) => d.slot === 'chest' && !d.classes, { rarity: 'common', ilvl: 3 }));
    const strong = add(make((d) => d.slot === 'chest' && !d.classes, { rarity: 'legendary', ilvl: 18 }));
    const helm = add(make((d) => d.slot === 'head' && !d.classes, { rarity: 'rare', ilvl: 12 }));
    const ring = add(make((d) => d.slot === 'ring' && !d.classes, { rarity: 'magic', ilvl: 10 }));
    const tooHigh = add(make((d) => d.slot === 'legs' && !d.classes, { rarity: 'legendary', ilvl: 50 }));
    const otherClass = add(make((d) => d.slot !== 'mainHand' && d.classes && !d.classes.includes('war'), { rarity: 'legendary', ilvl: 10 }));
    const axe = add(make((d) => d.kind === 'weapon' && d.weaponId === 'axe' && !d.classes, { rarity: 'rare', ilvl: 12 }));

    const plan = bestLoadout(g);
    const n = g.autoEquipBest(false);
    const after = score();

    check('Auto-equip fills empty slots with usable gear (chest, head, ring)',
      eq.itemIn('chest') && eq.itemIn('head')?.uid === helm?.uid && eq.itemIn('ring')?.uid === ring?.uid,
      `chest=${eq.itemIn('chest')?.name} head=${eq.itemIn('head')?.name} ring=${eq.itemIn('ring')?.name}`);
    // the chest choice must be the higher-scoring of the two, measured independently
    const sc = (it) => gearScore(g.calc.compute({ chest: it }), eq.activeItem(), 'war');
    const want = sc(strong) >= sc(weak) ? strong : weak;
    check('Between two items for one slot it wears the one that scores higher on the real stats',
      eq.itemIn('chest')?.uid === want.uid, `${eq.itemIn('chest')?.name} (strong ${sc(strong).toFixed(1)} vs weak ${sc(weak).toFixed(1)})`);
    check('Never wears gear above the hero\'s level', !tooHigh || !eq.isEquipped(tooHigh.uid), `${tooHigh?.name} req ${tooHigh?.reqLevel}, hero ${g.hero.level}`);
    check('Never wears another Horseman\'s class gear', !!otherClass && !eq.isEquipped(otherClass.uid), otherClass ? `${otherClass.name} [${otherClass.def.slot}] (${otherClass.classes})` : 'no class item in data');
    check('Hotbar weapons are filled by type (axe goes to slot 2)', !axe || eq.weaponSlots[1] === axe.uid, `slot2=${eq.weaponSlots[1]} axe=${axe?.uid}`);
    check('The readied weapon slot stays the same', eq.active === startActive, `before ${startActive}, after ${eq.active}`);
    check('Overall score goes up and the plan was not empty', after > before && plan.length > 0 && n === 1, `score ${before.toFixed(1)} -> ${after.toFixed(1)}, ${plan.length} changes`);
    const again = autoEquip(g);
    check('Running it again changes nothing (already best)', again.length === 0, again.map((p) => p.item.name).join(', '));

    // ---- party: each Horseman gets its own best gear, nobody shares
    g.settings.party = 'on'; g.forceSolo = false;
    g.newGame('war');
    const P = g.party;
    for (const m of P.members) P.withActor(m, () => { m.hero.level = 20; m.calc.invalidate(); });
    for (let i = 0; i < 4; i++) { add(make((d) => d.slot === 'head' && !d.classes, { rarity: 'rare', ilvl: 10 + i })); add(make((d) => d.slot === 'ring' && !d.classes, { rarity: 'magic', ilvl: 8 + i })); }
    g.autoEquipBest(true);
    const worn = []; let heads = 0;
    for (const m of P.members) { const e = m.equipment; for (const s of Object.keys(e.slots)) if (e.slots[s] && s !== 'mainHand') worn.push(e.slots[s]); if (e.slots.head) heads++; }
    check('Party auto-equip gives every Horseman a helm', heads === P.members.length, `${heads}/${P.members.length}`);
    check('No item is worn by two Horsemen', new Set(worn).size === worn.length, `${worn.length} worn, ${new Set(worn).size} distinct`);
    let classOk = true;
    for (const m of P.members) P.withActor(m, () => { for (const it of g.inventory.items) if (m.equipment.isEquipped(it.uid) && it.classes && !it.classes.includes(m.classId)) classOk = false; });
    check('Each Horseman only wears gear it is allowed to use', classOk);
  } catch (err) {
    check('Suite ran without errors', false, err.stack || err);
  }

  Object.assign(g.settings, keepSettings);
  localStorage.clear(); for (const [k, v] of Object.entries(keepSave)) localStorage.setItem(k, v);
  const passed = results.filter((r) => r.result === 'PASS').length;
  console.log(`[phase9] ${passed}/${results.length}`); console.table(results);
  window.__p9Results = { passed, total: results.length, results };
  return results;
}
