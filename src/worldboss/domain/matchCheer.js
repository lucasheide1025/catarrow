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

// ─────────────────────────────────────────────────────────────
// 🎯 **每一支箭**的即時回饋（作者 2026-08-01）。
//
// ⚠️ 現在是一箭一箭送，所以每支箭都要有反應——高分給爽的攻擊特效，
//    低分給加油。**低分那一級絕對不能是負面的**：那支箭已經射出去了，
//    講它不好沒有任何用處，只會讓下一支更緊。
// ─────────────────────────────────────────────────────────────

export const ARROW_TIERS = Object.freeze([
  {
    id: "inner_ten", min: 11, icon: "💥", color: "#f5b942", fx: "nova",
    shake: "hard", lines: ["正中紅心！", "X！完美的一箭", "牠的核心被貫穿了"],
  },
  {
    id: "ten", min: 10, icon: "⚡", color: "#fbbf24", fx: "burst",
    shake: "hard", lines: ["十環！", "滿環命中", "這一箭很痛"],
  },
  {
    id: "great", min: 9, icon: "🔥", color: "#fb923c", fx: "burst",
    shake: "soft", lines: ["九環，穩！", "非常接近了", "手感抓到了"],
  },
  {
    id: "good", min: 7, icon: "✨", color: "#4ade80", fx: "spark",
    shake: "soft", lines: ["扎實命中", "有效傷害", "不錯，繼續"],
  },
  {
    id: "ok", min: 4, icon: "🏹", color: "#60a5fa", fx: "spark",
    shake: null, lines: ["上靶了，穩住", "調整一下，下一箭更好", "沒問題，慢慢來"],
  },
  {
    id: "low", min: 1, icon: "💪", color: "#94a3b8", fx: null,
    shake: null, lines: ["有中就有分，加油", "深呼吸，下一箭", "不要急，動作先做完"],
  },
  {
    id: "miss", min: 0, icon: "🌱", color: "#64748b", fx: null,
    shake: null, lines: ["沒關係，放掉它", "下一箭重新來", "教練說過：忘掉上一箭"],
  },
]);

/**
 * @param points 這支箭的環值（0~10）
 * @param label  "X" 要跟一般的 10 分開——內十環值得更大的特效
 */
export function arrowFeedback(points, label = null, { prevLine = null, rand = Math.random } = {}) {
  const p = Number(points) || 0;
  const effective = label === "X" ? 11 : p;
  const tier = ARROW_TIERS.find(t => effective >= t.min) || ARROW_TIERS[ARROW_TIERS.length - 1];
  const pool = tier.lines.filter(l => l !== prevLine);
  const lines = pool.length ? pool : tier.lines;
  return {
    tier: tier.id, icon: tier.icon, color: tier.color,
    fx: tier.fx, shake: tier.shake,
    line: lines[Math.floor(rand() * lines.length) % lines.length],
    big: effective >= 9,          // 高分才放大特效
  };
}
