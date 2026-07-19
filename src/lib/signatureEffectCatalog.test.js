// src/lib/signatureEffectCatalog.test.js — 252 招牌結構化完整性（PRD 33-34/72）
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import {
  SIGNATURE_EFFECTS, getSignatureEffect, parseSignatureSegment, validateSignatureEffects,
  TIER_SKILL_ATK_MULT,
} from "./signatureEffectCatalog";

test("252 招牌全部解析成 1~3 積木,基準與遭遇類型一致", () => {
  const v = validateSignatureEffects();
  expect(v.problems).toEqual([]);
  expect(v.ok).toBe(true);
  expect(Object.keys(SIGNATURE_EFFECTS)).toHaveLength(252);
});

test("片段解析抽查：多段/穿甲/延遲/挑戰/自身效果", () => {
  expect(parseSignatureSegment("2段攻擊，總倍率=小王基準×1.05"))
    .toEqual({ type: "damage", hits: 2, baseKind: "miniBoss", mult: 1.05, pierceDefPct: 0, pierceShieldPct: 0 });
  expect(parseSignatureSegment("小王基準，無視防禦10%"))
    .toMatchObject({ type: "damage", hits: 1, baseKind: "miniBoss", pierceDefPct: 10 });
  expect(parseSignatureSegment("延遲攻擊大王基準×0.5"))
    .toEqual({ type: "delayedBurst", baseKind: "boss", mult: 0.5 });
  expect(parseSignatureSegment("命中後玩家 ATK-5% 1回合"))
    .toMatchObject({ type: "playerStatus", id: "atkDown", strength: 5, duration: 1 });
  expect(parseSignatureSegment("最大HP 2%毒傷1回合"))
    .toMatchObject({ type: "playerStatus", id: "poison", unit: "maxHpPct", strength: 2 });
  expect(parseSignatureSegment("自身護盾=最大HP 5%")).toEqual({ type: "selfShield", maxHpPct: 5 });
  expect(parseSignatureSegment("減傷15% 1回合")).toEqual({ type: "selfReduction", pct: 15, duration: 1 });
  expect(parseSignatureSegment("指定9分以上挑戰")).toEqual({ type: "challenge", minScore: 9 });
  expect(parseSignatureSegment("較低的玩家ATK或DEF再-8% 1回合"))
    .toMatchObject({ type: "playerStatus", id: "lowerStatDown", strength: 8 });
});

test("已知招牌樣本結構正確", () => {
  // 提燈小靈：基準×0.9;命中後玩家 ATK-5% 1回合
  const lantern = getSignatureEffect("sig_ghost_t1_normal_a");
  expect(lantern.blocks).toEqual([
    { type: "damage", hits: 1, baseKind: "normal", mult: 0.9, pierceDefPct: 0, pierceShieldPct: 0 },
    { type: "playerStatus", id: "atkDown", stat: "atk", unit: "pct", strength: 5, duration: 1 },
  ]);
  // 城隍判令（ghost_4）：基準＋指定9分以上挑戰;完成則本回合玩家傷害+10%
  const judge = getSignatureEffect("sig_ghost_4");
  const challenge = judge.blocks.find(b => b.type === "challenge");
  expect(challenge).toMatchObject({ minScore: 9, onSuccessDamageBuffPct: 10 });
});

test("Tier 數值帶完整（T1-T6 × 三種遭遇）", () => {
  for (let tier = 1; tier <= 6; tier += 1) {
    expect(TIER_SKILL_ATK_MULT[tier].normal).toBeGreaterThan(1);
    expect(TIER_SKILL_ATK_MULT[tier].miniBoss).toBeGreaterThan(TIER_SKILL_ATK_MULT[tier].normal);
    expect(TIER_SKILL_ATK_MULT[tier].boss).toBeGreaterThan(TIER_SKILL_ATK_MULT[tier].miniBoss);
  }
  expect(EXPANSION_MONSTERS).toHaveLength(252);
});
