# Generate dedicated monster and world boss card art

## Goal

Create dedicated full-background artwork for every monster and world-boss collectible card, replacing the current reuse of transparent battle sprites/portraits inside the card art window. The canonical catalogs contain 36 monsters and 24 world bosses, for 60 images total.

## Requirements

- Produce 60 individual WebP card-art files: 36 normal monsters from `MONSTERS` and 24 world bosses from `WORLD_BOSSES`/`WB_CARDS`.
- Save normal monster art as `/cards/monsters/{monsterId}.webp` and world-boss art as `/cards/worldboss/{bossKey}.webp`. Do not overwrite `/monsters`, `/worldboss`, or cat portrait assets used by battle surfaces.
- Art has a complete illustrated background and must not be transparent or background-removed.
- Use a consistent polished hand-painted fantasy mobile-card style while preserving each existing character's recognizable identity, species, costume, signature object, family palette, title, and personality.
- Normal monsters progress visually through common, rare, elite, fierce, boss, and mythic tiers. Higher tiers gain scale, atmosphere, and dramatic lighting without adding text or card borders to the image.
- World-boss cards cover exactly 3 coach bosses, 9 cat bosses, and 12 family bosses (small and large boss for each of 6 families).
- Frame each subject for the card art window: 4:3 landscape source, primary face and signature silhouette within the central 70% safe area, readable at the compact card size, no critical content at extreme edges.
- No in-image text, labels, logos, watermarks, UI, card frame, or stat symbols.
- Replace `MonsterArt` and `WorldBossArt` card paths only. Battle, monster dex, world-boss battle, and cat portrait surfaces keep their existing assets.
- Missing dedicated card art falls back to the existing battle/portrait asset without layout shift.
- Do not modify or commit concurrent Claude admin, sound, booking, or documentation work.

## Acceptance Criteria

- [ ] All 36 monster IDs have distinct opaque WebP card art and render in normal monster cards.
- [ ] All 24 world-boss keys have distinct opaque WebP card art and render in world-boss cards.
- [ ] Automated checks confirm all 60 expected files exist, decode as WebP, have no alpha transparency, and use the target dimensions/aspect ratio.
- [ ] A visual contact sheet is reviewed for duplicates, wrong character identity, text artifacts, cropped faces, inconsistent style, and weak small-size readability.
- [ ] Compact and expanded cards use `object-fit: cover` with a stable focal point and no stretching.
- [ ] Existing assets remain untouched and missing new art uses the previous path as fallback.
- [ ] Unit tests and production build pass.

## Notes

- This is an asset-heavy task. Generate and validate in family batches rather than producing all 54 before the first review.
