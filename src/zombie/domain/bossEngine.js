// src/zombie/domain/bossEngine.js
// ═══════════════════════════════════════════════════════════════
//  👑 殭屍生存模式 — BOSS 戰鬥引擎（Phase 5）
//  巨型殭屍王：護甲→狂暴→虛弱 三階段純函數引擎
// ═══════════════════════════════════════════════════════════════

import { getBOSSArchetype } from "../data/zombieArchetypes";
import { BOSS_PHASE } from "./types";

// ═════════════════════════════════════════════════════════════
//  BOSS 事件類型
// ═════════════════════════════════════════════════════════════

export const BOSS_EVENT = {
  PHASE_CHANGE:       "boss_phase_change",        // 階段轉換
  ARMOR_HIT:          "boss_armor_hit",            // 護甲命中
  HEART_CORE_HIT:     "boss_heart_core_hit",      // 心臟核心命中
  SWEEP_ATTACK:       "boss_sweep_attack",         // 橫掃攻擊
  CORPSE_PROJECTILE:  "boss_corpse_projectile",    // 屍彈投射
  ARMOR_REPAIR:       "boss_armor_repair",         // 裝甲修復
  WEAKPOINT_EXPOSED:  "boss_weakpoint_exposed",    // 弱點暴露
  BOSS_DEFEATED:      "boss_defeated",             // BOSS 擊殺
  BOSS_REWARD:        "boss_reward",               // 獎勵計算
};

// ── BOSS 核心數值 ─────────────────────────────────────────
const BOSS_CONFIG = {
  giant_zombie_king: {
    // 護甲階段門檻（軀幹累積命中數）
    armorTorsoThreshold: 12,
    // 狂暴階段觸發（護甲擊破後）
    enrageThreshold: 12,
    // 虛弱階段觸發（心臟核心命中次數）
    weakenHeartHits: 3,
    // 頭部弱點命中數（虛弱階段一箭必殺）
    headWeaknessHits: 1,
    // 每回合移動（依階段）
    speedByPhase: {
      [BOSS_PHASE.ARMORED]:  { min: 1, max: 2 },
      [BOSS_PHASE.ENRAGED]:  { min: 2, max: 4 },
      [BOSS_PHASE.WEAKENED]: { min: 0, max: 1 },
    },
    // 裝甲修復間隔（回合）
    armorRepairInterval: 3,
    // 橫掃攻擊機率
    sweepChance: 0.35,
    // 屍彈投射機率
    corpseChance: 0.25,
  },
};

/**
 * 建立 BOSS 遭遇狀態
 * @param {string} bossId
 * @param {string[]} memberIds
 * @param {object} [options]
 * @returns {BossEncounterState}
 */
export function createBossEncounter(bossId, memberIds, options = {}) {
  const { startDistance = 12, rand = Math.random } = options;
  const bDef = getBOSSArchetype(bossId);
  if (!bDef) return null;

  const config = BOSS_CONFIG[bossId] || BOSS_CONFIG.giant_zombie_king;

  const boss = {
    id: bossId,
    archetypeId: "boss",
    bossId,
    targetSlot: "A",
    distanceM: startDistance,
    body: {
      head: 0,
      neck: 0,
      chest: 0,
      belly: 0,
      arm: 0,
      groin: 0,
      // BOSS 專屬部位
      armor_layer: 0,      // 護甲層累積傷害（armored phase）
      heart_core: 0,       // 心臟核心傷害（enraged phase）
      armor_repaired: 0,   // 裝甲修復次數
    },
    statuses: [],
    alive: true,
    justArrived: true,
    // BOSS 專屬狀態
    phase: BOSS_PHASE.ARMORED,
    phaseRound: 0,          // 當前階段的已過回合數
    totalTorsoHits: 0,      // 累計軀幹命中
    heartCoreHits: 0,       // 心臟核心累計命中
    nextArmorRepairRound: config.armorRepairInterval,
  };

  const survivors = {};
  for (const id of memberIds) {
    survivors[id] = {
      id,
      name: `玩家 ${id.slice(0, 4)}`,
      role: "main_archer",
      alive: true,
      lifeState: "healthy",
      armor: {},
      infection: null,
    };
  }

  return {
    round: 0,
    zombies: { [bossId]: boss },
    survivors,
    isBoss: true,
    bossId,
  };
}

/**
 * 取得當前 BOSS 階段
 * @param {object} bossState
 * @returns {string} BOSS_PHASE 其一
 */
export function getBossPhase(bossState) {
  const { totalTorsoHits, heartCoreHits } = bossState;
  const config = BOSS_CONFIG[bossState.bossId] || BOSS_CONFIG.giant_zombie_king;

  // 虛弱階段：心臟核心命中足夠次數
  if (heartCoreHits >= config.weakenHeartHits) {
    return BOSS_PHASE.WEAKENED;
  }
  // 狂暴階段：護甲擊破（軀幹命中超過護甲門檻）
  if (totalTorsoHits >= config.enrageThreshold) {
    return BOSS_PHASE.ENRAGED;
  }
  // 預設：護甲階段
  return BOSS_PHASE.ARMORED;
}

/**
 * 處理 BOSS 專屬命中
 * @param {object} bossState
 * @param {string} hitPart
 * @param {number} bodyCount — 該部位目前累積命中（含此箭）
 * @param {string} phase
 * @returns {{ additionalEvents: Array, killed: boolean, phaseChanged: boolean }}
 */
export function resolveBossHit(bossState, hitPart, bodyCount, phase) {
  const events = [];
  let killed = false;
  let phaseChanged = false;
  const config = BOSS_CONFIG[bossState.bossId] || BOSS_CONFIG.giant_zombie_king;

  // 護甲階段：軀幹命中累積至 armor_layer
  if (phase === BOSS_PHASE.ARMORED) {
    if (hitPart === "chest" || hitPart === "belly") {
      bossState.totalTorsoHits = (bossState.totalTorsoHits || 0) + 1;
      const currentArmor = bossState.body.armor_layer || 0;
      const newArmor = currentArmor + 1;
      bossState.body.armor_layer = newArmor;

      events.push({
        type: BOSS_EVENT.ARMOR_HIT,
        payload: {
          totalTorso: bossState.totalTorsoHits,
          threshold: config.armorTorsoThreshold,
          armorDamage: newArmor,
        },
      });

      // 護甲擊破 → 轉狂暴
      if (bossState.totalTorsoHits >= config.armorTorsoThreshold &&
          bossState.phase === BOSS_PHASE.ARMORED) {
        bossState.phase = BOSS_PHASE.ENRAGED;
        bossState.phaseRound = 0;
        phaseChanged = true;
        events.push({
          type: BOSS_EVENT.PHASE_CHANGE,
          payload: { from: BOSS_PHASE.ARMORED, to: BOSS_PHASE.ENRAGED },
        });
        events.push({
          type: BOSS_EVENT.WEAKPOINT_EXPOSED,
          payload: { weakPoint: "心臟核心" },
        });
      }
    }

    // 護甲階段：頭部直接命中但窗口有限（模擬方式：純傷害累積）
    if (hitPart === "head") {
      // 頭部仍有效但窗口有限，累積傷害
      events.push({
        type: BOSS_EVENT.ARMOR_HIT,
        payload: { part: "head", totalTorso: bossState.totalTorsoHits },
      });
    }
  }

  // 狂暴階段：心臟核心命中
  if (phase === BOSS_PHASE.ENRAGED || phase === BOSS_PHASE.WEAKENED) {
    if (hitPart === "chest" || hitPart === "heart") {
      bossState.heartCoreHits = (bossState.heartCoreHits || 0) + 1;
      events.push({
        type: BOSS_EVENT.HEART_CORE_HIT,
        payload: {
          hits: bossState.heartCoreHits,
          threshold: config.weakenHeartHits,
        },
      });

      // 心臟擊破 → 轉虛弱
      if (bossState.heartCoreHits >= config.weakenHeartHits &&
          bossState.phase === BOSS_PHASE.ENRAGED) {
        bossState.phase = BOSS_PHASE.WEAKENED;
        bossState.phaseRound = 0;
        phaseChanged = true;
        events.push({
          type: BOSS_EVENT.PHASE_CHANGE,
          payload: { from: BOSS_PHASE.ENRAGED, to: BOSS_PHASE.WEAKENED },
        });
        events.push({
          type: BOSS_EVENT.WEAKPOINT_EXPOSED,
          payload: { weakPoint: "頭部弱點（一箭必殺）" },
        });
      }
    }
  }

  // 虛弱階段：頭部一箭必殺
  if (phase === BOSS_PHASE.WEAKENED && hitPart === "head") {
    if (bodyCount >= config.headWeaknessHits) {
      killed = true;
      bossState.alive = false;
      bossState.phase = BOSS_PHASE.DEFEATED;
      events.push({
        type: BOSS_EVENT.BOSS_DEFEATED,
        payload: { bossId: bossState.bossId, round: bossState.round || 0 },
      });
    }
  }

  return { additionalEvents: events, killed, phaseChanged };
}

/**
 * 處理 BOSS 回合（含專屬攻擊與移動）
 * @param {object} bossState
 * @param {string[]} memberIds — 存活成員 ID
 * @param {function} rand
 * @returns {{ events: Array, nextBoss: object }}
 */
export function processBossRound(bossState, memberIds, rand = Math.random) {
  const events = [];
  const boss = { ...bossState, body: { ...bossState.body } };
  const config = BOSS_CONFIG[boss.bossId] || BOSS_CONFIG.giant_zombie_king;

  // 記錄遞增前的回合數（用於裝甲修復檢查）
  const prevPhaseRound = boss.phaseRound || 0;

  // 更新階段
  const newPhase = getBossPhase(boss);
  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    boss.phaseRound = 0;
    events.push({
      type: BOSS_EVENT.PHASE_CHANGE,
      payload: {
        from: boss.phase,
        to: newPhase,
        bossId: boss.bossId,
      },
    });
  } else {
    boss.phaseRound = prevPhaseRound + 1;
  }

  // 移動（依階段）
  const speed = config.speedByPhase[boss.phase] || { min: 1, max: 2 };
  const moveAmount = Math.floor(rand() * (speed.max - speed.min + 1)) + speed.min;
  const oldDist = boss.distanceM;
  boss.distanceM = Math.max(0, boss.distanceM - moveAmount);

  if (boss.distanceM !== oldDist) {
    events.push({
      type: "zombie_move",
      payload: {
        zombieId: boss.bossId,
        from: oldDist, to: boss.distanceM,
        amount: moveAmount, phase: boss.phase,
      },
    });
  }

  // ── BOSS 專屬攻擊 ─────────────────────────────────────

  // 橫掃攻擊（範圍傷害）
  if (rand() < config.sweepChance && memberIds.length > 0) {
    const affected = memberIds.filter(() => rand() < 0.4); // 40% 機率命中每人
    if (affected.length > 0) {
      events.push({
        type: BOSS_EVENT.SWEEP_ATTACK,
        payload: { affected, bossId: boss.bossId, phase: boss.phase },
      });
      // 狂暴階段橫掃更頻繁
      if (boss.phase === BOSS_PHASE.ENRAGED) {
        events.push({
          type: BOSS_EVENT.SWEEP_ATTACK,
          payload: { affected: memberIds.filter(() => rand() < 0.3), bossId: boss.bossId, phase: boss.phase },
        });
      }
    }
  }

  // 屍彈投射（遠程干擾）
  if (rand() < config.corpseChance && memberIds.length > 0) {
    const targetCount = boss.phase === BOSS_PHASE.ENRAGED ? 2 : 1;
    const shuffled = [...memberIds].sort(() => rand() - 0.5);
    const targets = shuffled.slice(0, Math.min(targetCount, memberIds.length));

    events.push({
      type: BOSS_EVENT.CORPSE_PROJECTILE,
      payload: { targets, bossId: boss.bossId, phase: boss.phase },
    });
  }

  // 裝甲修復（護甲階段每 3 回合，使用遞增前回合數）
  if (boss.phase === BOSS_PHASE.ARMORED &&
      prevPhaseRound > 0 &&
      prevPhaseRound % config.armorRepairInterval === 0) {
    // 恢復部分護甲
    const repairAmount = Math.floor((config.armorTorsoThreshold || 12) * 0.2);
    const currentArmor = boss.body.armor_layer || 0;
    const repaired = Math.max(0, currentArmor - repairAmount);
    boss.body.armor_layer = repaired;
    boss.body.armor_repaired = (boss.body.armor_repaired || 0) + 1;

    events.push({
      type: BOSS_EVENT.ARMOR_REPAIR,
      payload: {
        repairAmount,
        currentDamage: repaired,
        totalRepairs: boss.body.armor_repaired,
      },
    });
  }

  return { events, nextBoss: boss };
}

/**
 * 計算 BOSS 行程數值
 * @param {object} bossState
 * @returns {{ phase: string, totalTorsoHits: number, heartCoreHits: number, phaseRound: number, distanceM: number, alive: boolean }}
 */
export function getBossStatus(bossState) {
  return {
    phase: bossState.phase,
    totalTorsoHits: bossState.totalTorsoHits || 0,
    heartCoreHits: bossState.heartCoreHits || 0,
    phaseRound: bossState.phaseRound || 0,
    distanceM: bossState.distanceM,
    alive: bossState.alive !== false,
    armorDamage: bossState.body?.armor_layer || 0,
    armorRepairs: bossState.body?.armor_repaired || 0,
  };
}

/** BOSS 階段顏色 */
export const BOSS_PHASE_COLORS = {
  [BOSS_PHASE.ARMORED]: "#8b5cf6",  // 紫色
  [BOSS_PHASE.ENRAGED]: "#ef4444",  // 紅色
  [BOSS_PHASE.WEAKENED]: "#f59e0b", // 金色
  [BOSS_PHASE.DEFEATED]: "#6b7280", // 灰色
};

/** BOSS 階段標籤 */
export const BOSS_PHASE_LABELS = {
  [BOSS_PHASE.ARMORED]: "🛡️ 護甲階段",
  [BOSS_PHASE.ENRAGED]: "💢 狂暴階段",
  [BOSS_PHASE.WEAKENED]: "💀 虛弱階段",
  [BOSS_PHASE.DEFEATED]: "✅ 已擊敗",
};
