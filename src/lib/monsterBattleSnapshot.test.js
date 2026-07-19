import { createMonsterBattleSnapshot, normalizeMonsterBattleSnapshot } from "./monsterBattleSnapshot";

describe("monster battle reconnect snapshot", () => {
  test("preserves locked battle settings and the performance session id", () => {
    const snapshot = createMonsterBattleSnapshot({
      ts: 1,
      monster: { id: "ghost_1" },
      mode: "veteran",
      battleMode: "score",
      round: 3,
      arrowsPerRound: 3,
      targetFmt: "field_16",
      targetMode: true,
      battleSessionId: "session-1",
      runtimeSnapshot: { version: 1, battle: { phase: "playing", round: 3 } },
      log: Array.from({ length: 10 }, (_, index) => index),
    });
    expect(normalizeMonsterBattleSnapshot(snapshot)).toMatchObject({
      mode: "veteran", round: 3, arrowsPerRound: 3, targetFmt: "field_16", targetMode: true, battleSessionId: "session-1",
      runtimeSnapshot: { version: 1, battle: { phase: "playing", round: 3 } },
    });
    expect(snapshot.log).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("keeps old snapshots compatible without silently changing to invalid settings", () => {
    expect(normalizeMonsterBattleSnapshot({ monster: { id: "ghost_1" } })).toMatchObject({
      mode: "student", battleMode: "score", round: 1, arrowsPerRound: 6, targetFmt: "full_110", targetMode: false,
    });
  });

  test("rejects snapshots without a monster identity", () => {
    expect(() => normalizeMonsterBattleSnapshot({ round: 2 })).toThrow("invalid_monster_battle_snapshot");
  });
});
