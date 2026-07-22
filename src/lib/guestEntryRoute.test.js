import { resolveGuestEntry } from "./guestEntryRoute";

test("QR entry wins when guest and kid parameters are both present", () => {
  expect(resolveGuestEntry(new URLSearchParams("guest=1&kid=fixed-camp"))).toEqual({
    accountType:"kid", sessionSourceId:"fixed-camp",
  });
});

test("an empty kid parameter remains QR mode and fails inside QR validation", () => {
  expect(resolveGuestEntry(new URLSearchParams("guest=1&kid="))).toEqual({
    accountType:"kid", sessionSourceId:null,
  });
});

test("website guest remains available without kid parameter", () => {
  expect(resolveGuestEntry(new URLSearchParams("guest=1"))).toEqual({
    accountType:"guest", sessionSourceId:null,
  });
});

test("the fixed admin QR routes to an isolated temporary QR session", () => {
  expect(resolveGuestEntry(new URLSearchParams("kid=fixed-guest-qr"))).toEqual({
    accountType:"kid", sessionSourceId:"fixed-guest-qr",
  });
});
