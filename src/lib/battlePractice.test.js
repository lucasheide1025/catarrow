import {
  analyzeBattlePractice,
  normalizePracticeRounds,
  highQualityThreshold,
  isHighQualityHit,
} from "./battlePractice";

describe("high quality hit（跨靶紙正規化,唯一權威 util）", () => {
  test("10 分制靶（全環/三聯）門檻 = 8", () => {
    expect(highQualityThreshold("full_110")).toBe(8);
    expect(highQualityThreshold("triple")).toBe(8);
    expect(isHighQualityHit(8, "full_110")).toBe(true);
    expect(isHighQualityHit(7, "full_110")).toBe(false);
  });
  test("field_16（X、1-5 環）門檻 = 4,不寫死 9 分", () => {
    expect(highQualityThreshold("field_16")).toBe(4);
    expect(isHighQualityHit(4, "field_16")).toBe(true);
    expect(isHighQualityHit(3, "field_16")).toBe(false);
  });
  test("與 analyzeBattlePractice 的 highThreshold 一致（單一來源）", () => {
    expect(analyzeBattlePractice([[5, 4, 1, "M"]], "field_16").highThreshold).toBe(highQualityThreshold("field_16"));
    expect(analyzeBattlePractice([["X", 10, 8, "M"]], "full_110").highThreshold).toBe(highQualityThreshold("full_110"));
  });
});

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

  test("field analysis keeps raw 1-5 values", () => {
    // field_16 於 283ed00 定調為 X、1-5 環（maxScore 5）；高分門檻 = maxScore - 1 = 4
    const stats = analyzeBattlePractice([[5, 4, 1, "M"]], "field_16");
    expect(stats.total).toBe(10);
    expect(stats.highThreshold).toBe(4);
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
