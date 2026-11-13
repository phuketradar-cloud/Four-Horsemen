# THE LAST SANCTUARY - camp background prompt

Save the result as `assets/camp/sanctuary.webp` (or `.jpg` / `.png`), 16:9, at least 1920x1080.
The game draws it full screen, 50% darker (`CAMP_BG.dim` in src/ui/CampUI.js), behind the camp UI.

Layout to keep in mind: the NPC faces cover the far left strip, the dungeon list and detail panels
cover the centre, the hero bar covers the bottom middle. So the picture should be **dark and calm
in the centre**, with its interest at the **edges and the top** (roof, windows, moon, fire glow).

## Prompt
```
Wide 16:9 dark fantasy background painting of THE LAST SANCTUARY, the final refuge of the living at the end of the world: the ruined nave of a vast gothic cathedral turned into a fortified camp. Collapsed vaulted roof open to a blood-red sky with a huge eclipsed blood moon at the top right, ash drifting down. Tall broken stained-glass windows on both sides glowing faintly crimson and amber. A great stone altar at the far back holding seven seals, four of them cracked and glowing, chains hanging from the pillars. Survivors' camp along the aisles: patched canvas tents, barricades of broken pews and shields, iron braziers and a large campfire at the lower left casting warm orange light up the pillars, candles on the floor, banners of a fallen army, weapon racks and an anvil forge glowing at the lower right. Distant view through the broken wall of a burning apocalyptic city and four rider silhouettes on a ridge. Dark muted palette of black, charcoal, deep crimson and ember orange; the centre of the image is darker, quieter and low in detail (empty stone floor and shadow) so game panels can sit on top; detail and light concentrated at the top and the left and right edges. Painterly pixel-art hybrid, same style as a grimdark retro RPG, cinematic depth, no people in the foreground, no text, no logo, no UI.
```

## Negative prompt
```
text, letters, logo, watermark, UI, frames, characters in the foreground, faces, bright centre, daylight, blue sky, cartoon, cute, low detail, blurry, modern objects
```

## If it comes out too busy in the middle
Add: `the middle two thirds of the image are a dark empty stone floor fading into shadow`.
