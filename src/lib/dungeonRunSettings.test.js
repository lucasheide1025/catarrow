import {
  DEFAULT_DUNGEON_ARROWS,
  DEFAULT_DUNGEON_TARGET,
  normalizeDungeonRunSettings,
} from "./dungeonRunSettings";

describe("normalizeDungeonRunSettings", () => {
  test.each([
    [3, "full_110"],
    [6, "half_610"],
    [3, "field_16"],
  ])("preserves valid reconnect settings: %i / %s", (arrowsPerRound, targetFmt) => {
    expect(normalizeDungeonRunSettings({ arrowsPerRound, targetFmt })).toEqual({
      arrowsPerRound,
      targetFmt,
    });
  });

  test("uses safe defaults only when persisted settings are missing", () => {
    expect(normalizeDungeonRunSettings({})).toEqual({
      arrowsPerRound: DEFAULT_DUNGEON_ARROWS,
      targetFmt: DEFAULT_DUNGEON_TARGET,
    });
  });

  test("rejects invalid persisted settings", () => {
    expect(normalizeDungeonRunSettings({ arrowsPerRound: 5, targetFmt: "unknown" })).toEqual({
      arrowsPerRound: DEFAULT_DUNGEON_ARROWS,
      targetFmt: DEFAULT_DUNGEON_TARGET,
    });
  });
});
