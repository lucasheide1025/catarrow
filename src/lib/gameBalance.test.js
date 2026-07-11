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

  test("RPG equipment material curve is increased by 50 percent and invalidates old rolls", () => {
    expect([0, 1, 2, 3, 4].map(matCountsFor)).toEqual([
      { mainA: 6, mainB: 5, key: 2 },
      { mainA: 8, mainB: 6, key: 2 },
      { mainA: 12, mainB: 8, key: 5 },
      { mainA: 15, mainB: 11, key: 5 },
      { mainA: 20, mainB: 14, key: 6 },
    ]);
    expect(isMatsCurveCurrent({
      materials: [{ count: 4 }, { count: 3 }],
      keyItem: { count: 1 },
    }, 0)).toBe(false);
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
