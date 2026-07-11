import { POTIONS, CARRY_POTIONS, THROW_POTIONS, RAID_POTIONS } from "./itemData";
import {
  calculateMaxCrafts,
  getConsumablesForMode,
  mergeCarryBuff,
  migratePotionInventory,
  resolveConsumable,
} from "./consumableSystem";

describe("consumable catalog", () => {
  test("contains the approved 29 items and no fur recipes", () => {
    expect(CARRY_POTIONS).toHaveLength(14);
    expect(THROW_POTIONS).toHaveLength(10);
    expect(RAID_POTIONS).toHaveLength(5);
    expect(POTIONS).toHaveLength(29);
    expect(POTIONS.flatMap(item => item.recipe).some(entry => entry.id.startsWith("fur_"))).toBe(false);
  });

  test("future items can be crafted but are not exposed in battle", () => {
    const ids = getConsumablesForMode(POTIONS, "monster").map(item => item.id);
    expect(ids).not.toContain("carry_cleanse_basic");
    expect(ids).not.toContain("throw_binding_net");
    expect(POTIONS.find(item => item.id === "carry_cleanse_basic").recipe).toBeTruthy();
  });

  test("world boss accepts carry and raid but rejects regular throws", () => {
    const ids = getConsumablesForMode(POTIONS, "worldboss").map(item => item.id);
    expect(ids).toContain("carry_power_basic");
    expect(ids).toContain("raid_bomb");
    expect(ids).not.toContain("throw_knife");
    expect(resolveConsumable("throw_knife", { mode:"worldboss", playerAtk:100 }).ok).toBe(false);
  });

  test("legacy migration merges counts and is idempotent", () => {
    const first = migratePotionInventory({ items:{ hp_5:2, hp_10:3, hp_15:4, throw_fixed:1, throw_knife:2 } });
    expect(first.items.carry_heal_basic).toBe(5);
    expect(first.items.carry_heal_advanced).toBe(4);
    expect(first.items.throw_knife).toBe(3);
    const second = migratePotionInventory(first);
    expect(second.items).toEqual(first.items);
    expect(second.migrated).toBe(false);
  });

  test("carry families replace only lower versions of the same family", () => {
    const basic = CARRY_POTIONS.find(item => item.id === "carry_power_basic");
    const advanced = CARRY_POTIONS.find(item => item.id === "carry_power_advanced");
    const guard = CARRY_POTIONS.find(item => item.id === "carry_guard_basic");
    const buffs = mergeCarryBuff(mergeCarryBuff(mergeCarryBuff({}, basic), guard), advanced);
    expect(buffs.power.id).toBe("carry_power_advanced");
    expect(buffs.guard.id).toBe("carry_guard_basic");
  });

  test("damage resolution scales and respects boss caps", () => {
    expect(resolveConsumable("throw_knife", { mode:"monster", playerAtk:100 }).damage).toBe(120);
    expect(resolveConsumable("throw_corrosion", { mode:"monster", playerAtk:100, enemyMaxHp:10000 }).damage).toBe(600);
    expect(resolveConsumable("throw_corrosion", { mode:"monster", playerAtk:100, enemyMaxHp:10000, isBoss:true }).damage).toBe(250);
    expect(resolveConsumable("raid_execution_spear", { mode:"worldboss", playerAtk:100, enemyHp:200, enemyMaxHp:1000 }).damage).toBe(260);
  });

  test("craft maximum accounts for every material and coins", () => {
    const item = CARRY_POTIONS.find(potion => potion.id === "carry_heal_basic");
    expect(calculateMaxCrafts(item, { potion_t1:9, fish_t1:3 }, 250)).toBe(2);
  });
});
