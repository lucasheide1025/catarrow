import { applySoloStatusTick, getStatusDurationCap, mergeCombatStatus, resolveSoloMonsterAbility } from "./soloMonsterAbilityEngine";
import { EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";

describe("status duration tier caps（PRD 46：T1-2=1 / T3-4=2 / T5-6=3）", () => {
  test("依 tierIndex 回傳持續回合上限", () => {
    expect([1, 2, 3, 4, 5, 6].map(getStatusDurationCap)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe("targetFmt 貫通 adapter（破解品質按靶紙正規化）", () => {
  const monster = EXPANSION_MONSTER_BY_ID.ghost_t1_normal_b; // R4 = common_weaken
  test("field_16 滿環(5,5,X) → 完全破解,異常取消", () => {
    const result = resolveSoloMonsterAbility({ battleId: "bf", monster, round: 4, arrows: [5, 5, "X"], targetFmt: "field_16" });
    expect(result.resolved.outcome.level).toBe("full");
    expect(result.resolved.status).toBeNull();
  });
  test("同樣的 5,5,X 若誤用預設 full_110 → 破解失敗,異常全額生效（回歸保護:接線必須帶 targetFmt）", () => {
    const result = resolveSoloMonsterAbility({ battleId: "bg", monster, round: 4, arrows: [5, 5, "X"] });
    expect(result.resolved.outcome.level).not.toBe("full");
    expect(result.resolved.status).not.toBeNull();
  });
});

describe("solo monster ability vertical slice", () => {
  test.each([
    ["common_charge", "skillDamageMult"],
    ["common_armor", "selfReductionPct"],
    ["common_heal", "monsterHealMaxHpPct"],
    ["common_rage", "skillDamageMult"],
    ["common_weakpoint", "hqMarkPct"],
    ["common_cleanse", "selfCleanseCount"],
    ["common_stance", "selfReductionPct"],
    ["common_reflect", "selfReflectPct"],
    ["common_regen", "monsterHealMaxHpPct"],
  ])("scheduled common ability %s produces a concrete effect", (skillId, effectKey) => {
    const result = resolveSoloMonsterAbility({
      battleId: `common-${skillId}`,
      monster: { id:`m-${skillId}`, encounter:"normal", tierIndex:5, signatureSkillId:"unused", commonSkillIds:[skillId] },
      round:4,
      arrows:["M", "M", "M"],
    });
    expect(result.reason).toBeUndefined();
    expect(result.resolved?.[effectKey]).toBeDefined();
  });

  test("fully breaking a scheduled debuff cancels its status", () => {
    const monster = EXPANSION_MONSTER_BY_ID.ghost_t1_normal_b;
    const result = resolveSoloMonsterAbility({ battleId: "b1", monster, round: 4, arrows: [10, 10, 10] });
    expect(result.scheduled).toMatchObject({ skillId: "common_weaken" });
    expect(result.resolved.status).toBeNull();
  });

  test("partial break halves status strength but keeps at least one round", () => {
    const monster = EXPANSION_MONSTER_BY_ID.ghost_3;
    const result = resolveSoloMonsterAbility({ battleId: "b2", monster, round: 4, arrows: [7, 7, 7] });
    expect(result.resolved.outcome.level).toBe("partial");
    expect(result.resolved.status).toMatchObject({ id: "poison", duration: 1, strength: 1.5 });
  });

  test("same statuses refresh instead of stacking and different statuses cap at three", () => {
    const poison = { id: "poison", strength: 2, duration: 1 };
    expect(mergeCombatStatus([poison], { id: "poison", strength: 1, duration: 3 })).toEqual([{ id: "poison", strength: 2, duration: 3 }]);
    const full = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(mergeCombatStatus(full, { id: "d" })).toEqual(full);
  });

  test("poison cannot defeat the player", () => {
    expect(applySoloStatusTick({ status: { id: "poison", strength: 4, duration: 1 }, playerHp: 2, playerMaxHp: 100 }))
      .toEqual({ playerHp: 1, status: null, damage: 1 });
  });
});
