import {
  accrueBuildingProduction,
  buildingConstructionMs,
  claimBuildingProduction,
  finishConstruction,
  maxBuildingLevelForRank,
  startConstruction,
  supplyCapacity,
  weeklyProduction
} from "./guildBuildings";
import { emptyGuildProfile } from "./guildRewards";

const WEEK = 7 * 24 * 60 * 60 * 1000;

describe("公會領地建築", () => {
  // 驗曲線性質而不是硬編數字：平衡調整（2026-07-30 上調過一次）不該一改就紅。
  test("倉庫容量隨等級單調成長，滿級遠大於初始", () => {
    const capAt = warehouse => supplyCapacity({
      ...emptyGuildProfile(), buildings: { warehouse, farm: 0, waterStation: 0 },
    });
    let prev = -1;
    for (let lv = 0; lv <= 20; lv += 1) {
      const cap = capAt(lv);
      expect(cap).toBeGreaterThan(prev);
      prev = cap;
    }
    expect(capAt(20)).toBeGreaterThan(capAt(0) * 3);
    expect(supplyCapacity(emptyGuildProfile())).toBe(capAt(0));
  });

  test("農地與供水站按真實時間累積低量產出", () => {
    const profile = {
      ...emptyGuildProfile(),
      buildings: { warehouse: 2, farm: 2, waterStation: 1 },
      production: { lastAt: 1000, food: 0, water: 0 },
    };
    const next = accrueBuildingProduction(profile, 1000 + WEEK);
    // 一週後累積的量＝該等級的週產量（等級越高產越多，且農地 2 級 > 供水站 1 級）
    const foodRate = weeklyProduction(profile, "food");
    const waterRate = weeklyProduction(profile, "water");
    expect(foodRate).toBeGreaterThan(waterRate);
    expect(next.production.food).toBeCloseTo(foodRate);
    expect(next.production.water).toBeCloseTo(waterRate);
  });

  test("收成不會超過倉庫容量", () => {
    const cap = supplyCapacity(emptyGuildProfile());
    const profile = {
      ...emptyGuildProfile(),
      supplyStock: { food: cap - 2, water: 0 },      // 只差 2 就滿
      production: { lastAt: 1000, food: 10.5, water: 0 },
    };
    const result = claimBuildingProduction(profile, 1000);
    expect(result.food).toBe(2);                     // 只收得下 2
    expect(result.profile.supplyStock.food).toBe(cap);
    expect(result.profile.production.food).toBeCloseTo(8.5);   // 其餘留在待收成
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

describe("補給供應上調（2026-07-30）", () => {
  test("週產量隨等級單調成長，滿級足以支撐多趟遠征", () => {
    const rate = farm => weeklyProduction({
      ...emptyGuildProfile(), buildings: { warehouse: 0, farm, waterStation: 0 },
    }, "food");
    let prev = -1;
    for (let lv = 0; lv <= 20; lv += 1) {
      expect(rate(lv)).toBeGreaterThan(prev);
      prev = rate(lv);
    }
    // 一趟遠征大約吃 10~20 份；滿級週產量至少要能跑三趟，領地才有回饋感
    expect(rate(20)).toBeGreaterThanOrEqual(60);
    expect(rate(1)).toBeGreaterThanOrEqual(5);   // 早期就感覺得到
  });

  test("倉庫容量跟得上產量，不會蓋了農地卻一直溢出", () => {
    const capAt = warehouse => supplyCapacity({
      ...emptyGuildProfile(), buildings: { warehouse, farm: 0, waterStation: 0 },
    });
    const rateAt = farm => weeklyProduction({
      ...emptyGuildProfile(), buildings: { warehouse: 0, farm, waterStation: 0 },
    }, "food");
    // 同等級下，倉庫至少裝得下兩週的食物＋水
    for (const lv of [1, 5, 10, 15, 20]) {
      expect(capAt(lv)).toBeGreaterThanOrEqual(rateAt(lv) * 2);
    }
  });
});
