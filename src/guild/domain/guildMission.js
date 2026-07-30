export const GUILD_MISSION_VERSION = 3;
export const GUILD_MISSION_MODES = Object.freeze(["exploration", "assault", "defense"]);

export function normalizeMissionMode(mode) {
  return GUILD_MISSION_MODES.includes(mode) ? mode : "assault";
}

export function normalizeSavedMission(saved) {
  if (!saved) return null;
  const mode = normalizeMissionMode(saved.mode || saved.contract?.mode);
  return {
    ...saved,
    version: GUILD_MISSION_VERSION,
    mode,
    contract: saved.contract ? { ...saved.contract, mode } : saved.contract,
  };
}

export function createMissionEnvelope({ contract, combat = null, supplies = null, modeState = null }) {
  const mode = normalizeMissionMode(contract?.mode);
  return {
    version: GUILD_MISSION_VERSION,
    mode,
    contract: { ...contract, mode },
    combat,
    supplies: supplies || combat?.supplies || { food: 0, water: 0 },
    modeState,
    status: combat?.status || "preparing",
    log: [],
  };
}
