# Design

## Listener ownership

`CatVillage` remains the single owner of `subscribeMyCats(profile.id)`. It passes `myCats` to `ForgePanel`; the child must not open a second listener. Existing cat mutations either update the parent through the live listener or return refreshed state through the established mutation path.

`CardMarketPanel` and `VillageGoalBanner` stay conditionally rendered by the active tab, so their genuinely shared multi-user listeners mount and clean up with those surfaces.

## Static configuration

Add a one-off `getVillageMarketConfig()` fetch in `db.js`. `CatVillage` calls it once on mount and falls back to existing defaults on missing/error data. Retain `subscribeVillageMarketConfig` for any other consumer that genuinely needs live behavior; do not silently change its global API semantics without reviewing every caller.

## Compatibility and risk

- Building production/collection code remains untouched.
- Forge receives the same cat map shape it previously built locally.
- The only intentional freshness trade-off is rare admin market-config changes, which require page re-entry.
- Rollback is limited to listener ownership props and the one-off config fetch.
