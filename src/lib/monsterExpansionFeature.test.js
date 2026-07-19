import {
  isMonsterExpansionEnabled,
  syncMonsterExpansionFlagFromUrl,
  MONSTER_EXPANSION_FLAG_KEY,
} from "./monsterExpansionFeature";

afterEach(() => window.localStorage.removeItem(MONSTER_EXPANSION_FLAG_KEY));

test("DLC 預設啟用（2026-07-19 全面開放）", () => {
  expect(isMonsterExpansionEnabled()).toBe(true);
  expect(MONSTER_EXPANSION_FLAG_KEY).toBe("monsterExpansionV1");
});

test("仍可用 localStorage 個別關閉（出事時的逃生門）", () => {
  window.localStorage.setItem(MONSTER_EXPANSION_FLAG_KEY, "off");
  expect(isMonsterExpansionEnabled()).toBe(false);
  window.localStorage.removeItem(MONSTER_EXPANSION_FLAG_KEY);
});

describe("網址參數開關（手機測試用）", () => {
  test("?expansion=on 會開啟並寫入 localStorage（下次不帶參數也維持開啟）", () => {
    expect(syncMonsterExpansionFlagFromUrl("?expansion=on")).toBe("on");
    expect(isMonsterExpansionEnabled()).toBe(true);
    expect(window.localStorage.getItem(MONSTER_EXPANSION_FLAG_KEY)).toBe("on");
  });

  test("?expansion=off 會關閉（提供測試者自行關掉的方法）", () => {
    syncMonsterExpansionFlagFromUrl("?expansion=on");
    expect(syncMonsterExpansionFlagFromUrl("?expansion=off")).toBe("off");
    expect(isMonsterExpansionEnabled()).toBe(false);
  });

  test("沒有參數或值不合法時不動既有設定", () => {
    syncMonsterExpansionFlagFromUrl("?expansion=on");
    expect(syncMonsterExpansionFlagFromUrl("?foo=bar")).toBeNull();
    expect(syncMonsterExpansionFlagFromUrl("?expansion=yes")).toBeNull();
    expect(isMonsterExpansionEnabled()).toBe(true);
  });

  test("與其他參數並存時仍可解析（例如訪客連結）", () => {
    expect(syncMonsterExpansionFlagFromUrl("?guest=ABC&expansion=on")).toBe("on");
    expect(isMonsterExpansionEnabled()).toBe(true);
  });
});
