// src/lib/councilMonsters.test.js
// 採集任務障礙（COUNCIL_MONSTERS）＋探索地圖怪物格選取（getObstacleForTier）測試。
import {
  COUNCIL_MONSTERS, TIER_ORDER, getObstacleForTier,
} from "./councilMonsters";

test("COUNCIL_MONSTERS 涵蓋七個採集點、每點六階、每階有完整欄位", () => {
  const ids = Object.keys(COUNCIL_MONSTERS);
  expect(ids).toEqual(expect.arrayContaining(["mine", "farm", "harbor", "hunting", "market", "warehouse", "archery"]));
  expect(ids).toHaveLength(7);   // 第七族（寶箱族 archery）補齊後不再缺組
  for (const group of Object.values(COUNCIL_MONSTERS)) {
    for (const tier of TIER_ORDER) {
      const o = group[tier];
      expect(o).toBeTruthy();
      expect(o.name).toBeTruthy();
      expect(o.emoji).toBeTruthy();
      expect(o.action).toBeTruthy();
      expect(o.bgColor).toMatch(/^#/);
    }
  }
});

test("getObstacleForTier：階級數字對應到正確的 tier 字串", () => {
  expect(getObstacleForTier("mine", 1)).toBe(COUNCIL_MONSTERS.mine.common);
  expect(getObstacleForTier("mine", 3)).toBe(COUNCIL_MONSTERS.mine.elite);
  expect(getObstacleForTier("mine", 6)).toBe(COUNCIL_MONSTERS.mine.mythic);
});

test("getObstacleForTier：階級超界夾在 1~6（防呆）", () => {
  expect(getObstacleForTier("mine", 0)).toBe(COUNCIL_MONSTERS.mine.common);    // 下限夾到 T1
  expect(getObstacleForTier("mine", 99)).toBe(COUNCIL_MONSTERS.mine.mythic);   // 上限夾到 T6
  expect(getObstacleForTier("mine")).toBe(COUNCIL_MONSTERS.mine.common);       // 沒給階級＝T1
});

test("getObstacleForTier：未知採集點回 null（UI 有守衛）", () => {
  expect(getObstacleForTier("no_such_site", 1)).toBeNull();
});

test("archery（寶箱族）補齊後探索地圖七張地圖都有怪物格可用", () => {
  const mapIds = ["mine", "farm", "harbor", "hunting", "market", "warehouse", "archery"];
  for (const id of mapIds) {
    for (let t = 1; t <= 6; t++) {
      expect(getObstacleForTier(id, t)).toBeTruthy();
    }
  }
});
