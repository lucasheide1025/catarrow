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
  test("通用材料寶箱：依來源 tier 開出六大族該階材料（同階、跨族、不含寶箱族）", () => {
    // 2026-07-23 作者拍板：舊 wood/iron/gold/epic/mythic 改為「通用材料寶箱」，
    // 依來源怪階級開出六大族（不含 treasure）該階材料。
    const chest = { type: "gold", kind: "material", family: "ghost", tier: "rare" }; // rare = T2
    const families = new Set();
    const tiers = new Set();
    for (let i = 0; i < 60; i += 1) {
      openChestContents(chest).materials.filter(m => m.monsterId).forEach(m => {
        families.add(m.family);
        tiers.add(m.tierIndex);
      });
    }
    expect(tiers.size).toBe(1);                    // 只開該階
    expect([...tiers][0]).toBe(2);                 // T2
    expect(families.size).toBeGreaterThan(1);      // 跨多族（六大族）
    expect(families.has("treasure")).toBe(false);  // 不含寶箱族
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
