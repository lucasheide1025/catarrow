import { CAT_BATTLE_ARCHETYPES, CAT_BATTLE_MODE_POLICIES, getCatBattleArchetype, getCatBondScaling } from "./catBattleArchetypes";

describe("cat battle archetype catalog",()=>{
  test("all nine cats have three distinct traits",()=>{
    expect(Object.keys(CAT_BATTLE_ARCHETYPES)).toHaveLength(9);
    for(const cat of Object.values(CAT_BATTLE_ARCHETYPES)){
      expect(["heal","attack","defense"]).toContain(cat.type);
      expect(cat.passive?.name).toBeTruthy();
      expect(cat.strongSkill?.name).toBeTruthy();
      expect(cat.synergy?.name).toBeTruthy();
    }
  });

  test("bond scaling grows but does not change the fourth-round pity",()=>{
    const low=getCatBondScaling(0);
    const high=getCatBondScaling(50);
    expect(high.powerMultiplier).toBeGreaterThan(low.powerMultiplier);
    expect(high.procBonus).toBeGreaterThan(low.procBonus);
    expect(high.pityRound).toBe(4);
    expect(low.pityRound).toBe(4);
  });

  test("world boss policy is stricter than normal monsters",()=>{
    expect(CAT_BATTLE_MODE_POLICIES.worldboss.maxHpDamagePct).toBeLessThan(CAT_BATTLE_MODE_POLICIES.normal.maxHpDamagePct);
    expect(CAT_BATTLE_MODE_POLICIES.worldboss.allowDeathGuard).toBe(false);
  });

  test("persisted cat ids resolve to intended roles",()=>{
    expect(getCatBattleArchetype("daming").type).toBe("heal");
    expect(getCatBattleArchetype("haji").type).toBe("attack");
    expect(getCatBattleArchetype("diandian").type).toBe("defense");
  });
});
