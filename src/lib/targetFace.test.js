import {
  getTargetRings,
  normalizeTargetFormatId,
  resolveTargetHit,
} from "./targetFace";

describe("targetFace scoring", () => {
  test("122 cm full face separates X from the rest of the 10 ring", () => {
    expect(resolveTargetHit("full_110", 0.04, 0).label).toBe("X");
    expect(resolveTargetHit("full_110", 0.075, 0).label).toBe("10");
    expect(resolveTargetHit("full_110", 0.15, 0).label).toBe("9");
    expect(resolveTargetHit("full_110", 1, 0).label).toBe("1");
    expect(resolveTargetHit("full_110", 1.01, 0).label).toBe("M");
  });

  test("80 cm six-ring face uses its cropped-face proportions", () => {
    expect(getTargetRings("compound_510")).toHaveLength(6);
    expect(resolveTargetHit("compound_510", 0.07, 0).label).toBe("X");
    expect(resolveTargetHit("compound_510", 0.12, 0).label).toBe("10");
    expect(resolveTargetHit("compound_510", 1, 0).label).toBe("5");
  });

  test("40 cm cropped and field faces keep raw archery scores", () => {
    expect(resolveTargetHit("triple", 0.15, 0).label).toBe("10");
    expect(resolveTargetHit("triple", 1, 0).label).toBe("6");
    expect(resolveTargetHit("field_16", 0.1, 0).rawScore).toBe(5);
    expect(resolveTargetHit("field_16", 1, 0).rawScore).toBe(1);
  });

  test("legacy target identifiers remain readable", () => {
    expect(normalizeTargetFormatId("indoor_610")).toBe("half_610");
    expect(normalizeTargetFormatId("unknown")).toBe("full_110");
  });
});
