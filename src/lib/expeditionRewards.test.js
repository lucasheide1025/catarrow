import {
  createExpeditionKillLoot,
  createDungeonEncounterLoot,
  getExpeditionRewardPreview,
  normalizeExpeditionLootMultiplier,
  resolveExpeditionLootMultiplier,
  summarizeExpeditionChests,
} from "./expeditionRewards";

describe("expedition route kill loot",()=>{
  const monster={id:"ghost_1",name:"test",family:"ghost",tier:"common"};
  test.each([2,3,4,5])("keeps %i material and %i coin chests per kill",mult=>{
    const loot=createExpeditionKillLoot(monster,mult);
    expect(loot.chests.filter(chest=>chest.kind==="material")).toHaveLength(mult);
    expect(loot.chests.filter(chest=>chest.kind==="coin")).toHaveLength(mult);
  });

  test("multi encounter grants per-target materials but only one tile coin reward",()=>{
    const targets=[0,1,2].map(index=>({...monster,instanceId:`target_${index}`,currentHp:0,alive:false}));
    const loot=createDungeonEncounterLoot({targets},2);
    expect(loot.chests.filter(chest=>chest.kind==="material")).toHaveLength(6);
    expect(loot.chests.filter(chest=>chest.kind==="coin")).toHaveLength(2);
    expect(loot.defeated).toHaveLength(3);
  });

  test.each([
    ["ghost_t1_normal_a", "family_mat", "ghost", 1],
    ["ghost_t1_mini_a", "mini_boss_mat", "ghost", 1],
    ["ghost_t1_boss", "boss_mat", "ghost", 1],
  ])("current monster %s creates family-bound %s", (id, type, family, tierIndex) => {
    const loot = createExpeditionKillLoot({ id, name:id, family, tier:"common" }, 2);
    const materialChests = loot.chests.filter(chest => chest.kind === "material");
    expect(materialChests).toHaveLength(2);
    expect(materialChests.every(chest => chest.type === type && chest.family === family && chest.tierIndex === tierIndex)).toBe(true);
  });

  test("current reward preview uses the real dynamic family chest instead of a wood-box fallback", () => {
    const preview = getExpeditionRewardPreview({ id:"ghost_t1_boss", name:"boss", family:"ghost", tier:"common" });
    expect(preview.materialChest.type).toBe("boss_mat");
    expect(preview.materialChest.name).toContain("幽冥大王T1素材箱");
    expect(preview.materialChest.family).toBe("ghost");
    expect(preview.materialChest.tierIndex).toBe(1);
  });

  test("summary prefers each dynamic chest's authored name and icon", () => {
    const loot = createExpeditionKillLoot({ id:"ghost_t1_mini_a", name:"mini", family:"ghost", tier:"common" }, 2);
    const summary = summarizeExpeditionChests(loot.chests.filter(chest => chest.kind === "material"));
    expect(summary).toHaveLength(1);
    expect(summary[0].count).toBe(2);
    expect(summary[0].name).toContain("幽冥小王T1素材箱");
    expect(summary[0].icon).toBe("🔶");
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
});
