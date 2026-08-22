import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { applyRunePillarEffects, generateMultiMonsterEncounter } from "./multiMonsterEncounter";

function validSeed() {
  const normal = EXPANSION_MONSTERS.filter(monster => monster.encounter === "normal");
  return normal.find(seed => normal.filter(monster =>
    monster.family === seed.family && Number(monster.tierIndex) === Number(seed.tierIndex)
  ).length >= 3);
}

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe("multi monster encounter", () => {
  const seed = validSeed();

  test("always uses the three normal monsters from selected family and tier", () => {
    expect(seed).toBeTruthy();
    const encounter = generateMultiMonsterEncounter(seed.family, seed.tierIndex, { pillarCount:0, rand:()=>.5 });
    expect(encounter.frontRow).toHaveLength(3);
    expect(encounter.rearRow).toHaveLength(0);
    expect(encounter.frontRow.every(monster => monster.family === seed.family && Number(monster.tierIndex) === Number(seed.tierIndex) && monster.encounter === "normal")).toBe(true);
  });

  test("front monsters roll weak normal strong independently", () => {
    const encounter = generateMultiMonsterEncounter(seed.family, seed.tierIndex, {
      pillarCount:0,
      rand:sequence([.1,.5, .5,.5, .9,.5]),
    });
    expect(encounter.frontRow.map(monster => monster.variant)).toEqual(["weak","normal","strong"]);
    expect(encounter.frontRow.map(monster => monster.variantLabel)).toEqual(["弱化","普通","強悍"]);
  });

  test("rear row supports exactly zero through two healing rune pillars", () => {
    const none = generateMultiMonsterEncounter(seed.family, seed.tierIndex, { pillarCount:0, rand:()=>.5 });
    const two = generateMultiMonsterEncounter(seed.family, seed.tierIndex, { pillarCount:2, rand:()=>.5 });
    expect(none.rearRow).toHaveLength(0);
    expect(two.rearRow).toHaveLength(2);
    expect(two.rearRow.every(monster => monster.isRunePillar && monster.position === "rear" && monster.alive)).toBe(true);
  });

  test("rune pillars are healing-only support and never emit atk/def buffs", () => {
    const encounter = generateMultiMonsterEncounter(seed.family, seed.tierIndex, { pillarCount:1, rand:()=>.5 });
    encounter.frontRow[0].currentHp = Math.max(1, encounter.frontRow[0].maxHp - 10);
    const result = applyRunePillarEffects(encounter.monsters);
    expect(result.buffs).toEqual([]);
    expect(result.heals.length).toBeGreaterThan(0);
  });
});
