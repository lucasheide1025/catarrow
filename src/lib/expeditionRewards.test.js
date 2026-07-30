import {
  createExpeditionKillLoot,
  normalizeExpeditionLootMultiplier,
  resolveExpeditionLootMultiplier,
} from "./expeditionRewards";

describe("地下城地圖寶箱倍率", () => {
  const monster = {
    id: "ghost_boss",
    name: "測試怪物",
    family: "ghost",
    tier: "boss",
  };

  test("地圖顯示五倍時，實際產生五個素材箱與五個金幣箱", () => {
    const loot = createExpeditionKillLoot(monster, 5);
    expect(loot.chests.filter(chest => chest.kind === "material")).toHaveLength(5);
    expect(loot.chests.filter(chest => chest.kind === "coin")).toHaveLength(5);
  });

  test("倍率規則集中限制在有效範圍，舊資料仍可安全處理", () => {
    expect(normalizeExpeditionLootMultiplier(5)).toBe(5);
    expect(normalizeExpeditionLootMultiplier(99)).toBe(5);
    expect(normalizeExpeditionLootMultiplier(null)).toBe(2);
  });

  test("存檔或斷線重連沿用原倍率，不重新抽取", () => {
    const random = jest.fn(() => 0.99);
    expect(resolveExpeditionLootMultiplier(3, random)).toBe(3);
    expect(random).not.toHaveBeenCalled();
  });

  test("只有全新且沒有倍率的地下城才抽取一次", () => {
    const random = jest.fn(() => 0.99);
    expect(resolveExpeditionLootMultiplier(undefined, random)).toBe(5);
    expect(random).toHaveBeenCalledTimes(1);
  });
});
