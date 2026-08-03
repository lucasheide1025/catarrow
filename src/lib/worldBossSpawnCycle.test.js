import fs from "fs";
import path from "path";
import {
  SPAWN_PROGRESS_TYPES, WORLD_BOSS_SPAWN_DEFAULTS,
  describeSpawnCycle, evaluateWorldBossSpawnCycle, spawnProgressRatio,
} from "./worldBossSpawnCycle";

const H = 3600000;
const cycle = (over = {}) => ({
  status: "resting", previousEventId: "e1", previousBossKey: "b1",
  restEndsAtMs: 8 * H, deadlineAtMs: 48 * H,
  progress: { arrows: 0, dungeonClears: 0, monsterKills: 0, villageDice: 0 },
  targets: { ...WORLD_BOSS_SPAWN_DEFAULTS.targets },
  ...over,
});

describe("⚠️ 客戶端與雲端的預設值不准漂掉", () => {
  // 兩邊是不同的執行環境（瀏覽器 / Cloud Functions），沒辦法共用模組，
  // 只能靠這條測試把它們釘在一起。以前就是各自維護，才會演變成「兩套卡在一起」。
  test("跟 functions/worldBossLifecycle.js 的 DEFAULTS 完全一致", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "functions", "worldBossLifecycle.js"), "utf8");
    // ⚠️ 刻意不用反斜線的字元類（[ ]* / [0-9]+）——這支測試被 heredoc 吃掉過反斜線，
    //    `\s` 在 JS 字串裡等於 `s`，regex 會靜靜地變成永遠不匹配。
    const pick = key => Number(new RegExp(key + ":[ ]*([0-9]+)").exec(src)?.[1]);
    expect(pick("restHours")).toBe(WORLD_BOSS_SPAWN_DEFAULTS.restHours);
    expect(pick("deadlineHours")).toBe(WORLD_BOSS_SPAWN_DEFAULTS.deadlineHours);
    for (const [key, value] of Object.entries(WORLD_BOSS_SPAWN_DEFAULTS.targets)) {
      expect(pick(key)).toBe(value);
    }
  });

  test("⚠️ 客戶端不再匯出任何「寫入」用的函式——只有唯讀", () => {
    // eslint-disable-next-line global-require
    const mod = require("./worldBossSpawnCycle");
    expect(mod.buildWorldBossSpawnCycle).toBeUndefined();
    expect(mod.applyWorldBossSpawnContribution).toBeUndefined();
  });
});

describe("週期狀態判讀（唯讀）", () => {
  test("休息期間不算可生成，並回報還要多久", () => {
    const ev = evaluateWorldBossSpawnCycle(cycle(), 3 * H);
    expect(ev).toMatchObject({ ready: false, reason: "resting" });
    expect(ev.remainingMs).toBe(5 * H);
  });

  test("休息結束後進入蓄力，任一項達標就可生成", () => {
    for (const type of SPAWN_PROGRESS_TYPES) {
      const c = cycle({ progress: { [type]: WORLD_BOSS_SPAWN_DEFAULTS.targets[type] } });
      expect(evaluateWorldBossSpawnCycle(c, 9 * H)).toMatchObject({ ready: true, reason: type });
    }
  });

  test("⚠️ 沒人推進度也要能出王——到期限就生成", () => {
    expect(evaluateWorldBossSpawnCycle(cycle(), 48 * H)).toMatchObject({ ready: true, reason: "deadline" });
  });

  test("⚠️ 還在休息時就算進度滿了也不生成——休息期是刻意的節奏", () => {
    const c = cycle({ progress: { arrows: 999999 } });
    expect(evaluateWorldBossSpawnCycle(c, 1 * H).ready).toBe(false);
  });

  test("已經在生成或生成完就不重複判定", () => {
    for (const status of ["spawning", "spawned"]) {
      expect(evaluateWorldBossSpawnCycle(cycle({ status }), 99 * H).ready).toBe(false);
    }
  });

  test("沒有週期文件不會炸", () => {
    expect(evaluateWorldBossSpawnCycle(null)).toMatchObject({ ready: false, reason: "missing" });
  });
});

describe("大廳顯示", () => {
  test("進度比例夾在 0~1", () => {
    expect(spawnProgressRatio(cycle({ progress: { arrows: 5000 } }), "arrows")).toBe(0.5);
    expect(spawnProgressRatio(cycle({ progress: { arrows: 999999 } }), "arrows")).toBe(1);
    expect(spawnProgressRatio(null, "arrows")).toBe(0);
  });

  test("每個階段都給得出一句人話", () => {
    expect(describeSpawnCycle(cycle(), 1 * H)).toContain("沉寂");
    expect(describeSpawnCycle(cycle(), 9 * H)).toContain("進度");
    expect(describeSpawnCycle(cycle(), 48 * H)).toContain("降臨");
    expect(describeSpawnCycle(null)).toContain("還沒有");
  });
});
