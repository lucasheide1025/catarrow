import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";

export async function claimPartyBattleRewardV2({ roomId, battleInstanceId, memberId }) {
  const callable=httpsCallable(getFunctions(app,"asia-east1"),"claimPartyBattleRewardV2");
  return (await callable({roomId,battleInstanceId,memberId})).data;
}
