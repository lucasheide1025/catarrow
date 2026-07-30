import { createOrdinaryChestChoices, createOrdinaryChestLoot } from "./dungeonChestLoot";

describe("ordinary dungeon chest loot", () => {
  test.each([
    [1, "common"],
    [2, "rare"],
    [3, "elite"],
    [4, "fierce"],
    [5, "boss"],
    [6, "mythic"],
  ])("difficulty T%s uses the matching material tier", (difficultyTier, tier) => {
    const loot = createOrdinaryChestLoot({ family: "ghost", difficultyTier, random: () => 0 });
    expect(loot.material.family).toBe("ghost");
    expect(loot.material.tier).toBe(tier);
    expect(loot.material.quantity).toBeGreaterThanOrEqual(difficultyTier);
  });

  test("three facedown cards use a mixed pool and their positions are shuffled", () => {
    const first = createOrdinaryChestChoices({
      family: "ghost",
      difficultyTier: 3,
      random: () => 0.1,
    });
    const second = createOrdinaryChestChoices({
      family: "ghost",
      difficultyTier: 3,
      random: () => 0.9,
    });

    expect(first).toHaveLength(3);
    expect(new Set(first.map(choice => choice.type)).size).toBeGreaterThan(1);
    expect(first.map(choice => choice.type)).not.toEqual(second.map(choice => choice.type));
  });
});
