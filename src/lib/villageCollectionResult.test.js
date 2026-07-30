import { buildVillageCollectionResult } from "./villageCollectionResult";

describe("cat village collection result presentation", () => {
  test("groups, labels and sorts a crowded collection payload", () => {
    const result = buildVillageCollectionResult({
      ore_t3:4, fish_t1:12, fur_t2:3, arrowdew:8, gachaCoins:1, meat_t2:6,
    });
    expect(result.totalKinds).toBe(6);
    expect(result.sections.map(section => section.id)).toEqual(["raw", "special"]);
    expect(result.sections[0].items.map(item => item.key)).toEqual([
      "fish_t1", "fur_t2", "meat_t2", "ore_t3",
    ]);
    expect(result.sections.flatMap(section => section.items).every(item =>
      item.name && item.amount > 0 && item.art && item.groupLabel
    )).toBe(true);
  });

  test("drops zero and invalid values instead of showing empty reward cards", () => {
    const result = buildVillageCollectionResult({ ore_t1:0, fish_t1:-2, arrowdew:"3" });
    expect(result.totalKinds).toBe(1);
    expect(result.sections[0].items[0]).toMatchObject({ key:"arrowdew", amount:3 });
  });
});
