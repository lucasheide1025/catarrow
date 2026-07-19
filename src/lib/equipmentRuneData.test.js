import {
  EQUIPMENT_RUNE_TIERS, EQUIPMENT_RUNES,
  getEquipmentRuneBonus, getAllEquipmentRuneBonus, getNextEquipmentRune,
} from "./equipmentRuneData";

// 2026-07-19 使用者拍板：符文加成 = 階級 × 1%。
// 舊值 4/7/11/16% 太強（T4 貓靈等於三圍各 +16%），實測後壓成線性。
// 這組測試釘住曲線，避免日後又被調回高數值。
describe("符文加成曲線（階級 × 1%）", () => {
  test("四個階級分別是 1% / 2% / 3% / 4%", () => {
    expect(EQUIPMENT_RUNE_TIERS.map(tier => tier.bonus)).toEqual([0.01, 0.02, 0.03, 0.04]);
  });

  test("每一階都等於 tier × 1%", () => {
    EQUIPMENT_RUNE_TIERS.forEach(tier => {
      expect(tier.bonus).toBeCloseTo(tier.tier * 0.01, 10);
    });
  });

  test("最高階不超過 4%", () => {
    expect(Math.max(...EQUIPMENT_RUNE_TIERS.map(tier => tier.bonus))).toBeLessThanOrEqual(0.04);
  });
});

describe("符文加成計算", () => {
  test("單屬性符文只加對應屬性", () => {
    const bonus = getEquipmentRuneBonus(["equipment_atk_t4"]);
    expect(bonus.atk).toBeCloseTo(0.04, 10);
    expect(bonus.def).toBe(0);
    expect(bonus.hp).toBe(0);
  });

  // 貓靈符文 stat:"all"，三圍全加 —— 實質價值是單屬性符文的三倍，
  // 這也是舊數值下最容易失衡的一顆
  test("貓靈符文三圍都加同樣的比例", () => {
    const bonus = getEquipmentRuneBonus(["equipment_cat_t2"]);
    expect(bonus.atk).toBeCloseTo(0.02, 10);
    expect(bonus.def).toBeCloseTo(0.02, 10);
    expect(bonus.hp).toBeCloseTo(0.02, 10);
  });

  test("多顆符文會累加", () => {
    const bonus = getEquipmentRuneBonus(["equipment_atk_t1", "equipment_atk_t2", "equipment_cat_t1"]);
    expect(bonus.atk).toBeCloseTo(0.01 + 0.02 + 0.01, 10);
    expect(bonus.def).toBeCloseTo(0.01, 10);
  });

  test("跨裝備彙總", () => {
    const total = getAllEquipmentRuneBonus({
      weapon: { sockets: ["equipment_atk_t4"] },
      armor:  { sockets: ["equipment_def_t3", "equipment_cat_t1"] },
    });
    expect(total.atk).toBeCloseTo(0.04 + 0.01, 10);
    expect(total.def).toBeCloseTo(0.03 + 0.01, 10);
    expect(total.hp).toBeCloseTo(0.01, 10);
  });

  test("無效的符文 id 不影響計算", () => {
    const bonus = getEquipmentRuneBonus(["not_a_rune", null, "equipment_hp_t1"]);
    expect(bonus.hp).toBeCloseTo(0.01, 10);
    expect(bonus.atk).toBe(0);
  });
});

describe("符文合成鏈", () => {
  test("逐階往上，王級是終點", () => {
    expect(getNextEquipmentRune("equipment_atk_t1").id).toBe("equipment_atk_t2");
    expect(getNextEquipmentRune("equipment_atk_t3").id).toBe("equipment_atk_t4");
    expect(getNextEquipmentRune("equipment_atk_t4")).toBeNull();
  });

  test("四種符文各有四階，共 16 種", () => {
    expect(Object.keys(EQUIPMENT_RUNES)).toHaveLength(16);
  });
});
