import {
  SPECIALIZATION_TRACKS,
  getSpecializationAttemptChance,
  getSpecializationUpgradeCost,
  resolveSpecializationAttempt,
  validateSpecializationCatalog,
} from "./equipmentSpecializationCatalog";

describe("equipment specialization catalog", () => {
  test("defines nine valid independent tracks", () => {
    expect(SPECIALIZATION_TRACKS).toHaveLength(9);
    expect(validateSpecializationCatalog()).toEqual({ ok: true, errors: [] });
  });

  test("keeps each tier total while rotating three material demands", () => {
    const precision = getSpecializationUpgradeCost({ trackId: "precision", targetLevel: 10 });
    const armorBreak = getSpecializationUpgradeCost({ trackId: "armorBreak", targetLevel: 10 });
    expect(precision.tierMaterials[0]).toMatchObject({ tierIndex: 1, total: 200, split: [80, 70, 50] });
    expect(armorBreak.tierMaterials[0].split).toEqual([50, 80, 70]);
    expect(precision.bossMaterial).toEqual({ kind: "boss", quantity: 1 });
    expect(precision.coins).toBe(35000);
  });

  test("adds 15 percentage points per failure and guarantees fourth attempt", () => {
    expect(getSpecializationAttemptChance({ trackId: "precision", targetLevel: 1, consecutiveFailures: 0 })).toBe(0.45);
    expect(getSpecializationAttemptChance({ trackId: "precision", targetLevel: 1, consecutiveFailures: 2 })).toBe(0.75);
    expect(getSpecializationAttemptChance({ trackId: "precision", targetLevel: 1, consecutiveFailures: 3 })).toBe(1);
  });

  test("consumes costs even on failure without reducing the current level", () => {
    expect(resolveSpecializationAttempt({ trackId: "precision", targetLevel: 4, consecutiveFailures: 0, roll: 0.99 })).toEqual({
      succeeded: false,
      successRate: 0.375,
      nextLevel: 3,
      nextConsecutiveFailures: 1,
      consumed: true,
      guaranteed: false,
    });
  });
});
