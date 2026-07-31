// src/worldboss/domain/matchScore.js
// ─────────────────────────────────────────────────────────────
// 🏆 比賽模式的計分。**這是真的比賽的計分系統**，不是遊戲數值。
//
// ⚠️ 所以分數一律是**靶紙上印的環數**（`arrow.score`），不是遊戲的
//    standardScore、更不是傷害。照印的算才對得上紙本記分表。
//    靶紙固定 `full_110`（1~10 環全靶），整場一致才有可比性。
//
// ⚠️ 傷害是**裝飾**：只是把分數放大讓王的血條動起來，不進排名。
//    排名永遠看 score。
//
// 名次規則照世界射箭總會慣例：總分 → X 數 → 10 數。
// ─────────────────────────────────────────────────────────────

export const MATCH_ARROWS_PER_END = 3;      // 三箭一回合（作者指定）

// ⚠️ 比賽靶紙**固定是 1~10 分的全靶**（作者 2026-08-01），不給玩家選。
//    半靶只印 6~10 環——混在同一個排行榜上分數根本不能比。
export const MATCH_FACE = "full_110";
export const MATCH_MAX_ARROW_SCORE = 10;
export const MATCH_MAX_END_SCORE = MATCH_ARROWS_PER_END * MATCH_MAX_ARROW_SCORE;   // 30
export const MATCH_DAMAGE_PER_POINT = 120;  // 純視覺：1 分 = 120 傷害

/** 一支箭的環值。M（脫靶）＝0，X＝10。 */
export function arrowPoints(arrow) {
  if (!arrow) return 0;
  if (arrow.label === "M") return 0;
  if (arrow.label === "X") return 10;
  const n = Number(arrow.score);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** 一個回合（3 箭）的結果。 */
export function endResult(arrows = []) {
  const list = Array.isArray(arrows) ? arrows : [];
  const points = list.map(arrowPoints);
  const score = points.reduce((a, b) => a + b, 0);
  return {
    score,
    arrows: list.length,
    xCount: list.filter(a => a?.label === "X").length,
    tens: points.filter(p => p === 10).length,
    misses: list.filter(a => a?.label === "M").length,
    labels: list.map(a => a?.label ?? String(arrowPoints(a))),
    damage: score * MATCH_DAMAGE_PER_POINT,
  };
}

/** 這一回合能不能送出（三箭射滿才算一回合） */
export function canSubmitEnd(arrows = []) {
  return Array.isArray(arrows) && arrows.length >= MATCH_ARROWS_PER_END;
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * 排行榜。
 * ⚠️ 平手要判得出來：總分 → X 數 → 10 數 → 先到的排前面。
 *    比賽當天有人同分卻名次亂跳，是最容易被抗議的地方。
 */
export function matchLeaderboard(players = {}) {
  return Object.entries(players || {})
    .filter(([, p]) => p)
    .map(([memberId, p]) => ({
      memberId,
      name: p.name || memberId,
      score: num(p.score),
      arrows: num(p.arrows),
      ends: num(p.ends),
      xCount: num(p.xCount),
      tens: num(p.tens),
      damage: num(p.damage),
      active: p.active !== false,
      joinedAt: num(p.joinedAt),
      average: num(p.arrows) ? num(p.score) / num(p.arrows) : 0,
    }))
    .sort((a, b) =>
      b.score - a.score
      || b.xCount - a.xCount
      || b.tens - a.tens
      || a.joinedAt - b.joinedAt
      || String(a.name).localeCompare(String(b.name)))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/** 我在榜上的位置（不在榜上回 null） */
export function myStanding(board = [], memberId = null) {
  if (!memberId) return null;
  return board.find(p => p.memberId === memberId) || null;
}

/** 全場合計——王的血條用這個 */
export function matchTotals(players = {}) {
  const board = matchLeaderboard(players);
  return {
    players: board.length,
    shooting: board.filter(p => p.active).length,
    score: board.reduce((s, p) => s + p.score, 0),
    arrows: board.reduce((s, p) => s + p.arrows, 0),
    damage: board.reduce((s, p) => s + p.damage, 0),
  };
}

/**
 * 王的血條比例。
 * ⚠️ 打完不會結束——比賽是射到玩家自己離場為止（作者指定：沒有回合結束）。
 *    所以血歸零之後就固定顯示 0，**不會**擋住任何人繼續射。
 */
export function matchBossRatio(totalDamage, bossMaxHp) {
  const max = Math.max(1, num(bossMaxHp));
  return Math.max(0, Math.min(1, 1 - num(totalDamage) / max));
}

/**
 * 這一回合可不可以寫進去。
 * ⚠️ 重送必須**不會重複計分**：射箭場的網路很差，玩家一定會按第二次。
 *    用回合序號當冪等鍵——已經記到第 N 回合，再送第 N 回合就當作成功但不加分。
 */
export function endAcceptance(playerEnds, endIndex) {
  const recorded = num(playerEnds);
  const idx = num(endIndex);
  if (idx === recorded) return { accept: true, duplicate: false };
  if (idx < recorded) return { accept: false, duplicate: true };   // 重送舊的
  return { accept: false, duplicate: false, reason: "回合序號對不上" };
}
