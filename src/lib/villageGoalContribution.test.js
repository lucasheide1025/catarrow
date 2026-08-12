import {
  isQualifyingMonsterKill, isWorldBossSpawnMonsterKill, soloExplorationCompletionOperation,
  teamExplorationCompletionOperation, villageGoalOperationKey,
} from "./villageGoalContribution";

test("只有真正勝利且怪物 HP 歸零才算擊殺", () => {
  expect(isQualifyingMonsterKill({ memberId: "m1", result: "win", finalMonsterHp: 0 })).toBe(true);
  expect(isQualifyingMonsterKill({ memberId: "m1", result: "lose", finalMonsterHp: 0 })).toBe(false);
  expect(isQualifyingMonsterKill({ memberId: "m1", result: "win", finalMonsterHp: 1 })).toBe(false);
});

test("世界王誕生擊殺只計七族 PvE：單人、組隊、地下城", () => {
  const base = { memberId:"m1", result:"win", finalMonsterHp:0 };
  expect(isWorldBossSpawnMonsterKill(base)).toBe(true);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"monster" })).toBe(true);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"party" })).toBe(true);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"dungeon" })).toBe(true);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"duel" })).toBe(false);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"worldBoss" })).toBe(false);
  expect(isWorldBossSpawnMonsterKill({ ...base, sourceMode:"zombie" })).toBe(false);
  expect(isWorldBossSpawnMonsterKill({ ...base, result:"lose" })).toBe(false);
  expect(isWorldBossSpawnMonsterKill({ ...base, finalMonsterHp:1 })).toBe(false);
});

test("單人只有完成終點才產生一次穩定的探險完成操作", () => {
  const input = { memberId: "m1", mapId: "forest", journeySeed: "seed-1" };
  expect(soloExplorationCompletionOperation(input)).toBeNull();
  expect(soloExplorationCompletionOperation({ ...input, completed: true })).toBe("solo:m1:forest:seed-1");
  expect(soloExplorationCompletionOperation({ ...input, completed: true })).toBe("solo:m1:forest:seed-1");
});

test("組隊只有房主在完成終點時產生全隊唯一操作", () => {
  const input = { hostId: "host", roomId: "room-1", sequence: 9, completed: true };
  expect(teamExplorationCompletionOperation({ ...input, memberId: "guest" })).toBeNull();
  expect(teamExplorationCompletionOperation({ ...input, memberId: "host", completed: false })).toBeNull();
  expect(teamExplorationCompletionOperation({ ...input, memberId: "host" })).toBe("team:room-1:9");
});

test("同一 shooting session 的立即寫入與 deferred replay 共用冪等鍵", () => {
  expect(villageGoalOperationKey("monster:session-123")).toBe(villageGoalOperationKey("monster:session-123"));
  expect(villageGoalOperationKey("monster:session-123")).not.toBe(villageGoalOperationKey("monster_session-123"));
});
