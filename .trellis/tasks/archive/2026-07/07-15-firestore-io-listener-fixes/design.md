# Design

## Daily arrow state

Centralize the Taiwan-local date and member-scoped storage key in `db.js`. A helper reads/writes the local total and emits a lightweight custom browser event for same-tab consumers; the native `storage` event continues to cover other tabs. Components subscribe through one shared helper instead of duplicating key logic.

On mount, perform a one-off query using the already deployed `practiceLogs(memberId, date)` query shape. Reconcile the server total with the stored total using the larger value so a cleared/new browser can recover server history without lowering unsynced local progress. No live listener is opened. Continuous cross-device synchronization is intentionally excluded because each student is expected to use one phone.

## Shooting session queue

Normal finalization validates/builds the record, stores the original input in the bounded local queue, and returns the deterministic session ID without contacting Firestore. `flushPendingShootingSessions` invokes the same finalizers with the internal skip-queue flag; only that path executes the idempotent transaction. Successful/already-existing writes are removed, failures remain.

Flush points remain app/profile initialization and class end. The queue stays member-filtered and bounded.

## Arrow-progress aggregation

`addRoundArrows` remains the public entry point. It updates the member-scoped daily local counter immediately, appends the count to a durable per-member pending batch, and schedules a single-flight flush. A batch flushes when it reaches 12 arrows, is 10 seconds old, or an explicit lifecycle flush is requested.

Each pending batch has a stable operation ID derived from a persistent device ID plus a monotonically increasing local sequence. The Firestore transaction reads `arrowRoundOperations/{operationId}` first. If it exists, the retry is already complete. Otherwise the transaction updates `members/{memberId}` lifetime/excavation fields and creates the operation document atomically. Village-goal contribution is applied through the same idempotent operation boundary; when an active arrow goal exists its document is included in the transaction.

The local entry is removed only after the idempotent transaction succeeds. Timers are an optimization, while persisted pending operations and explicit flush points provide recovery. Guest/kid accounts update the local display but do not enqueue official progress writes.

`arrowRoundOperations` is a new write-only operational collection for logged-in clients; no query or composite index is required. Rules must prevent changing an existing operation document and bind creation to the authenticated member identity as far as the existing member/auth model permits.

## Compatibility

Keep existing `subscribe*` one-off APIs and their no-op unsubscribe functions. Mutation callers continue updating state from returned inventories or explicit refresh helpers.

## Risks and rollback

- Deferred sessions are browser-local until flush; the queue is written before the API reports success and retried at two existing flush points.
- Batched arrow progress is browser-local for at most the threshold window during normal operation; a crash is recovered from persisted operations.
- Operation documents add one small write per aggregate in exchange for eliminating most per-round member and goal writes.
- One-off daily server recovery is eventually consistent across devices, intentionally avoiding a permanent listener.
- Rollback is limited to the touched daily-arrow helpers/components and finalization control flow.
