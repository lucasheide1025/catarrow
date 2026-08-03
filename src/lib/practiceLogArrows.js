// src/lib/practiceLogArrows.js
// ─────────────────────────────────────────────────────────────
// 🏹 一筆 practiceLogs 文件 → 這筆到底射了幾箭。
//
// ⚠️ **為什麼要獨立一支**：db.js 裡本來有兩個地方各自用不同欄位加總，
//    算出來的今日箭數永遠對不上（2026-08-03 作者回報「數據不同步」）：
//
//      initializeTodayArrows      讀 data.arrowCount ── 錯
//      checkAndGrantArrowMilestones 讀 data.totalArrows ── 對
//
// ⚠️ **`arrowCount` 是陷阱**：在 practiceLogs 裡它是**「每組幾箭」**
//    （MemberPractice 的 form.arrowCount＝一組 3 箭或 6 箭），
//    不是這場的總箭數。拿它當總數的話，3 箭 × 20 組 = 60 箭的練習
//    只會被算成 **3 箭**。這個欄位名長得太像總數，是這個 bug 的根源。
//
// 正確的優先序：
//   1. totalArrows —— 所有寫入端都給的「這場總箭數」（語意明確）
//   2. roundsString —— addPracticeLog 會把 rounds 陣列轉成字串存
//   3. scores      —— 議會廳走的是平鋪的分數陣列，沒有 rounds
// ─────────────────────────────────────────────────────────────

/**
 * 只看**實際的箭矢資料**算出幾箭，完全不看 totalArrows。
 *
 * ⚠️ 補正工具要靠這支才驗得出「totalArrows 本身寫錯」——
 *    practiceLogArrowCount 會優先相信 totalArrows，拿它去比對永遠相等。
 */
export function structuralArrowCount(data) {
  if (!data) return 0;
  // addPracticeLog 會把 rounds 陣列序列化成 roundsString
  const rounds = data.roundsString ?? data.rounds;
  if (typeof rounds === "string") {
    try {
      const parsed = JSON.parse(rounds);
      if (Array.isArray(parsed)) return parsed.flat().length;
    } catch { /* 壞掉的字串就往下走 */ }
  }
  if (Array.isArray(rounds)) return rounds.flat().length;

  // 議會廳：平鋪的分數陣列，沒有分組
  if (Array.isArray(data.scores)) return data.scores.length;

  // ⚠️ 這裡**刻意不 fallback 到 data.arrowCount**——見檔頭。
  return 0;
}

/** 一筆 practiceLogs 文件射了幾箭。取不到就回 0，永遠不回 NaN。 */
export function practiceLogArrowCount(data) {
  if (!data) return 0;
  const total = Number(data.totalArrows);
  if (Number.isFinite(total) && total > 0) return total;
  return structuralArrowCount(data);
}

/** 一批文件的總箭數 */
export function sumPracticeLogArrows(list = []) {
  return (list || []).reduce((sum, data) => sum + practiceLogArrowCount(data), 0);
}
