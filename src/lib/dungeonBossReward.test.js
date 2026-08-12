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
    expect(first.version).toBe(2);
    expect(first.choiceOptions).toHaveLength(6);
  });

  test("boss cards always use the fixed 40% roll without first-clear guarantee", () => {
    const reward = buildDungeonBossRewardEnvelope({
      battleId:"battle-first",
      memberId:"member-1",
      monsterId:"ghost_t2_boss",
      firstDefeat:true,
    });
    expect(reward.cardResult).toMatchObject({ chance:.4, guaranteed:false });
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

  test("miss counters do not trigger pity", () => {
    const mini = buildDungeonBossRewardEnvelope({
      battleId:"mini-pity", memberId:"m", monsterId:"ghost_t1_mini_b", cardMisses:4,
    });
    const boss = buildDungeonBossRewardEnvelope({
      battleId:"boss-pity", memberId:"m", monsterId:"ghost_t1_boss", cardMisses:7,
    });
    expect(mini.cardResult.guaranteed).toBe(false);
    expect(boss.cardResult.guaranteed).toBe(false);
  });
});
