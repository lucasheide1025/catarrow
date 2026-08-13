import { filterPartyLobbyRooms } from "./partyLobbyRooms";

describe("filterPartyLobbyRooms", () => {
  const rooms = [
    { id:"hunt-a", type:"battle", huntMonsterId:"ghost-t1", monsterId:"ghost-t1" },
    { id:"hunt-b", type:"battle", huntMonsterId:"insect-t2", monsterId:"insect-t2" },
    { id:"legacy-hunt", type:"battle", monsterId:"mountain-t3" },
    { id:"generic", type:"battle", huntMonsterId:null, monsterId:null },
  ];

  test("hunt join shows hunt rooms even when the selected monster differs", () => {
    expect(filterPartyLobbyRooms(rooms, { huntMonsterId:"ghost-t1", tab:"join" }).map(r => r.id))
      .toEqual(["hunt-a", "hunt-b", "legacy-hunt"]);
  });

  test("hunt join excludes generic battle rooms without a hunt target", () => {
    expect(filterPartyLobbyRooms(rooms, { huntMonsterId:"ghost-t1", tab:"join" }).some(r => r.id === "generic"))
      .toBe(false);
  });

  test("hunt create context remains constrained to the selected monster", () => {
    expect(filterPartyLobbyRooms(rooms, { huntMonsterId:"ghost-t1", tab:"create" }).map(r => r.id))
      .toEqual(["hunt-a"]);
  });

  test("generic lobby preserves all subscribed rooms", () => {
    expect(filterPartyLobbyRooms(rooms, { huntMonsterId:null, tab:"join" })).toEqual(rooms);
  });
});
