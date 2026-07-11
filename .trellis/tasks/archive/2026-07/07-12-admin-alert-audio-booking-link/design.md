# Technical Design

## Audio

Keep the existing Web Audio synthesis and three public sound functions. Increase alert gains and duration without changing global game sounds. Preserve the current 12-second reminder lifecycle and independent read/dismiss state in `AdminBookingAlert` and `AdminApp`.

## Billing fallback

`completeBookingForMemberOnDate` reads the checkin document when available. Candidate bookings share member/date, have no billingRecordId, and are confirmed or completed. Selection order:

1. booking.checkinId matches;
2. booking interval contains checkin createdAt/classEndedAt time;
3. booking interval contains current Taipei time;
4. nearest start time to checkin time.

No candidate returns `ok:false` so AdminDailyQuest cannot silently dismiss the review. Existing billing ID in local bill state is reused on retry.

## Checkout gate

Before opening AdminBooking checkout, resolve the member account type and same-day checkin. Official students require `classEnded:true`. If the checkin already has a billingRecordId, repair the booking linkage and refresh instead of opening checkout. Walk-in, `online_public`, and guest/kid accounts bypass the class-end requirement.

## Verification

Trace both checkout entry points, build production bundle, and verify no unrelated sound gains change.
