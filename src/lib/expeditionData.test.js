import {
  EXPEDITION_MISSIONS,
  buildExpeditionRewardEntries,
} from "./expeditionData";

describe("expedition reward presentation", () => {
  test("maps persisted rewards to stable player-facing metadata", () => {
    expect(buildExpeditionRewardEntries({
      potion_t2: 7,
      fur_t1: 12,
      catXP: 80,
      catBond: 2,
      arrowdew: 9,
      gachaToken: 1,
    })).toEqual([
      expect.objectContaining({ key: "potion_t2", name: "貓薄荷藥水", tier: 2, count: 7, kind: "material" }),
      expect.objectContaining({ key: "fur_t1", name: "貓毛", tier: 1, count: 12, kind: "material" }),
      expect.objectContaining({ key: "catXP", name: "貓咪經驗", count: 80, kind: "special" }),
      expect.objectContaining({ key: "catBond", name: "羈絆", count: 2, kind: "special" }),
      expect.objectContaining({ key: "arrowdew", name: "箭露", count: 9, kind: "special" }),
      expect.objectContaining({ key: "gachaToken", name: "扭蛋幣", count: 1, kind: "special" }),
    ]);
  });

  test("never exposes an unknown internal key", () => {
    expect(buildExpeditionRewardEntries({ unexpected_reward: 99 })).toEqual([]);
  });

  test("every expedition has result-screen identity metadata", () => {
    expect(EXPEDITION_MISSIONS.every(mission => mission.label && mission.image)).toBe(true);
  });
});
