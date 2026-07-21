// src/zombie/domain/eventEngine.js
// ═══════════════════════════════════════════════════════════════
//  🎲 殭屍生存 — 隨機事件與撤離引擎（純函數）
//  6 類事件 + 5 種撤離方式
// ═══════════════════════════════════════════════════════════════

import { ZONE_TYPE } from "./types";

// ═════════════════════════════════════════════════════════════
//  事件類型
// ═════════════════════════════════════════════════════════════

export const RANDOM_EVENT = {
  SUPPLY_CACHE:      "supply_cache",       // 補給發現
  INTEL_MISINFO:     "intel_misinfo",       // 情報/誤導
  ENV_INTERFERENCE:  "env_interference",    // 環境干擾
  NPC_RESCUE:        "npc_rescue",          // NPC求援
  WANDERING_HORDE:   "wandering_horde",     // 遊蕩群
  EXTRACTION_CHANGE: "extraction_change",   // 撤離變動
};

export const EXTRACTION_TYPE = {
  RANDOM_POINT:    "random_point",     // 隨機點撤離
  GUARANTEED:      "guaranteed",       // 保證終點撤離
  QUICK:           "quick",            // 急速撤離
  CONDITIONAL:     "conditional",      // 特殊條件撤離
  NPC_RESCUE:      "npc_rescue",       // NPC救援撤離
};

// ═════════════════════════════════════════════════════════════
//  事件定義
// ═════════════════════════════════════════════════════════════

/**
 * @typedef {object} RandomEventDef
 * @property {string} type — RANDOM_EVENT 其一
 * @property {string} title — 事件標題
 * @property {string} desc — 事件描述
 * @property {string} icon — Emoji
 * @property {string[]} zones — 可出現區域
 * @property {number} weight — 出現權重
 * @property {object[]} outcomes — 可能結果
 */

/** 全部 6 類隨機事件定義 */
export const EVENT_DEFINITIONS = {
  [RANDOM_EVENT.SUPPLY_CACHE]: {
    type: RANDOM_EVENT.SUPPLY_CACHE,
    title: "補給發現",
    icon: "📦",
    color: "#22c55e",
    desc: "發現了一個被遺忘的補給箱！",
    zones: [ZONE_TYPE.NORMAL, ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK],
    weight: 30,
    outcomes: [
      { text: "食物 ×2", supplies: { supply_food: 2 }, minIntel: 0 },
      { text: "飲水 ×2", supplies: { supply_water: 2 }, minIntel: 0 },
      { text: "醫療包 ×1 + 抑制劑 ×1",
        supplies: { supply_medical_kit: 1, med_suppressant: 1 }, minIntel: 50 },
      { text: "特殊箭矢 ×2",
        specialArrows: { arrow_threshold: 1, arrow_knockback: 1 }, minIntel: 70 },
      { text: "防具 T2（隨機部位）",
        armorDrop: { minTier: 2, maxTier: 2 }, minIntel: 80 },
    ],
  },

  [RANDOM_EVENT.INTEL_MISINFO]: {
    type: RANDOM_EVENT.INTEL_MISINFO,
    title: "情報與誤導",
    icon: "📡",
    color: "#60a5fa",
    desc: "發現了一張殘缺的地圖或無線電訊號。",
    zones: [ZONE_TYPE.NORMAL, ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK, ZONE_TYPE.RESTRICTED],
    weight: 25,
    outcomes: [
      { text: "正確情報：情報率 +10", intelDelta: 10, minIntel: 0 },
      { text: "錯誤情報：情報率 -5", intelDelta: -5, minIntel: 0 },
      { text: "發現捷徑：解鎖一條新連接路線", shortcut: true, minIntel: 60 },
      { text: "撤離點確認：揭示一個撤離點位置", revealExtraction: true, minIntel: 75 },
    ],
  },

  [RANDOM_EVENT.ENV_INTERFERENCE]: {
    type: RANDOM_EVENT.ENV_INTERFERENCE,
    title: "環境干擾",
    icon: "🌪️",
    color: "#f59e0b",
    desc: "環境突變讓前進更加困難。",
    zones: [ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK, ZONE_TYPE.RESTRICTED],
    weight: 15,
    outcomes: [
      { text: "濃霧：遭遇戰殭屍起始距離 -3m（更近）", encounterMod: { startDistanceMod: -3 } },
      { text: "暴雨：箭矢軌跡偏移，命中率 -10%", accuracyMod: -0.10 },
      { text: "坍方：需使用工具組清除障礙",
        requireSupply: "supply_tool_kit", consumeSupply: true },
      { text: "電力中斷：電子設備（無人機/無線電）暫時失效",
        disableElectronics: true, durationNodes: 2 },
    ],
  },

  [RANDOM_EVENT.NPC_RESCUE]: {
    type: RANDOM_EVENT.NPC_RESCUE,
    title: "NPC 求援",
    icon: "🆘",
    color: "#a855f7",
    desc: "一名倖存者正在求救！",
    zones: [ZONE_TYPE.NORMAL, ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK],
    weight: 10,
    outcomes: [
      { text: "救援成功：獲得隨機補給 + NPC 提供後續情報",
        supplies: { supply_food: 1, supply_medical_kit: 1 }, intelDelta: 5, minIntel: 0 },
      { text: "為時已晚：僅獲得少量物資",
        supplies: { supply_medical_kit: 1 }, intelDelta: -5, minIntel: 0 },
      { text: "陷阱！失去 1 件防具耐久",
        durabilityCost: { allArmor: -1 }, minIntel: 40 },
    ],
  },

  [RANDOM_EVENT.WANDERING_HORDE]: {
    type: RANDOM_EVENT.WANDERING_HORDE,
    title: "遊蕩群",
    icon: "🧟‍♂️",
    color: "#ef4444",
    desc: "一群遊蕩的殭屍正在靠近！",
    zones: [ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK, ZONE_TYPE.RESTRICTED],
    weight: 35,
    outcomes: [
      { text: "成功避開：消耗 1 食物引誘", consumeFood: 1, avoidCombat: true },
      { text: "被迫戰鬥：遭遇加強版（多 +2 殭屍）", forcedFight: { extraZombies: 2 } },
      { text: "全速逃離：損失 1 水，安全通過", consumeWater: 1, safePass: true },
    ],
  },

  [RANDOM_EVENT.EXTRACTION_CHANGE]: {
    type: RANDOM_EVENT.EXTRACTION_CHANGE,
    title: "撤離變動",
    icon: "🚁",
    color: "#f97316",
    desc: "撤離狀況發生變化！",
    zones: [ZONE_TYPE.NORMAL, ZONE_TYPE.DANGER, ZONE_TYPE.HIGH_RISK, ZONE_TYPE.RESTRICTED],
    weight: 10,
    outcomes: [
      { text: "新的撤離點在相鄰節點出現", addExtraction: true, distance: 1 },
      { text: "原定撤離點被取消", removeExtraction: true },
      { text: "撤離條件放寬（不再需要燃料）", waiveCondition: true },
    ],
  },
};

// ═════════════════════════════════════════════════════════════
//  撤離方式定義
// ═════════════════════════════════════════════════════════════

/**
 * @typedef {object} ExtractionMethod
 * @property {string} type — EXTRACTION_TYPE 其一
 * @property {string} name — 顯示名稱
 * @property {string} icon
 * @property {string} desc
 * @property {number} rewardPct — 獎勵比例 (0-1)
 * @property {object} [requirements] — 額外條件
 */

/** 全部 5 種撤離方式 */
export const EXTRACTION_METHODS = [
  {
    type: EXTRACTION_TYPE.RANDOM_POINT,
    name: "隨機撤離點",
    icon: "📍",
    color: "#22c55e",
    desc: "在地圖上隨機生成的撤離點，到達後即可撤離",
    rewardPct: 1.0,
    requirements: null,
  },
  {
    type: EXTRACTION_TYPE.GUARANTEED,
    name: "保證終點撤離",
    icon: "🏁",
    color: "#3b82f6",
    desc: "地圖終點的固定撤離點，必定存在",
    rewardPct: 1.0,
    requirements: null,
  },
  {
    type: EXTRACTION_TYPE.QUICK,
    name: "急速撤離",
    icon: "🚁",
    color: "#f59e0b",
    desc: "呼叫直升機快速撤離，但遺失部分物資",
    rewardPct: 0.7,
    requirements: {
      requiresFlare: true,   // 需要信號彈
    },
  },
  {
    type: EXTRACTION_TYPE.CONDITIONAL,
    name: "條件撤離",
    icon: "🔑",
    color: "#a855f7",
    desc: "需滿足特定條件才能撤離（如燃料、工具、清除 BOSS）",
    rewardPct: 1.2,
    requirements: {
      fuelRequired: 1,
      orBossCleared: true,   // 或清除附近 BOSS
    },
  },
  {
    type: EXTRACTION_TYPE.NPC_RESCUE,
    name: "NPC 救援撤離",
    icon: "🆘",
    color: "#f97316",
    desc: "由 NPC 提供的特殊撤離方式（需完成任務）",
    rewardPct: 1.5,
    requirements: {
      requiresQuest: true,   // 需完成 NPC 任務
    },
  },
];

/**
 * 依類型取得撤離方式
 * @param {string} type
 * @returns {ExtractionMethod|undefined}
 */
export function getExtractionMethod(type) {
  return EXTRACTION_METHODS.find(m => m.type === type);
}

// ═════════════════════════════════════════════════════════════
//  事件生成
// ═════════════════════════════════════════════════════════════

/**
 * 為指定區域生成一個隨機事件
 * @param {string} zoneType — ZONE_TYPE 其一
 * @param {object} [options]
 * @param {number} [options.intelAccuracy=50] — 影響事件品質
 * @param {number} [options.forceEventType] — 強制特定事件類型
 * @returns {object} — { event, outcome, details }
 */
export function generateRandomEvent(zoneType, options = {}) {
  const { intelAccuracy = 50 } = options;

  // 根據區域過濾可用事件
  const availableEvents = Object.values(EVENT_DEFINITIONS).filter(
    e => e.zones.includes(zoneType)
  );

  if (availableEvents.length === 0) {
    return { event: null, outcome: null };
  }

  // 加權隨機選取事件
  const totalWeight = availableEvents.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedEvent = availableEvents[0];
  for (const evt of availableEvents) {
    roll -= evt.weight;
    if (roll <= 0) {
      selectedEvent = evt;
      break;
    }
  }

  // 根據情報正確率過濾結果
  const validOutcomes = selectedEvent.outcomes.filter(
    o => (o.minIntel || 0) <= intelAccuracy
  );

  if (validOutcomes.length === 0) {
    return { event: selectedEvent, outcome: selectedEvent.outcomes[0], details: {} };
  }

  const outcome = validOutcomes[Math.floor(Math.random() * validOutcomes.length)];

  return {
    event: selectedEvent,
    outcome,
    details: {
      intelAccuracy,
      zoneType,
    },
  };
}

/**
 * 檢查撤離條件是否滿足
 * @param {string} extractionType — EXTRACTION_TYPE
 * @param {object} supplies — 背包物品
 * @param {object} state — 地圖狀態（含 bossCleared 等）
 * @returns {{ canExtract: boolean, missingRequirements: string[] }}
 */
export function checkExtractionRequirements(extractionType, supplies = {}, state = {}) {
  const method = getExtractionMethod(extractionType);
  if (!method || !method.requirements) {
    return { canExtract: true, missingRequirements: [] };
  }

  const missing = [];
  const reqs = method.requirements;

  if (reqs.requiresFlare && !supplies.supply_flare) {
    missing.push("需要信號彈");
  }
  if (reqs.fuelRequired && (supplies.supply_fuel || 0) < reqs.fuelRequired) {
    missing.push(`需要燃料 ×${reqs.fuelRequired}`);
  }
  if (reqs.requiresQuest && !state.npcQuestCompleted) {
    missing.push("需要完成 NPC 任務");
  }
  // orBossCleared 是替代條件，不加入 missing

  return {
    canExtract: missing.length === 0,
    missingRequirements: missing,
  };
}

/**
 * 執行撤離（計算最終獎勵倍率）
 * @param {string} extractionType
 * @param {object} supplies
 * @param {object} state
 * @returns {{ success: boolean, rewardMult: number, events: object[] }}
 */
export function performExtraction(extractionType, supplies = {}, state = {}) {
  const method = getExtractionMethod(extractionType);
  if (!method) {
    return { success: false, rewardMult: 0, events: [] };
  }

  const check = checkExtractionRequirements(extractionType, supplies, state);
  if (!check.canExtract) {
    return { success: false, rewardMult: 0, events: [
      { type: "extraction_failed", payload: { reason: check.missingRequirements.join(", ") } },
    ]};
  }

  return {
    success: true,
    rewardMult: method.rewardPct,
    events: [{
      type: "extraction_complete",
      payload: {
        method: extractionType,
        methodName: method.name,
        rewardMult: method.rewardPct,
      },
    }],
  };
}
