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

/**
 * 一支箭的環值。M（脫靶）＝0，X＝10。
 * ⚠️ `score` 沒有時要看得懂 `label`：戰鬥 log 只存 label（"9" / "X" / "M"），
 *    不解析的話整場比賽會全部記成 0 分。
 */
export function arrowPoints(arrow) {
  if (!arrow) return 0;
  if (arrow.label === "M") return 0;
  if (arrow.label === "X") return 10;
  const n = Number(arrow.score);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const fromLabel = Number(arrow.label);
  return Number.isFinite(fromLabel) && fromLabel > 0 ? Math.round(fromLabel) : 0;
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

/**
 * 一支箭要存下來的樣子。
 * ⚠️ **落點座標一定要留**（作者 2026-08-01）：比賽後的檢討要看分佈，
 *    只存環數看不出「偏左下」這種系統性偏差——那才是教練要的東西。
 *    nx/ny 是 -1~1 的靶面座標，圓心是 (0,0)。
 * ⚠️ 刻意只留這幾個欄位：這份會累積到幾千筆，多一個欄位就是多幾十 KB。
 */
export function arrowRecord(arrow, { at = Date.now(), end = 0 } = {}) {
  const nx = Number(arrow?.nx);
  const ny = Number(arrow?.ny);
  return {
    p: arrowPoints(arrow),
    l: arrow?.label ?? String(arrowPoints(arrow)),
    x: Number.isFinite(nx) ? Math.round(nx * 1000) / 1000 : 0,
    y: Number.isFinite(ny) ? Math.round(ny * 1000) / 1000 : 0,
    e: Math.max(0, Math.round(end)),
    t: at,
  };
}

/** 落點統計：教練要看的是**系統性偏差**，不是單箭好壞 */
export function shotStats(shots = []) {
  const list = (Array.isArray(shots) ? shots : []).filter(Boolean);
  const onTarget = list.filter(s => s.l !== "M");
  const n = onTarget.length;
  const mx = n ? onTarget.reduce((a, s) => a + (Number(s.x) || 0), 0) / n : 0;
  const my = n ? onTarget.reduce((a, s) => a + (Number(s.y) || 0), 0) / n : 0;
  // 離散度＝離自己的平均落點多遠（不是離靶心）——那才是穩定度
  const spread = n
    ? Math.sqrt(onTarget.reduce((a, s) => a + ((s.x - mx) ** 2 + (s.y - my) ** 2), 0) / n)
    : 0;
  const total = list.reduce((a, s) => a + (Number(s.p) || 0), 0);
  return {
    shots: list.length,
    onTarget: n,
    misses: list.length - n,
    total,
    average: list.length ? total / list.length : 0,
    xCount: list.filter(s => s.l === "X").length,
    tens: list.filter(s => Number(s.p) === 10).length,
    centerX: Math.round(mx * 1000) / 1000,
    centerY: Math.round(my * 1000) / 1000,
    spread: Math.round(spread * 1000) / 1000,
    bias: biasLabel(mx, my),
  };
}

/** 把平均落點翻成一句話——教練當場看得懂才有用 */
export function biasLabel(mx, my) {
  const x = Number(mx) || 0;
  const y = Number(my) || 0;
  if (Math.hypot(x, y) < 0.08) return "落點居中";
  const v = y < -0.08 ? "偏上" : y > 0.08 ? "偏下" : "";
  const h = x < -0.08 ? "偏左" : x > 0.08 ? "偏右" : "";
  return `${v}${h}` || "落點居中";
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
