import {
  analyzeBattlePractice,
  normalizePracticeRounds,
} from "./battlePractice";

describe("battle practice analysis", () => {
  test("true average counts misses as zero", () => {
    const stats = analyzeBattlePractice([["X", 10, 8, "M"]], "full_110");
    expect(stats.total).toBe(28);
    expect(stats.count).toBe(4);
    expect(stats.average).toBe(7);
    expect(stats.misses).toBe(1);
    expect(stats.xCount).toBe(1);
    expect(stats.tenCount).toBe(1);
  });

  test("normalizes numeric, label, and object arrows without treating unknown text as ten", () => {
    const rounds = normalizePracticeRounds([
      [10, "9", { label:"8", score:99 }, { score:7 }, "unknown"],
    ]);
    expect(rounds[0].map(arrow => arrow.score)).toEqual([10, 9, 8, 7]);
  });

  test("field analysis keeps raw 1-6 values", () => {
    const stats = analyzeBattlePractice([[6, 5, 1, "M"]], "field_16");
    expect(stats.total).toBe(12);
    expect(stats.highThreshold).toBe(5);
    expect(stats.highCount).toBe(2);
  });

  test("calculates fatigue and landing group data", () => {
    const stats = analyzeBattlePractice(
      [[10, 10], [8, 6]],
      "full_110",
      [
        { score:10, nx:0.1, ny:0.1 },
        { score:10, nx:0.2, ny:0.1 },
      ]
    );
    expect(stats.halfDelta).toBe(-3);
    expect(stats.landing.count).toBe(2);
    expect(stats.landing.centerX).toBeCloseTo(0.15);
  });
});
