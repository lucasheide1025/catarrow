// src/lib/firestoreSafeWrite.js — Firestore 寫入前的資料清理（純函式，不依賴 firebase）
//
// Firestore 不接受 undefined：payload 內只要有任何一個 undefined，整筆寫入就會被拒絕
// （FirebaseError: Unsupported field value: undefined），畫面上通常表現為
// 「送出沒反應」或「跳紅字」，而且錯誤訊息才會指出是哪個欄位。
//
// 這類 bug 在組隊戰鬥重複出現多次（怪物快照、技能預告等巢狀物件只要漏一個預設值就中招），
// 因此改為在寫入前統一過濾，而不是逐個欄位補 `|| null`。

// ⚠️ 只遞迴「純物件」與陣列：Firestore 的 sentinel（serverTimestamp / arrayUnion / increment）
// 與 Timestamp、DocumentReference 等都是特殊實例，展開它們會讓寫入失效，必須原樣保留。
export function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value === null || typeof value !== "object") return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    out[key] = stripUndefinedDeep(item);
  }
  return out;
}
