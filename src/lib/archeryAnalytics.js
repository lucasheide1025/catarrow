// src/lib/archeryAnalytics.js
// ─────────────────────────────────────────────────────────────
// 🏹 射箭專業分析（2026-08-02 重做）。
//
// ⚠️ 舊版的「深度分析」是通用的數據圖表（平均、命中率、X 率），
//    那是**遊戲數據**不是**射箭教學數據**。教練看不出要修什麼。
//
// 這一支只放「能導向動作修正」的指標：
//   ・群組中心與離散度 → 偏移可以調瞄具，離散大是動作不穩，修法完全不同
//   ・左右／上下分開看 → 左右多半是瞄準與扭轉，上下多半是撒放與力量
//   ・回合內衰退       → 第 1 支 vs 最後 1 支，看體力與專注
//   ・距離分層         → 18m 跟 30m 混在一起平均沒有意義
//
// ⚠️ 全部是純函式，不碰 Firestore。資料由呼叫端從本機快取餵進來
//    （這頁的讀取紀律：只有一筆同步摘要走網路，其餘讀快取）。
// ─────────────────────────────────────────────────────────────

import { TARGET_FACE_FORMATS } from "./targetFace";

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * 靶紙代號 → 看得懂的名字。
 *
 * ⚠️ **一定要從 targetFace.js 取，不要自己抄一份。**
 *    第一版在這裡手寫了 { full_110, half_17, field_16, triple, face_80, face_40 }，
 *    其中 face_80 / face_40 根本不存在，而真正會用到的 compound_510（複合弓）、
 *    indoor_40 / half_610（室內）反而漏掉——複合弓與室內練習的分層會直接印出
 *    「compound_510」這種代號給玩家看。跟 byCondition 的欄位名是同一類錯：
 *    **憑印象抄常數表**。（2026-08-03 查練習模式設定時抓到）
 */
const FACE_LABEL = Object.freeze(Object.fromEntries(
  TARGET_FACE_FORMATS.map(f => [f.id, f.shortLabel || f.label || f.id]),
));
const round1 = v => Math.round(v * 10) / 10;
const round3 = v => Math.round(v * 1000) / 1000;

/** 有落點座標的箭才進得了群組分析 */
export function withPosition(arrows = []) {
  return (arrows || []).filter(a =>
    a && !a.isMiss && Number.isFinite(Number(a.position?.x)) && Number.isFinite(Number(a.position?.y)));
}

/**
 * 群組分析：中心、離散度、群組大小。
 *
 * ⚠️ 離散度算的是**離自己的平均落點**，不是離靶心。
 *    離靶心遠但很集中＝瞄準要調（好修）；四散＝動作不穩（難修）。
 *    這兩件事混在一起看，教練就沒辦法給建議。
 */
export function groupAnalysis(arrows = []) {
  const pts = withPosition(arrows);
  const n = pts.length;
  if (!n) {
    return { count: 0, centerX: 0, centerY: 0, spread: 0, groupSize: 0,
      offset: 0, horizontal: 0, vertical: 0, tight: false };
  }
  const mx = pts.reduce((s, a) => s + num(a.position.x), 0) / n;
  const my = pts.reduce((s, a) => s + num(a.position.y), 0) / n;
  const variance = pts.reduce((s, a) =>
    s + ((num(a.position.x) - mx) ** 2 + (num(a.position.y) - my) ** 2), 0) / n;
  const spread = Math.sqrt(variance);
  // 群組大小＝涵蓋約 95% 落點的直徑（2σ 的兩倍）
  const groupSize = spread * 4;
  return {
    count: n,
    centerX: round3(mx), centerY: round3(my),
    spread: round3(spread), groupSize: round3(groupSize),
    offset: round3(Math.hypot(mx, my)),   // 群組中心離靶心多遠
    horizontal: round3(mx), vertical: round3(my),
    tight: spread < 0.18,
  };
}

/** 偏移量 → 一句話。⚠️ 門檻刻意寬：小偏移是正常抖動，不該叫人去調瞄具。 */
const BIAS_THRESHOLD = 0.08;

export function biasBreakdown(group) {
  const g = group || groupAnalysis([]);
  const h = num(g.horizontal);
  const v = num(g.vertical);
  const rows = [];
  if (Math.abs(h) >= BIAS_THRESHOLD) {
    rows.push({
      axis: "horizontal",
      side: h > 0 ? "右" : "左",
      magnitude: round3(Math.abs(h)),
      // ⚠️ 左右與上下的成因不同，建議也要分開講
      hint: h > 0 ? "整體偏右：先檢查瞄準點與站位方向，再看放箭是否推弓"
        : "整體偏左：先檢查瞄準點與站位方向，再看是否過度扭轉",
    });
  }
  if (Math.abs(v) >= BIAS_THRESHOLD) {
    rows.push({
      axis: "vertical",
      side: v > 0 ? "下" : "上",
      magnitude: round3(Math.abs(v)),
      hint: v > 0 ? "整體偏下：多半是拉距不足或撒放前鬆手"
        : "整體偏上：多半是拉距過長或撒放時抬弓",
    });
  }
  return rows;
}

/** 群組品質 → 教練當場講得出的一句話 */
export function groupVerdict(group) {
  const g = group || groupAnalysis([]);
  if (!g.count) return { level: "none", text: "還沒有落點資料", tone: "#64748b" };
  const tightText = g.tight ? "集中" : g.spread < 0.3 ? "普通" : "偏散";
  const offsetText = g.offset < BIAS_THRESHOLD ? "落在中心" : "整組偏移";
  if (g.tight && g.offset < BIAS_THRESHOLD) {
    return { level: "great", tone: "#4ade80", text: "又準又穩——維持現在的節奏就好" };
  }
  if (g.tight) {
    // ⚠️ 這是最好修的狀況，一定要講出來鼓勵
    return { level: "adjust", tone: "#60a5fa",
      text: `動作很穩（${tightText}），只是${offsetText}——調瞄具就能整組移到中心` };
  }
  if (g.offset < BIAS_THRESHOLD) {
    return { level: "consistency", tone: "#fbbf24",
      text: `方向沒問題，但群組${tightText}——要練的是穩定度，不是瞄準` };
  }
  return { level: "basics", tone: "#f87171",
    text: `群組${tightText}且${offsetText}——先把動作固定下來，再談調瞄具` };
}

/**
 * 回合內衰退：每支箭在回合中的位置 → 平均分。
 * ⚠️ 這條看的是**體力與專注**，不是準度。後段掉分代表要練持弓或縮短組數。
 */
export function withinEndTrend(ends = []) {
  const buckets = new Map();
  for (const end of ends || []) {
    (end?.arrows || []).forEach((arrow, index) => {
      const rec = arrow?.captureMode === "targetPlot" ? arrow.recordedScore : arrow;
      const score = Number(rec?.score);
      if (!Number.isFinite(score)) return;
      const cur = buckets.get(index) || { index, total: 0, count: 0 };
      cur.total += score; cur.count += 1;
      buckets.set(index, cur);
    });
  }
  const rows = [...buckets.values()]
    .sort((a, b) => a.index - b.index)
    .map(b => ({ position: b.index + 1, average: round1(b.total / b.count), count: b.count }));
  if (rows.length < 2) return { rows, drop: 0, fatigue: false };
  const first = rows[0].average;
  const last = rows[rows.length - 1].average;
  return {
    rows,
    drop: round1(first - last),
    // 掉超過 0.8 環才算有意義的衰退（單場抖動大約 0.3~0.5）
    fatigue: first - last >= 0.8,
  };
}

/** 一致性：連續好球的長度、最差的一箭 */
export function consistency(arrows = []) {
  const list = (arrows || []).filter(a => a && Number.isFinite(Number(a.score)));
  if (!list.length) return { count: 0, bestStreak: 0, worst: null, missRate: 0, xRate: 0 };
  let streak = 0; let best = 0;
  let worst = list[0];
  for (const a of list) {
    if (a.isX || num(a.score) >= 9) { streak += 1; best = Math.max(best, streak); }
    else streak = 0;
    if (num(a.score) < num(worst.score)) worst = a;
  }
  return {
    count: list.length,
    bestStreak: best,
    worst: { score: num(worst.score), isMiss: !!worst.isMiss },
    missRate: round3(list.filter(a => a.isMiss).length / list.length),
    xRate: round3(list.filter(a => a.isX).length / list.length),
  };
}

/**
 * 距離／靶紙分層。
 * ⚠️ 18m 跟 30m 混在一起平均沒有意義——那是兩種不同的技術狀態。
 */
export function byCondition(sessions = []) {
  const map = new Map();
  for (const s of sessions || []) {
    // ⚠️ 欄位名要跟實際的場次文件一致：距離在 shootingConfig.distanceM，
    //    數據在 metricsSnapshot——猜錯就會整排顯示「?m｜未記錄 0環」。
    const cfg = s?.shootingConfig || {};
    const m = s?.metricsSnapshot || {};
    const distance = num(cfg.distanceM) || num(s?.distance);
    // ⚠️ 真正寫進去的欄位是 **targetFaceCode**（見 shootingPerformance.js
    //    的 buildPracticeShootingRecord / buildMonsterShootingRecord）。
    //    只讀 targetFmt/targetFormat 的話，靶紙那欄會**永遠**是「未記錄靶紙」——
    //    而且不會報錯，只是靜靜地少一個維度。（2026-08-03 抓到）
    const fmt = cfg.targetFaceCode || cfg.targetFmt || cfg.targetFormat || s?.targetFmt || "";
    const arrows = num(m.arrowCount) || num(s?.arrowCount);
    const total = num(m.totalScore) || num(m.averageArrow) * arrows;
    if (!arrows) continue;
    const key = `${distance ? `${distance}m` : "未記錄距離"}｜${FACE_LABEL[fmt] || fmt || "未記錄靶紙"}`;
    const cur = map.get(key) || { key, distance, targetFmt: fmt, sessions: 0, arrows: 0, total: 0 };
    cur.sessions += 1;
    cur.arrows += arrows;
    cur.total += total;
    map.set(key, cur);
  }
  return [...map.values()]
    .map(r => ({ ...r, average: r.arrows ? round1(r.total / r.arrows) : 0 }))
    .filter(r => r.arrows > 0)
    .sort((a, b) => b.arrows - a.arrows);
}

/** 這批資料夠不夠做分析——不夠時要講「還差多少」，不是只說「資料不足」 */
export const MIN_ARROWS_FOR_GROUP = 12;

export function readiness(arrows = []) {
  const total = (arrows || []).length;
  const plotted = withPosition(arrows).length;
  return {
    total, plotted,
    ready: plotted >= MIN_ARROWS_FOR_GROUP,
    need: Math.max(0, MIN_ARROWS_FOR_GROUP - plotted),
    // ⚠️ 有分數但沒落點是最常見的情況：要告訴玩家「用靶面記錄才有群組分析」
    scoreOnly: total > 0 && plotted === 0,
  };
}
