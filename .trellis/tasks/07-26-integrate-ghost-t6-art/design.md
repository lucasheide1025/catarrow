# Design：整合鬼怪族 T6 核准立繪

## Scope and Boundaries

本任務只處理鬼怪族 T6 的 6 張卡片場景圖與 6 張戰鬥立繪。現有 monster/card ID、資料 catalog、React 元件與 gameplay 不變；正式靜態路徑維持既有契約，因此不需要新增 runtime 分支或 feature flag。

## Source-to-Target Mapping

| T6 role | Stable target | Card source | Battle source |
|---|---|---|---|
| `normalA` | `ghost_t6_normal_a.webp` | `gpt-t1-cards/ghost-t1-male-card-gpt-v1.png` | `gpt-t1-battle/ghost-t1-male-battle-gpt-v1.png` |
| `normalExisting` | `ghost_6.webp` | `gpt-t1-cards/ghost-t1-female-card-gpt-v1.png` | `gpt-t1-battle/ghost-t1-female-battle-gpt-v1.png` |
| `normalB` | `ghost_t6_normal_b.webp` | `gpt-t1-cards/ghost-t1-beast-card-gpt-v1.png` | `gpt-t1-battle/ghost-t1-beast-battle-gpt-v1.png` |
| `miniA` | `ghost_t6_mini_a.webp` | `gpt-t1-leaders/ghost-t1-boss-card-gpt-v1.png` | `gpt-t1-leaders/ghost-t1-boss-battle-gpt-v1.png` |
| `miniB` | `ghost_t6_mini_b.webp` | `gpt-t1-leaders/ghost-t1-mini-a-card-gpt-v1.png` | `gpt-t1-leaders/ghost-t1-mini-a-battle-gpt-v1.png` |
| `boss` | `ghost_t6_boss.webp` | `gpt-t1-leaders/ghost-t1-mini-b-card-gpt-v1.png` | `gpt-t1-leaders/ghost-t1-mini-b-battle-gpt-v1.png` |

Card targets live under `public/cards/monsters/`; battle targets live under `public/monsters-battle/`.

## Image Processing

### Cards

- Preserve the approved 1086×1448 3:4 composition.
- Encode to WebP using Sharp at a visually high quality suitable for collection detail view.
- Strip unnecessary metadata.

### Battle Art

- Read source pixels with Sharp.
- Derive alpha from green-screen similarity and green dominance:
  - fully transparent for confident chroma-green background;
  - feather uncertain boundary pixels;
  - preserve opaque dark/blue/purple character pixels;
  - suppress green spill on partially transparent edge pixels.
- Crop to the non-transparent content bounds with safe padding.
- Fit inside a transparent 512×512 canvas without cutting antlers, rings, limbs, weapons, hair, or effects.
- Encode lossless-alpha WebP suitable for existing battle rendering.

The post-processing must be scripted so all 12 outputs are reproducible from the approved staging files. The script is an authoring tool only and is not added to build/runtime lifecycle commands.

## Compatibility

- `cardCatalog.js` already resolves each card through `/cards/monsters/<artKey>.webp`.
- Existing battle renderers already resolve stable monster IDs through `/monsters-battle/<monsterId>.webp`.
- Because targets keep those paths, cache-busting is handled by the normal build/deploy asset hash or browser refresh; no data migration is needed.

## Validation

- Automated metadata checks: expected dimensions, WebP format, card 3:4 ratio, battle alpha presence, no opaque corner pixels, file-size budget.
- Existing card catalog tests and production build.
- Generate a local contact sheet for visual review of all card and battle outputs.
- Run the local site so the user can inspect the real card collection and battle UI.

## Rollback

All product changes are replacements of 12 tracked WebP assets plus one isolated authoring script. Before any replacement, the script writes only the exact mapped targets; Git retains the prior versions for review and rollback. No unrelated dirty paths are staged or modified.
