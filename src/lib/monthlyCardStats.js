// Pure helpers for permanent monthly-card purchase / renewal counters.
// Gifts and session usage do not count as purchases.

export function existingMonthlyCardPurchaseCount(card) {
  if (!card || typeof card !== "object") return 0;
  const purchaseCount = Math.max(0, Number(card.purchaseCount) || 0);
  const fromRenewCount = Math.max(0, Number(card.renewCount) || 0) + (Number(card.renewCount) >= 0 && (card.startedAt || card.expiresAt || card.active || card.sessions != null) ? 1 : 0);
  const legacyBaseline = (card.startedAt || card.expiresAt || card.active || Number(card.sessions) > 0) ? 1 : 0;
  return Math.max(purchaseCount, fromRenewCount, legacyBaseline);
}

export function nextMonthlyCardPurchaseCounters(card) {
  const previous = existingMonthlyCardPurchaseCount(card);
  const purchaseCount = previous + 1;
  return { purchaseCount, renewCount: Math.max(0, purchaseCount - 1), isRenew: previous > 0 };
}

export function purchaseCountFromMonthlyCardLogs(logs) {
  return (logs || []).reduce((count, log) => count + (["purchase", "renew"].includes(log?.action) ? 1 : 0), 0);
}
