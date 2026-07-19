import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";
import { normalizeMonsterReward } from "./monsterRewardLedger";

// Transitional client transaction: atomic and idempotent, but not yet a
// trusted server reward calculator. Callers must pass rewards produced by the
// shared resolver. A callable/server boundary is still required before launch.
const PENDING_REWARD_KEY = "catarrow.pending-monster-rewards.v1";

function readPendingRewards() {
  if (typeof localStorage === "undefined") return [];
  try { const value=JSON.parse(localStorage.getItem(PENDING_REWARD_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}

function writePendingRewards(items) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(PENDING_REWARD_KEY, JSON.stringify(items.slice(-40))); } catch { /* storage unavailable */ }
}

async function executeMonsterBattleRewardClaim(input) {
  const reward = normalizeMonsterReward(input);
  const monsterId = input.monsterId || input.metadata?.monsterId;
  if (!monsterId) throw new Error("invalid_monster_id");
  const callable = httpsCallable(getFunctions(app, "asia-east1"), "claimMonsterBattleReward");
  const response = await callable({
    battleId:reward.battleId,
    memberId:reward.memberId,
    rewardType:reward.rewardType,
    monsterId,
    mode:input.mode || input.metadata?.mode,
    challengeLevel:input.challengeLevel || input.metadata?.challengeLevel,
  });
  return response.data;
}

export async function flushPendingMonsterBattleRewards(memberId) {
  const pending = readPendingRewards();
  const remaining = [];
  for (const item of pending) {
    if (memberId && item.memberId !== memberId) { remaining.push(item); continue; }
    try { await executeMonsterBattleRewardClaim(item); } catch { remaining.push(item); }
  }
  writePendingRewards(remaining);
  return { remaining:remaining.length };
}

export async function claimMonsterBattleReward(input) {
  try {
    const result = await executeMonsterBattleRewardClaim(input);
    const claimId = normalizeMonsterReward(input).claimId;
    writePendingRewards(readPendingRewards().filter(item => normalizeMonsterReward(item).claimId !== claimId));
    return result;
  } catch (error) {
    const claimId = normalizeMonsterReward(input).claimId;
    const pending = readPendingRewards().filter(item => normalizeMonsterReward(item).claimId !== claimId);
    pending.push(input);
    writePendingRewards(pending);
    throw error;
  }
}
