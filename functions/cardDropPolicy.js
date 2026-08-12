"use strict";

const MODES = new Set(["solo", "party", "guild", "dungeon"]);

function resolveCardDropChance({ mode, encounter = "normal", baseChance = 0 }) {
  if (!MODES.has(mode)) throw new Error("invalid_card_drop_mode");
  if (mode === "dungeon") {
    if (["miniBoss", "boss"].includes(encounter)) return 0.4;
    return Math.min(0.1, Math.max(0, Number(baseChance) || 0));
  }
  const base = Math.max(0, Number(baseChance) || 0);
  return Math.min(0.5, Math.round((mode === "party" ? base * 1.5 : base) * 10000) / 10000);
}

module.exports = { resolveCardDropChance };
