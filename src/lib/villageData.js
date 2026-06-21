// src/lib/villageData.js

export const BUILDING_LIST = ['mine','farm','harbor','hunting','market','warehouse','alchemy','gacha','archery'];

export const BUILDINGS = {
  mine:      { id:'mine',      name:'礦山',      emoji:'⛏️',  resource:'ore',       resourceName:'礦物',       layer:0 },
  farm:      { id:'farm',      name:'農地',      emoji:'🌿',  resource:'melon',     resourceName:'瓜瓜',       layer:0 },
  harbor:    { id:'harbor',    name:'海港',      emoji:'⚓',  resource:'fish',      resourceName:'鮮魚',       layer:1 },
  hunting:   { id:'hunting',   name:'獵場',      emoji:'🏕️',  resource:'meat',      resourceName:'動物肉',     layer:1 },
  market:    { id:'market',    name:'貓貓市集',  emoji:'🛒',  resource:'driedfish', resourceName:'小魚乾',     layer:1 },
  warehouse: { id:'warehouse', name:'露天倉庫',  emoji:'📦',  resource:'can',       resourceName:'貓罐頭',     layer:2 },
  alchemy:   { id:'alchemy',   name:'煉金室',    emoji:'⚗️',  resource:'potion',    resourceName:'貓薄荷藥水', layer:2 },
  gacha:     { id:'gacha',     name:'扭蛋亭',    emoji:'🎰',  resource:'fur',       resourceName:'貓毛',       layer:3 },
  archery:   { id:'archery',   name:'練箭場',    emoji:'🏹',  resource:'archer',    resourceName:'貓貓射手',   layer:3 },
};

export const RESOURCE_NAMES = {
  arrowdew: '箭露', ore:'礦物', melon:'瓜瓜', fish:'鮮魚',
  meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭',
  potion:'貓薄荷藥水', fur:'貓毛', archer:'貓貓射手', mission:'任務材料',
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

export function getUpgradeRequirements(buildingId, targetLevel) {
  if (targetLevel > 20) return null;
  const arrowdew = ARROWDEW_COSTS[targetLevel] || 0;
  const key = getMatKey(targetLevel);
  if (!key) return { arrowdew, materials: [] };

  const m = MAT[buildingId]?.[key];
  if (!m) return { arrowdew, materials: [] };

  const idx = (targetLevel - 1) % 4; // 0,1,2,3 within each group
  const mainCount = [2, 3, 4, 5][idx];
  const subCount  = [0, 1, 2, 3][idx];

  const materials = [];
  if (m[0]) materials.push({ resource: m[0], tier: m[1], count: mainCount });
  if (m[2] && subCount > 0) materials.push({ resource: m[2], tier: m[3], count: subCount });
  if (m[4]) { // mission
    const mc = [1, 2, 2, 3][idx];
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
  archery:8, gacha:5, warehouse:4, market:3,
  mine:2.5, farm:2.5, harbor:2.5, hunting:2.5, alchemy:3,
};

export function getProductionRate(buildingId, level) {
  const base = BASE_PROD[buildingId] || 2;
  return Math.round(base * Math.pow(1.15, level - 1) * 10) / 10;
}

export const MAX_COLLECT_HOURS = 8;

export function calcPendingResources(village) {
  const now = Date.now();
  const lastMs = village?.lastCollectedAt?.toMillis?.() || (now - 3600000);
  const hours = Math.min((now - lastMs) / 3600000, MAX_COLLECT_HOURS);
  const buildings = village?.buildings || {};
  const pending = {};
  for (const id of BUILDING_LIST) {
    if (!isBuildingUnlocked(id, buildings)) continue; // 未解鎖不產出
    const lv = buildings[id] || 1;
    const rate = getProductionRate(id, lv);
    const res = BUILDINGS[id].resource;
    pending[res] = (pending[res] || 0) + Math.floor(rate * hours);
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
    if ((resources?.[mat.resource] || 0) < mat.count) {
      return { ok: false, reason: `${RESOURCE_NAMES[mat.resource] || mat.resource} 不足` };
    }
  }
  return { ok: true };
}

export const DEFAULT_VILLAGE = {
  buildings: { mine:1, farm:1, harbor:1, hunting:1, market:1, warehouse:1, alchemy:1, gacha:1, archery:1 },
  resources: { arrowdew:0, ore:0, melon:0, fish:0, meat:0, driedfish:0, can:0, potion:0, fur:0, archer:0 },
  lastCollectedAt: null,
};
