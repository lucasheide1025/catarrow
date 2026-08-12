export function resolveTeamHostDice(room, legacyMemberDice = null) {
  if (Number.isFinite(room?.hostDiceLeft)) return Math.max(0, Math.floor(room.hostDiceLeft));
  if (Number.isFinite(legacyMemberDice)) return Math.max(0, Math.floor(legacyMemberDice));
  return null;
}

export function teamRoomStepPassed(room, seq = room?.seq || 0) {
  const n = Math.max(0, Math.floor(Number(seq) || 0));
  if (!room || n <= 0) return true;
  if ((room.forcedSeq || 0) >= n) return true;
  const memberIds = Object.entries(room.members || {}).filter(([, member]) => member != null).map(([id]) => id);
  const forkPending = room.pendingFork?.seq === n;
  const rewardPending = room.pendingSettle?.seq === n || room.pendingEvent?.seq === n;
  if (!forkPending && !rewardPending) return true;
  return memberIds.every(memberId => {
    const acknowledged = (room.ackClaims?.[memberId] || 0) >= n;
    if (forkPending) return acknowledged && Boolean(room.forkVotes?.[memberId]);
    const claimed = (room.settleClaims?.[memberId] || 0) >= n || (room.eventClaims?.[memberId] || 0) >= n;
    return claimed && acknowledged;
  });
}
