# Implementation Plan

1. Add the versioned 29-item catalog, recipes, mode metadata, and pure effect resolver with tests.
2. Add idempotent legacy inventory migration covering every old ID mapping.
3. Refactor crafting into an atomic batch operation supporting 1, 5, and maximum craft counts.
4. Rebuild Cat Village crafting with carry, throw, and raid tabs, batch controls, future labels, affordability, and output quantities.
5. Generate and optimize 29 transparent hand-painted icons, wire paths, and verify 32px/48px readability and fallbacks.
6. Re-read Claude's latest battle UI, then integrate mode filtering, one-use-per-round, carry stacking/duration, and arrow-action semantics without reverting parallel work.
7. Integrate raid-only local effects into world-boss sorties and reject regular offensive/debuff throws in UI and resolver.
8. Add cross-mode tests for normal, party, dungeon, and world boss cleanup and restrictions.
9. Run tests/build, inspect mobile layouts, update specs, and commit only task-owned files.

## Validation

- `npm test -- --watchAll=false --runInBand`
- `npm run build`
- Mobile checks for crafting quantities, long recipes, and battle selectors.
- Asset checks at source resolution and rendered 32px/48px sizes.

## Review Gates

- Verify final catalog and recipe mapping before replacing legacy definitions.
- Rebase battle integration on Claude's completed UI before touching battle components.
- Confirm raid effects remain local and introduce no shared event buff fields.

## Rollback Points

- Catalog, migration, crafting, and assets can ship before battle integration because unsupported items remain non-consumable.
- Generated assets are additive and can fall back to emoji without changing inventory.
- Battle integration can be rolled back without deleting migrated inventory.
