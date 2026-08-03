import {
  DUPLICATE_WINDOW_SEC, dateKeyFromCreatedAt, planPracticeLogRepair, repairCount,
} from "./practiceLogRepair";

const ts = sec => ({ seconds: sec });
// 2026-08-02 20:00 台北 = 2026-08-02 12:00 UTC
const AUG2_TPE_2000 = Math.floor(Date.UTC(2026, 7, 2, 12, 0, 0) / 1000);

describe("從 createdAt 推日期", () => {
  test("用台北時間，不是 UTC", () => {
    expect(dateKeyFromCreatedAt({ createdAt: ts(AUG2_TPE_2000) })).toBe("2026-08-02");
  });

  test("⚠️ 台北深夜要算成當天，不能因為 UTC 還在前一天就算錯", () => {
    // 2026-08-02 23:30 台北 = 2026-08-02 15:30 UTC
    const late = Math.floor(Date.UTC(2026, 7, 2, 15, 30, 0) / 1000);
    expect(dateKeyFromCreatedAt({ createdAt: ts(late) })).toBe("2026-08-02");
  });

  test("沒有 createdAt 就回 null，不要亂猜今天", () => {
    expect(dateKeyFromCreatedAt({})).toBe(null);
  });
});

describe("補正計畫", () => {
  test("缺 date 的一般紀錄要補", () => {
    const plan = planPracticeLogRepair([
      { id: "a", createdAt: ts(AUG2_TPE_2000), totalArrows: 12, roundsString: "[[10,9,8]]" },
    ]);
    expect(plan.fixDate).toHaveLength(1);
    expect(plan.fixDate[0].patch.date).toBe("2026-08-02");
  });

  test("⚠️ 舊版世界王的重複紀錄不能補 date——補了就箭數翻倍", () => {
    const plan = planPracticeLogRepair([
      // 畫面自己寫的完整那筆（有 date、有 rounds）
      { id: "rich", date: "2026-08-02", source: "worldboss", bossName: "大魔王",
        createdAt: ts(AUG2_TPE_2000), totalArrows: 9, roundsString: "[[10,9,8],[10,9,8],[10,9,8]]" },
      // attackWorldBoss 內建那筆簡略的（沒 date、沒 rounds）
      { id: "terse", type: "world_boss", bossName: "大魔王",
        createdAt: ts(AUG2_TPE_2000 + 5), arrows: 9 },
    ]);
    expect(plan.duplicates.map(d => d.id)).toEqual(["terse"]);
    expect(plan.fixDate).toHaveLength(0);
  });

  test("⚠️ 時間差太遠就不是重複——新版世界王只有這一筆，要補回來", () => {
    const plan = planPracticeLogRepair([
      { id: "rich", date: "2026-08-02", source: "worldboss", bossName: "大魔王",
        createdAt: ts(AUG2_TPE_2000), roundsString: "[[10]]", totalArrows: 1 },
      { id: "raid", type: "world_boss", bossName: "大魔王",
        createdAt: ts(AUG2_TPE_2000 + DUPLICATE_WINDOW_SEC + 60), arrows: 6, totalArrows: 6 },
    ]);
    expect(plan.duplicates).toHaveLength(0);
    expect(plan.fixDate.map(f => f.id)).toEqual(["raid"]);
  });

  test("⚠️ 不同的王不算重複，就算時間很近", () => {
    const plan = planPracticeLogRepair([
      { id: "rich", date: "2026-08-02", source: "worldboss", bossName: "甲王",
        createdAt: ts(AUG2_TPE_2000), roundsString: "[[10]]", totalArrows: 1 },
      { id: "terse", type: "world_boss", bossName: "乙王",
        createdAt: ts(AUG2_TPE_2000 + 5), totalArrows: 3, scores: [1, 2, 3] },
    ]);
    expect(plan.duplicates).toHaveLength(0);
  });

  test("⚠️ totalArrows 寫錯要驗得出來——不能拿會優先相信它的函式去比對", () => {
    const plan = planPracticeLogRepair([
      { id: "p", date: "2026-08-02", arrowCount: 3, totalArrows: 3,
        roundsString: JSON.stringify(Array.from({ length: 20 }, () => [10, 9, 8])) },
    ]);
    expect(plan.fixArrows[0].patch.totalArrows).toBe(60);
  });

  test("完全沒有 totalArrows 但有箭矢資料，補回去", () => {
    const plan = planPracticeLogRepair([
      { id: "c", date: "2026-08-02", source: "council", scores: ["10", "9", "8"] },
    ]);
    expect(plan.fixArrows[0].patch.totalArrows).toBe(3);
  });

  test("已經正確的不動——重跑一次不會再改任何東西", () => {
    const logs = [{ id: "ok", date: "2026-08-02", totalArrows: 3, roundsString: "[[10,9,8]]" }];
    const plan = planPracticeLogRepair(logs);
    expect(repairCount(plan)).toBe(0);
    expect(plan.ok).toBe(1);
  });

  test("⚠️ 缺 date 又沒有 createdAt 就標成無法修，不要瞎編一個日期", () => {
    const plan = planPracticeLogRepair([{ id: "x", totalArrows: 5 }]);
    expect(plan.unfixable).toHaveLength(1);
    expect(plan.fixDate).toHaveLength(0);
  });

  test("空輸入不會炸", () => {
    expect(repairCount(planPracticeLogRepair())).toBe(0);
  });
});
