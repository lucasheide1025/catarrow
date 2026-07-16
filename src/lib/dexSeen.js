// src/lib/dexSeen.js — 成就「已提醒 / 已看過」狀態（前端 localStorage，per-uid）。
//
// 為什麼存在：舊版偵測沒有「首次基準標記」，第一次進圖鑑（或換裝置/清快取）會把當下
// 已解鎖的成就全部當成新的、一次噴一堆 toast（洪水式重複觸發）。比照 bookingSeen.js 的
// seedIfFirstRun 模型解掉——第一次載入先把「當下已解鎖的全部 key」標成基準，之後才解鎖的才算新。
//
// 兩組獨立集合（語意不同，不能共用）：
//   notified：已跳過提醒（toast/popup）的 key → 避免重複提醒
//   seen    ：已在圖鑑裡看過的 key → 驅動紅點/NEW 高亮，玩家真的去看才清掉
// key 規則同 achievementDex.getUnlockedKeys：單次成就=id；階段式=`${id}#${里程碑index}`。

function readSet(lsKey) {
  try { return new Set(JSON.parse(localStorage.getItem(lsKey) || "[]")); }
  catch { return new Set(); }
}
// 只保留最近 2000 筆，避免 localStorage 無限膨脹（成就 key 總量遠小於此）。
function writeSet(lsKey, set) {
  try { localStorage.setItem(lsKey, JSON.stringify([...set].slice(-2000))); } catch { /* quota/privacy 模式，忽略 */ }
}

// ── 通用：某一組（notified / seen）的四件式 ────────────────────
function makeStore(prefix) {
  const dataKey = uid => `${prefix}_${uid}`;
  const initKey = uid => `${prefix}Init_${uid}`;

  return {
    // 首次啟用：把當下已解鎖的全部 key 視為「已處理」，只跑一次。回傳是否為首次（首次不該提醒）。
    seedIfFirstRun(uid, keys = []) {
      if (!uid) return false;
      if (localStorage.getItem(initKey(uid))) return false;
      const set = readSet(dataKey(uid));
      keys.forEach(k => k && set.add(k));
      writeSet(dataKey(uid), set);
      try { localStorage.setItem(initKey(uid), "1"); } catch { /* ignore */ }
      return true;
    },
    // 從 keys 中挑出「還沒處理過」的
    pending(uid, keys = []) {
      if (!uid) return [];
      const set = readSet(dataKey(uid));
      return keys.filter(k => k && !set.has(k));
    },
    has(uid, key) {
      if (!uid || !key) return false;
      return readSet(dataKey(uid)).has(key);
    },
    mark(uid, keys = []) {
      if (!uid) return;
      const set = readSet(dataKey(uid));
      (Array.isArray(keys) ? keys : [keys]).forEach(k => k && set.add(k));
      writeSet(dataKey(uid), set);
    },
    count(uid, keys = []) {
      if (!uid) return 0;
      const set = readSet(dataKey(uid));
      return keys.reduce((n, k) => n + (k && !set.has(k) ? 1 : 0), 0);
    },
  };
}

const notified = makeStore("dexNotified");
const seen     = makeStore("dexSeen");

// ── 提醒（toast/popup）：避免重複 ────────────────────────────
export const seedNotifiedIfFirstRun = (uid, keys) => notified.seedIfFirstRun(uid, keys);
export const getUnnotifiedKeys       = (uid, keys) => notified.pending(uid, keys);
export const markNotified            = (uid, keys) => notified.mark(uid, keys);

// ── 已看過（紅點 / NEW 高亮）：玩家去圖鑑看才清 ────────────────
export const seedSeenIfFirstRun = (uid, keys) => seen.seedIfFirstRun(uid, keys);
export const getUnseenKeys       = (uid, keys) => seen.pending(uid, keys);
export const isKeyUnseen         = (uid, key)  => !!key && !seen.has(uid, key);
export const markSeen            = (uid, keys) => seen.mark(uid, keys);
export const countUnseen         = (uid, keys) => seen.count(uid, keys);
