# Technical Design

## 1. Calendar presentation

`CalendarTab` defaults `viewMode` to `day`.

Day view becomes a scheduler with one time-label column and eight stable lane columns. Confirmed bookings are sorted by start time and assigned deterministic contiguous lane ranges using an interval-packing pass:

- each booking requires `participantCount` adjacent lanes;
- a lane is unavailable when another booking overlaps any occupied hour;
- the booking element starts at its `startTime`, spans `durationHours` rows, and spans `participantCount` lane columns;
- the element displays customer, plan, headcount, and duration once;
- clicking the block opens the start-slot detail modal.

This lane assignment is presentation-only. Capacity remains sourced from `bookingSlotCounts`; the layout must visibly flag inconsistent legacy data rather than silently changing counts.

Week view keeps the existing per-day/per-hour summary grid, but a booking summary must include headcount and duration. It is not the primary lane visualization.

## 2. Range blocking

Add `setSlotRangeBlocked(date, startTime, endTime, blocked)` in `bookingDb.js`. It derives hourly slot keys for the half-open range `[startTime, endTime)` and writes all `blocked` flags with one Firestore `writeBatch`, so the range is committed atomically.

The calendar gets a range-management action. The modal selects date, start time, end time, and action (close/open). End must be later than start and both endpoints must align with supported hourly schedule boundaries. Existing single-slot toggle remains available in slot detail.

Blocking an occupied range does not cancel existing bookings; it prevents new bookings and reschedules into that range. The UI warns when selected slots already contain bookings.

## 3. Admin booking creation

`CreateBookingModal` treats `initialSlot` as immutable start context for that invocation. After customer selection it shows:

- selected customer;
- fixed date and start time summary;
- plan/duration picker;
- participant count picker;
- new/returning toggle;
- computed end time and total price;
- submit action.

It removes `DateSlotPicker`. Changing duration or participant count no longer clears the selected start slot. Submission computes `endTime` from the fixed start and chosen duration. Capacity and blocked checks still occur in the data-layer transaction.

## 4. Admin time-rule bypass

Extend `createBooking` with an optional final options object, defaulting to `{ bypassLeadTime: false }`. Only `AdminBooking` passes `{ bypassLeadTime: true }`; member and public callers omit it and retain current behavior.

The bypass skips only `checkLeadTime`. It does not bypass capacity, blocked slots, participant limits, transaction atomicity, or source validation. This keeps past administrative records possible without weakening public flows.

## 5. Compatibility and safety

- Existing bookings without `slotKeys` fall back to `slotKey` and `durationHours || 1`.
- Existing `participantCount` omissions fall back to 1.
- `slotKeys[]` and counter updates remain one transaction for booking creation.
- Range blocking uses a batch, not sequential `setDoc` calls.
- Firestore rules must be reviewed to confirm authenticated admin writes are already permitted for all affected documents.

## 6. Validation

- Pure layout helper tests: overlapping bookings, multiple participants, 1/2/3-hour spans, and no contiguous lane availability.
- Data-layer tests or static contract tests: lead-time bypass applies only when explicitly requested; range key derivation is half-open and atomic.
- Build plus desktop/mobile calendar inspection.
