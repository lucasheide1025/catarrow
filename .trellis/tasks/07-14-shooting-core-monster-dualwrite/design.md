# Design: core shooting records and monster dual-write

## Boundaries

`src/lib/shootingPerformance.js` owns schema construction, arrow conversion, metrics and performance-key calculation. `src/lib/db.js` owns Firestore persistence and idempotency. `MonsterBattle.jsx` remains the integration boundary and preserves legacy writes.

## Write model

The battle UI builds a deterministic `sessionId` at finalization time. The writer uses that ID for `shootingSessions`, `gamePerformances`, and `arrowCountEvents`; a Firestore transaction rejects a conflicting member/session pair and creates the arrow event exactly once. Ends use deterministic IDs (`end-001`, etc.).

The Session stores a snapshot of all archer data. GamePerformance stores the final damage, HP and reward snapshots but does not derive its result from later Session corrections. `locked` and `gameResultLocked` are always true after finalization.

## Compatibility and failure handling

Legacy `practiceLogs` and `monsterLogs` stay as-is. New writes are best-effort from the existing battle completion path: an error is logged but cannot cancel rewards, XP, old log writes or navigation. Existing records are never transformed.

## Reading model

This task adds no listeners. Future overview pages query summarized Session documents only; single-session detail reads the `ends` subcollection on demand.
