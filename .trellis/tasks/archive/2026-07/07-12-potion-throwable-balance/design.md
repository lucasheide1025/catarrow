# Technical Design

## Data Model

`POTIONS` remains the consumable source of truth. Each item receives stable `category`, `family`, `level`, `battleModes`, `actionCost`, `effect`, `recipe`, `craftYield`, `asset`, and optional `futureFeature` fields. Categories are `carry`, `throw`, and `raid`; carry replacement uses `family`, never ID prefixes.

A shared pure resolver accepts battle mode, player stats, enemy flags, and active effects. It returns a Firestore-safe effect description or a rejection reason. Components render only items allowed by this resolver.

## Catalog

- Carry: heal, power, guard, shield, regen, berserk, cleanse, each with basic and advanced levels.
- Throw: knife, bomb, corrosion, poison, weaken, armor break, hunter mark, paralyze, smoke, and binding net.
- Raid: raid bomb, execution spear, shatter mark, rally flare, and suppression chain.

Cleanse and binding net keep `futureFeature` metadata until abnormal-status and boss-special-attack systems exist. They can be crafted and stored but cannot be consumed early.

## Duration and Stacking

- Heal applies immediately.
- Carry buffs last for the current enemy battle and clear on enemy death, dungeon floor transition, or battle exit.
- Different carry families coexist. The higher level replaces a lower level in the same family.
- All consumables share one use per round.
- Damage throws consume an arrow action. Utility throws and utility raid items do not add or consume arrows.

## Mode Rules

- Normal, party, and dungeon modes support carry and regular throw items.
- World boss supports carry and raid only. UI filtering and the resolver both reject regular attack, debuff, and control throws.
- Raid effects live only in the current `WorldBossAttack` session. Only final damage reaches the shared event.
- Normal bosses use resolver-owned percentage caps and reduced hard-control behavior.

## Crafting

Recipes use the five confirmed cost templates. `craftPotion(memberId, itemId, craftCount)` becomes one atomic batch operation: calculate total input and output, verify resources and coins, deduct inputs, grant inventory, and update migration/craft stats consistently.

The crafting UI offers 1, 5, and maximum craft counts. Maximum derives from every recipe input and the coin balance, then is revalidated inside the transaction.

## Legacy Migration

Potion inventory gains `catalogVersion`. A pure migration maps every legacy ID, sums merged counts, preserves unknown keys, and produces version 2. The first compatible read/write commits it once. Running migration twice must produce the same result.

## Assets

Generate 29 transparent square raster icons in a consistent Cat Village hand-painted style. Basic and advanced forms differ by silhouette and ornament as well as color. Raid icons share a gold raid crest. Store optimized WebP assets in a dedicated consumables directory and retain emoji fallbacks.

## Concurrent Battle UI Work

Claude is replacing battle screens. Implement catalog, resolver, migration, crafting, and assets first. Before battle integration, re-read Git status and current battle components. Integrate through shared consumable APIs and never restore old UI over parallel changes.

## Compatibility and Rollback

Legacy IDs remain readable until migrated. Unknown inventory items do not crash catalog views. New inventory counts survive rollback because old clients ignore unknown IDs; no destructive bulk database migration is needed.
