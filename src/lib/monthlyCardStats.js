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

function monthlyCardExpiryMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === "number") {
    return (value.seconds * 1000) + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getMonthlyCardStatus(card, nowMs = Date.now()) {
  const hasCard = !!card && typeof card === "object" && (
    card.active != null || card.sessions != null || card.expiresAt != null
  );
  if (!hasCard) {
    return { hasCard:false, state:"none", sessions:0, usableSessions:0, expiresMs:0, daysRemaining:0 };
  }

  const sessions = Math.max(0, Math.floor(Number(card.sessions) || 0));
  const expiresMs = monthlyCardExpiryMs(card.expiresAt);
  const now = Number(nowMs) || Date.now();
  const daysRemaining = expiresMs > now ? Math.max(1, Math.ceil((expiresMs - now) / 86400000)) : 0;
  let state = "usable";
  if (card.active !== true) state = "inactive";
  else if (!expiresMs || expiresMs <= now) state = "expired";
  else if (sessions <= 0) state = "empty";

  return {
    hasCard:true,
    state,
    sessions,
    usableSessions:state === "usable" ? sessions : 0,
    expiresMs,
    daysRemaining,
  };
}

// 月卡每 1 session = 1 小時。只有 active、未到期、sessions > 0 才算可扣抵。
// 同時支援 Firestore Timestamp / Date / 序列化後的 {seconds,nanoseconds}，
// 讓首頁顯示與 submitClassEnd 的 fresh Firestore 驗證使用同一套判斷。
export function getUsableMonthlyCardSessions(card, nowMs = Date.now()) {
  if (!card || typeof card !== "object" || card.active !== true) return 0;
  const expiresMs = monthlyCardExpiryMs(card.expiresAt);
  if (!expiresMs || expiresMs <= Number(nowMs)) return 0;
  return Math.max(0, Math.floor(Number(card.sessions) || 0));
}

