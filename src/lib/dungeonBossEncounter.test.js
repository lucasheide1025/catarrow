import {
  createLockedDungeonBossEncounter,
  DUNGEON_EXPANSION_RUN_VERSION,
  isLockedDungeonBossEncounter,
} from "./dungeonBossEncounter";

describe("dungeon boss encounter locking", () => {
  test("draws only one of the two mini bosses or the single boss for the family and tier", () => {
    for (let index = 0; index < 40; index += 1) {
      const result = createLockedDungeonBossEncounter({
        runId:`run-${index}`,
        roomId:"floor-3-boss",
        family:"forest",
        difficultyTier:3,
      });
      expect(result.runVersion).toBe(DUNGEON_EXPANSION_RUN_VERSION);
      expect(result.family).toBe("mountain");
      expect(result.tier).toBe("elite");
      expect(["miniBoss", "boss"]).toContain(result.encounter);
      expect(result.monsterSnapshot.encounter).toBe(result.encounter);
      expect(result.monsterSnapshot.variant).toBeUndefined();
    }
  });

  test("same run and room always resolve to the same monster", () => {
    const input = { runId:"stable-run", roomId:"boss-room", family:"exam", difficultyTier:6 };
    expect(createLockedDungeonBossEncounter(input)).toEqual(createLockedDungeonBossEncounter(input));
  });

  test("fourth consecutive non-boss room is guaranteed to be the boss", () => {
    const result = createLockedDungeonBossEncounter({
      runId:"pity-run",
      roomId:"boss-room",
      family:"ghost",
      difficultyTier:2,
      consecutiveNonBoss:3,
    });
    expect(result.encounter).toBe("boss");
    expect(result.role).toBe("boss");
    expect(result.guaranteed).toBe(true);
    expect(result.nextConsecutiveNonBoss).toBe(0);
  });

  test("reconnect reuses the persisted snapshot instead of rerolling", () => {
    const locked = createLockedDungeonBossEncounter({
      runId:"original-run",
      roomId:"boss-room",
      family:"poison",
      difficultyTier:4,
    });
    const restored = createLockedDungeonBossEncounter({
      runId:"different-client-seed",
      roomId:"boss-room",
      family:"poison",
      difficultyTier:4,
      lockedEncounter:locked,
    });
    expect(restored).toBe(locked);
    expect(isLockedDungeonBossEncounter(restored)).toBe(true);
  });

  test("rejects an absent run identity", () => {
    expect(() => createLockedDungeonBossEncounter({ family:"ghost", difficultyTier:1 }))
      .toThrow("missing_dungeon_run_id");
  });
});
