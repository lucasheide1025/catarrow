import { CHEST_TYPES, openChestContents } from "./itemData";
import { isMatsCurveCurrent, matCountsFor } from "./equipData";
import { calcForgeCost, catEquipEnhancement } from "./catData";

describe("chest and equipment balance", () => {
  test.each(["wood", "iron", "gold", "epic", "mythic"])(
    "%s material chest never grants potions",
    (type) => {
      expect(CHEST_TYPES[type].potionChance).toBe(0);
      for (let i = 0; i < 50; i += 1) {
        expect(openChestContents({ type, family: "ghost" }).potions).toEqual([]);
      }
    },
  );

  test("potion chest still grants a potion", () => {
    expect(openChestContents({ type: "potion" }).potions).toHaveLength(1);
  });

  test("精煉需求改為依品級分級，舊格式一律失效並重算", () => {
    expect([0, 1, 2, 3, 4].map(matCountsFor)).toEqual([
      { current: 6,  next: 2, next2: 1 },
      { current: 8,  next: 3, next2: 1 },
      { current: 12, next: 4, next2: 2 },
      { current: 15, next: 5, next2: 2 },
      { current: 20, next: 6, next2: 3 },
    ]);
    // 舊格式（未標 tierRole / 帶 keyItem）→ 視為過期，開啟裝備時會自動重算
    expect(isMatsCurveCurrent({
      materials: [{ count: 6 }, { count: 5 }],
      keyItem: { count: 2 },
    }, "common", 0)).toBe(false);
    // 新格式：普通 = 2 種該階，無下一階
    const fresh = {
      materials: Array.from({ length: 2 }, () => ({ count: 6, tierRole: "current" })),
      keyItem: null,
    };
    expect(isMatsCurveCurrent(fresh, "common", 0)).toBe(true);
    expect(isMatsCurveCurrent(fresh, "common", 3)).toBe(false); // 數量與該 plusLevel 不符 → 重算
    expect(isMatsCurveCurrent(fresh, "elite", 0)).toBe(false);  // 精英要 4+3+1，種類不符 → 重算
  });

  test("cat equipment uses cumulative enhancement and matching material tiers", () => {
    expect(catEquipEnhancement("普通", 9)).toBe(9);
    expect(catEquipEnhancement("稀有", 0)).toBe(10);
    expect(catEquipEnhancement("傳說", 9)).toBe(49);
    expect(catEquipEnhancement("神話", 0)).toBe(50);

    expect(calcForgeCost("bow", "普通", 9)).toEqual({ ore_t1: 1000, fur_t1: 10 });
    expect(calcForgeCost("bow", "稀有", 9)).toEqual({ ore_t2: 1000, fur_t2: 15 });
    expect(calcForgeCost("bow", "精英", 9)).toEqual({ ore_t3: 1000, fur_t3: 20 });
    expect(calcForgeCost("bow", "頭目", 9)).toEqual({ ore_t4: 1000, fur_t4: 30 });
    expect(calcForgeCost("bow", "傳說", 9)).toEqual({ ore_t5: 1000, fur_t5: 50 });
    expect(calcForgeCost("bow", "神話", 0)).toBeNull();
    expect(calcForgeCost("bow", "神話", 9)).toBeNull();
  });

  test("cat equipment regular upgrades use the current grade tier", () => {
    expect(calcForgeCost("arrow", "普通", 0)).toEqual({ meat_t1: 30 });
    expect(calcForgeCost("arrow", "稀有", 3)).toEqual({ meat_t2: 150 });
    expect(calcForgeCost("arrow", "傳說", 8)).toEqual({ meat_t5: 800 });
  });
});
