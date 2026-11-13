# Prompt ไอคอนสกิล / Passive / ความยาก (แบบชุด)

ไอคอนสกิลแสดงในหน้าเลือกตัวละคร (32×32), แถบสกิลในเกม, หน้า SKILLS และ tooltip
แบ่งเป็น 5 ชุด ชุดละ 6 ช่อง (ตาราง 3×2):

| ชุด | ไฟล์ที่ส่งกลับมา | เนื้อหา |
|---|---|---|
| A | `skills_conquest.jpg` | สกิล 1-4, ULT, Passive ของ CONQUEST |
| B | `skills_war.jpg` | สกิล 1-4, ULT, Passive ของ WAR |
| C | `skills_famine.jpg` | สกิล 1-4, ULT, Passive ของ FAMINE |
| D | `skills_death.jpg` | สกิล 1-4, ULT, Passive ของ DEATH |
| E | `ui_icons.jpg` | กะโหลกความยาก (ติด/ดับ) + สัญลักษณ์ทรัพยากร 4 แบบ |

**กติกาทุกชุด**
- ภาพแนวนอน 3:2 พื้นเขียวล้วน (#00FF00) ระหว่างช่อง เว้นช่องว่างเขียวให้ชัด
- ชุด A-D: ไอคอนแต่ละอันเป็น**แผ่นสี่เหลี่ยมจัตุรัสมีพื้นหลังมืดของตัวเอง** (เหมือนไอคอนสกิลเกม RPG) ขอบโลหะบางๆ ห้ามมีสีเขียวบนไอคอน
- เรียงช่อง**ซ้ายไปขวา บนลงล่าง** ตามลำดับในรายการ ไม่มีตัวหนังสือหรือตัวเลข
- ไอคอนจะถูกย่อเหลือ 16-32 พิกเซล: ใช้**รูปทรงใหญ่ชัด 1 อย่างต่อไอคอน** ตัดกันกับพื้นหลัง ไม่ใส่รายละเอียดเล็ก

**ส่วนหัวที่ใช้ร่วมกัน (ใส่ทุกชุด A-D):**
```
A sheet of 6 square RPG skill icons arranged in a 3 by 2 grid on a flat pure green (#00FF00) background with clear green gaps between the icons. Each icon is a square tile with its own dark painted background and a thin dark bronze metal rim, one bold readable symbol in the centre, dark fantasy biblical apocalypse style, painterly pixel-art hybrid, high contrast, glowing magic accents, consistent lighting, no text, no numbers.
```

**Negative prompt (ทุกชุด):**
```
text, letters, numbers, labels, grid lines across the green, characters, faces of people, hands, round icons, green on the icons, green glow, overlapping icons, watermark, white background, blurry
```

---

## ชุด A — CONQUEST (`skills_conquest.jpg`) สีทอง/ขาว
```
[ส่วนหัว] Palette: radiant gold, ivory white, deep navy-black backgrounds.
1. PIERCING JUDGMENT: a single blazing golden bolt of light piercing diagonally through the tile, leaving a bright streak.
2. MARK OF THE CROWN: a glowing golden crown-shaped sigil branded on dark stone, rays around it.
3. PHANTOM VOLLEY: three translucent white-gold spectral arrows flying in parallel.
4. ROYAL DECREE: a sealed royal parchment scroll with a red wax seal and golden light leaking out.
5. WORLD CONQUEROR (ultimate): a blinding golden sun with a crown silhouette in its centre and a rain of light arrows, ornate gold rim, the most dramatic icon of the set.
6. UNBROKEN WILL (passive): a golden lance tip striking a glowing crosshair mark, gold rim.
```

## ชุด B — WAR (`skills_war.jpg`) สีแดงเลือด/ไฟ
```
[ส่วนหัว] Palette: blood red, ember orange, black iron backgrounds.
1. CLEAVE: a huge curved red slash arc sweeping across the tile, sparks at the tip.
2. ARMOR BREAKER: a dark iron breastplate cracking apart with orange light bursting through the crack.
3. BLOOD RUSH: a large glowing drop of blood with red speed streaks behind it.
4. EARTHSHAKER: a war axe slamming the ground, cracked earth and a red shockwave ring.
5. RED APOCALYPSE (ultimate): a horned war helm wreathed in a firestorm and falling burning blades, ornate red-gold rim, the most dramatic icon of the set.
6. BLOOD AND IRON (passive): a bleeding iron fist clenched around a sword hilt, red glow.
```

## ชุด C — FAMINE (`skills_famine.jpg`) สีเขียวหม่น/ม่วง
```
[ส่วนหัว] Palette: sickly yellow-olive, plague purple, black rotten backgrounds (do not use pure bright green, use olive and yellow-green).
1. WITHERING TOUCH: a skeletal grey hand with olive-yellow decay mist curling from its fingertips.
2. HARVEST OF WEAKNESS: a rusty sickle drawing a stream of glowing life essence toward the viewer.
3. BLACK PLAGUE: a rotting black skull leaking purple-olive plague smoke.
4. STARVATION FIELD: a circle of withered dead wheat stalks on cracked dry ground with a purple aura.
5. THE LAST HARVEST (ultimate): a black hooded reaper's scales tipping with a skull on one plate and golden grain on the other, ornate purple-bronze rim, the most dramatic icon of the set.
6. NOTHING IS WASTED (passive): a cracked bowl catching drops of olive-yellow essence.
```

## ชุด D — DEATH (`skills_death.jpg`) สีฟ้าน้ำแข็ง/ขาวซีด
```
[ส่วนหัว] Palette: icy pale blue, bone white, deep midnight backgrounds.
1. SOUL REND: a pale blue spectral claw tearing a glowing soul wisp in two.
2. GRAVE MARK: a weathered tombstone with a glowing blue curse rune carved into it.
3. WRAITH STEP: a translucent hooded wraith silhouette dashing sideways leaving blue afterimages.
4. DEATH'S EMBRACE: two skeletal arms wrapping around a fading blue heart.
5. THE FINAL SILENCE (ultimate): a huge reaper's scythe cutting across a full pale moon with drifting souls, ornate silver-blue rim, the most dramatic icon of the set.
6. REAPER'S DUE (passive): a skeletal hand holding a glowing blue soul flame like a coin.
```

## ชุด E — UI (`ui_icons.jpg`)
ชุดนี้ไม่มีแผ่นพื้นหลัง ให้วางสัญลักษณ์บนพื้นเขียวโดยตรง (ตัดพื้นออกเป็นภาพโปร่งใส)
```
A sheet of 6 small dark fantasy game UI symbols arranged in a 3 by 2 grid on a flat pure green (#00FF00) background with clear green gaps, each symbol centred in its own cell, no tile background, bold simple silhouette readable at 12 pixels, painterly pixel-art hybrid, no text, no numbers.
1. DIFFICULTY SKULL LIT: a front-facing bone skull with glowing warm gold eye sockets, bright and polished.
2. DIFFICULTY SKULL UNLIT: the same skull shape, dull grey-brown, dusty, dark empty eye sockets.
3. DOMINION: a small golden crown emblem.
4. FURY: a red flame shaped like a horned helm.
5. PLAGUE: an olive-yellow toxic drop with a skull highlight.
6. SOULS: a pale blue soul wisp flame.
```
