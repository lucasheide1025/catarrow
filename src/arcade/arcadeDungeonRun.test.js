import { buildArcadeDungeonFloor } from "./arcadeDungeonConfig";
import {
  advanceArcadeDungeonFloor,
  applyArcadeDungeonBattleRound,
  applyArcadeDungeonLocalEffect,
  buildArcadeDungeonSettlement,
  chooseArcadeDungeonBranch,
  createArcadeDungeonRuntime,
  getArcadeBranchSequence,
  getArcadeDungeonPlayerState,
  resolveArcadeInlineRoom,
} from "./arcadeDungeonRunLogic";

const profile = {
  visitorId:"v-test", nickname:"測試射手", selectedCat:"haji",
  playerLevel:10, playerXp:0, coins:0, inventory:{}, statistics:{},
};

describe("Visitor Arcade dungeon runtime", () => {
  test("forest starts as a local grid run using visitor player stats", () => {
    const runtime = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-a", profile });
    const player = getArcadeDungeonPlayerState(runtime, profile);
    expect(runtime.dungeonId).toBe("forest");
    expect(runtime.floor.kind).toBe("grid");
    expect(runtime.visitedIds.length).toBe(1);
    expect(runtime.playerHp).toBe(player.maxHP);
    expect(player.atk).toBeGreaterThan(10);
  });

  test("matching adventureSession runtime resumes exactly instead of regenerating progress", () => {
    const initial = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-b", profile });
    const saved = { ...initial, runCoins:321, playerHp:47, floorIndex:1, branchStep:2 };
    const resumed = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-b", profile, sessionRuntime:saved });
    expect(resumed.runCoins).toBe(321);
    expect(resumed.playerHp).toBe(47);
    expect(resumed.floorIndex).toBe(1);
    expect(resumed.branchStep).toBe(2);
  });

  test("trap/event local effects stay in runtime and can reduce HP to zero", () => {
    const runtime = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-c", profile });
    const hurt = applyArcadeDungeonLocalEffect({ ...runtime, playerHp:5 }, { type:"heal_pct", value:-0.10 });
    expect(hurt.playerHp).toBe(0);
    const coins = applyArcadeDungeonLocalEffect(runtime, { type:"coins", value:30 });
    expect(coins.runCoins).toBe(30);
  });

  test("inline room rewards are local run state only and mark the room cleared", () => {
    const runtime = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-d", profile });
    const room = { id:"inline-1", type:"coin_pouch", label:"錢袋" };
    const next = resolveArcadeInlineRoom(runtime, room, 1);
    expect(next.runCoins).toBeGreaterThan(0);
    expect(next.clearedIds).toContain("inline-1");
    expect(profile.coins).toBe(0);
  });

  test("moon final floor uses A/B/C shared branch sequence ending in boss and treasure", () => {
    let runtime = createArcadeDungeonRuntime({ dungeonId:"moon", runId:"run-e", profile });
    runtime = advanceArcadeDungeonFloor(runtime);
    runtime = advanceArcadeDungeonFloor(runtime);
    expect(runtime.floor.kind).toBe("branch");
    runtime = chooseArcadeDungeonBranch(runtime, "A");
    const seq = getArcadeBranchSequence(runtime);
    expect(seq.length).toBeGreaterThanOrEqual(3);
    expect(seq.at(-2).type).toBe("boss_battle");
    expect(seq.at(-1).type).toBe("treasure");
  });

  test("battle round persists HP/monster state and X count", () => {
    const runtime = createArcadeDungeonRuntime({ dungeonId:"forest", runId:"run-f", profile });
    const withRoom = { ...runtime, pendingRoom:{ id:"b1", monster:{ hp:80 } } };
    const next = applyArcadeDungeonBattleRound(withRoom, {
      playerHp:70, monsterHp:35, dmg:45, roundKey:1,
      arrows:[
        {score:10,displayLabel:"X"},{score:8,displayLabel:"8"},{score:10,displayLabel:"10"},
        {score:7,displayLabel:"7"},{score:10,displayLabel:"X"},{score:5,displayLabel:"5"},
      ],
    });
    expect(next.playerHp).toBe(70);
    expect(next.pendingRoom.battleState.monsterHp).toBe(35);
    expect(next.stats.xCount).toBe(2);
  });

  test("abyss defeat loses unbanked coins but still awards XP", () => {
    const runtime = { ...createArcadeDungeonRuntime({ dungeonId:"abyss", runId:"run-g", profile }), runCoins:999 };
    const settlement = buildArcadeDungeonSettlement(runtime, "defeat");
    expect(settlement.coins).toBe(0);
    expect(settlement.xp).toBeGreaterThan(0);
    expect(settlement.policy.losesRunCoins).toBe(true);
  });

  test("clear and retreat settlement use one stable id per run", () => {
    const runtime = { ...createArcadeDungeonRuntime({ dungeonId:"moon", runId:"run-h", profile }), runCoins:120 };
    expect(buildArcadeDungeonSettlement(runtime, "clear")).toMatchObject({ id:"run-h:dungeon", coins:120 });
    expect(buildArcadeDungeonSettlement(runtime, "retreat")).toMatchObject({ id:"run-h:dungeon", coins:120 });
  });

  test("floor generator remains deterministic for the same run seed", () => {
    expect(buildArcadeDungeonFloor("forest", 0, "same-seed"))
      .toEqual(buildArcadeDungeonFloor("forest", 0, "same-seed"));
  });
});
