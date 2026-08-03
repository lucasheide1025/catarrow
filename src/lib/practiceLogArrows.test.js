import { practiceLogArrowCount, sumPracticeLogArrows } from "./practiceLogArrows";

describe("一筆練習紀錄射了幾箭", () => {
  test("⚠️ arrowCount 是「每組幾箭」，絕對不能當總箭數", () => {
    // 這就是 2026-08-03「數據不同步」的根源：
    // 3 箭 × 20 組的練習被算成 3 箭
    const practiceLog = {
      arrowCount: 3, roundCount: 20, totalArrows: 60,
      roundsString: JSON.stringify(Array.from({ length: 20 }, () => [10, 9, 8])),
    };
    expect(practiceLogArrowCount(practiceLog)).toBe(60);
    expect(practiceLogArrowCount(practiceLog)).not.toBe(3);
  });

  test("⚠️ 就算沒有 totalArrows 也不准退回 arrowCount", () => {
    expect(practiceLogArrowCount({ arrowCount: 6 })).toBe(0);
  });

  test("totalArrows 最優先——所有寫入端都給這個", () => {
    expect(practiceLogArrowCount({ totalArrows: 42 })).toBe(42);
  });

  test("沒有 totalArrows 就數 roundsString（addPracticeLog 存的形狀）", () => {
    expect(practiceLogArrowCount({ roundsString: "[[10,9,8],[7,6,5]]" })).toBe(6);
  });

  test("rounds 還是陣列的形狀也吃得下", () => {
    expect(practiceLogArrowCount({ rounds: [[10, 9], [8, 7]] })).toBe(4);
  });

  test("⚠️ 議會廳沒有 rounds，只有平鋪的 scores", () => {
    expect(practiceLogArrowCount({ scores: ["10", "9", "8", "M"] })).toBe(4);
  });

  test("壞掉的 roundsString 不會炸，回 0", () => {
    expect(practiceLogArrowCount({ roundsString: "{壞掉" })).toBe(0);
  });

  test("空的 / null 回 0，永遠不會是 NaN", () => {
    for (const v of [null, undefined, {}, { totalArrows: "abc" }]) {
      expect(practiceLogArrowCount(v)).toBe(0);
    }
  });

  test("加總一批", () => {
    expect(sumPracticeLogArrows([
      { totalArrows: 60 },                       // 練習
      { roundsString: "[[10,9,8]]" },            // 打怪
      { scores: ["10", "9"] },                   // 議會廳
      {},                                        // 壞資料
    ])).toBe(65);
  });

  test("⚠️ 混合來源加總要跟各模式實際射的一致——這條就是原本的症狀", () => {
    const logs = [
      { source: "practice", arrowCount: 3, roundCount: 20, totalArrows: 60 },
      { source: "monster", totalArrows: 12, roundsString: "[[10,9,8],[10,9,8],[10,9,8],[10,9,8]]" },
      { source: "council", totalArrows: 9, scores: ["10", "9", "8", "7", "6", "5", "4", "3", "2"] },
    ];
    expect(sumPracticeLogArrows(logs)).toBe(81);   // 舊邏輯會算成 3 + 12 + 0 = 15
  });
});
