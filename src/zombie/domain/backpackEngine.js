// src/zombie/domain/backpackEngine.js
// ═══════════════════════════════════════════════════════════════
//  🎒 殭屍生存 — 背包重量管理引擎（純函數）
//  輸入物品明細 → 輸出總重量、是否超重、補給消耗
// ═══════════════════════════════════════════════════════════════

import { ITEM_WEIGHTS, INITIAL_BACKPACK_CAPACITY } from "./types";

// ── 物品補重爬取資料（對應 supply ID 或 item ID → 重量 kg）
const _KNOWN_WEIGHTS = {
  // 補給品
  supply_food: ITEM_WEIGHTS.food,               // 1.0
  supply_water: ITEM_WEIGHTS.water,             // 1.0
  supply_medical_kit: ITEM_WEIGHTS.medical,     // 0.5
  supply_map: ITEM_WEIGHTS.map,                 // 0.2
  supply_tool_kit: ITEM_WEIGHTS.tool,           // 2.5
  supply_lockpick: 0.3,
  supply_flare: 0.5,
  supply_battery: 1.0,
  supply_fuel: 3.0,

  // 醫療品
  med_immunization: 0.3,
  med_suppressant: 0.3,
  med_strong_suppressant: 0.3,
  med_experimental_serum: 0.4,

  // 特殊箭（每枝）
  arrow_threshold: ITEM_WEIGHTS.specialArrow,   // 0.5
  arrow_knockback: ITEM_WEIGHTS.specialArrow,
  arrow_penetration: ITEM_WEIGHTS.specialArrow,
  arrow_explosive: ITEM_WEIGHTS.specialArrow,
  arrow_silent: ITEM_WEIGHTS.specialArrow,
};

// ── 每枝普通箭重量
const NORMAL_ARROW_WEIGHT = ITEM_WEIGHTS.normalArrows; // 0.1

// ═════════════════════════════════════════════════════════════
//  背包事件
// ═════════════════════════════════════════════════════════════

export const BACKPACK_EVENT = {
  WEIGHT_CHANGED:  "weight_changed",    // 重量變更
  OVERWEIGHT:      "overweight",        // 超重
  CAPACITY_OK:     "capacity_ok",       // 回到容量內
  CONSUMED:        "consumed",          // 消耗物品
  ADDED:           "added",             // 獲得物品
};

// ═════════════════════════════════════════════════════════════
//  重量計算
// ═════════════════════════════════════════════════════════════

/**
 * 計算單一物品類型重量
 * @param {string} itemId
 * @param {number} quantity
 * @returns {number}
 */
export function getItemWeight(itemId, quantity = 1) {
  const unitWeight = _KNOWN_WEIGHTS[itemId] || 0.5; // 預設 0.5kg
  return unitWeight * quantity;
}

/**
 * 計算防具總重量
 * @param {Object<string, {itemId:string}>} armor — slot → armor piece
 * @returns {number}
 */
export function getArmorWeight(armor = {}) {
  let total = 0;
  // 從 armor ID 推測重量（基準值 + tier 加成）
  for (const [, piece] of Object.entries(armor)) {
    if (!piece?.itemId) continue;
    const tier = parseInt(piece.itemId.match(/t(\d)$/)?.[1] || "1", 10);
    const baseWeight = piece.itemId.includes("helmet") ? 2.0 :
      piece.itemId.includes("chestplate") ? 3.0 :
      piece.itemId.includes("gauntlets") ? 1.0 :
      piece.itemId.includes("boots") ? 1.5 : 2.0;
    total += baseWeight + (tier - 1) * 0.5; // 每高一階 +0.5kg
  }
  return total;
}

/**
 * 計算背包總重量
 * @param {object} inventory
 * @param {Object<string, number>} inventory.supplies — supplyId → quantity
 * @param {string[]} inventory.specialArrows — 特殊箭 ID 陣列
 * @param {number} [inventory.normalArrowCount=0] — 普通箭數量
 * @param {Object<string,{itemId:string}>} [inventory.armor={}] — 防具
 * @param {Object<string, number>} [inventory.medical] — medicalId → quantity
 * @returns {{ totalWeight: number, details: object }}
 */
export function calculateBackpackWeight(inventory = {}) {
  const { supplies = {}, specialArrows = [], normalArrowCount = 0, armor = {}, medical = {} } = inventory;

  // 補給品
  const suppliesWeight = Object.entries(supplies).reduce(
    (sum, [id, qty]) => sum + getItemWeight(id, qty), 0
  );

  // 醫療品
  const medicalWeight = Object.entries(medical).reduce(
    (sum, [id, qty]) => sum + getItemWeight(id, qty), 0
  );

  // 特殊箭
  const specialArrowWeight = specialArrows.reduce(
    (sum) => sum + getItemWeight("arrow_threshold"), 0
  );

  // 普通箭
  const normalArrowWeight = normalArrowCount * NORMAL_ARROW_WEIGHT;

  // 防具
  const armorWeight = getArmorWeight(armor);

  const totalWeight = suppliesWeight + medicalWeight + specialArrowWeight + normalArrowWeight + armorWeight;

  return {
    totalWeight: Math.round(totalWeight * 100) / 100,
    details: {
      supplies: suppliesWeight,
      medical: medicalWeight,
      specialArrows: specialArrowWeight,
      normalArrows: normalArrowWeight,
      armor: armorWeight,
    },
  };
}

// ═════════════════════════════════════════════════════════════
//  容量管理
// ═════════════════════════════════════════════════════════════

/**
 * 檢查是否超重
 * @param {number} totalWeight
 * @param {number} [capacity=20]
 * @returns {{ overweight: boolean, overBy: number }}
 */
export function isOverweight(totalWeight, capacity = INITIAL_BACKPACK_CAPACITY) {
  const diff = totalWeight - capacity;
  return {
    overweight: diff > 0,
    overBy: Math.round(Math.max(0, diff) * 100) / 100,
  };
}

/**
 * 嘗試添加物品到背包
 * @param {object} inventory
 * @param {string} itemId
 * @param {number} [quantity=1]
 * @param {number} [capacity=20]
 * @returns {{ inventory: object, events: object[], added: boolean, overweight: boolean }}
 */
export function addItem(inventory, itemId, quantity = 1, capacity = INITIAL_BACKPACK_CAPACITY) {
  const next = {
    ...inventory,
    supplies: { ...(inventory.supplies || {}) },
    medical: { ...(inventory.medical || {}) },
    specialArrows: [...(inventory.specialArrows || [])],
  };

  const events = [];
  const itemWeight = getItemWeight(itemId, quantity);
  const currentWeight = calculateBackpackWeight(next).totalWeight;
  const newWeight = currentWeight + itemWeight;

  // 將物品加入對應的分類
  if (itemId.startsWith("supply_")) {
    next.supplies[itemId] = (next.supplies[itemId] || 0) + quantity;
  } else if (itemId.startsWith("med_")) {
    next.medical[itemId] = (next.medical[itemId] || 0) + quantity;
  } else if (itemId.startsWith("arrow_")) {
    for (let i = 0; i < quantity; i++) next.specialArrows.push(itemId);
  }

  const over = isOverweight(newWeight, capacity);

  events.push({
    type: BACKPACK_EVENT.ADDED,
    payload: { itemId, quantity, newWeight },
  });

  if (over.overweight) {
    events.push({
      type: BACKPACK_EVENT.OVERWEIGHT,
      payload: { totalWeight: newWeight, capacity, overBy: over.overBy },
    });
  } else {
    events.push({
      type: BACKPACK_EVENT.WEIGHT_CHANGED,
      payload: { from: currentWeight, to: newWeight },
    });
  }

  return { inventory: next, events, added: true, overweight: over.overweight };
}

/**
 * 消耗物品
 * @param {object} inventory
 * @param {string} itemId — 要消耗的物品 ID
 * @param {number} [quantity=1]
 * @returns {{ inventory: object, events: object[], consumed: boolean }}
 */
export function consumeItem(inventory, itemId, quantity = 1) {
  const next = {
    ...inventory,
    supplies: { ...(inventory.supplies || {}) },
    medical: { ...(inventory.medical || {}) },
    specialArrows: [...(inventory.specialArrows || [])],
    normalArrowCount: inventory.normalArrowCount || 0,
  };
  const events = [];

  if (itemId === "normal_arrow") {
    if (next.normalArrowCount < quantity) {
      return { inventory, events: [], consumed: false };
    }
    next.normalArrowCount -= quantity;
    events.push({
      type: BACKPACK_EVENT.CONSUMED,
      payload: { itemId, quantity, remaining: next.normalArrowCount },
    });
    return { inventory: next, events, consumed: true };
  }

  const category = itemId.startsWith("supply_") ? "supplies" :
    itemId.startsWith("med_") ? "medical" : null;

  if (!category) {
    // 特殊箭在陣列中
    const idx = next.specialArrows.indexOf(itemId);
    if (idx === -1) return { inventory, events: [], consumed: false };
    next.specialArrows.splice(idx, quantity);
    events.push({
      type: BACKPACK_EVENT.CONSUMED,
      payload: { itemId, quantity, remaining: next.specialArrows.filter(id => id === itemId).length },
    });
    return { inventory: next, events, consumed: true };
  }

  const current = next[category][itemId] || 0;
  if (current < quantity) {
    return { inventory, events: [], consumed: false };
  }

  next[category][itemId] = current - quantity;
  if (next[category][itemId] <= 0) delete next[category][itemId];

  events.push({
    type: BACKPACK_EVENT.CONSUMED,
    payload: { itemId, quantity, remaining: next[category][itemId] || 0 },
  });

  return { inventory: next, events, consumed: true };
}

// ═════════════════════════════════════════════════════════════
//  補給消耗（每節點 / 每場戰鬥）
// ═════════════════════════════════════════════════════════════

/**
 * 消耗每節點所需的補給
 * @param {object} inventory
 * @param {object} [options]
 * @param {boolean} [options.hasFought=false] — 本節點是否經過戰鬥
 * @returns {{ inventory: object, events: object[], foodShortage: boolean, waterShortage: boolean }}
 */
export function consumeNodeSupplies(inventory, options = {}) {
  const { hasFought = false } = options;
  const events = [];

  // 食物消耗：每 4 節點 1 單位，每場戰鬥 +1
  let foodConsumed = 0.25; // 每節點 0.25 單位
  if (hasFought) foodConsumed = 1;

  // 水消耗：每 2 節點 1 單位，每場戰鬥 +1
  let waterConsumed = 0.5;
  if (hasFought) waterConsumed = 1;

  let result = consumeItem(inventory, "supply_food", Math.ceil(foodConsumed));
  const foodShortage = !result.consumed;

  result = consumeItem(result.inventory, "supply_water", Math.ceil(waterConsumed));
  const waterShortage = !result.consumed;

  if (!foodShortage && !waterShortage) {
    events.push({
      type: BACKPACK_EVENT.CONSUMED,
      payload: { food: Math.ceil(foodConsumed), water: Math.ceil(waterConsumed), hasFought },
    });
  }

  if (foodShortage) {
    events.push({
      type: "food_shortage",
      payload: { effect: "max_arrows_reduced", newMax: 2 },
    });
  }
  if (waterShortage) {
    events.push({
      type: "water_shortage",
      payload: { effect: "max_arrows_reduced", newMax: 2 },
    });
  }

  return {
    inventory: result.inventory,
    events,
    foodShortage,
    waterShortage,
  };
}

/**
 * 初始化起始背包（標準配給）
 * @param {object} [options]
 * @param {number} [options.food=4]
 * @param {number} [options.water=4]
 * @param {number} [options.normalArrows=30]
 * @param {number} [options.specialArrowCount=0]
 * @returns {object} — 初始 inventory
 */
export function createBackpack(options = {}) {
  const { food = 4, water = 4, normalArrows = 30, specialArrowCount = 0 } = options;

  return {
    supplies: {
      supply_food: food,
      supply_water: water,
      supply_medical_kit: 1,
    },
    medical: {},
    normalArrowCount: normalArrows,
    specialArrows: [],
    armor: {},
  };
}

// ── 輔助查詢 ──────────────────────────────────────────────

/**
 * 從 inventory 計算剩餘箭數資訊
 * @param {object} inventory
 * @returns {{ normalArrows: number, specialArrows: Object<string,number>, maxPerRound: number }}
 */
export function getArrowInfo(inventory = {}) {
  const normalArrows = inventory.normalArrowCount || 0;
  const specialArrows = {};
  for (const id of inventory.specialArrows || []) {
    specialArrows[id] = (specialArrows[id] || 0) + 1;
  }

  // 食物/水短缺時每回合箭數降為 2
  const hasFood = (inventory.supplies?.supply_food || 0) > 0;
  const hasWater = (inventory.supplies?.supply_water || 0) > 0;
  const maxPerRound = (!hasFood || !hasWater) ? 2 : 3;

  return { normalArrows, specialArrows, maxPerRound };
}
