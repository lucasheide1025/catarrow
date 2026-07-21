// src/zombie/domain/fullyInfectedSupportEngine.js
// ═══════════════════════════════════════════════════════════════
//  ☠️ 殭屍生存模式 — 完全感染弱點標記引擎（Phase 5）
//  完全感染玩家轉為輔助角色：弱點標記、干擾、部位效果減半
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} FullyInfectedState
 * @property {number}  interferenceScore — 可用干擾分數（每命中一次累積）
 * @property {number}  interferenceCooldown — 干擾冷卻回合數
 * @property {number}  interferenceUses — 本場剩餘干擾使用次數
 * @property {Object<string, MarkState>} markedZombies — zombieId → 標記狀態
 */

/**
 * @typedef {object} MarkState
 * @property {number} duration — 剩餘持續回合
 * @property {number} damageBoost — 傷害加成倍率 (1.0 + boost)
 * @property {number} [hitPart] — 標記命中部位
 * @property {string} [hitPartName] — 標記命中部位名稱
 */

// ── 常數 ─────────────────────────────────────────────────
export const MARK_DEFAULT_DURATION = 3;        // 標記持續 3 回合
export const MARK_DEFAULT_BOOST = 0.35;         // +35% 傷害加成
export const MARK_STACK_BOOST_PENALTY = 0.5;    // 疊加時額外加成減半
export const MAX_MARKED_ZOMBIES = 3;            // 同時最多標記 3 個目標
export const INTERFERENCE_INITIAL_USES = 3;     // 本場可用 3 次
export const INTERFERENCE_SCORE_PER_HIT = 1;    // 每命中一次 +1 分
export const INTERFERENCE_COOLDOWN_ROUNDS = 2;  // 使用後冷卻 2 回合

/** 事件類型 */
export const SUPPORT_EVENT = {
  MARK_APPLIED:     "support_mark_applied",      // 弱點標記
  MARK_EXPIRED:     "support_mark_expired",      // 標記消失
  MARK_REFRESHED:  "support_mark_refreshed",    // 標記刷新
  INTERFERENCE:    "support_interference",       // 干擾
  HALVED_EFFECT:   "support_halved_effect",     // 部位效果減半
  SUPPORT_CURED:   "support_cured",             // 治癒恢復
  SUPPORT_TRANSFORM: "support_transform",       // 轉化為輔助角色
};

// ═════════════════════════════════════════════════════════════
//  支援狀態管理
// ═════════════════════════════════════════════════════════════

/**
 * 建立完全感染支援狀態
 * @returns {FullyInfectedState}
 */
export function createFullyInfectedSupport() {
  return {
    interferenceScore: 0,
    interferenceCooldown: 0,
    interferenceUses: INTERFERENCE_INITIAL_USES,
    markedZombies: {},
  };
}

/**
 * 應用弱點標記
 * @param {FullyInfectedState} state
 * @param {string} zombieId
 * @param {string} [hitPart] — 命中部位
 * @param {object} [options]
 * @param {number} [options.duration]
 * @returns {{ state: FullyInfectedState, events: object[] }}
 */
export function applyWeakPointMark(state, zombieId, hitPart, options = {}) {
  const next = {
    ...state,
    markedZombies: { ...state.markedZombies },
  };

  const { duration = MARK_DEFAULT_DURATION } = options;
  const events = [];

  // 標記數量上限檢查
  const currentMarks = Object.keys(next.markedZombies).length;
  const isNewMark = !next.markedZombies[zombieId];

  if (isNewMark && currentMarks >= MAX_MARKED_ZOMBIES) {
    // 移除最舊的標記（FIFO）
    const oldestId = Object.keys(next.markedZombies)[0];
    events.push({
      type: SUPPORT_EVENT.MARK_EXPIRED,
      payload: { zombieId: oldestId, reason: "overwrite" },
    });
    delete next.markedZombies[oldestId];
  }

  // 計算加成（疊加弱化）
  const existing = next.markedZombies[zombieId];
  const stackBoost = existing
    ? MARK_DEFAULT_BOOST * MARK_STACK_BOOST_PENALTY
    : MARK_DEFAULT_BOOST;

  const newMark = {
    duration,
    damageBoost: stackBoost,
    ...(hitPart && { hitPart }),
  };

  next.markedZombies[zombieId] = newMark;

  events.push({
    type: existing ? SUPPORT_EVENT.MARK_REFRESHED : SUPPORT_EVENT.MARK_APPLIED,
    payload: {
      zombieId,
      duration,
      damageBoost: stackBoost,
      remainingMarks: Object.keys(next.markedZombies).length,
      isRefresh: !!existing,
    },
  });

  return { state: next, events };
}

/**
 * 處理回合結束時標記持續時間
 * @param {FullyInfectedState} state
 * @returns {{ state: FullyInfectedState, events: object[] }}
 */
export function processMarkDurations(state) {
  if (!state) return { state: null, events: [] };

  const next = {
    ...state,
    markedZombies: { ...state.markedZombies },
  };
  const events = [];
  const expiredIds = [];

  for (const [zombieId, mark] of Object.entries(next.markedZombies)) {
    const newDuration = mark.duration - 1;
    if (newDuration <= 0) {
      expiredIds.push(zombieId);
      events.push({
        type: SUPPORT_EVENT.MARK_EXPIRED,
        payload: { zombieId, reason: "duration_end" },
      });
    } else {
      next.markedZombies[zombieId] = { ...mark, duration: newDuration };
    }
  }

  for (const id of expiredIds) {
    delete next.markedZombies[id];
  }

  // 冷卻計數
  if (next.interferenceCooldown > 0) {
    next.interferenceCooldown--;
  }

  return { state: next, events };
}

/**
 * 使用干擾能力
 * @param {FullyInfectedState} state
 * @param {string} targetZombieId
 * @returns {{ state: FullyInfectedState, events: object[], success: boolean }}
 */
export function useInterference(state, targetZombieId) {
  if (!state) {
    return { state: null, events: [], success: false };
  }

  const events = [];

  // 檢查次數
  if (state.interferenceUses <= 0) {
    events.push({
      type: SUPPORT_EVENT.INTERFERENCE,
      payload: { success: false, reason: "no_uses_left" },
    });
    return { state, events, success: false };
  }

  // 檢查冷卻
  if (state.interferenceCooldown > 0) {
    events.push({
      type: SUPPORT_EVENT.INTERFERENCE,
      payload: { success: false, reason: "on_cooldown", cooldown: state.interferenceCooldown },
    });
    return { state, events, success: false };
  }

  // 檢查分數
  if (state.interferenceScore <= 0) {
    events.push({
      type: SUPPORT_EVENT.INTERFERENCE,
      payload: { success: false, reason: "no_score" },
    });
    return { state, events, success: false };
  }

  const next = {
    ...state,
    interferenceUses: state.interferenceUses - 1,
    interferenceCooldown: INTERFERENCE_COOLDOWN_ROUNDS,
    interferenceScore: 0, // 使用後重置分數
  };

  events.push({
    type: SUPPORT_EVENT.INTERFERENCE,
    payload: {
      success: true,
      targetZombieId,
      usedScore: state.interferenceScore,
      usesLeft: next.interferenceUses,
    },
  });

  return { state: next, events, success: true };
}

/**
 * 累積干擾分數（每次命中呼叫）
 * @param {FullyInfectedState} state
 * @param {number} [score=1]
 * @returns {{ state: FullyInfectedState, events: object[] }}
 */
export function addInterferenceScore(state, score = INTERFERENCE_SCORE_PER_HIT) {
  if (!state) return { state: null, events: [] };

  return {
    state: {
      ...state,
      interferenceScore: (state.interferenceScore || 0) + score,
    },
    events: [],
  };
}

/**
 * 取得被標記的殭屍 ID 清單
 * @param {FullyInfectedState} state
 * @returns {string[]}
 */
export function getMarkedZombies(state) {
  if (!state) return [];
  return Object.entries(state.markedZombies)
    .filter(([, mark]) => mark.duration > 0)
    .map(([id]) => id);
}

/**
 * 計算對指定殭屍的傷害加成倍率
 * @param {FullyInfectedState} state
 * @param {string} zombieId
 * @returns {number} — 1.0 = 無加成, 1.35 = +35%
 */
export function getDamageBoost(state, zombieId) {
  const mark = state?.markedZombies?.[zombieId];
  if (!mark || mark.duration <= 0) return 1.0;
  return 1.0 + mark.damageBoost;
}

/**
 * 取得完全感染者的部位擊殺門檻（效果減半）
 * @param {object} killThreshold — 原殭屍原型的 killThreshold
 * @returns {{ head: number, torso: number }}
 */
export function getHalvedThreshold(killThreshold) {
  if (!killThreshold) return { head: 2, torso: 6 };
  return {
    head: Math.max(2, Math.ceil(killThreshold.head * 2)),  // 至少 2 箭
    torso: Math.max(3, Math.ceil(killThreshold.torso * 2)), // 至少 3 箭
  };
}

/**
 * 重置支援狀態（治癒時使用）
 * @returns {FullyInfectedState} — 清空的支援狀態
 */
export function resetSupportState() {
  return createFullyInfectedSupport();
}
