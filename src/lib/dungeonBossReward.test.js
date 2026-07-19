import { buildDungeonBossRewardEnvelope, validateDungeonBossChoices } from "./dungeonBossReward";

describe("dungeon boss reward envelope", () => {
  test("locks deterministic per-member rewards and one non-convertible boss material", () => {
    const input = { battleId:"battle-1", memberId:"member-1", monsterId:"ghost_t1_mini_a" };
    const first = buildDungeonBossRewardEnvelope(input);
    const second = buildDungeonBossRewardEnvelope(input);
    expect(first).toEqual(second);
    expect(first.fixedReward.bossMaterial).toEqual({
      materialId:"mat_ghost_t1_mini_a",
      quantity:1,
    });
    expect(first.choiceCount).toBe(1);
    expect(["atk", "def", "hp", "cat"]).toContain(first.fixedReward.runeFragment.type);
    expect(first.fixedReward.runeFragment.count).toBe(first.fixedReward.runeFragments);
    expect(first.choiceOptions.map(option => option.type)).toEqual(["material", "coins", "exploration"]);
    expect(first.choiceOptions.find(option => option.type === "exploration").reward.itemId).toBeTruthy();
  });

  test("first defeat guarantees its monster card", () => {
    const reward = buildDungeonBossRewardEnvelope({
      battleId:"battle-first",
      memberId:"member-1",
      monsterId:"ghost_t2_boss",
      firstDefeat:true,
    });
    expect(reward.cardResult).toMatchObject({ dropped:true, guaranteed:true, reason:"firstDefeat" });
    expect(reward.card?.monsterId).toBe("ghost_t2_boss");
  });

  test("boss grants two distinct choices and rejects duplicate selection", () => {
    const reward = buildDungeonBossRewardEnvelope({
      battleId:"battle-boss",
      memberId:"member-1",
      monsterId:"ghost_t3_boss",
    });
    const [first, second] = reward.choiceOptions;
    expect(reward.choiceCount).toBe(2);
    expect(validateDungeonBossChoices(reward, [first.id, second.id])).toBe(true);
    expect(validateDungeonBossChoices(reward, [first.id, first.id])).toBe(false);
    expect(validateDungeonBossChoices(reward, [first.id])).toBe(false);
  });

  test("mini boss fifth miss and boss eighth miss trigger their independent pity", () => {
    const mini = buildDungeonBossRewardEnvelope({
      battleId:"mini-pity", memberId:"m", monsterId:"ghost_t1_mini_b", cardMisses:4,
    });
    const boss = buildDungeonBossRewardEnvelope({
      battleId:"boss-pity", memberId:"m", monsterId:"ghost_t1_boss", cardMisses:7,
    });
    expect(mini.cardResult.reason).toBe("pity");
    expect(boss.cardResult.reason).toBe("pity");
  });
});
