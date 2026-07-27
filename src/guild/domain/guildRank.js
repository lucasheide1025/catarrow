// src/guild/domain/guildRank.js
// ─────────────────────────────────────────────────────────────
// 公會階級（P2）：聲望 rep → 階級，階級只給「解鎖」不給戰力。
// ⚠️ 刻意設計：階級**不含任何數值加成**（舊公會的 RANKS.mult 金幣加乘已廢除）。
//    階級解鎖的是「能接多危險的委託」「商店層級」「稱號」——進度感來自能去更深的地方，
//    不是偷偷變強，這樣公會強度永遠不會外溢影響主線平衡。
// 聲望來源：完成遠征 = 危險度 × REP_PER_DANGER（見 guildRewards.js）。
// ─────────────────────────────────────────────────────────────

// rep 門檻遞增；maxDanger = 可接的危險度上限；shopTier = 商店可買層級
export const GUILD_RANKS = Object.freeze([
  // maxDanger 一階一階開：6 個階級剛好對應 6 個危險度（T1~T6），升階的意義最直接。
  { id: "apprentice", name: "見習冒險者", icon: "🔰", color: "#9ca3af", rep: 0,    maxDanger: 1, shopTier: 1 },
  { id: "bronze",     name: "銅牌冒險者", icon: "🥉", color: "#d97706", rep: 100,  maxDanger: 2, shopTier: 1 },
  { id: "silver",     name: "銀牌冒險者", icon: "🥈", color: "#cbd5e1", rep: 300,  maxDanger: 3, shopTier: 2 },
  { id: "gold",       name: "金牌冒險者", icon: "🥇", color: "#fbbf24", rep: 700,  maxDanger: 4, shopTier: 2 },
  { id: "platinum",   name: "白金冒險者", icon: "💠", color: "#67e8f9", rep: 1500, maxDanger: 5, shopTier: 3 },
  { id: "legend",     name: "傳說冒險者", icon: "👑", color: "#f0abfc", rep: 3000, maxDanger: 6, shopTier: 3 },
]);

export function rankIndexOf(rankId = "apprentice") {
  const i = GUILD_RANKS.findIndex(r => r.id === rankId);
  return i < 0 ? 0 : i;
}

const currentRank = input => {
  if (input && typeof input === "object") return GUILD_RANKS[rankIndexOf(input.rankId)];
  return repToRank(input);
};

// 目前階級（rep 由小到大找最後一個達標的）
export function repToRank(rep = 0) {
  const r = Number(rep) || 0;
  let cur = GUILD_RANKS[0];
  for (const rank of GUILD_RANKS) if (r >= rank.rep) cur = rank;
  return cur;
}

// 下一階資訊：已滿階 → next=null、progressPct=100
export function nextRankInfo(input = 0) {
  const r = Number(input && typeof input === "object" ? input.rep : input) || 0;
  const cur = currentRank(input);
  const idx = GUILD_RANKS.findIndex(x => x.id === cur.id);
  const next = GUILD_RANKS[idx + 1] || null;
  if (!next) return { current: cur, next: null, need: 0, progressPct: 100 };
  const span = next.rep - cur.rep;
  return {
    current: cur,
    next,
    need: Math.max(0, next.rep - r),
    trialAvailable: r >= next.rep,
    progressPct: Math.max(0, Math.min(100, Math.round(((r - cur.rep) / span) * 100))),
  };
}

// 這個階級解鎖了什麼
export function rankUnlocks(input = 0) {
  const cur = currentRank(input);
  return { rank: cur, maxDanger: cur.maxDanger, shopTier: cur.shopTier, title: cur.name };
}

// 能不能接這個危險度的委託
export function canAcceptDanger(input = 0, danger = 1) {
  return danger <= currentRank(input).maxDanger;
}

// 危險度被鎖住時，要多少聲望才解鎖（已解鎖 → null）
export function repNeededForDanger(input = 0, danger = 1) {
  const rep = Number(input && typeof input === "object" ? input.rep : input) || 0;
  if (canAcceptDanger(input, danger)) return null;
  const unlock = GUILD_RANKS.find(x => x.maxDanger >= danger);
  if (!unlock) return null;
  const missing = Math.max(0, unlock.rep - rep);
  return missing || "trial";
}
