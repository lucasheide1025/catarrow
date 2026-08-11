# Implementation plan

1. Build fast red-capable tests for floor-3 branch recovery, exact-tier generation, and the exam T1 boss damage transition.
2. Trace solo and team reconnect entry points and isolate the floor-shape validation contract.
3. Fix branch-only floor-3 restoration and ensure pending/team state remains authoritative.
4. Trace every active monster-generation path, remove legacy tier promotion/bypass behavior, and add parameterized family/tier coverage.
5. Minimize the exam T1 boss freeze to its exact monster ability/round transition and fix the invalid state.
6. Run focused regressions, relevant dungeon suites, lint, and build.
7. Review all changes against the dungeon spec and update the spec with any new non-obvious invariant.

## Risk points

- `DungeonExpedition.jsx` initialization effects can overwrite restored state if phase transitions race.
- Team writes must strip Firestore-incompatible nested `grid` arrays at every persistence call.
- Fixed bosses may come from legacy saved descriptors; normalization must not reroll a locked boss.
- Animation timers and Firestore snapshots can create re-entrant round handling.

## Validation commands

- `npm test -- --watchAll=false <focused test paths>`
- `npm run lint`
- `npm run build`
