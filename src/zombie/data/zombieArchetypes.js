// src/zombie/data/zombieArchetypes.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 殭屍原型資料表
//  內含 4 種已確認殭屍類型 + BOSS 原型（巨型殭屍王）
//  所有數值皆依據 integrated-plan.md 已確認決策
// ═══════════════════════════════════════════════════════════════

import { ZOMBIE_ARCHETYPE, ZONE_TYPE } from "../domain/types";

// ── 殭屍原型定義 ─────────────────────────────────────────
// 每種殭屍定義：
//   id, name, icon, desc
//   speed: { min, max }       — 每回合前進距離範圍
//   killThreshold: { head, torso }  — 頭部/軀幹擊殺所需箭數
//   specialRules: []          — 特殊行為規則清單
//   bodyOverrides: {}         — 部位規則覆寫（相對於普通殭屍基線）
//   behavior: {}              — 行為特徵
//   zones: []                 — 可出現的區域

/**
 * @typedef {object} ZombieArchetype
 * @property {string}   id — 唯一識別碼
 * @property {string}   name — 顯示名稱
 * @property {string}   icon — Emoji 圖示
 * @property {string}   desc — 描述
 * @property {{min:number, max:number}} speed — 每回合移動範圍（公尺）
 * @property {{head:number, torso:number}} killThreshold — 擊殺門檻
 * @property {string[]} specialRules — 特殊行為規則標籤
 * @property {object}   [bodyOverrides] — 部位規則覆寫
 * @property {object}   [behavior] — 行為特徵
 * @property {string[]} [zones] — 可出現的風險區（預設所有區域）
 */

/** 全部 4 種已確認殭屍原型 */
export const ZOMBIE_ARCHETYPES = {
  [ZOMBIE_ARCHETYPE.NORMAL]: {
    id: ZOMBIE_ARCHETYPE.NORMAL,
    name: "普通殭屍",
    icon: "🧟",
    color: "#6b7280",
    desc: "最常見的殭屍，移動速度普通，各部位皆有標準判定。",

    speed: { min: 1, max: 3 },
    killThreshold: { head: 1, torso: 3 },

    specialRules: [],

    // 普通殭屍使用 BODY_PARTS 完整基線，不需要 overrides。
    // 基線規則（見 battle-and-world-decisions.md）：
    //   頭部: 100% instant kill
    //   頸部: 50% kill, second hit guaranteed, 1m knockback
    //   胸+腹: 3 arrows cumulative, 1m knockback each
    //   手臂: 1m knockback, first hit halves grab/pounce, second hit 0%
    //   骨盆: slow (0-1m/round), no lethal accumulation
    bodyOverrides: null,
    behavior: {
      attackType: "bite",           // 0m 咬傷
      knockbackResist: false,       // 受擊退影響
      slowResist: false,            // 受減速影響
    },
  },

  [ZOMBIE_ARCHETYPE.FAST]: {
    id: ZOMBIE_ARCHETYPE.FAST,
    name: "疾行殭屍",
    icon: "💨",
    color: "#f59e0b",
    desc: "移動迅速的殭屍，需要更多頭部與軀幹命中才能擊殺。",

    speed: { min: 2, max: 4 },
    killThreshold: { head: 2, torso: 6 },

    specialRules: [
      "high_mobility",       // 高機動性，移動範圍大
      "pelvis_slow_reduce",  // 骨盆命中後速度降為 1-2m（而非 0-1m）
    ],

    bodyOverrides: {
      head: { instantKill: false, lethalCount: 2 },
      chest: { lethalCount: 6 },
      belly: { lethalCount: 6 },
      groin: { slowTo: { min: 1, max: 2 } }, // 骨盆命中後仍算快
    },
    behavior: {
      attackType: "bite",
      knockbackResist: false,
      slowResist: false,        // 部位效果完全有效（與普通相同）
      pelvisSlowEffect: "reduced", // 骨盆減速效果較弱
    },
  },

  [ZOMBIE_ARCHETYPE.ARMORED]: {
    id: ZOMBIE_ARCHETYPE.ARMORED,
    name: "重裝殭屍",
    icon: "🛡️",
    color: "#8b5cf6",
    desc: "全身裝甲的殭屍，推進緩慢但到達 0m 時發動破甲衝撞。",

    speed: { min: 1, max: 2 },
    killThreshold: { head: 3, torso: 6 },
    // 頭部: 需特殊裝備才能 1 箭秒殺，否則累積 3 次
    // 軀幹: 6 箭，裝備可降低所需箭數

    specialRules: [
      "armored",             // 裝甲型
      "charge_attack",       // 0m 破甲衝撞
      "head_gear_required",  // 頭部需特殊裝備才能秒殺
      "equipment_reduces_threshold", // 裝備可降低擊殺門檻
    ],

    bodyOverrides: {
      head: { instantKill: false, lethalCount: 3, gearRequired: true },
      chest: { lethalCount: 6 },
      belly: { lethalCount: 6 },
      groin: { slowTo: { min: 0, max: 1 } },
    },
    behavior: {
      attackType: "charge",         // 破甲衝撞
      knockbackResist: false,
      slowResist: false,            // 部位效果完全有效
      damageBonus: 1.5,             // 0m 衝撞傷害加成
    },
  },

  [ZOMBIE_ARCHETYPE.RANGED]: {
    id: ZOMBIE_ARCHETYPE.RANGED,
    name: "遠程殭屍",
    icon: "🎯",
    color: "#ef4444",
    desc: "可在遠距離干擾射手的脆弱殭屍，胸部一箭即可擊殺。",

    speed: { min: 1, max: 2 },
    killThreshold: { head: 1, torso: 1 },
    // 胸部一箭擊殺（極脆皮）

    specialRules: [
      "ranged_interference",   // 遠程干擾
      "auto_interfere",        // 每回合自動干擾
      "no_counter",            // 無法反制
      "high_risk_only",        // 只在高危區以上出現
    ],

    bodyOverrides: {
      // 軀幹擊殺改為 1 箭（極度脆弱）
      chest: { lethalCount: 1 },
      belly: { lethalCount: 1 },
    },
    behavior: {
      attackType: "interfere",      // 干擾為主
      interfereRange: 8,            // 8m 即可開始干擾
      interfereEffect: "lose_arrow", // 目標下回合少 1 箭
      interfereRate: "once_per_round", // 每回合一次
      meleeAt0m: true,              // 到 0m 後改用近戰咬傷
      knockbackResist: false,
      slowResist: false,
    },

    // 只在高危區以上出現
    zones: [ZONE_TYPE.HIGH_RISK, ZONE_TYPE.RESTRICTED],
  },
};

// ── 取得殭屍原型 ─────────────────────────────────────────

/**
 * 依 ID 取得殭屍原型
 * @param {string} archetypeId
 * @returns {ZombieArchetype|undefined}
 */
export function getArchetype(archetypeId) {
  return ZOMBIE_ARCHETYPES[archetypeId];
}

/**
 * 取得所有殭屍原型（陣列）
 * @returns {ZombieArchetype[]}
 */
export function getAllArchetypes() {
  return Object.values(ZOMBIE_ARCHETYPES);
}

/**
 * 依風險區過濾可出現的殭屍原型
 * @param {string} zoneType — ZONE_TYPE 其一
 * @returns {ZombieArchetype[]}
 */
export function getArchetypesForZone(zoneType) {
  return getAllArchetypes().filter(a => {
    // 若原型未指定 zones，則可在所有區域出現
    if (!a.zones || a.zones.length === 0) return true;
    return a.zones.includes(zoneType);
  });
}

// ── BOSS 定義 ────────────────────────────────────────────

/**
 * @typedef {object} BOSSArchetype
 * @property {string}   id
 * @property {string}   name
 * @property {string}   icon
 * @property {string}   color
 * @property {string}   desc
 * @property {object[]} phases — 多階段行為
 * @property {string[]} visibleWeakPoints — 可見弱點
 * @property {string[]} specialAttacks — 特殊攻擊
 * @property {string[]} rewards — 專屬獎勵
 */

/** BOSS 原型定義 */
export const BOSS_ARCHETYPES = {
  giant_zombie_king: {
    id: "giant_zombie_king",
    name: "巨型殭屍王",
    icon: "👑",
    color: "#dc2626",
    desc: "由無數殭屍融合而成的巨型怪物，擁有護甲、狂暴與虛弱三個階段。",

    // 三個階段
    phases: [
      {
        name: "護甲階段",
        condition: "HP > 66%",
        behavior: "外層裝甲保護，軀幹擊殺需求提升至 12 箭。頭部仍 1 箭必殺但暴露時間有限。",
        specialTarget: "裝甲縫隙（每次射擊窗口 3 秒）",
      },
      {
        name: "狂暴階段",
        condition: "HP 33%~66%",
        behavior: "裝甲碎裂，移動加速（2-4m/回合），攻擊頻率加倍。每回合干擾 2 名射手。",
        specialTarget: "心臟核心（需先擊碎胸口裝甲）",
      },
      {
        name: "虛弱階段",
        condition: "HP < 33%",
        behavior: "移動減速（0-1m/回合），所有弱點完全暴露。部位效果 ×1.5 倍。",
        specialTarget: "頭部弱點（一箭必殺窗口）",
      },
    ],

    visibleWeakPoints: ["頭部", "心臟核心（狂暴後）", "裝甲縫隙"],
    specialAttacks: [
      "橫掃攻擊（範圍傷害，所有主射手）",
      "屍彈投射（遠程干擾，隨機 1-2 人）",
      "裝甲修復（護甲階段每 3 回合回復部分裝甲）",
    ],
    rewards: [
      "殭屍王核心（研究材料）",
      "不滅裝甲碎片（傳說級防具材料）",
      "亡者之心（特殊配件材料）",
    ],
  },
};

/**
 * 取得 BOSS 原型
 * @param {string} bossId
 * @returns {BOSSArchetype|undefined}
 */
export function getBOSSArchetype(bossId) {
  return BOSS_ARCHETYPES[bossId];
}

// ── 遭遇生成輔助 ─────────────────────────────────────────

/**
 * 根據風險區與回合數，決定生成的殭屍組合
 * @param {string} zoneType — ZONE_TYPE 其一
 * @param {number} [round] — 目前遭遇回合（預設 1）
 * @returns {{ archetypes: string[], count: number }}
 */
export function generateEncounterProfile(zoneType, round = 1) {
  const baseCount = round <= 1 ? 2 : Math.min(2 + Math.floor(round / 2), 6);

  switch (zoneType) {
    case ZONE_TYPE.SAFE:
      return { archetypes: [], count: 0 };

    case ZONE_TYPE.NORMAL:
      // 普通區：只有普通殭屍 + 低機率特殊事件
      return {
        archetypes: [ZOMBIE_ARCHETYPE.NORMAL],
        count: baseCount,
      };

    case ZONE_TYPE.DANGER:
      // 危險區：普通 + 疾行，低機率重裝
      return {
        archetypes: [
          ZOMBIE_ARCHETYPE.NORMAL,
          ZOMBIE_ARCHETYPE.FAST,
          ...(Math.random() < 0.2 ? [ZOMBIE_ARCHETYPE.ARMORED] : []),
        ],
        count: baseCount + 1,
      };

    case ZONE_TYPE.HIGH_RISK:
      // 高危區：所有類型混編（含遠程），無 BOSS
      return {
        archetypes: [
          ZOMBIE_ARCHETYPE.NORMAL,
          ZOMBIE_ARCHETYPE.FAST,
          ZOMBIE_ARCHETYPE.ARMORED,
          ZOMBIE_ARCHETYPE.RANGED,
        ],
        count: baseCount + 2,
      };

    case ZONE_TYPE.RESTRICTED:
      // 禁區：所有類型，極高密度
      return {
        archetypes: [
          ZOMBIE_ARCHETYPE.NORMAL,
          ZOMBIE_ARCHETYPE.FAST,
          ZOMBIE_ARCHETYPE.ARMORED,
          ZOMBIE_ARCHETYPE.RANGED,
        ],
        count: baseCount + 3,
      };

    default:
      return { archetypes: [ZOMBIE_ARCHETYPE.NORMAL], count: 2 };
  }
}

// ── 殭屍狀態標籤 ─────────────────────────────────────────

/** 殭屍身上可附加的狀態標籤 */
export const ZOMBIE_STATUS = {
  SLOWED:         "slowed",          // 減速
  KNOCKED_BACK:   "knocked_back",    // 被擊退
  ARM_DESTROYED:  "arm_destroyed",   // 手臂失效
  GRAB_HALVED:    "grab_halved",     // 抓取成功率減半
  GRAB_DISABLED:  "grab_disabled",   // 抓取成功率 0%
  PELVIS_HIT:     "pelvis_hit",      // 骨盆命中
  TORSO_DAMAGED:  "torso_damaged",   // 軀幹累積傷害
  NECK_HIT:       "neck_hit",        // 頸部命中（50% 判定）
  STAGGERED:      "staggered",       // 擊暈（新入場該回合）
};
