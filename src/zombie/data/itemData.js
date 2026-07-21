// src/zombie/data/itemData.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 道具資料表
//  完全獨立於地下城/組隊的藥水與道具系統
//  包含：武器箭具、防具、醫療品、配件、補給品
// ═══════════════════════════════════════════════════════════════

import { ARMOR_TIERS, ARMOR_SLOT } from "../domain/types";

// ─────────────────────────────────────────────────────────────
//  特殊箭具（5 種，全進 Phase 2）
//  普通箭無限攜帶，特殊箭各限帶 3-5 枝（進場前購買）
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} SpecialArrow
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {string} desc
 * @property {number}  carryLimit — 每場遠征可攜帶數量上限
 * @property {number}  [weight]   — 背包重量（kg）
 * @property {object}  effect     — 效果定義
 */

/** 全部 5 種特殊箭具 */
export const SPECIAL_ARROWS = [
  {
    id: "arrow_threshold",
    name: "貫穿箭",
    icon: "🏹",
    color: "#3b82f6",
    desc: "降低非頭部擊殺門檻（如胸部 3 箭→2 箭）",
    carryLimit: 5,
    weight: 0.5,
    effect: {
      type: "threshold_reduction",
      torsoReduction: 1,        // 軀幹所需箭數 -1
      headNotAffected: true,    // 不影響頭部（維持一箭必殺）
    },
  },
  {
    id: "arrow_knockback",
    name: "擊退箭",
    icon: "💨",
    color: "#22c55e",
    desc: "命中後額外擊退殭屍 2m，拉開距離爭取時間",
    carryLimit: 5,
    weight: 0.5,
    effect: {
      type: "knockback",
      bonusKnockbackMeters: 2,  // 額外擊退距離
      stackWithHit: true,       // 可與部位本身的擊退疊加
    },
  },
  {
    id: "arrow_penetration",
    name: "穿透箭",
    icon: "⚡",
    color: "#a855f7",
    desc: "可穿過第一隻殭屍，命中後方的第二名目標",
    carryLimit: 3,
    weight: 0.5,
    effect: {
      type: "penetration",
      maxTargets: 2,            // 最多穿透 2 個目標
      damageFalloff: 0.5,       // 第二目標傷害 -50%
    },
  },
  {
    id: "arrow_explosive",
    name: "爆炸箭",
    icon: "💥",
    color: "#ef4444",
    desc: "命中後產生 3m 範圍爆炸，對範圍內所有殭屍造成傷害",
    carryLimit: 3,
    weight: 0.5,
    effect: {
      type: "explosive",
      blastRadius: 3,           // 爆炸範圍（公尺）
      blastDamagePct: 0.6,      // 範圍傷害 = 主目標傷害的 60%
      selfKnockback: true,      // 爆炸也有擊退效果
    },
  },
  {
    id: "arrow_silent",
    name: "靜音箭",
    icon: "🤫",
    color: "#6b7280",
    desc: "降低射擊噪音，減少吸引額外殭屍的機率",
    carryLimit: 5,
    weight: 0.5,
    effect: {
      type: "silent",
      noiseReduction: 0.8,       // 噪音降低 80%
      stealthBonus: true,        // 潛行加成
      aggroReduce: 0.5,          // 吸引額外殭屍機率 -50%
    },
  },
];

/**
 * 依 ID 取得特殊箭
 * @param {string} id
 * @returns {SpecialArrow|undefined}
 */
export function getSpecialArrow(id) {
  return SPECIAL_ARROWS.find(a => a.id === id);
}

// ─────────────────────────────────────────────────────────────
//  防具（5 級 × 4 部位）
//  基礎數值在 ARMOR_TIERS 中定義，這裡提供實例化輔助
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} ArmorItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} slot — ARMOR_SLOT 其一
 * @property {number} tier — 1~5
 * @property {string} tierLabel
 * @property {number} blockRate — 格擋率 (0-1)
 * @property {number} durability — 耐久度
 * @property {number} slots — 強化插槽數
 * @property {number} weight — 背包重量
 * @property {string} color
 */

/** 產生所有防具（5 級 × 4 部位 = 20 件） */
export function generateAllArmor() {
  const items = [];
  const slotMeta = {
    [ARMOR_SLOT.HELMET]:    { icon:"⛑️", name:"頭盔",   weight:2.0, color:"#60a5fa" },
    [ARMOR_SLOT.CHESTPLATE]: { icon:"🦺", name:"胸甲",   weight:3.0, color:"#34d399" },
    [ARMOR_SLOT.GAUNTLETS]:  { icon:"🧤", name:"護手",   weight:1.0, color:"#f472b6" },
    [ARMOR_SLOT.BOOTS]:      { icon:"🥾", name:"護足",   weight:1.5, color:"#fbbf24" },
  };

  for (const tier of ARMOR_TIERS) {
    for (const [slotKey, meta] of Object.entries(slotMeta)) {
      items.push({
        id: `armor_${slotKey}_t${tier.tier}`,
        name: `${tier.label}${meta.name}`,
        icon: meta.icon,
        slot: slotKey,
        tier: tier.tier,
        tierLabel: tier.label,
        blockRate: tier.blockRate,
        durability: tier.durability,
        slots: tier.slots,
        weight: meta.weight,
        color: meta.color,
      });
    }
  }
  return items;
}

/** 全部防具（懶加載） */
let _allArmor = null;
export function getAllArmor() {
  if (!_allArmor) _allArmor = generateAllArmor();
  return _allArmor;
}

/**
 * 依 ID 取得防具
 * @param {string} id
 * @returns {ArmorItem|undefined}
 */
export function getArmor(id) {
  return getAllArmor().find(a => a.id === id);
}

// ─────────────────────────────────────────────────────────────
//  醫療品（感染系統用）
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} MedicalItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {string} desc
 * @property {number}  weight — 背包重量（kg）
 * @property {object}  effect
 */

/** 全部醫療品 */
export const MEDICAL_ITEMS = [
  {
    id: "med_immunization",
    name: "免疫針",
    icon: "💉",
    color: "#34d399",
    desc: "抵擋下一次感染，並清除一次連續受攻擊計數",
    weight: 0.5,
    effect: {
      type: "immunization",
      blockNextInfection: true,
      resetConsecutiveAttacks: true,
      stackable: false,          // 不能疊加（一次只擋一次）
    },
  },
  {
    id: "med_suppressant",
    name: "抑制劑",
    icon: "💊",
    color: "#60a5fa",
    desc: "暫停感染倒數 2 個地圖節點",
    weight: 0.5,
    effect: {
      type: "suppress",
      pauseNodes: 2,             // 暫停 2 節點
      doesNotCure: true,         // 不治癒，只延緩
    },
  },
  {
    id: "med_strong_suppressant",
    name: "強效抑制劑",
    icon: "💊",
    color: "#a855f7",
    desc: "增加 5 個剩餘節點，並清除連續受攻擊計數",
    weight: 0.5,
    effect: {
      type: "suppress_strong",
      addNodes: 5,               // +5 節點
      resetConsecutiveAttacks: true,
    },
  },
  {
    id: "med_experimental_serum",
    name: "實驗血清",
    icon: "🧪",
    color: "#f59e0b",
    desc: "完全治癒感染（含完全感染），並清除連續受攻擊計數",
    weight: 0.5,
    effect: {
      type: "cure_all",
      cureFullInfection: true,   // 也可治癒完全感染
      resetConsecutiveAttacks: true,
    },
  },
];

/**
 * 依 ID 取得醫療品
 * @param {string} id
 * @returns {MedicalItem|undefined}
 */
export function getMedicalItem(id) {
  return MEDICAL_ITEMS.find(m => m.id === id);
}

// ─────────────────────────────────────────────────────────────
//  配件（Phase 2+）
//  插槽隨基地等級成長（初始 1 格），每場遠征各 3 次
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} AccessoryItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {string} desc
 * @property {number}  maxUsesPerExpedition — 每場遠征可用次數
 * @property {number}  [unlockBaseLevel]    — 解鎖所需基地等級
 * @property {object}  effect
 */

/** 全部配件 */
export const ACCESSORY_ITEMS = [
  {
    id: "acc_drone",
    name: "無人機",
    icon: "🛸",
    color: "#60a5fa",
    desc: "放大已命中的非頭部部位效果（如擊退、減速、軀幹累積效率）",
    maxUsesPerExpedition: 3,
    unlockBaseLevel: 1,          // 初始即可用
    effect: {
      type: "drone_amplify",
      amplifyNonHeadEffects: true,
      knockbackMult: 1.5,        // 擊退效果 ×1.5
      torsoAccumMult: 1.3,       // 軀幹累積效率 ×1.3
      slowEffectMult: 1.2,       // 減速效果 ×1.2
      cannotAutoHit: true,       // 不自動命中（設計哲學）
    },
  },
  {
    id: "acc_radio",
    name: "無線電",
    icon: "📡",
    color: "#34d399",
    desc: "提升情報預測準確率，降低遭遇誤判機率",
    maxUsesPerExpedition: 3,
    unlockBaseLevel: 3,
    effect: {
      type: "intel_boost",
      intelAccuracyBonus: 0.2,   // 情報正確率 +20%
      reduceMisinformation: true,
    },
  },
  {
    id: "acc_reserve",
    name: "預備隊",
    icon: "🎒",
    color: "#fbbf24",
    desc: "啟動後臨時獲得食物 ×2、飲水 ×2、醫療品 ×1",
    maxUsesPerExpedition: 3,
    unlockBaseLevel: 2,
    effect: {
      type: "supply_drop",
      grants: {
        food: 2,
        water: 2,
        medical: 1,
      },
    },
  },
];

/**
 * 依 ID 取得配件
 * @param {string} id
 * @returns {AccessoryItem|undefined}
 */
export function getAccessory(id) {
  return ACCESSORY_ITEMS.find(a => a.id === id);
}

// ─────────────────────────────────────────────────────────────
//  補給品（背包系統用）
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} SupplyItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {number}  weight — 每個單位重量（kg）
 * @property {string}  category — "food" | "water" | "tool" | "map"
 * @property {string}  desc
 */

/** 全部補給品 */
export const SUPPLY_ITEMS = [
  {
    id: "supply_food",
    name: "食物",
    icon: "🍖",
    color: "#f59e0b",
    weight: 1.0,
    category: "food",
    desc: "每 4 個節點消耗 1 單位，每場額外戰鬥 +1。耗盡時箭數降為 2 枝。",
  },
  {
    id: "supply_water",
    name: "飲水",
    icon: "💧",
    color: "#60a5fa",
    weight: 1.0,
    category: "water",
    desc: "每 2 個節點消耗 1 單位，每場額外戰鬥 +1。耗盡時箭數降為 2 枝。",
  },
  {
    id: "supply_medical_kit",
    name: "醫療包",
    icon: "🩹",
    color: "#34d399",
    weight: 0.5,
    category: "medical",
    desc: "基本醫療用品，可在安全區使用回復狀態。",
  },
  {
    id: "supply_map",
    name: "區域地圖",
    icon: "🗺️",
    color: "#a855f7",
    weight: 0.2,
    category: "map",
    desc: "購買後顯示整張地圖輪廓。未購買只顯示起點與相鄰節點。",
  },
  {
    id: "supply_tool_kit",
    name: "工具組",
    icon: "🔧",
    color: "#6b7280",
    weight: 2.5,
    category: "tool",
    desc: "用於破解障礙、維修建築等場合。單次消耗品。",
  },
  {
    id: "supply_lockpick",
    name: "開鎖工具",
    icon: "🗝️",
    color: "#fbbf24",
    weight: 0.3,
    category: "tool",
    desc: "可用於開啟特殊上鎖的門或寶箱。單次消耗品。",
  },
  {
    id: "supply_flare",
    name: "信號彈",
    icon: "🎆",
    color: "#ef4444",
    weight: 0.5,
    category: "tool",
    desc: "使用後可在特定節點呼叫撤離或救援。單次消耗品。",
  },
  {
    id: "supply_battery",
    name: "電池組",
    icon: "🔋",
    color: "#22c55e",
    weight: 1.0,
    category: "tool",
    desc: "為電子設備（如無人機、無線電）補充電力。單次消耗品。",
  },
  {
    id: "supply_fuel",
    name: "燃料罐",
    icon: "⛽",
    color: "#f97316",
    weight: 3.0,
    category: "tool",
    desc: "用於啟動車輛或發電機等撤離條件。單次消耗品。",
  },
];

/**
 * 依 ID 取得補給品
 * @param {string} id
 * @returns {SupplyItem|undefined}
 */
export function getSupply(id) {
  return SUPPLY_ITEMS.find(s => s.id === id);
}

/**
 * 依分類取得補給品
 * @param {string} category
 * @returns {SupplyItem[]}
 */
export function getSuppliesByCategory(category) {
  return SUPPLY_ITEMS.filter(s => s.category === category);
}

// ─────────────────────────────────────────────────────────────
//  強化道具（防具插槽用）
//  可從探索／打怪／打王掉落，安裝到防具插槽增強效果
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} EnhancementItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {string} desc
 * @property {object}  effect
 * @property {string}  rarity — "common" | "uncommon" | "rare" | "epic" | "legendary"
 */

/** 強化道具 */
export const ENHANCEMENT_ITEMS = [
  {
    id: "enhance_block_1",
    name: "強化襯墊",
    icon: "🛡️",
    color: "#6b7280",
    desc: "格擋率 +5%",
    rarity: "common",
    effect: { blockRateBonus: 0.05 },
  },
  {
    id: "enhance_block_2",
    name: "複合裝甲板",
    icon: "🛡️",
    color: "#3b82f6",
    desc: "格擋率 +10%",
    rarity: "uncommon",
    effect: { blockRateBonus: 0.10 },
  },
  {
    id: "enhance_block_3",
    name: "陶瓷裝甲板",
    icon: "🛡️",
    color: "#a855f7",
    desc: "格擋率 +15%",
    rarity: "rare",
    effect: { blockRateBonus: 0.15 },
  },
  {
    id: "enhance_durability_1",
    name: "加固縫線",
    icon: "🧵",
    color: "#6b7280",
    desc: "耐久度 +2",
    rarity: "common",
    effect: { durabilityBonus: 2 },
  },
  {
    id: "enhance_durability_2",
    name: "強化纖維",
    icon: "🧵",
    color: "#3b82f6",
    desc: "耐久度 +4",
    rarity: "uncommon",
    effect: { durabilityBonus: 4 },
  },
  {
    id: "enhance_anti_bite",
    name: "防咬網層",
    icon: "🕸️",
    color: "#22c55e",
    desc: "殭屍撕咬感染機率 -20%",
    rarity: "uncommon",
    effect: { infectionResist: 0.20 },
  },
  {
    id: "enhance_acid_resist",
    name: "防腐塗層",
    icon: "🧪",
    color: "#34d399",
    desc: "特殊殭屍酸液傷害 -30%",
    rarity: "rare",
    effect: { acidResist: 0.30 },
  },
  {
    id: "enhance_mobility",
    name: "輕量化支架",
    icon: "🏃",
    color: "#f59e0b",
    desc: "防具重量 -0.5kg",
    rarity: "rare",
    effect: { weightReduction: 0.5 },
  },
];

/**
 * 依 ID 取得強化道具
 * @param {string} id
 * @returns {EnhancementItem|undefined}
 */
export function getEnhancement(id) {
  return ENHANCEMENT_ITEMS.find(e => e.id === id);
}
