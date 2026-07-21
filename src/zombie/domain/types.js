// src/zombie/domain/types.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 領域模型型別定義
//  純資料結構，無 Firestore / React 依賴
// ═══════════════════════════════════════════════════════════════

/**
 * 殭屍房間狀態機 phases
 * @readonly
 * @enum {string}
 */
export const ZOMBIE_PHASE = {
  LOBBY:              "lobby",               // 大廳，等待成員加入
  TARGET_SETUP:       "target_setup",        // 靶位設定中
  EXPLORING:          "exploring",            // 地圖探索
  ENCOUNTER_PREPARE:  "encounter_prepare",    // 遭遇準備
  WAITING_FOR_SHOOTERS: "waiting_for_shooters", // 等待射手就位
  SAFETY_COUNTDOWN:   "safety_countdown",     // 安全倒數 5 秒
  SHOOTING:           "shooting",             // 射擊中（計時中）
  SCORE_INPUT:        "score_input",          // 計分輸入
  RESOLVING:          "resolving",            // 結算中
  ARROW_RETRIEVAL:    "arrow_retrieval",      // 拔箭階段
  EXTRACTION:         "extraction",           // 撤離中
  MISSION_COMPLETE:   "mission_complete",     // 任務完成
  MISSION_FAILED:     "mission_failed",       // 任務失敗
  SAFETY_PAUSED:      "safety_paused",        // 緊急暫停
};

/**
 * 生存者生命狀態
 * @readonly
 * @enum {string}
 */
export const LIFE_STATE = {
  HEALTHY:        "healthy",         // 健康
  PROTECTED:      "protected",       // 有防具保護
  INFECTED:       "infected",        // 感染中
  SUPPRESSED:     "suppressed",      // 藥物抑制中
  FULLY_INFECTED: "fully_infected",  // 完全感染（輔助角色）
  DEAD:           "dead",            // 死亡
  EXTRACTED:      "extracted",       // 已撤離
};

/**
 * 角色定位
 * @readonly
 * @enum {string}
 */
export const ROLE = {
  MAIN_ARCHER:  "main_archer",   // 主射手
  REMOTE_SNIPER: "remote_sniper", // 遠端狙擊手
};

/**
 * 殭屍原型 ID
 * @readonly
 * @enum {string}
 */
export const ZOMBIE_ARCHETYPE = {
  NORMAL:  "normal",   // 普通殭屍
  FAST:    "fast",     // 疾行殭屍
  ARMORED: "armored",  // 重裝殭屍
  RANGED:  "ranged",   // 遠程殭屍
  BOSS:    "boss",     // BOSS 巨型殭屍王
};

/**
 * 地圖風險區
 * @readonly
 * @enum {string}
 */
export const ZONE_TYPE = {
  SAFE:       "safe",        // 🟢 安全區
  NORMAL:     "normal",      // 🟡 普通區
  DANGER:     "danger",      // 🟠 危險區
  HIGH_RISK:  "high_risk",   // 🔴 高危區
  RESTRICTED: "restricted",  // ⚫ 禁區
};

/**
 * 防具部位
 * @readonly
 * @enum {string}
 */
export const ARMOR_SLOT = {
  HELMET:    "helmet",
  CHESTPLATE: "chestplate",
  GAUNTLETS: "gauntlets",
  BOOTS:     "boots",
};

/**
 * 配件類型
 * @readonly
 * @enum {string}
 */
export const ACCESSORY_TYPE = {
  DRONE:   "drone",     // 無人機
  RADIO:   "radio",     // 無線電
  RESERVE: "reserve",   // 預備隊
};

// ── BOSS 階段
// @readonly
// @enum {string}
export const BOSS_PHASE = {
  ARMORED:  "armored",   // 護甲階段
  ENRAGED:  "enraged",   // 狂暴階段
  WEAKENED: "weakened",  // 虛弱階段
  DEFEATED: "defeated",  // 擊殺
};

// ── 特殊箭矢類型
// @readonly
// @enum {string}
export const ARROW_TYPE = {
  NORMAL:     "normal",              // 普通箭
  THRESHOLD:  "arrow_threshold",     // 貫穿箭
  KNOCKBACK:  "arrow_knockback",     // 擊退箭
  PENETRATION: "arrow_penetration",  // 穿透箭
  EXPLOSIVE:  "arrow_explosive",     // 爆炸箭
  SILENT:     "arrow_silent",        // 靜音箭
};

/**
 * 配件使用狀態
 * @typedef {object} AccessoryState
 * @property {number} usesLeft — 本場剩餘使用次數
 */

// ── 資料型別定義（JSDoc）─────────────────────────────────

/**
 * @typedef {object} ZombieRoom
 * @property {number}  schemaVersion — 結構版本號
 * @property {string}  hostId — 房主 member ID
 * @property {string}  status — ZOMBIE_PHASE 其一
 * @property {ZombieRoomSettings} settings — 房間設定
 * @property {Object<string, ZombieSurvivor>} members — memberId → 生存者
 * @property {ZombieEncounter}  [encounter] — 當前遭遇
 * @property {ZombieMapState}   [map] — 地圖狀態
 * @property {Object<string, boolean>} [clearedBossIds] — 已清除 BOSS ID
 * @property {ZombieSafetyState} safety — 安全狀態
 * @property {number}  commandVersion — 指令版本號（防競賽）
 * @property {ZombiePresentationState} [presentation] — 中央顯示器狀態
 */

/**
 * @typedef {object} ZombieRoomSettings
 * @property {string[]} targetSlots — 靶位 ID 陣列（如 ["A","B","C","D"]）
 * @property {number}   realDistanceM — 實際射距（公尺）
 * @property {string}   timerProfileId — 計時設定檔 ID
 * @property {number}   [maxArchers] — 主射手上限（預設 5）
 * @property {number}   [maxSnipers] — 遠端狙擊上限（預設 3）
 */

/**
 * @typedef {object} ZombieSurvivor
 * @property {string}  name — 玩家名稱
 * @property {string}  lifeState — LIFE_STATE 其一
 * @property {ZombieInfectionState} [infection] — 感染狀態
 * @property {ZombieFullyInfectedSupport} [fullyInfectedSupport] — 完全感染輔助
 * @property {Object<string, ZombieArmorPiece>} armor — armorSlot → 防具
 * @property {Object<string, number>} supplies — 補給品 ID → 數量
 * @property {string}  role — ROLE 其一
 * @property {number}  [hitDistanceOffsetM] — 遠端命中距離偏移
 * @property {Object<number, ZombieArrow[]>} submissions — 回合 → 箭矢陣列
 * @property {number}  [carriedWeight] — 當前攜帶總重量
 * @property {string[]} [accessories] — 已裝備配件 ID
 * @property {number}  [accessoryUses] — 配件剩餘使用次數
 */

/**
 * @typedef {object} ZombieInfectionState
 * @property {number}  remainingMapNodes — 剩餘地圖節點數
 * @property {number}  delays — 已累積延緩次數
 * @property {string}  [source] — 感染來源
 * @property {number}  consecutiveAttacks — 連續受攻擊次數
 */

/**
 * @typedef {object} ZombieFullyInfectedSupport
 * @property {number}  [interferenceScore] — 干擾分數
 * @property {number}  [interferenceCooldown] — 干擾冷卻
 * @property {number}  [interferenceUses] — 干擾可用次數
 */

/**
 * @typedef {object} ZombieArmorPiece
 * @property {string}  itemId — 防具 ID
 * @property {number}  durability — 目前耐久
 * @property {string[]} [enhancements] — 已安裝強化道具 ID
 */

/**
 * @typedef {object} ZombieArrow
 * @property {string}  targetSlot — 目標靶位 (A-D)
 * @property {number}  [nx] — SVG 歸一化 X 座標
 * @property {number}  [ny] — SVG 歸一化 Y 座標
 * @property {boolean} isMiss — 是否脫靶 (M)
 */

/**
 * @typedef {object} ZombieEncounter
 * @property {number}  round — 當前回合數
 * @property {Object<string, Zombie>} zombies — zombieId → 殭屍
 * @property {string}  [pendingResolution] — 待結算 resolution ID
 */

/**
 * @typedef {object} Zombie
 * @property {string}  archetypeId — ZOMBIE_ARCHETYPE 其一
 * @property {string}  targetSlot — 目前佔用的靶位
 * @property {number}  distanceM — 當前距離（公尺）
 * @property {string[]} status — 狀態標記陣列（如 ["slowed","arm_destroyed"]）
 * @property {Object<string, number>} body — 部位名稱 → 累積命中次數
 * @property {string[]} threatOrderMemberIds — 攻擊優先順序（member ID）
 * @property {number}  threatCursor — 目前攻擊目標索引
 * @property {number}  [headHitCount] — 頭部累積命中次數
 */

/**
 * @typedef {object} ZombieMapState
 * @property {string}  mapId — 地圖 ID
 * @property {string}  currentNodeId — 當前節點 ID
 * @property {string[]} revealedNodeIds — 已揭露節點 ID 陣列
 * @property {Object<string, ZombieMapNode>} nodes — nodeId → 節點
 * @property {number}  intelAccuracy — 當前情報正確率 (0-100)
 * @property {boolean} mapPurchased — 是否已購買地圖
 */

/**
 * @typedef {object} ZombieMapNode
 * @property {string}  id — 節點 ID
 * @property {string}  zoneType — ZONE_TYPE 其一
 * @property {string}  label — 節點名稱（如「醫院」）
 * @property {string[]} connectedNodeIds — 相鄰節點 ID
 * @property {boolean} isExtractionPoint — 是否為撤離點
 * @property {string}  [extractionType] — 撤離類型
 * @property {boolean} isSafeZone — 是否為安全區
 * @property {boolean} [bossGuarded] — 是否有 BOSS 守護
 * @property {boolean} [bossCleared] — BOSS 是否已清除
 */

/**
 * @typedef {object} ZombieSafetyState
 * @property {boolean} paused — 是否暫停中
 * @property {string}  [pauseReason] — 暫停原因
 * @property {object}  [shootingStartedAt] — Firestore Timestamp
 * @property {object}  [deadlineAt] — 射擊截止時間
 */

/**
 * @typedef {object} ZombiePresentationState
 * @property {string}  resolutionId — 結算 ID
 * @property {string}  eventLogId — 事件日誌 ID
 * @property {"idle"|"ready"|"playing"|"complete"} playbackState — 播放狀態
 */

// ── 殭屍部位部位名稱常數 ──────────────────────────────
export const BODY_PARTS = [
  { id:"head",   name:"頭部",   mult:1.25, instantKill:true  },
  { id:"neck",   name:"頸部",   mult:1.20, instantKill:false, killChance:0.5 },
  { id:"chest",  name:"胸腔",   mult:1.10, lethalCount:3     },
  { id:"belly",  name:"腹部",   mult:1.05, lethalCount:3     },
  { id:"arm",    name:"手臂",   mult:1.0,  knockback:1        },
  { id:"groin",  name:"鼠蹊",   mult:1.15, slowEffect:true    },
  { id:"heart",  name:"心臟",   mult:1.50, locked:true, unlockFrom:"chest" },
  { id:"lung",   name:"肺葉",   mult:1.35, locked:true, unlockFrom:"chest" },
  { id:"kidney", name:"腎臟",   mult:1.30, locked:true, unlockFrom:"belly" },
  { id:"balls",  name:"要害",   mult:1.40, locked:true, unlockFrom:"groin" },
  { id:"miss",   name:"脫靶",   mult:0                           },
];

// ── 防具五級基礎數值 ──────────────────────────────────
export const ARMOR_TIERS = [
  { tier:1, label:"普通",   blockRate:0.40, durability:3,  slots:0 },
  { tier:2, label:"精良",   blockRate:0.55, durability:5,  slots:1 },
  { tier:3, label:"稀有",   blockRate:0.70, durability:8,  slots:1 },
  { tier:4, label:"史詩",   blockRate:0.82, durability:12, slots:2 },
  { tier:5, label:"傳說",   blockRate:0.92, durability:16, slots:2 },
];

// ── 各區遭遇率 ──────────────────────────────────────────
export const ZONE_ENCOUNTER_RATES = {
  [ZONE_TYPE.SAFE]:       0,
  [ZONE_TYPE.NORMAL]:     0.20,
  [ZONE_TYPE.DANGER]:     0.40,
  [ZONE_TYPE.HIGH_RISK]:  0.60,
  [ZONE_TYPE.RESTRICTED]: 0.80,
};

// ── 感染系統常數 ─────────────────────────────────────
/** 感染進程：每個地圖節點減少 1 點，歸零則完全感染 */
export const INFECTION_INITIAL_NODES = 8;
/** 連續受攻擊上限：超過則加速感染 */
export const INFECTION_MAX_CONSECUTIVE = 3;

// ── 背包初始重量 ──────────────────────────────────────
export const ITEM_WEIGHTS = {
  food:         1.0,
  water:        1.0,
  medical:      0.5,
  normalArrows: 0.1,   // 每枝
  specialArrow: 0.5,
  tool:         2.5,   // 平均
  map:          0.2,
};

export const INITIAL_BACKPACK_CAPACITY = 20; // kg
