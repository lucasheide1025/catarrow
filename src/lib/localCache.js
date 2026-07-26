// src/lib/localCache.js
// 「本地資料優先」的共用小工具（2026-07-26 讀寫量稽核）。
//
// 用途：把**變動不頻繁、但每次開頁面都要讀**的資料存在瀏覽器，減少 Firestore 讀取。
//
// ⚠️ 什麼可以放這裡、什麼不行：
//   ✅ 可以——檢定紀錄、比賽成績、專精設定：多半是教練偶爾才改一次，晚幾分鐘看到沒差。
//   ❌ 不行——房間狀態、CAT幣/材料餘額、報到狀態：會被別人或自己在別台裝置改，
//      快取住會讓玩家依過期資料做決定（例如以為錢還在）。這些一律走即時訂閱。
//
// ⚠️ 也不要拿這個去快取「大量文件」（例如整份練習紀錄）——localStorage 只有 5MB，
//    那種請用 Firestore 自己的 IndexedDB 快取（getDocsFromCache），見 db.getPracticeLogsPage。

const PREFIX = "catarrow.cache.";

export function readLocal(key, ttlMs) {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFIX + key) || "null");
    if (!raw || typeof raw.at !== "number") return null;
    if (ttlMs > 0 && Date.now() - raw.at > ttlMs) return null;
    return raw;                       // { at, value }
  } catch { return null; }
}

export function writeLocal(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value })); }
  catch { /* 空間滿/隱私模式 → 就當沒有快取，功能照常 */ }
}

export function dropLocal(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

// 讀取：命中就直接回傳（0 次網路），否則抓取並寫入快取。
// fresh=true 強制重抓（給「更新」按鈕用）。
export async function cachedFetch(key, ttlMs, fetcher, { fresh = false } = {}) {
  if (!fresh) {
    const hit = readLocal(key, ttlMs);
    if (hit) return { value: hit.value, at: hit.at, fromCache: true };
  }
  const value = await fetcher();
  writeLocal(key, value);
  return { value, at: Date.now(), fromCache: false };
}
