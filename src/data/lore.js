// Lore / codex entries (Phase 5). discovery: tablet (dungeon lore pool), quest (reward), boss
// (defeating `ref`), npc, item. `canon` marks text that adapts real sources; everything else is
// original game fiction. Short and atmospheric on purpose; the journal (J) keeps them.
const E = (id, chapter, title, text, discovery, extra = {}) => ({ id, chapter, title, text, discovery, ...extra });

export const LORE = [
  E('prophecy_1', 'prologue', 'The Prophecy of Four', '"Four will ride before the end: one to conquer, one to war, one to hunger, one to die. The first wakes beneath the First Seal." - the Blind Seer\'s reading.', { type: 'quest', ref: 'q_prologue' }, { npc: 'seer', canon: 'Inspired by Revelation 6 (the four horsemen); wording is original.' }),
  E('ashen_1', 'ch1', 'The Ash King\'s Decree', 'By decree of the Ash King, the dead shall be buried with their swords, that they may defend the seal. The dead obeyed. They are still obeying.', { type: 'tablet' }),
  E('ashen_2', 'ch1', 'Gravekeeper\'s Ledger', 'Buried today: 40. Buried yesterday: 40. Buried tomorrow: 40. The ground never fills.', { type: 'tablet' }, { enemy: 'gravekeeper' }),
  E('ashen_3', 'ch1', 'A Child\'s Scratching', 'A crown, a horse, and a lot of fire. Underneath, in a careful hand: "the white one came first".', { type: 'tablet' }),
  E('ashen_4', 'ch1', 'The Warden\'s Chains', 'The Warden chained itself to the seal willingly. The chains were for the seal, not for the Warden.', { type: 'tablet' }, { enemy: 'grave_warden' }),
  E('ashen_brother', 'ch1', 'Ansel\'s Brother', 'His name was Corran. He went down to fetch a sword for his son. The tomb you found had his initials scratched inside the lid.', { type: 'quest', ref: 'q_ch1_survivor' }, { npc: 'ansel' }),
  E('seal_1', 'ch1', 'The First Fragment', 'The first fragment of the broken seal. Whoever broke it did so from the inside.', { type: 'quest', ref: 'q_ch1_main' }),
  E('war_1', 'ch2', 'Orders of the Day', 'March to the south wall. Open the passage. Do not stop. Do not sleep. Do not stop. - signed, a name that has been burned out.', { type: 'tablet' }),
  E('war_2', 'ch2', 'The Ninth Legion', 'The Ninth never retreated. When the Abyss came, they held the wall for nine days. On the tenth they turned around.', { type: 'tablet' }),
  E('war_3', 'ch2', 'Cultist Hymnal', 'Red rider, red rider, take our peace. A hymn that is mostly screaming, written very neatly.', { type: 'tablet' }, { enemy: 'war_cultist' }),
  E('war_4', 'ch2', 'The Tyrant\'s Crown', 'He was crowned by no one. He picked it up from the field after the last king fell, and nobody argued.', { type: 'tablet' }, { enemy: 'iron_tyrant' }),
  E('seal_2', 'ch2', 'The Second Fragment', 'The army was digging toward the same place the fragments point. Someone gave them a map.', { type: 'quest', ref: 'q_ch2_main' }),
  E('harvest_1', 'ch3', 'Last Harvest Record', 'Yield: none. Yield: none. Yield: something moved in the silo.', { type: 'tablet' }),
  E('harvest_2', 'ch3', 'Ysolde\'s Notes', 'Blight does not kill plants. It changes what they want. Now they want people.', { type: 'tablet' }, { npc: 'ysolde' }),
  E('harvest_3', 'ch3', 'The Scales', 'A merchant\'s scale in the shrine, its pans welded together. Nothing weighed here could ever be fair again.', { type: 'tablet' }),
  E('harvest_4', 'ch3', 'The Reservoir', 'They drained the reservoir to water the dead fields. The Harvester was at the bottom, waiting to be thirsty.', { type: 'tablet' }, { enemy: 'hollow_harvester' }),
  E('seal_3', 'ch3', 'The Third Fragment', 'The blight was not a curse. It was a key, turning slowly in the ground.', { type: 'quest', ref: 'q_ch3_main' }),
  E('pale_1', 'ch4', 'The Count', 'Ten thousand souls taken from the threshold this year. Someone wrote the number down every night.', { type: 'tablet' }),
  E('pale_2', 'ch4', 'Ferryman\'s Complaint', 'No passengers. Not one. The river runs and the boat sits empty, and the dead go somewhere else.', { type: 'tablet' }, { npc: 'ferryman' }),
  E('pale_3', 'ch4', 'Statue Without a Face', 'The faces of every statue here were struck away. The Executor does not like to be judged.', { type: 'tablet' }),
  E('pale_4', 'ch4', 'Judgement Scales', 'The Executor weighs every soul and finds it light enough to carry away.', { type: 'tablet' }, { enemy: 'pale_executor' }),
  E('seal_4', 'ch4', 'The Fourth Fragment', 'The souls were sent through a gate below the threshold. It opens onto the Abyss.', { type: 'quest', ref: 'q_ch4_main' }),
  E('abyss_1', 'ch5', 'Prisoner\'s Wall', 'I counted the seals. There were seven. Now there are two. The jailer is the one who broke them.', { type: 'tablet' }),
  E('abyss_2', 'ch5', 'Cerberus', 'Three heads: one remembers, one forgets, one is hungry. The hungry one is in charge.', { type: 'tablet' }, { enemy: 'cerberus', canon: 'Cerberus comes from Greek myth; this description is original.' }),
  E('abyss_3', 'ch5', 'Of the Horsemen', 'The Four were never meant to end the world. They were made to stop the one who would.', { type: 'tablet' }),
  E('abyss_4', 'ch5', 'The Beast\'s Throne', 'The Beast sits where it is told. It has never once been told by the Abyss.', { type: 'tablet' }, { enemy: 'the_beast' }),
  E('revelation_abaddon', 'ch5', 'The Hand Behind the Seals', 'The sigil names him: Abaddon, the Destroyer. He broke the seals one by one and sent the Four after the world in his place.', { type: 'quest', ref: 'q_ch5_main' }, { canon: 'Abaddon / Apollyon is named in Revelation 9:11; his role here is original fiction.' }),
  E('horsemen_truth', 'ch5', 'The Truth of the Four', 'The Horsemen were the seal-keepers\' last weapon: four riders bound to the end of the world so that they would be there when it came.', { type: 'quest', ref: 'q_ch5_hidden_lore' }),
  E('rev_1', 'ch6', 'The Unwritten Page', 'Here the story is still being written. Be careful what you do; it may become true.', { type: 'tablet' }),
  E('rev_2', 'ch6', 'The Dragon\'s Oath', 'The dragon swore to burn the world once. It has been waiting a very long time to keep its word.', { type: 'tablet' }, { enemy: 'great_dragon' }),
  E('rev_3', 'ch6', 'False Signs', 'The Prophet shows you three doors. None of them are doors.', { type: 'tablet' }, { enemy: 'false_prophet' }),
  E('rev_4', 'ch6', 'The Bottomless Pit', 'It has a bottom. The Destroyer stands on it.', { type: 'tablet' }, { enemy: 'abaddon' }),
  E('ending_record', 'ch6', 'The Last Revelation', 'The Destroyer has fallen. The Last Seal is in your hand. What you did with it is written below.', { type: 'quest', ref: 'q_ch6_main' }),
  E('ending_seal', 'ch6', 'Ending: The Sealed World', 'You closed the Abyss. The Four ride the edge of the world, keeping it.', { type: 'ending', ref: 'seal' }),
  E('ending_claim', 'ch6', 'Ending: The Fifth Rider', 'You kept the Last Seal. The Abyss answers to you now.', { type: 'ending', ref: 'claim' }),
];
export const LORE_BY_ID = Object.fromEntries(LORE.map((l) => [l.id, l]));
