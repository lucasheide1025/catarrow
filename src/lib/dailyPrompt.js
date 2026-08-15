export function dailyPromptKey(scope, memberId, date = new Date()) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${scope}:${memberId || "unknown"}:${day}`;
}

export function wasDailyPromptShown(storage, scope, memberId, date) {
  try { return storage?.getItem(dailyPromptKey(scope, memberId, date)) === "1"; }
  catch { return false; }
}

export function markDailyPromptShown(storage, scope, memberId, date) {
  try { storage?.setItem(dailyPromptKey(scope, memberId, date), "1"); } catch {}
}
