import { LOOT_BY_DANGER } from "../data/guildLootTable";

export function simulateMissionBalance({
  danger = 1,
  mode = "exploration",
  vit = 0,
  arrowsPerRound = 3,
  accuracy = 0.65,
} = {}) {
  const safeDanger = Math.max(1, Math.min(6, Math.floor(Number(danger) || 1)));
  const save = Math.min(0.5, Math.max(0, Number(vit) || 0) * 0.01);
  const arrowScale = Number(arrowsPerRound) === 6 ? 2 : 1;
  const accuracyFactor = Math.max(0.45, Math.min(1, Number(accuracy) || 0.65));
  const combatRounds = Math.max(1, Math.ceil((safeDanger + 1) * (1.15 - accuracyFactor * 0.5) / arrowScale));
  const movementSteps = mode === "exploration" ? safeDanger * 2 : 0;
  const defenseRounds = mode === "defense" ? Math.max(6, safeDanger + 5) : 0;
  const activeRounds = mode === "defense" ? defenseRounds : combatRounds * (mode === "assault" ? safeDanger + 1 : 1);
  const perResource = Math.round((
    activeRounds * arrowScale + movementSteps * 0.25
  ) * (1 - save) * 100) / 100;
  const supplyCoinCost = Math.round(perResource * 2 * 20);
  const rewardCoins = LOOT_BY_DANGER[safeDanger]?.coinBase || 0;
  return {
    danger: safeDanger,
    mode,
    vit,
    arrowsPerRound,
    accuracy,
    combatRounds: activeRounds,
    movementSteps,
    supplyPerResource: perResource,
    supplyCoinCost,
    rewardCoins,
    netBaseCoins: rewardCoins - supplyCoinCost,
  };
}

export function simulationMatrix() {
  const rows = [];
  for (const mode of ["exploration", "assault", "defense"]) {
    for (const danger of [1, 3, 6]) {
      for (const vit of [0, 25, 50]) {
        for (const arrowsPerRound of [3, 6]) {
          rows.push(simulateMissionBalance({ mode, danger, vit, arrowsPerRound }));
        }
      }
    }
  }
  return rows;
}
