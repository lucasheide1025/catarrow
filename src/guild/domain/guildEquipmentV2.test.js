import { GUILD_EQUIP_ARCHETYPES, GRADES } from "../data/guildEquipCatalog";
import {
  compatibleAffixIds,
  equipmentDefinition,
  EQUIPMENT_SCHEMA_VERSION,
  migrateEquipmentItem,
  resolveEquipmentV2,
} from "./guildEquipmentV2";

describe("公會裝備 v2", () => {
  test("每一個舊 archetype 都有槽位身分、主屬性、重量級與固定特性", () => {
    for (const id of Object.keys(GUILD_EQUIP_ARCHETYPES)) {
      const definition = equipmentDefinition(id);
      expect(definition.version).toBe(EQUIPMENT_SCHEMA_VERSION);
      expect(definition.slot).toBe(GUILD_EQUIP_ARCHETYPES[id].slot);
      expect(definition.role).toBeTruthy();
      expect(definition.primary).toBeTruthy();
      expect(definition.weightClass).toMatch(/light|medium|heavy/);
      expect(definition.traitId).toBeTruthy();
      expect(definition.trait.description).toBeTruthy();
    }
  });

  test("所有 archetype 與品級都能穩定解析", () => {
    for (const id of Object.keys(GUILD_EQUIP_ARCHETYPES)) {
      for (const grade of GRADES) {
        const resolved = resolveEquipmentV2(id, grade, { plus: 3 });
        expect(resolved.definition.id).toBe(id);
        expect(Object.keys(resolved.stats).length).toBeGreaterThan(0);
      }
    }
  });

  test("百分比詞綴不會成為無效果詞綴", () => {
    expect(compatibleAffixIds("long_bow")).not.toContain("sturdy");
    expect(compatibleAffixIds("plate_armor")).not.toContain("sharp");
    for (const id of Object.keys(GUILD_EQUIP_ARCHETYPES)) {
      expect(compatibleAffixIds(id).length).toBeGreaterThan(0);
    }
  });

  test("強化只放大正面數值，不會把負面懲罰越強化越嚴重", () => {
    const base = resolveEquipmentV2("siege_bow", "mythic", { plus: 0 }).stats;
    const enhanced = resolveEquipmentV2("siege_bow", "mythic", { plus: 10 }).stats;
    expect(enhanced.atk).toBeGreaterThan(base.atk);
    expect(enhanced.agi).toBe(base.agi);
  });

  test("舊詞綴保留效果並標示為 legacy，不會在遷移中消失", () => {
    const result = resolveEquipmentV2("long_bow", "rare", { affixes: ["sturdy"] });
    expect(result.legacyAffixes).toEqual(["sturdy"]);
    expect(result.stats.def).toBeUndefined();
  });

  test("遷移 deterministic 且 idempotent，保留 id/品級/+N/詞綴", () => {
    const old = { uid: "x", archetypeId: "siege_bow", grade: "boss", plus: 4, affixes: ["sharp"] };
    const once = migrateEquipmentItem(old);
    const twice = migrateEquipmentItem(once);
    expect(twice).toEqual(once);
    expect(once).toMatchObject(old);
    expect(once.equipmentVersion).toBe(2);
  });
});
