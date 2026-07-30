import { BOARD_MODES, TILE_TYPES, rollTileReward } from "./boardData";

const mode = BOARD_MODES[0];

// 寶箱格改版（2026-07-30）：不再射 6 箭決定箱數，踩到就隨機 1~5 箱，
// 階級固定用進場選的 T（不再 rollTier 隨機降階）。
test("寶箱格不需要射箭", () => {
  expect(TILE_TYPES.chest.shooting).toBe(false);
});

test("寶箱格每次給 1~5 箱", () => {
  const counts = new Set();
  for (let i = 0; i < 400; i += 1) {
    const reward = rollTileReward("chest", { mode, tierCap: 5, tier: 3 });
    expect(reward.chests.length).toBeGreaterThanOrEqual(1);
    expect(reward.chests.length).toBeLessThanOrEqual(5);
    expect(reward.chestCount).toBe(reward.chests.length);
    counts.add(reward.chests.length);
  }
  // 400 次取樣應該把 1~5 都抽到
  expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
});

test("箱子階級一律等於進場選的 T，不會隨機降階", () => {
  for (const tier of [1, 2, 3, 4, 5]) {
    for (let i = 0; i < 60; i += 1) {
      const reward = rollTileReward("chest", { mode, tierCap: 5, tier });
      for (const chest of reward.chests) expect(chest.tier).toBe(tier);
    }
  }
});

test("選的 T 超過建築上限時仍受 tierCap 夾住", () => {
  const reward = rollTileReward("chest", { mode, tierCap: 2, tier: 6 });
  for (const chest of reward.chests) expect(chest.tier).toBe(2);
});

test("沒選 T 時退回建築上限", () => {
  const reward = rollTileReward("chest", { mode, tierCap: 4 });
  for (const chest of reward.chests) expect(chest.tier).toBe(4);
});

test("箱子只會是族系箱或通用箱，且族系正確", () => {
  for (let i = 0; i < 200; i += 1) {
    const reward = rollTileReward("chest", { mode, tierCap: 3, tier: 3 });
    for (const chest of reward.chests) {
      expect(["family", "universal"]).toContain(chest.kind);
      expect(chest.family).toBe(mode.family);
    }
  }
});
