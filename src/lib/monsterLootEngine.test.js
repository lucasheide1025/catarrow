import {
  buildBossReward,
  buildChoiceChestReward,
  buildRewardKey,
  resolveBossCardDrop,
  selectBossRoomEncounter,
} from "./monsterLootEngine";

describe("monster loot engine", () => {
  test("uses 35/35/30 boss-room bands and fourth-room guarantee", () => {
    expect(selectBossRoomEncounter({ roll: 0.1 }).role).toBe("miniA");
    expect(selectBossRoomEncounter({ roll: 0.5 }).role).toBe("miniB");
    expect(selectBossRoomEncounter({ roll: 0.9 }).role).toBe("boss");
    expect(selectBossRoomEncounter({ roll: 0.1, consecutiveNonBoss: 3 })).toMatchObject({ role: "boss", guaranteed: true });
  });

  test("uses a flat 40% boss-card chance without first-clear or pity", () => {
    expect(resolveBossCardDrop({ encounter: "miniBoss", firstDefeat:true, misses:99, roll:0.39 })).toMatchObject({ dropped:true, chance:.4, guaranteed:false });
    expect(resolveBossCardDrop({ encounter: "boss", firstDefeat:true, misses:99, roll:0.4 })).toMatchObject({ dropped:false, chance:.4, guaranteed:false });
  });

  test("builds fixed boss reward without leaking boss materials into the general pool", () => {
    const reward = buildBossReward({ monsterId: "ghost_t1_boss" });
    expect(reward.bossMaterial).toEqual({ materialId: "mat_ghost_t1_boss", quantity: 1 });
    expect(reward.generalMaterials.reduce((sum, item) => sum + item.quantity, 0)).toBe(8);
    expect(reward.generalMaterials.every(item => !item.materialId.includes("boss"))).toBe(true);
    expect(reward).toMatchObject({ bossMarks: 2, runeFragments: 6, coins: 600, choiceCount: 2 });
  });

  test("choice chests contain only their explicit reward type", () => {
    const material = buildChoiceChestReward({ type: "material", monsterId: "ghost_t1_mini_a" });
    expect(material.materials.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
    expect(buildChoiceChestReward({ type: "coins", monsterId: "ghost_t1_mini_a" }).coins).toBe(450);
    expect(buildChoiceChestReward({ type: "exploration", monsterId: "ghost_t1_mini_a", roll: 0.97 })).toEqual({ type: "exploration", rarity: "boss", quantity: 1 });
  });

  test("creates stable idempotency keys", () => {
    expect(buildRewardKey({ battleId: "b1", memberId: "u1", rewardType: "boss" })).toBe("b1:u1:boss");
  });
});
