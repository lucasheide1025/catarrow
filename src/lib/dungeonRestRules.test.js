import { getDungeonRestOptionState, resolveDungeonRestChoice } from "./dungeonRestRules";

const member = {
  hp: 20, maxHP: 100, role: "front",
  restBonuses: { atkPct: 12, defPct: 9 },
};

describe("personal dungeon rest rules", () => {
  test("rest heals 15-50 percent of max hp", () => {
    expect(resolveDungeonRestChoice(member, "rest", { random:() => 0 }).healPct).toBe(15);
    expect(resolveDungeonRestChoice(member, "rest", { random:() => 0.999 }).healPct).toBe(50);
  });

  test("prepare and polish keep the best value independently", () => {
    expect(resolveDungeonRestChoice(member, "prepare", { random:() => 0 }).restBonuses)
      .toEqual({ atkPct:12, defPct:9 });
    expect(resolveDungeonRestChoice(member, "polish", { random:() => 0.999 }).restBonuses)
      .toEqual({ atkPct:15, defPct:9 });
  });

  test("blessing is team-only and requires rear role and 1000 coins", () => {
    expect(getDungeonRestOptionState(member, "blessing", { localMode:true, coins:999 }).visible).toBe(false);
    expect(getDungeonRestOptionState(member, "blessing", { coins:999 }).enabled).toBe(false);
    expect(getDungeonRestOptionState({ ...member, role:"rear" }, "blessing", { coins:1000 }).enabled).toBe(true);
  });

  test("blessing restores front role at half hp", () => {
    expect(resolveDungeonRestChoice({ ...member, role:"rear" }, "blessing")).toMatchObject({
      hp:50, role:"front", coinCost:1000,
    });
  });
});
