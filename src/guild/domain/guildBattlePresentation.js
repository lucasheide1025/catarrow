export const GUILD_VICTORY_CONFIRM_MS = 1600;

export function guildBattleFinalizeDelay(status, baseDelay = 0) {
  return Math.max(0, baseDelay) + (status === "won" ? GUILD_VICTORY_CONFIRM_MS : 0);
}

export function retargetPendingShots(shots = [], targetInstanceId) {
  return shots.map(shot => ({ ...shot, targetInstanceId }));
}
