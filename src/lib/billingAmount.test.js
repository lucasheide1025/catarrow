import { MAX_BILLING_AMOUNT, parseBillingAmount } from "./billingAmount";

describe("billing amount input", () => {
  test("allows a custom integer amount", () => {
    expect(parseBillingAmount("425")).toEqual({ ok:true, amount:425 });
  });

  test("allows zero for monthly-card/free adjustments", () => {
    expect(parseBillingAmount("0")).toEqual({ ok:true, amount:0 });
  });

  test.each(["", "   ", "abc", "-1", "12.5"])("rejects invalid amount %p", value => {
    expect(parseBillingAmount(value).ok).toBe(false);
  });

  test("rejects an implausibly large amount", () => {
    expect(parseBillingAmount(MAX_BILLING_AMOUNT + 1).ok).toBe(false);
  });
});
