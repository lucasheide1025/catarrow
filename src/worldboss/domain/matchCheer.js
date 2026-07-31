// src/worldboss/domain/matchCheer.js
// ─────────────────────────────────────────────────────────────
// 每一輪演出跑完之後跳的**激勵詞**（作者 2026-08-01）。
//
// ⚠️ 要在**動畫之後**才出現。射完就跳，等於在告訴玩家「戲演完了」，
//    那句話反而變成打斷。
//
// ⚠️ 分級要看得出差別，但**不能罵人**。這是實體比賽現場，
//    旁邊站著教練和家長——失手的那一輪要給台階，不是給評語。
//    所以「脫靶」那一級講的是下一箭，不是這一箭。
// ─────────────────────────────────────────────────────────────

import { MATCH_MAX_END_SCORE } from "./matchScore";

/** 由上而下比對，第一個成立的就是它——特別的排前面 */
export const CHEER_TIERS = Object.freeze([
  {
    id: "perfect", icon: "👑", color: "#f5b942",
    match: r => r.score >= MATCH_MAX_END_SCORE,
    lines: [
      "滿分！這一輪沒有話說",
      "三箭全中紅心——牠連退都沒得退",
      "完美的一輪，整個場地都聽到了",
    ],
  },
  {
    id: "triple_x", icon: "🎯", color: "#f5b942",
    match: r => r.xCount >= 2,
    lines: [
      "連兩個 X！手感來了",
      "中心點被你打穿了",
      "這種準度不是運氣",
    ],
  },
  {
    id: "great", icon: "🔥", color: "#fb923c",
    match: r => r.score >= 27,
    lines: [
      "穩得可怕，就這樣射下去",
      "這一輪很漂亮，節奏抓住了",
      "牠開始怕你了",
    ],
  },
  {
    id: "good", icon: "💪", color: "#4ade80",
    match: r => r.score >= 21,
    lines: [
      "扎實的一輪，繼續累積",
      "沒有浪費任何一箭",
      "很好，維持這個動作",
    ],
  },
  {
    id: "recover", icon: "🌱", color: "#60a5fa",
    match: r => r.misses > 0,
    lines: [
      "沒關係，深呼吸，下一箭重新來",
      "放掉這一輪——比賽還很長",
      "調整一下站位，你知道怎麼修",
    ],
  },
  {
    id: "steady", icon: "🏹", color: "#94a3b8",
    match: () => true,
    lines: [
      "穩住，一箭一箭來",
      "每一輪都算數，繼續",
      "節奏比分數重要，慢慢來",
    ],
  },
]);

/**
 * 挑一句。
 * @param prevLine 上一句——**避免連續重複**（同一句連跳兩次會顯得很敷衍）
 */
export function pickCheer(endRes, { prevLine = null, rand = Math.random } = {}) {
  const r = {
    score: 0, xCount: 0, tens: 0, misses: 0,
    ...(endRes || {}),
  };
  const tier = CHEER_TIERS.find(t => t.match(r)) || CHEER_TIERS[CHEER_TIERS.length - 1];
  const pool = tier.lines.filter(l => l !== prevLine);
  const lines = pool.length ? pool : tier.lines;
  return {
    tier: tier.id,
    icon: tier.icon,
    color: tier.color,
    line: lines[Math.floor(rand() * lines.length) % lines.length],
  };
}

/**
 * 里程碑：整場累積到某些數字時額外給一句。
 * ⚠️ 只在**剛好跨過**的那一輪給——每輪都跳就沒有意義了。
 */
export const CHEER_MILESTONES = Object.freeze([
  { arrows: 12, text: "🏹 已經射完 12 箭，狀態進來了" },
  { arrows: 24, text: "🔥 24 箭！這是一場真正的比賽了" },
  { arrows: 36, text: "💪 36 箭——體力管理開始重要了" },
  { arrows: 60, text: "👑 60 箭，你已經是今天的常客了" },
]);

export function milestoneFor(arrowsBefore, arrowsAfter) {
  const before = Number(arrowsBefore) || 0;
  const after = Number(arrowsAfter) || 0;
  const hit = CHEER_MILESTONES.find(m => before < m.arrows && after >= m.arrows);
  return hit ? hit.text : null;
}
