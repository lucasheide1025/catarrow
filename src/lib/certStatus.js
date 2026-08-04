// src/lib/certStatus.js
// 年度檢定的「狀態與進度」純邏輯。刻意**零 firebase 相依**（才測得到，比照 bookingPricing.js）。
//
// 為什麼要有這個檔：年度檢定的資料早就在跑了（教練開檢定賽 → 會員報名 → 記分 → 審核 →
// 寫進 certRecords），但畫面上完全沒有「現在可以考」「我差幾分升級」這些話，
// 所以沒人想去考。這些判斷是純計算，抽出來後首頁、「我的」、後台可以共用同一份答案。
//
// ⚠️ 級別換算一律走 constants.js 的 getCertLevelByScores()，不要在這裡或元件裡自己比大小；
// 門檻表要傳「那一場檢定賽的 certScores」，不是寫死的預設值——教練可以逐場調門檻。
import { CERT_LEVELS, CERT_HALF, CERT_DEFAULT_SCORES, getCertLevelByScores } from "./constants";

export const CERT_COMP_TYPE = "年度檢定";

// 上/下半年的短標籤（選單、卡片用）。CERT_HALF 的 label 是完整版「上半年（1月～6月）」，
// 卡片塞不下，所以另外給短的。
export function halfShortLabel(half) {
  return half === "second" ? "下半年" : "上半年";
}

// 檢定賽標題。建立與「建立後改規則」共用同一條規則，否則改了距離會出現
// 「18米」的標題配 30 米的規則，畫面自己打自己。
export function certCompTitle({ year, half, distance }) {
  const halfLabel = CERT_HALF.find(h => h.value === half)?.label || "";
  return `${year}年${halfLabel} 年度檢定（${distance}米）`;
}

export function certPeriodKey(comp) {
  if (!comp) return null;
  return `${comp.year}_${comp.half || "first"}`;
}

// 期別排序用的數值：越新越大。下半年 > 上半年。
function periodRank(year, half) {
  return Number(year || 0) * 2 + (half === "second" ? 1 : 0);
}

// 目前「可以考」的那一場年度檢定。沒有就回 null（首頁卡片要整張不顯示，不留空卡）。
// 同時開了好幾場（例如教練提早開下半年）時取最新的期別。
export function activeCertComp(comps) {
  const open = (comps || []).filter(
    c => c?.type === CERT_COMP_TYPE && (c.status === "open" || c.status === "upcoming"),
  );
  if (open.length === 0) return null;
  return open.reduce((best, c) =>
    periodRank(c.year, c.half) > periodRank(best.year, best.half) ? c : best,
  );
}

// 這個弓種目前的分數，離下一個級別還差幾分。
//   level     — 目前達到的級別（沒達標回 null）
//   nextLevel — 下一個級別（已經最高級回 null）
//   gap       — 還差幾分（已經最高級回 0）
//   threshold — 下一級的門檻分數（已經最高級回 null）
// ⚠️ 級別名一律從 CERT_LEVELS[bowType] 取：傳統弓最高級叫「菁英」，其餘弓種叫「精英」，
// 寫死同一個字會讓傳統弓的射手看到不存在的級別。
export function certProgress({ certScores, bowType, score }) {
  const levels = CERT_LEVELS[bowType] || [];
  const table = certScores?.[bowType] || CERT_DEFAULT_SCORES[bowType] || {};
  const current = Number(score) || 0;
  const level = getCertLevelByScores(bowType, current, certScores);

  const nextLevel = levels.find(lv => {
    const need = table[lv];
    return typeof need === "number" && current < need;
  }) || null;

  if (!nextLevel) return { level, nextLevel: null, gap: 0, threshold: null };
  const threshold = table[nextLevel];
  return { level, nextLevel, gap: Math.max(0, threshold - current), threshold };
}

// 我這一期考到哪一步了。UI 要分得出「還沒報名」與「考完等審核」，
// 不然射手看到「未完成」會以為自己白考了。
export function myCertState({ registered, result }) {
  if (result?.reviewStatus === "approved") return "approved";
  if (result) return "submitted";
  if (registered) return "registered";
  return "none";
}

export const CERT_STATE_LABEL = {
  none:       "尚未報名",
  registered: "已報名・尚未上場",
  submitted:  "成績已送出・等待教練審核",
  approved:   "本期已完成",
};

// 歷年成績的期別選單（新到舊）。groups 是 MemberProfile.buildGroups() 的產物：
// { "2026_first": { year, half, scores } }。
export function certYearOptions(groups) {
  return Object.entries(groups || {})
    .map(([key, g]) => ({
      key,
      year: g.year,
      half: g.half || "first",
      label: `${g.year} ${halfShortLabel(g.half)}`,
    }))
    .sort((a, b) => periodRank(b.year, b.half) - periodRank(a.year, a.half));
}
