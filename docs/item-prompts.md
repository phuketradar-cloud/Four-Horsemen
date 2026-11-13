# Prompt ไอเทมและวัตถุ (แบบชุด หลายชิ้นในภาพเดียว)

ในเกมมีไอคอนไอเทม 51 แบบ ทุกไอเทมในเกม (กว่า 400 ชิ้น) ใช้ไอคอนร่วมกันตามชนิด เช่น ดาบทุกเล่มใช้ไอคอน `sword` และมีวัตถุดิบอีก 28 แบบ แบ่งเป็น 6 ชุด:

| ชุด | ไฟล์ที่ส่งกลับมา | ตาราง | เนื้อหา |
|---|---|---|---|
| A | `items_weapons.jpg` | 4×4 | อาวุธ 16 ชนิด |
| B | `items_armor.jpg` | 4×4 | ชุดเกราะ 16 ชนิด |
| C | `items_relics.jpg` | 4×4 | แหวน เครื่องราง ขวดยา ทอง |
| D | `items_objects.jpg` | 3×3 | หีบสมบัติ และวัตถุในดันเจี้ยน |
| E | `items_materials1.jpg` | 4×4 | วัตถุดิบ 16 แบบแรก |
| F | `items_materials2.jpg` | 4×3 | วัตถุดิบ 12 แบบหลัง (รวมแกนบอส) |

**กติกาทุกชุด**
- ภาพสี่เหลี่ยมจัตุรัส 1:1 พื้นเขียว (#00FF00) ห้ามมีเขียวบนไอเทม
- ไอเทมแต่ละชิ้นอยู่**กลางช่องของตัวเอง** ห้ามล้นข้ามช่อง ไม่มีเส้นแบ่งช่อง ไม่มีตัวหนังสือ
- เรียงช่องจาก**ซ้ายไปขวา บนลงล่าง** ตามลำดับในรายการ ผมจะตัดตามช่องและตั้งชื่อตามลำดับนี้
- ถ้าตัวสร้างภาพเรียงลำดับผิด บอกผมได้ว่าช่องไหนเป็นอะไร

**ข้อควรรู้:** ไอคอนในเกมแสดงที่ 16×16 พิกเซล (ในกระเป๋า ร้านค้า ช่องอาวุธ และของที่ตกบนพื้น) จึงควรเป็น**รูปทรงชัด สีตัดกัน มองออกตั้งแต่ขนาดเล็ก** รายละเอียดเล็กๆ จะหายไป ส่วนหีบสมบัติและวัตถุในชุด D แสดงใหญ่กว่า เห็นรายละเอียดได้มากกว่า

**Negative prompt (ใช้ได้ทุกชุด):**
```
text, letters, labels, numbers, grid lines, borders, frames, hands, characters, background scenery, table, floor, shadow, gradient background, white background, green on the items, green glow, overlapping items, watermark
```

---

## ชุด A — อาวุธ (`items_weapons.jpg`)
```
Game item icon sheet: a square 1:1 image arranged as an invisible 4x4 grid of 16 equal cells, ONE item centered in each cell, each item drawn whole and fully inside its cell, all items at a similar visual size, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the items. Dark gothic fantasy painted style, bold clear silhouettes and strong contrast so each icon reads well when shrunk very small, items shown diagonally from lower-left to upper-right where it fits, worn battle-scarred metal, leather and wood.
Cells left to right, top to bottom:
1 a straight one-handed steel sword with a dark crossguard.
2 a long two-handed greatsword with a wide blade and long grip.
3 a single-bladed battle axe with a wooden haft.
4 a reaper's scythe with a long curved blade.
5 a heavy wooden crossbow with iron fittings, seen from the side.
6 a tall curved longbow with a string.
7 a short straight dagger.
8 a small curved harvest sickle.
9 a heavy two-handed war hammer with a square iron head.
10 a long spear with a leaf-shaped steel head.
11 a cursed wavy dagger with a dark violet blade.
12 a round iron-banded wooden shield with a boss.
13 a parrying dagger with a large basket guard.
14 a glowing violet crystal orb in a claw-shaped iron holder.
15 a thick leather-bound spell tome with iron corners.
16 a carved bone totem with feathers and beads.
```

## ชุด B — ชุดเกราะ (`items_armor.jpg`)
```
Game item icon sheet: a square 1:1 image arranged as an invisible 4x4 grid of 16 equal cells, ONE item centered in each cell, each item drawn whole and fully inside its cell, all items at a similar visual size, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the items. Dark gothic fantasy painted style, bold clear silhouettes and strong contrast so each icon reads well when shrunk very small, every item shown from the front with no one wearing it.
Cells left to right, top to bottom:
1 a closed steel great helm with an eye slit.
2 a spiked iron crown with dark red gems.
3 a dark cloth hood.
4 a pale bone face mask.
5 a tall ceremonial headdress of black feathers and gold.
6 a steel plate breastplate.
7 a long dark red mage robe with gold trim.
8 a studded brown leather jerkin.
9 a chest armor made of bones and ribs.
10 ornate royal regalia: a gold-trimmed purple mantle with a high collar.
11 a pair of steel plate gauntlets.
12 a pair of cloth hand wraps.
13 a pair of leather bracers with metal studs.
14 a pair of steel plate greaves (leg armor).
15 a pair of worn leather boots.
16 an iron lantern with a warm orange flame.
```

## ชุด C — เครื่องประดับ ของวิเศษ ขวดยา (`items_relics.jpg`)
```
Game item icon sheet: a square 1:1 image arranged as an invisible 4x4 grid of 16 equal cells, ONE item centered in each cell, each item drawn whole and fully inside its cell, all items at a similar visual size, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the items. Dark gothic fantasy painted style, bold clear silhouettes and strong contrast so each icon reads well when shrunk very small.
Cells left to right, top to bottom:
1 a plain gold ring with a red gem.
2 a heavy silver signet ring with an engraved seal.
3 a ring of pale blue spectral light around a silver band.
4 a talisman pendant on a chain, a bronze disc with a carved eye.
5 a jagged glowing crimson crystal shard relic.
6 a broken wax-and-gold seal relic on a ribbon.
7 small bronze merchant's scales.
8 a small dark stone idol of a horned figure.
9 a small ornate gold reliquary box with a glass window.
10 a gold chalice with dark red wine.
11 a tattered dark red war banner on a short pole.
12 a round glass potion flask with glowing red liquid and a cork.
13 a tall slender glass elixir vial with glowing blue liquid.
14 a small pile of gold coins.
15 a small grey-violet crystal shard.
16 a glowing violet essence orb with swirling smoke inside.
```

## ชุด D — หีบสมบัติและวัตถุ (`items_objects.jpg`)
```
Game object sheet: a square 1:1 image arranged as an invisible 3x3 grid of 9 equal cells, ONE object centered in each cell, each object drawn whole and fully inside its cell, seen from the front and slightly above, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the objects. Dark gothic fantasy painted style, highly detailed, dramatic but clean lighting.
Cells left to right, top to bottom:
1 a closed heavy wooden treasure chest with rusted iron bands and a lock.
2 the same treasure chest opened, lid up, gold coins and a faint golden glow inside.
3 a small pile of grey ash.
4 a small floating pale blue soul fragment wisp.
5 a dark pulsing crystal core with red cracks.
6 a stone shrine altar with a carved skull and two dim candles.
7 a stone holy water font basin with glowing pale blue water.
8 an ancient stone tablet carved with runes, standing upright.
9 a wooden lectern stand holding an open old scroll.
```

---

## ชุด E — วัตถุดิบ 1/2 (`items_materials1.jpg`)
```
Game crafting material icon sheet: a square 1:1 image arranged as an invisible 4x4 grid of 16 equal cells, ONE material centered in each cell, each drawn whole and fully inside its cell, all at a similar visual size, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the materials. Dark gothic fantasy painted style, bold clear silhouettes and strong contrast so each icon reads well when shrunk very small.
Cells left to right, top to bottom:
1 Rusted Iron: a pitted, rust-brown iron ingot bar.
2 Bone Fragment: a splintered off-white bone piece.
3 Cloth Scrap: a folded torn scrap of grey-brown burial linen.
4 Grave Dust: a small heap of fine grey dust.
5 Crimson Ash: a small heap of glowing red-orange ash with embers.
6 Black Grain: a small pile of dark blackened grain kernels.
7 Lesser Soul Fragment: a small pale blue crystal with faint inner light.
8 Tempered Iron: a polished blue-grey steel ingot bar.
9 War Essence: a round glowing blood-red orb with fiery swirls inside.
10 Broken Weapon Core: a dark metal core fragment with a hot orange glowing crack.
11 Withered Root: a twisted dry brown root.
12 Blighted Essence: a round glowing mustard-yellow orb with dark swirls inside (yellow, NOT green).
13 Pale Bone: a bleached pure white bone.
14 Corrupted Catalyst: a jagged purple crystal glowing violet.
15 Condensed Soul: a round cold pale blue glowing orb.
16 Spectral Shard: a translucent cyan-teal crystal shard with a ghostly glow.
```

## ชุด F — วัตถุดิบ 2/2 (`items_materials2.jpg`)
```
Game crafting material icon sheet: a 4:3 landscape image arranged as an invisible grid of 4 columns and 3 rows, 12 equal cells, ONE material centered in each cell, each drawn whole and fully inside its cell, all at a similar visual size, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the materials. Dark gothic fantasy painted style, bold clear silhouettes and strong contrast so each icon reads well when shrunk very small.
Cells left to right, top to bottom:
1 Ancient Alloy: a gleaming pale gold ingot bar with engraved runes.
2 Grave Warden Core: a round cracked bone-white stone seal with a glowing gold center.
3 Iron Tyrant Core: a dark iron heart-shaped core with a glowing red-hot crack and a tiny crown.
4 Hollow Harvester Core: a dark husk-like core of black roots with a glowing mustard-yellow center (yellow, NOT green).
5 Pale Executor Core: a silver-white core with a cold pale blue glowing crack.
6 Abyssal Ichor: a round glowing deep violet orb of swirling liquid.
7 Horn of the Beast: a single curved dark horn with a pale bone tip.
8 Great Dragon Scale: one large crimson dragon scale with a glowing orange edge.
9 Shard of the Destroyer's Crown: a jagged dark magenta crystal splinter glowing hot pink.
10 Apocalyptic Fragment: a jagged blood-red shard glowing bright red.
11 Mythic Essence: a round glowing rose-pink orb with sparkling swirls.
12 Ancient Relic Dust: a small heap of shimmering pale gold dust.
```
