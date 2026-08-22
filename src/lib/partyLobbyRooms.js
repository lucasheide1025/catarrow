export function isMultiHuntRoom(room) {
  return room?.type === "battle" && (room?.multiMonster === true || room?.huntType === "multi");
}

export function filterPartyLobbyRooms(openRooms, { huntMonsterId = null, tab = "create", huntType = "single" } = {}) {
  const rooms = Array.isArray(openRooms) ? openRooms : [];
  if (huntType === "multi") return rooms.filter(isMultiHuntRoom);
  if (!huntMonsterId) return rooms;

  if (tab === "join") {
    return rooms.filter(room => room?.type === "battle" && !isMultiHuntRoom(room) && !!(room?.huntMonsterId || room?.monsterId));
  }

  return rooms.filter(room =>
    room?.type === "battle" && !isMultiHuntRoom(room) && (room?.monsterId || room?.huntMonsterId) === huntMonsterId
  );
}
