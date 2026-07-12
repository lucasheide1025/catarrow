# Dedicated card-art design

## Output contract

- Canvas: 4:3 landscape, normalized to 768 x 576 before final WebP export.
- Format: opaque WebP, quality approximately 88, target under 220 KB when visual quality permits.
- Composition: bust or three-quarter action portrait; face and signature prop in the middle 70%; environmental background supports family identity.
- Rendering: painterly fantasy mobile-game card art, crisp focal silhouette, controlled detail at the edges, strong local contrast around the face.

## Generation batches

1. Ghost family: `ghost_1` through `ghost_6`.
2. Mountain family: `mountain_1` through `mountain_6`.
3. Insect family: `insect_1` through `insect_6`.
4. Workplace family: `workplace_1` through `workplace_6`.
5. Exam family: `exam_1` through `exam_6`.
6. Western/temple family: `temple_1` through `temple_6`.
7. Coach and cat bosses: 3 coach cards plus 9 individual cat cards.
8. Family world bosses: 6 small-boss cards plus 6 large-boss cards.

Each generation prompt is built from the canonical name, description, family, tier/title, and existing visual cues. One distinct built-in image-generation call is used per requested card image.

## Runtime changes

- `MonsterArt` loads `/cards/monsters/{id}.webp`, then falls back to `/monsters/{id}.webp`, then emoji.
- `WorldBossArt` loads `/cards/worldboss/{bossKey}.webp`, then its current `artPath`, then emoji.
- Card art switches to `object-fit: cover`; generated composition carries the safe-area guarantee.
- Add a static validation script or test that derives the canonical key lists and verifies the asset manifest.

## Quality gate

After each batch, create a labeled local contact sheet for visual review. Reject outputs with text, duplicated subjects, unrecognizable identity, face outside the safe area, unintended transparency, or inconsistent rendering. Keep source generation files outside public; only final WebP files ship.
