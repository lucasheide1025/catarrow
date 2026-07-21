// src/zombie/domain/baseEngine.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 基地管理純函數引擎（Phase 4）
//  基地等級、建築升級、材料管理、基地效果計算
// ═══════════════════════════════════════════════════════════════

import {
  BUILDINGS,
  getBuilding,
  getUpgradeCost,
  getBuildingEffectDesc,
  getAccessorySlots,
  getBackpackBonus,
} from "../data/baseData";

// ── 事件類型 ─────────────────────────────────────────────
export const BASE_EVENT = {
  UPGRADED:       "building_upgraded",
  INSUFFICIENT:   "insufficient_resources",
  MAX_LEVEL:      "max_level_reached",
  LOCKED:         "building_locked",
  EFFECT_CHANGED: "effect_changed",
};

/**
 * 建立初始基地狀態
 * @param {object} [overrides]
 * @returns {BaseState}
 */
export function createBaseState(overrides = {}) {
  const buildings = {};
  for (const b of BUILDINGS) {
    buildings[b.id] = 1; // 全部 Lv1
  }

  return {
    buildings,
    resources: {
      arrowdew: 0,
      // 9 種共用材料（tier 1~3）
      ore_t1: 0, ore_t2: 0, ore_t3: 0,
      melon_t1: 0, melon_t2: 0, melon_t3: 0,
      fish_t1: 0, fish_t2: 0, fish_t3: 0,
      meat_t1: 0, meat_t2: 0, meat_t3: 0,
      driedfish_t1: 0, driedfish_t2: 0, driedfish_t3: 0,
      can_t1: 0, can_t2: 0, can_t3: 0,
      potion_t1: 0, potion_t2: 0, potion_t3: 0,
      fur_t1: 0, fur_t2: 0, fur_t3: 0,
      archer_t1: 0, archer_t2: 0, archer_t3: 0,
      // BOSS 專屬材料
      boss_material: 0,
    },
    totalUpgrades: 0,
    ...overrides,
  };
}

/**
 * @typedef {object} BaseState
 * @property {Object<string, number>} buildings — buildingId → level
 * @property {Object<string, number>} resources — resourceId → count
 * @property {number} totalUpgrades — 累計升級次數
 */

/**
 * 升級指定建築
 * @param {BaseState} state
 * @param {string} buildingId
 * @returns {{ state: BaseState, events: Array<{type:string, payload?:object}>, ok: boolean, reason?: string }}
 */
export function upgradeBuilding(state, buildingId) {
  const b = getBuilding(buildingId);
  if (!b) {
    return { state, events: [{ type: BASE_EVENT.LOCKED, payload: { buildingId } }], ok: false, reason: `未知建築: ${buildingId}` };
  }

  const currentLevel = state.buildings[buildingId] || 1;
  if (currentLevel >= b.maxLevel) {
    return { state, events: [{ type: BASE_EVENT.MAX_LEVEL, payload: { buildingId, level: currentLevel } }], ok: false, reason: "已達最高等級" };
  }

  const targetLevel = currentLevel + 1;
  const cost = getUpgradeCost(buildingId, targetLevel);
  if (!cost) {
    return { state, events: [{ type: BASE_EVENT.INSUFFICIENT, payload: { buildingId, reason: "費用資料錯誤" } }], ok: false, reason: "費用資料錯誤" };
  }

  // 檢查資源是否充足
  const missing = [];
  if ((state.resources.arrowdew || 0) < cost.arrowdew) {
    missing.push(`箭露不足 (需 ${cost.arrowdew})`);
  }
  for (const mat of cost.materials) {
    const key = `${mat.id}_t${mat.tier}`;
    if ((state.resources[key] || 0) < mat.count) {
      const name = getMaterialName(mat.id);
      missing.push(`${name} T${mat.tier} 不足 (需 ${mat.count})`);
    }
  }

  if (missing.length > 0) {
    return {
      state,
      events: [{ type: BASE_EVENT.INSUFFICIENT, payload: { buildingId, missing, targetLevel } }],
      ok: false,
      reason: missing.join("；"),
    };
  }

  // 扣除資源
  const newResources = { ...state.resources };
  newResources.arrowdew = (newResources.arrowdew || 0) - cost.arrowdew;
  for (const mat of cost.materials) {
    const key = `${mat.id}_t${mat.tier}`;
    newResources[key] = (newResources[key] || 0) - mat.count;
  }

  // 升級建築
  const newBuildings = { ...state.buildings, [buildingId]: targetLevel };

  const newState = {
    ...state,
    buildings: newBuildings,
    resources: newResources,
    totalUpgrades: state.totalUpgrades + 1,
  };

  const events = [
    {
      type: BASE_EVENT.UPGRADED,
      payload: {
        buildingId,
        fromLevel: currentLevel,
        toLevel: targetLevel,
        effect: getBuildingEffectDesc(buildingId, targetLevel),
      },
    },
  ];

  // 檢查是否有解鎖效果
  const bDef = getBuilding(buildingId);
  if (bDef?.effects?.unlockItems) {
    const unlockedNow = Object.entries(bDef.effects.unlockItems)
      .filter(([lv]) => parseInt(lv) === targetLevel)
      .map(([, items]) => items)
      .flat();
    if (unlockedNow.length > 0) {
      events.push({
        type: BASE_EVENT.EFFECT_CHANGED,
        payload: { buildingId, unlockedItems: unlockedNow },
      });
    }
  }

  return { state: newState, events, ok: true };
}

/**
 * 計算基地總等級
 * @param {Object<string, number>} buildings
 * @returns {number}
 */
export function getBaseLevel(buildings) {
  const ids = Object.keys(buildings);
  if (ids.length === 0) return 0;
  const total = ids.reduce((s, id) => s + (buildings[id] || 1), 0);
  return Math.floor(total / ids.length);
}

/**
 * 取得基地等級相關數值
 * @param {Object<string, number>} buildings
 * @returns {{ baseLevel: number, accessorySlots: number, backpackBonus: number }}
 */
export function getBaseStats(buildings) {
  const baseLevel = getBaseLevel(buildings);
  return {
    baseLevel,
    accessorySlots: getAccessorySlots(baseLevel),
    backpackBonus: getBackpackBonus(baseLevel),
  };
}

/**
 * 計算各建築對遠征的實際效果加成
 * @param {Object<string, number>} buildings
 * @returns {object}
 */
export function calculateBaseEffects(buildings) {
  const effects = {
    foodSaving: 0,
    waterSaving: 0,
    intelBonus: 0,
    repairDiscount: 0,
    recoveryRate: 0,
    maxAccessoryLevel: 1,
    asyncSupplyBonus: 0,
    revealDepth: 1,
    unlockedMedical: [],
  };

  for (const [id, level] of Object.entries(buildings)) {
    if (!level || level < 1) continue;
    const b = getBuilding(id);
    if (!b) continue;

    switch (b.effects.type) {
      case "food_production":
        effects.foodSaving = level * b.effects.perLevel;
        break;
      case "water_production":
        effects.waterSaving = level * b.effects.perLevel;
        break;
      case "async_supply":
        effects.asyncSupplyBonus = level * b.effects.perLevel;
        break;
      case "medical_craft":
        if (b.effects.unlockItems) {
          for (const [minLv, items] of Object.entries(b.effects.unlockItems)) {
            if (level >= parseInt(minLv)) {
              effects.unlockedMedical.push(...items);
            }
          }
        }
        break;
      case "accessory_craft":
        effects.maxAccessoryLevel = b.effects.maxAccessoryLevel(level);
        break;
      case "armor_repair":
        effects.repairDiscount = level * b.effects.costReductionPerLevel;
        break;
      case "intel_boost":
        effects.intelBonus = level * b.effects.accuracyBonusPerLevel;
        break;
      case "map_reveal":
        effects.revealDepth = 1 + (level - 1) * b.effects.revealRadiusPerLevel;
        break;
      case "gear_recovery":
        effects.recoveryRate = Math.min(80, level * b.effects.recoveryRatePerLevel);
        break;
    }
  }

  return effects;
}

/**
 * 增加資源
 * @param {BaseState} state
 * @param {string} resourceId
 * @param {number} amount
 * @returns {BaseState}
 */
export function addResource(state, resourceId, amount) {
  if (amount <= 0) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      [resourceId]: (state.resources[resourceId] || 0) + amount,
    },
  };
}

/**
 * 取得基地建設完整度（0-100）
 * @param {Object<string, number>} buildings
 * @returns {number}
 */
export function getBaseCompletion(buildings) {
  const totalLevels = Object.values(buildings).reduce((s, lv) => s + lv, 0);
  const maxLevels = BUILDINGS.length * 10;
  return Math.round((totalLevels / maxLevels) * 100);
}

/** 工具：取得材料中文名 */
function getMaterialName(id) {
  const names = {
    ore: "礦物", melon: "瓜瓜", fish: "鮮魚", meat: "動物肉",
    driedfish: "小魚乾", can: "貓罐頭", potion: "貓薄荷藥水",
    fur: "貓毛", archer: "貓貓射手",
  };
  return names[id] || id;
}
