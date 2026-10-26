// Phase 5 equipment catalog: hundreds of base items built from data TEMPLATES, not copy-pasted.
//   base item = item FAMILY (what it is: slot, category, weapon behaviour, base stat profile, icon, lore)
//             x material TIER (what it is made of: item-level band, power multiplier, tags, lore)
// Every generated base has a stable id `<family>_<tier>` (e.g. `hammer_hellforged`), a curated
// display name "<Tier> <Noun>" (e.g. "Hellforged War Hammer"), lore, slot, category, icon,
// stats, allowed rarities, affix tags, item-level window and loot source. Item INSTANCES (rarity,
// rolls, affixes, uid, seed) are still produced by ItemGenerator: base + ilvl + rarity + affixes.
//
// Tags drive affix compatibility (see affixes.js `requires`): fire / blight / spectral / abyss /
// curse items unlock their themed affixes; ranged / twoHanded come from the weapon behaviour.

// ---------------------------------------------------------------- material tiers
// ilvl: [min, max] window the base drops in; mult scales its base stats / weapon damage.
// only: families allowed to use this tier (null = all); dungeons: exclusive sources (optional).
export const TIERS = {
  rusted: { adj: 'Rusted', ilvl: [1, 10], mult: 0.92, tags: [], source: 'prologue / Ashen', lore: 'Pitted by centuries in the damp.', metal: true },
  iron: { adj: 'Iron', ilvl: [1, 14], mult: 1.0, tags: [], source: 'Ashen Kingdom', lore: 'Plain, honest iron from the old kingdom.', metal: true },
  gravesteel: { adj: 'Gravesteel', ilvl: [6, 22], mult: 1.06, tags: ['curse'], source: 'Ashen Kingdom / Red War', lore: 'Steel quenched in grave-water; it is always cold.', metal: true },
  warforged: { adj: 'Warforged', ilvl: [12, 28], mult: 1.1, tags: [], source: 'Red War', lore: 'Forged for the endless siege.', metal: true },
  hellforged: { adj: 'Hellforged', ilvl: [18, 40], mult: 1.15, tags: ['fire'], source: 'Red War / Black Harvest', lore: 'Smelted over a fire that was never lit by men.', metal: true },
  blightwoven: { adj: 'Blightwoven', ilvl: [20, 38], mult: 1.13, tags: ['blight'], source: 'Black Harvest', lore: 'Threaded with roots that still drink.' },
  pale: { adj: 'Pale', ilvl: [30, 50], mult: 1.19, tags: ['spectral'], source: 'Pale Threshold', lore: 'Bleached at the boundary of life and death.' },
  abyssal: { adj: 'Abyssal', ilvl: [38, 50], mult: 1.24, tags: ['abyss', 'fire'], source: 'Abyssal Gate / Last Revelation', lore: 'Pulled from the expanding Abyss. It hums.', dungeons: ['abyssal_gate', 'last_revelation'] },
};

const ALL_TIERS = Object.keys(TIERS);
const METAL = ALL_TIERS.filter((t) => TIERS[t].metal || t === 'pale' || t === 'abyssal');
const CLOTH = ['iron', 'gravesteel', 'blightwoven', 'pale', 'abyssal', 'hellforged'];

// ---------------------------------------------------------------- families
// base: { stat: [valueAtIlvl0, perItemLevel] } as in items.js. weaponId: behaviour archetype.
// Noun is the item word; `adjOverride` gives tiers a better word for some families (Pale Hood).
const F = [];
const fam = (id, o) => F.push({ id, tiers: METAL, rarities: null, ...o });

// ---- main hand (weapon behaviours in weapons.js)
fam('sword', { noun: 'Sword', slot: 'mainHand', kind: 'weapon', category: 'Sword', weaponId: 'sword', icon: 'sword', dmgMult: 1.0, lore: 'A straight blade for a steady hand.' });
fam('greatsword', { noun: 'Greatsword', slot: 'mainHand', kind: 'weapon', category: 'Greatsword', weaponId: 'greatsword', icon: 'longsword', dmgMult: 1.0, base: { heavyBonusFlat: [0, 0] }, lore: 'Two hands, one swing, one less enemy. Two-handed.' });
fam('axe', { noun: 'Axe', slot: 'mainHand', kind: 'weapon', category: 'Axe', weaponId: 'axe', icon: 'axe', dmgMult: 1.0, lore: 'A broad head that cleaves through ranks. Two-handed.' });
fam('hammer', { noun: 'War Hammer', slot: 'mainHand', kind: 'weapon', category: 'War Hammer', weaponId: 'hammer', icon: 'hammer', dmgMult: 1.0, base: { armorPen: [1, 0.1] }, lore: 'It does not cut armour; it folds it. Two-handed.' });
fam('dagger', { noun: 'Dagger', slot: 'mainHand', kind: 'weapon', category: 'Dagger', weaponId: 'dagger', icon: 'dagger', dmgMult: 1.0, lore: 'Quick, quiet and close.' });
fam('spear', { noun: 'Spear', slot: 'mainHand', kind: 'weapon', category: 'Spear', weaponId: 'spear', icon: 'spear', dmgMult: 1.0, lore: 'Reaches two tiles: strike before they strike you.' });
fam('scythe', { noun: 'Scythe', slot: 'mainHand', kind: 'weapon', category: 'Scythe', weaponId: 'scythe', icon: 'scythe', dmgMult: 1.0, base: { executeDmg: [2, 0.1] }, tiers: ['rusted', 'iron', 'gravesteel', 'blightwoven', 'pale', 'abyssal'], lore: 'A harvest tool turned to darker work. Two-handed.' });
fam('crossbow', { noun: 'Crossbow', slot: 'mainHand', kind: 'weapon', category: 'Crossbow', weaponId: 'crossbow', icon: 'crossbow', dmgMult: 1.0, lore: 'Slow to load, hard to stop. Two-handed.' });
fam('bow', { noun: 'Longbow', slot: 'mainHand', kind: 'weapon', category: 'Bow', weaponId: 'bow', icon: 'bow', dmgMult: 1.0, tiers: ['rusted', 'iron', 'gravesteel', 'warforged', 'blightwoven', 'pale', 'abyssal'], lore: 'Fast arrows down long corridors. Two-handed.' });
fam('cursed_blade', { noun: 'Cursed Blade', slot: 'mainHand', kind: 'weapon', category: 'Cursed Weapon', weaponId: 'sword', icon: 'cursedblade', dmgMult: 0.95, base: { curseDmg: [4, 0.15], skillPower: [3, 0.2] }, tiers: ['gravesteel', 'hellforged', 'blightwoven', 'pale', 'abyssal'], extraTags: ['curse'], lore: 'It wants to be used. That is the curse.' });

// ---- head
fam('helm', { noun: 'Helm', slot: 'head', kind: 'armor', category: 'Helmet', icon: 'helm', base: { def: [0.8, 0.22], hp: [4, 1.3] }, lore: 'Steel between your skull and the end of the world.' });
fam('crown', { noun: 'Crown', slot: 'head', kind: 'armor', category: 'Crown', icon: 'crown', base: { crit: [1.5, 0.08], def: [0.4, 0.15] }, lore: 'Every crown here belonged to a dead king.' });
fam('mask', { noun: 'Mask', slot: 'head', kind: 'armor', category: 'Mask', icon: 'mask', base: { evasion: [1.5, 0.08], accuracy: [2, 0.15] }, tiers: CLOTH, lore: 'A face for the faceless.' });
fam('hood', { noun: 'Hood', slot: 'head', kind: 'armor', category: 'Hood', icon: 'hood', base: { wis: [1, 0.25], resist: [2, 0.4] }, tiers: CLOTH, lore: 'Shadows gather inside it.' });
fam('circlet', { noun: 'Circlet', slot: 'head', kind: 'armor', category: 'Circlet', icon: 'crown', base: { int: [1, 0.25], skillPower: [2, 0.35] }, lore: 'A thin band that hums with old words.' });
fam('headdress', { noun: 'Ritual Headdress', slot: 'head', kind: 'armor', category: 'Ritual Headpiece', icon: 'headdress', base: { resGain: [3, 0.12], statusResist: [3, 0.3] }, tiers: CLOTH, lore: 'Antlers, bone and feathers, worn for rites best forgotten.' });
// ---- chest
fam('plate', { noun: 'Plate Armour', slot: 'chest', kind: 'armor', category: 'Heavy Armor', icon: 'plate', base: { def: [1.4, 0.38], hp: [7, 1.8] }, lore: 'Heavy, loud, and it keeps you alive.' });
fam('jerkin', { noun: 'Jerkin', slot: 'chest', kind: 'armor', category: 'Light Armor', icon: 'jerkin', base: { def: [0.9, 0.22], evasion: [2, 0.15] }, tiers: CLOTH, lore: 'Light enough to run in.' });
fam('robe', { noun: 'Robe', slot: 'chest', kind: 'armor', category: 'Cursed Robe', icon: 'robe', base: { def: [0.8, 0.22], skillPower: [3, 0.6], resist: [3, 0.4] }, tiers: CLOTH, extraTags: ['curse'], lore: 'Stitched from shrouds. The stitches move.' });
fam('bonemail', { noun: 'Bonemail', slot: 'chest', kind: 'armor', category: 'Bone Armor', icon: 'bonemail', base: { def: [1.1, 0.3], statusResist: [3, 0.3], hp: [4, 1] }, tiers: ['rusted', 'gravesteel', 'blightwoven', 'pale', 'abyssal'], lore: 'Ribs of the faithful, laced with wire.' });
fam('regalia', { noun: 'Regalia', slot: 'chest', kind: 'armor', category: 'Ceremonial Armor', icon: 'regalia', base: { def: [1.1, 0.28], lck: [1, 0.2], crit: [1, 0.05] }, lore: 'Gilded armour of a court that no longer exists.' });
fam('vestments', { noun: 'Vestments', slot: 'chest', kind: 'armor', category: 'Apocalyptic Vestments', icon: 'robe', base: { def: [1, 0.28], hpPct: [2, 0.06], resGain: [3, 0.1] }, tiers: ['hellforged', 'blightwoven', 'pale', 'abyssal'], lore: 'Robes of the last priests, singed at the hem.' });
// ---- hands
fam('gauntlets', { noun: 'Gauntlets', slot: 'hands', kind: 'armor', category: 'Gauntlets', icon: 'gauntlet', base: { atk: [1.4, 0.36], def: [0.4, 0.15] }, lore: 'Steel knuckles for steel work.' });
fam('gloves', { noun: 'Gloves', slot: 'hands', kind: 'armor', category: 'Gloves', icon: 'wraps', base: { atkSpeed: [2, 0.12], dex: [1, 0.2] }, tiers: CLOTH, lore: 'Supple leather, worn thin at the fingertips.' });
fam('bracers', { noun: 'Bracers', slot: 'hands', kind: 'armor', category: 'Bracers', icon: 'bracers', base: { def: [0.6, 0.18], armorPen: [0.5, 0.08] }, lore: 'Banded guards that turn aside a blade.' });
fam('wraps', { noun: 'Ritual Wraps', slot: 'hands', kind: 'armor', category: 'Ritual Wraps', icon: 'wraps', base: { int: [1, 0.22], dotDmg: [2, 0.15] }, tiers: CLOTH, extraTags: ['curse'], lore: 'Bandages inked with prayers to nothing.' });
fam('marksman_gloves', { noun: 'Marksman Gloves', slot: 'hands', kind: 'armor', category: 'Precision Gloves', icon: 'wraps', base: { accuracy: [3, 0.25], crit: [1, 0.06] }, tiers: CLOTH, lore: 'Cut away at the trigger finger.' });
// ---- legs
fam('greaves', { noun: 'Greaves', slot: 'legs', kind: 'armor', category: 'Greaves', icon: 'greaves', base: { def: [1, 0.22], hp: [5, 1.1] }, lore: 'Plated shins for long marches.' });
fam('legplates', { noun: 'Legplates', slot: 'legs', kind: 'armor', category: 'Leg Armor', icon: 'greaves', base: { def: [1.2, 0.28], damageReduction: [1, 0.04] }, lore: 'Full leg armour. Slow, and safe.' });
fam('boots', { noun: 'Boots', slot: 'legs', kind: 'armor', category: 'Boots', icon: 'boots', base: { moveSpeed: [2, 0.12], evasion: [1, 0.08] }, tiers: CLOTH, lore: 'They know the way out.' });
fam('leggings', { noun: 'Leggings', slot: 'legs', kind: 'armor', category: 'Cursed Leggings', icon: 'boots', base: { hp: [3, 0.9], curseDmg: [2, 0.12] }, tiers: ['gravesteel', 'hellforged', 'blightwoven', 'pale', 'abyssal'], extraTags: ['curse'], lore: 'Cold to the touch, even by the fire.' });
fam('striders', { noun: 'Striders', slot: 'legs', kind: 'armor', category: 'Spectral Footwear', icon: 'boots', base: { moveSpeed: [3, 0.1], resist: [2, 0.3] }, tiers: ['pale', 'abyssal', 'blightwoven'], extraTags: ['spectral'], lore: 'They leave no prints. Sometimes no feet either.' });
// ---- off hand
fam('shield', { noun: 'Shield', slot: 'offHand', kind: 'offhand', category: 'Shield', icon: 'shield', base: { def: [1.4, 0.36], damageReduction: [2, 0.12] }, classes: ['war', 'death'], lore: 'A wall you can carry. Not with two-handed weapons.' });
fam('tome', { noun: 'Grimoire', slot: 'offHand', kind: 'offhand', category: 'Grimoire', icon: 'tome', base: { skillPower: [5, 1.0], int: [1, 0.3] }, classes: ['famine', 'death', 'conquest'], tiers: CLOTH, lore: 'Pages of dead tongues.' });
fam('charm', { noun: 'Talisman', slot: 'offHand', kind: 'offhand', category: 'Talisman', icon: 'talisman', base: { resGain: [3, 0.3], wis: [1, 0.25] }, tiers: CLOTH, lore: 'A charm of bone and iron.' });
fam('focus', { noun: 'Focus', slot: 'offHand', kind: 'offhand', category: 'Spell Focus', icon: 'orb', base: { skillPower: [3, 0.6], resEff: [1, 0.1] }, classes: ['famine', 'death', 'conquest'], tiers: CLOTH, lore: 'A clouded sphere. Something looks back.' });
fam('parrying_dagger', { noun: 'Parrying Dagger', slot: 'offHand', kind: 'offhand', category: 'Secondary Weapon', icon: 'parry', base: { crit: [1, 0.08], atkSpeed: [2, 0.1] }, classes: ['conquest', 'war', 'death'], lore: 'For the other hand, and the other enemy.' });
fam('relic_shard', { noun: 'Relic Shard', slot: 'offHand', kind: 'offhand', category: 'Relic Fragment', icon: 'shardRelic', base: { hp: [4, 1], resist: [2, 0.3] }, tiers: ['gravesteel', 'hellforged', 'blightwoven', 'pale', 'abyssal'], lore: 'A piece of something holy, held like a shield.' });
// ---- rings
fam('signet_ring', { noun: 'Signet', slot: 'ring', kind: 'ring', category: 'Signet', icon: 'signet', base: { lck: [1.5, 0.3] }, lore: 'Bears the crest of a house that fell.' });
fam('cursed_ring', { noun: 'Cursed Ring', slot: 'ring', kind: 'ring', category: 'Cursed Ring', icon: 'ring', base: { curseDmg: [3, 0.15], atk: [0.5, 0.15] }, tiers: ['gravesteel', 'hellforged', 'blightwoven', 'pale', 'abyssal'], extraTags: ['curse'], lore: 'It will not come off. You stopped trying.' });
fam('soul_ring', { noun: 'Soul Ring', slot: 'ring', kind: 'ring', category: 'Soul Ring', icon: 'soulring', base: { resGain: [3, 0.15], hp: [2, 0.6] }, lore: 'A captive soul for a gem.' });
fam('war_ring', { noun: 'War Ring', slot: 'ring', kind: 'ring', category: 'War Ring', icon: 'ring', base: { atk: [1, 0.25] }, lore: 'Worn on the sword hand.' });
fam('precision_ring', { noun: 'Band of Precision', slot: 'ring', kind: 'ring', category: 'Precision Ring', icon: 'ring', base: { accuracy: [2, 0.2], crit: [0.6, 0.05] }, lore: 'Thin as a hair, true as a line.' });
fam('warding_ring', { noun: 'Warding Ring', slot: 'ring', kind: 'ring', category: 'Resistance Ring', icon: 'ring', base: { resist: [3, 0.35], statusResist: [2, 0.2] }, lore: 'Engraved against curses, inside and out.' });
// ---- relics (stat relics; curated relics with effects live in uniqueItems.js)
fam('artifact', { noun: 'Artifact', slot: 'relic', kind: 'relic', category: 'Ancient Artifact', icon: 'lantern', base: { hp: [3, 0.9], skillPower: [2, 0.3] }, tiers: ['iron', 'gravesteel', 'hellforged', 'pale', 'abyssal'], lore: 'Older than any kingdom you know.' });
fam('seal', { noun: 'Seal', slot: 'relic', kind: 'relic', category: 'Seal', icon: 'sealRelic', base: { def: [0.6, 0.18], resist: [2, 0.3] }, tiers: ['gravesteel', 'hellforged', 'pale', 'abyssal'], lore: 'One of the lesser seals. It still holds something back.' });
fam('idol', { noun: 'Idol', slot: 'relic', kind: 'relic', category: 'Corrupted Relic', icon: 'idol', base: { atkPct: [2, 0.06], hp: [2, 0.6] }, tiers: ['gravesteel', 'hellforged', 'blightwoven', 'abyssal'], extraTags: ['curse'], lore: 'Prayed to by people who should have known better.' });
fam('reliquary', { noun: 'Reliquary', slot: 'relic', kind: 'relic', category: 'Divine Relic', icon: 'reliquary', base: { hpPct: [1.5, 0.05], statusResist: [2, 0.2] }, tiers: ['iron', 'gravesteel', 'pale', 'abyssal'], lore: 'A saint\'s finger in a silver box.' });
fam('fragment', { noun: 'Apocalyptic Fragment', slot: 'relic', kind: 'relic', category: 'Apocalyptic Fragment', icon: 'shardRelic', base: { atk: [1, 0.25], crit: [0.8, 0.05] }, tiers: ['hellforged', 'pale', 'abyssal'], lore: 'A splinter of the end of the world.' });
fam('totem', { noun: 'Totem', slot: 'relic', kind: 'relic', category: 'Mythological Object', icon: 'totem', base: { resGain: [3, 0.12], lck: [1, 0.15] }, tiers: ['iron', 'warforged', 'blightwoven', 'pale', 'abyssal'], lore: 'Carved from a beast older than names.' });

export const FAMILIES = Object.fromEntries(F.map((f) => [f.id, f]));

// Builds every family x tier base definition (pure data, deterministic).
export function buildCatalog() {
  const out = [];
  for (const f of F) {
    for (const tid of f.tiers) {
      const t = TIERS[tid];
      if (!t) continue;
      const base = {};
      for (const [k, [b, per]] of Object.entries(f.base || {})) {
        if (k === 'heavyBonusFlat') continue;
        base[k] = [+(b * t.mult).toFixed(2), +(per * t.mult).toFixed(3)];
      }
      const tags = [...new Set([...(t.tags || []), ...(f.extraTags || [])])];
      out.push({
        id: `${f.id}_${tid}`, family: f.id, tier: tid, noun: f.noun, tierAdj: t.adj,
        name: `${t.adj} ${f.noun}`, kind: f.kind, type: f.kind === 'weapon' ? 'weapon' : f.kind === 'relic' ? 'relic' : 'armor',
        slot: f.slot, category: f.category, icon: f.icon, weaponId: f.weaponId, dmgMult: f.kind === 'weapon' ? +(f.dmgMult * t.mult).toFixed(3) : undefined,
        base, classes: f.classes || null, tags, catalog: true,
        minIlvl: t.ilvl[0], maxIlvl: t.ilvl[1], rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        dungeons: t.dungeons || null, source: t.source,
        value: Math.round(14 * t.mult * (f.kind === 'weapon' ? 2 : 1.4)), stack: 1,
        desc: `${f.lore} ${t.lore}`,
      });
    }
  }
  return out;
}
