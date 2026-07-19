import {
  EXPANSION_CARDS,
  EXPANSION_MATERIALS,
  EXPANSION_MONSTERS,
  validateMonsterExpansionCatalog,
} from "./monsterExpansionCatalog";

test("monster expansion catalog is complete and internally consistent", () => {
  expect(validateMonsterExpansionCatalog()).toMatchObject({ ok: true, errors: [] });
  expect(EXPANSION_MONSTERS).toHaveLength(252);
  expect(EXPANSION_MATERIALS).toHaveLength(252);
  expect(EXPANSION_CARDS).toHaveLength(252);
});

test("every family and tier has three normal monsters, two mini-bosses and one boss", () => {
  const groups = new Map();
  EXPANSION_MONSTERS.forEach(monster => {
    const key = `${monster.family}:${monster.tier}`;
    const group = groups.get(key) || [];
    group.push(monster);
    groups.set(key, group);
  });

  expect(groups.size).toBe(42);
  groups.forEach(group => {
    expect(group.filter(item => item.encounter === "normal")).toHaveLength(3);
    expect(group.filter(item => item.encounter === "miniBoss")).toHaveLength(2);
    expect(group.filter(item => item.encounter === "boss")).toHaveLength(1);
  });
});

test("boss materials cannot convert and T6 materials cannot upgrade", () => {
  expect(EXPANSION_MATERIALS.filter(item => item.kind !== "normal").every(item => !item.convertible)).toBe(true);
  expect(EXPANSION_MATERIALS.filter(item => item.tierIndex === 6).every(item => item.upgradesToTier === null)).toBe(true);
});

test("existing treasure identities remain in their assigned slots", () => {
  const ids = new Set(EXPANSION_MONSTERS.map(item => item.id));
  for (let tier = 1; tier <= 6; tier += 1) {
    expect(ids.has(`treasure_${tier}`)).toBe(true);
    expect(ids.has(`treasure_${tier}_real`)).toBe(true);
    expect(ids.has(`treasure_king_small_${tier}`)).toBe(true);
    expect(ids.has(`treasure_king_big_${tier}`)).toBe(true);
  }
});
