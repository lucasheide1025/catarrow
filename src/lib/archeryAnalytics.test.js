import {
  MIN_ARROWS_FOR_GROUP,
  biasBreakdown,
  byCondition,
  consistency,
  groupAnalysis,
  groupVerdict,
  readiness,
  withPosition,
  withinEndTrend,
} from "./archeryAnalytics";

const at = (x, y, over = {}) => ({ score: 9, position: { x, y }, ...over });

describe("群組分析", () => {
  test("只算有落點的箭，脫靶不算", () => {
    const arrows = [at(0.1, 0.1), { score: 0, isMiss: true }, { score: 8 }];
    expect(withPosition(arrows)).toHaveLength(1);
  });

  test("算得出中心與離散度", () => {
    const g = groupAnalysis([at(0.2, 0.2), at(0.2, 0.2), at(0.2, 0.2)]);
    expect(g.centerX).toBe(0.2);
    expect(g.spread).toBe(0);
    expect(g.tight).toBe(true);
  });

  test("⚠️ 離散度是離自己的平均落點，不是離靶心", () => {
    // 遠離靶心但超集中
    const far = groupAnalysis([at(0.6, 0.6), at(0.6, 0.6), at(0.61, 0.6)]);
    // 在靶心附近但四散
    const loose = groupAnalysis([at(0, 0), at(0.4, -0.3), at(-0.35, 0.4)]);
    expect(far.spread).toBeLessThan(loose.spread);
    expect(far.offset).toBeGreaterThan(loose.offset);   // 但偏移比較大
  });

  test("沒有落點時回全 0，不會 NaN", () => {
    const g = groupAnalysis([]);
    expect(g.count).toBe(0);
    for (const v of Object.values(g)) expect(typeof v === "boolean" || Number.isFinite(v)).toBe(true);
  });
});

describe("左右／上下分開判讀", () => {
  test("⚠️ 兩軸的成因不同，建議要分開講", () => {
    const rows = biasBreakdown(groupAnalysis([at(0.4, 0.4), at(0.4, 0.4)]));
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.axis === "horizontal").side).toBe("右");
    expect(rows.find(r => r.axis === "vertical").side).toBe("下");
    expect(rows[0].hint).not.toBe(rows[1].hint);
  });

  test("⚠️ 小偏移不提醒——那是正常抖動，不該叫人去調瞄具", () => {
    expect(biasBreakdown(groupAnalysis([at(0.02, -0.03)]))).toEqual([]);
  });

  test("只偏一個方向就只給一條", () => {
    expect(biasBreakdown(groupAnalysis([at(0, -0.5)]))).toHaveLength(1);
  });
});

describe("群組判讀（教練當場講得出的一句話）", () => {
  test("⚠️ 穩但偏＝最好修，一定要講出來鼓勵", () => {
    const v = groupVerdict(groupAnalysis([at(0.5, 0.5), at(0.5, 0.5), at(0.51, 0.5)]));
    expect(v.level).toBe("adjust");
    expect(v.text).toContain("調瞄具");
  });

  test("準但散＝要練穩定度，不是瞄準", () => {
    const v = groupVerdict(groupAnalysis([at(0.45, 0), at(-0.45, 0), at(0, 0.45), at(0, -0.45)]));
    expect(v.level).toBe("consistency");
    expect(v.text).toContain("穩定度");
  });

  test("又準又穩就給肯定", () => {
    expect(groupVerdict(groupAnalysis([at(0.01, 0.01), at(0, 0)])).level).toBe("great");
  });

  test("又散又偏＝先固定動作再談瞄具", () => {
    const v = groupVerdict(groupAnalysis([at(0.7, 0.6), at(0.1, 0.7), at(0.6, 0.1)]));
    expect(v.level).toBe("basics");
  });

  test("沒資料時不會亂給建議", () => {
    expect(groupVerdict(null).level).toBe("none");
  });
});

describe("回合內衰退（體力與專注）", () => {
  const end = scores => ({ arrows: scores.map(score => ({ score })) });

  test("算得出每一支的平均與落差", () => {
    const t = withinEndTrend([end([10, 9, 8]), end([10, 9, 8])]);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0].average).toBe(10);
    expect(t.drop).toBe(2);
    expect(t.fatigue).toBe(true);
  });

  test("⚠️ 小落差不算衰退——單場抖動本來就有 0.3~0.5", () => {
    expect(withinEndTrend([end([9, 9, 8.5]), end([9, 9, 8.6])]).fatigue).toBe(false);
  });

  test("只有一支箭時不判斷衰退", () => {
    expect(withinEndTrend([end([10])]).fatigue).toBe(false);
  });

  test("吃得下 targetPlot 的資料形狀", () => {
    const t = withinEndTrend([{ arrows: [{ captureMode: "targetPlot", recordedScore: { score: 10 } }] }]);
    expect(t.rows[0].average).toBe(10);
  });

  test("空資料不會炸", () => {
    expect(withinEndTrend().rows).toEqual([]);
  });
});

describe("一致性", () => {
  test("算得出最長連續好球與最差的一箭", () => {
    const c = consistency([
      { score: 10, isX: true }, { score: 9 }, { score: 5 }, { score: 10 }, { score: 9 },
    ]);
    expect(c.bestStreak).toBe(2);
    expect(c.worst.score).toBe(5);
    expect(c.xRate).toBeCloseTo(0.2, 2);
  });

  test("脫靶率算得出來", () => {
    expect(consistency([{ score: 0, isMiss: true }, { score: 9 }]).missRate).toBe(0.5);
  });

  test("空資料不會炸", () => {
    expect(consistency([]).count).toBe(0);
  });
});

describe("距離／靶紙分層", () => {
  test("⚠️ 18m 跟 30m 不能混在一起平均", () => {
    // ⚠️ 用**真實的場次形狀**（shootingConfig / metricsSnapshot），
    //    這條就是為了擋「欄位名猜錯導致整排 ?m｜未記錄 0環」而寫的
    const rows = byCondition([
      { shootingConfig: { distanceM: 18, targetFmt: "full_110" }, metricsSnapshot: { arrowCount: 30, totalScore: 270 } },
      { shootingConfig: { distanceM: 30, targetFmt: "full_110" }, metricsSnapshot: { arrowCount: 30, totalScore: 210 } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.distance === 18).average).toBe(9);
    expect(rows[0].key).toContain("全靶");
    expect(rows.find(r => r.distance === 30).average).toBe(7);
  });

  test("箭數多的排前面（那是主要練習條件）", () => {
    const rows = byCondition([
      { shootingConfig: { distanceM: 18 }, metricsSnapshot: { arrowCount: 6, totalScore: 54 } },
      { shootingConfig: { distanceM: 30 }, metricsSnapshot: { arrowCount: 60, totalScore: 420 } },
    ]);
    expect(rows[0].distance).toBe(30);
  });

  test("沒有箭數的場次不列", () => {
    expect(byCondition([{ shootingConfig: { distanceM: 18 } }])).toEqual([]);
  });
});

describe("資料夠不夠", () => {
  test("⚠️ 不夠時要說「還差幾支」，不是只說資料不足", () => {
    const r = readiness([at(0, 0), at(0.1, 0)]);
    expect(r.ready).toBe(false);
    expect(r.need).toBe(MIN_ARROWS_FOR_GROUP - 2);
  });

  test("⚠️ 有分數但沒落點是最常見的情況，要分辨得出來", () => {
    const r = readiness([{ score: 9 }, { score: 10 }]);
    expect(r.scoreOnly).toBe(true);
    expect(r.plotted).toBe(0);
  });

  test("夠了就是夠了", () => {
    const arrows = Array.from({ length: MIN_ARROWS_FOR_GROUP }, () => at(0.1, 0.1));
    expect(readiness(arrows).ready).toBe(true);
  });
});
