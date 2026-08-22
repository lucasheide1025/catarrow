import {
  billingRecordMatchesBooking,
  checkinAllowsRegularCheckout,
  checkinMatchesBooking,
  selectLegacyBookingForCheckin,
} from "./bookingCheckoutLink";

describe("booking/checkin linkage", () => {
  const bookingA = { id:"A", memberId:"m1", status:"completed", date:"2026-08-20", startTime:"10:00", endTime:"11:00", checkinId:"m1_2026-08-20", billingRecordId:"billA" };
  const bookingB = { id:"B", memberId:"m1", status:"confirmed", date:"2026-08-20", startTime:"13:00", endTime:"14:00" };

  test("old completed checkin A cannot authorize new booking B", () => {
    const checkinA = { bookingId:"A", classEnded:true };
    expect(checkinMatchesBooking(bookingB, checkinA, "m1_2026-08-20")).toBe(false);
    expect(checkinAllowsRegularCheckout(bookingB, checkinA, "m1_2026-08-20")).toBe(false);
  });

  test("exact bookingId + classEnded authorizes regular checkout", () => {
    const checkinB = { bookingId:"B", classEnded:true };
    expect(checkinAllowsRegularCheckout(bookingB, checkinB, "m1_2026-08-20")).toBe(true);
  });

  test("legacy checkin can match only an explicitly persisted booking.checkinId", () => {
    const legacyBooking = { ...bookingB, checkinId:"legacy-checkin" };
    expect(checkinMatchesBooking(legacyBooking, { classEnded:true }, "legacy-checkin")).toBe(true);
    expect(checkinMatchesBooking(bookingB, { classEnded:true }, "m1_2026-08-20")).toBe(false);
  });

  test("old billing record with same daily checkin id cannot complete a fresh booking", () => {
    const oldBill = { bookingId:"A", checkinId:"m1_2026-08-20" };
    const legacyOldBill = { checkinId:"m1_2026-08-20" };
    expect(billingRecordMatchesBooking(bookingB, oldBill)).toBe(false);
    expect(billingRecordMatchesBooking(bookingB, legacyOldBill)).toBe(false);
    expect(billingRecordMatchesBooking(bookingA, oldBill)).toBe(true);
  });

  test("legacy fallback refuses ambiguous same-day bookings", () => {
    const one = { id:"B", memberId:"m1", status:"confirmed", startTime:"13:00", endTime:"14:00" };
    const two = { id:"C", memberId:"m1", status:"confirmed", startTime:"15:00", endTime:"16:00" };
    expect(selectLegacyBookingForCheckin([one, two], { memberId:"m1" })).toBeNull();
    expect(selectLegacyBookingForCheckin([one, two], { memberId:"m1", checkinTime:"13:30" })?.id).toBe("B");
  });

  test("legacy fallback still accepts one unambiguous candidate", () => {
    const only = { id:"B", memberId:"m1", status:"confirmed", startTime:"13:00", endTime:"14:00" };
    expect(selectLegacyBookingForCheckin([only], { memberId:"m1" })?.id).toBe("B");
  });
});
