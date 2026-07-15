# Implementation Plan

1. Add centralized Taiwan date, member-scoped daily-arrow storage, event subscription, and one-off initialization helpers.
2. Replace duplicated component `localStorage` listeners with the shared helper.
3. Implement member-scoped durable arrow-operation aggregation, stable operation IDs, threshold timers, single-flight idempotent Firestore transactions, and explicit lifecycle flush helpers.
4. Include member lifetime arrows, excavation progress, and active village-goal contribution inside the operation's idempotency boundary; add narrowly scoped Firestore rules for operation documents.
5. Change shooting finalization so ordinary calls enqueue only and flush calls perform idempotent Firestore transactions; make session completion trigger pending arrow flushes.
6. Add focused tests for date/key isolation, local events, aggregation thresholds, replay idempotency, and queue/flush behavior where the existing test setup permits.
7. Run the production build and inspect the complete diff and Firestore rule behavior for unrelated changes.
