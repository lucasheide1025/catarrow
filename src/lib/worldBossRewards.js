// src/lib/worldBossRewards.js
// ─────────────────────────────────────────────────────────────
// 🌍 世界王獎勵：三層整合（2026-08-03 重新設計）
//
// 作者的理念（原話）：
//   「我希望能上場幫忙打得都能有不錯的獎勵，而努力打得又有更好的獎勵」
//
// ⚠️ 舊系統違背這條理念的三個地方：
//   ① **純比例分配**：`share = pool × 自己傷害/總傷害`，下限是
//      `Math.max(1, …)` ＝ 真的只有 **1 金幣**。幫忙的人等於沒獎勵。
//   ② **人越多每人越少**：池子固定，20 人時每人只有 10 人時的一半——
//      這是在**懲罰上場幫忙**，跟理念完全相反。
//   ③ **三張表各自為政**：REWARD_TABLE（rank1/rank3/rankAll 已是死資料）、
//      DROP_TABLE_BY_CATEGORY、RANK_BONUS 語意重疊，改一個地方不會同步。
//
// 新的三層，職責分明、互不重疊：
//
//   第一層 出席保底 participation
//     有效參戰就給，**不看傷害、不被人數稀釋**。這就是「上場幫忙就有不錯的獎勵」。
//
//   第二層 努力分潤 effort
//     ⚠️ **每個人都把自己那份丟進鍋裡**（pool = perPlayer × 人數），
//        所以人多是把鍋變大，不是把每片切小。
//     ⚠️ 權重用 **√傷害** 壓縮：傷害差 4 倍，獎勵只差 2 倍。
//        努力有感，但不會贏者全拿。
//     ⚠️ 還要乘**出席天數**加成——「努力」不該只等於「裝備好」。
//        新手多來幾天也拿得到，這是唯一不靠數值就能提升的維度。
//
//   第三層 名次榮譽 rank
//     前三名與尾刀。**份量刻意小**，給的是獎盃／抽獎幣／貓貓箱這類榮譽物，
//     不做成主要收入。舊版第一名光金幣就 3000，比整池的個人份額還多，
//     那會讓「拚第一」變成唯一理性選擇。
// ─────────────────────────────────────────────────────────────

/** 有效參戰的門檻：造成過傷害就算。⚠️ 不設箭數門檻——來了就是幫忙。 */
export const MIN_DAMAGE_FOR_REWARD = 1;

/** 出席天數加成：每多來一天，努力權重 +25%（上限 ×2，也就是 5 天封頂） */
export const ATTENDANCE_BONUS_PER_DAY = 0.25;
export const MAX_ATTENDANCE_MULT = 2;

/**
 * 實測的每人單場輸出（raidBalance 模擬器，30 箭）：
 *   新手白板 atk30 → 7,233（含新手扶助 14,321）
 *   中階     atk120 → 8,636
 *   114級好裝 atk300 → 22,531
 * 混合社群抓 **12,000／人次** 當基準。
 * ⚠️ 王的血量**不要直接填數字**，用「需要幾人次」×這個基準推出來——
 *    不然像舊版那樣，教練王 1,100,000 需要 92 人次，實際上根本打不死。
 */
export const EXPECTED_DAMAGE_PER_ATTACK = 12000;

/** 四個分類各要幾人次才打得死 */
export const TARGET_ATTACKS = Object.freeze({
  cat: 8,             // 入門王：一小群人一次聚會就能收掉
  family_small: 14,   // 六族小王
  family_big: 28,     // 六族大王：要動員
  coach: 45,          // 教練隱藏王：全場出動才有機會
});

/** 分類 → 建議血量 */
export function suggestedBossHp(category, targetAttacks = null) {
  const n = targetAttacks ?? TARGET_ATTACKS[category] ?? TARGET_ATTACKS.family_big;
  return Math.round(n * EXPECTED_DAMAGE_PER_ATTACK);
}

/**
 * 三層獎勵表。
 * ⚠️ `perPlayerEffort` 是**每位參戰者投入鍋子的量**，不是他會拿到的量。
 *    實際拿多少看 √傷害 權重。
 */
export const WB_REWARD_TABLE = Object.freeze({
  cat: {
    participation: { coins: 200, arrowDew: 40, archerXP: 150, catXP: 50, bond: 6, coinChests: 1 },
    perPlayerEffort: { coins: 250, arrowDew: 50, archerXP: 200, catXP: 60, bond: 8 },
    extras: { coinChestTierRange: [1, 6], mimiBoxChance: 0.25, catBoxChance: 0.10,
      cardPacksRange: [1, 2], wbCardChance: 0.20, scrolls: 1 },
  },
  family_small: {
    participation: { coins: 250, arrowDew: 50, archerXP: 200, catXP: 60, bond: 8, materialChests: 1 },
    perPlayerEffort: { coins: 300, arrowDew: 60, archerXP: 250, catXP: 70, bond: 10 },
    extras: { chestTierRange: [1, 3], wbCardChance: 0.25, scrolls: 1 },
  },
  family_big: {
    participation: { coins: 350, arrowDew: 80, archerXP: 320, catXP: 90, bond: 12, materialChests: 1 },
    perPlayerEffort: { coins: 450, arrowDew: 100, archerXP: 400, catXP: 110, bond: 15 },
    extras: { chestTierRange: [4, 6], wbCardChance: 0.25, scrolls: 1 },
  },
  coach: {
    participation: { coins: 600, arrowDew: 150, archerXP: 500, catXP: 150, bond: 20,
      coinChests: 1, materialChests: 2 },
    perPlayerEffort: { coins: 700, arrowDew: 180, archerXP: 600, catXP: 180, bond: 25 },
    extras: { coinChestTierRange: [3, 6], materialChestTierRange: [1, 6], mimiBoxChance: 0.35,
      catBoxChance: 0.20, cardPacksRange: [1, 3], wbCardChance: 0.10, scrolls: 2 },
  },
});

/**
 * 名次榮譽。⚠️ 刻意**不給大量金幣**——名次是榮譽，不是收入。
 * 舊版第一名 3000 金幣讓「拚第一」變成唯一理性選擇。
 */
export const WB_RANK_HONOR = Object.freeze({
  1: { gachaCoins: 10, catBoxes: 1, mimiBoxes: 1, arrowDew: 200, trophy: true },
  2: { gachaCoins: 7, mimiBoxes: 1, arrowDew: 120, trophy: true },
  3: { gachaCoins: 5, mimiBoxes: 1, arrowDew: 80, trophy: true },
  lastHit: { gachaCoins: 5, catBoxes: 1, arrowDew: 150, trophy: true },
});

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** 這位參戰者算不算「有上場幫忙」 */
export function isEligible(participant) {
  if (!participant) return false;
  if (participant.isGuest === true && participant.accountType !== "official") return false;
  return num(participant.totalDmg) >= MIN_DAMAGE_FOR_REWARD;
}

/** 出席天數（sessions 一天一筆） */
export function attendanceDays(participant) {
  const sessions = participant?.sessions;
  return Array.isArray(sessions) && sessions.length ? sessions.length : 1;
}

/**
 * 努力權重 ＝ √傷害 × 出席加成。
 *
 * ⚠️ 用 √ 而不是線性：傷害 4 倍 → 權重只有 2 倍。
 *    線性的話，一個滿裝老手就能吃掉整鍋，幫忙的人拿到個位數。
 * ⚠️ 乘出席天數：讓「多來幾天」也算努力，
 *    否則「努力」實際上只是「裝備好」，新手再拚也追不上。
 */
export function effortWeight(participant) {
  const dmg = Math.max(0, num(participant?.totalDmg));
  const days = attendanceDays(participant);
  const attendMult = Math.min(MAX_ATTENDANCE_MULT, 1 + (days - 1) * ATTENDANCE_BONUS_PER_DAY);
  return Math.sqrt(dmg) * attendMult;
}

/**
 * 算出每個人的獎勵。
 * @param participants  { [memberId]: { totalDmg, sessions, isGuest, accountType } }
 * @param category      cat | family_small | family_big | coach
 * @param opts          { top3Ids, lastHitBy }
 * @returns { [memberId]: { participation, effort, honor, rank, total } }
 */
export function calcWorldBossRewards(participants = {}, category = "family_big", opts = {}) {
  const table = WB_REWARD_TABLE[category] || WB_REWARD_TABLE.family_big;
  const entries = Object.entries(participants || {}).filter(([, p]) => isEligible(p));
  const out = {};
  if (!entries.length) return out;

  // ⚠️ 鍋子大小 ＝ 每人份 × 人數。人多是把鍋變大，不是把每片切小。
  const n = entries.length;
  const weights = entries.map(([id, p]) => [id, effortWeight(p)]);
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0) || 1;

  const top3 = opts.top3Ids || [];
  const lastHitBy = opts.lastHitBy || null;

  for (const [id, weight] of weights) {
    const participation = { ...table.participation };
    const effort = {};
    for (const [key, perPlayer] of Object.entries(table.perPlayerEffort)) {
      effort[key] = Math.round((perPlayer * n) * (weight / totalWeight));
    }

    const rankIndex = top3.indexOf(id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const honor = {};
    if (rank) Object.assign(honor, WB_RANK_HONOR[rank]);
    if (lastHitBy === id) {
      for (const [k, v] of Object.entries(WB_RANK_HONOR.lastHit)) {
        honor[k] = typeof v === "number" ? num(honor[k]) + v : v;
      }
    }

    const total = {};
    for (const src of [participation, effort, honor]) {
      for (const [k, v] of Object.entries(src)) {
        if (typeof v === "number") total[k] = num(total[k]) + v;
      }
    }
    out[id] = { participation, effort, honor, rank, isLastHit: lastHitBy === id, total };
  }
  return out;
}

/** 給後台／說明用：這個分類下，幫忙的人跟拚第一的人各拿多少 */
export function describeSpread(category = "family_big", { players = 10 } = {}) {
  const participants = {};
  for (let i = 0; i < players; i += 1) {
    // 造一組差距很大的樣本：第一名的傷害是最後一名的 10 倍
    participants[`p${i}`] = { totalDmg: 2000 + i * 2000, sessions: [{}] };
  }
  const rewards = calcWorldBossRewards(participants, category, { top3Ids: [`p${players - 1}`] });
  const coins = Object.values(rewards).map(r => r.total.coins || 0).sort((a, b) => a - b);
  return { min: coins[0], max: coins[coins.length - 1], ratio: coins[0] ? coins[coins.length - 1] / coins[0] : 0 };
}
