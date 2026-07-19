import {
  gradeArcheryPerformance,
  pickArcheryMvp,
  buildArcheryAdvice,
  GRADE_ORDER,
} from "./archeryGrade";

const gradeIndex = grade => GRADE_ORDER.indexOf(grade);

describe("射箭評價（只看射箭表現，不看遊戲數值）", () => {
  test("全 X 拿到最高等級", () => {
    const result = gradeArcheryPerformance(["X", "X", "X", "X", "X", "X"]);
    expect(result.grade).toBe("SSS");
    expect(result.hitRate).toBe(1);
    expect(result.highRate).toBe(1);
  });

  test("全脫靶拿到最低等級", () => {
    const result = gradeArcheryPerformance(["M", "M", "M", "M"]);
    expect(result.grade).toBe("E");
    expect(result.hitRate).toBe(0);
    expect(result.misses).toBe(4);
  });

  test("集中的低分組 比 分散的同均分組 評價高（穩定性有作用）", () => {
    const steady = gradeArcheryPerformance(["7", "7", "7", "7", "7", "7"]);
    const erratic = gradeArcheryPerformance(["10", "4", "10", "4", "10", "4"]);
    expect(steady.stability).toBeGreaterThan(erratic.stability);
  });

  test("命中率相同時，高分率高的評價較高", () => {
    const high = gradeArcheryPerformance(["10", "10", "9", "9", "10", "9"]);
    const low = gradeArcheryPerformance(["5", "5", "6", "6", "5", "6"]);
    expect(gradeIndex(high.grade)).toBeGreaterThan(gradeIndex(low.grade));
  });

  // 破解率踩過同一個坑：藥水箭沒有分數，算成 0 分會同時拖垮命中率與穩定性
  test("藥水箭整支排除，不當成 0 分箭", () => {
    const withPotion = gradeArcheryPerformance(["10", "10", { potion:true, label:"藥水" }, "10"]);
    const without = gradeArcheryPerformance(["10", "10", "10"]);
    expect(withPotion.arrowCount).toBe(3);
    expect(withPotion.score).toBe(without.score);
  });

  test("只有一箭命中不因無法計算離散而倒扣", () => {
    const result = gradeArcheryPerformance(["10", "M", "M"]);
    expect(result.stability).toBe(1);
    expect(result.hitRate).toBeCloseTo(1 / 3);
  });

  test("沒有任何計分箭時回傳 E 而不是崩潰", () => {
    expect(gradeArcheryPerformance([]).grade).toBe("E");
    expect(gradeArcheryPerformance(null).arrowCount).toBe(0);
  });

  test("接受 {label} / {score} / 數字等多種箭格式", () => {
    const result = gradeArcheryPerformance([{ label:"10" }, { score:9 }, 8, "X"]);
    expect(result.arrowCount).toBe(4);
    expect(result.hits).toBe(4);
  });

  test("靶制不同時以該靶制的滿環為準（compound 5-10 環）", () => {
    const result = gradeArcheryPerformance(["10", "10", "X", "10"], { targetFmt:"compound_510" });
    expect(result.highRate).toBe(1);
    expect(result.grade).toBe("SSS");
  });

  // 原野靶只有 X/5/4/3/2/1/M。高分線若寫死成 maxScore-1，4 和 5 都算高分（占 40% 的環），
  // 中階射手會輕鬆拿 S，跟十環靶完全不對等 —— 故改用「最高 20% 環數」。
  describe("原野靶（X 5 4 3 2 1 M）", () => {
    const field = arrows => gradeArcheryPerformance(arrows, { targetFmt:"field_16" });

    test("只有 5／X 算高分，4 不算", () => {
      expect(field(["5", "X", "5", "X"]).highRate).toBe(1);
      expect(field(["4", "4", "4", "4"]).highRate).toBe(0);
    });

    test("X 計為滿環 5 分", () => {
      expect(field(["X", "X", "X", "X"]).avgScore).toBe(5);
    });

    test("與十環靶的評級大致對等（中階 B、滿分 SSS）", () => {
      expect(field(["4", "3", "4", "3", "4", "4"]).grade).toBe("B");
      expect(gradeArcheryPerformance(["7", "8", "7", "8", "7", "8"]).grade).toBe("B");
      expect(field(["X", "X", "X", "X", "X", "X"]).grade).toBe("SSS");
    });
  });
});

describe("MVP 挑選", () => {
  test("挑出射箭表現最好的人，與傷害無關", () => {
    const mvp = pickArcheryMvp([
      { id:"a", name:"甲", arrows:["5", "5", "M", "5"] },
      { id:"b", name:"乙", arrows:["10", "X", "10", "9"] },
      { id:"c", name:"丙", arrows:["7", "8", "7", "M"] },
    ]);
    expect(mvp.id).toBe("b");
  });

  test("同分時箭數多者優先", () => {
    const mvp = pickArcheryMvp([
      { id:"few", name:"少", arrows:["X", "X"] },
      { id:"many", name:"多", arrows:["X", "X", "X", "X"] },
    ]);
    expect(mvp.id).toBe("many");
  });

  test("全員沒有計分箭時回傳 null", () => {
    expect(pickArcheryMvp([{ id:"a", arrows:[] }])).toBeNull();
  });
});

describe("射箭建議", () => {
  test("脫靶多時提醒節奏，落點集中時給正向回饋", () => {
    const scattered = buildArcheryAdvice(gradeArcheryPerformance(["M", "M", "3", "9"]));
    expect(scattered.join()).toMatch(/脫靶/);
    const tight = buildArcheryAdvice(gradeArcheryPerformance(["9", "9", "9", "9"]));
    expect(tight.join()).toMatch(/集中/);
  });

  test("最多三條，且沒有箭時給引導語", () => {
    expect(buildArcheryAdvice(gradeArcheryPerformance(["5", "6", "7", "8"])).length).toBeLessThanOrEqual(3);
    expect(buildArcheryAdvice(null)[0]).toMatch(/沒有計分箭/);
  });
});
