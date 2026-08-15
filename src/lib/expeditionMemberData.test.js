import { buildExpeditionBattleMemberSnapshot, buildExpeditionMemberData } from "./expeditionMemberData";
import { calculateDungeonDisplayedStats } from "./dungeonDisplayedStats";
import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";

describe("buildExpeditionMemberData", () => {
  test("does not multiply final archer stats by cat bond again", () => {
    const profile = {
      archerXP: 0,
      equippedCat: {
        catId: "niuniu",
        type: "attack",
        bond: 999999,
        level: 1,
      },
    };
    const cardBonus = { hp:7, atk:11, def:5 };
    const base = calcArcherStats({
      member:profile,
      certification:null,
      certRecords:[],
      dexStats:null,
    });
    const level = archerLevelBonus(archerLevelFromXP(profile.archerXP));
    const result = buildExpeditionMemberData(profile, cardBonus);

    expect(result.hp).toBe(base.hp + level.hp + cardBonus.hp);
    expect(result.atk).toBe(base.atk + level.atk + cardBonus.atk);
    expect(result.def).toBe(base.def + level.def + cardBonus.def);
    expect(result.catAtk).toBeGreaterThanOrEqual(0);
    expect(result.catBond).toBeLessThanOrEqual(50);
    expect(result.catLevel).toBeGreaterThanOrEqual(1);
    expect(result.catMaxHP).toBeGreaterThan(0);
    expect(result.catDef).toBeGreaterThan(0);
  });

  test("carries the normalized personal resistance snapshot into expedition rooms", () => {
    expect(buildExpeditionMemberData({},null,null,{statusStrengthReductionPct:20,statusDurationReduction:1,poisonResistPct:50}).statusResistance)
      .toEqual({statusStrengthReductionPct:20,statusDurationReduction:1,poisonResistPct:50});
  });
});

describe("地下城地圖數值進入戰鬥房", () => {
  test("保留休息與商人加成，戰鬥顯示必須與地圖一致", () => {
    const member = buildExpeditionBattleMemberSnapshot({
      memberName:"測試射手",
      memberData:{
        hp:1086,
        maxHP:1086,
        atk:141,
        def:133,
        restBonuses:{ atkPct:15, defPct:10 },
        merchantBonuses:{ atkPct:17.5, defPct:0 },
      },
    });
    expect(member.restBonuses).toEqual({ atkPct:15, defPct:10 });
    expect(member.merchantBonuses).toEqual({ atkPct:17.5, defPct:0 });
    expect(buildExpeditionBattleMemberSnapshot({memberName:"a",memberData:{statusResistance:{poisonResistPct:100}}}).statusResistance).toEqual({poisonResistPct:100});
    expect(buildExpeditionBattleMemberSnapshot({memberName:"a",memberData:{catBond:12,catLevel:8,catMaxHP:345,catDef:27}})).toMatchObject({catBond:12,catLevel:8,catMaxHP:345,catDef:27});
    expect(calculateDungeonDisplayedStats(member)).toMatchObject({ atk:191, def:146 });
  });
});
