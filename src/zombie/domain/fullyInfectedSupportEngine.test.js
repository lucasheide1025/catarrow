// src/zombie/domain/fullyInfectedSupportEngine.test.js
// ═══════════════════════════════════════════════════════════════
//  ☠️ 完全感染弱點標記引擎單元測試（Phase 5）
// ═══════════════════════════════════════════════════════════════

import {
  createFullyInfectedSupport,
  applyWeakPointMark,
  processMarkDurations,
  useInterference,
  addInterferenceScore,
  getMarkedZombies,
  getDamageBoost,
  getHalvedThreshold,
  resetSupportState,
  SUPPORT_EVENT,
  MARK_DEFAULT_DURATION,
  MARK_DEFAULT_BOOST,
  MAX_MARKED_ZOMBIES,
} from "./fullyInfectedSupportEngine";

// ══════════════════════════════════════════════════════════════

describe("createFullyInfectedSupport", () => {
  test("建立初始支援狀態", () => {
    const state = createFullyInfectedSupport();
    expect(state.interferenceScore).toBe(0);
    expect(state.interferenceCooldown).toBe(0);
    expect(state.interferenceUses).toBe(3);
    expect(state.markedZombies).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════════

describe("applyWeakPointMark", () => {
  test("標記殭屍成功", () => {
    const state = createFullyInfectedSupport();
    const result = applyWeakPointMark(state, "zombie_A", "chest");
    expect(result.events[0].type).toBe(SUPPORT_EVENT.MARK_APPLIED);
    expect(result.state.markedZombies.zombie_A).toBeTruthy();
    expect(result.state.markedZombies.zombie_A.duration).toBe(MARK_DEFAULT_DURATION);
    expect(result.state.markedZombies.zombie_A.damageBoost).toBeCloseTo(MARK_DEFAULT_BOOST);
  });

  test("刷新已存在的標記", () => {
    const state = createFullyInfectedSupport();
    const r1 = applyWeakPointMark(state, "zombie_A", "chest");
    const r2 = applyWeakPointMark(r1.state, "zombie_A", "head");
    expect(r2.events[0].type).toBe(SUPPORT_EVENT.MARK_REFRESHED);
    // 刷新疊加弱化
    expect(r2.state.markedZombies.zombie_A.damageBoost).toBeCloseTo(MARK_DEFAULT_BOOST * 0.5);
  });

  test("標記達上限時移除最舊標記", () => {
    let state = createFullyInfectedSupport();
    // 建立 3 個標記
    state = applyWeakPointMark(state, "zombie_A", "chest").state;
    state = applyWeakPointMark(state, "zombie_B", "chest").state;
    state = applyWeakPointMark(state, "zombie_C", "chest").state;
    // 第 4 個應移除最舊的 zombie_A
    const result = applyWeakPointMark(state, "zombie_D", "chest");
    expect(getMarkedZombies(result.state)).not.toContain("zombie_A");
    expect(getMarkedZombies(result.state)).toContain("zombie_D");
    expect(result.events.some(e => e.type === SUPPORT_EVENT.MARK_EXPIRED)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════

describe("processMarkDurations", () => {
  test("每回合減少標記持續時間", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest").state;
    expect(state.markedZombies.zombie_A.duration).toBe(3);
    state = processMarkDurations(state).state;
    expect(state.markedZombies.zombie_A.duration).toBe(2);
  });

  test("持續時間歸零時移除標記", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest", { duration: 1 }).state;
    expect(getMarkedZombies(state)).toHaveLength(1);
    const result = processMarkDurations(state);
    expect(getMarkedZombies(result.state)).toHaveLength(0);
    expect(result.events[0].type).toBe(SUPPORT_EVENT.MARK_EXPIRED);
  });

  test("冷卻時間遞減", () => {
    let state = createFullyInfectedSupport();
    state.interferenceCooldown = 2;
    state = processMarkDurations(state).state;
    expect(state.interferenceCooldown).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════

describe("useInterference", () => {
  test("成功干擾", () => {
    let state = createFullyInfectedSupport();
    state.interferenceScore = 5;
    const result = useInterference(state, "zombie_A");
    expect(result.success).toBe(true);
    expect(result.state.interferenceUses).toBe(2);
    expect(result.state.interferenceScore).toBe(0);
    expect(result.state.interferenceCooldown).toBe(2);
  });

  test("無剩餘次數時失敗", () => {
    let state = createFullyInfectedSupport();
    state.interferenceUses = 0;
    const result = useInterference(state, "zombie_A");
    expect(result.success).toBe(false);
  });

  test("冷卻中時失敗", () => {
    let state = createFullyInfectedSupport();
    state.interferenceCooldown = 1;
    const result = useInterference(state, "zombie_A");
    expect(result.success).toBe(false);
  });

  test("分數為 0 時失敗", () => {
    const state = createFullyInfectedSupport();
    const result = useInterference(state, "zombie_A");
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════

describe("addInterferenceScore", () => {
  test("增加干擾分數", () => {
    let state = createFullyInfectedSupport();
    state = addInterferenceScore(state).state;
    expect(state.interferenceScore).toBe(1);
    state = addInterferenceScore(state, 3).state;
    expect(state.interferenceScore).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getMarkedZombies", () => {
  test("無標記時回傳空陣列", () => {
    expect(getMarkedZombies(createFullyInfectedSupport())).toEqual([]);
  });

  test("回傳有效標記清單", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest").state;
    state = applyWeakPointMark(state, "zombie_B", "head").state;
    expect(getMarkedZombies(state)).toEqual(["zombie_A", "zombie_B"]);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getDamageBoost", () => {
  test("無標記時加成 = 1.0", () => {
    expect(getDamageBoost(createFullyInfectedSupport(), "zombie_A")).toBe(1.0);
  });

  test("有標記時回傳正確加成", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest").state;
    const boost = getDamageBoost(state, "zombie_A");
    expect(boost).toBeCloseTo(1.0 + MARK_DEFAULT_BOOST);
  });

  test("非標記目標回傳 1.0", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest").state;
    expect(getDamageBoost(state, "zombie_B")).toBe(1.0);
  });

  test("過期標記不提供加成", () => {
    let state = createFullyInfectedSupport();
    state = applyWeakPointMark(state, "zombie_A", "chest", { duration: 1 }).state;
    state = processMarkDurations(state).state;
    expect(getDamageBoost(state, "zombie_A")).toBe(1.0);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getHalvedThreshold", () => {
  test("普通殭屍門檻（head:1, torso:3）減半為 (2, 6)", () => {
    const threshold = getHalvedThreshold({ head: 1, torso: 3 });
    expect(threshold.head).toBe(2);
    expect(threshold.torso).toBe(6);
  });

  test("疾行殭屍門檻（head:2, torso:6）減半為 (4, 12)", () => {
    const threshold = getHalvedThreshold({ head: 2, torso: 6 });
    expect(threshold.head).toBe(4);
    expect(threshold.torso).toBe(12);
  });

  test("空值時回傳預設 (2, 6)", () => {
    const threshold = getHalvedThreshold(null);
    expect(threshold.head).toBe(2);
    expect(threshold.torso).toBe(6);
  });
});

// ══════════════════════════════════════════════════════════════

describe("resetSupportState", () => {
  test("重置後回到初始狀態", () => {
    let state = createFullyInfectedSupport();
    state.interferenceScore = 10;
    state.interferenceUses = 1;
    state = resetSupportState();
    expect(state.interferenceScore).toBe(0);
    expect(state.interferenceUses).toBe(3);
    expect(state.markedZombies).toEqual({});
  });
});
