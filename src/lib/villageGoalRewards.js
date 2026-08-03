// src/lib/villageGoalRewards.js
// ─────────────────────────────────────────────────────────────
// 🏡 村目標獎勵三層（2026-08-03）
//
// ⚠️ 跟世界王用**同一套理念與同一種數學**（見 worldBossRewards.js）：
//    「上場幫忙打得都能有不錯的獎勵，努力打得又有更好的獎勵」。
//    兩個系統規則一致，玩家只要學一次。
//
// 舊制的兩個問題：
//   ① **份量對不上時間**。村目標要全村推**一整個月**，卻只給 100~800 金幣；
//      世界王打**一場**的出席保底就有 350。比例是反的。
//   ② **只有保底、沒有努力層**。射 5,000 箭跟射 50 箭拿一模一樣，
//      真正在推的人會覺得虧。
//
// 三層：
//   出席保底 participation —— 有貢獻就拿整份，**不看多寡、不被人數稀釋**
//   努力分潤 effort        —— `pool = 每人份 × 人數`，權重 **√貢獻**
//   達成慶功 celebration   —— 完成才有的一次性箱子，全員一樣（「一起完成」的儀式感）
//
// ⚠️ 抽獎幣是這裡最有價值的一項——金幣與箭露到處都有產出，抽獎幣來源少。
//    它才是村目標的招牌，份量要撐得起「一個月」。
// ─────────────────────────────────────────────────────────────

/** 出席保底（有貢獻就拿整份）。index = 村莊階級 0~3 */
export const VILLAGE_GOAL_PARTICIPATION = Object.freeze([
  { arrowdew: 300, coins: 200, gachaToken: 3 },
  { arrowdew: 500, coins: 300, gachaToken: 5 },
  { arrowdew: 900, coins: 500, gachaToken: 8 },
  { arrowdew: 1600, coins: 900, gachaToken: 12 },
]);

/** 努力分潤：**每位參與者投入鍋子的量**，不是他會拿到的量 */
export const VILLAGE_GOAL_EFFORT_PER_PLAYER = Object.freeze([
  { arrowdew: 200, coins: 120, gachaToken: 2 },
  { arrowdew: 300, coins: 200, gachaToken: 3 },
  { arrowdew: 550, coins: 350, gachaToken: 5 },
  { arrowdew: 1000, coins: 600, gachaToken: 8 },
]);

/**
 * 安慰獎（時間到還沒完成）。
 * ⚠️ 舊版是固定 30 箭露 / 20 金幣 / 1 抽獎幣——推了**一個月**只拿這樣，
 *    下次就沒人想推了。拉到出席保底的三成左右。
 */
export const VILLAGE_GOAL_CONSOLATION = Object.freeze([
  { arrowdew: 100, coins: 60, gachaToken: 1 },
  { arrowdew: 150, coins: 80, gachaToken: 2 },
  { arrowdew: 250, coins: 130, gachaToken: 3 },
  { arrowdew: 450, coins: 230, gachaToken: 4 },
]);

/** 達成慶功：完成才有，全員一樣。⚠️ 貓貓箱只在高階給，不然會通膨。 */
export const VILLAGE_GOAL_CELEBRATION = Object.freeze([
  { mimiBoxes: 1, catBoxes: 0 },
  { mimiBoxes: 1, catBoxes: 0 },
  { mimiBoxes: 1, catBoxes: 1 },
  { mimiBoxes: 2, catBoxes: 1 },
]);

const CURRENCY_KEYS = Object.freeze(["arrowdew", "coins", "gachaToken"]);

const tierOf = tier => Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const villageGoalParticipation = tier => ({ ...VILLAGE_GOAL_PARTICIPATION[tierOf(tier)] });
export const villageGoalEffortPerPlayer = tier => ({ ...VILLAGE_GOAL_EFFORT_PER_PLAYER[tierOf(tier)] });
export const villageGoalConsolation = tier => ({ ...VILLAGE_GOAL_CONSOLATION[tierOf(tier)] });
export const villageGoalCelebration = tier => ({ ...VILLAGE_GOAL_CELEBRATION[tierOf(tier)] });

/** 有貢獻才算參與。⚠️ 這是「上場幫忙」的定義，門檻刻意只要 > 0。 */
export const isContributor = p => num(p?.contributed) > 0;

/**
 * 努力權重 ＝ √貢獻。
 * ⚠️ 跟世界王一樣用 √ 壓縮：貢獻差 4 倍，獎勵只差 2 倍。
 *    線性的話，一個把整個目標推完的人會吃掉整鍋。
 */
export const contributionWeight = p => Math.sqrt(Math.max(0, num(p?.contributed)));

/**
 * 算出每位參與者的獎勵。
 *
 * @param participants { [memberId]: { contributed } }
 * @param opts { tier, participation }  participation 可覆寫（教練手動建立的目標
 *              會自己填獎勵，那份就是保底層，不要被階級表蓋掉）
 * @returns { [memberId]: { participation, effort, celebration, total } }
 */
export function calcVillageGoalRewards(participants = {}, { tier = 0, participation = null } = {}) {
  const entries = Object.entries(participants || {}).filter(([, p]) => isContributor(p));
  const out = {};
  if (!entries.length) return out;

  const base = participation || villageGoalParticipation(tier);
  const perPlayer = villageGoalEffortPerPlayer(tier);
  const celebration = villageGoalCelebration(tier);

  // ⚠️ 鍋子 ＝ 每人份 × 人數。人多是把鍋變大，不是把每片切小。
  const n = entries.length;
  const weights = entries.map(([id, p]) => [id, contributionWeight(p)]);
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0) || 1;

  for (const [id, weight] of weights) {
    const effort = {};
    for (const key of CURRENCY_KEYS) {
      effort[key] = Math.round(num(perPlayer[key]) * n * (weight / totalWeight));
    }
    const total = {};
    for (const key of CURRENCY_KEYS) total[key] = num(base[key]) + effort[key];
    out[id] = { participation: { ...base }, effort, celebration: { ...celebration }, total };
  }
  return out;
}

/** 給後台/說明看：這個階級下，幫忙的人跟主力各拿多少 */
export function describeGoalSpread(tier = 0, { players = 10 } = {}) {
  const participants = {};
  for (let i = 0; i < players; i += 1) participants[`p${i}`] = { contributed: 100 + i * 400 };
  const rewards = calcVillageGoalRewards(participants, { tier });
  const dew = Object.values(rewards).map(r => r.total.arrowdew).sort((a, b) => a - b);
  return { min: dew[0], max: dew[dew.length - 1], ratio: dew[0] ? dew[dew.length - 1] / dew[0] : 0 };
}
