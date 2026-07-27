import {
  accrueBuildingProduction,
  buildingConstructionMs,
  claimBuildingProduction,
  finishConstruction,
  maxBuildingLevelForRank,
  startConstruction,
  supplyCapacity,
  weeklyProduction,
} from "./guildBuildings";
import { emptyGuildProfile } from "./guildRewards";

const WEEK = 7 * 24 * 60 * 60 * 1000;

describe("公會領地建築", () => {
  test("倉庫容量依 20 級曲線成長", () => {
    expect(supplyCapacity(emptyGuildProfile())).toBe(36);
    expect(
      supplyCapacity({
        ...emptyGuildProfile(),
        buildings: { warehouse: 20, farm: 0, waterStation: 0 },
      })
    ).toBe(156);
  });

  test("農地與供水站按真實時間累積低量產出", () => {
    const profile = {
      ...emptyGuildProfile(),
      buildings: { warehouse: 2, farm: 2, waterStation: 1 },
      production: { lastAt: 1000, food: 0, water: 0 },
    };
    const next = accrueBuildingProduction(profile, 1000 + WEEK);
    expect(weeklyProduction(profile, "food")).toBe(3);
    expect(next.production.food).toBeCloseTo(3);
    expect(next.production.water).toBeCloseTo(2);
  });

  test("收成不會超過倉庫容量", () => {
    const profile = {
      ...emptyGuildProfile(),
      supplyStock: { food: 34, water: 0 },
      production: { lastAt: 1000, food: 10.5, water: 0 },
    };
    const result = claimBuildingProduction(profile, 1000);
    expect(result.food).toBe(2);
    expect(result.profile.supplyStock.food).toBe(36);
    expect(result.profile.production.food).toBeCloseTo(8.5);
  });

  test("升級先扣 CAT 並施工，完工後才套用新等級", () => {
    const startedAt = Date.UTC(2026, 0, 1);
    const result = startConstruction(
      {
        ...emptyGuildProfile(),
        rankId: "apprentice",
        catCoins: 999,
        buildings: { warehouse: 1, farm: 1, waterStation: 1 },
      },
      "farm",
      startedAt
    );

    expect(result.ok).toBe(true);
    expect(result.profile.buildings.farm).toBe(1);
    expect(result.profile.catCoins).toBeLessThan(999);
    expect(result.profile.construction.buildingId).toBe("farm");

    const finished = finishConstruction(
      result.profile,
      startedAt + buildingConstructionMs(2)
    );
    expect(finished.ok).toBe(true);
    expect(finished.profile.buildings.farm).toBe(2);
    expect(finished.profile.construction).toBeNull();
  });

  test("20 級施工時間與公會階級上限生效", () => {
    expect(maxBuildingLevelForRank("apprentice")).toBe(4);
    expect(maxBuildingLevelForRank("legend")).toBe(20);
    expect(buildingConstructionMs(20)).toBe(90 * 24 * 60 * 60 * 1000);

    const result = startConstruction(
      {
        ...emptyGuildProfile(),
        rankId: "apprentice",
        catCoins: 9999,
        buildings: { warehouse: 4, farm: 1, waterStation: 1 },
      },
      "warehouse",
      0
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Lv4/);
  });
});
