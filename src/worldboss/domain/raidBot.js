// src/worldboss/domain/raidBot.js
// 模擬隊友出手（沙盒用）。
//
// 為什麼要有這支：組隊邏輯在單機沒辦法驗——一個人開不了四個裝置。
// 這裡用「箭群散佈」模擬隊友的準度，產生跟真人一樣形狀的箭，
// 直接餵進 resolveRaidRound，就能看出組隊的結算對不對。
//
// ⚠️ 這是**沙盒/測試用**的，正式組隊的箭一律來自真人（raidTeamDb.submitRaidArrows）。
// 純函數，決定性亂數可注入，所以測試也能用。

import { faceCountOf } from "./raidFaces";

// 隊友的準度檔次：sigma 越小箭群越密
export const BOT_SKILLS = Object.freeze([
  { id: "rookie", label: "新手", sigma: 0.42, desc: "常常脫靶" },
  { id: "mid", label: "中階", sigma: 0.26, desc: "打得到大圈" },
  { id: "veteran", label: "老手", sigma: 0.15, desc: "小圈也咬得住" },
]);

export const BOT_SKILL_MAP = Object.freeze(
  Object.fromEntries(BOT_SKILLS.map(s => [s.id, s])),
);

// Box-Muller：兩個分量都用，不然會有相關性
function gaussPair(rand, sigma) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const m = Math.sqrt(-2 * Math.log(u)) * sigma;
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
}

/**
 * 一位隊友的一回合。
 * 會把箭分散到場上的圈（好玩家的打法），三連靶則平均分到三張靶
 * ——這樣才驗得到「每張最多吃 2 箭」跟「圈分在不同張」的邏輯。
 */
export function botRoundArrows({
  memberId,
  spots = [],
  skill = "mid",
  arrows = 6,
  targetFmt = "half_17",
  rand = Math.random,
} = {}) {
  const sigma = (BOT_SKILL_MAP[skill] || BOT_SKILL_MAP.mid).sigma;
  const faces = faceCountOf(targetFmt);
  const out = [];

  for (let i = 0; i < arrows; i += 1) {
    // 輪流瞄場上的圈；沒有圈就瞄靶心
    const target = spots.length ? spots[i % spots.length] : null;
    const faceIndex = target ? (target.faceIndex || 0) : i % faces;
    const [dx, dy] = gaussPair(rand, sigma);
    const nx = (target?.cx || 0) + dx;
    const ny = (target?.cy || 0) + dy;
    const ratio = Math.sqrt(nx * nx + ny * ny);
    out.push({
      memberId,
      nx, ny, faceIndex,
      score: ratio > 1 ? 0 : Math.max(1, Math.ceil((1 - ratio) * 10)),
      label: ratio > 1 ? "M" : null,
      bot: true,
    });
  }
  return out;
}

/** 一次產生全部隊友的箭（跳過「我」）。 */
export function botTeamArrows({
  members = [], meId = null, spots = [], skill = "mid",
  arrows = 6, targetFmt = "half_17", rand = Math.random,
} = {}) {
  return members
    .filter(m => m?.memberId && m.memberId !== meId)
    .flatMap(m => botRoundArrows({ memberId: m.memberId, spots, skill, arrows, targetFmt, rand }));
}
