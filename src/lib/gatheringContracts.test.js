import {
  buildGatheringContract,
  createTeamGatheringState,
  getGatheringRewardMultiplier,
  getGatheringTierOptions,
} from "./gatheringContracts";

describe("gathering contracts", () => {
  test("builds a serializable three-checkpoint contract", () => {
    const contract = buildGatheringContract({
      buildingId: "mine",
      tier: "elite",
      distance: 18,
      targetFmt: "field_16",
      seed: "fixed",
    });

    expect(contract.id).toBe("mine_elite_fixed");
    expect(contract.checkpoints).toHaveLength(3);
    expect(contract.checkpoints[2].progressRequired)
      .toBeGreaterThan(contract.checkpoints[0].progressRequired);
    expect(JSON.parse(JSON.stringify(contract))).toEqual(contract);
  });

  test("keeps canonical tier order and checkpoint multipliers", () => {
    expect(getGatheringTierOptions(["elite", "common"])).toEqual(["common", "elite"]);
    expect(getGatheringRewardMultiplier(0)).toBe(0);
    expect(getGatheringRewardMultiplier(2)).toBe(1.35);
    expect(getGatheringRewardMultiplier(3)).toBe(1.8);
  });

  test("prepares a serializable shared state for future co-op rooms", () => {
    const contract = buildGatheringContract({
      buildingId: "farm",
      tier: "rare",
      seed: "team",
    });
    const state = createTeamGatheringState({
      contract,
      hostId: "host",
      members: {
        host: { name: "房主", role: "support" },
        guest: { name: "隊員", role: "invalid" },
      },
    });

    expect(state.members.host.role).toBe("support");
    expect(state.members.guest.role).toBe("gatherer");
    expect(state.status).toBe("waiting");
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
