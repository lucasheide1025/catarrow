import { buildSoloExpansionReward, normalizeSoloRewardMaterials } from "./soloRewardEngine";
import { SOLO_CHALLENGE_LEVELS } from "./monsterExpansionAdapter";

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

  test("preserves the trusted quantity returned by the reward service for the result UI", () => {
    expect(normalizeSoloRewardMaterials(
      { mat_ghost_t1_normal_a: 5 },
      id => ({ name: id === "mat_ghost_t1_normal_a" ? "幽光粉塵" : id }),
    )).toEqual([{
      id:"mat_ghost_t1_normal_a",
      quantity:5,
      count:5,
      name:"幽光粉塵",
    }]);
  });

  test.each([
    ["easy", 3, 0.2],
    ["standard", 5, 0.5],
    ["hard", 7, 1],
  ])("%s difficulty describes every reward source", (id, materialQty, coinChestChance) => {
    expect(SOLO_CHALLENGE_LEVELS[id]).toMatchObject({
      materialQty,
      guaranteedMaterialChests:1,
      coinChestChance,
      xpRule:"tier_fixed",
    });
    expect(SOLO_CHALLENGE_LEVELS[id].desc).toContain(`指定素材×${materialQty}`);
    expect(SOLO_CHALLENGE_LEVELS[id].desc).toContain("素材箱×1必得");
    expect(SOLO_CHALLENGE_LEVELS[id].desc).toContain("藥水箱依階級機率");
    expect(SOLO_CHALLENGE_LEVELS[id].desc).toContain("XP依怪物階級");
  });
});
