# Battle art refresh design

## Asset boundaries

| Surface | Location | Background |
| --- | --- | --- |
| Standard and treasure monsters | `/monsters-battle/{id}.webp` | Transparent alpha |
| Family battlefield | `/ui/battle-bg/family-{family}.webp` | Opaque 16:9 landscape |
| Collectible cards | Existing `/cards/` | Unchanged |

## Art direction

Use the established painterly fantasy RPG language. Each family has a coherent environment: roadside shrine and underworld mist for ghosts, Taiwan mountain forest for mountain, venom jungle and hive caverns for insect, supernatural office city for workplace, impossible exam halls for exam, and gothic western ruins for temple. Portrait prompts retain the canonical monster identity and use a solid chroma-key background for later alpha removal.

Treasure variants differentiate behavior without changing combat identity: aggressive mimics have teeth, limbs, and hostile glow; peaceful variants look intact and gentle; small kings are ornate animated chests; large kings become monumental chest golems.

## Runtime routing

- Add a shared battle-asset resolver for portrait and background URLs.
- Portrait resolver: new `/monsters-battle` file -> current `/monsters` file -> existing visual fallback.
- Background resolver: new family image -> prior per-tier image -> generic dungeon background.
- Migrate solo, party, and dungeon callers to this resolver; admin test page may remain on its current explicit preview route until Claude's experimental UI is stabilized.
