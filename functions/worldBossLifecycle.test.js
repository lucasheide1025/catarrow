"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizedConfig, evaluate, activeStatusPatch, buildCycle, cycleAfterCancellation } = require("./worldBossLifecycle");

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
    enabledTypes:["arrows", "dungeonClears", "monsterKills", "villageDice"],
  });
});

test("new active status fully replaces previous boss replay identity", () => {
  assert.deepEqual(activeStatusPatch("event-new", {
    bossKey:"cat_baobao",
    bossData:{ name:"Bao Bao" },
  }), {
    eventId:"event-new",
    status:"active",
    bossKey:"cat_baobao",
    bossName:"Bao Bao",
    announcement:null,
    killReplay:null,
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

test("time passing never summons a boss before the selected target is complete", () => {
  assert.equal(evaluate({
    status:"charging", restEndsAtMs:100, deadlineAtMs:200,
    targets:{ arrows:10, dungeonClears:10, monsterKills:10, villageDice:10 },
    progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0 },
  }, 200), null);
});

test("a forcibly cancelled boss starts a fresh cycle from its cancellation time", () => {
  const cycle = buildCycle("cancelled-event", {
    status:"cancelled", bossKey:"cat_baobao", cancelledAt:1000,
  }, 9000, normalizedConfig({ restHours:8, deadlineHours:48 }));

  assert.equal(cycle.previousEventId, "cancelled-event");
  assert.equal(cycle.restEndsAtMs, 1000 + 8 * 3600000);
  assert.equal(cycle.status, "resting");
});

test("cancelling a condition-spawned boss never reopens its already completed progress", () => {
  const config = normalizedConfig({ restHours:8, deadlineHours:48 });
  const current = {
    status:"spawned", spawnedEventId:"event-1", triggeredBy:"monsterKills",
    requiredType:"monsterKills",
    progress:{ arrows:0, dungeonClears:0, monsterKills:500, villageDice:0 },
    targets:{ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 },
  };
  const next = cycleAfterCancellation(current, "event-1", {
    status:"cancelled", bossKey:"boss-a", cancelledAt:1000,
  }, 1000, config);

  assert.equal(next.previousEventId, "event-1");
  assert.equal(next.progress.monsterKills, 0);
  assert.notEqual(next.status, "spawned");
});

test("cancelling an admin-spawned boss resumes its unfinished community progress", () => {
  const config = normalizedConfig({ restHours:0, deadlineHours:48 });
  const current = {
    status:"spawned", spawnedEventId:"event-2", triggeredBy:"admin",
    requiredType:"monsterKills",
    progress:{ arrows:0, dungeonClears:0, monsterKills:56, villageDice:0 },
    targets:{ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 },
  };
  const next = cycleAfterCancellation(current, "event-2", {
    status:"cancelled", bossKey:"boss-b", cancelledAt:1000,
  }, 1000, config);

  assert.equal(next.progress.monsterKills, 56);
  assert.equal(next.status, "charging");
});
