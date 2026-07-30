import { normalizeGuildProfile } from "./guildRewards";

export const EXPEDITION_SUPPLY_LOAD = Object.freeze({ food: 6, water: 6 });
export const EXPEDITION_SUPPLY_MIN = 1;
export const EXPEDITION_SUPPLY_MAX = 10;

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
