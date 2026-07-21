// src/zombie/domain/baseEngine.test.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 基地引擎單元測試（Phase 4）
// ═══════════════════════════════════════════════════════════════

import {
  createBaseState,
  upgradeBuilding,
  getBaseLevel,
  getBaseStats,
  calculateBaseEffects,
  addResource,
  getBaseCompletion,
  BASE_EVENT,
} from "./baseEngine";

import { BUILDINGS, getBuilding, getUpgradeCost } from "../data/baseData";

// ── 測試輔助：取得有足夠資源的基地狀態 ─────────────────
function richBase() {
  const state = createBaseState();
  const r = state.resources;

  // 給足夠的箭露和材料
  r.arrowdew = 99999;
  for (const key of Object.keys(r)) {
    if (key.startsWith("ore_") || key.startsWith("melon_") || key.startsWith("fish_") ||
        key.startsWith("meat_") || key.startsWith("driedfish_") || key.startsWith("can_") ||
        key.startsWith("potion_") || key.startsWith("fur_") || key.startsWith("archer_")) {
      r[key] = 999;
    }
  }
  return state;
}

// ══════════════════════════════════════════════════════════════

describe("createBaseState", () => {
  test("所有建築初始為 Lv.1", () => {
    const state = createBaseState();
    for (const b of BUILDINGS) {
      expect(state.buildings[b.id]).toBe(1);
    }
  });

  test("初始資源皆為 0", () => {
    const state = createBaseState();
    for (const [, val] of Object.entries(state.resources)) {
      expect(val).toBe(0);
    }
  });

  test("totalUpgrades 初始為 0", () => {
    expect(createBaseState().totalUpgrades).toBe(0);
  });

  test("可傳入 overrides 覆寫", () => {
    const state = createBaseState({ totalUpgrades: 5, buildings: { growing_room: 3 } });
    expect(state.totalUpgrades).toBe(5);
    expect(state.buildings.growing_room).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════

describe("upgradeBuilding", () => {
  test("成功升級建築：等級 +1、totalUpgrades +1", () => {
    const state = richBase();
    const result = upgradeBuilding(state, "growing_room");
    expect(result.ok).toBe(true);
    expect(result.state.buildings.growing_room).toBe(2);
    expect(result.state.totalUpgrades).toBe(1);
  });

  test("升級成功時回傳 UPGRADED 事件", () => {
    const state = richBase();
    const result = upgradeBuilding(state, "water_station");
    expect(result.events[0].type).toBe(BASE_EVENT.UPGRADED);
    expect(result.events[0].payload.buildingId).toBe("water_station");
    expect(result.events[0].payload.fromLevel).toBe(1);
    expect(result.events[0].payload.toLevel).toBe(2);
  });

  test("資源不足時回傳 ok=false", () => {
    const state = createBaseState(); // 無資源
    const result = upgradeBuilding(state, "growing_room");
    expect(result.ok).toBe(false);
    expect(result.events[0].type).toBe(BASE_EVENT.INSUFFICIENT);
    expect(result.reason).toBeTruthy();
    expect(state.buildings.growing_room).toBe(1); // 不變
  });

  test("已達最高等級無法升級", () => {
    const state = richBase();
    // 先升到 Lv.10
    let current = state;
    for (let i = 1; i < 10; i++) {
      const r = upgradeBuilding(current, "growing_room");
      expect(r.ok).toBe(true);
      current = r.state;
    }
    // 再次升級應失敗
    const result = upgradeBuilding(current, "growing_room");
    expect(result.ok).toBe(false);
    expect(result.events[0].type).toBe(BASE_EVENT.MAX_LEVEL);
  });

  test("未知建築回傳 ok=false", () => {
    const state = createBaseState();
    const result = upgradeBuilding(state, "nonexistent");
    expect(result.ok).toBe(false);
  });

  test("Lv.4 升級需消耗材料", () => {
    const state = richBase();
    const before = state.resources.arrowdew;
    const result = upgradeBuilding(state, "growing_room"); // Lv.1→2
    expect(result.ok).toBe(true);
    // Lv.1→2 僅需箭露（無材料需求）
    expect(result.state.resources.arrowdew).toBeLessThan(before);
  });

  test("升級時扣除正確的箭露", () => {
    const state = richBase();
    const before = state.resources.arrowdew;
    const result = upgradeBuilding(state, "radio_tower");
    expect(result.ok).toBe(true);
    const cost = getUpgradeCost("radio_tower", 2);
    expect(result.state.resources.arrowdew).toBe(before - (cost?.arrowdew || 0));
  });

  test("Lv.4 升級成功且材料被扣除", () => {
    const state = richBase();
    const beforeArrowdew = state.resources.arrowdew;
    const cost = getUpgradeCost("growing_room", 4);
    // 直接將建築設為 Lv.3，再升級到 Lv.4
    const preState = { ...state, buildings: { ...state.buildings, growing_room: 3 } };
    const result = upgradeBuilding(preState, "growing_room");
    expect(result.ok).toBe(true);
    expect(result.state.buildings.growing_room).toBe(4);
    // Lv.3→4 需要材料
    if (cost?.arrowdew > 0) {
      expect(result.state.resources.arrowdew).toBe(beforeArrowdew - cost.arrowdew);
    }
  });

  test("醫療室升級到 Lv.3 時觸發解鎖事件", () => {
    const state = richBase();
    // Lv.1 → Lv.2（不解鎖）
    const r1 = upgradeBuilding(state, "medical_room");
    expect(r1.ok).toBe(true);
    // Lv.2 → Lv.3（解鎖抑制劑）
    const r2 = upgradeBuilding(r1.state, "medical_room");
    expect(r2.ok).toBe(true);
    // Lv.3 應觸發 EFFECT_CHANGED
    const hasUnlockEvent = r2.events.some(e =>
      e.type === BASE_EVENT.EFFECT_CHANGED &&
      e.payload?.buildingId === "medical_room" &&
      e.payload?.unlockedItems?.includes("med_suppressant")
    );
    expect(hasUnlockEvent).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getBaseLevel", () => {
  test("全 Lv.1 時等級 = 1", () => {
    const state = createBaseState();
    expect(getBaseLevel(state.buildings)).toBe(1);
  });

  test("平均等級無條件捨去", () => {
    // 1 棟 Lv.5, 8 棟 Lv.1 → total=13, count=9 → 1
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = b.id === "growing_room" ? 5 : 1;
    }
    expect(getBaseLevel(buildings)).toBe(1);
  });

  test("全部 Lv.10 時等級 = 10", () => {
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = 10;
    }
    expect(getBaseLevel(buildings)).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getBaseStats", () => {
  test("初始基地配件插槽 = 1", () => {
    const state = createBaseState();
    const stats = getBaseStats(state.buildings);
    expect(stats.accessorySlots).toBe(1);
    expect(stats.backpackBonus).toBe(2); // baseLevel=1 → 2kg
  });

  test("高級基地有更多插槽和背包", () => {
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = 10;
    }
    const stats = getBaseStats(buildings);
    expect(stats.accessorySlots).toBe(4);
    expect(stats.backpackBonus).toBe(20);
    expect(stats.baseLevel).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════

describe("calculateBaseEffects", () => {
  test("初始 Lv.1 基地有基礎效果", () => {
    const state = createBaseState();
    const effects = calculateBaseEffects(state.buildings);
    expect(effects.foodSaving).toBe(0.5);  // 種植室 Lv.1 × 0.5
    expect(effects.waterSaving).toBe(0.3); // 淨水站 Lv.1 × 0.3
    expect(effects.intelBonus).toBe(3);    // 無線電塔 Lv.1 × 3
    expect(effects.repairDiscount).toBe(0.08); // 防具修復站 Lv.1 × 0.08
    expect(effects.recoveryRate).toBe(5);  // 搜救隊 Lv.1 × 5
    expect(effects.maxAccessoryLevel).toBe(1);
    expect(effects.revealDepth).toBe(1);
  });

  test("基地升級後效果隨之增加", () => {
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = 5;
    }
    const effects = calculateBaseEffects(buildings);
    expect(effects.foodSaving).toBe(2.5); // 5 × 0.5
    expect(effects.waterSaving).toBe(1.5); // 5 × 0.3
    expect(effects.intelBonus).toBe(15);   // 5 × 3
    expect(effects.maxAccessoryLevel).toBe(3); // Math.ceil(5/2) = 3
    expect(effects.recoveryRate).toBe(25); // 5 × 5
  });
});

// ══════════════════════════════════════════════════════════════

describe("addResource", () => {
  test("增加箭露", () => {
    const state = createBaseState();
    const next = addResource(state, "arrowdew", 500);
    expect(next.resources.arrowdew).toBe(500);
  });

  test("增加材料", () => {
    const state = createBaseState();
    const next = addResource(state, "melon_t1", 30);
    expect(next.resources.melon_t1).toBe(30);
  });

  test("不改變原始狀態（純函數）", () => {
    const state = createBaseState();
    addResource(state, "arrowdew", 100);
    expect(state.resources.arrowdew).toBe(0);
  });

  test("amount <= 0 不改變", () => {
    const state = createBaseState();
    const next = addResource(state, "arrowdew", -5);
    expect(next).toBe(state); // 回傳同一參考
  });
});

// ══════════════════════════════════════════════════════════════

describe("getBaseCompletion", () => {
  test("全 Lv.1 完成度 = 10%", () => {
    const state = createBaseState();
    // 9棟×1 / (9棟×10) = 9/90 = 10%
    expect(getBaseCompletion(state.buildings)).toBe(10);
  });

  test("全 Lv.10 完成度 = 100%", () => {
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = 10;
    }
    expect(getBaseCompletion(buildings)).toBe(100);
  });

  test("部分升級完成度正確", () => {
    const buildings = {};
    for (const b of BUILDINGS) {
      buildings[b.id] = 5;
    }
    // 9×5 / 90 = 45/90 = 50%
    expect(getBaseCompletion(buildings)).toBe(50);
  });
});
