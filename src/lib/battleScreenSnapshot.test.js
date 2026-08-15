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

  test("preserves living and defeated companion hp exactly", () => {
    for (const catCurrentHP of [73, 0]) {
      const snapshot = createBattleScreenSnapshot({ battle:{ phase:"playing", round:2 }, catCurrentHP });
      expect(restoreBattleScreenSnapshot(snapshot, { hasCat:true, catMaxHP:100 }).catCurrentHP).toBe(catCurrentHP);
    }
  });

  test("old snapshots default an accompanying cat to max hp rather than dead", () => {
    const restored = restoreBattleScreenSnapshot({ battle:{ phase:"playing", round:2 } }, { hasCat:true, catMaxHP:120 });
    expect(restored.catCurrentHP).toBe(120);
  });

  test("preserves redesigned cat pity and guard state",()=>{
    const catBattleState={strongSkillMisses:2,guardAtkBuff:{value:12,expiresAfterRound:3}};
    const snapshot=createBattleScreenSnapshot({battle:{phase:"playing",round:2},catBattleState});
    expect(restoreBattleScreenSnapshot(snapshot).catBattleState).toEqual(catBattleState);
  });
});
