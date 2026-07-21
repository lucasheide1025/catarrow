// src/zombie/data/baseData.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 基地建築資料表（Phase 4）
//  9 座建築 × 10 級制，與貓貓村共用 9 種材料
// ═══════════════════════════════════════════════════════════════

// ── 9 種共用材料（與貓貓村 villageData.js 對齊）───────────
export const BASE_MATERIALS = [
  { id: "ore",       name: "礦物",     icon: "⛏️",  color: "#9ca3af", tiered: true  },
  { id: "melon",     name: "瓜瓜",     icon: "🍈",   color: "#4ade80", tiered: true  },
  { id: "fish",      name: "鮮魚",     icon: "🐟",   color: "#60a5fa", tiered: true  },
  { id: "meat",      name: "動物肉",   icon: "🥩",   color: "#f87171", tiered: true  },
  { id: "driedfish", name: "小魚乾",   icon: "🐠",   color: "#fbbf24", tiered: true  },
  { id: "can",       name: "貓罐頭",   icon: "🥫",   color: "#f472b6", tiered: true  },
  { id: "potion",    name: "貓薄荷藥水", icon: "🧪", color: "#a78bfa", tiered: true  },
  { id: "fur",       name: "貓毛",     icon: "🪶",   color: "#d4a574", tiered: true  },
  { id: "archer",    name: "貓貓射手", icon: "🏹",   color: "#22d3ee", tiered: true  },
];

export const ZOMBIE_CURRENCY = "arrowdew"; // 共用箭露

/**
 * @typedef {object} BuildingDef
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} desc
 * @property {string} color
 * @property {number} maxLevel — 最高等級 (10)
 * @property {object} effects — 各等級效果（依建築類型不同）
 * @property {string} category — 功能分類
 */

/** 9 座基地建築定義 */
export const BUILDINGS = [
  {
    id: "growing_room",
    name: "種植室",
    icon: "🌱",
    desc: "提供穩定食物供應，減少遠征時的食物消耗",
    color: "#4ade80",
    maxLevel: 10,
    category: "supply",
    effects: {
      type: "food_production",
      perLevel: 0.5,  // 每級減少 0.5 食物消耗/節點
      baseDesc: (lv) => `🍖 食物消耗 -${Math.round(lv * 0.5 * 10) / 10}/節點`,
    },
  },
  {
    id: "water_station",
    name: "淨水站",
    icon: "💧",
    desc: "淨化飲水，減少遠征時的飲水消耗",
    color: "#60a5fa",
    maxLevel: 10,
    category: "supply",
    effects: {
      type: "water_production",
      perLevel: 0.3,
      baseDesc: (lv) => `💧 飲水消耗 -${Math.round(lv * 0.3 * 10) / 10}/節點`,
    },
  },
  {
    id: "expedition_team",
    name: "遠征補給隊",
    icon: "🚚",
    desc: "派出非同步支援團隊，帶回額外物資",
    color: "#fbbf24",
    maxLevel: 10,
    category: "logistics",
    effects: {
      type: "async_supply",
      perLevel: 2,
      baseDesc: (lv) => `📦 每次遠征額外獲得 ${lv * 2} 隨機補給`,
    },
  },
  {
    id: "medical_room",
    name: "醫療室",
    icon: "🏥",
    desc: "製作醫療包、抑制劑與血清；等級解鎖更高品質藥品",
    color: "#34d399",
    maxLevel: 10,
    category: "medical",
    effects: {
      type: "medical_craft",
      unlockItems: { 1: ["med_immunization"], 3: ["med_suppressant"], 5: ["med_strong_suppressant"], 8: ["med_experimental_serum"] },
      baseDesc: (lv) => {
        const items = { 1: "免疫針", 3: "抑制劑", 5: "強效抑制劑", 8: "實驗血清" };
        const unlocked = Object.entries(items).filter(([l]) => lv >= parseInt(l)).map(([, n]) => n);
        return `💊 可製作: ${unlocked.join("、") || "無"}`;
      },
    },
  },
  {
    id: "workbench",
    name: "裝備工作台",
    icon: "🔧",
    desc: "製作與升級配件，等級決定可製作的配件等級",
    color: "#f472b6",
    maxLevel: 10,
    category: "crafting",
    effects: {
      type: "accessory_craft",
      maxAccessoryLevel: (lv) => Math.min(5, Math.ceil(lv / 2)),
      baseDesc: (lv) => `⚙️ 配件等級上限: T${Math.min(5, Math.ceil(lv / 2))}`,
    },
  },
  {
    id: "armor_station",
    name: "防具修復站",
    icon: "🛡️",
    desc: "修復防具耐久，等級降低修復成本",
    color: "#8b5cf6",
    maxLevel: 10,
    category: "repair",
    effects: {
      type: "armor_repair",
      costReductionPerLevel: 0.08, // 每級 -8% 修復成本
      baseDesc: (lv) => `🛡️ 修復成本 -${Math.round(lv * 8)}%`,
    },
  },
  {
    id: "radio_tower",
    name: "無線電塔",
    icon: "📡",
    desc: "提升遠端情報預測能力，降低情報錯誤率",
    color: "#22d3ee",
    maxLevel: 10,
    category: "intel",
    effects: {
      type: "intel_boost",
      accuracyBonusPerLevel: 3, // 每級 +3% 情報正確率
      baseDesc: (lv) => `🧠 情報正確率 +${lv * 3}%`,
    },
  },
  {
    id: "scout_station",
    name: "偵察站",
    icon: "🔭",
    desc: "地圖揭露範圍擴大，探索初始可見節點增加",
    color: "#f59e0b",
    maxLevel: 10,
    category: "intel",
    effects: {
      type: "map_reveal",
      revealRadiusPerLevel: 1, // 每級 +1 層揭示深度
      baseDesc: (lv) => `🗺️ 初始揭示深度 +${lv} 層`,
    },
  },
  {
    id: "rescue_team",
    name: "搜救隊",
    icon: "🚁",
    desc: "全滅後搜尋遺失裝備與物資，等級越高找回越多",
    color: "#ef4444",
    maxLevel: 10,
    category: "recovery",
    effects: {
      type: "gear_recovery",
      recoveryRatePerLevel: 5, // 每級 +5% 找回率
      baseDesc: (lv) => `💀 全滅裝備找回率 ${Math.min(80, lv * 5)}%`,
    },
  },
];

/** 依 ID 取得建築定義 */
export function getBuilding(id) {
  return BUILDINGS.find(b => b.id === id);
}

// ── 升級費用表 ──────────────────────────────────────────
// 與貓貓村箭露費用對齊（ARROWDEW_COSTS 取前 10 級）
export const UPGRADE_COSTS = {
  arrowdew: [0, 0, 50, 100, 180, 300, 480, 750, 1150, 1800, 2800],
};

/**
 * 取得升級所需資源
 * @param {string} buildingId
 * @param {number} targetLevel — 要升到的等級 (1-10)
 * @returns {{ arrowdew: number, materials: Array<{id:string, count:number, tier:number}> }}
 */
export function getUpgradeCost(buildingId, targetLevel) {
  if (targetLevel < 1 || targetLevel > 10) return null;
  const bIdx = BUILDINGS.findIndex(b => b.id === buildingId);
  if (bIdx === -1) return null;

  const arrowdew = UPGRADE_COSTS.arrowdew[targetLevel] || 0;

  // 材料需求：每棟建築有兩種專屬材料需求組合
  const materialCosts = getMaterialCost(buildingId, targetLevel);
  return { arrowdew, materials: materialCosts };
}

/**
 * 按建築與等級計算材料需求
 * 每棟建築使用 2 種共用材料（來自 9 種貓貓村材料）
 * Lv1-3: 僅箭露
 * Lv4-6: 1 種材料 × 數量
 * Lv7-9: 2 種材料 × 數量
 * Lv10:  2 種材料 × 較高數量
 */
function getMaterialCost(buildingId, targetLevel) {
  // 每棟建築的材料組合（主材料, 副材料）
  const materialMap = {
    growing_room:     ["melon", "ore"],
    water_station:    ["fish", "ore"],
    expedition_team:  ["meat", "driedfish"],
    medical_room:     ["potion", "melon"],
    workbench:        ["can", "ore"],
    armor_station:    ["fur", "meat"],
    radio_tower:      ["driedfish", "can"],
    scout_station:    ["ore", "potion"],
    rescue_team:      ["meat", "fur"],
  };

  const mats = materialMap[buildingId];
  if (!mats) return [];

  const needs = [];
  if (targetLevel >= 4) {
    const mainCount = [0, 0, 0, 5, 10, 18, 0, 0, 0, 0][targetLevel] || 
                      (targetLevel >= 7 ? 25 + (targetLevel - 7) * 10 : 0);
    if (mainCount > 0) {
      const tier = targetLevel <= 5 ? 1 : targetLevel <= 8 ? 2 : 3;
      needs.push({ id: mats[0], count: mainCount, tier });
    }
  }
  if (targetLevel >= 7) {
    const subCount = [0, 0, 0, 0, 0, 0, 8, 15, 25, 40][targetLevel];
    if (subCount > 0) {
      const tier = targetLevel <= 8 ? 2 : 3;
      needs.push({ id: mats[1], count: subCount, tier });
    }
  }
  return needs;
}

/** 取得建築在指定等級的效果描述 */
export function getBuildingEffectDesc(buildingId, level) {
  const b = getBuilding(buildingId);
  if (!b) return "";
  return b.effects.baseDesc(level);
}

/** 取得配件插槽數量（依基地等級） */
export function getAccessorySlots(baseLevel) {
  if (baseLevel >= 8) return 4;
  if (baseLevel >= 5) return 3;
  if (baseLevel >= 3) return 2;
  return 1;
}

/** 取得背包容量加成（依基地等級） */
export function getBackpackBonus(baseLevel) {
  return baseLevel * 2; // 每級 +2kg
}
