import { calculateDungeonDisplayedStats } from "./dungeonDisplayedStats";

describe("calculateDungeonDisplayedStats", () => {
  test("combines rest, merchant and temporary multipliers", () => {
    expect(calculateDungeonDisplayedStats({
      atk: 100,
      def: 80,
      buffs: { atkMult: 0.9, defMult: 1.1 },
      restBonuses: { atkPct: 10, defPct: 5 },
      merchantBonuses: { atkPct: 20, defPct: 10 },
    })).toEqual({ atkBase:100, defBase:80, atk:119, def:102, atkPct:19, defPct:27 });
  });

  test("shows reductions as negative percentages", () => {
    expect(calculateDungeonDisplayedStats({
      atk: 50,
      def: 40,
      buffs: { atkMult: 0.8, defMult: 0.75 },
    })).toEqual({ atkBase:50, defBase:40, atk:40, def:30, atkPct:-20, defPct:-25 });
  });
});
