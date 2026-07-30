export function getActiveTeamMemberIds(members = {}) {
  return Object.entries(members || {})
    .filter(([, member]) => member && member.alive !== false)
    .map(([memberId]) => memberId);
}

export function isTeamRoomReadyToAdvance({ members = {}, confirms = {} } = {}) {
  const activeMemberIds = getActiveTeamMemberIds(members);
  return activeMemberIds.length > 0
    && activeMemberIds.every(memberId => confirms?.[memberId] === true);
}

// 寶箱房由房主在全員看完結果後手動推進，避免結果頁一閃即逝。
const AUTO_ADVANCE_ROOM_TYPES = new Set(["event", "general_event"]);

export function shouldAutoAdvanceTeamFunctionRoom({
  roomType,
  members,
  confirms,
} = {}) {
  return AUTO_ADVANCE_ROOM_TYPES.has(roomType)
    && isTeamRoomReadyToAdvance({ members, confirms });
}
