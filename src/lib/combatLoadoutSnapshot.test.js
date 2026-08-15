import { buildCombatLoadoutSnapshot, resolveSnapshotFamilyBonus } from "./combatLoadoutSnapshot";

describe("combat loadout snapshot", () => {
  const collection = {
    cards:{ workplace_atk:{ family:"workplace", tier:"rare", stars:2 } },
    equipped:["workplace_atk"],
  };

  test("family damage is scoped to the prey family", () => {
    const snapshot=buildCombatLoadoutSnapshot({collection,equipSpec:null});
    expect(resolveSnapshotFamilyBonus(snapshot,"treasure").damageBonusPct).toBe(7);
    expect(resolveSnapshotFamilyBonus(snapshot,"exam").damageBonusPct).toBe(0);
  });

  test("individual specialization and resistance travel with the player", () => {
    const snapshot=buildCombatLoadoutSnapshot({
      collection,
      equipSpec:{armor:{trackId:"immunity",level:10},accessory:{trackId:"support",level:10}},
    });
    expect(snapshot.combatMods.statusStrengthReductionPct).toBe(30);
    expect(snapshot.combatMods.statusDurationReduction).toBe(2);
    expect(snapshot.combatMods.companionAttackPct).toBe(30);
  });
});
