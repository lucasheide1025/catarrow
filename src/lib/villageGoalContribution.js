export function villageGoalOperationKey(operationId) {
  return encodeURIComponent(String(operationId || "")).slice(0, 400);
}

export function isQualifyingMonsterKill(input = {}) {
  return Boolean(input.memberId && input.result === "win" && Number(input.finalMonsterHp) <= 0);
}

export function soloExplorationCompletionOperation({ memberId, mapId, journeySeed, completed } = {}) {
  if (!completed || !memberId || !mapId) return null;
  return `solo:${memberId}:${mapId}:${journeySeed || "legacy"}`;
}

export function teamExplorationCompletionOperation({ memberId, hostId, roomId, sequence, completed } = {}) {
  if (!completed || !memberId || memberId !== hostId || !roomId) return null;
  return `team:${roomId}:${Number(sequence) || 0}`;
}
