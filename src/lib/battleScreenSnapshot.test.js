import { createBattleScreenSnapshot, restoreBattleScreenSnapshot } from "./battleScreenSnapshot";

describe("battle screen snapshot", () => {
  test("preserves hp, round, statuses, arrows and resolved ability keys", () => {
    const snapshot = createBattleScreenSnapshot({
      battle: { phase: "scoring", round: 3, playerHp: 80, monsterHp: 40, arrows: [{ score: "9" }], activeStatuses: [{ id: "poison", expiresAfterRound: 3 }], unlockedParts: new Set(["heart"]) },
      resolvedAbilityKeys: ["b:2:m:s", "b:2:m:s"],
      shootingEnds: [[{ label: "9" }]],
    });
    const restored = restoreBattleScreenSnapshot(snapshot);
    expect(restored.battle).toMatchObject({ phase: "scoring", round: 3, playerHp: 80, monsterHp: 40 });
    expect([...restored.battle.unlockedParts]).toEqual(["heart"]);
    expect(restored.resolvedAbilityKeys).toEqual(["b:2:m:s"]);
  });

  test("normalizes terminal overlays to a playable phase", () => {
    const restored = restoreBattleScreenSnapshot({ battle: { phase: "intro", round: 1 } });
    expect(restored.battle.phase).toBe("playing");
  });

  test("returns an interrupted processing animation to scoring instead of replaying damage", () => {
    const restored = restoreBattleScreenSnapshot({
      battle: { phase: "processing", round: 2, arrows: [{ score: "9" }] },
    });
    expect(restored.battle.phase).toBe("scoring");
  });

  test("rejects corrupt snapshots", () => {
    expect(() => restoreBattleScreenSnapshot({ battle: { round: 0 } })).toThrow("invalid_battle_screen_snapshot");
  });
});
