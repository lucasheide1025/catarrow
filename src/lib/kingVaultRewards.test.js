import { rollKingVaultReward } from "./kingVaultRewards";
import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";

describe("king vault current material catalog", () => {
  test("default treasure vault draws current treasure-family exact-tier materials", () => {
    const reward = rollKingVaultReward(4);
    expect(reward.materials.length).toBeGreaterThan(0);
    const validIds = new Set(EXPANSION_MATERIALS
      .filter(material => material.family === "treasure" && material.tierIndex === 4)
      .map(material => material.id));
    expect(reward.materials.every(material => validIds.has(material.id))).toBe(true);
  });

  test("unknown family falls back to current exact-tier materials", () => {
    const reward = rollKingVaultReward(2, "unknown_family");
    expect(reward.materials.length).toBeGreaterThan(0);
    const validIds = new Set(EXPANSION_MATERIALS
      .filter(material => material.tierIndex === 2)
      .map(material => material.id));
    expect(reward.materials.every(material => validIds.has(material.id))).toBe(true);
  });
});
