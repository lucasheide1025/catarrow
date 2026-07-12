# Replace SVG game art with transparent WebP

## Goal

Replace the remaining code-drawn monster-card, Cat Village gathering, and cat-expedition placeholder art with consistent raster WebP assets. Preserve transparent backgrounds for foreground subjects and keep mobile rendering stable.

## Requirements

- Monster cards and the monster dex use the existing 36 transparent `/monsters/{id}.webp` illustrations instead of `MonsterSVG`.
- Introduce one reusable monster image component with explicit sizing, object-fit containment, accessible alt text, variant glow support, and a non-SVG fallback when an asset fails.
- Keep `MonsterSVG` available only where Claude's experimental battle UI still explicitly depends on it; do not overwrite that untracked component during this task.
- Replace every monster/target emoji in the legacy Cat Village gathering battle with the existing transparent `/council/obs/{site}_{tier}.webp` assets.
- Continue using the existing council background and cat WebP assets in the newer gathering run. Remove no functional map/progress SVG whose purpose is data visualization rather than placeholder art.
- Generate five new transparent WebP illustrations for cat expedition mission tiers under `/ui/village/expedition/`, one per tier: nearby exploration, mountain gathering camp, deep forest exploration, secret-realm mountain expedition, and legendary storm expedition.
- Expedition illustrations use the established soft painted fantasy/cute-cat visual language, contain no text or watermark, remain legible at 40-96px, and do not bake a card background into the asset.
- Replace mission-tier emoji artwork in expedition slots and mission selection cards with the generated WebP assets. Textual reward icons may remain emoji because they are compact semantic resource indicators, not scene artwork.
- All new foreground assets must be WebP with alpha transparency and transparent corners. Generated sources use the built-in image generator with removable chroma key, then local background removal and alpha validation.
- Existing booking, sound, admin, and Claude battle-test changes must not be modified or committed.

## Acceptance Criteria

- [ ] All 36 monster cards/dex entries render the matching transparent monster image and no longer instantiate `MonsterSVG`.
- [ ] Missing monster images degrade to a stable emoji/image placeholder without layout shift.
- [ ] All six gathering sites and six gathering tiers render WebP target art in both current and legacy gathering flows.
- [ ] Five distinct expedition mission images are generated, background-removed, saved as WebP, and used in both active slots and mission selection.
- [ ] At 320px width, images remain contained, text does not overlap, and action controls remain reachable.
- [ ] Alpha/channel checks confirm transparent corners for all five new expedition images.
- [ ] Unit tests and production build pass, including Claude's current admin battle-test import state.

## Notes

- Monster and council raster assets already exist and are visually suitable; reuse them rather than regenerate equivalent art.
- The generated expedition set should share framing, scale, line weight, and lighting so switching tiers reads as one progression.
