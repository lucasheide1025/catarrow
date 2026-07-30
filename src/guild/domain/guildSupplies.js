import { normalizeGuildProfile } from "./guildRewards";

export const EXPEDITION_SUPPLY_LOAD = Object.freeze({ food: 6, water: 6 });
export const EXPEDITION_SUPPLY_MIN = 1;

// 絕對上限只是防呆（避免存檔被塞進離譜數字）。**真正的上限是負重與庫存**，
// 由 supplyLoadCap 依「容量 − 裝備重量」算出來——VIT 練起來就背得更多，
// 這才是 VIT 該有的回饋。舊值硬鎖 10，把 VIT 的加成擋在門外。
export const EXPEDITION_SUPPLY_MAX = 40;

// 每一種補給帶得動的上限：剩下的負重平分給食物與水。
export function supplyLoadCap({ capacity = 0, gearWeight = 0, supplyWeight = 1 } = {}) {
  const free = Math.max(0, (Number(capacity) || 0) - (Number(gearWeight) || 0));
  const perKind = Math.floor(free / (Number(supplyWeight) || 1) / 2);
  return Math.max(EXPEDITION_SUPPLY_MIN, Math.min(EXPEDITION_SUPPLY_MAX, perKind));
}

// 進戰場前自動補滿：背得動多少就帶多少，庫存不夠就帶庫存有的（不足的部分由 UI 提醒）。
// 為什麼預設補滿而不是固定 6 份：補給不是有趣的抉擇，每趟手動點高只是儀式。
export function autoFillSupplyLoad({ profile, capacity, gearWeight, supplyWeight } = {}) {
  const cap = supplyLoadCap({ capacity, gearWeight, supplyWeight });
  const stock = normalizeGuildProfile(profile).supplyStock;
  const fill = have => Math.max(EXPEDITION_SUPPLY_MIN, Math.min(cap, Math.floor(Number(have) || 0)));
  return { food: fill(stock.food), water: fill(stock.water) };
}

export function normalizeExpeditionSupplyLoad(load = EXPEDITION_SUPPLY_LOAD) {
  const normalize = value => Math.max(
    EXPEDITION_SUPPLY_MIN,
    Math.min(EXPEDITION_SUPPLY_MAX, Math.floor(Number(value) || EXPEDITION_SUPPLY_MIN)),
  );
  return { food: normalize(load.food), water: normalize(load.water) };
}

export function supplyShortage(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const selected = normalizeExpeditionSupplyLoad(load);
  const stock = normalizeGuildProfile(profile).supplyStock;
  return {
    food: Math.max(0, selected.food - stock.food),
    water: Math.max(0, selected.water - stock.water),
  };
}

export function hasExpeditionSupplies(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const missing = supplyShortage(profile, load);
  return missing.food === 0 && missing.water === 0;
}

export function consumeExpeditionSupplies(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const p = normalizeGuildProfile(profile);
  const selected = normalizeExpeditionSupplyLoad(load);
  const missing = supplyShortage(p, selected);
  if (missing.food || missing.water) {
    const parts = [
      missing.food ? `食物 ${missing.food}` : "",
      missing.water ? `飲水 ${missing.water}` : "",
    ].filter(Boolean);
    return { ok: false, reason: `補給不足，還缺${parts.join("、")}`, profile: p, supplies: null, missing };
  }
  return {
    ok: true,
    profile: {
      ...p,
      supplyStock: {
        food: p.supplyStock.food - selected.food,
        water: p.supplyStock.water - selected.water,
      },
    },
    supplies: selected,
    missing,
  };
}

export function refundExpeditionSupplies(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const p = normalizeGuildProfile(profile);
  return {
    ...p,
    supplyStock: {
      food: p.supplyStock.food + load.food,
      water: p.supplyStock.water + load.water,
    },
  };
}
