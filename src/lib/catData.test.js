import {
  CAT_EQUIP_GRADE_NAMES,
  CAT_EQUIP_SLOTS,
  calcForgeCost,
} from "./catData";

describe("cat equipment potion material", () => {
  test.each(CAT_EQUIP_GRADE_NAMES.slice(0, 5).map((grade, index) => [
    grade,
    index + 1,
  ]))("%s equipment consumes tier T%s catnip potion", (grade, tier) => {
    const cost = calcForgeCost("potion", grade, 0);

    expect(cost).toHaveProperty(`potion_t${tier}`);
    expect(cost).not.toHaveProperty("potion");
  });

  test("uses the canonical catnip potion label", () => {
    expect(CAT_EQUIP_SLOTS.find(slot => slot.id === "potion")?.label)
      .toBe("貓薄荷藥水");
  });

  test("grade promotion consumes the same tiered catnip potion key", () => {
    expect(calcForgeCost("potion", "精英", 9)).toEqual({
      potion_t3: 235,
      fur_t3: 250,
    });
  });
});
