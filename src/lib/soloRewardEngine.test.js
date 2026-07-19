import { buildSoloExpansionReward } from "./soloRewardEngine";

const monster = { id:"ghost_t1_normal_a", name:"提燈小靈", family:"ghost", tier:"common", encounter:"normal", expansionVersion:1, materialId:"mat_ghost_t1_normal_a", cardId:"ghost_t1_normal_a" };

describe("solo expansion reward", () => {
  test("locks five target materials and a deterministic card result", () => {
    const input = { battleId:"battle-1", memberId:"member-1", monster };
    expect(buildSoloExpansionReward(input)).toEqual(buildSoloExpansionReward(input));
    expect(buildSoloExpansionReward(input).materials).toEqual([{ id:"mat_ghost_t1_normal_a", quantity:5 }]);
  });

  test("does not leak boss materials into solo hunting", () => {
    expect(buildSoloExpansionReward({ battleId:"b", memberId:"m", monster:{ ...monster, encounter:"boss" } })).toBeNull();
  });
});

