import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";

const functions = getFunctions(app, "asia-east1");

export async function createDungeonBossRewardClaim({ battleId, memberId, monsterId }) {
  if (!battleId || !memberId || !monsterId) throw new Error("invalid_dungeon_reward_identity");
  const callable = httpsCallable(functions, "createDungeonBossRewardClaim");
  const response = await callable({ battleId, memberId, monsterId });
  return response.data;
}

export async function claimDungeonBossChoices({ claimId, memberId, selectedOptionIds }) {
  if (!claimId || !memberId || !Array.isArray(selectedOptionIds)) throw new Error("invalid_dungeon_choice_identity");
  const callable = httpsCallable(functions, "claimDungeonBossChoices");
  const response = await callable({ claimId, memberId, selectedOptionIds });
  return response.data;
}
