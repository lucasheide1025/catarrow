const DAILY_ARROW_EVENT = "catarrow:today-arrows";

export function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function dailyArrowStorageKey(memberId, date = new Date()) {
  return `catarrow.today-arrows.${memberId}.${taipeiDateKey(date)}`;
}

export function getLocalTodayArrows(memberId) {
  if (!memberId || typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(dailyArrowStorageKey(memberId))) || 0;
}

export function setLocalTodayArrows(memberId, value) {
  if (!memberId || typeof localStorage === "undefined") return 0;
  const next = Math.max(0, Number(value) || 0);
  localStorage.setItem(dailyArrowStorageKey(memberId), String(next));
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(DAILY_ARROW_EVENT, { detail: { memberId, value: next } }));
  }
  return next;
}

export function incrementLocalTodayArrows(memberId, count) {
  const normalizedCount = Number(count);
  if (!memberId || !Number.isFinite(normalizedCount) || normalizedCount <= 0) return null;
  return setLocalTodayArrows(memberId, getLocalTodayArrows(memberId) + normalizedCount);
}

export function subscribeLocalTodayArrows(memberId, callback) {
  if (!memberId || typeof window === "undefined") return () => {};
  const key = dailyArrowStorageKey(memberId);
  const emit = () => callback(getLocalTodayArrows(memberId));
  const onLocal = event => { if (event.detail?.memberId === memberId) emit(); };
  const onStorage = event => { if (event.key === key) emit(); };
  emit();
  window.addEventListener(DAILY_ARROW_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DAILY_ARROW_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

// Intentionally not async: local mileage is committed before account/cloud work begins.
export function createRoundArrowRecorder({ identifyLocalOnly, enqueueOfficial, afterEnqueue }) {
  return function recordRoundArrows(memberId, count, options = {}) {
    const normalizedCount = Number(count);
    const localTotal = incrementLocalTodayArrows(memberId, normalizedCount);
    if (localTotal === null) return Promise.resolve();
    // 呼叫端已知帳號類型時直接判斷（同步、零網路）——避免 async 身分檢查在網路不穩時
    // 「保守失敗」把正式射手的箭靜默降級成純本機,造成挖掘/終身箭數永久卡住。
    const knownType = options.accountType;
    const resolveLocalOnly = knownType
      ? Promise.resolve(knownType === "guest" || knownType === "kid")
      : Promise.resolve().then(() => identifyLocalOnly(memberId));
    return resolveLocalOnly.then(localOnly => {
      if (localOnly) return undefined;
      const operation = enqueueOfficial(memberId, normalizedCount);
      return afterEnqueue(memberId, operation);
    });
  };
}
