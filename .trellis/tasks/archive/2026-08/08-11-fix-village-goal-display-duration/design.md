# Design

## Boundaries

- Add one canonical display resolver shared by village-goal surfaces.
- Add an explicit legacy-schedule migration/normalization boundary rather than treating every value of 24 as invalid forever.
- Keep Firestore goal documents backward compatible and preserve custom content.
- Make active-goal deadline repair idempotent and scoped only to clearly legacy-short goals.

## Data flow

1. Read `sysConfig/villageGoal.schedule`.
2. Detect legacy schedule shape/version and normalize it to the current configured duration.
3. Auto-spawn persists the resolved schedule version plus canonical goal display data.
4. UI resolves custom content first, persisted canonical content second, and derived type metadata last.
5. Existing active legacy goals are repaired once to `migration time + 30 days` and marked with migration metadata.
6. Reward presentation derives the goal tier's participation, effort, and celebration layers from the same reward helpers used at claim time.
7. Monster-kill contribution is emitted from the canonical finalized shooting session with an operation/session ID; the village-goal transaction records applied operation IDs before incrementing progress.
8. Introduce the canonical exploration-completion goal type while treating legacy `board_laps` documents as aliases at display and contribution boundaries.

## Compatibility and rollback

- No goal or contribution records are deleted.
- Deliberate custom schedules are preserved when they are marked/current rather than inferred as legacy.
- Deadline repair only extends time; it never shortens an active goal.
- Rollback can ignore new metadata while old fields remain readable.
- Offline finalization and simultaneous journey completion can retry, so both kill and exploration contribution boundaries must be idempotent.
