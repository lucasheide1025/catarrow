import { getExpansionChestMaterialPool, openChestContents } from "./itemData";

describe("寶箱來源 Tier（打 T2 怪不該掉 T1 素材）", () => {
  test("帶來源 tier 的寶箱只開出該 Tier 的擴充素材", () => {
    // 靈路巡衛=鬼怪 T2(rare) → iron 箱;修好前會抽到 T1 的「路邊供品」
    const chest = { type: "iron", kind: "material", family: "ghost", tier: "rare" };
    for (let i = 0; i < 40; i += 1) {
      const expansionMats = openChestContents(chest).materials.filter(m => m.monsterId);
      expect(expansionMats.every(m => m.tierIndex === 2)).toBe(true);
    }
  });
  test("沒有來源 tier 的寶箱維持舊的逐層擴散（不影響商店/舊寶箱）", () => {
    const chest = { type: "iron", kind: "material", family: "ghost" };
    const tiers = new Set();
    for (let i = 0; i < 60; i += 1) {
      openChestContents(chest).materials.filter(m => m.monsterId).forEach(m => tiers.add(m.tierIndex));
    }
    expect(tiers.size).toBeGreaterThan(1);
  });
});

describe("新素材寶箱掉落池", () => {
  test("木箱只含同族同階一般素材", () => {
    const pool = getExpansionChestMaterialPool("wood", "mountain", 1);
    expect(pool).toHaveLength(3);
    expect(pool.every(item => item.family === "mountain" && item.tierIndex === 1 && item.kind === "normal")).toBe(true);
  });

  test("金箱可含小王素材但不含大王素材", () => {
    const pool = getExpansionChestMaterialPool("gold", "mountain", 2);
    expect(pool.some(item => item.kind === "miniBoss")).toBe(true);
    expect(pool.some(item => item.kind === "boss")).toBe(false);
  });

  test("神話箱可含大王素材", () => {
    expect(getExpansionChestMaterialPool("mythic", "mountain", 5).some(item => item.kind === "boss")).toBe(true);
    expect(getExpansionChestMaterialPool("mythic", "treasure", 6)).toHaveLength(6);
  });
});
