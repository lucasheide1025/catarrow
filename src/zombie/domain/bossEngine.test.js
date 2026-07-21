// src/zombie/domain/bossEngine.test.js
// ═══════════════════════════════════════════════════════════════
//  👑 殭屍生存模式 — BOSS 引擎單元測試（Phase 5）
// ═══════════════════════════════════════════════════════════════

import {
  createBossEncounter,
  processBossRound,
  resolveBossHit,
  getBossPhase,
  getBossStatus,
  BOSS_EVENT,
} from "./bossEngine";
import { BOSS_PHASE } from "./types";

// ══════════════════════════════════════════════════════════════

describe("createBossEncounter", () => {
  test("建立巨型殭屍王遭遇", () => {
    const state = createBossEncounter("giant_zombie_king", ["p1", "p2"]);
    expect(state).not.toBeNull();
    expect(state.isBoss).toBe(true);
    expect(state.bossId).toBe("giant_zombie_king");
  });

  test("BOSS 初始為護甲階段", () => {
    const state = createBossEncounter("giant_zombie_king", ["p1"]);
    const boss = Object.values(state.zombies)[0];
    expect(boss.phase).toBe(BOSS_PHASE.ARMORED);
  });

  test("初始距離可設定", () => {
    const state = createBossEncounter("giant_zombie_king", ["p1"], { startDistance: 20 });
    const boss = Object.values(state.zombies)[0];
    expect(boss.distanceM).toBe(20);
  });

  test("未知 BOSS ID 回傳 null", () => {
    expect(createBossEncounter("unknown_boss", ["p1"])).toBeNull();
  });

  test("建立 3 名生存者", () => {
    const state = createBossEncounter("giant_zombie_king", ["p1", "p2", "p3"]);
    expect(Object.keys(state.survivors)).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getBossPhase", () => {
  test("初始為護甲階段", () => {
    expect(getBossPhase({ totalTorsoHits: 0, heartCoreHits: 0 })).toBe(BOSS_PHASE.ARMORED);
  });

  test("軀幹命中 >= 12 轉狂暴", () => {
    expect(getBossPhase({ totalTorsoHits: 12, heartCoreHits: 0 })).toBe(BOSS_PHASE.ENRAGED);
  });

  test("心臟核心 >= 3 轉虛弱", () => {
    expect(getBossPhase({ totalTorsoHits: 12, heartCoreHits: 3 })).toBe(BOSS_PHASE.WEAKENED);
  });

  test("邊界值：11 軀幹仍為護甲", () => {
    expect(getBossPhase({ totalTorsoHits: 11, heartCoreHits: 0 })).toBe(BOSS_PHASE.ARMORED);
  });

  test("邊界值：2 心臟仍為狂暴", () => {
    expect(getBossPhase({ totalTorsoHits: 15, heartCoreHits: 2 })).toBe(BOSS_PHASE.ENRAGED);
  });
});

// ══════════════════════════════════════════════════════════════

describe("resolveBossHit", () => {
  test("護甲階段：胸腔命中累積裝甲傷害", () => {
    const boss = { body: { chest: 0, armor_layer: 0 }, totalTorsoHits: 0, heartCoreHits: 0, phase: BOSS_PHASE.ARMORED, bossId: "giant_zombie_king" };
    const result = resolveBossHit(boss, "chest", 1, BOSS_PHASE.ARMORED);
    expect(boss.totalTorsoHits).toBe(1);
    expect(result.additionalEvents[0].type).toBe(BOSS_EVENT.ARMOR_HIT);
    expect(result.killed).toBe(false);
  });

  test("護甲階段：12 次軀幹命中觸發階段轉換", () => {
    const boss = { body: { chest: 11, armor_layer: 11 }, totalTorsoHits: 11, heartCoreHits: 0, phase: BOSS_PHASE.ARMORED, bossId: "giant_zombie_king" };
    const result = resolveBossHit(boss, "chest", 12, BOSS_PHASE.ARMORED);
    expect(boss.phase).toBe(BOSS_PHASE.ENRAGED);
    expect(result.phaseChanged).toBe(true);
    expect(result.additionalEvents.some(e => e.type === BOSS_EVENT.PHASE_CHANGE)).toBe(true);
  });

  test("狂暴階段：心臟核心命中 3 次轉虛弱", () => {
    const boss = { body: { chest: 12, heart_core: 2 }, totalTorsoHits: 12, heartCoreHits: 2, phase: BOSS_PHASE.ENRAGED, bossId: "giant_zombie_king" };
    const result = resolveBossHit(boss, "heart", 3, BOSS_PHASE.ENRAGED);
    expect(boss.phase).toBe(BOSS_PHASE.WEAKENED);
    expect(result.phaseChanged).toBe(true);
  });

  test("虛弱階段：頭部一箭必殺", () => {
    const boss = { body: { head: 0 }, totalTorsoHits: 12, heartCoreHits: 3, phase: BOSS_PHASE.WEAKENED, alive: true, bossId: "giant_zombie_king" };
    const result = resolveBossHit(boss, "head", 1, BOSS_PHASE.WEAKENED);
    expect(result.killed).toBe(true);
    expect(boss.alive).toBe(false);
    expect(boss.phase).toBe(BOSS_PHASE.DEFEATED);
  });

  test("護甲階段：頭部命中不擊殺（無窗口模擬）", () => {
    const boss = { body: { head: 1 }, totalTorsoHits: 0, heartCoreHits: 0, phase: BOSS_PHASE.ARMORED, alive: true, bossId: "giant_zombie_king" };
    const result = resolveBossHit(boss, "head", 2, BOSS_PHASE.ARMORED);
    expect(result.killed).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════

describe("processBossRound", () => {
  test("BOSS 移動距離在速度範圍內", () => {
    const boss = { distanceM: 10, phase: BOSS_PHASE.ARMORED, phaseRound: 0, alive: true, bossId: "giant_zombie_king", body: { armor_layer: 5 }, totalTorsoHits: 5, heartCoreHits: 0 };
    const members = ["p1"];
    const customRand = () => 0.5; // 固定隨機值

    let current = boss;
    for (let i = 0; i < 10; i++) {
      const result = processBossRound(current, members, customRand);
      current = result.nextBoss;
      // 護甲階段速度範圍 1-2
      const move = boss.distanceM - current.distanceM;
    }
    // 檢查移動
    expect(current.distanceM).toBeLessThan(boss.distanceM);
  });

  test("橫掃攻擊產生事件", () => {
    const boss = { distanceM: 5, phase: BOSS_PHASE.ARMORED, phaseRound: 1, alive: true, bossId: "giant_zombie_king", body: { armor_layer: 5 }, totalTorsoHits: 5, heartCoreHits: 0 };
    // 用固定 rand 使 sweepChance 命中
    const customRand = () => 0.1;
    const result = processBossRound(boss, ["p1", "p2"], customRand);
    const hasSweep = result.events.some(e => e.type === BOSS_EVENT.SWEEP_ATTACK);
    expect(hasSweep).toBe(true);
  });

  test("屍彈投射產生事件", () => {
    const boss = { distanceM: 5, phase: BOSS_PHASE.ARMORED, phaseRound: 1, alive: true, bossId: "giant_zombie_king", body: { armor_layer: 5 }, totalTorsoHits: 5, heartCoreHits: 0 };
    const customRand = () => 0.1;
    const result = processBossRound(boss, ["p1", "p2"], customRand);
    const hasCorpse = result.events.some(e => e.type === BOSS_EVENT.CORPSE_PROJECTILE);
    expect(hasCorpse).toBe(true);
  });

  test("護甲修復在第 3 回合觸發", () => {
    const boss = { distanceM: 5, phase: BOSS_PHASE.ARMORED, phaseRound: 3, alive: true, bossId: "giant_zombie_king", body: { armor_layer: 8, armor_repaired: 0 }, totalTorsoHits: 5, heartCoreHits: 0 };
    const customRand = () => 0.5;
    const result = processBossRound(boss, ["p1"], customRand);
    const hasRepair = result.events.some(e => e.type === BOSS_EVENT.ARMOR_REPAIR);
    expect(hasRepair).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════

describe("getBossStatus", () => {
  test("回傳正確的 BOSS 狀態摘要", () => {
    const status = getBossStatus({
      phase: BOSS_PHASE.ARMORED, totalTorsoHits: 5, heartCoreHits: 1,
      phaseRound: 2, distanceM: 8, alive: true,
      body: { armor_layer: 5, armor_repaired: 1 },
    });
    expect(status.phase).toBe(BOSS_PHASE.ARMORED);
    expect(status.totalTorsoHits).toBe(5);
    expect(status.heartCoreHits).toBe(1);
    expect(status.phaseRound).toBe(2);
    expect(status.distanceM).toBe(8);
    expect(status.alive).toBe(true);
    expect(status.armorDamage).toBe(5);
    expect(status.armorRepairs).toBe(1);
  });
});
