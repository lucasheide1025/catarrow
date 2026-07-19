import { getMonsterScheduledAbility, getNextMonsterAbility } from "./monsterSkillSchedule";
import { EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";

describe("monster skill schedule", () => {
  test("normal monsters alternate signature and common skills", () => {
    const monster = EXPANSION_MONSTER_BY_ID.ghost_1;
    expect(getMonsterScheduledAbility(monster, 1)).toBeNull();
    expect(getMonsterScheduledAbility(monster, 2)).toMatchObject({ type: "signature", skillId: "sig_ghost_1" });
    expect(getMonsterScheduledAbility(monster, 4)).toMatchObject({ type: "common", skillId: "common_charge", name: "蓄力" });
    expect(getMonsterScheduledAbility(monster, 6)).toMatchObject({ type: "signature" });
  });

  test("mini bosses cycle signature, common A and common B", () => {
    const monster = EXPANSION_MONSTER_BY_ID.ghost_t1_mini_a;
    expect([2, 4, 6, 8].map(round => getMonsterScheduledAbility(monster, round)?.skillId)).toEqual(["sig_ghost_t1_mini_a", "common_charge", "common_weakpoint", "sig_ghost_t1_mini_a"]);
  });

  test("bosses use an enhanced signature on round six", () => {
    const monster = EXPANSION_MONSTER_BY_ID.ghost_t1_boss;
    expect(getMonsterScheduledAbility(monster, 6)).toMatchObject({ type: "signature", enhanced: true });
    expect(getMonsterScheduledAbility(monster, 8)).toMatchObject({ skillId: "common_armor" });
    expect(getNextMonsterAbility(monster, 1)).toMatchObject({ round: 2, skillId: "sig_ghost_t1_boss" });
  });
});
