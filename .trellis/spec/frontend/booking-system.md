# Online Booking System (Student Pilot)

> Self-built appointment/slot booking layered alongside the existing SimplyBook flow. Three entry points share one atomic capacity engine. See task `07-10-booking-system-student-pilot` for full research/rationale.

---

## Scenario: `bookingDb.js` capacity transaction + three shared entry points

### 1. Scope / Trigger

New Firestore collections (`bookings`, `bookingSlotCounts`) plus a cross-layer atomic-capacity contract shared by three distinct UI surfaces (student self-service, admin-created/phone-in, hidden public self-registration). Code-spec depth required.

### 2. Signatures

`src/lib/bookingDb.js`
```js
LANE_CAPACITY = 8   // named constant, whole-venue capacity, NOT per-instructor
createBooking(memberId, memberName, contact, planType, date, startTime, endTime, source, note) -> Promise<{ok, id} | {ok:false, reason}>
cancelBooking(bookingId) -> Promise<{ok} | {ok:false, reason}>
rescheduleBooking(bookingId, newDate, newStartTime, newEndTime) -> Promise<{ok, id} | {ok:false, reason}>
blockSlot(slotKey) / unblockSlot(slotKey)
getBookingsForMember(memberId) -> Promise<Booking[]>
getBookingsForDateRange(startDate, endDate) -> Promise<Booking[]>   // bounded `where` query, never unbounded
```

`src/lib/bookingSchedule.js` — read-only helpers, **no writes**: `slotsForDate(date)`, `isBusinessDay(date)`, `fetchSlotCountsForRange(...)`, `slotState(...)`, `PLAN_TYPES`. All actual mutations funnel through `bookingDb.js` — a stray write anywhere else bypasses the capacity-safety guarantee entirely.

### 3. Contracts

`bookings/{id}`: see `.trellis/tasks/archive/2026-07/07-10-booking-system-student-pilot/design.md` §1 for the full field list. Key invariant: `source` is one of `"online"` (student self-service) / `"online_public"` (hidden new-customer entry) / `"phone"` (admin-created) — all three call the identical `createBooking()`, no parallel logic paths.

`bookingSlotCounts/{slotKey}` (`slotKey = "YYYY-MM-DD_HH:mm"`): `{ count, blocked }` — the single source of truth for capacity. Never derive capacity by counting `bookings` docs client-side.

**Two independent safety layers, both mandatory**:
1. 30-minute minimum lead time (`checkLeadTime`, pure function, explicit `+08:00` Taipei offset, never ambient server/browser TZ) — runs before the transaction in both `createBooking` and `rescheduleBooking`.
2. Atomic capacity check+increment inside `runTransaction` (reads before writes, Firestore's own requirement) — this is what actually prevents double-booking, the 30-min check alone does not.

**`bookingStats` on `members/{id}`**: `totalBookings` = current valid count (increments on create, decrements on cancel, nets to zero on reschedule — NOT a lifetime "ever created" counter). `lastBookingAt` updates on create/reschedule, NOT on cancel. `firstBookingAt` is set once via read-check-then-conditionally-include-in-merge-payload (no Firestore primitive for "set only if absent"). These three fields exist specifically so a customer-list admin view never needs to separately query `bookings` per row — see `firestore-cost-optimization.md` for the general principle this follows.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| Slot already at `LANE_CAPACITY` (8) | `createBooking`/`rescheduleBooking`'s new-slot claim rejects inside the transaction |
| Slot `blocked:true` | Rejects same as full |
| Requested slot start < 30 min from now | Rejected before the transaction even opens (pure function check) |
| Reschedule | Old-slot release + new-slot claim happen in **one** `runTransaction` call, never two sequential calls (a window between them could let someone else claim the new slot, or leave a broken half-state) |
| Student self-service `update` on `bookings` | Firestore rule restricts to `hasOnly(["status","updatedAt","cancelledAt"])` — a student cannot rewrite date/time/plan directly; the only way to move a slot is through `rescheduleBooking()`'s capacity-checked path |

### 5. Good/Base/Bad Cases

- **Good**: two browser tabs race for the last slot at count 7/8 — exactly one `createBooking` succeeds, the other gets `{ok:false, reason:"這個時段已經滿了..."}`, counter lands at exactly 8, never 9.
- **Base**: admin creates a phone-in booking for a brand-new customer — `createBooking` is called with `source:"phone"`, same transaction, same capacity rules as a student's own self-service booking.
- **Bad**: computing "is this slot full" by doing `getDocs(query(bookings, where("slotKey","==",...)))` and counting client-side — this is exactly the "先查後寫" anti-pattern already forbidden project-wide (see `ai-guide.md` 鐵律 #8); two concurrent readers can both see "7, not full yet" and both write, producing 9.

### 6. Tests Required

- `test-booking-concurrency.js` (repo root, uses `firebase-admin` + `serviceAccountKey.json`) simulates the exact race above against the real Firestore project — **must be run once Firestore quota is available** (it was blocked by `RESOURCE_EXHAUSTED` during initial implementation; logic was verified correct by static trace but never executed live as of this writing). Self-cleans all `__booking_test__`-prefixed data it creates.
- Manual: full student flow (select→book→view→reschedule→cancel), full hidden-URL new-customer flow, full admin flow (calendar→create→block→report) — all still pending live verification, see task archive for the complete checklist.

### 7. Wrong vs Correct

#### Wrong
```js
// Checking capacity with a separate read, then writing separately
const snap = await getDocs(query(collection(db,"bookings"), where("slotKey","==",slotKey)));
if (snap.size < 8) {
  await addDoc(collection(db,"bookings"), {...});  // race window: two callers can both pass the check
}
```

#### Correct
```js
await runTransaction(db, async (tx) => {
  const counterSnap = await tx.get(counterRef);          // read first
  if ((counterSnap.data()?.count ?? 0) >= LANE_CAPACITY) throw new Error("SLOT_FULL");
  tx.set(counterRef, { count: increment... }, {merge:true});  // write second, same transaction
  tx.set(bookingRef, {...});
});
```

---

## Convention: gate new member-facing features through BOTH `bookingBetaAccess` AND `accessControl.js`

**What**: `MemberApp.jsx`'s booking tab checks `profile?.bookingBetaAccess===true || role==="admin"` for pilot-rollout gating, AND the page id `"booking"` is registered in `src/lib/accessControl.js`'s `PAGE_REGISTRY` so the coach's existing tier-permission matrix (`restricted`/`autoLocked`/`retired`) can also control it independently.

**Why**: these are two different concerns that are easy to conflate. `bookingBetaAccess` answers "is this feature ready to show this specific person yet" (a rollout lever, temporary). `accessControl.js` answers "does this person's current standing (frozen, auto-locked from inactivity, retired) allow ANY gated feature" (a standing lever, permanent, already existed before this feature). A new page/tab must satisfy both independently — registering in `PAGE_REGISTRY` alone doesn't add it to any default-allow list (so it defaults to **denied** for restricted-tier members, not allowed — verify this is actually the desired failure direction for any new page, don't assume), and skipping `PAGE_REGISTRY` entirely means the coach's admin UI has no checkbox to ever grant access to a locked-down member, silently taking away a control surface that should exist.

**Related**: [[firestore-cost-optimization]] — same "who else reads/depends on this" discipline applies to permission registries as it does to shared mutable state.

## Convention: hidden/unlinked route as a lightweight interim access control

**What**: `PublicBookingApp.jsx` is reachable via `?bk=<random-looking-token>` in `App.jsx`, with no link to it anywhere in `src/` or `website/` (verified by exhaustive grep), plus a runtime-injected `<meta name="robots" content="noindex,nofollow">`.

**Why**: this is a deliberate, explicitly-temporary tradeoff, not a real access-control mechanism — there is no App Check, no rate limiting, no CAPTCHA. It is acceptable ONLY because (a) the token isn't linked anywhere a crawler or casual visitor would find it, and (b) the underlying write path (`resolveGuestSession` + `createBooking`) was already hardened by the anonymous-auth-reuse fix in `guest-kid-mode.md`. If this URL is ever shared beyond the coach's direct control, or if this system is promoted to the site's real public booking entry point, real anti-abuse protection (Firebase App Check at minimum) must be added first — this is explicitly listed as a non-goal/deferred item in the originating task's PRD, not an oversight.

## Known limitation: bookings are uniform 1-hour regardless of plan type

**What**: despite the plan-type pricing table implying some plans run 3 hours, every `bookings` doc created by the current implementation is exactly 1 hour, because `bookingDb.js`'s capacity transaction only locks a single `slotKey` per booking (no multi-slot atomic locking exists).

**Why this is a known gap, not a bug**: extending to real multi-hour bookings requires a data-layer change (locking N consecutive slot-count docs atomically within one transaction, and correctly rolling back all of them together on any single slot's rejection) — this was out of scope for the UI-layer dispatch that discovered the mismatch. Do not "fix" this by having the UI just create multiple 1-hour bookings in a loop (that's the same forbidden "sequential non-atomic writes" pattern this whole system was built to avoid) — a real fix needs to extend `bookingDb.js`'s transaction to accept a duration and lock the full consecutive range atomically.
