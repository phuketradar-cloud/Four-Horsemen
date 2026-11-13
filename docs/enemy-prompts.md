# Prompt ศัตรู 26 แบบ (1 ภาพต่อตัว รวม 4 ท่า)

แต่ละ prompt สร้างภาพ **สี่เหลี่ยมจัตุรัส 1:1** แบ่งเป็นตาราง 2×2 ตัวเดียวกัน 4 ท่า:

| ช่อง | ท่า |
|---|---|
| ซ้ายบน | idle (ยืน) |
| ขวาบน | windup (ง้าง) |
| ซ้ายล่าง | attack (โจมตี) |
| ขวาล่าง | hurt (โดนตี) |

- ตั้งชื่อไฟล์เป็น **ชื่อ sprite** เช่น `crawler.jpg` แล้วส่งมา ผมจะแบ่งเป็น 4 ท่าและ bake ให้เอง
- ทุกตัวใช้พื้นเขียว (#00FF00) ห้ามมีสีเขียวบนตัวศัตรู
- ถ้าตัวไหนออกมาตัวใหญ่ไม่เท่ากันในแต่ละช่อง หรือล้นเข้าช่องข้างๆ ให้สร้างใหม่ เพราะต้องตัดตามช่อง
- สัตว์ตัวใหญ่หรือยาว (มังกร, Chimera, Cerberus) จะถูกย่อให้พอดีช่อง เป็นเรื่องปกติ

**Negative prompt (ใช้ได้ทุกตัว):**
```
text, letters, labels, numbers, panel borders, dividing lines, frames, back view, cropped, cut off, overlapping panels, different characters in different panels, background scenery, floor, shadow, gradient background, white background, green on the character, green light, watermark
```

---

## Ashen Catacombs

### 1. `crawler` — Grave Crawler
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: a Grave Crawler, a fast low-to-the-ground corpse-eating creature from the catacombs: pale grey-brown leathery skin stretched over long bony limbs, six spindly legs, a hunched spiny back covered in grave dirt, a wide head with many small black eyes and a jaw full of needle teeth.
TOP-LEFT idle: crouched low on all legs, head raised, sniffing.
TOP-RIGHT windup: reared back on its hind legs, front claws raised, jaws open wide.
BOTTOM-LEFT attack: lunging forward at the viewer, claws and jaws extended in a bite.
BOTTOM-RIGHT hurt: recoiling and twisted sideways, legs curled, dust and dark ichor spraying from its side.
```

### 2. `warden` — The Grave Warden (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: The Grave Warden, a massive undead guardian chained to an ancient burial seal: hulking skeletal giant in cracked bone-white and rusted iron armor, heavy broken chains wrapped around its arms and dragging from its wrists, a stone seal fragment fused to its chest glowing faint pale gold, a hollow skull helm, wielding a huge stone-headed maul.
TOP-LEFT idle: standing tall, maul resting head-down in front, chains hanging.
TOP-RIGHT windup: maul lifted high over its head with both hands, chains swinging.
BOTTOM-LEFT attack: slamming the maul down toward the viewer, cracks and dust bursting.
BOTTOM-RIGHT hurt: staggering back, bone shards flying from its chest seal, one knee buckling.
```

## Red Warfront

### 3. `legionnaire` — Fallen Legionnaire
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Fallen Legionnaire, an undead soldier of a lost war: dented blackened iron segmented armor over a torn dark red tunic, a crested helm with an empty dark face and two red ember eyes, a large rectangular scarred red-and-iron shield, a short broad stabbing sword.
TOP-LEFT idle: drilled stance, shield up in front, sword ready at the side.
TOP-RIGHT windup: sword drawn back behind the shield, shoulder braced.
BOTTOM-LEFT attack: thrusting the sword forward past the shield toward the viewer.
BOTTOM-RIGHT hurt: knocked back, shield dropped low, helm tilted, sparks off the armor.
```

### 4. `hound` — War Hound
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: a War Hound bred for an endless war: a lean scarred black-and-rust mastiff, patches of bare red muscle, a spiked iron collar and torn iron barding plates, glowing ember-red eyes, bared yellow fangs.
TOP-LEFT idle: standing facing the viewer, head low, growling.
TOP-RIGHT windup: crouched back on its haunches, ready to spring, snarling.
BOTTOM-LEFT attack: leaping at the viewer, jaws wide open, front paws forward.
BOTTOM-RIGHT hurt: yelping and twisting away, ears back, a spray of dust.
```

### 5. `executioner` — Iron Executioner (elite)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: the Iron Executioner, the army's discipline given a body: a huge broad-shouldered brute in thick riveted black iron plate, a featureless iron bucket helm with a narrow slit, a dark red executioner's hood draped over the shoulders, a blood-stained leather apron, wielding a massive two-handed headsman's axe.
TOP-LEFT idle: standing heavily, axe resting on one shoulder.
TOP-RIGHT windup: axe raised high overhead with both hands, body arched back.
BOTTOM-LEFT attack: bringing the axe crashing down toward the viewer.
BOTTOM-RIGHT hurt: rocked back, one arm thrown out, sparks bursting from a cracked chest plate.
```

### 6. `cultist` — War Cultist
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a War Cultist who prays to the Red Rider: a gaunt figure in ragged deep crimson robes, a hood and a red-painted bone mask, ritual scars, chains of iron charms, holding a ceremonial curved blade and a small burning censer that trails red smoke.
TOP-LEFT idle: standing hunched, chanting, censer swaying.
TOP-RIGHT windup: both arms raised to the sky, red fire flaring from the censer.
BOTTOM-LEFT attack: slashing the curved blade toward the viewer, red sparks swirling.
BOTTOM-RIGHT hurt: thrown back, mask cracked, censer swinging wildly, robes flaring.
```

### 7. `tyrant` — The Iron Tyrant (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: The Iron Tyrant, warlord of the Red Warfront: a towering warlord in impossibly thick layered black iron plate with red-hot glowing seams, a horned crown-helm, a tattered blood-red war cloak, a tower shield in one hand and a great flanged war mace in the other.
TOP-LEFT idle: standing like a fortress, tower shield planted, mace at the side.
TOP-RIGHT windup: mace raised high behind the head, shield braced forward.
BOTTOM-LEFT attack: smashing the mace down toward the viewer, embers flying.
BOTTOM-RIGHT hurt: guard broken, shield knocked wide, a crack glowing across the breastplate.
```

## Black Harvest

### 8. `thrall` — Withered Thrall
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Withered Thrall, a rotting farmhand who ate blighted grain: an emaciated grey-brown body in torn sackcloth and a ragged straw hat, black rotten veins, sickly yellow mold patches on the skin, dry husks of grain sprouting from the shoulders, holding a rusted hand sickle.
TOP-LEFT idle: shambling, slumped, arms hanging.
TOP-RIGHT windup: sickle raised, mouth gaping, leaning back.
BOTTOM-LEFT attack: lurching forward, swiping the sickle and a clawed hand at the viewer.
BOTTOM-RIGHT hurt: twisted sideways, straw hat flying off, dry grain dust bursting out.
```

### 9. `stalker` — Plague Stalker
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: a Plague Stalker, a low fast predator of the blighted fields: a gaunt rat-like beast the size of a wolf, patchy grey-black fur, exposed ribs, yellow pus-filled sores, long hooked claws, a long thin tail, a narrow head with white blind eyes and a wide mouth of crooked teeth.
TOP-LEFT idle: crouched low and still, head forward, sniffing.
TOP-RIGHT windup: coiled tight, claws raised, back arched.
BOTTOM-LEFT attack: darting at the viewer with claws and jaws out.
BOTTOM-RIGHT hurt: flinching aside, squealing, legs splayed, dust flying.
```

### 10. `harvester` — Hollow Harvester (elite)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Hollow Harvester, a tall empty husk shed by a hungry thing: a gaunt dry shell of grey bark-like skin with a hollow cavity in the chest, a scarecrow-like head of woven dead wheat with two dim yellow eyes, black roots trailing from the limbs, wielding a huge rusted scythe.
TOP-LEFT idle: standing still, scythe held upright beside it.
TOP-RIGHT windup: scythe drawn far back over one shoulder, body twisted.
BOTTOM-LEFT attack: sweeping the scythe across toward the viewer in a wide arc.
BOTTOM-RIGHT hurt: knocked back, dry husk pieces and grain bursting from the chest cavity.
```

### 11. `harvesterBoss` — The Hollow Harvester (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: The Hollow Harvester, the hunger in the reservoir: a huge corrupted mass of black roots, rotting wheat and bone rising from a pool of dark sludge, a gaping maw in its center, many long root arms ending in sickle claws, a glowing sickly yellow core visible deep inside its chest.
TOP-LEFT idle: towering and swaying, root arms writhing.
TOP-RIGHT windup: root arms pulled back and spread wide, maw opening.
BOTTOM-LEFT attack: lashing several sickle claws forward at the viewer.
BOTTOM-RIGHT hurt: recoiling, the yellow core exposed and flaring, rotten husks bursting off.
```

## Pale Threshold

### 12. `revenant` — Pale Revenant
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Pale Revenant, an angry soul turned back at the threshold: a gaunt translucent pale figure in tattered grey-white burial wrappings, hollow glowing pale blue eyes, long clawed fingers, a faint pale blue spectral mist trailing from its body and feet.
TOP-LEFT idle: floating slightly, arms hanging, head tilted.
TOP-RIGHT windup: arms raised and claws spread, mouth open in a silent scream.
BOTTOM-LEFT attack: rushing at the viewer, claws slashing, spectral trails.
BOTTOM-RIGHT hurt: flickering and recoiling, body partly dissolving into pale mist.
```

### 13. `soulbound` — Soulbound Knight
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Soulbound Knight, sworn to guard the threshold forever: tall knight in pale silver-white plate armor with faint engraved oaths, pale blue spectral chains binding its arms to its chest, an empty helm glowing cold blue inside, a long greatsword held in both hands.
TOP-LEFT idle: standing on guard, greatsword point down in front of it.
TOP-RIGHT windup: greatsword raised high to one side, chains taut.
BOTTOM-LEFT attack: cleaving the greatsword diagonally down toward the viewer.
BOTTOM-RIGHT hurt: staggering, spectral chains cracking, pale blue light spilling from the helm.
```

### 14. `lich` — Lich
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Lich, a scholar who read the last page of the wrong book: a skeletal sorcerer in rich decayed purple and black robes with gold trim, a thin cracked crown, glowing violet eye sockets, a floating open tome chained to the belt, holding a bone staff topped with a violet crystal.
TOP-LEFT idle: hovering, staff in hand, tome floating beside it.
TOP-RIGHT windup: staff raised high, violet energy gathering at the crystal.
BOTTOM-LEFT attack: thrusting a bony hand toward the viewer, a burst of violet magic.
BOTTOM-RIGHT hurt: recoiling, crown slipping, tome falling, robes whipping.
```

### 15. `sentinel` — Deathless Sentinel (elite)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Deathless Sentinel that has stood at the threshold since time began: a towering ancient guardian like a living statue of weathered pale marble and tarnished bronze plate, a tall crested helm with a blank face, a huge round shield carved with an eye, a long bronze spear.
TOP-LEFT idle: standing perfectly still, shield forward, spear upright.
TOP-RIGHT windup: spear drawn back at shoulder height, shield braced.
BOTTOM-LEFT attack: driving the spear straight toward the viewer.
BOTTOM-RIGHT hurt: cracks spreading across the marble body, chips flying, shield knocked aside.
```

### 16. `executor` — The Pale Executor (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: The Pale Executor, judge of the final threshold: a tall ancient deathly champion in flowing pale grey-white robes over silver-bone armor, a faceless porcelain mask with a single vertical crack, a halo of pale blue spectral light, wielding a huge pale silver scythe.
TOP-LEFT idle: standing solemnly, scythe held upright, robes drifting.
TOP-RIGHT windup: scythe swung far back, blade glowing cold blue.
BOTTOM-LEFT attack: reaping the scythe across toward the viewer in a wide spectral arc.
BOTTOM-RIGHT hurt: staggering back, the mask crack widening, pale light leaking out.
```

## Abyssal Gate

### 17. `gorgon` — Gorgon
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: a Gorgon that followed the Abyss: a woman's upper body with a long coiled serpent tail, dark violet and bronze scales, hair of writhing black snakes, golden glowing eyes, bronze arm bracers, holding a curved bronze blade.
TOP-LEFT idle: coiled upright on its tail, snakes writhing.
TOP-RIGHT windup: reared up tall, eyes blazing gold, all snakes hissing forward.
BOTTOM-LEFT attack: lunging at the viewer, blade slashing, golden light from the eyes.
BOTTOM-RIGHT hurt: recoiling, tail thrashing, snakes recoiling, hand over the eyes.
```

### 18. `nephilim` — Nephilim (elite)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Nephilim, an armored giant, one of the Abyss's first soldiers: a colossal broad giant in thick ancient dark bronze and black iron armor plates, a tall horned helm with a faint violet glow in the eye slits, huge gauntleted fists, a massive slab-like stone club.
TOP-LEFT idle: standing like a wall, club resting on the ground.
TOP-RIGHT windup: head lowered and shoulder forward, bracing for a charge.
BOTTOM-LEFT attack: charging at the viewer, club swinging up.
BOTTOM-RIGHT hurt: armor plates cracking and splintering, staggering back.
```

### 19. `chimera` — Chimera (elite)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: a Chimera remade by the Abyss: a lion's dark-maned body and head, a horned black goat's head rising from its back, a long serpent for a tail, scarred dark violet-black hide, glowing orange eyes, viewed from the front so all three heads are visible.
TOP-LEFT idle: standing on all fours, three heads looking at the viewer.
TOP-RIGHT windup: reared up, lion head roaring, goat head breathing in, serpent tail raised.
BOTTOM-LEFT attack: lunging forward, the goat head breathing orange fire toward the viewer.
BOTTOM-RIGHT hurt: twisting away, all three heads recoiling, sparks and dust flying.
```

### 20. `locust` — Abyssal Locust
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: an Abyssal Locust, a horse-sized locust from the Abyss: a dark bronze and black armored insect body, a face almost human with long dark hair and a small golden crown-like crest, lion's teeth, a scorpion stinger tail, translucent violet-tinted wings, flying.
TOP-LEFT idle: hovering in the air facing the viewer, wings a blur.
TOP-RIGHT windup: pulled back mid-air, stinger tail curled forward.
BOTTOM-LEFT attack: diving at the viewer, stinger and teeth leading.
BOTTOM-RIGHT hurt: spinning sideways, a wing torn, falling.
```

### 21. `beast` — The Beast (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: The Beast, tyrant from the Abyss: a huge leopard-like body with bear-like clawed feet, a heavy cracked black-violet shell of armor plates on its back, seven horned heads on long necks crowned with tarnished gold diadems, the central head larger with glowing violet eyes.
TOP-LEFT idle: standing heavily, seven heads swaying.
TOP-RIGHT windup: reared back, all heads pulled back, central head roaring.
BOTTOM-LEFT attack: lunging forward, several heads snapping at the viewer.
BOTTOM-RIGHT hurt: the shell cracking open with violet light, heads recoiling.
```

## Last Revelation

### 22. `seraph` — Fallen Seraph
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: a Fallen Seraph, a guardian changed by the Abyss: a tall angelic figure with six charred wings edged in embers, cracked gold armor over scorched white robes, a blindfold over the eyes, a flaming halo, holding a burning sword.
TOP-LEFT idle: hovering, wings half open, sword lowered.
TOP-RIGHT windup: wings spread wide, sword raised, flames rising.
BOTTOM-LEFT attack: hurling a wave of fire from the sword toward the viewer.
BOTTOM-RIGHT hurt: falling back, feathers burning away, halo flickering.
```

### 23. `prophet` — The False Prophet (บอส + ร่างลวง)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: The False Prophet, voice of false signs: a tall gaunt preacher in long black and blood-red robes embroidered with gold, a tall ornate mitre, a serene golden mask with a painted smile, two small lamb's horns, holding a crooked golden staff topped with a burning eye, red fire floating above the open palm.
TOP-LEFT idle: standing serenely, staff upright, palm raised.
TOP-RIGHT windup: both arms raised to the sky, fire gathering above.
BOTTOM-LEFT attack: casting fire down from the palm toward the viewer.
BOTTOM-RIGHT hurt: thrown back, mask cracked, robes flaring, fire scattering.
```

### 24. `dragon` — The Great Dragon (บอส)
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body including wings and tail, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: The Great Dragon, the red serpent of the end: a huge crimson dragon with black horns, tattered bat-like wings, a long sweeping tail, molten cracks glowing in its scales, pale spectral flame flickering in its jaws.
TOP-LEFT idle: crouched facing the viewer, wings folded, smoke curling from its jaws.
TOP-RIGHT windup: reared up, wings spread wide, chest glowing, jaws opening.
BOTTOM-LEFT attack: breathing a stream of pale spectral fire toward the viewer.
BOTTOM-RIGHT hurt: recoiling, head thrown back, wings flared, scales cracking.
```

## บอสเสริม

### 25. `gravekeeper` — The Gravekeeper
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME character four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the figure. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CHARACTER: The Gravekeeper, who buried the first of the dead and refuses to stop: a hunched giant old undead man in a long mud-caked brown coat and a wide-brimmed hat, a grey beard, a lantern with a pale flame on his belt, ropes and grave tools hanging from him, holding a huge iron-edged grave shovel.
TOP-LEFT idle: leaning on the shovel, lantern swinging.
TOP-RIGHT windup: shovel raised high over the shoulder with both hands.
BOTTOM-LEFT attack: swinging the shovel down toward the viewer, earth flying.
BOTTOM-RIGHT hurt: knocked back, hat flying off, lantern flaring.
```

### 26. `cerberus` — Cerberus
```
Character sheet: a square 1:1 image divided into an invisible 2x2 grid of four equal panels, showing the SAME creature four times at the same size and scale, each pose fully inside its own panel, full body, facing the viewer, nothing crossing into another panel, no borders, no dividing lines, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green reflections on the creature. Dark gothic fantasy painting, highly detailed, dramatic but clean lighting.
CREATURE: Cerberus, the three-headed warden of the gate: a huge black hound with three snarling heads, glowing ember-red eyes, a spiked iron collar on each neck linked by heavy chains, a mane of dark smoke, a serpent-headed tail, cracked obsidian claws.
TOP-LEFT idle: standing facing the viewer, three heads growling.
TOP-RIGHT windup: crouched back, all three heads pulled back, jaws opening.
BOTTOM-LEFT attack: lunging at the viewer, three jaws snapping.
BOTTOM-RIGHT hurt: yelping, heads twisting away, chains rattling.
```
