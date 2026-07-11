# Technical Design

## 1. Booking lifecycle

Bookings gain explicit lifecycle metadata while preserving existing records:

- `status:"confirmed"`: scheduled or in progress;
- `status:"completed"`: coach-confirmed class completion or checkout-completed fallback;
- `status:"cancelled"`: cancelled/rescheduled legacy behavior;
- `completedAt`, `completionSource:"checkin"|"checkout"`, `checkinId`, `billingRecordId`.

Member lists include confirmed and completed bookings. Completed cards remain visible as history and show `已完成課程`; only future confirmed bookings expose cancel/reschedule actions.

`cancelBooking` and `rescheduleBooking` validate the original booking start instant inside the transaction. They reject when start time has arrived or status is no longer confirmed. UI disabling is supplementary.

## 2. Check-in and class-end request

Student check-in attempts to link the checkin to the confirmed booking for the same member/date whose `[startTime,endTime)` contains the current Taipei time. The association writes `checkins.bookingId` and `bookings.checkinId`. If no booking matches, normal walk-in checkin remains valid without a booking link.

Keep the existing student `submitClassEnd` behavior and the existing AdminDailyQuest review surface. Do not add a second class-end request state. The existing student action makes the checkin appear in the coach's completed/review list; booking completion happens only when the coach finishes that existing review through billing or the existing "完成未記帳" action.

The shared completion function idempotently marks the linked booking completed with `completionSource:"checkin"`. Existing attendance rewards and force-end behavior remain unchanged.

## 3. Billing linkage and idempotency

Both AdminBooking checkout and AdminDailyQuest billing write the billing record first, then call one linkage helper with `bookingId`, `checkinId`, and `billingRecordId`. The helper refuses to replace an existing different `billingRecordId`, marks the booking completed with `completionSource:"checkout"` when needed, and mirrors the billing ID onto the checkin.

AdminDailyQuest hides billing controls when its linked booking/checkin already has a billing ID. AdminBooking removes `重新結帳`; a booking with `billingRecordId` only displays `已結帳`.

If post-billing linkage fails, the UI reports a partial-failure warning instead of silently inviting another checkout. Existing legacy billing records without linkage are not automatically guessed by name.

## 4. Recent students and walk-in visitor

Add a bounded `getRecentCheckinMembers(14)` query over checkins by date. AdminBooking loads it alongside members, deduplicates by memberId, and shows those official students before text search, ordered by latest visit.

The create modal offers three entry modes:

- `近期學生`: default two-week list;
- `搜尋顧客`: full member/guest search;
- `臨時訪客`: one click selects `{ memberId:null, memberName:"臨時訪客", source:"walk_in" }`.

`createBooking` permits a missing memberId only for source `walk_in`; it still performs the same atomic capacity transaction but skips member bookingStats updates.

## 5. Compatibility and rules

- Existing confirmed/cancelled records remain readable.
- Existing checkins without bookingId continue through the daily workflow.
- Firestore admin rules already permit booking/checkin writes; student booking update restrictions must be reviewed because lifecycle writes are performed only by admin UI.
- All time comparisons use explicit Taipei offset.

## 6. Validation

- Started booking cannot cancel/reschedule in UI or data layer.
- Student request does not complete until coach confirmation.
- Daily billing then booking view: no second checkout.
- Booking checkout then daily view: no second billing.
- Walk-in checkout completes without member document.
- Recent list includes only unique students with checkins in last 14 days.
