// src/lib/bossRewardAdvance.test.js
import {
  isEligibleForBossReward, pendingBossRewardMembers, canAdvanceAfterBossReward, bossRewardBlocksAdvance,
} from "./bossRewardAdvance";

describe("bossRewardAdvance — 資格 (validRounds gate)", () => {
  const eligible = ["m1", "m2"]; // validRounds>0 的合格隊員
  test("合格隊員可領取", () => {
    expect(isEligibleForBossReward({ eligibleMemberIds: eligible, memberId: "m1" })).toBe(true);
  });
  test("未符合 validRounds（不在名單）不能領取", () => {
    expect(isEligibleForBossReward({ eligibleMemberIds: eligible, memberId: "m3" })).toBe(false);
  });
  test("缺參數安全回 false", () => {
    expect(isEligibleForBossReward({})).toBe(false);
    expect(isEligibleForBossReward({ eligibleMemberIds: null, memberId: "m1" })).toBe(false);
  });
});

describe("bossRewardAdvance — 是否可前進", () => {
  test("所有合格隊員完成後才可前進", () => {
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true, m2: true } })).toBe(true);
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true } })).toBe(false);
  });
  test("不合格隊員（不在 eligible）不阻擋前進", () => {
    // m3 是不合格隊員,即使沒領也不擋;合格的 m1/m2 完成即可前進
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true, m2: true, /* m3 未領 */ } })).toBe(true);
  });
  test("斷線但合格且未領取者仍維持 pending（不可前進）", () => {
    // m2 斷線未領 → 仍 pending
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true } })).toBe(false);
    expect(pendingBossRewardMembers({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true } })).toEqual(["m2"]);
  });
  test("重連完成後可前進", () => {
    // m2 重連後補領 → 全部完成 → 可前進
    const after = { m1: true, m2: true };
    expect(pendingBossRewardMembers({ eligibleMemberIds: ["m1", "m2"], choiceClaims: after })).toEqual([]);
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: ["m1", "m2"], choiceClaims: after })).toBe(true);
  });
  test("無合格隊員 → canAdvance 維持 false（嚴格語意不變）", () => {
    expect(canAdvanceAfterBossReward({ eligibleMemberIds: [], choiceClaims: {} })).toBe(false);
  });
});

describe("bossRewardAdvance — UI 前進閘門(不因空名單卡死)", () => {
  test("有合格未全領 → 阻擋前進", () => {
    expect(bossRewardBlocksAdvance({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true } })).toBe(true);
  });
  test("有合格且全領 → 不阻擋", () => {
    expect(bossRewardBlocksAdvance({ eligibleMemberIds: ["m1", "m2"], choiceClaims: { m1: true, m2: true } })).toBe(false);
  });
  test("無合格隊員(edge) → 不阻擋(避免卡死),與 canAdvance 的嚴格 false 互補", () => {
    expect(bossRewardBlocksAdvance({ eligibleMemberIds: [], choiceClaims: {} })).toBe(false);
  });
});
