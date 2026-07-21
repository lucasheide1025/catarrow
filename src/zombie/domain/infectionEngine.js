// src/zombie/domain/infectionEngine.js
// ═══════════════════════════════════════════════════════════════
//  🦠 殭屍生存 — 感染進程狀態機（純函數）
//  無副作用、無 React、無 Firestore
//  輸入感染狀態 → 輸出下一狀態 + 事件
// ═══════════════════════════════════════════════════════════════

import { LIFE_STATE, INFECTION_INITIAL_NODES, INFECTION_MAX_CONSECUTIVE } from "./types";

// ═════════════════════════════════════════════════════════════
//  常數
// ═════════════════════════════════════════════════════════════

/** 感染事件類型 */
export const INFECTION_EVENT = {
  INFECTED:            "infected",              // 初次感染
  NODE_DECREMENT:      "node_decrement",        // 節點數減少
  SUPPRESSED:          "suppressed",            // 被抑制
  STRONG_SUPPRESSED:   "strong_suppressed",     // 強效抑制
  CURED:               "cured",                 // 完全治癒
  FULLY_INFECTED:      "fully_infected",        // 完全感染
  IMMUNIZED:           "immunized",             // 免疫針生效
  CONSECUTIVE_ATTACK:  "consecutive_attack",    // 連續受攻擊
  RESET_CONSECUTIVE:   "reset_consecutive",     // 連續計數重置
  TRANSFORMED:         "transformed",           // 轉化為輔助角色
};

// ═════════════════════════════════════════════════════════════
//  感染狀態建立
// ═════════════════════════════════════════════════════════════

/**
 * 建立初始感染狀態
 * @param {object} [options]
 * @param {number} [options.initialNodes=8] — 初始剩餘節點數
 * @param {string} [options.source] — 感染來源
 * @returns {ZombieInfectionState}
 */
export function createInfectionState(options = {}) {
  const { initialNodes = INFECTION_INITIAL_NODES, source } = options;
  return {
    remainingMapNodes: initialNodes,
    delays: 0,
    consecutiveAttacks: 0,
    ...(source && { source }),
  };
}

// ═════════════════════════════════════════════════════════════
//  生命狀態解析
// ═════════════════════════════════════════════════════════════

/**
 * 從 infection state 解析最終的 LIFE_STATE
 * @param {ZombieInfectionState|null} infectionState
 * @returns {string} LIFE_STATE 其一
 */
export function resolveLifeState(infectionState) {
  if (!infectionState) return LIFE_STATE.HEALTHY;

  const { remainingMapNodes, delays, consecutiveAttacks } = infectionState;

  // 完全感染
  if (remainingMapNodes <= 0) return LIFE_STATE.FULLY_INFECTED;

  // 已被抑制（有 delays 代表曾用藥）
  if (delays > 0) return LIFE_STATE.SUPPRESSED;

  // 連續受攻擊達上限 → 自動升級感染
  if (consecutiveAttacks >= INFECTION_MAX_CONSECUTIVE) return LIFE_STATE.INFECTED;

  return LIFE_STATE.INFECTED;
}

// ═════════════════════════════════════════════════════════════
//  感染進程處理
// ═════════════════════════════════════════════════════════════

/**
 * 處理感染進程（每經過一個地圖節點呼叫一次）
 * @param {ZombieInfectionState} state
 * @returns {{ state: ZombieInfectionState, events: object[] }}
 */
export function processInfectionTick(state) {
  if (!state) return { state: null, events: [] };

  const next = { ...state };
  const events = [];

  // 每個節點減少 1
  next.remainingMapNodes = Math.max(0, next.remainingMapNodes - 1);

  events.push({
    type: INFECTION_EVENT.NODE_DECREMENT,
    payload: { remaining: next.remainingMapNodes, previous: state.remainingMapNodes },
  });

  // 歸零 → 完全感染
  if (next.remainingMapNodes <= 0 && state.remainingMapNodes > 0) {
    events.push({
      type: INFECTION_EVENT.FULLY_INFECTED,
      payload: { source: state.source },
    });
  }

  return { state: next, events };
}

/**
 * 處理連續受攻擊
 * @param {ZombieInfectionState} state
 * @param {object} [options]
 * @param {number} [options.attackIncrement=1]
 * @returns {{ state: ZombieInfectionState, events: object[] }}
 */
export function processConsecutiveAttack(state, options = {}) {
  const { attackIncrement = 1 } = options;
  if (!state) return { state: null, events: [] };

  const next = { ...state };
  const events = [];

  next.consecutiveAttacks = Math.min(
    INFECTION_MAX_CONSECUTIVE + 1,
    (next.consecutiveAttacks || 0) + attackIncrement
  );

  events.push({
    type: INFECTION_EVENT.CONSECUTIVE_ATTACK,
    payload: { consecutive: next.consecutiveAttacks },
  });

  // 達到上限 → 加速感染（減少額外節點）
  if (next.consecutiveAttacks >= INFECTION_MAX_CONSECUTIVE) {
    next.remainingMapNodes = Math.max(0, next.remainingMapNodes - 2);
    events.push({
      type: INFECTION_EVENT.NODE_DECREMENT,
      payload: { remaining: next.remainingMapNodes, reason: "consecutive_attacks" },
    });

    if (next.remainingMapNodes <= 0) {
      events.push({
        type: INFECTION_EVENT.FULLY_INFECTED,
        payload: { source: state.source, cause: "consecutive_attacks" },
      });
    }
  }

  return { state: next, events };
}

// ═════════════════════════════════════════════════════════════
//  醫療品應用
// ═════════════════════════════════════════════════════════════

/**
 * 套用醫療品效果
 * @param {ZombieInfectionState|null} state — 當前感染狀態（null 代表健康）
 * @param {string} medicalItemId — MEDICAL_ITEMS 的 id
 * @returns {{ state: ZombieInfectionState|null, events: object[], cured: boolean }}
 */
export function applyMedicalItem(state, medicalItemId) {
  switch (medicalItemId) {
    case "med_immunization": {
      // 免疫針：重置連續受攻擊計數
      if (!state) return { state: null, events: [], cured: false };
      const immNext = { ...state, consecutiveAttacks: 0 };
      return {
        state: immNext,
        events: [{ type: INFECTION_EVENT.IMMUNIZED, payload: {} }],
        cured: false,
      };
    }

    case "med_suppressant": {
      // 抑制劑：暫停感染 2 節點
      if (!state) return { state: null, events: [], cured: false };
      const supNext = {
        ...state,
        delays: (state.delays || 0) + 1,
      };
      return {
        state: supNext,
        events: [{
          type: INFECTION_EVENT.SUPPRESSED,
          payload: { addedNodes: 2, totalDelays: supNext.delays },
        }],
        cured: false,
      };
    }

    case "med_strong_suppressant": {
      // 強效抑制劑：+5 節點 + 重置連續攻擊
      if (!state) return { state: null, events: [], cured: false };
      const ssNext = {
        ...state,
        remainingMapNodes: state.remainingMapNodes + 5,
        delays: (state.delays || 0) + 1,
        consecutiveAttacks: 0,
      };
      return {
        state: ssNext,
        events: [{
          type: INFECTION_EVENT.STRONG_SUPPRESSED,
          payload: { addedNodes: 5, newRemaining: ssNext.remainingMapNodes },
        }],
        cured: false,
      };
    }

    case "med_experimental_serum": {
      // 實驗血清：完全治癒（含完全感染）
      const cured = state !== null;
      return {
        state: null,  // null = 健康
        events: [{
          type: INFECTION_EVENT.CURED,
          payload: { wasFullyInfected: state?.remainingMapNodes <= 0 },
        }],
        cured,  // 只有真正有感染狀態時才算治癒
      };
    }

    default:
      return { state, events: [], cured: false };
  }
}

// ═════════════════════════════════════════════════════════════
//  輔助查詢
// ═════════════════════════════════════════════════════════════

/**
 * 檢查是否處於可射箭狀態
 * @param {string} lifeState
 * @returns {boolean}
 */
export function canShoot(lifeState) {
  return lifeState !== LIFE_STATE.FULLY_INFECTED
    && lifeState !== LIFE_STATE.DEAD
    && lifeState !== LIFE_STATE.EXTRACTED;
}

/**
 * 檢查是否處於存活（但可能感染）狀態
 * @param {string} lifeState
 * @returns {boolean}
 */
export function isAlive(lifeState) {
  return lifeState !== LIFE_STATE.DEAD && lifeState !== LIFE_STATE.EXTRACTED;
}
