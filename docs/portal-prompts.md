# Prompt ประตูทางออก / บันได (ชุด G — `items_portal.jpg`)

วัตถุ 3 ชิ้นที่ยังเป็นพิกเซลอาร์ต: ประตูทางออกตอนปิด (`exitOff`), ประตูทางออกตอนเปิดหลังชนะบอส (`exitOn`)
และบันไดลงชั้นถัดไป (`stairs`). ส่งภาพกลับมาเป็น `items_portal.jpg` แล้วจะอบเป็น 256px แบบเดียวกับหีบสมบัติ

```
Game object sheet: a wide 3:1 image arranged as an invisible row of 3 equal cells, ONE object centered in each cell, each object drawn whole and fully inside its cell, seen from the front at eye level, no grid lines, no borders, no text or labels. Solid flat chroma key green background (#00FF00) across the whole image, perfectly even, no gradient, no shadow, no green on the objects (use blue, white and violet for magic, never green). Dark gothic fantasy painted style matching a grimdark first-person dungeon crawler, highly detailed, dramatic but clean lighting, tall vertical objects.
Cells left to right:
1 SEALED EXIT GATE: a tall pointed gothic stone archway carved with skulls and chains, the opening filled by a dark cracked stone slab with a dim red seal rune in the middle, iron chains crossing it, dead and closed.
2 OPEN EXIT PORTAL: the SAME stone archway, now the opening holds a swirling vortex of pale blue and white light spiralling inward to a bright centre, wisps of light and floating embers drifting out, the carved skulls lit from inside, inviting and powerful.
3 STAIRS DOWN: a dark stone stairwell opening in the floor framed by a broken stone arch, steps descending into black depth, a faint cold blue glow rising from below, dust and cobwebs on the edges.
```

**Negative prompt**
```
text, letters, frame, border, grid lines, people, characters, green magic, green glow, background scenery, floor plane, cast shadow, watermark, blurry
```

ถ้าตัวสร้างภาพไม่ยอมทำแนว 3:1 ให้ใช้ภาพสี่เหลี่ยม 1:1 แล้ววางเป็นแถวเดียว 3 ช่องตรงกลางภาพ เว้นพื้นเขียวด้านบนและล่าง
