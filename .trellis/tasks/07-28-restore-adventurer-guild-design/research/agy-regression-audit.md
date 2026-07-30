# AGY regression audit

Baseline: `34cc58f`

## Removed verified orchestration

- deterministic daily commissions: `rollDailyContracts`, `contractsStateFor`, `todayKey`
- authenticated/offline profile loading and debounced persistence
- real cat collection subscription
- reward grant and daily completion persistence
- promotion trial flow and rank-up presentation
- local solo-run recovery
- open team-room discovery and reconnectable team recovery

## Added experimental work

- `ExpeditionMapView` between loadout and battle
- custom loadout quantities and changed battle presentation
- changed team-lobby props

## Recommendation

Restore the verified design first. Keep `ExpeditionMapView` as an isolated, unreferenced experiment unless the user explicitly accepts the extra integration risk in this restoration task.
