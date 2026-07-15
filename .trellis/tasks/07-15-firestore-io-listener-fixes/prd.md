# Fix Firestore I/O and listener optimizations

## Goal

Keep the intended Firestore cost reductions without introducing stale, cross-account, or duplicate local state.

## Confirmed Facts

- `addRoundArrows` is the actual hot path and still performs official-account Firestore writes each scored round; shooting-performance finalization happens once per completed session.
- Twelve gameplay/scoring call sites finalize shooting sessions, while flush currently runs on profile load, class end, and performance-history opening.
- Session IDs are deterministic and the transaction exits when the session already exists, so retries are idempotent.
- The existing daily practice query shape (`memberId` + `date`) was already used in production and can be reused as a one-off read without adding a listener.
- Browser storage is shared by accounts on coach/camp devices, and project rules require gameplay-affecting keys to include `memberId`.
- Each student is expected to use one phone; continuous cross-device synchronization of today's arrow counter is not required.

## Requirements

- Browser-stored daily arrow counts must be isolated by member identity and use the Asia/Taipei calendar date.
- Daily arrow UI must update in the current tab and other tabs without opening a Firestore live listener.
- Existing server-side daily practice data must remain available as a one-off initialization fallback.
- Shooting-performance sessions must be durably queued before upload, uploaded only at explicit flush points, and removed from the queue after successful or already-existing idempotent writes.
- Queue flushing must preserve entries belonging to other members and failed uploads.
- Official-account arrow progress writes must aggregate locally and flush at 12 arrows, 10 seconds, session/app lifecycle boundaries, login, and class end.
- Every aggregate must use a stable operation ID so a successful Firestore write can be retried without double-counting.
- One-off inventory/card/certification reads must retain explicit post-mutation UI refresh behavior.
- Guest/kid accounts must not create official Firestore progress writes.

## Acceptance Criteria

- [ ] Daily-arrow storage keys include `memberId` and a Taiwan-local `YYYY-MM-DD` date.
- [ ] Switching accounts in the same browser cannot expose the previous account's daily count.
- [ ] A scored round updates all mounted same-tab and cross-tab daily-arrow displays.
- [ ] A fresh browser can initialize today's value with one bounded Firestore fetch, without `onSnapshot`.
- [ ] Normal session finalization performs no shooting-performance Firestore transaction; explicit flush performs the transaction.
- [ ] Successful flushes remove queued sessions; failed and other-member entries remain queued.
- [ ] Session document IDs keep flush retries idempotent.
- [ ] Twenty three-arrow rounds cause substantially fewer than twenty arrow-progress flushes under normal timing.
- [ ] Replaying an already-processed arrow operation does not increment lifetime arrows, excavation, or village-goal contribution again.
- [ ] Failed arrow operations remain in member-scoped browser storage and retry later.
- [ ] Production build and targeted tests pass.

## Constraints

- Do not add a new Firestore composite-index deployment requirement.
- Preserve existing exported APIs where practical.
- Do not modify or commit unrelated dirty files.

## Product Decisions

- Today's arrow counter uses one-off server initialization plus immediate member-scoped device-local updates; no cross-device live synchronization is required.
- High-frequency `addRoundArrows` writes use the recommended reliable aggregation design: 12-arrow or 10-second threshold plus stable-operation-ID retries.

## Out of Scope

- Redesigning all existing Firestore collections or replacing Firebase.
- Adding a permanently open daily-arrow listener solely to obtain cross-device counter updates.
