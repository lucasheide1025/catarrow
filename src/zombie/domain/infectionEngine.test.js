// src/zombie/domain/infectionEngine.test.js
// ═══════════════════════════════════════════════════════════════
//  🦠 感染引擎 — 單元測試
//  測試涵蓋：狀態建立、生命狀態解析、感染進程、醫療品應用
// ═══════════════════════════════════════════════════════════════

import {
  createInfectionState,
  resolveLifeState,
  processInfectionTick,
  processConsecutiveAttack,
  applyMedicalItem,
  canShoot,
  isAlive,
  INFECTION_EVENT,
} from "./infectionEngine";
import { LIFE_STATE, INFECTION_INITIAL_NODES, INFECTION_MAX_CONSECUTIVE } from "./types";

// ═════════════════════════════════════════════════════════════
//  createInfectionState
// ═════════════════════════════════════════════════════════════

describe("createInfectionState", () => {
  test("使用預設值建立（initialNodes=8, delays=0, consecutiveAttacks=0）", () => {
    const state = createInfectionState();
    expect(state).toEqual({
      remainingMapNodes: INFECTION_INITIAL_NODES,
      delays: 0,
      consecutiveAttacks: 0,
    });
  });

  test("可自訂 initialNodes", () => {
    const state = createInfectionState({ initialNodes: 5 });
    expect(state.remainingMapNodes).toBe(5);
  });

  test("可記錄感染來源 source", () => {
    const state = createInfectionState({ source: "重裝殭屍" });
    expect(state.source).toBe("重裝殭屍");
  });

  test("不傳 source 時不會有 source 欄位", () => {
    const state = createInfectionState();
    expect(state.source).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════
//  resolveLifeState
// ═════════════════════════════════════════════════════════════

describe("resolveLifeState", () => {
  test("null → HEALTHY", () => {
    expect(resolveLifeState(null)).toBe(LIFE_STATE.HEALTHY);
  });

  test("remainingMapNodes > 0, 無 delays, consecutiveAttacks < 上限 → INFECTED", () => {
    const state = createInfectionState({ initialNodes: 5 });
    expect(resolveLifeState(state)).toBe(LIFE_STATE.INFECTED);
  });

  test("remainingMapNodes <= 0 → FULLY_INFECTED", () => {
    const state = createInfectionState({ initialNodes: 0 });
    expect(resolveLifeState(state)).toBe(LIFE_STATE.FULLY_INFECTED);
  });

  test("有 delays → SUPPRESSED（即使 remainingMapNodes > 0）", () => {
    const state = createInfectionState({ initialNodes: 5 });
    state.delays = 1;
    expect(resolveLifeState(state)).toBe(LIFE_STATE.SUPPRESSED);
  });

  test("consecutiveAttacks 達上限 → INFECTED", () => {
    const state = createInfectionState({ initialNodes: 5 });
    state.consecutiveAttacks = INFECTION_MAX_CONSECUTIVE;
    expect(resolveLifeState(state)).toBe(LIFE_STATE.INFECTED);
  });

  test("consecutiveAttacks 未達上限 + remainingMapNodes > 0 → INFECTED", () => {
    const state = createInfectionState({ initialNodes: 5 });
    state.consecutiveAttacks = INFECTION_MAX_CONSECUTIVE - 1;
    expect(resolveLifeState(state)).toBe(LIFE_STATE.INFECTED);
  });
});

// ═════════════════════════════════════════════════════════════
//  processInfectionTick
// ═════════════════════════════════════════════════════════════

describe("processInfectionTick", () => {
  test("null state 回傳 null + 空事件", () => {
    const { state, events } = processInfectionTick(null);
    expect(state).toBeNull();
    expect(events).toEqual([]);
  });

  test("每 tick 減少 1 節點", () => {
    const state = createInfectionState({ initialNodes: 5 });
    const result = processInfectionTick(state);
    expect(result.state.remainingMapNodes).toBe(4);
    expect(result.events.length).toBeGreaterThan(0);
  });

  test("節點歸零時產生 FULLY_INFECTED 事件", () => {
    const state = createInfectionState({ initialNodes: 1 });
    const result = processInfectionTick(state);
    expect(result.state.remainingMapNodes).toBe(0);
    expect(result.events.some(e => e.type === INFECTION_EVENT.FULLY_INFECTED)).toBe(true);
  });

  test("節點從 0 再 tick 不會再產生 FULLY_INFECTED", () => {
    const state = createInfectionState({ initialNodes: 0 });
    const result = processInfectionTick(state);
    expect(result.state.remainingMapNodes).toBe(0);
    expect(result.events.every(e => e.type !== INFECTION_EVENT.FULLY_INFECTED)).toBe(true);
  });

  test("events 包含 NODE_DECREMENT 且記錄前後值", () => {
    const state = createInfectionState({ initialNodes: 8 });
    const result = processInfectionTick(state);
    const decrementEvent = result.events.find(e => e.type === INFECTION_EVENT.NODE_DECREMENT);
    expect(decrementEvent).toBeDefined();
    expect(decrementEvent.payload).toMatchObject({ previous: 8, remaining: 7 });
  });
});

// ═════════════════════════════════════════════════════════════
//  processConsecutiveAttack
// ═════════════════════════════════════════════════════════════

describe("processConsecutiveAttack", () => {
  test("null state 回傳 null + 空事件", () => {
    const { state, events } = processConsecutiveAttack(null);
    expect(state).toBeNull();
    expect(events).toEqual([]);
  });

  test("每次攻擊 +1 consecutiveAttacks", () => {
    const state = createInfectionState();
    const result = processConsecutiveAttack(state);
    expect(result.state.consecutiveAttacks).toBe(1);
  });

  test("可自訂 attackIncrement", () => {
    const state = createInfectionState();
    const result = processConsecutiveAttack(state, { attackIncrement: 2 });
    expect(result.state.consecutiveAttacks).toBe(2);
  });

  test("consecutiveAttacks 有上限保護", () => {
    const state = createInfectionState();
    state.consecutiveAttacks = INFECTION_MAX_CONSECUTIVE;
    const result = processConsecutiveAttack(state, { attackIncrement: 99 });
    expect(result.state.consecutiveAttacks).toBe(INFECTION_MAX_CONSECUTIVE + 1);
  });

  test("達上限時額外減少 2 節點", () => {
    const state = createInfectionState({ initialNodes: 10 });
    state.consecutiveAttacks = INFECTION_MAX_CONSECUTIVE - 1;
    const result = processConsecutiveAttack(state);
    expect(result.state.consecutiveAttacks).toBe(INFECTION_MAX_CONSECUTIVE);
    expect(result.state.remainingMapNodes).toBeLessThan(10);
  });

  test("達上限且節點歸零產生 FULLY_INFECTED", () => {
    const state = createInfectionState({ initialNodes: 1 });
    state.consecutiveAttacks = INFECTION_MAX_CONSECUTIVE - 1;
    const result = processConsecutiveAttack(state);
    expect(result.state.remainingMapNodes).toBe(0);
    expect(result.events.some(e => e.type === INFECTION_EVENT.FULLY_INFECTED)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
//  applyMedicalItem
// ═════════════════════════════════════════════════════════════

describe("applyMedicalItem — 免疫針 (med_immunization)", () => {
  test("感染狀態 → 重置 consecutiveAttacks，不治癒", () => {
    const state = createInfectionState();
    state.consecutiveAttacks = 2;
    const result = applyMedicalItem(state, "med_immunization");
    expect(result.state.consecutiveAttacks).toBe(0);
    expect(result.cured).toBe(false);
    expect(result.events[0].type).toBe(INFECTION_EVENT.IMMUNIZED);
  });

  test("健康狀態 → 沒有效果", () => {
    const result = applyMedicalItem(null, "med_immunization");
    expect(result.state).toBeNull();
    expect(result.events).toEqual([]);
    expect(result.cured).toBe(false);
  });
});

describe("applyMedicalItem — 抑制劑 (med_suppressant)", () => {
  test("感染狀態 → 增加 delays", () => {
    const state = createInfectionState({ initialNodes: 5 });
    const result = applyMedicalItem(state, "med_suppressant");
    expect(result.state.delays).toBe(1);
    expect(result.cured).toBe(false);
    expect(result.events[0].type).toBe(INFECTION_EVENT.SUPPRESSED);
  });

  test("健康狀態 → 沒有效果", () => {
    const result = applyMedicalItem(null, "med_suppressant");
    expect(result.state).toBeNull();
    expect(result.events).toEqual([]);
  });
});

describe("applyMedicalItem — 強效抑制劑 (med_strong_suppressant)", () => {
  test("感染狀態 → +5 節點 + 重置連續攻擊", () => {
    const state = createInfectionState({ initialNodes: 2 });
    state.consecutiveAttacks = 3;
    const result = applyMedicalItem(state, "med_strong_suppressant");
    expect(result.state.remainingMapNodes).toBe(7);  // 2 + 5
    expect(result.state.consecutiveAttacks).toBe(0);
    expect(result.state.delays).toBe(1);
    expect(result.cured).toBe(false);
    expect(result.events[0].type).toBe(INFECTION_EVENT.STRONG_SUPPRESSED);
  });

  test("健康狀態 → 沒有效果", () => {
    const result = applyMedicalItem(null, "med_strong_suppressant");
    expect(result.state).toBeNull();
    expect(result.cured).toBe(false);
  });
});

describe("applyMedicalItem — 實驗血清 (med_experimental_serum)", () => {
  test("感染狀態 → 完全治癒（null）", () => {
    const state = createInfectionState({ initialNodes: 5 });
    const result = applyMedicalItem(state, "med_experimental_serum");
    expect(result.state).toBeNull();  // null = 健康
    expect(result.cured).toBe(true);
    expect(result.events[0].type).toBe(INFECTION_EVENT.CURED);
  });

  test("完全感染狀態 → 也可治癒", () => {
    const state = createInfectionState({ initialNodes: 0 });
    const result = applyMedicalItem(state, "med_experimental_serum");
    expect(result.state).toBeNull();
    expect(result.cured).toBe(true);
    expect(result.events[0].payload.wasFullyInfected).toBe(true);
  });

  test("健康狀態 → 回傳 cured=false（沒有需要治癒的）", () => {
    const result = applyMedicalItem(null, "med_experimental_serum");
    expect(result.state).toBeNull();
    expect(result.cured).toBe(false);
  });
});

describe("applyMedicalItem — 未知藥品", () => {
  test("回傳原狀態 + 空事件 + cured=false", () => {
    const state = createInfectionState();
    const result = applyMedicalItem(state, "unknown_potion");
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expect(result.cured).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
//  canShoot / isAlive
// ═════════════════════════════════════════════════════════════

describe("canShoot", () => {
  test("HEALTHY → true", () => expect(canShoot(LIFE_STATE.HEALTHY)).toBe(true));
  test("INFECTED → true", () => expect(canShoot(LIFE_STATE.INFECTED)).toBe(true));
  test("SUPPRESSED → true", () => expect(canShoot(LIFE_STATE.SUPPRESSED)).toBe(true));
  test("FULLY_INFECTED → false", () => expect(canShoot(LIFE_STATE.FULLY_INFECTED)).toBe(false));
  test("DEAD → false", () => expect(canShoot(LIFE_STATE.DEAD)).toBe(false));
  test("EXTRACTED → false", () => expect(canShoot(LIFE_STATE.EXTRACTED)).toBe(false));
});

describe("isAlive", () => {
  test("HEALTHY → true", () => expect(isAlive(LIFE_STATE.HEALTHY)).toBe(true));
  test("FULLY_INFECTED → true（還活著，只是不能射箭）", () => expect(isAlive(LIFE_STATE.FULLY_INFECTED)).toBe(true));
  test("DEAD → false", () => expect(isAlive(LIFE_STATE.DEAD)).toBe(false));
  test("EXTRACTED → false", () => expect(isAlive(LIFE_STATE.EXTRACTED)).toBe(false));
});

// ═════════════════════════════════════════════════════════════
//  整合測試：完整感染生命週期
// ═════════════════════════════════════════════════════════════

describe("整合測試：完整感染生命週期", () => {
  test("初始感染 → 每節點遞減 → 完全感染 → 血清治癒", () => {
    let state = createInfectionState({ initialNodes: 3, source: "普通殭屍" });

    // 初始狀態
    expect(resolveLifeState(state)).toBe(LIFE_STATE.INFECTED);
    expect(state.remainingMapNodes).toBe(3);

    // 經過 3 個節點
    for (let i = 0; i < 3; i++) {
      const tick = processInfectionTick(state);
      state = tick.state;
    }

    expect(state.remainingMapNodes).toBe(0);
    expect(resolveLifeState(state)).toBe(LIFE_STATE.FULLY_INFECTED);

    // 血清治癒
    const cure = applyMedicalItem(state, "med_experimental_serum");
    expect(cure.state).toBeNull();
    expect(cure.cured).toBe(true);
    expect(resolveLifeState(cure.state)).toBe(LIFE_STATE.HEALTHY);
  });

  test("連續攻擊導致加速感染", () => {
    let state = createInfectionState({ initialNodes: 8 });

    // 連續 3 次攻擊觸發加速
    for (let i = 0; i < INFECTION_MAX_CONSECUTIVE; i++) {
      const result = processConsecutiveAttack(state);
      state = result.state;
    }

    // 應該已被加速減少節點
    expect(state.consecutiveAttacks).toBe(INFECTION_MAX_CONSECUTIVE);
    expect(state.remainingMapNodes).toBeLessThan(8);
    expect(state.remainingMapNodes).toBe(8 - 2); // 快速感染減 2
  });
});
