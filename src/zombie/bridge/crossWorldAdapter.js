// src/zombie/bridge/crossWorldAdapter.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 跨世界 Adapter（Phase 4）
//  有限 allowlist，只允許已驗證的地下城 hook
//  不直接突變 dungeon member stats
// ═══════════════════════════════════════════════════════════════

// ── 允許清單 ─────────────────────────────────────────────
// 所有跨世界效果 ID 必須在此註冊才能生效
// 格式: { effectId, description, category, effect }
const ALLOWLIST = [
  {
    id: "dungeon_reward_coin_bonus",
    description: "遠征金幣加成 - 地下城結算時額外金幣",
    category: "reward_bonus",
    effect: { type: "coin_mult", value: 1.1 },
  },
  {
    id: "dungeon_material_grant",
    description: "遠征材料加成 - 地下城結算時額外材料",
    category: "reward_bonus",
    effect: { type: "material_bonus", value: 1 },
  },
  {
    id: "dungeon_existing_buff",
    description: "保留地下城既有增益效果",
    category: "buff",
    effect: { type: "buff_retention", value: 0.8 },
  },
  {
    id: "dungeon_skip_counter",
    description: "跳過一次反擊（需經審核啟用）",
    category: "combat",
    effect: { type: "skip_counter", value: 1 },
  },
  {
    id: "zombie_intel_to_dungeon",
    description: "殭屍情報轉換為地下城探索加成",
    category: "conversion",
    effect: { type: "intel_conversion", value: 0.05 },
  },
  {
    id: "zombie_boss_material_research",
    description: "BOSS 專屬材料用於跨世界研究",
    category: "research",
    effect: { type: "research_grant", value: 1 },
  },
];

/**
 * 檢查效果 ID 是否在允許清單中
 * @param {string} effectId
 * @returns {boolean}
 */
export function isEffectAllowed(effectId) {
  return ALLOWLIST.some(entry => entry.id === effectId);
}

/**
 * 取得允許清單中的所有效果
 * @returns {Array}
 */
export function getAllowedEffects() {
  return [...ALLOWLIST];
}

/**
 * 依 ID 取得效果定義
 * @param {string} effectId
 * @returns {{ id: string, description: string, category: string, effect: object }|undefined}
 */
export function getEffect(effectId) {
  return ALLOWLIST.find(entry => entry.id === effectId);
}

/**
 * 跨世界效果工廠 — 轉換殭屍獎勵為地下城可用的格式
 * 目前回傳靜態資料，Phase 5 擴充
 * @param {string} effectId
 * @param {object} context — 當前狀態上下文
 * @returns {{ ok: boolean, transformed?: object, reason?: string }}
 */
export function transformEffect(effectId, context = {}) {
  const entry = getEffect(effectId);
  if (!entry) {
    return { ok: false, reason: `未知效果 ID: ${effectId}（不在 allowlist 中）` };
  }

  // 檢查 context 中是否有必要資料
  switch (entry.effect.type) {
    case "coin_mult":
      return {
        ok: true,
        transformed: {
          type: "coin_mult",
          mult: entry.effect.value,
          baseCoins: context.baseCoins || 0,
          bonusCoins: Math.round((context.baseCoins || 0) * (entry.effect.value - 1)),
        },
      };

    case "material_bonus":
      return {
        ok: true,
        transformed: {
          type: "material_bonus",
          bonusQuantity: entry.effect.value,
          materials: context.materials || [],
        },
      };

    case "buff_retention":
      return {
        ok: true,
        transformed: {
          type: "buff_retention",
          retentionRate: entry.effect.value,
          activeBuffs: context.activeBuffs || [],
        },
      };

    case "skip_counter":
      return {
        ok: true,
        transformed: {
          type: "skip_counter",
          skipsAvailable: entry.effect.value,
        },
      };

    case "intel_conversion":
      return {
        ok: true,
        transformed: {
          type: "intel_conversion",
          intelBonus: entry.effect.value,
          currentIntel: context.intelAccuracy || 0,
          convertedIntel: Math.round((context.intelAccuracy || 0) * entry.effect.value),
        },
      };

    case "research_grant":
      return {
        ok: true,
        transformed: {
          type: "research_grant",
          researchPoints: 1,
          bossMaterialId: context.bossMaterialId || null,
        },
      };

    default:
      return { ok: false, reason: `未知效果類型: ${entry.effect.type}` };
  }
}

/**
 * 驗證獎勵是否可在跨世界使用
 * @param {object} reward — 殭屍獎勵物件
 * @returns {{ valid: boolean, allowedEffects: string[], rejectedEffects: string[] }}
 */
export function validateCrossWorldReward(reward) {
  const effectIds = reward?.crossWorldEffects || [];
  const allowed = [];
  const rejected = [];

  for (const id of effectIds) {
    if (isEffectAllowed(id)) {
      allowed.push(id);
    } else {
      rejected.push(id);
    }
  }

  return {
    valid: rejected.length === 0,
    allowedEffects: allowed,
    rejectedEffects: rejected,
  };
}

// ── 分類統計 ─────────────────────────────────────────────
export function getEffectCategories() {
  const categories = {};
  for (const entry of ALLOWLIST) {
    if (!categories[entry.category]) {
      categories[entry.category] = [];
    }
    categories[entry.category].push(entry.id);
  }
  return categories;
}
