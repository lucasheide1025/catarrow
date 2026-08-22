const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "AdminBooking.jsx"), "utf8");

describe("AdminBooking checkout contract", () => {
  test("regular checkout never auto-upgrades itself to force checkout", () => {
    expect(source).toContain("checkinAllowsRegularCheckout");
    expect(source).not.toContain("已自動啟用「⚡ 強制結帳」模式");
    expect(source).toContain("如需提前結帳，請使用「⚡ 強制結帳」");
  });

  test("explicit force checkout remains available", () => {
    expect(source).toContain("openCheckout(b, true)");
    expect(source).toContain("if (force || booking.source === \"walk_in\"");
  });

  test("calendar billing repair uses booking-specific matcher", () => {
    expect(source).toContain("billingRecordMatchesBooking(booking, record)");
    expect(source).not.toContain("record.bookingId === booking.id || (checkinId && record.checkinId === checkinId)");
  });
});
