import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { getNormalMaterialPool } from "./monsterEconomyCatalog";
import { BOARD_MODES } from "./boardData";
import {
  GATHERING_SITES,
  GATHERING_SITE_MAP,
  getGatheringMaterialPool,
  rollGatheringMaterials,
} from "./catVillageGathering";

const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"];

// 依序輪流的假隨機，讓分配結果可預期
function cyclingRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("採集點共七個，第七個是寶箱族且對應練箭場", () => {
  expect(GATHERING_SITES).toHaveLength(7);
  const archery = GATHERING_SITE_MAP.archery;
  expect(archery).toBeTruthy();
  expect(archery.race).toBe("treasure");
  expect(archery.buildingName).toBe("練箭場");
  // 採集點等級是用 buildings[site.id] 查的，id 必須等於建築 id 才會吃到練箭場等級
  expect(archery.id).toBe("archery");
});

test("每個採集點的族系都不重複，七族各一", () => {
  const races = GATHERING_SITES.map(site => site.race);
  expect(new Set(races).size).toBe(7);
  expect(races.sort()).toEqual([...FAMILIES].sort());
});

test("T{n} 的素材池是 T1～T{n} 累積，每階 3 件", () => {
  for (const family of FAMILIES) {
    for (let tier = 1; tier <= 6; tier += 1) {
      const pool = getGatheringMaterialPool(family, tier);
      expect(pool).toHaveLength(tier * 3);
      expect(Math.max(...pool.map(item => item.tierIndex))).toBe(tier);
      expect(Math.min(...pool.map(item => item.tierIndex))).toBe(1);
    }
  }
});

test("素材池不含小王與大王素材", () => {
  const bossMaterialIds = new Set(
    EXPANSION_MONSTERS.filter(m => m.encounter !== "normal").map(m => m.material.id),
  );
  expect(bossMaterialIds.size).toBe(7 * 6 * 3); // 每族每階 2 小王 + 1 大王
  for (const family of FAMILIES) {
    for (const item of getGatheringMaterialPool(family, 6)) {
      expect(bossMaterialIds.has(item.materialId)).toBe(false);
    }
  }
});

test("池中每個素材 id 都真的存在於擴充圖鑑", () => {
  const known = new Set(EXPANSION_MONSTERS.map(m => m.material.id));
  for (const family of FAMILIES) {
    for (const item of getGatheringMaterialPool(family, 6)) {
      expect(known.has(item.materialId)).toBe(true);
      expect(typeof item.name).toBe("string");
      expect(item.name.length).toBeGreaterThan(0);
    }
  }
});

test("隨機分配的總數等於指定數量，不會膨脹或縮水", () => {
  for (const total of [1, 5, 12, 40]) {
    const rolled = rollGatheringMaterials({
      race: "treasure", tierNo: 4, totalCount: total, random: cyclingRandom([0.05, 0.4, 0.75, 0.95]),
    });
    expect(rolled.reduce((sum, item) => sum + item.count, 0)).toBe(total);
    for (const item of rolled) expect(item.count).toBeGreaterThan(0);
  }
});

test("分配結果不會出現高於當前 tier 的素材", () => {
  const rolled = rollGatheringMaterials({
    race: "exam", tierNo: 2, totalCount: 60, random: cyclingRandom([0.01, 0.3, 0.55, 0.8, 0.99]),
  });
  expect(rolled.length).toBeGreaterThan(0);
  for (const item of rolled) expect(item.tierIndex).toBeLessThanOrEqual(2);
});

test("低階素材權重較高：大量取樣下 T1 總數多於最高階", () => {
  let seed = 1;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const rolled = rollGatheringMaterials({ race: "ghost", tierNo: 3, totalCount: 900, random });
  const sum = tier => rolled.filter(i => i.tierIndex === tier).reduce((s, i) => s + i.count, 0);
  expect(sum(1)).toBeGreaterThan(sum(3));
});

test("數量為 0 或族系不存在時回空陣列，不丟例外", () => {
  expect(rollGatheringMaterials({ race: "treasure", tierNo: 3, totalCount: 0 })).toEqual([]);
  expect(rollGatheringMaterials({ race: "不存在", tierNo: 3, totalCount: 5 })).toEqual([]);
  expect(getGatheringMaterialPool("不存在", 3)).toEqual([]);
});

// BOARD_MODES 是從 GATHERING_SITES 衍生的（boardData.js），新增第七族後大富翁也會多一個模式。
// villageBoardDb 原本組舊表 id `${family}_m${tier}`，舊表沒有寶箱族，會發出不存在的素材。
test("大富翁模式與採集點一致，且每個模式的族系都取得到一般素材", () => {
  expect(BOARD_MODES).toHaveLength(GATHERING_SITES.length);
  expect(BOARD_MODES.map(m => m.id)).toEqual(GATHERING_SITES.map(s => s.id));
  for (const mode of BOARD_MODES) {
    for (let tier = 1; tier <= 6; tier += 1) {
      const pool = getNormalMaterialPool({ family: mode.family, exactTier: tier });
      expect(pool).toHaveLength(3);
      for (const item of pool) expect(item.kind).toBe("normal");
    }
  }
});
