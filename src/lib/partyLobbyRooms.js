export function filterPartyLobbyRooms(openRooms, { huntMonsterId = null, tab = "create" } = {}) {
  const rooms = Array.isArray(openRooms) ? openRooms : [];
  if (!huntMonsterId) return rooms;

  if (tab === "join") {
    return rooms.filter(room => room?.type === "battle" && !!(room?.huntMonsterId || room?.monsterId));
  }

  return rooms.filter(room =>
    room?.type === "battle" && (room?.monsterId || room?.huntMonsterId) === huntMonsterId
  );
}
