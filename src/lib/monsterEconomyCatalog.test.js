import {
  getNormalMaterialPool,
  getNormalMonsterMaterialDrop,
  previewSameTierConversion,
  previewTierUpgrade,
  validateMonsterEconomyCatalog,
} from "./monsterEconomyCatalog";

describe("monster economy catalog", () => {
  test("contains only the 126 convertible normal materials", () => {
    expect(validateMonsterEconomyCatalog()).toEqual({ ok: true, errors: [] });
    expect(getNormalMaterialPool({ maxTier: 6 })).toHaveLength(126);
  });

  test("applies mode and variant quantities with ceiling", () => {
    expect(getNormalMonsterMaterialDrop({ monsterId: "ghost_t1_normal_a", mode: "solo", variant: "weakened" }).quantity).toBe(3);
    expect(getNormalMonsterMaterialDrop({ monsterId: "ghost_t1_normal_a", mode: "party", variant: "strong" }).quantity).toBe(6);
  });

  test("previews batched same-tier conversion", () => {
    const result = previewSameTierConversion({ sourceMaterialId: "ghost_m1", targetMaterialId: "mat_mountain_t1_normal_a", batches: 4 });
    expect(result.source.quantity).toBe(12);
    expect(result.target.quantity).toBe(4);
    expect(result.coins).toBe(400);
  });

  test("allows only same-family next-tier upgrades", () => {
    const result = previewTierUpgrade({ sourceMaterialId: "ghost_m1", targetMaterialId: "ghost_m2", batches: 2 });
    expect(result.source.quantity).toBe(10);
    expect(result.coins).toBe(600);
    expect(() => previewTierUpgrade({ sourceMaterialId: "ghost_m1", targetMaterialId: "mountain_m2", batches: 1 })).toThrow("same_family_required");
  });

  test("never allows boss materials into conversion", () => {
    expect(() => previewSameTierConversion({ sourceMaterialId: "mat_ghost_t1_mini_a", targetMaterialId: "ghost_m1", batches: 1 })).toThrow("normal_material_required");
  });
});
