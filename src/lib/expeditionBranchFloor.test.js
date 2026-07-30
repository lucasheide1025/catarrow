import { generateBranchFloor, getBranchMapLayout } from "./expeditionGrid";

describe("third-floor dungeon branch", () => {
  test("each path is three random rooms, rest, shop, boss, then treasure", () => {
    const floor = generateBranchFloor();
    for (const branch of Object.values(floor.branches)) {
      expect(branch.rooms).toHaveLength(5);
      expect(branch.rooms.slice(0, 3).map(room => room.type).every(type =>
        ["chest", "trap", "event", "elite_battle"].includes(type)
      )).toBe(true);
      expect(new Set(branch.rooms.slice(0, 3).map(room => room.type)).size).toBe(3);
      expect(branch.rooms[3].type).toBe("rest");
      expect(branch.rooms[4].type).toBe("shop");
    }
    expect(floor.boss.type).toBe("boss_battle");
    expect(floor.treasure.type).toBe("treasure");
  });

  test("merchant, boss, and reward room occupy separate rows", () => {
    expect(getBranchMapLayout()).toMatchObject({
      branchRoomRows: [1, 2, 3, 4, 5],
      bossRow: 6,
      treasureRow: 7,
    });
  });
});
