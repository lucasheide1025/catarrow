# Raster game art design

## Asset map

| Surface | Source | Rendering |
| --- | --- | --- |
| Monster card and dex | `/monsters/{monsterId}.webp` | Shared contained image component, transparent foreground |
| Gathering target | `/council/obs/{siteId}_{tier}.webp` | Contained image using canonical site/tier IDs |
| Gathering actor/background | Existing `/council/cat` and `/council/bg` | Keep existing rendering |
| Cat expedition mission | `/ui/village/expedition/mission-t{1..5}.webp` | Generated transparent scene emblem |

## Image generation direction

Generate each expedition tier independently but keep the following invariant prompt: cute hand-painted fantasy game illustration, one adventurous cat plus the tier-specific landmark or supplies, three-quarter composition, centered silhouette, generous padding, crisp readable outer contour, no text, no logo, no frame, no cast shadow. Use a perfectly flat chroma-key background that does not occur in the subject, remove it locally, and export alpha WebP.

Tier progression:

1. A curious cat with a small satchel walking through nearby grass and herbs.
2. A prepared cat beside a compact mountain gathering tent and supply basket.
3. A brave cat entering an ancient dense forest with luminous plants.
4. A seasoned cat climbing a secret alpine realm with crystal and snowy peak motifs.
5. A legendary cat explorer against lightning and a floating ruin motif, still readable as a transparent cutout.

## Component boundaries

- Convert `MonsterSVG`'s raster battle renderer into a reusable `MonsterImage` export or add a dedicated component without duplicating failure state and variant glow logic.
- Card/dex sizes are caller-owned; the image component accepts `size`, `id`, `name`, and `variant`.
- Gathering and expedition data gain image-path metadata so presentation code does not reconstruct asset filenames in several places.
- SVG retained for functional dungeon grid paths is out of scope because it visualizes dynamic topology rather than standing in for artwork.
