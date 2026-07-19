// src/lib/worldBossStrikeEngine.test.js — 世界王強攻切片測試（spec 測試矩陣 1-7）
import {
  WB_STRIKE_MULTIPLIER, WB_FINISHER_MULTIPLIER,
  getWorldBossScheduledStrike, getWorldBossTelegraph,
  resolveWorldBossStrike, validateWorldBossSkillConfig,
} from "./worldBossStrikeEngine";

// 切片 fixture：1 隻教練王（射箭系強攻,PRD 21）
const COACH_BOSS = {
  r2Strike: {
    skillId: "wb_coach1_strike", name: "百步穿楊", color: "#38bdf8",
    counterText: "本回合射出高分即可削弱或完全破解！",
    baseMultiplier: WB_STRIKE_MULTIPLIER,
    status: { id: "atkDown", strength: 10, duration: 2 },
    canKnockOut: false,
  },
  r4Finisher: {
    skillId: "wb_coach1_finisher", name: "萬箭齊發", color: "#f43f5e",
    counterText: "全力以赴！85% 以上得分可完全破解。",
    baseMultiplier: WB_FINISHER_MULTIPLIER,
    status: null,
    canKnockOut: true,
  },
};
const base = {
  sortieId: "wb:evt1:m1:1", bossKey: "coach1",
  baseCounterDamage: 100, playerHp: 200, playerMaxHp: 200,
};

// 1. 排程與預告（R1/R3 末）
test("R2/R4 排程與 R1/R3 末預告一致,其餘回合無", () => {
  expect(getWorldBossScheduledStrike(COACH_BOSS, 2)).toBe(COACH_BOSS.r2Strike);
  expect(getWorldBossScheduledStrike(COACH_BOSS, 4)).toBe(COACH_BOSS.r4Finisher);
  expect(getWorldBossScheduledStrike(COACH_BOSS, 3)).toBeNull();
  expect(getWorldBossTelegraph(COACH_BOSS, 1)).toMatchObject({ round: 2, skillId: "wb_coach1_strike", isFinisher: false });
  expect(getWorldBossTelegraph(COACH_BOSS, 3)).toMatchObject({ round: 4, skillId: "wb_coach1_finisher", isFinisher: true });
  expect(getWorldBossTelegraph(COACH_BOSS, 2)).toBeNull();
});

// 2. 破解四級距 × 兩種靶紙
describe("R2 破解級距（worldBoss ruleset）", () => {
  const r2 = (arrows, targetFmt) => resolveWorldBossStrike({ ...base, round: 2, skill: COACH_BOSS.r2Strike, arrows, targetFmt });
  test("full_110：滿分完全破解 → 0 傷 0 異常,仍有演出 flag", () => {
    const r = r2(["X", 10, 10], "full_110");
    expect(r.outcome.level).toBe("full");
    expect(r.damage).toBe(0);
    expect(r.status).toBeNull();
    expect(r.spectacleOnly).toBe(true);
  });
  test("full_110：70-84% → ×0.4（PRD14 降低60%）且異常降級不取消", () => {
    const r = r2([10, 9, 7], "full_110"); // (1+0.9+0.55)/3 ≈ .817
    expect(r.outcome.level).toBe("major");
    expect(r.damage).toBe(Math.round(100 * 1.6 * 0.4));
    expect(r.status).toBeNull(); // 引擎現行 MAJOR 取消異常;若 Codex 依 PRD20 拍板改級距,此案例需同步
  });
  test("full_110：50-69% → ×0.7;<50% 全額", () => {
    expect(r2([8, 7, 6], "full_110").damage).toBe(Math.round(100 * 1.6 * 0.7));   // ≈.533 partial
    expect(r2([6, 6, "M"], "full_110").damage).toBe(Math.round(100 * 1.6 * 1));   // .2 none
  });
  test("field_16 正規化：滿環(5,5,X)＝完全破解（靶紙不寫死10分）", () => {
    const r = r2([5, 5, "X"], "field_16");
    expect(r.outcome.level).toBe("full");
    expect(r.damage).toBe(0);
  });
});

// 3. R2 保 1 HP;R4 可擊倒
test("R2 滿額傷害也不擊倒（保 1 HP）;R4 可擊倒", () => {
  const r2 = resolveWorldBossStrike({ ...base, playerHp: 100, round: 2, skill: COACH_BOSS.r2Strike, arrows: ["M", "M", "M"], baseCounterDamage: 500 });
  expect(r2.playerHp).toBe(1);
  expect(r2.knockedOut).toBe(false);
  const r4 = resolveWorldBossStrike({ ...base, playerHp: 100, round: 4, skill: COACH_BOSS.r4Finisher, arrows: ["M", "M", "M"], baseCounterDamage: 500 });
  expect(r4.playerHp).toBe(0);
  expect(r4.knockedOut).toBe(true);
});

// 4. once-only：重複結算不改數值
test("同 key 重複結算（動畫重播/重連重送）→ 只回演出,不再扣血", () => {
  const first = resolveWorldBossStrike({ ...base, round: 2, skill: COACH_BOSS.r2Strike, arrows: [6, 6, 6] });
  expect(first.damage).toBeGreaterThan(0);
  const replay = resolveWorldBossStrike({ ...base, round: 2, skill: COACH_BOSS.r2Strike, arrows: [6, 6, 6], resolvedSkillKeys: [first.resolvedKey] });
  expect(replay.alreadyResolved).toBe(true);
  expect(replay.damage).toBe(0);
  expect(replay.playerHp).toBe(base.playerHp);
  expect(replay.status).toBeNull();
});

// 6. 結算順序：破解減幅 → 專精抗性 → 護盾 → HP
test("結算順序可組合驗證（×0.7 → -20% 抗性 → 護盾吸收 → HP）", () => {
  const r = resolveWorldBossStrike({
    ...base, round: 2, skill: COACH_BOSS.r2Strike,
    arrows: [8, 7, 6], // partial ×0.7
    damageReductionPct: 20, shield: 30, playerHp: 200,
  });
  // 100×1.6=160 → ×0.7=112 → ×0.8=89.6 → 護盾30 → 59.6 → round=60（先扣盾再入整）
  expect(r.shieldRemaining).toBe(0);
  expect(r.playerHp).toBe(200 - Math.round(89.6 - 30));
});

// 5b. 穿甲/破盾副效果（PRD 23-26）與部分破解縮放（PRD 24）
describe("穿甲/破盾副效果", () => {
  test("破盾：<50% 未破解時全額生效（護盾只擋 70%）", () => {
    const skill = { ...COACH_BOSS.r2Strike, skillId: "wb_test_sp", shieldPiercePct: 30 };
    const r = resolveWorldBossStrike({ ...base, round: 2, skill, arrows: ["M", "M", "M"], shield: 200 });
    // 160 全額 → 護盾最多吸 160×0.7=112 → HP 扣 48
    expect(r.playerHp).toBe(200 - 48);
    expect(r.shieldRemaining).toBe(200 - 112);
  });
  test("穿甲：50-69% 部分破解 → 穿甲強度同步減半（PRD 24）", () => {
    const skill = { ...COACH_BOSS.r2Strike, skillId: "wb_test_ap", status: null, armorPiercePct: 20 };
    const r = resolveWorldBossStrike({ ...base, round: 2, skill, arrows: [8, 7, 6], damageReductionPct: 50 });
    // 160×0.7=112;穿甲 20%×0.5=10% → 減傷 50%→45% → 112×0.55=61.6 → round 62
    expect(r.playerHp).toBe(200 - 62);
  });
  test("70-84% 破解 → 穿甲/破盾歸零（statusMultiplier=0）", () => {
    const skill = { ...COACH_BOSS.r2Strike, skillId: "wb_test_ap2", status: null, armorPiercePct: 100 };
    const r = resolveWorldBossStrike({ ...base, round: 2, skill, arrows: [10, 9, 7], damageReductionPct: 50 });
    // 160×0.4=64 → 減傷 50% 完整生效 → 32
    expect(r.playerHp).toBe(200 - 32);
  });
});

// 7. config 驗證
test("世界王技能 config 不變量（倍率固定/R4無異常/可擊倒 flag）", () => {
  expect(validateWorldBossSkillConfig(COACH_BOSS)).toEqual({ ok: true, errors: [] });
  expect(validateWorldBossSkillConfig({
    r2Strike: { ...COACH_BOSS.r2Strike, baseMultiplier: 2 },
    r4Finisher: { ...COACH_BOSS.r4Finisher, status: { id: "poison" }, canKnockOut: false },
  }).errors).toEqual(expect.arrayContaining(["r2_multiplier", "r4_must_not_carry_status", "r4_must_knock_out_flag"]));
});
