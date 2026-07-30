import {
  GUILD_LOG_STEP_MS,
  GUILD_VICTORY_CONFIRM_MS,
  buildBattleTimeline,
  collectDownedIds,
  guildBattleFinalizeDelay,
  retargetPendingShots,
} from "./guildBattlePresentation";

describe("公會戰結束演出", () => {
  test("全部敵人陣亡後保留確認動畫時間", () => {
    expect(guildBattleFinalizeDelay("won", 700)).toBe(700 + GUILD_VICTORY_CONFIRM_MS);
  });

  test("尚未勝利不額外拖慢每回合", () => {
    expect(guildBattleFinalizeDelay("fighting", 700)).toBe(700);
  });

  test("切換鎖定目標會同步改派尚未送出的箭", () => {
    const shots = [
      { targetInstanceId: "old", score: 10 },
      { targetInstanceId: "old", score: 9 },
    ];
    expect(retargetPendingShots(shots, "new")).toEqual([
      { targetInstanceId: "new", score: 10 },
      { targetInstanceId: "new", score: 9 },
    ]);
    expect(shots[0].targetInstanceId).toBe("old");
  });
});

describe("回合演出時間軸", () => {
  const log = [
    { type: "arrow", target: "m1", dmg: 12 },
    { type: "counterSuccess", monsterId: "m2", skill: "劇毒吐息" },
    { type: "arrow", target: "m2", dmg: 20, killed: true },
    { type: "skillResolve", monsterId: "m3", skill: "碎地衝擊", damage: 8 },
    { type: "catAttack", cat: "c1", target: "m1", dmg: 5, killed: true },
    { type: "dodge", from: "m3" },
    { type: "monsterAttack", from: "m3", dmg: 7 },
    { type: "skillIntent", monsterId: "m3", intent: { name: "碎地衝擊" } },
  ];

  test("嚴格照 log 原始順序排程，不按 type 分桶", () => {
    const { timeline } = buildBattleTimeline(log);
    expect(timeline.map(t => t.entry.type)).toEqual(log.map(l => l.type));
    // 時間必須單調不遞減
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i].at).toBeGreaterThanOrEqual(timeline[i - 1].at);
    }
  });

  test("技能反制排在對應那一箭之後、下一箭之前（分桶版會排到最後）", () => {
    const { timeline } = buildBattleTimeline(log);
    const firstArrow = timeline[0];
    const counter = timeline.find(t => t.entry.type === "counterSuccess");
    const secondArrow = timeline.find((t, i) => t.entry.type === "arrow" && i > 0);
    expect(counter.at).toBeGreaterThan(firstArrow.at);
    expect(counter.at).toBeLessThanOrEqual(secondArrow.at);
  });

  test("閃避與怪物攻擊保持交錯，不會被拆成兩排", () => {
    const { timeline } = buildBattleTimeline(log);
    const dodgeIdx = timeline.findIndex(t => t.entry.type === "dodge");
    const attackIdx = timeline.findIndex(t => t.entry.type === "monsterAttack");
    expect(attackIdx).toBe(dodgeIdx + 1);
  });

  test("totalMs 等於所有已知型別的步長總和", () => {
    const { totalMs } = buildBattleTimeline(log);
    const expected = log.reduce((sum, l) => sum + (GUILD_LOG_STEP_MS[l.type] || 0), 0);
    expect(totalMs).toBe(expected);
  });

  test("未知型別不佔時間但仍保留在時間軸上（不可靜默丟棄）", () => {
    const withUnknown = [{ type: "travelSupply", food: -1 }, ...log];
    const { timeline, totalMs } = buildBattleTimeline(withUnknown);
    expect(timeline).toHaveLength(withUnknown.length);
    expect(timeline[0].at).toBe(0);
    expect(timeline[1].at).toBe(0);
    expect(totalMs).toBe(buildBattleTimeline(log).totalMs);
  });

  test("空 log 不會爆，總長為 0", () => {
    expect(buildBattleTimeline([])).toEqual({ timeline: [], totalMs: 0 });
    expect(buildBattleTimeline(undefined).totalMs).toBe(0);
  });

  test("skillIntent 有自己的步長——它是 spec 要求的「提前一個射擊階段預告」，不能沒有演出時間", () => {
    expect(GUILD_LOG_STEP_MS.skillIntent).toBeGreaterThan(0);
  });

  test("collectDownedIds 依序收集被擊殺的目標且不重複", () => {
    expect(collectDownedIds(log)).toEqual(["m2", "m1"]);
    expect(collectDownedIds([
      { type: "arrow", target: "m1", killed: true },
      { type: "catAttack", target: "m1", killed: true },
    ])).toEqual(["m1"]);
    expect(collectDownedIds([])).toEqual([]);
  });
});
