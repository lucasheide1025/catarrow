import { normalizeGuildProfile } from "./guildRewards";

export const EXPEDITION_SUPPLY_LOAD = Object.freeze({ food: 6, water: 6 });

export function supplyShortage(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const stock = normalizeGuildProfile(profile).supplyStock;
  return {
    food: Math.max(0, load.food - stock.food),
    water: Math.max(0, load.water - stock.water),
  };
}

export function hasExpeditionSupplies(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const missing = supplyShortage(profile, load);
  return missing.food === 0 && missing.water === 0;
}

export function consumeExpeditionSupplies(profile, load = EXPEDITION_SUPPLY_LOAD) {
  const p = normalizeGuildProfile(profile);
  const missing = supplyShortage(p, load);
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
        food: p.supplyStock.food - load.food,
        water: p.supplyStock.water - load.water,
      },
    },
    supplies: { ...load },
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
