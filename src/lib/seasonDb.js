// src/lib/seasonDb.js — 季賽系統（日曆季，快照差值法）
// 設計：每季首次有人開排行榜時，對所有成員的「可累積指標」拍一張快照存進
//       seasons/{seasonId}；本季榜 = 現值 − 快照值（clamp >= 0）。
// 這樣不需要為每筆紀錄埋時間戳，任何現有累計欄位都能算出「這季新增多少」。
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const SEASONS = "seasons";

// ── 季別 ────────────────────────────────────────────────
// seasonId = "2026-Q3"（1~3月=Q1、4~6=Q2、7~9=Q3、10~12=Q4）
export function seasonIdOf(date = new Date()) {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

export function seasonLabelOf(id = seasonIdOf()) {
  const [y, q] = id.split("-Q");
  return `${y} 年 第 ${q} 季`;
}

// 本季起訖（給倒數用）
export function seasonRange(date = new Date()) {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3); // 0~3
  const start = new Date(y, q * 3, 1, 0, 0, 0, 0);
  const end = new Date(y, q * 3 + 3, 1, 0, 0, 0, 0); // 下一季第一天
  return { start, end };
}

// 距季末剩餘天數（無條件進位，至少 0）
export function seasonDaysLeft(date = new Date()) {
  const { end } = seasonRange(date);
  return Math.max(0, Math.ceil((end - date) / 86400000));
}

// ── 快照 ────────────────────────────────────────────────
// metricsByMember: { [memberId]: { [boardId]: number } }（僅可累積榜）
// 若本季快照不存在 → 用當下數值建立（首位開榜者觸發）；已存在則直接回傳。
export async function ensureSeasonSnapshot(metricsByMember, seasonId = seasonIdOf()) {
  const ref = doc(db, SEASONS, seasonId);
  try {
    const snapshot = await runTransaction(db, async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists() && cur.data()?.snapshot) return cur.data().snapshot;
      tx.set(ref, {
        id: seasonId,
        snapshot: metricsByMember,
        startedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      return metricsByMember;
    });
    return snapshot || {};
  } catch (e) {
    // 交易失敗（規則/網路）→ 退回讀一次；再不行就回空（本季榜≈總榜，不擋畫面）
    try {
      const cur = await getDoc(ref);
      return cur.exists() ? (cur.data()?.snapshot || {}) : {};
    } catch { return {}; }
  }
}
