import {
  SOLO_HUNT_FAMILIES,
  drawExpansionSoloMonsters,
  getExpansionTierPool,
  selectVariant,
  toLegacyBattleMonster,
} from "./monsterExpansionAdapter";
import { EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";
import { MATERIAL_BY_ID } from "./monsterEconomyCatalog";

describe("monster expansion legacy adapter", () => {
  test("preserves existing ids and exposes the fields used by battle UI", () => {
    expect(toLegacyBattleMonster(EXPANSION_MONSTER_BY_ID.ghost_1)).toMatchObject({
      id: "ghost_1", name: "鏡幕幽姬", materialId: "ghost_m1", cardId: "ghost_1", encounter: "normal", expansionVersion: 1,
    });
  });

  test("uses the same archer-power tier gates as the existing matcher", () => {
    expect(getExpansionTierPool(49)).toEqual(["common"]);
    expect(getExpansionTierPool(180)).toEqual(["common", "rare", "elite", "fierce"]);
    expect(getExpansionTierPool(400)).toHaveLength(6);
  });

  test("draws one normal monster per hunt family, including treasure, and never leaks bosses", () => {
    const monsters = drawExpansionSoloMonsters(400, { random: () => 0.5 });
    expect(monsters).toHaveLength(SOLO_HUNT_FAMILIES.length);
    expect(SOLO_HUNT_FAMILIES).toContain("treasure");
    expect(new Set(monsters.map(monster => monster.family))).toEqual(new Set(SOLO_HUNT_FAMILIES));
    const treasure = monsters.find(monster => monster.family === "treasure");
    expect(treasure?.materialId).toMatch(/^mat_treasure_[1-6](?:_real)?$/);
    expect(MATERIAL_BY_ID[treasure.materialId]?.family).toBe("treasure");
    expect(monsters.every(monster => monster.encounter === "normal" && !monster.bossTagged)).toBe(true);
    expect(monsters.every(monster => monster.signatureSkillId && monster.materialId && monster.cardId)).toBe(true);
  });

  test("keeps the treasure family available only when a mode explicitly requests it", () => {
    const monsters = drawExpansionSoloMonsters(10, { random: () => 0, families: ["treasure"] });
    expect(monsters).toHaveLength(1);
    expect(monsters[0]).toMatchObject({ family: "treasure", encounter: "normal" });
  });

  test("進場會從弱化、普通與強悍三種個體抽選", () => {
    expect(selectVariant(0)).toBe("weak");
    expect(selectVariant(0.5)).toBe("normal");
    expect(selectVariant(0.99)).toBe("strong");
  });
});
