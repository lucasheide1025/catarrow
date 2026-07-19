import {
  BREAK_LEVELS,
  buildRoundSkillResult,
  calculateBreakRatio,
  getBreakOutcome,
  getBreakRuleText,
  makeCompanionResolutionKey,
  makeSkillResolutionKey,
  scoreToBreakQuality,
} from "./combatSkillEngine";

test("player-facing break instructions match resolver thresholds", () => {
  expect(getBreakRuleText()).toContain("85%");
  expect(getBreakRuleText()).toContain("70%");
  expect(getBreakRuleText()).toContain("50%");
  expect(getBreakOutcome(0.85).level).toBe("full");
  expect(getBreakOutcome(0.7).level).toBe("major");
  expect(getBreakOutcome(0.5).level).toBe("partial");
});
import {
  COMMON_MONSTER_ABILITIES,
  getAbilityValue,
  validateMonsterAbilityCatalog,
} from "./monsterAbilityCatalog";

test("the common ability catalog contains the confirmed twelve skills", () => {
  expect(validateMonsterAbilityCatalog()).toEqual({ ok: true, errors: [] });
  expect(Object.keys(COMMON_MONSTER_ABILITIES)).toHaveLength(12);
  expect(getAbilityValue("common_poison", 1)).toBe(2);
  expect(getAbilityValue("common_poison", 4)).toBe(3);
  expect(getAbilityValue("common_poison", 6)).toBe(4);
  expect(getAbilityValue("common_reflect", 2)).toBeNull();
});

test("score quality follows the confirmed cross-target normalization", () => {
  expect(["X", 10, 9, 8, 7, 6, 1, "M"].map(scoreToBreakQuality))
    .toEqual([1, 1, 0.9, 0.75, 0.55, 0.3, 0.3, 0]);
});

describe("破解品質按靶紙正規化（PRD 15/128,不寫死 10 分制）", () => {
  test("field_16（X、1-5環）：滿環 5＝完美品質,4 對應高分帶", () => {
    expect(scoreToBreakQuality("X", "field_16")).toBe(1);
    expect(scoreToBreakQuality(5, "field_16")).toBe(1);      // 修復前只有 0.3
    expect(scoreToBreakQuality(4, "field_16")).toBe(0.75);
    expect(scoreToBreakQuality(3, "field_16")).toBe(0.3);
    expect(scoreToBreakQuality(1, "field_16")).toBe(0.3);
    expect(scoreToBreakQuality("M", "field_16")).toBe(0);
    expect(scoreToBreakQuality(10, "field_16")).toBe(0);     // 超過該靶紙最大環＝非法
  });
  test("half_610 / 未知 id fallback 與 10 分制一致", () => {
    expect(scoreToBreakQuality(10, "half_610")).toBe(1);
    expect(scoreToBreakQuality(8, "half_610")).toBe(0.75);
    expect(scoreToBreakQuality(6, "half_610")).toBe(0.3);
    expect(scoreToBreakQuality(9, "not_a_format")).toBe(0.9); // fallback full_110
  });
  test("field_16 完全破解可達成（修復前幾乎不可能）", () => {
    const ratio = calculateBreakRatio([{ arrows: [5, 5, "X"] }], "field_16");
    expect(ratio).toBe(1);
    expect(getBreakOutcome(ratio)).toMatchObject({ level: BREAK_LEVELS.FULL, damageMultiplier: 0 });
  });
  test("buildRoundSkillResult 貫通 targetFmt：field_16 全滿環 → 0 傷害 0 異常", () => {
    const result = buildRoundSkillResult({
      battleId: "b", round: 2, monsterId: "ghost_1", skillId: "common_poison",
      submissions: [{ arrows: [5, 5, 4] }], baseDamage: 100,
      status: { id: "poison", strength: 4, duration: 2 },
      targetFmt: "field_16",
    });
    expect(result.breakRatio).toBeCloseTo((1 + 1 + 0.75) / 3); // ≈0.917 ≥0.85
    expect(result.damage).toBe(0);
    expect(result.status).toBeNull();
  });
  test("預設參數向後相容（未帶 targetFmt = full_110 行為不變）", () => {
    expect(calculateBreakRatio([{ arrows: [10, 9, 8] }])).toBeCloseTo((1 + 0.9 + 0.75) / 3);
  });
});

test("party break ratio excludes ineligible members from numerator and denominator", () => {
  const ratio = calculateBreakRatio([
    { memberId: "a", arrows: [10, 9, 8] },
    { memberId: "b", arrows: [7, 6, "M"] },
    { memberId: "gone", eligible: false, arrows: ["M", "M", "M"] },
  ]);
  expect(ratio).toBeCloseTo((1 + 0.9 + 0.75 + 0.55 + 0.3) / 6);
});

test("general and world-boss break rules share thresholds but keep distinct major reduction", () => {
  expect(getBreakOutcome(0.85)).toMatchObject({ level: BREAK_LEVELS.FULL, damageMultiplier: 0 });
  expect(getBreakOutcome(0.7)).toMatchObject({ level: BREAK_LEVELS.MAJOR, damageMultiplier: 0.35 });
  expect(getBreakOutcome(0.7, "worldBoss")).toMatchObject({ level: BREAK_LEVELS.MAJOR, damageMultiplier: 0.4 });
  expect(getBreakOutcome(0.5)).toMatchObject({ level: BREAK_LEVELS.PARTIAL, damageMultiplier: 0.7 });
  expect(getBreakOutcome(0.49)).toMatchObject({ level: BREAK_LEVELS.NONE, damageMultiplier: 1 });
});

test("a round result is deterministic and applies status reduction once", () => {
  const input = {
    battleId: "battle-1", round: 2, monsterId: "ghost_1", skillId: "sig_ghost_1",
    submissions: [{ arrows: [8, 7, 6] }], baseDamage: 100,
    status: { id: "atk_down", strength: 10, duration: 2 },
  };
  expect(buildRoundSkillResult(input)).toEqual(buildRoundSkillResult(input));
  expect(buildRoundSkillResult(input)).toMatchObject({
    ok: true,
    resolvedKey: "battle-1:2:ghost_1:sig_ghost_1",
    damage: 70,
    status: { id: "atk_down", strength: 5, duration: 1 },
  });
});

test("resolution keys reject incomplete identity and remain stable", () => {
  expect(makeSkillResolutionKey({ battleId: "b", round: 2, monsterId: "m", skillId: "s" })).toBe("b:2:m:s");
  expect(makeCompanionResolutionKey({ battleId: "b", round: 2, memberId: "u", companionId: "c" })).toBe("b:2:u:c");
  expect(makeSkillResolutionKey({ battleId: "b", round: 0, monsterId: "m", skillId: "s" })).toBeNull();
});
