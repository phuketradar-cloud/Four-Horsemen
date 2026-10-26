// Phase 5 campaign data: chapters, NPCs and quests. Pure data, validated by data/registry.js.
//
// CHAPTERS (configurable count/order): each has a dungeon, a main quest and side quests. A chapter
// unlocks when the previous chapter's main quest is completed. Dungeons themselves stay replayable
// (they unlock by clearing the previous dungeon, Phase 4 rule); chapters are the STORY layer on top.
//
// QUESTS: objectives are either EVENT objectives (counted from gameplay events after you accept)
// or STATE objectives (checked against permanent progress, so doing things "early" still counts
// and nothing can be permanently missed):
//   talk {npc}                      state  - speak to the NPC with the quest active
//   boss {boss}                     state  - progress.bosses[boss] > 0
//   complete {dungeon}              state  - dungeon completed at least once
//   keyItem {item}                  state  - progress.keyItems has it (granted by quests, never random)
//   kill {enemy, count}             event  - enemyKilled with that archetype (summons excluded)
//   collect {material, count}       event  - material gained (drops, salvage, crafting)
//   craft {recipe?, count}          event  - any craft, or a specific recipe
//   secret {dungeon?, count}        event  - secret room discovered
//   puzzle {count}                  event  - puzzle solved
//   reach {dungeon, floor}          event  - arrive on that floor
//   lore {chapter, count}           state  - lore entries of that chapter discovered
//   deliver {npc, item}             state  - turn-in only: hand a key item to the NPC (consumes it)
// Rewards: xp, gold, materials {id:n}, items [{ id, rarity }], set, recipes [], keyItems [], lore [].
// Every quest reward is claimed exactly once (progress.claim('quest:<id>')).

export const CHAPTERS = [
  { id: 'prologue', num: 0, title: 'PROLOGUE', name: 'THE FIRST OMEN', dungeon: 'crypt_first_seal', mainQuest: 'q_prologue', side: [],
    intro: 'The seals that bind the end of the world are failing. A Horseman wakes beneath the First Seal - early, and alone.' },
  { id: 'ch1', num: 1, title: 'CHAPTER I', name: 'THE ASHEN KINGDOM', dungeon: 'ashen_catacombs', mainQuest: 'q_ch1_main', side: ['q_ch1_survivor', 'q_ch1_bones'],
    intro: 'A kingdom of ash and graves. Somewhere below, the first fragment of the broken seal waits with its guardian.' },
  { id: 'ch2', num: 2, title: 'CHAPTER II', name: 'THE RED WAR', dungeon: 'red_warfront', mainQuest: 'q_ch2_main', side: ['q_ch2_standards', 'q_ch2_armory'],
    intro: 'A corrupted army marches in circles around a fortress, trying to open a passage to the south.' },
  { id: 'ch3', num: 3, title: 'CHAPTER III', name: 'THE BLACK HARVEST', dungeon: 'black_harvest', mainQuest: 'q_ch3_main', side: ['q_ch3_shrine', 'q_ch3_alchemy'],
    intro: 'Fields that grow only rot. Find the source of the blight - and a relic that can resist it.' },
  { id: 'ch4', num: 4, title: 'CHAPTER IV', name: 'THE PALE THRESHOLD', dungeon: 'pale_threshold', mainQuest: 'q_ch4_main', side: ['q_ch4_spirits'],
    intro: 'Lost souls are being gathered at the boundary of life and death. Someone is counting them.' },
  { id: 'ch5', num: 5, title: 'CHAPTER V', name: 'THE ABYSSAL GATE', dungeon: 'abyssal_gate', mainQuest: 'q_ch5_main', side: ['q_ch5_hidden_lore', 'q_ch5_gorgons'],
    intro: 'An ancient prison of broken seals. Whoever is turning the Four against the world is waiting behind it.' },
  { id: 'ch6', num: 6, title: 'CHAPTER VI', name: 'THE LAST REVELATION', dungeon: 'last_revelation', mainQuest: 'q_ch6_main', side: ['q_ch6_trial'],
    intro: 'Reality and the Abyss overlap. The Destroyer has opened the last door. Close it - or take what lies beyond.' },
];

// NPCs of the Last Sanctuary (the camp). Dialogue: by chapter id (falls back to 'default'), plus
// one line per Horseman (class identity in the story).
export const NPCS = {
  maren: { id: 'maren', name: 'Elder Maren', title: 'KEEPER OF THE SEALS', portrait: 'maren', lore: 'The last of the order that guarded the seven seals. Old enough to remember when there were seven.',
    lines: {
      prologue: 'You woke beneath the First Seal? Then the seals are failing faster than I feared.',
      ch1: 'The Ashen Kingdom guarded the first fragment. Bring it back, before something else does.',
      ch2: 'The fragment burns. It points south - to the Red War.',
      ch3: 'Two fragments. The blight in the fields is not natural; nothing about this is.',
      ch4: 'Souls are going missing from the threshold. Someone is gathering an army that does not need to breathe.',
      ch5: 'The fragments agree: the hand behind this waits at the Abyssal Gate.',
      ch6: 'This is the last revelation. Whatever you choose at the end, choose it as yourself.',
      done: 'The seals are quiet. For now. Sit by the fire a while.',
      default: 'Sit, Rider. The fire still burns, and so do we.',
    },
    byClass: { conquest: '"Conquest. They called you the White Rider. Will you conquer this, too?"', war: '"War. I can smell the iron on you. Good. We need it."', famine: '"Famine. Even your shadow looks hungry. The blight will know you."', death: '"Death. I always thought I would meet you differently."' } },
  ansel: { id: 'ansel', name: 'Brother Ansel', title: 'WAR CHAPLAIN', portrait: 'ansel', lore: 'He blessed soldiers for thirty years. Now he blesses the few who still come back.',
    lines: { ch1: 'Lost souls wander the catacombs. One of them was my brother.', ch2: 'Our standards fell in the fortress. Bring them home and the men will remember who they were.', default: 'Every battle ends. Most of them end badly.' },
    byClass: { war: '"You are War itself, and still you fight for us. I will pray for you, whatever good it does."', conquest: '"A crowned rider. Our king wore a crown too."', famine: '"Hunger and war walk together. Always have."', death: '"Do not take me yet. I have work."' } },
  ysolde: { id: 'ysolde', name: 'Ysolde', title: 'HERBALIST OF THE LAST FIELD', portrait: 'ysolde', lore: 'She kept a garden alive through the blight with stubbornness and something that might be magic.',
    lines: { ch3: 'The shrine in the dead orchard has turned. Drain it, cleanse it - just stop it singing.', ch4: 'Bring me blighted things; I can make something better from them.', default: 'If it grows, I can use it. If it rots, I can still use it.' },
    byClass: { famine: '"You and I understand hunger, Rider. Help me feed the living for once."', war: '"Wipe your boots before my garden."', conquest: '"Even kings eat bread."', death: '"Everything I grow dies. I am used to you."' } },
  ferryman: { id: 'ferryman', name: 'The Ferryman', title: 'GUIDE AT THE PALE THRESHOLD', portrait: 'ferryman', lore: 'He has carried the dead across for longer than there have been names. Lately nobody pays.',
    lines: { ch4: 'The souls do not reach my boat any more. Something takes them first. Find out what.', ch5: 'The gate below the threshold was never meant to open from this side.', default: 'A coin for the crossing, Rider? No? Then just talk.' },
    byClass: { death: '"Old friend. You never needed my boat."', war: '"You have sent me a great many passengers."', famine: '"The starved are light. They cross easily."', conquest: '"Kings pay double. Tradition."' } },
  seer: { id: 'seer', name: 'The Blind Seer', title: 'SHE WHO READ THE LAST PAGE', portrait: 'seer', lore: 'She read the prophecy of the end and put out her own eyes so she would never read it again.',
    lines: { prologue: '"Four will ride before the end. The first wakes beneath the First Seal." That was the prophecy. You are early.', ch5: 'The Beast is a shield. Behind it stands the one who broke the seals.', ch6: 'At the bottom of the pit you will have a choice. The prophecy does not say what you choose.', done: 'I cannot see. But I can hear that the world is still here.', default: 'I see nothing. I know a great deal.' },
    byClass: { conquest: '"The first Horseman, on a white horse, to conquer."', war: '"The second, on a red horse, to take peace from the earth."', famine: '"The third, on a black horse, with a pair of scales."', death: '"The fourth, on a pale horse - and Hell followed with him."' } },
};

const Q = (id, o) => ({ id, side: false, prereq: [], turnIn: null, rewards: {}, ...o });
export const QUESTS = [
  // ---------------------------------------------------------------- prologue
  Q('q_prologue', { chapter: 'prologue', name: 'The First Omen', npc: 'seer', desc: 'Discover why the seals are failing: break the First Seal in the crypt, then hear the prophecy at the Last Sanctuary.',
    objectives: [{ type: 'complete', dungeon: 'crypt_first_seal', text: 'Break the First Seal (complete the prologue crypt)' }, { type: 'talk', npc: 'seer', text: 'Hear the Blind Seer\'s prophecy' }],
    rewards: { xp: 150, gold: 50, materials: { iron_shard: 5 }, lore: ['prophecy_1'] } }),
  // ---------------------------------------------------------------- chapter I
  Q('q_ch1_main', { chapter: 'ch1', name: 'The First Fragment', npc: 'maren', turnIn: 'maren', desc: 'Recover the first fragment of the broken seal from the Grave Warden in the Ashen Catacombs.',
    objectives: [{ type: 'talk', npc: 'maren', text: 'Speak with Elder Maren' }, { type: 'boss', boss: 'gravekeeper', text: 'Defeat the Gravekeeper (Catacombs, floor 1)' }, { type: 'boss', boss: 'grave_warden', text: 'Defeat the Grave Warden' }, { type: 'deliver', npc: 'maren', item: 'seal_fragment_1', text: 'Bring the First Fragment to Maren' }],
    grantOnBoss: { grave_warden: 'seal_fragment_1' },
    rewards: { xp: 600, gold: 200, items: [{ id: 'heart_first_seal' }], lore: ['seal_1'] } }),
  Q('q_ch1_survivor', { chapter: 'ch1', side: true, name: 'Ansel\'s Brother', npc: 'ansel', turnIn: 'ansel', desc: 'Brother Ansel\'s brother was lost in the catacombs. Put the restless dead to rest and search the hidden tombs.',
    objectives: [{ type: 'kill', enemy: 'skeleton', count: 8, text: 'Lay 8 Hollow Skeletons to rest' }, { type: 'secret', dungeon: 'ashen_catacombs', count: 1, text: 'Search a hidden tomb in the catacombs' }],
    rewards: { xp: 300, gold: 120, set: 'gravekeeper', lore: ['ashen_brother'] } }),
  Q('q_ch1_bones', { chapter: 'ch1', side: true, name: 'A Cursed Blade', npc: 'maren', turnIn: 'maren', desc: 'Maren knows an old recipe for a grave-forged sword. Gather the materials and forge one.',
    objectives: [{ type: 'collect', material: 'bone_fragment', count: 10, text: 'Gather 10 Bone Fragments' }, { type: 'craft', recipe: 'forge_grave_sword', count: 1, text: 'Forge a Grave-Forged Sword at the camp forge' }],
    rewards: { xp: 250, materials: { lesser_soul_fragment: 3, rusted_iron: 8 } } }),
  // ---------------------------------------------------------------- chapter II
  Q('q_ch2_main', { chapter: 'ch2', name: 'The Corrupted Army', npc: 'maren', turnIn: 'maren', desc: 'Stop the corrupted army from opening its passage south: defeat the Iron Tyrant and take the second fragment.',
    objectives: [{ type: 'reach', dungeon: 'red_warfront', floor: 1, text: 'Break through to the inner keep (floor 2)' }, { type: 'boss', boss: 'iron_tyrant', text: 'Defeat the Iron Tyrant' }, { type: 'deliver', npc: 'maren', item: 'seal_fragment_2', text: 'Bring the Second Fragment to Maren' }],
    grantOnBoss: { iron_tyrant: 'seal_fragment_2' },
    rewards: { xp: 1600, gold: 400, set: 'warforged_legion', lore: ['seal_2'] } }),
  Q('q_ch2_standards', { chapter: 'ch2', side: true, name: 'Lost Battle Standards', npc: 'ansel', turnIn: 'ansel', desc: 'Defeat the cultists who desecrated the standards of the old legion.',
    objectives: [{ type: 'kill', enemy: 'war_cultist', count: 4, text: 'Silence 4 War Cultists' }, { type: 'kill', enemy: 'executioner', count: 2, text: 'Defeat 2 Iron Executioners' }],
    rewards: { xp: 700, gold: 250, items: [{ id: 'ninth_legion_banner' }] } }),
  Q('q_ch2_armory', { chapter: 'ch2', side: true, name: 'The Hidden Armory', npc: 'ansel', desc: 'Find the fortress\'s hidden arsenal.',
    objectives: [{ type: 'secret', dungeon: 'red_warfront', count: 1, text: 'Discover a secret room in the Red Warfront' }],
    rewards: { xp: 500, materials: { broken_weapon_core: 2, tempered_iron: 6 } } }),
  // ---------------------------------------------------------------- chapter III
  Q('q_ch3_main', { chapter: 'ch3', name: 'Source of the Blight', npc: 'maren', turnIn: 'maren', desc: 'Find the source of the blight and recover a relic that can resist it.',
    objectives: [{ type: 'boss', boss: 'hollow_harvester', text: 'Defeat the Hollow Harvester' }, { type: 'deliver', npc: 'maren', item: 'seal_fragment_3', text: 'Bring the Third Fragment to Maren' }],
    grantOnBoss: { hollow_harvester: 'seal_fragment_3' },
    rewards: { xp: 3500, gold: 700, items: [{ id: 'scales_last_harvest' }, { id: 'empty_chalice', classOnly: 'famine' }], lore: ['seal_3'] } }),
  Q('q_ch3_shrine', { chapter: 'ch3', side: true, name: 'The Singing Shrine', npc: 'ysolde', turnIn: 'ysolde', desc: 'The corrupted shrines must be silenced. Solve the harvest altar\'s runes.',
    objectives: [{ type: 'puzzle', count: 1, dungeon: 'black_harvest', text: 'Solve a puzzle in the Black Harvest' }, { type: 'kill', enemy: 'harvester', count: 1, text: 'Defeat a Hollow Harvester (elite)' }],
    rewards: { xp: 1200, gold: 300, items: [{ id: 'locust_hood', classOnly: 'famine' }, { id: 'blightroot_sickle', classOnly: 'famine' }], materials: { corrupted_catalyst: 2 } } }),
  Q('q_ch3_alchemy', { chapter: 'ch3', side: true, name: 'Rare Alchemy', npc: 'ysolde', turnIn: 'ysolde', desc: 'Bring Ysolde blighted essences; she will teach you a purifying brew.',
    objectives: [{ type: 'collect', material: 'blighted_essence', count: 6, text: 'Gather 6 Blighted Essence' }],
    rewards: { xp: 800, recipes: ['purifying_draught'], materials: { withered_root: 6 } } }),
  // ---------------------------------------------------------------- chapter IV
  Q('q_ch4_main', { chapter: 'ch4', name: 'The Gathering of Souls', npc: 'ferryman', turnIn: 'ferryman', desc: 'Enter the realm where lost souls are gathered, defeat the Pale Executor and learn who commands it.',
    objectives: [{ type: 'talk', npc: 'ferryman', text: 'Speak with the Ferryman' }, { type: 'boss', boss: 'pale_executor', text: 'Defeat the Pale Executor' }, { type: 'deliver', npc: 'ferryman', item: 'seal_fragment_4', text: 'Show the Ferryman the Fourth Fragment' }],
    grantOnBoss: { pale_executor: 'seal_fragment_4' },
    rewards: { xp: 6000, gold: 1200, items: [{ id: 'pale_crown', classOnly: 'death' }, { id: 'requiem_scythe', classOnly: 'death' }, { id: 'gravecaller_gloves', classOnly: 'death' }], lore: ['seal_4'] } }),
  Q('q_ch4_spirits', { chapter: 'ch4', side: true, name: 'Lost Spirits', npc: 'ferryman', turnIn: 'ferryman', desc: 'Free the spirits bound in the threshold\'s reliquaries.',
    objectives: [{ type: 'secret', dungeon: 'pale_threshold', count: 1, text: 'Open a Secret Reliquary' }, { type: 'kill', enemy: 'revenant', count: 6, text: 'Release 6 Pale Revenants' }],
    rewards: { xp: 2500, items: [{ id: 'ferrymans_coin' }], materials: { condensed_soul: 3 } } }),
  // ---------------------------------------------------------------- chapter V
  Q('q_ch5_main', { chapter: 'ch5', name: 'Behind the Gate', npc: 'seer', turnIn: 'seer', desc: 'Discover who is manipulating the four apocalyptic forces: pass Cerberus and defeat the Beast.',
    objectives: [{ type: 'talk', npc: 'seer', text: 'Ask the Blind Seer about the Gate' }, { type: 'boss', boss: 'cerberus', text: 'Defeat Cerberus at the gate' }, { type: 'boss', boss: 'the_beast', text: 'Defeat the Beast' }, { type: 'deliver', npc: 'seer', item: 'beast_sigil', text: 'Bring the Beast\'s sigil to the Seer' }],
    grantOnBoss: { the_beast: 'beast_sigil' },
    rewards: { xp: 12000, gold: 2000, items: [{ id: 'unerring_arrow', classOnly: 'conquest' }, { id: 'red_kings_mantle', classOnly: 'war' }, { id: 'crown_of_dominion', classOnly: 'conquest' }, { id: 'gorefist', classOnly: 'war' }], lore: ['revelation_abaddon'] } }),
  Q('q_ch5_hidden_lore', { chapter: 'ch5', side: true, name: 'The Horsemen\'s Secret', npc: 'seer', turnIn: 'seer', desc: 'Lore about the Horsemen is hidden in the Abyssal Gate. Read it.',
    objectives: [{ type: 'lore', chapter: 'ch5', count: 2, text: 'Discover 2 lore entries of the Abyssal Gate' }],
    rewards: { xp: 3000, lore: ['horsemen_truth'], materials: { mythic_essence: 1 } } }),
  Q('q_ch5_gorgons', { chapter: 'ch5', side: true, name: 'Eyes of Stone', npc: 'ferryman', turnIn: 'ferryman', desc: 'Gorgons petrify pilgrims at the gate. Thin their numbers.',
    objectives: [{ type: 'kill', enemy: 'gorgon', count: 5, text: 'Defeat 5 Gorgons' }],
    rewards: { xp: 4000, items: [{ id: 'gorgons_eye' }] } }),
  // ---------------------------------------------------------------- chapter VI
  Q('q_ch6_main', { chapter: 'ch6', name: 'The Last Revelation', npc: 'seer', turnIn: 'seer', desc: 'Descend through the collapsing realm, defeat the Great Dragon and Abaddon, and decide the fate of the broken world.',
    objectives: [{ type: 'boss', boss: 'false_prophet', text: 'Silence the False Prophet' }, { type: 'boss', boss: 'great_dragon', text: 'Slay the Great Dragon' }, { type: 'boss', boss: 'abaddon', text: 'Defeat Abaddon, the Destroyer' }, { type: 'deliver', npc: 'seer', item: 'last_seal', text: 'Bring the Last Seal to the Seer - and choose' }],
    grantOnBoss: { abaddon: 'last_seal' }, ending: true,
    rewards: { xp: 25000, gold: 5000, materials: { mythic_essence: 2 }, lore: ['ending_record'] } }),
  Q('q_ch6_trial', { chapter: 'ch6', side: true, name: 'Trial of the Horsemen', npc: 'maren', turnIn: 'maren', desc: 'A repeatable-in-spirit challenge: clear the Trial room and complete the Last Revelation on Veteran.',
    objectives: [{ type: 'complete', dungeon: 'last_revelation', difficulty: 'veteran', text: 'Complete the Last Revelation on VETERAN' }],
    rewards: { xp: 15000, items: [{ id: 'nephilim_girdle' }], materials: { abaddon_shard: 1 } } }),
];

// Key items (quest items, never in the bag, never random).
export const KEY_ITEMS = {
  seal_fragment_1: { name: 'First Seal Fragment', desc: 'Warm, and heavier than stone should be.' },
  seal_fragment_2: { name: 'Second Seal Fragment', desc: 'It smells of iron and smoke.' },
  seal_fragment_3: { name: 'Third Seal Fragment', desc: 'Grain sprouts wherever it is set down.' },
  seal_fragment_4: { name: 'Fourth Seal Fragment', desc: 'Cold. Something on the other side is knocking.' },
  beast_sigil: { name: 'Sigil of the Beast', desc: 'A brand with a name you cannot read. The Seer can.' },
  last_seal: { name: 'The Last Seal', desc: 'The final seal, taken from the Destroyer. It can close the Abyss - or open it for you.' },
};

// The one supported story choice (tracked in the save): what to do with the Last Seal.
export const ENDINGS = {
  seal: { id: 'seal', title: 'THE SEALED WORLD', text: 'You press the Last Seal into the pit. The Abyss closes like an eye. The Four ride on - not as the end of the world, but as the guards of its edge. The Sanctuary lights its fires again.', reward: { lore: ['ending_seal'] } },
  claim: { id: 'claim', title: 'THE FIFTH RIDER', text: 'You keep the Last Seal. The Abyss bows instead of closing. The world survives, because you allow it to. In the Sanctuary they light their fires and do not look at you directly.', reward: { lore: ['ending_claim'], materials: { abaddon_shard: 1 } } },
};
