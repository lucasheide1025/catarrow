import { EXPANSION_MONSTER_BY_ID } from "../../lib/monsterExpansionCatalog";
import {
  PROMOTION_TRIALS,
  availablePromotionTrial,
  completePromotionTrial,
} from "./guildPromotion";
import { emptyGuildProfile } from "./guildRewards";

describe("公會晉升試煉", () => {
  test("每個試煉都使用現有怪物且有固定陣容", () => {
    for (const trial of Object.values(PROMOTION_TRIALS)) {
      expect(trial.fixedWaves.length).toBeGreaterThan(0);
      for (const wave of trial.fixedWaves) {
        expect(wave.length).toBeGreaterThan(0);
        for (const monsterId of wave) {
          expect(EXPANSION_MONSTER_BY_ID[monsterId]).toBeTruthy();
        }
      }
    }
  });

  test("聲望達標後才會提供下一階試煉", () => {
    expect(
      availablePromotionTrial({
        ...emptyGuildProfile(),
        rankId: "apprentice",
        rep: 99,
      })
    ).toBeNull();

    expect(
      availablePromotionTrial({
        ...emptyGuildProfile(),
        rankId: "apprentice",
        rep: 100,
      }).targetRankId
    ).toBe("bronze");
  });

  test("通關只升一階且保留既有資源", () => {
    const before = {
      ...emptyGuildProfile(),
      rankId: "apprentice",
      rep: 100,
      catCoins: 77,
    };
    const result = completePromotionTrial(before, "bronze");
    expect(result.ok).toBe(true);
    expect(result.profile.rankId).toBe("bronze");
    expect(result.profile.catCoins).toBe(77);
  });
});
