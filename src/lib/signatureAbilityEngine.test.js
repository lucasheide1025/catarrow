// src/lib/signatureAbilityEngine.test.js — 招牌共用 resolver（PRD 33-34/44/51）
import { resolveSignatureAbility, SIGNATURE_ENHANCED_MULT } from "./signatureAbilityEngine";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { mergeCombatStatus, resolveSoloMonsterAbility } from "./soloMonsterAbilityEngine";

const byId = Object.fromEntries(EXPANSION_MONSTERS.map(m => [m.id, m]));
const solo = arrows => ({ submissions: [{ eligible: true, arrows }] });

// 提燈小靈（T1 一般）：基準×0.9＋ATK-5% 1回合;Tier 帶 normal=1.05
const lantern = byId.ghost_t1_normal_a;

test("未破解（<50%）：全額倍率與異常", () => {
  const r = resolveSignatureAbility({ battleId: "b1", round: 2, monster: lantern, ...solo(["M", "M", "M"]) });
  expect(r.ok).toBe(true);
  expect(r.skillDamageMult).toBeCloseTo(1.05 * 0.9, 3);
  expect(r.statuses).toHaveLength(1);
  expect(r.statuses[0]).toMatchObject({ id: "atkDown", strength: 5, duration: 1 });
  expect(r.status).toEqual(r.statuses[0]); // 相容欄位
});

test("70-84% 破解：傷害×0.35、異常取消;≥85% 全免", () => {
  const major = resolveSignatureAbility({ battleId: "b1", round: 2, monster: lantern, ...solo([10, 9, 7]) });
  expect(major.skillDamageMult).toBeCloseTo(1.05 * 0.9 * 0.35, 3);
  expect(major.statuses).toHaveLength(0);
  const full = resolveSignatureAbility({ battleId: "b1", round: 2, monster: lantern, ...solo(["X", 10, 10]) });
  expect(full.skillDamageMult).toBe(0);
});

test("多段＋穿甲：小王 2段/無視防禦10%,部分破解穿甲減半", () => {
  const mini = byId.ghost_t1_mini_a; // 導光突進：小王基準,無視防禦10%
  const none = resolveSignatureAbility({ battleId: "b1", round: 2, monster: mini, ...solo([1, 1, 1]) });
  expect(none.pierceDefPct).toBe(10);
  const partial = resolveSignatureAbility({ battleId: "b1", round: 2, monster: mini, ...solo([8, 7, 6]) });
  expect(partial.pierceDefPct).toBe(5); // ×0.5
});

test("自身護盾：未破解全額,≥70% 取消（PRD 部分破解同步降低）", () => {
  const ghost1 = byId.ghost_1; // 供品分享：無傷害;自身護盾=最大HP 5%
  const none = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost1, ...solo([1, 1, 1]) });
  expect(none.skillDamageMult).toBe(0); // 無傷害積木
  expect(none.selfShieldMaxHpPct).toBe(5);
  const major = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost1, ...solo([10, 9, 7]) });
  expect(major.selfShieldMaxHpPct).toBe(0);
});

test("延遲攻擊：倍率含破解減幅,完全破解=0", () => {
  const ghost6 = byId.ghost_6; // 地府輪迴：基準＋延遲攻擊基準×0.5
  const none = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost6, ...solo([1, 1, 1]) });
  expect(none.delayedMult).toBeCloseTo(1.22 * 0.5, 3); // T6 normal 1.22
  const full = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost6, ...solo(["X", "X", "X"]) });
  expect(full.delayedMult).toBe(0);
});

test("挑戰：達標箭數過半即完成 → 傷害加成;未完成套 onFail（若有）", () => {
  const ghost4 = byId.ghost_4; // 城隍判令：9分以上箭數達一半;完成則玩家傷害+10%
  const pass = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost4, ...solo([9, 10, 1]) });
  expect(pass.challenge).toMatchObject({ minScore: 9, success: true, damageBuffPct: 10 });
  const fail = resolveSignatureAbility({ battleId: "b1", round: 2, monster: ghost4, ...solo([8, 8, 8]) });
  expect(fail.challenge.success).toBe(false);
  expect(fail.challenge.damageBuffPct).toBe(0);
});

test("大王 R6 招牌強化版倍率", () => {
  const boss = byId.ghost_t1_boss; // 鎮界光陣：大王基準＋自身護盾5%
  const normal = resolveSignatureAbility({ battleId: "b1", round: 2, monster: boss, ...solo([1, 1, 1]) });
  const enhanced = resolveSignatureAbility({ battleId: "b1", round: 6, monster: boss, ...solo([1, 1, 1]), enhanced: true });
  expect(enhanced.skillDamageMult).toBeCloseTo(normal.skillDamageMult * SIGNATURE_ENHANCED_MULT, 3);
});

test("solo 引擎招牌回合直接回結構化結果（不再回 not_structured）", () => {
  const r = resolveSoloMonsterAbility({ battleId: "b1", monster: lantern, round: 2, arrows: ["M", "M", "M"] });
  expect(r.resolved).not.toBeNull();
  expect(r.resolved.skillId).toBe("sig_ghost_t1_normal_a");
  expect(r.reason).toBeUndefined();
});

test("PRD 54：大王階段被動 70%/40%（護盾疊加/技能傷害加成;不觸發不生效）", () => {
  const boss = byId.ghost_t1_boss; // 鎮界光陣：大王基準＋自身護盾5%;70% HP護盾量+2%,40% HP技能傷害+5%
  const healthy = resolveSignatureAbility({ battleId: "b1", round: 2, monster: boss, ...solo([1, 1, 1]), monsterHpRatio: 0.9 });
  expect(healthy.selfShieldMaxHpPct).toBe(5);
  const wounded = resolveSignatureAbility({ battleId: "b1", round: 2, monster: boss, ...solo([1, 1, 1]), monsterHpRatio: 0.6 });
  expect(wounded.selfShieldMaxHpPct).toBe(7); // +2
  const desperate = resolveSignatureAbility({ battleId: "b1", round: 2, monster: boss, ...solo([1, 1, 1]), monsterHpRatio: 0.35 });
  expect(desperate.selfShieldMaxHpPct).toBe(7);
  expect(desperate.skillDamageMult).toBeCloseTo(healthy.skillDamageMult * 1.05, 3); // 40%: 技能傷害+5%
});

test("42 隻大王階段被動全部解析", () => {
  const bosses = EXPANSION_MONSTERS.filter(m => m.encounter === "boss");
  expect(bosses).toHaveLength(42);
  for (const boss of bosses) {
    const r = resolveSignatureAbility({ battleId: "b1", round: 2, monster: boss, ...solo([1, 1, 1]), monsterHpRatio: 0.3 });
    expect({ id: boss.id, ok: r.ok }).toEqual({ id: boss.id, ok: true });
    const total = Object.values(r.phaseMods).reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(0); // 兩段被動皆已生效
  }
});

test("PRD 51：同能力總減幅上限 40%（跨異常 clamp）", () => {
  let statuses = mergeCombatStatus([], { id: "atkDown", stat: "atk", unit: "pct", strength: 30, duration: 2 });
  statuses = mergeCombatStatus(statuses, { id: "atkDownSig", stat: "atk", unit: "pct", strength: 25, duration: 1 });
  const total = statuses.filter(s => s.stat === "atk").reduce((sum, s) => sum + s.strength, 0);
  expect(total).toBe(40); // 30 + clamp(25→10)
  // 同名只刷新不疊加
  const refreshed = mergeCombatStatus(statuses, { id: "atkDown", stat: "atk", unit: "pct", strength: 20, duration: 3 });
  expect(refreshed.find(s => s.id === "atkDown").strength).toBe(30);
  expect(refreshed.find(s => s.id === "atkDown").duration).toBe(3);
});
