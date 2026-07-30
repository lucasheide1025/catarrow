import {
  COLLECTIBLE_MAP,
  rollFamilyDrop,
  rollBossDrops,
  rollTreasureRoomDrop,
} from "./dungeonCollectibles";

describe("dungeon collectible drop contracts", () => {
  test.each([
    ["monster", 0.149, true],
    ["monster", 0.15, false],
    ["elite", 0.449, true],
    ["elite", 0.45, false],
    ["chest", 0.549, true],
    ["chest", 0.55, false],
  ])("%s threshold uses the approved rate", (roomType, roll, shouldDrop) => {
    const drop = rollFamilyDrop("ghost", roomType, 1, () => roll);
    expect(Boolean(drop)).toBe(shouldDrop);
  });

  test("boss uses 65% base chance", () => {
    expect(rollBossDrops("ghost", "normal", 1, sequence(0.649, 0.99))).toHaveLength(1);
    expect(rollBossDrops("ghost", "normal", 1, sequence(0.65, 0.99))).toHaveLength(0);
  });

  test("treasure room always returns a registered family collectible", () => {
    const drop = rollTreasureRoomDrop("temple", 4, () => 0.7);
    expect(drop).toBeTruthy();
    expect(COLLECTIBLE_MAP[drop.itemId]).toMatchObject({ family: "temple" });
  });

  test("every generated id belongs to the dungeon dex", () => {
    const drops = [
      rollFamilyDrop("mountain", "monster", 1, () => 0),
      rollFamilyDrop("insect", "elite", 1, () => 0.3),
      rollFamilyDrop("exam", "chest", 1, () => 0.5),
      ...rollBossDrops("workplace", "hell", 1, sequence(0, 0)),
      rollTreasureRoomDrop("ghost", 6, () => 0.9),
    ].filter(Boolean);
    expect(drops.every(drop => COLLECTIBLE_MAP[drop.itemId])).toBe(true);
  });
});

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}
