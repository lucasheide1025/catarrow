export const MAX_BILLING_AMOUNT = 10000000;

export function parseBillingAmount(value) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!text) return { ok:false, reason:"請輸入實收金額" };
  const amount = Number(text);
  if (!Number.isFinite(amount)) return { ok:false, reason:"實收金額必須是數字" };
  if (!Number.isInteger(amount)) return { ok:false, reason:"實收金額請輸入整數（元）" };
  if (amount < 0) return { ok:false, reason:"實收金額不能小於 0" };
  if (amount > MAX_BILLING_AMOUNT) return { ok:false, reason:"實收金額過大，請重新確認" };
  return { ok:true, amount };
}
