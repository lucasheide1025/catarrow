import { stripGridForSync } from "./expeditionGrid";

export function isRestorableExpeditionMapState(state, floorIndex = state?.floorIndex) {
  if (!state || state.floorIndex !== floorIndex) return false;
  if (floorIndex < 2) {
    return !!state.gridFloor && !!state.playerPos;
  }
  return !!state.branchFloor
    && Number.isInteger(Number(state.branchStep))
    && Number(state.branchStep) >= 0;
}

export function getRestoredExpeditionPhase(state, floorIndex = state?.floorIndex) {
  if (!isRestorableExpeditionMapState(state, floorIndex)) return null;
  const savedPhase = state?.phase;
  if (state?.pendingRoom && ["battle", "func_room"].includes(savedPhase)) return savedPhase;
  return floorIndex < 2 ? "grid" : "branch";
}

export function stripExpeditionMapStateForSync(state) {
  if (!state?.gridFloor) return state;
  return { ...state, gridFloor: stripGridForSync(state.gridFloor) };
}
