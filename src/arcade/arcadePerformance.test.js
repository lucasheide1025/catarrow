import { ARCADE_PRAISE_LINES, analyzeArcadeShots, performanceFromAggregates } from "./arcadePerformance";

describe("arcadePerformance", () => {
  test("誇獎詞剛好 20 條且不重複", () => {
    expect(ARCADE_PRAISE_LINES).toHaveLength(20);
    expect(new Set(ARCADE_PRAISE_LINES).size).toBe(20);
  });

  test("命中率以 >=5 分計算，X(11) 計 10 分", () => {
    const p = analyzeArcadeShots([11, 10, 5, 4, 0, 2], "a");
    expect(p.hitRate).toBe(50);
    expect(p.avgScore).toBeCloseTo(31 / 6, 1);
  });

  test("完全同分穩定性 100；波動越大穩定性越低", () => {
    expect(analyzeArcadeShots([5, 5, 5, 5, 5, 5]).stability).toBe(100);
    expect(analyzeArcadeShots([0, 10, 0, 10, 0, 10]).stability).toBe(0);
  });

  test("aggregate 與 raw shot 分析一致", () => {
    const raw = analyzeArcadeShots([8, 7, 6, 5, 4, 3], "same");
    const agg = performanceFromAggregates({ shots: 6, hitCount: 4, score: 33, scoreSqSum: 199 }, "same");
    expect(agg).toEqual(raw);
  });

  test("空資料安全回 C 且不出 NaN", () => {
    const p = analyzeArcadeShots([], "empty");
    expect(p.grade).toBe("C");
    expect(p.hitRate).toBe(0);
    expect(p.stability).toBe(0);
    expect(Number.isNaN(p.avgScore)).toBe(false);
  });

  test("同一成績與 seed 的誇獎詞固定，不會 rerender 亂跳", () => {
    const a = analyzeArcadeShots([10, 9, 8, 7, 6, 5], "visitor-1");
    const b = analyzeArcadeShots([10, 9, 8, 7, 6, 5], "visitor-1");
    expect(a.praise).toBe(b.praise);
  });
});
