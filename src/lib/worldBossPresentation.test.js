import { worldBossWeaponLabel } from "./worldBossPresentation";

describe("worldBossWeaponLabel", () => {
  test("優先顯示玩家設定的弓組名稱", () => {
    expect(worldBossWeaponLabel(
      { equipment:[{ id:"eq-1", label:"我的橘色反曲弓" }] },
      "m1",
      { bowId:"eq-1", bowType:"recurve_bare" },
    ))
      .toBe("我的橘色反曲弓");
  });

  test("找不到指定弓組時顯示目前設定的弓種", () => {
    expect(worldBossWeaponLabel(
      { equipment:[] },
      "m1",
      { bowId:"missing", bowType:"recurve_bare" },
    )).toBe("裸弓");
  });
});
