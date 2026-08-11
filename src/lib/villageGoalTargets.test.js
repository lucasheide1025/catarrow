// 村目標的目標值曲線。
// ⚠️ 這是**護欄**：2026-08-03 作者反映「階級 2 跟 3 的總數需求有點高了」，
//    舊值每階 ×2.7 一路翻上去（tier3 是 tier1 的 5.3 倍），
//    以一間道館的規模一個月根本打不到。以後誰再把它調高就會被擋下來。
import { GOAL_TYPES, getGoalTarget, getGoalTier } from "./villageGoalData";

const TIERS = [0, 1, 2, 3];
// 用村莊等級反推階級，確保 getGoalTarget 吃的是真的等級
const LEVEL_FOR_TIER = [1, 6, 11, 16];

describe("目標值曲線", () => {
  test("階級對照沒跑掉", () => {
    LEVEL_FOR_TIER.forEach((lv, tier) => expect(getGoalTier(lv)).toBe(tier));
  });

  test("每一種目標都是遞增的", () => {
    for (const { id } of GOAL_TYPES) {
      const vals = LEVEL_FOR_TIER.map(lv => getGoalTarget(lv, id));
      for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  test("⚠️ 每階不得超過 ×1.8——舊版 ×2.7 讓高階完全打不到", () => {
    for (const { id, name } of GOAL_TYPES) {
      const vals = LEVEL_FOR_TIER.map(lv => getGoalTarget(lv, id));
      for (let i = 2; i < vals.length; i += 1) {
        const ratio = vals[i] / vals[i - 1];
        expect(`${name} 階級${i}/${i - 1} = ${ratio.toFixed(2)}`).toBe(`${name} 階級${i}/${i - 1} = ${ratio.toFixed(2)}`);
        expect(ratio).toBeLessThanOrEqual(1.8);
      }
    }
  });

  test("⚠️ 最高階不得超過階級1 的 3 倍", () => {
    for (const { id } of GOAL_TYPES) {
      expect(getGoalTarget(16, id) / getGoalTarget(6, id)).toBeLessThanOrEqual(3);
    }
  });

  test("⚠️ 一個月要射得完：最高階箭數換算成每日不超過 1,500 箭", () => {
    // 期限是 30 天（villageGoalSchedule）。這條擋的是「數字看起來還好、
    // 但換算成每天要射多少就知道不可能」的情況。
    expect(getGoalTarget(16, "total_arrows") / 30).toBeLessThanOrEqual(1500);
  });

  test("不認識的目標類型有保底值，不會回 undefined", () => {
    expect(getGoalTarget(1, "不存在")).toBeGreaterThan(0);
  });

  test("擊殺與探險完成採用核准後的四階曲線", () => {
    expect(LEVEL_FOR_TIER.map(lv => getGoalTarget(lv, "monster_kills"))).toEqual([40, 100, 160, 240]);
    expect(LEVEL_FOR_TIER.map(lv => getGoalTarget(lv, "exploration_completions"))).toEqual([30, 70, 105, 150]);
  });
});
