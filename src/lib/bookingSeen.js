// src/lib/bookingSeen.js — 教練後台「新預約 / 已看過」共用判斷（前端 localStorage，唯讀不動 Firestore）。
//
// 為什麼獨立成一支：置頂提示橫幅（AdminBookingAlert）與最新預約清單（AdminBooking）都要判斷
// 「這筆預約教練看過了沒」。若各自用各自的 localStorage key／各自的邏輯，會出現「橫幅說 2 筆新、
// 清單卻亮 3 筆」的不一致。統一成「已看過的預約 id 集合」這一個真相來源。
//
// 首次啟用（seedIfFirstRun）會把當下已存在的預約全部標記成已看，否則第一次打開後台會把所有
// 歷史預約都當成「新的」全部亮起來。之後才建立的預約 id 不在集合內＝未看＝要亮不同色。

const LS_SEEN = "adminBooking_seenIds";   // JSON 陣列，已看過的預約 id
const LS_INIT = "adminBooking_seenInit";  // "1" 表示已做過首次基準標記

function readSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || "[]")); }
  catch { return new Set(); }
}

// 只保留最近 300 筆，避免 localStorage 無限膨脹（清單/提示都只看最新十幾筆，300 綽綽有餘）。
function writeSet(set) {
  localStorage.setItem(LS_SEEN, JSON.stringify([...set].slice(-300)));
}

// 首次啟用：把當下這批既有預約 id 全部視為已看，之後才進來的才算新。只跑一次。
export function seedIfFirstRun(ids = []) {
  if (localStorage.getItem(LS_INIT)) return;
  const set = readSet();
  ids.forEach(id => id && set.add(id));
  writeSet(set);
  localStorage.setItem(LS_INIT, "1");
}

export function getSeenSet() { return readSet(); }

export function isUnseen(id, seenSet = null) {
  const set = seenSet || readSet();
  return !!id && !set.has(id);
}

export function markSeen(id) {
  if (!id) return;
  const set = readSet();
  set.add(id);
  writeSet(set);
}

export function markAllSeen(ids = []) {
  const set = readSet();
  ids.forEach(id => id && set.add(id));
  writeSet(set);
}

// ─── 取消通知專用的「已看」集合 ─────────────────────────────────
// 跟新預約分開一組，避免同一筆預約先亮「新」、被取消後又要重新亮「取消」時 id 已在集合內而不亮。
const LS_CANCEL = "adminBooking_cancelSeenIds";
const LS_CANCEL_INIT = "adminBooking_cancelSeenInit";

function readCancelSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_CANCEL) || "[]")); }
  catch { return new Set(); }
}
function writeCancelSet(set) {
  localStorage.setItem(LS_CANCEL, JSON.stringify([...set].slice(-300)));
}

export function seedCancelIfFirstRun(ids = []) {
  if (localStorage.getItem(LS_CANCEL_INIT)) return;
  const set = readCancelSet();
  ids.forEach(id => id && set.add(id));
  writeCancelSet(set);
  localStorage.setItem(LS_CANCEL_INIT, "1");
}

export function getCancelSeenSet() { return readCancelSet(); }

export function isCancelUnseen(id, seenSet = null) {
  const set = seenSet || readCancelSet();
  return !!id && !set.has(id);
}

export function markAllCancelSeen(ids = []) {
  const set = readCancelSet();
  ids.forEach(id => id && set.add(id));
  writeCancelSet(set);
}
