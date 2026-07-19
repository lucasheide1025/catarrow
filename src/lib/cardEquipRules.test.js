// 卡片系統改版（2026-07-19 使用者拍板）
// 1. HP 5 張、ATK/DEF 各 3 張，世界王卡獨立 3 張
// 2. 移除自選屬性，一律用卡片寫死的屬性
// 3. 新增族系剋制卡（對某族加傷 / 減傷）
import {
  MAX_EQUIPPED_BY_STAT, maxEquippedForStat, MAX_WB_EQUIPPED,
  getCardStat, calcEquippedBonus, getCardSlayerEffect, resolveFamilyModifiers,
  SLAYER_PCT_PER_STAR,
} from "./monsterCards";

describe("裝備上限依屬性分槽", () => {
  test("HP 5 張、ATK/DEF 各 3 張、世界王 3 張", () => {
    expect(MAX_EQUIPPED_BY_STAT).toEqual({ hp: 5, atk: 3, def: 3 });
    expect(maxEquippedForStat("hp")).toBe(5);
    expect(maxEquippedForStat("atk")).toBe(3);
    expect(maxEquippedForStat("def")).toBe(3);
    expect(MAX_WB_EQUIPPED).toBe(3);
  });
  test("未知屬性回退為 3，不會變成無限制", () => {
    expect(maxEquippedForStat("unknown")).toBe(3);
  });
});

describe("屬性一律寫死，忽略自選", () => {
  test("殘留的 chosenStat 不再影響結果", () => {
    // insect 族固定 hp；即使舊資料寫了 chosenStat: "atk" 也要維持 hp
    expect(getCardStat({ family: "insect", chosenStat: "atk" })).toBe("hp");
    expect(getCardStat({ family: "ghost", chosenStat: "def" })).toBe("atk");
  });
  test("世界王卡用卡片自身的 stat", () => {
    expect(getCardStat({ tier: "worldboss", stat: "def", family: "ghost" })).toBe("def");
  });
  test("加成計算也不受 chosenStat 影響", () => {
    const withChosen = calcEquippedBonus([{ family: "insect", tier: "common", stars: 1, chosenStat: "atk" }]);
    const without = calcEquippedBonus([{ family: "insect", tier: "common", stars: 1 }]);
    expect(withChosen.hp).toBe(without.hp);
    expect(withChosen.atk).toBe(0);
  });
});

describe("族系剋制卡", () => {
  const slayerCard = { family: "temple", tier: "elite", stars: 1, slayer: { targetFamily: "ghost", mode: "bonus" } };

  // 2026-07-19 改版：改用「現有卡片」做剋制，效果由族系相剋循環＋卡片屬性推導，
  // 不再需要每張卡另外寫 slayer 資料。世界王卡不參與（它們有自己的被動）。
  test("一般卡即使沒寫 slayer 也會依族系循環自動帶剋制效果", () => {
    const effect = getCardSlayerEffect({ family: "ghost", tier: "elite", stars: 1 });
    expect(effect).toMatchObject({ targetFamily: "exam", mode: "bonus" });
  });
  test("HP/DEF 卡是防禦型：對天敵減傷", () => {
    // 考試族是 def 卡，天敵是鬼怪族（鬼怪 → 考試）
    expect(getCardSlayerEffect({ family: "exam", tier: "elite", stars: 1 }))
      .toMatchObject({ targetFamily: "ghost", mode: "reduce" });
  });
  test("世界王卡不參與族系相剋", () => {
    expect(getCardSlayerEffect({ tier: "worldboss", stat: "atk", family: "ghost" })).toBeNull();
  });
  test("剋制強度隨星級成長", () => {
    const one = getCardSlayerEffect(slayerCard).pct;
    const three = getCardSlayerEffect({ ...slayerCard, stars: 3 }).pct;
    expect(three - one).toBe(SLAYER_PCT_PER_STAR * 2);
  });
  test("加傷與減傷分開累計", () => {
    const bonus = calcEquippedBonus([
      slayerCard,
      { family: "mountain", tier: "rare", stars: 1, slayer: { targetFamily: "ghost", mode: "reduce" } },
    ]);
    expect(bonus.familyDamageBonusPct.ghost).toBeGreaterThan(0);
    expect(bonus.familyDamageReducePct.ghost).toBeGreaterThan(0);
  });
  test("同族多張會疊加", () => {
    const single = calcEquippedBonus([slayerCard]).familyDamageBonusPct.ghost;
    const double = calcEquippedBonus([slayerCard, slayerCard]).familyDamageBonusPct.ghost;
    expect(double).toBe(single * 2);
  });
  test("只對指定族系生效，其他族為 0", () => {
    const bonus = calcEquippedBonus([slayerCard]);
    expect(resolveFamilyModifiers(bonus, "ghost").damageBonusPct).toBeGreaterThan(0);
    expect(resolveFamilyModifiers(bonus, "exam").damageBonusPct).toBe(0);
    expect(resolveFamilyModifiers(bonus, null)).toEqual({ damageBonusPct: 0, damageReducePct: 0 });
  });
  test("剋制卡本身仍提供原本的屬性加成", () => {
    expect(calcEquippedBonus([slayerCard]).hp).toBeGreaterThan(0); // temple → hp
  });
});
