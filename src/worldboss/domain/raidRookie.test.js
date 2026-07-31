import { ROOKIE_LEVEL_CAP, rookieBadge, rookieMultiplier } from "./raidRookie";

describe("新手扶助（戰鬥模型外面的那一層）", () => {
  test("50 級以下才有，之後完全沒有", () => {
    expect(rookieMultiplier(49)).toBeGreaterThan(1);
    expect(rookieMultiplier(ROOKIE_LEVEL_CAP)).toBe(1);
    expect(rookieMultiplier(114)).toBe(1);
    expect(rookieMultiplier(500)).toBe(1);
  });

  test("等級越低給越多，且單調遞減", () => {
    let prev = Infinity;
    for (let lv = 1; lv <= ROOKIE_LEVEL_CAP; lv += 1) {
      const m = rookieMultiplier(lv);
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
  });

  test("⚠️ 沒有斷崖：49 級跟 50 級只差一點點，不會「升級反而變弱」", () => {
    expect(rookieMultiplier(49) - rookieMultiplier(50)).toBeLessThan(0.05);
  });

  test("最高倍率落在合理範圍（1 級約兩倍）", () => {
    expect(rookieMultiplier(1)).toBeGreaterThan(2);
    expect(rookieMultiplier(1)).toBeLessThan(2.5);
  });

  test("壞資料不會炸", () => {
    expect(rookieMultiplier()).toBe(rookieMultiplier(1));
    expect(rookieMultiplier(0)).toBe(rookieMultiplier(1));
    expect(rookieMultiplier(-9)).toBe(rookieMultiplier(1));
    expect(rookieMultiplier("abc")).toBe(rookieMultiplier(1));
  });

  test("UI 標章：有加成才顯示", () => {
    expect(rookieBadge(10)).toBeTruthy();
    expect(rookieBadge(10).mult).toBe(rookieMultiplier(10));
    expect(rookieBadge(80)).toBeNull();
  });
});
