import { normalizeGuildProfile } from "./guildRewards";
import { rankIndexOf } from "./guildRank";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Lv1~20 每週產量。2026-07-30 全面上調（作者要求「農田跟水的供應增加多一點」）：
// 舊表滿級每週 30 份，一趟遠征吃掉 10~20 份，等於蓋滿了也只夠跑兩趟，領地幾乎沒有回饋感。
// 新表滿級 72 份／週，低階也從 2 起跳改成 6，早期就感覺得到「蓋了有用」。
export const WEEKLY_OUTPUT = Object.freeze([0, 6, 9, 12, 15, 18, 21, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 70, 72]);
// 倉庫容量同步放大，否則產量拉高只是溢出浪費。滿級 156 → 320。
export const STORAGE_CAPACITY = Object.freeze([60, 76, 92, 108, 124, 140, 156, 172, 188, 204, 220, 232, 244, 256, 268, 280, 292, 300, 308, 314, 320]);

const COSTS = Object.freeze(Array.from({ length: 20 }, (_, i) => Math.round((30 + i * 18 + i * i * 2.2) / 5) * 5));
const DURATIONS = Object.freeze(Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  if (level <= 4) return level * DAY_MS;
  if (level <= 8) return (5 + (level - 5) * 2) * DAY_MS;
  if (level <= 12) return (14 + (level - 9) * 3) * DAY_MS;
  if (level <= 16) return (28 + (level - 13) * 4) * DAY_MS;
  if (level <= 19) return (49 + (level - 17) * 7) * DAY_MS;
  return 90 * DAY_MS;
}));

export const BUILDING_META = Object.freeze({
  warehouse: { name: "補給倉庫", icon: "🏚️", maxLevel: 20 },
  farm: { name: "農地", icon: "🌾", maxLevel: 20 },
  waterStation: { name: "供水站", icon: "🚰", maxLevel: 20 },
});

// 見習1~4、銅5~8、銀9~12、金13~16、白金17~19、傳說20。
export const maxBuildingLevelForRank = rankId => [4, 8, 12, 16, 19, 20][rankIndexOf(rankId)] || 4;
export const buildingVisualStage = level => Math.max(1, Math.min(5, Math.ceil(Math.max(1, level) / 4)));
export const buildingUpgradeCost = level => COSTS[Math.max(0, Math.min(19, level))];
export const buildingConstructionMs = level => DURATIONS[Math.max(0, Math.min(19, level))];
export const supplyCapacity = profile => STORAGE_CAPACITY[normalizeGuildProfile(profile).buildings.warehouse];
export const weeklyProduction = (profile, kind) => {
  const p = normalizeGuildProfile(profile);
  return WEEKLY_OUTPUT[kind === "food" ? p.buildings.farm : p.buildings.waterStation];
};

export function accrueBuildingProduction(profile, now = Date.now()) {
  const p = normalizeGuildProfile(profile);
  const lastAt = p.production.lastAt || now;
  const elapsed = Math.max(0, now - lastAt);
  return {
    ...p,
    production: {
      lastAt: now,
      food: Math.min(supplyCapacity(p), p.production.food + elapsed / WEEK_MS * weeklyProduction(p, "food")),
      water: Math.min(supplyCapacity(p), p.production.water + elapsed / WEEK_MS * weeklyProduction(p, "water")),
    },
  };
}

export function claimBuildingProduction(profile, now = Date.now()) {
  const p = accrueBuildingProduction(profile, now);
  const cap = supplyCapacity(p);
  const food = Math.min(Math.floor(p.production.food), Math.max(0, cap - p.supplyStock.food));
  const water = Math.min(Math.floor(p.production.water), Math.max(0, cap - p.supplyStock.water));
  if (!food && !water) return { ok: false, reason: "目前沒有可收成的補給", profile: p, food: 0, water: 0 };
  return {
    ok: true, food, water,
    profile: {
      ...p,
      supplyStock: { food: p.supplyStock.food + food, water: p.supplyStock.water + water },
      production: { ...p.production, food: p.production.food - food, water: p.production.water - water },
    },
  };
}

export function finishConstruction(profile, now = Date.now()) {
  const p = accrueBuildingProduction(profile, now);
  const job = p.construction;
  if (!job) return { ok: false, reason: "目前沒有施工", profile: p };
  if (now < job.finishesAt) return { ok: false, reason: "施工尚未完成", profile: p, remainingMs: job.finishesAt - now };
  return {
    ok: true,
    buildingId: job.buildingId,
    level: job.targetLevel,
    profile: {
      ...p,
      buildings: { ...p.buildings, [job.buildingId]: job.targetLevel },
      construction: null,
    },
  };
}

export function startConstruction(profile, buildingId, now = Date.now()) {
  let p = normalizeGuildProfile(profile);
  const finished = finishConstruction(p, now);
  if (finished.ok) p = finished.profile;
  if (p.construction) return { ok: false, reason: "同一時間只能施工一棟建築", profile: p };
  const meta = BUILDING_META[buildingId];
  if (!meta) return { ok: false, reason: "未知建築", profile: p };
  const level = p.buildings[buildingId];
  if (level >= meta.maxLevel) return { ok: false, reason: "已達最高等級", profile: p };
  const allowed = maxBuildingLevelForRank(p.rankId);
  if (level + 1 > allowed) return { ok: false, reason: `目前階級最多建設至 Lv${allowed}，請先完成晉階試煉`, profile: p };
  const cost = buildingUpgradeCost(level);
  if (p.catCoins < cost) return { ok: false, reason: `CAT幣不足（需 ${cost}）`, profile: p };
  const durationMs = buildingConstructionMs(level);
  return {
    ok: true, cost, durationMs,
    profile: {
      ...accrueBuildingProduction(p, now),
      catCoins: p.catCoins - cost,
      construction: { buildingId, targetLevel: level + 1, startedAt: now, finishesAt: now + durationMs },
    },
  };
}
