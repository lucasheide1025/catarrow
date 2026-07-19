import { normalizePartyBattleSettings } from "./partyBattleSettings";

describe("party battle locked settings", () => {
  test("room settings override a reconnecting device's local preferences", () => {
    expect(normalizePartyBattleSettings({
      arrowsPerRound: 3,
      targetFormat: "field_16",
      targetInputMode: "target",
    }, {
      targetFormat: "full_110",
      targetInputMode: "button",
    })).toEqual({ arrowsPerRound: 3, targetFormat: "field_16", targetInputMode: "target" });
  });

  test("legacy rooms use safe local fallbacks without changing arrow count", () => {
    expect(normalizePartyBattleSettings({}, {
      targetFormat: "half_610",
      targetInputMode: "target",
    })).toEqual({ arrowsPerRound: 6, targetFormat: "half_610", targetInputMode: "target" });
  });
});

