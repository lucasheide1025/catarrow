import {
  SOLO_HUNT_FAMILIES,
  drawExpansionSoloMonsters,
  getExpansionTierPool,
  toLegacyBattleMonster,
} from "./monsterExpansionAdapter";
import { EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";

describe("monster expansion legacy adapter", () => {
  test("preserves existing ids and exposes the fields used by battle UI", () => {
    expect(toLegacyBattleMonster(EXPANSION_MONSTER_BY_ID.ghost_1)).toMatchObject({
      id: "ghost_1", name: "好兄弟", materialId: "ghost_m1", cardId: "ghost_1", encounter: "normal", expansionVersion: 1,
    });
  });

  test("uses the same archer-power tier gates as the existing matcher", () => {
    expect(getExpansionTierPool(49)).toEqual(["common"]);
    expect(getExpansionTierPool(180)).toEqual(["common", "rare", "elite", "fierce"]);
    expect(getExpansionTierPool(400)).toHaveLength(6);
  });

  test("draws one normal monster per solo family and never leaks bosses", () => {
    const monsters = drawExpansionSoloMonsters(400, { random: () => 0.5 });
    expect(monsters).toHaveLength(SOLO_HUNT_FAMILIES.length);
    expect(new Set(monsters.map(monster => monster.family)).size).toBe(6);
    expect(monsters.every(monster => monster.encounter === "normal" && !monster.bossTagged)).toBe(true);
    expect(monsters.every(monster => monster.signatureSkillId && monster.materialId && monster.cardId)).toBe(true);
  });

  test("keeps the treasure family available only when a mode explicitly requests it", () => {
    const monsters = drawExpansionSoloMonsters(10, { random: () => 0, families: ["treasure"] });
    expect(monsters).toHaveLength(1);
    expect(monsters[0]).toMatchObject({ family: "treasure", encounter: "normal" });
  });
});
