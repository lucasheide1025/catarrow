"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizedConfig, evaluate } = require("./worldBossLifecycle");

test("world boss lifecycle clamps deadline to 48 hours and keeps all four targets", () => {
  const config = normalizedConfig({
    restHours:8,
    deadlineHours:99,
    targets:{ arrows:123, dungeonClears:4, monsterKills:56, villageDice:7 },
  });
  assert.deepEqual(config, {
    restHours:8,
    deadlineHours:48,
    targets:{ arrows:123, dungeonClears:4, monsterKills:56, villageDice:7 },
  });
});

test("any completed community target can summon after the rest period", () => {
  for (const key of ["arrows", "dungeonClears", "monsterKills", "villageDice"]) {
    const cycle = {
      status:"charging", restEndsAtMs:100, deadlineAtMs:1000,
      targets:{ arrows:10, dungeonClears:10, monsterKills:10, villageDice:10 },
      progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0, [key]:10 },
    };
    assert.equal(evaluate(cycle, 101), key);
  }
});

test("deadline summons even when no target is complete", () => {
  assert.equal(evaluate({
    status:"charging", restEndsAtMs:100, deadlineAtMs:200,
    targets:{ arrows:10, dungeonClears:10, monsterKills:10, villageDice:10 },
    progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0 },
  }, 200), "deadline");
});
