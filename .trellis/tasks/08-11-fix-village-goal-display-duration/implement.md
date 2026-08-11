# Implementation plan

1. Add red-capable tests for the generic monster-kill title, persisted 24-hour legacy schedule, missing kill increment, and obsolete board-lap semantics.
2. Introduce a canonical goal display resolver and use it in all player/admin surfaces.
3. Version schedule persistence and migrate unversioned legacy 24-hour settings to the modern default.
4. Extend existing active legacy-short goals according to the approved migration policy.
5. Remove hard-coded 24-hour defaults from both admin creation surfaces.
6. Expand the player reward preview to show participation, variable effort, and celebration chest rewards from canonical helpers.
7. Connect monster-session victory to an idempotent village-goal kill contribution and cover deferred replay.
8. Rename the goal to cat-exploration completions, wire solo/team terminal completion, and retain legacy `board_laps` compatibility.
9. Update and test the approved target curves: monster kills `40/100/160/240`, exploration completions `30/70/105/150`.
10. Run focused village-goal suites and production build.
11. Review against frontend specs and record the migration/display invariant.

## Risk points

- A coach may have deliberately configured 24 hours; migration must distinguish legacy state from current explicit configuration.
- Firestore timestamps may be absent on older goals.
- Multiple clients can enter the village simultaneously, so migration must be idempotent.
- Offline queue replay can execute finalization more than once, so kill contribution needs an operation marker.
- Legacy `board_laps` goals may remain active while new clients emit exploration-completion events.

## Validation commands

- `npm.cmd test -- --watchAll=false --runTestsByPath <village goal suites>`
- `npm.cmd run build`
