import {
  isMonsterExpansionEnabled,
  syncMonsterExpansionFlagFromUrl,
  MONSTER_EXPANSION_FLAG_KEY,
} from "./monsterExpansionFeature";

afterEach(() => window.localStorage.removeItem(MONSTER_EXPANSION_FLAG_KEY));

// 2026-07-19：DLC 全面安裝，開關移除。這些測試守的是「再也關不掉」——
// 之前殘留的 localStorage "off" 會讓王房靜默退回舊表雜怪，很難查。
test("DLC 恆為啟用", () => {
  expect(isMonsterExpansionEnabled()).toBe(true);
});

test("殘留的 localStorage off 不再能關掉 DLC", () => {
  window.localStorage.setItem(MONSTER_EXPANSION_FLAG_KEY, "off");
  expect(isMonsterExpansionEnabled()).toBe(true);
});

test("?expansion=off 不再能關掉 DLC", () => {
  expect(syncMonsterExpansionFlagFromUrl("?expansion=off")).toBeNull();
  expect(isMonsterExpansionEnabled()).toBe(true);
});
