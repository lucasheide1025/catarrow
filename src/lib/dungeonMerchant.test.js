import { buildDungeonMerchant, drawDungeonMerchantType } from "./dungeonMerchant";

describe("dungeon merchant catalog", () => {
  test("draws one of four merchant types", () => {
    expect([0, 0.26, 0.51, 0.99].map(roll => drawDungeonMerchantType(() => roll)))
      .toEqual(["healer", "magic_weapon", "magic_armor", "mystery"]);
  });

  test("healer uses approved immediate-heal prices", () => {
    const merchant = buildDungeonMerchant({ type:"healer" });
    expect(merchant.items.filter(item => item.kind === "instant_heal").map(item => [item.value, item.cost]))
      .toEqual([[0.1,200],[0.25,500],[0.5,1000]]);
  });

  test("healer only sells immediate healing and portable healing potions", () => {
    const items = buildDungeonMerchant({ type:"healer" }).items;
    expect(items.filter(item => item.kind === "carry_potion").map(item => item.potionId))
      .toEqual(["carry_heal_basic", "carry_heal_advanced"]);
    expect(items.every(item =>
      item.kind === "instant_heal"
      || item.kind === "carry_potion"
      || item.id === "potion_level_3"
    )).toBe(true);
  });

  test("magic gear uses one mutual-exclusion group", () => {
    for (const type of ["magic_weapon", "magic_armor"]) {
      const items = buildDungeonMerchant({ type }).items;
      expect(items.map(item => item.cost)).toEqual([500,1200,2500]);
      expect(new Set(items.map(item => item.group))).toEqual(new Set([type]));
    }
  });

  test.each([
    [1, [1,2]],
    [3, [2,3,4]],
    [6, [5,6]],
  ])("mystery merchant clamps T%s neighbors", (tier, expected) => {
    const items = buildDungeonMerchant({ type:"mystery", family:"ghost", tier }).items;
    expect(items.map(item => item.tier)).toEqual(expected);
    expect(items.every(item => item.limit === 3 && item.family === "ghost")).toBe(true);
  });
});
