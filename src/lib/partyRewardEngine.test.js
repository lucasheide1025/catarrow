import { buildPartyExpansionReward } from "./partyRewardEngine";

const monster = { id:"ghost_t1_normal_a", name:"提燈小靈", icon:"👻", tier:"common", family:"ghost", encounter:"normal", expansionVersion:1, materialId:"mat_ghost_t1_normal_a", cardId:"ghost_t1_normal_a" };

describe("party expansion rewards", () => {
  test("locks five target materials and a deterministic per-member card roll", () => {
    const first = buildPartyExpansionReward({ roomId:"r1", memberId:"m1", monster });
    const replay = buildPartyExpansionReward({ roomId:"r1", memberId:"m1", monster });
    expect(first).toEqual(replay);
    expect(first.material).toEqual({ id:"mat_ghost_t1_normal_a", quantity:5 });
    expect(first.rewardKey).toBe("party:r1:m1:ghost_t1_normal_a");
  });

  test("does not issue boss materials from ordinary party battles", () => {
    expect(buildPartyExpansionReward({ roomId:"r1", memberId:"m1", monster:{ ...monster, encounter:"miniBoss" } })).toBeNull();
  });
});

