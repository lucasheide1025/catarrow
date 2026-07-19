import {
  applyMonsterRewardToInventory,
  buildMonsterRewardClaimId,
  normalizeMonsterReward,
} from "./monsterRewardLedger";

describe("monster reward ledger contract", () => {
  test("builds a stable claim id even when source ids contain slashes", () => {
    expect(buildMonsterRewardClaimId({ battleId: "run/room", memberId: "member/1", rewardType: "battle" }))
      .toBe("run%2Froom~member%2F1~battle");
  });

  test("aggregates duplicate material rows before one transaction", () => {
    const reward = normalizeMonsterReward({
      battleId: "b1", memberId: "u1", coins: 50,
      materials: [{ id: "ghost_m1", quantity: 2 }, { materialId: "ghost_m1", count: 3 }],
      metadata: { mode: "solo", ignored: { unsafe: true } },
    });
    expect(reward.materialTotals).toEqual({ ghost_m1: 5 });
    expect(reward.metadata).toEqual({ mode: "solo" });
  });

  test("applies totals without mutating the current inventory", () => {
    const current = { ghost_m1: 2 };
    expect(applyMonsterRewardToInventory(current, { ghost_m1: 3, mountain_m1: 1 })).toEqual({ ghost_m1: 5, mountain_m1: 1 });
    expect(current).toEqual({ ghost_m1: 2 });
  });

  test("rejects malformed or excessive client payloads", () => {
    expect(() => normalizeMonsterReward({ battleId: "b", memberId: "u", materials: [{ id: "x", quantity: 10001 }] })).toThrow("invalid_material_quantity");
    expect(() => normalizeMonsterReward({ battleId: "b", memberId: "u", coins: -1 })).toThrow("invalid_reward_coins");
  });
});
