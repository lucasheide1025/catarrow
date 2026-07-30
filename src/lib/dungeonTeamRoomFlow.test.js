import {
  getActiveTeamMemberIds,
  isTeamRoomReadyToAdvance,
  shouldAutoAdvanceTeamFunctionRoom,
} from "./dungeonTeamRoomFlow";

describe("team dungeon non-combat room flow", () => {
  const members = {
    host: { alive: true },
    teammate: { alive: true },
    fallen: { alive: false },
    left: null,
  };

  test("host confirmation alone never advances while a teammate is still reading", () => {
    expect(isTeamRoomReadyToAdvance({ members, confirms: { host: true } })).toBe(false);
  });

  test("advances after every active member confirms and ignores dead or departed members", () => {
    expect(getActiveTeamMemberIds(members)).toEqual(["host", "teammate"]);
    expect(isTeamRoomReadyToAdvance({
      members,
      confirms: { host: true, teammate: true },
    })).toBe(true);
  });

  test("事件須全員完成後才會自動前進，寶箱交由房主手動推進", () => {
    expect(shouldAutoAdvanceTeamFunctionRoom({
      roomType: "event",
      members,
      confirms: { host: true },
    })).toBe(false);
    expect(shouldAutoAdvanceTeamFunctionRoom({
      roomType: "chest",
      members,
      confirms: { host: true, teammate: true },
    })).toBe(false);
  });

  test.each(["trap", "rest", "shop"])("%s 房由房間流程結算，不因投票自動跳圖", (roomType) => {
    expect(shouldAutoAdvanceTeamFunctionRoom({
      roomType,
      members,
      confirms: { host: true, teammate: true },
    })).toBe(false);
  });
});
