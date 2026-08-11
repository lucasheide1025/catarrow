import { getMonsterCardPackPool } from "./itemData";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";

test("monster card packs contain every normal monster and exclude bosses", () => {
  const pool = getMonsterCardPackPool();
  const expectedIds = EXPANSION_MONSTERS
    .filter(monster => monster.encounter === "normal")
    .map(monster => monster.id)
    .sort();

  expect(pool.map(card => card.monsterId).sort()).toEqual(expectedIds);
  expect(pool).toHaveLength(126);
  expect(pool.every(card => card.encounter === "normal")).toBe(true);
});

test("every card-pack entry contains the fields required by card collection", () => {
  getMonsterCardPackPool().forEach(card => {
    expect(card).toEqual(expect.objectContaining({
      monsterId: expect.any(String),
      name: expect.any(String),
      icon: expect.any(String),
      tier: expect.any(String),
      family: expect.any(String),
      artKey: expect.any(String),
    }));
  });
});
