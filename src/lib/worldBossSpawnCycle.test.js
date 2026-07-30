import { applyWorldBossSpawnContribution, buildWorldBossSpawnCycle, evaluateWorldBossSpawnCycle } from "./worldBossSpawnCycle";

test("擊倒後八小時內不累積進度", () => {
  const cycle = buildWorldBossSpawnCycle({ previousEventId:"e1", previousBossKey:"b1", defeatedAtMs:0 });
  expect(applyWorldBossSpawnContribution(cycle, "arrows", 999, 7 * 3600000).progress.arrows).toBe(0);
});

test.each([
  ["arrows", 10000], ["dungeonClears", 30], ["monsterKills", 500], ["villageDice", 300],
])("%s 任一條達標即可召喚", (type, amount) => {
  const cycle = buildWorldBossSpawnCycle({ previousEventId:"e1", previousBossKey:"b1", defeatedAtMs:0 });
  const charged = applyWorldBossSpawnContribution(cycle, type, amount, 9 * 3600000);
  expect(evaluateWorldBossSpawnCycle(charged, 9 * 3600000)).toMatchObject({ ready:true, reason:type });
});

test("最晚四十八小時自動達標", () => {
  const cycle = buildWorldBossSpawnCycle({ previousEventId:"e1", previousBossKey:"b1", defeatedAtMs:0 });
  expect(evaluateWorldBossSpawnCycle(cycle, 48 * 3600000)).toMatchObject({ ready:true, reason:"deadline" });
});
