import { rollInflictForArrows } from "./monsterStatus";

describe("monsterStatus Firestore serialization", () => {
  test("six X duplicate non-bleed procs never emit undefined fields", () => {
    const out = rollInflictForArrows({
      arrows: ["X", "X", "X", "X", "X", "X"],
      inflict: { poison: { chancePct: 100, strength: 5, duration: 3, uncapped: true } },
      rand: () => 0,
    });

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("poison");
    expect(out[0]).not.toHaveProperty("stacks");
    expect(Object.values(out[0])).not.toContain(undefined);
  });

  test("bleed still accumulates stacks on repeated X procs", () => {
    const out = rollInflictForArrows({
      arrows: ["X", "X", "X"],
      inflict: { bleed: { chancePct: 100, strength: 10, duration: 3, uncapped: true } },
      rand: () => 0,
    });

    expect(out).toHaveLength(1);
    expect(out[0].stacks).toBe(3);
    expect(Object.values(out[0])).not.toContain(undefined);
  });
});
