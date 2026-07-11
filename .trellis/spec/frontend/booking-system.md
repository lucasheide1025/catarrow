# Online Booking System (Student Pilot + Multi-hour/Stats)

> Self-built appointment/slot booking layered alongside the existing SimplyBook flow. Three entry points share one atomic capacity engine that now supports multi-slot (1 or 3 hour) bookings. See tasks `07-10-booking-system-student-pilot` and `07-10-booking-multihour-and-stats` for full research/rationale.

---

## Scenario: `bookingDb.js` capacity transaction + three shared entry points

### 1. Scope / Trigger

New Firestore collections (`bookings`, `bookingSlotCounts`) plus a cross-layer atomic-capacity contract shared by three distinct UI surfaces (student self-service, admin-created/phone-in, hidden public self-registration). Bookings can span **multiple consecutive hourly slots** (1 hour, or 3 hours = the "2-for-1" plan option) — capacity locking generalizes from a single `slotKey` to a `slotKeys[]` array, all-or-nothing across every slot in one transaction. Code-spec depth required.

### 2. Signatures

`src/lib/bookingDb.js`
```js
LANE_CAPACITY = 8   // named constant, whole-venue capacity, NOT per-instructor
createBooking(memberId, memberName, contact, planType, durationHours, isNewStudent, date, startTime, endTime, source, note) -> Promise<{ok, id} | {ok:false, reason}>
cancelBooking(bookingId) -> Promise<{ok} | {ok:false, reason}>
rescheduleBooking(bookingId, newDate, newStartTime, newEndTime) -> Promise<{ok, id} | {ok:false, reason}>  // durationHours/isNewStudent carried over unchanged from the original booking
blockSlot(date, startTime) / unblockSlot(date, startTime)
getBookingsForMember(memberId) -> Promise<Booking[]>
getBookingsForDateRange(startDate, endDate) -> Promise<Booking[]>   // bounded `where` query, never unbounded
```

`src/lib/bookingSchedule.js` — read-only helpers, **no writes**: `slotsForDate(date)`, `isBusinessDay(date)`, `fetchSlotCountsForRange(...)`, `slotState(date, startTime, slotCounts, durationHours=1)`, `computeEndTime(startTime, durationHours)`, `PLAN_TYPES`, `DURATION_OPTIONS`. All actual mutations funnel through `bookingDb.js` — a stray write anywhere else bypasses the capacity-safety guarantee entirely.

### 3. Contracts

`bookings/{id}`: see task design docs for the full field list. New fields (multihour task): `durationHours: 1|3`, `slotKeys: string[]` (every hourly slot key this booking occupies), `isNewStudent: boolean` (self-declared by the user at booking time — NOT derived from `accountType`, since official students were once new and guest accounts can be repeat visitors). `slotKey` (singular) is kept = `slotKeys[0]` for backward compatibility with any old reads. Key invariant: `source` is one of `"online"` (student self-service) / `"online_public"` (hidden new-customer entry) / `"phone"` (admin-created) — all three call the identical `createBooking()`, no parallel logic paths.

`bookingSlotCounts/{slotKey}` (`slotKey = "YYYY-MM-DD_HH:mm"`, one document per **hourly** slot regardless of any booking's duration): `{ count, blocked, newCount, returningCount }` — the single source of truth for capacity AND for new/returning-student stats. Invariant: `count === newCount + returningCount`, and all three are always written together in the same `tx.set()`. Never derive capacity or new/returning counts by counting `bookings` docs client-side.

**Multi-slot atomicity (the core generalization)**: a booking spanning N hourly slots must lock/release all N `bookingSlotCounts` docs inside **one** `runTransaction` — all reads (via `Promise.all(refs.map(ref => tx.get(ref)))`, or a sequential `for...of` fallback if parallel `tx.get()` ever proves unsupported) before any writes, then every slot checked for `blocked`/`count>=LANE_CAPACITY` before ANY slot is written. If any one of the N slots fails, the whole transaction throws and zero slots are touched — a 3-hour booking can never partially reserve 2 of 3 slots. This is the same single-slot principle from the original design, just applied to an array instead of one ref.

**Hourly slot key semantics**: a slot key represents "an hour this booking occupies its START in" — a 3-hour booking starting at 9:00 occupies keys `9:00,10:00,11:00` (NOT `12:00`, even though the booking's `endTime` is 12:00). This is why a later slot (e.g. 10:00) correctly reflects people who started earlier and are still "in" that hour, while the hour the booking ends AT is correctly excluded.

**Two independent safety layers, both mandatory**:
1. 30-minute minimum lead time (`checkLeadTime`, pure function, explicit `+08:00` Taipei offset, never ambient server/browser TZ) — runs before the transaction in both `createBooking` and `rescheduleBooking`, and only checks the **start** slot (not mid-span or end slots).
2. Atomic capacity check+increment inside `runTransaction` (reads before writes, Firestore's own requirement) — this is what actually prevents double-booking, the 30-min check alone does not.

**`bookingStats` on `members/{id}`**: `totalBookings` = current valid count (increments on create, decrements on cancel, nets to zero on reschedule — NOT a lifetime "ever created" counter). `lastBookingAt` updates on create/reschedule, NOT on cancel. `firstBookingAt` is set once via read-check-then-conditionally-include-in-merge-payload (no Firestore primitive for "set only if absent"). These three fields exist specifically so a customer-list admin view never needs to separately query `bookings` per row — see `firestore-cost-optimization.md` for the general principle this follows.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| Any one of the N slots a booking spans is already at `LANE_CAPACITY` (8) | Entire `createBooking`/`rescheduleBooking` call rejects inside the transaction, zero slots written; error message names which hour failed when `durationHours > 1` |
| Any one of the N slots `blocked:true` | Rejects same as full |
| Requested slot start < 30 min from now | Rejected before the transaction even opens (pure function check); only the start slot is checked |
| Reschedule | Old-slots release + new-slots claim happen in **one** `runTransaction` call across the full old∪new slot-key set, never two sequential calls. Slots present in both old and new sets are left untouched (net-zero change), only truly-added/truly-removed slots get written. `durationHours`/`isNewStudent` are NOT changeable via reschedule — carried over from the original booking. |
| Student self-service `update` on `bookings` | Firestore rule restricts to `hasOnly(["status","updatedAt","cancelledAt"])` — a student cannot rewrite date/time/plan directly; the only way to move a slot is through `rescheduleBooking()`'s capacity-checked path |

### 5. Good/Base/Bad Cases

- **Good**: two browser tabs race for the last slot at count 7/8 — exactly one `createBooking` succeeds, the other gets `{ok:false, reason:"這個時段已經滿了..."}`, counter lands at exactly 8, never 9. This holds identically for 3-hour bookings racing over N slots (see `test-booking-concurrency.js` Test E) — the loser leaves ALL of its target slots completely untouched, not partially incremented.
- **Base**: admin creates a phone-in booking for a brand-new customer — `createBooking` is called with `source:"phone"`, same transaction, same capacity rules as a student's own self-service booking.
- **Bad**: computing "is this slot full" by doing `getDocs(query(bookings, where("slotKey","==",...)))` and counting client-side — this is exactly the "先查後寫" anti-pattern already forbidden project-wide (see `ai-guide.md` 鐵律 #8); two concurrent readers can both see "7, not full yet" and both write, producing 9.
- **Bad (multihour-specific)**: looping and calling `createBooking` three times (once per hour) to fake a 3-hour booking — that's the same forbidden sequential-non-atomic pattern; a real 3-hour booking must lock all 3 slots in ONE transaction.

### 6. Tests Required

- `test-booking-concurrency.js` (repo root, uses `firebase-admin` + `serviceAccountKey.json`) simulates capacity races against the real Firestore project — **must be run once Firestore quota is available** (blocked by `RESOURCE_EXHAUSTED` since initial implementation; logic verified correct by static trace but never executed live as of this writing). Test E (added by the multihour task) specifically races two 3-hour bookings for a shared bottleneck slot and asserts the loser leaves zero writes across all 3 of its target slots. Self-cleans all `__booking_test__`-prefixed data it creates.
- Manual: full student flow (select→book→view→reschedule→cancel) for both 1-hour and 3-hour plans, full hidden-URL new-customer flow, full admin flow (calendar→create→block→report), and the specific new/returning-count-across-hours scenario (a 3-hour booking starting 9:00 must still count toward 10:00/11:00's stats, but not 12:00's) — all still pending live verification.

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
// Generalized to N slots (design.md §3 of the multihour task) — all reads before any writes,
// every slot checked before ANY slot is written, so a partial 2-of-3 reservation can never happen.
await runTransaction(db, async (tx) => {
  const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)));   // read all first
  const counters = counterSnaps.map(readCounter);
  counters.forEach((c, i) => {
    if (c.blocked)                throw new Error(`SLOT_BLOCKED:${slotKeys[i]}`);
    if (c.count >= LANE_CAPACITY) throw new Error(`SLOT_FULL:${slotKeys[i]}`);
  });
  counterRefs.forEach((ref, i) => tx.set(ref, { count: counters[i].count + 1, ... }, {merge:true})); // write second
  tx.set(bookingRef, { slotKeys, ... });
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

## Resolved: bookings now support 1-hour and 3-hour ("2-for-1") durations

**What was fixed (07-10-booking-multihour-and-stats)**: the original student-pilot implementation only ever created 1-hour bookings, because the capacity transaction locked a single `slotKey`. This is now generalized — `createBooking`/`cancelBooking`/`rescheduleBooking` all operate on a `slotKeys[]` array (1 or 3 consecutive hourly keys), locking/releasing every slot in the array atomically within one `runTransaction`, per §3 above. There is no longer a uniform-1-hour limitation.

**Do not regress this** by having the UI create multiple 1-hour bookings in a loop to fake a multi-hour one — that reintroduces the exact "sequential non-atomic writes" anti-pattern this whole system was built to avoid. Any future duration options (e.g. 2-hour) should extend `slotKeysFor()`'s consecutive-key generation, not bypass the transaction.

## Convention: admin schedule operations preserve public time rules

The admin calendar uses an eight-lane day scheduler: each participant occupies one lane and multi-hour bookings span consecutive time rows. This is presentation-only; `bookingSlotCounts` remains the capacity source of truth.

Admin-created bookings may backfill past dates through `createBooking(..., { bypassLeadTime:true })`. The option defaults to false and must only be passed by the authenticated admin flow. It skips only the 30-minute lead-time check; blocked-slot and capacity transaction checks remain mandatory.

Closing or opening a continuous time range uses `setSlotRangeBlocked()` and one Firestore `writeBatch`. Never loop over `blockSlot()` calls from the UI because a network failure could leave a partially updated range. The range is half-open: 13:00-17:00 updates the 13:00, 14:00, 15:00, and 16:00 slot documents.

## Convention: booking completion links check-in and billing records

A booking becomes immutable when its Taipei start instant arrives. Both the UI and the `cancelBooking` / `rescheduleBooking` transactions enforce this; UI-only disabling is insufficient.

Student check-in links the matching same-day booking through `bookings.checkinId` and `checkins.bookingId`. Coach review completion or checkout changes the booking to `status:"completed"`. Billing records store both identifiers, and the resulting `billingRecordId` is mirrored to the booking and checkin so AdminBooking and AdminDailyQuest cannot offer duplicate checkout actions.

Walk-in visitors use `source:"walk_in"`, `memberId:null`, a manually entered phone, and optional note. They participate in the identical slot-capacity transaction but intentionally skip member document and bookingStats updates.

## Convention: official-student checkout requires class end

AdminBooking checkout for an official student requires the same-day checkin to have `classEnded:true`. If that checkin already references a billing record, repair the booking linkage instead of opening another checkout. Walk-in, public guest, and guest/kid accounts bypass this class-end gate.

Admin calendar loading also repairs legacy partial failures by matching date-range billing records through `bookingId` or `checkinId`. Completion fallback must never return success when no booking was linked; use checkin creation time and nearest same-day unbilled booking to resolve ambiguous records.
