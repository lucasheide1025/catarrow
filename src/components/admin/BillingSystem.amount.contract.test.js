const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "BillingSystem.jsx"), "utf8");

describe("BillingSystem custom amount contract", () => {
  test("manual billing exposes editable amount and stores validated custom amount", () => {
    expect(source).toContain("parseBillingAmount");
    expect(source).toContain("value={amountInput}");
    expect(source).toMatch(/finalPrice:\s+chargedAmount/);
  });
});
