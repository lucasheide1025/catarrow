// src/components/member/cards/cardSeen.js
// 卡片「已看過」紅點狀態（per-member localStorage）。參照 dexSeen.js。
//
// 為什麼存在：舊玩家登入後不該突然冒出數十個紅點。首次使用把「當下已持有卡片」seed 成已讀,
// 之後才新增的 monsterId 才算未讀（紅點）。
//
// key = monsterId（怪物卡）或 `wb:${bossKey}`（世界王卡）。
// 獨立 storage key（含 memberId）避免不同帳號互相污染。
//
// ⚠️ seed/mark 會寫 localStorage → 只可在 effect / 事件處理器呼叫,不可在 render 期間呼叫。

function readSet(k) {
  try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); }
  catch { return new Set(); }
}
function writeSet(k, set) {
  try { localStorage.setItem(k, JSON.stringify([...set].slice(-3000))); }
  catch { /* quota / 隱私模式，忽略 */ }
}

const dataKey = memberId => `cardSeen_${memberId}`;
const initKey = memberId => `cardSeenInit_${memberId}`;

// 首次使用：把目前已持有卡片 seed 為已讀,只跑一次。回傳是否為首次。
export function seedSeenIfFirstRun(memberId, ownedKeys = []) {
  if (!memberId) return false;
  if (localStorage.getItem(initKey(memberId))) return false;
  const set = readSet(dataKey(memberId));
  ownedKeys.forEach(k => k && set.add(k));
  writeSet(dataKey(memberId), set);
  try { localStorage.setItem(initKey(memberId), "1"); } catch { /* ignore */ }
  return true;
}

export function isUnseen(memberId, key) {
  if (!memberId || !key) return false;
  return !readSet(dataKey(memberId)).has(key);
}

// 從 keys 中挑出未讀的（呼叫端通常只傳「已持有」的 key,避免把未取得卡當紅點）
export function getUnseenKeys(memberId, keys = []) {
  if (!memberId) return [];
  const set = readSet(dataKey(memberId));
  return keys.filter(k => k && !set.has(k));
}

export function countUnseen(memberId, keys = []) {
  return getUnseenKeys(memberId, keys).length;
}

// 開啟卡片詳情後清除該卡（或多張）紅點
export function markSeen(memberId, keys) {
  if (!memberId) return;
  const set = readSet(dataKey(memberId));
  (Array.isArray(keys) ? keys : [keys]).forEach(k => k && set.add(k));
  writeSet(dataKey(memberId), set);
}

// 測試/重置用
export function _resetSeen(memberId) {
  try { localStorage.removeItem(dataKey(memberId)); localStorage.removeItem(initKey(memberId)); } catch { /* ignore */ }
}
