import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";
import { FREE_HUNT_QUOTA_MODE, freeHuntQuotaLabel } from "./freeHuntQuota";

export async function consumeFreeHuntAttempt({ memberId, mode, battleId, roomId = null }) {
  if (!memberId || !battleId) throw new Error("invalid_free_hunt_identity");
  const normalizedMode = mode === FREE_HUNT_QUOTA_MODE.MULTI ? FREE_HUNT_QUOTA_MODE.MULTI : FREE_HUNT_QUOTA_MODE.SINGLE;
  const callable = httpsCallable(getFunctions(app, "asia-east1"), "consumeFreeHuntAttempt");
  const response = await callable({ memberId, mode:normalizedMode, battleId, ...(roomId ? { roomId } : {}) });
  return response.data;
}

export function freeHuntQuotaErrorMessage(error, mode) {
  const text = String(error?.message || error?.code || "");
  if (text.includes("free_hunt_limit_reached") || text.includes("resource-exhausted")) {
    return `今日${freeHuntQuotaLabel(mode)}次數已用完（5/5）`;
  }
  if (text.includes("free_hunt_host_only")) return "只有房主會扣除自由狩獵次數並可開始戰鬥";
  return error?.message || "自由狩獵次數確認失敗，請重試";
}
