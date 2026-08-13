import {
  FREE_HUNT_FAMILIES,
  FREE_HUNT_TIERS,
  FREE_HUNT_MONSTERS,
  getFreeHuntMonsters,
  getFreeHuntMonsterById,
} from "./freeHuntCatalog";

describe("free hunt catalog", () => {
  test("contains seven families and T1-T6", () => {
    expect(FREE_HUNT_FAMILIES).toEqual([
      "ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure",
    ]);
    expect(FREE_HUNT_TIERS).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("contains exactly 126 normal encounters", () => {
    expect(FREE_HUNT_MONSTERS).toHaveLength(126);
    expect(FREE_HUNT_MONSTERS.every(monster => monster.encounter === "normal")).toBe(true);
  });

  test("each family and tier exposes exactly three selectable monsters", () => {
    for (const family of FREE_HUNT_FAMILIES) {
      for (const tierIndex of FREE_HUNT_TIERS) {
        expect(getFreeHuntMonsters(family, tierIndex)).toHaveLength(3);
      }
    }
  });

  test("T5 normal monsters remain selectable even though tier string is boss", () => {
    const t5 = FREE_HUNT_MONSTERS.filter(monster => monster.tierIndex === 5);
    expect(t5.length).toBeGreaterThan(0);
    expect(t5.every(monster => monster.tier === "boss" && monster.encounter === "normal")).toBe(true);
    expect(getFreeHuntMonsterById(t5[0].id)?.id).toBe(t5[0].id);
  });

  test("miniBoss and boss ids are rejected", () => {
    expect(getFreeHuntMonsterById("ghost_king_small_1")).toBeNull();
    expect(getFreeHuntMonsterById("ghost_king_big_1")).toBeNull();
  });
});
