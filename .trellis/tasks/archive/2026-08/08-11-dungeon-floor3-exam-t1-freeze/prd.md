# Dungeon resume and encounter consistency fixes

## Goal

Make solo and team dungeon expeditions resume at the exact saved location and ensure every encounter uses the dungeon's locked difficulty tier without freezing after damage resolution.

## Confirmed facts

- Solo floor 3 uses `branchFloor`, `branchChoice`, and `branchStep`; `gridFloor` is intentionally `null`.
- Solo restore currently accepts a saved map only when `restoredMapState.gridFloor` exists, so a valid floor-3 branch save is regenerated at its entrance.
- Team exploration state is persisted in `expeditionMapState` on the coordination room and must remain the reconnect source of truth.
- Dungeon difficulty Tn must select tier Tn. Room role changes `variant` (`weak`, `normal`, `strong`, `boss`) but must not promote the monster tier.
- The reported combat freeze occurs in the exam-family T1 boss room after the player deals damage.

## Requirements

1. A refresh during solo floor 3 restores the same branch, branch step, and pending exploration position rather than restarting at the floor entrance.
2. A refresh/reconnect during a team floor-3 expedition restores the coordination room's current map/battle state rather than restarting at an entrance.
3. T1 through T6 ordinary, elite, fallback, and boss encounter generation stays on the selected dungeon tier in both solo and team modes.
4. Exam-family T1 boss combat completes damage and advances to the next valid battle state without a stuck animation/input state.
5. Existing saved runs remain compatible where sufficient recovery data exists.

## Acceptance criteria

- An automated regression test fails on the old floor-3 restore condition and passes when a branch-only map state is restored.
- Tests cover both solo and team restore/serialization boundaries for floor 3.
- A parameterized generation test verifies every family and dungeon difficulty produces only the matching tier across normal, elite, fallback, and boss paths.
- A focused exam T1 boss round test drives the real damage-resolution path and proves it reaches a non-stuck next state.
- Relevant targeted tests, lint, and build/type checks pass.

## Out of scope

- Changing dungeon difficulty balance, variant multipliers, rewards, or map layouts.
- Migrating irrecoverably incomplete legacy saves.
- Redesigning battle animations or dungeon UI.

## Open questions

- None currently; repository evidence defines the intended tier and recovery contracts.
