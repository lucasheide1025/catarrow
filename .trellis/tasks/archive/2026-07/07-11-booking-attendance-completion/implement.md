# Implementation Plan

- [x] Add booking start/lifecycle helpers and enforce immutable started bookings in transactions.
- [x] Add checkin-to-booking linking at student check-in.
- [x] Connect the existing student class-end and coach review flow to booking completion without adding a parallel request state.
- [x] Add idempotent booking/checkin billing linkage shared by both admin entry points.
- [x] Update MemberBooking history/status/actions.
- [x] Update AdminDailyQuest review completion and already-billed states.
- [x] Update AdminBooking checkout and completed states; remove re-checkout.
- [x] Add recent-14-day student query and default quick list.
- [x] Add one-click walk-in booking without a member document, with phone and note fields.
- [x] Verify Firestore rules deployment and production build; lifecycle paths are statically traced and require live appointment/checkin data for end-to-end confirmation.
- [x] Update booking/checkin specs and prepare only task-related files for commit.

## Rollback points

- New lifecycle fields are additive and old records remain compatible.
- Walk-in is isolated by `source:"walk_in"`.
- Existing checkins without booking links keep their current standalone behavior.
