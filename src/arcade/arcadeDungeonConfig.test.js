import {
  ARCADE_DUNGEON_CONFIGS,
  buildArcadeDungeonFloor,
  buildArcadeVisitorMonster,
  getArcadeSettlementPolicy,
} from "./arcadeDungeonConfig";

function connectedCount(floor) {
  const byPos = new Map(floor.rooms.map((r) => [`${r.pos.x},${r.pos.y}`, r]));
  const start = floor.startPos;
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  while (queue.length) {
    const p = queue.shift();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const next = {x:p.x+dx,y:p.y+dy};
      const k = `${next.x},${next.y}`;
      if (byPos.has(k) && !seen.has(k)) { seen.add(k); queue.push(next); }
    });
  }
  return seen.size;
}

describe("Arcade dungeon configs", () => {
  test("forest is 2 floors while moon and abyss are 3", () => {
    expect(ARCADE_DUNGEON_CONFIGS.forest.floors).toBe(2);
    expect(ARCADE_DUNGEON_CONFIGS.moon.floors).toBe(3);
    expect(ARCADE_DUNGEON_CONFIGS.abyss.floors).toBe(3);
  });

  test("three dungeons have intentionally different room/risk profiles", () => {
    expect(ARCADE_DUNGEON_CONFIGS.forest.weights.rest).toBeGreaterThan(ARCADE_DUNGEON_CONFIGS.abyss.weights.rest);
    expect(ARCADE_DUNGEON_CONFIGS.forest.weights.chest).toBeGreaterThan(ARCADE_DUNGEON_CONFIGS.moon.weights.chest);
    expect(ARCADE_DUNGEON_CONFIGS.abyss.weights.battle).toBeGreaterThan(ARCADE_DUNGEON_CONFIGS.moon.weights.battle);
    expect(ARCADE_DUNGEON_CONFIGS.abyss.weights.elite_battle).toBeGreaterThan(ARCADE_DUNGEON_CONFIGS.forest.weights.elite_battle);
    expect(ARCADE_DUNGEON_CONFIGS.abyss.rewardMult).toBeGreaterThan(ARCADE_DUNGEON_CONFIGS.moon.rewardMult);
  });

  test("grid floors are short connected subsets with one terminal", () => {
    const forest = buildArcadeDungeonFloor("forest", 0, "test-grid");
    expect(forest.kind).toBe("grid");
    expect(forest.rooms.length).toBeLessThanOrEqual(ARCADE_DUNGEON_CONFIGS.forest.roomsPerGrid);
    expect(forest.rooms.length).toBeGreaterThan(5);
    expect(connectedCount(forest)).toBe(forest.rooms.length);
    expect(forest.rooms.filter((r) => r.type === "stairs")).toHaveLength(1);
  });

  test("forest final grid guarantees a boss; moon/abyss final floors use shared branch model", () => {
    const forestFinal = buildArcadeDungeonFloor("forest", 1, "forest-final");
    expect(forestFinal.kind).toBe("grid");
    expect(forestFinal.rooms.some((r) => r.type === "boss_battle")).toBe(true);

    const moonFinal = buildArcadeDungeonFloor("moon", 2, "moon-final");
    const abyssFinal = buildArcadeDungeonFloor("abyss", 2, "abyss-final");
    expect(moonFinal.kind).toBe("branch");
    expect(abyssFinal.kind).toBe("branch");
    expect(Object.keys(moonFinal.branches)).toEqual(["A", "B", "C"]);
    expect(moonFinal.boss.type).toBe("boss_battle");
  });

  test("visitor combat stats scale by dungeon and room type", () => {
    const forest = buildArcadeVisitorMonster("forest", 0, "battle", "same");
    const moon = buildArcadeVisitorMonster("moon", 0, "battle", "same");
    const abyss = buildArcadeVisitorMonster("abyss", 0, "battle", "same");
    const elite = buildArcadeVisitorMonster("forest", 0, "elite_battle", "same");
    const boss = buildArcadeVisitorMonster("forest", 1, "boss_battle", "same");
    expect(moon.hp).toBeGreaterThan(forest.hp);
    expect(abyss.hp).toBeGreaterThan(moon.hp);
    expect(elite.hp).toBeGreaterThan(forest.hp);
    expect(boss.hp).toBeGreaterThan(elite.hp);
    expect(forest.visitorCombatProfile).toBe(true);
  });

  test("abyss banks only clear/retreat and defeat still grants XP", () => {
    expect(getArcadeSettlementPolicy("abyss", "clear", 123).coins).toBe(123);
    expect(getArcadeSettlementPolicy("abyss", "retreat", 123).coins).toBe(123);
    const defeat = getArcadeSettlementPolicy("abyss", "defeat", 123);
    expect(defeat.coins).toBe(0);
    expect(defeat.xp).toBeGreaterThan(0);
    expect(defeat.losesRunCoins).toBe(true);
  });
});
