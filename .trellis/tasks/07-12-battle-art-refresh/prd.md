# Regenerate battle monsters and family backgrounds

## Goal

Refresh the actual battle presentation with newly generated monster appearances and family battlefields, while keeping collectible-card art independent.

## Requirements

- Generate 36 transparent battle portraits for the six standard monster families in `/monsters-battle/{monsterId}.webp`.
- Generate 24 transparent battle portraits for every treasure-family combat ID, including aggressive, peaceful, small-king, and big-king variants.
- Every foreground battle portrait is a transparent WebP with a centered, fully visible silhouette that reads at both mobile and desktop combat sizes.
- Generate six opaque 16:9 battle backgrounds, one each for `ghost`, `mountain`, `insect`, `workplace`, `exam`, and `temple`, under `/ui/battle-bg/family-{family}.webp`.
- Background routing uses the new family scene for every tier of the same family. Existing per-tier backgrounds remain untouched as fallbacks.
- Monster battle rendering uses the new battle portrait first, then falls back to the existing `/monsters/{id}.webp`, then existing component fallback.
- Treasure-family encounters use the new treasure portraits and a dedicated treasure fallback battlefield derived from the treasure icon only if no family scene applies; no broken image state.
- Card collection art in `/cards/` and current world boss artwork remain unchanged.
- No text, logo, watermark, or UI embedded in any generated asset.

## Acceptance Criteria

- [ ] 60 expected monster and treasure IDs resolve transparent alpha WebP battle portraits.
- [ ] Six expected battle background files resolve as opaque landscape WebP images.
- [ ] Battle screens for solo, party, and dungeon share the new family-background resolver.
- [ ] New assets do not alter collectible card art paths or world-boss assets.
- [ ] Asset validation confirms dimensions, alpha mode for portraits, and opaque RGB mode for backgrounds.
- [ ] Unit tests and production build pass.

## Notes

- 66 generated assets total: 60 foreground battle portraits and 6 family battlefields.
