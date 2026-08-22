import { resolveCombatResumePage } from "./combatResumeRoute";

describe("combat resume route priority", () => {
  test("an active dungeon page wins over a stale multi-hunt session after refresh", () => {
    expect(resolveCombatResumePage({
      storedPage:"dungeon",
      hasMultiMonsterPartySession:true,
      hasHuntResume:true,
      fallbackPage:"home",
    })).toBe("dungeon");
  });

  test("a real multi-hunt session still restores when the player was not in dungeon", () => {
    expect(resolveCombatResumePage({
      storedPage:"home",
      hasMultiMonsterPartySession:true,
      hasHuntResume:true,
      fallbackPage:"home",
    })).toBe("multi-monster-party");
  });

  test("hunt resume remains ahead of an ordinary stored page", () => {
    expect(resolveCombatResumePage({
      storedPage:"profile",
      hasMultiMonsterPartySession:false,
      hasHuntResume:true,
      fallbackPage:"home",
    })).toBe("hunt");
  });
});
