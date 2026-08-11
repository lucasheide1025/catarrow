# Design

## Boundaries

- Extract or reuse pure recovery predicates/normalizers so floor-3 branch state can be regression-tested without mounting the full UI.
- Keep localStorage/cloud payload shapes backward compatible; accept either grid-state floors or branch-state floor 3 based on `floorIndex` and the corresponding map structure.
- Keep team coordination-room `expeditionMapState` authoritative on reconnect.
- Centralize the invariant that difficulty selects tier and variant only scales presentation/combat stats.
- Diagnose the exam T1 freeze at the round engine/component boundary and fix the smallest invalid state transition or data contract.

## Data flow

1. Movement/branch progress updates React state.
2. Solo persists `mapState`; team persists stripped `expeditionMapState`.
3. Reconnect validates state according to floor shape, restores it, then chooses `grid` or `branch` phase.
4. Encounter generation receives locked `difficultyTier`; candidate filtering selects exactly the corresponding tier before applying variant stats.
5. Battle round resolution consumes the persisted monster snapshot and emits a terminal or next-round state that clears pending animation/input state.

## Compatibility and rollback

- No schema deletion or destructive migration.
- Older grid saves continue through the existing path.
- Invalid/incomplete saves retain the safe regenerate-at-floor-entry fallback.
- Changes can be rolled back file-by-file because no stored schema is rewritten.
