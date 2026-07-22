import { catLevelFromXP } from "./catLevel";

// src/lib/villageData.js

export const BUILDING_LIST = ['mine','farm','harbor','hunting','market','warehouse','alchemy','gacha','archery'];

export const BUILDINGS = {
  mine:      { id:'mine',      name:'礦山',      emoji:'⛏️',  resource:'ore',       resourceName:'礦物',       layer:0 },
  farm:      { id:'farm',      name:'農地',      emoji:'🌿',  resource:'melon',     resourceName:'瓜瓜',       layer:0 },
  harbor:    { id:'harbor',    name:'海港',      emoji:'⚓',  resource:'fish',      resourceName:'鮮魚',       layer:1 },
  hunting:   { id:'hunting',   name:'獵場',      emoji:'🏕️',  resource:'meat',      resourceName:'動物肉',     layer:1 },
  market:    { id:'market',    name:'貓貓市集',  emoji:'🛒',  resource:'driedfish', resourceName:'小魚乾',     layer:1 },
  warehouse: { id:'warehouse', name:'露天倉庫',  emoji:'📦',  resource:'can',       resourceName:'貓罐頭',     layer:2 },
  alchemy:   { id:'alchemy',   name:'煉金室',    emoji:'⚗️',  resource:'arrowdew',resourceName:'箭露（微量）', layer:2 },
  gacha:     { id:'gacha',     name:'扭蛋亭',    emoji:'🎰',  resource:'gachaToken',resourceName:'扭蛋代幣',   layer:3 },
  archery:   { id:'archery',   name:'練箭場',    emoji:'🏹',  resource:'archer',    resourceName:'貓貓射手',   layer:3 },
};

export const RESOURCE_NAMES = {
  arrowdew: '箭露', ore:'礦物', melon:'瓜瓜', fish:'鮮魚',
  meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭',
  potion:'貓薄荷藥水', fur:'貓毛', archer:'貓貓射手',
  gachaToken:'扭蛋代幣', mission:'任務材料',
};

// 升等箭露費用（index = 目標等級）
export const ARROWDEW_COSTS = [
  0, 0, 50, 100, 180, 300, 480, 750, 1150, 1800,
  2800, 4200, 6200, 9000, 13000, 19000, 27000, 38000, 54000, 75000, 105000,
];

// 材料需求表（每棟 × 等級段）
const MAT = {
  mine:      { '5-8':['melon',1,null,0],     '9-12':['melon',2,'meat',1],    '13-16':['melon',3,'meat',2],     '17-20':['melon',4,null,0,true] },
  farm:      { '5-8':['ore',1,null,0],        '9-12':['ore',2,'fish',1],      '13-16':['ore',3,'potion',1],     '17-20':['ore',4,null,0,true] },
  harbor:    { '5-8':['ore',1,'melon',1],     '9-12':['ore',2,'melon',2],     '13-16':['ore',3,'can',1],        '17-20':['ore',4,null,0,true] },
  hunting:   { '5-8':['melon',1,'ore',1],     '9-12':['melon',2,'ore',2],     '13-16':['melon',3,'can',1],      '17-20':['melon',4,null,0,true] },
  market:    { '5-8':['ore',1,'melon',1],     '9-12':['fish',1,'meat',1],     '13-16':['fish',2,'potion',1],    '17-20':['fish',3,null,0,true] },
  warehouse: { '5-8':['meat',1,'ore',1],      '9-12':['meat',2,'ore',2],      '13-16':['meat',3,'driedfish',1], '17-20':['meat',4,null,0,true] },
  alchemy:   { '5-8':['melon',1,'fish',1],    '9-12':['melon',2,'fish',2],    '13-16':['melon',3,'driedfish',1],'17-20':['melon',4,null,0,true] },
  gacha:     { '5-8':['driedfish',1,'can',1], '9-12':['driedfish',2,'can',2], '13-16':['driedfish',3,'potion',2],'17-20':['driedfish',4,null,0,true] },
  archery:   { '5-8':['ore',1,'can',1],       '9-12':['ore',2,'potion',1],    '13-16':['ore',3,'fur',1],        '17-20':['ore',4,'fur',3,true] },
};
// MAT 格式: [主資源, 主Tier, 副資源|null, 副Tier, mission?]

function getMatKey(lv) {
  if (lv <= 4)  return null;
  if (lv <= 8)  return '5-8';
  if (lv <= 12) return '9-12';
  if (lv <= 16) return '13-16';
  return '17-20';
}

// 各升級段所需材料數量（設計為可玩一年以上的節奏）
const COUNT_TABLE = {
  '5-8':   { main:[15, 25, 40, 60], sub:[0,  8, 15, 25] },
  '9-12':  { main:[12, 20, 30, 45], sub:[0,  6, 12, 20] },
  '13-16': { main:[10, 16, 24, 35], sub:[0,  5, 10, 18] },
  '17-20': { main:[ 8, 12, 18, 25], sub:[0,  4,  8, 14] },
};

export function getUpgradeRequirements(buildingId, targetLevel) {
  if (targetLevel > 20) return null;
  const arrowdew = ARROWDEW_COSTS[targetLevel] || 0;
  const key = getMatKey(targetLevel);
  if (!key) return { arrowdew, materials: [] };

  const m = MAT[buildingId]?.[key];
  if (!m) return { arrowdew, materials: [] };

  const idx = (targetLevel - 1) % 4;
  const ct  = COUNT_TABLE[key];
  const mainCount = ct.main[idx];
  const subCount  = ct.sub[idx];

  const materials = [];
  if (m[0]) materials.push({ resource: m[0], tier: m[1], count: mainCount });
  if (m[2] && subCount > 0) materials.push({ resource: m[2], tier: m[3], count: subCount });
  if (m[4]) {
    const mc = [2, 3, 4, 5][idx];
    materials.push({ resource: 'mission', tier: 1, count: mc });
  }

  return { arrowdew, materials };
}

export function getBuildingStage(level) {
  if (level <= 4)  return 1;
  if (level <= 8)  return 2;
  if (level <= 12) return 3;
  if (level <= 16) return 4;
  return 5;
}

// ── Stage 倍率表 ──────────────────────────────────────────
// Stage 越高產能加成越多，鼓勵玩家提升建築品質
// 2026-07-12 上調：鍛造成本維持高（長期目標），改用提高「分層材料」產能來餵。
// 只作用於分層資源（礦/肉/小魚乾/藥水＝鍛造料），不影響箭露/扭蛋幣，
// 因此建築升級門檻（主要卡箭露）維持不變，只是材料產出變多。
const STAGE_MULTIPLIERS = [1.2, 1.4, 1.7, 2.0, 2.5];

export function getStageMultiplier(lv) {
  const stage = getBuildingStage(lv);
  return STAGE_MULTIPLIERS[stage - 1] || 1.0;
}

// 可同時生產的 tier 數量上限（產能分配槽數）
export function getMaxSlots(lv) {
  const stage = getBuildingStage(lv);
  return [1, 2, 2, 3, 3][stage - 1] || 1;
}

// 解鎖條件表（null = 預設解鎖）
export const UNLOCK_REQS = {
  mine:      null,
  farm:      null,
  harbor:    { mine: 2 },
  hunting:   { farm: 2 },
  market:    { harbor: 2 },        // harbor OR hunting >= 2（market 特殊邏輯在 isBuildingUnlocked）
  warehouse: { market: 3 },
  alchemy:   { harbor: 3, hunting: 3 },
  gacha:     { warehouse: 3, alchemy: 3 },
  archery:   { gacha: 3 },
};

export function isBuildingUnlocked(buildingId, buildings) {
  const req = UNLOCK_REQS[buildingId];
  if (!req) return true;
  // market 特殊：海港 OR 獵場 任一 >= 2 即可
  if (buildingId === 'market') {
    return (buildings?.harbor || 1) >= 2 || (buildings?.hunting || 1) >= 2;
  }
  return Object.entries(req).every(([id, minLv]) => (buildings?.[id] || 1) >= minLv);
}

export function getVillageLevel(buildings) {
  const unlocked = BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings));
  if (unlocked.length === 0) return 1;
  const total = unlocked.reduce((s, id) => s + (buildings?.[id] || 1), 0);
  return Math.min(20, Math.floor(total / unlocked.length));
}

const BASE_PROD = {
  archery:3, gacha:0.002, warehouse:2, market:1.5,
  mine:1, farm:1, harbor:1, hunting:1, alchemy:0.25,
};

// ── 生產曲線：1.18^(level-1) ──────────────────────────────
// 讓後期成長更有感，Lv.20 ≈ 21×
export function getProductionRate(buildingId, level) {
  const base = BASE_PROD[buildingId] || 2;
  const raw = base * Math.pow(1.18, level - 1);
  if (raw < 0.1) return Math.round(raw * 10000) / 10000; // 4 位小數（扭蛋幣等超低產能）
  if (raw < 1)   return Math.round(raw * 100) / 100;     // 2 位小數（<1/hr）
  return Math.round(raw * 10) / 10;                      // 1 位小數（≥1/hr）
}

export const MAX_COLLECT_HOURS = 24;

// ── 貓貓圖鑑生產加乘（預留，尚未實裝）──────────────────────
// 未來「貓貓圖鑑」實裝後，依收集進度回傳 >1 的倍率，透過
// calcPendingResources(village, { catDexMult }) 傳入放大全村產能。
// 現在恆為 1.0 → 不影響任何現有平衡，只是先把接線留好。
export const CATDEX_PRODUCTION_MULT = 1.0;

// 需要 tier 後綴的資源（_t1~_t5）
export const TIERED_RESOURCES = new Set(['ore','melon','fish','meat','driedfish','can','potion','fur','archer']);

// 取得正確的 Firestore 資源 key
export function getResourceKey(resource, tier) {
  return TIERED_RESOURCES.has(resource) ? `${resource}_t${tier}` : resource;
}

// ── 預設產能分配（等分）───────────────────────────────────
export function getDefaultAllocation(lv) {
  const maxTier = getBuildingStage(lv);
  const slots   = getMaxSlots(lv);
  const alloc   = {};
  // 取可用的前 slots 個 tier 等分；其餘 0
  const activeCount = Math.min(maxTier, slots);
  const each        = Math.floor(100 / activeCount);
  let remainder     = 100 - each * activeCount;
  for (let t = 1; t <= maxTier; t++) {
    if (t <= activeCount) {
      alloc[String(t)] = each + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    } else {
      alloc[String(t)] = 0;
    }
  }
  return alloc;
}

// 舊帳號可能留下 t1 / tier1、空物件或 0~1 比例的分配格式。顯示與收集
// 都使用這個入口，避免「欄位存在但讀不到」導致產量完全歸零。
export function normalizeBuildingAllocation(level, rawAllocation) {
  const maxTier = getBuildingStage(level || 1);
  if (!rawAllocation || typeof rawAllocation !== "object" || Array.isArray(rawAllocation)) {
    return getDefaultAllocation(level || 1);
  }
  const raw = {};
  let total = 0;
  for (let tier = 1; tier <= maxTier; tier++) {
    const value = Number(rawAllocation[String(tier)] ?? rawAllocation[`t${tier}`] ?? rawAllocation[`tier${tier}`]);
    raw[String(tier)] = Number.isFinite(value) && value > 0 ? value : 0;
    total += raw[String(tier)];
  }
  if (total <= 0) return getDefaultAllocation(level || 1);
  const multiplier = total <= 1.001 ? 100 : 100 / total;
  const normalized = {};
  let assigned = 0;
  for (let tier = 1; tier <= maxTier; tier++) {
    const pct = tier === maxTier ? Math.max(0, 100 - assigned) : Math.round(raw[String(tier)] * multiplier * 100) / 100;
    normalized[String(tier)] = pct;
    assigned += pct;
  }
  return normalized;
}

export function getVillageLastCollectedMs(value, now = Date.now()) {
  const timestampMs = value?.toMillis?.();
  const parsed = Number.isFinite(timestampMs) ? timestampMs
    : value instanceof Date ? value.getTime()
    : typeof value === "number" ? value
    : typeof value === "string" ? Date.parse(value)
    : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, now) : now - 3600000;
}

// ── 計算建築駐紮貓咪的生產加乘倍率 ────────────────────────
// 基礎產能加乘 = 1 + (貓咪等級 × 2%) + (羈絆等級 × 0.5%)
export function getWorkerCatMultiplier(catData) {
  if (!catData) return 1.0;
  const catLevel = catLevelFromXP(catData.catXP || 0);
  const bondLv = catData.bond ? Math.min(50, Math.floor(catData.bond / 10)) : 0;
  return 1.0 + (catLevel * 0.02) + (bondLv * 0.005);
}

// ── 計算待採集資源（前端預覽用）───────────────────────────
export function calcPendingResources(village, opts = {}) {
  const now = Date.now();
  const lastMs = getVillageLastCollectedMs(village?.lastCollectedAt, now);
  const hours = Math.min((now - lastMs) / 3600000, MAX_COLLECT_HOURS);
  const buildings = village?.buildings || {};
  const allocations = village?.allocations || {};
  const workers = village?.workers || {};
  const myCats = opts.myCats || {};
  const catDexMult = opts.catDexMult ?? CATDEX_PRODUCTION_MULT;
  const pending = {};

  for (const id of BUILDING_LIST) {
    if (!isBuildingUnlocked(id, buildings)) continue;

    const lv      = buildings[id] || 1;
    const baseRate= getProductionRate(id, lv);
    const res     = BUILDINGS[id].resource;
    const maxTier = getBuildingStage(lv);

    // 檢查是否有貓咪駐紮工作
    const workerCatId = workers[id];
    const workerCatData = workerCatId ? myCats[workerCatId] : null;
    const workerMult = getWorkerCatMultiplier(workerCatData);

    const rate = baseRate * workerMult;

    if (!TIERED_RESOURCES.has(res)) {
      // 非分層資源（箭露、扭蛋代幣）：直接累積速率 × 小時，保留小數
      pending[res] = (pending[res] || 0) + rate * hours * catDexMult;
    } else {
      // 分層資源：產能池 = rate × stageMult × hours × 圖鑑加乘，按分配比例拆分
      const stageMult = getStageMultiplier(lv);
      const pool      = rate * stageMult * hours * catDexMult;
      const alloc     = normalizeBuildingAllocation(lv, allocations[id]);

      for (let tier = 1; tier <= maxTier; tier++) {
        const pct    = alloc[String(tier)] || 0;
        if (pct <= 0) continue;
        const resKey = getResourceKey(res, tier);
        pending[resKey] = (pending[resKey] || 0) + pool * (pct / 100);
      }
    }
  }
  return { pending, hours };
}

export function canUpgrade(buildingId, buildings, resources) {
  const currentLevel = buildings?.[buildingId] || 1;
  if (currentLevel >= 20) return { ok: false, reason: '已達最高等級' };

  const req = getUpgradeRequirements(buildingId, currentLevel + 1);
  if (!req) return { ok: false, reason: '無法升級' };

  if ((resources?.arrowdew || 0) < req.arrowdew) {
    return { ok: false, reason: `箭露不足（需 ${req.arrowdew.toLocaleString()}）` };
  }
  for (const mat of req.materials) {
    const resKey = getResourceKey(mat.resource, mat.tier);
    if ((resources?.[resKey] || 0) < mat.count) {
      return { ok: false, reason: `${RESOURCE_NAMES[mat.resource] || mat.resource} T${mat.tier} 不足` };
    }
  }
  return { ok: true };
}

export const DEFAULT_VILLAGE = {
  buildings: { mine:1, farm:1, harbor:1, hunting:1, market:1, warehouse:1, alchemy:1, gacha:1, archery:1 },
  resources: { arrowdew:0, gachaToken:0 },
  allocations: {},
  lastCollectedAt: null,
};
