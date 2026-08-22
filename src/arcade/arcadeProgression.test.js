import {
  ARCADE_PROFILE_SCHEMA_VERSION,
  PLAYER_MAX_LEVEL,
  getArcadePlayerStats,
  normalizeArcadeProfile,
  toggleArcadeCard,
  upgradeArcadeCard,
  upgradeArcadeEquipment,
  applyArcadeSettlement,
  applyPlayerXp,
} from "./arcadeProgression";

function legacy(overrides = {}) {
  return {
    visitorId: "v1", nickname: "測試", selectedCat: "haji", coins: 0,
    inventory: {}, statistics: {}, catLevel: 4, xp: 55, ...overrides,
  };
}

describe("arcadeProgression — 本機養成", () => {
  test("舊 catLevel/xp 遷移成 playerLevel/playerXp 且補齊新手裝備/卡片", () => {
    const p = normalizeArcadeProfile(legacy());
    expect(p.schemaVersion).toBe(ARCADE_PROFILE_SCHEMA_VERSION);
    expect(p.playerLevel).toBe(4);
    expect(p.playerXp).toBe(55);
    expect(p.equipment.weapon).toEqual({ itemId: "starter_bow", level: 0 });
    expect(p.equipment.armor.itemId).toBe("practice_guard");
    expect(p.equipment.accessory.itemId).toBe("cat_paw_charm");
    expect(Object.keys(p.cards.owned)).toEqual(expect.arrayContaining(["poison", "burn", "armor_break", "guard"]));
    expect(p.cards.equipped).toHaveLength(2);
  });

  test("Lv1→Lv30 的等級能力曲線正確，裝備再疊加其上", () => {
    const lv1 = getArcadePlayerStats(normalizeArcadeProfile(legacy({ catLevel: 1, xp: 0 })));
    expect(lv1.level).toBe(1);
    // 新手裝備本身提供少量能力；先扣掉裝備/卡片後基礎為 100/10/5。
    expect(lv1.maxHp - lv1.equipmentBonus.hp).toBe(100);
    expect(lv1.atk - lv1.equipmentBonus.atk).toBe(10);
    expect(lv1.def - lv1.equipmentBonus.def - lv1.cardBonus.def).toBe(5);

    const lv30 = getArcadePlayerStats(normalizeArcadeProfile(legacy({ catLevel: 30, xp: 0 })));
    expect(lv30.level).toBe(PLAYER_MAX_LEVEL);
    expect(lv30.maxHp - lv30.equipmentBonus.hp).toBe(245);
    expect(lv30.atk - lv30.equipmentBonus.atk).toBe(16);
    expect(lv30.def - lv30.equipmentBonus.def - lv30.cardBonus.def).toBe(11);
  });

  test("裝備第一次強化 80 金、100% 成功、最多 +5", () => {
    let p = normalizeArcadeProfile(legacy({ coins: 5000 }));
    const first = upgradeArcadeEquipment(p, "weapon");
    expect(first.ok).toBe(true);
    expect(first.cost).toBe(80);
    expect(first.updated.coins).toBe(4920);
    p = first.updated;
    for (let i = 1; i < 5; i += 1) p = upgradeArcadeEquipment(p, "weapon").updated;
    expect(p.equipment.weapon.level).toBe(5);
    expect(upgradeArcadeEquipment(p, "weapon").ok).toBe(false);
  });

  test("異常卡可用金幣強化到 Lv.3，最多裝備兩張", () => {
    let p = normalizeArcadeProfile(legacy({ coins: 1000 }));
    const lv2 = upgradeArcadeCard(p, "poison");
    expect(lv2.ok).toBe(true);
    expect(lv2.cost).toBe(60);
    expect(lv2.updated.cards.owned.poison.level).toBe(2);

    const lv3 = upgradeArcadeCard(lv2.updated, "poison");
    expect(lv3.ok).toBe(true);
    expect(lv3.cost).toBe(120);
    expect(lv3.updated.cards.owned.poison.level).toBe(3);
    expect(upgradeArcadeCard(lv3.updated, "poison").ok).toBe(false);

    p = lv3.updated;
    expect(toggleArcadeCard(p, "burn").ok).toBe(false);
    p = toggleArcadeCard(p, "guard").updated;
    const equipBurn = toggleArcadeCard(p, "burn");
    expect(equipBurn.ok).toBe(true);
    expect(equipBurn.updated.cards.equipped).toEqual(expect.arrayContaining(["poison", "burn"]));
    expect(equipBurn.updated.cards.equipped).toHaveLength(2);
  });

  test("升級獎勵金幣與道具保留在 updated，不會被舊 profile 蓋掉", () => {
    const p = normalizeArcadeProfile(legacy({ catLevel: 1, xp: 90, coins: 10 }));
    const r = applyPlayerXp(p, 20);
    expect(r.updated.playerLevel).toBe(2);
    expect(r.updated.playerXp).toBe(10);
    expect(r.updated.coins).toBe(110); // Lv2 +100 金
  });

  test("同一 settlement id 重播只結算一次，深淵再玩不會重複或吃掉已入帳金幣", () => {
    const p = normalizeArcadeProfile(legacy({ catLevel: 1, xp: 0, coins: 20 }));
    const settlement = { id: "abyss-run-1", coins: 300, xp: 80, stats: { battles: 1, kills: 3, bestFloor: 4 } };
    const first = applyArcadeSettlement(p, settlement);
    expect(first.updated.coins).toBe(320);
    expect(first.updated.statistics.battles).toBe(1);
    const replay = applyArcadeSettlement(first.updated, settlement);
    expect(replay.alreadySettled).toBe(true);
    expect(replay.updated.coins).toBe(320);
    expect(replay.updated.statistics.battles).toBe(1);
  });
});
