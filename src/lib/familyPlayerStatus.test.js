import {
  FAMILY_PLAYER_STATUS,
  getFamilyOrdinaryStatus,
  resolveFamilyOrdinaryStatusForParty,
  removeBleedOnEffectiveHeal,
  normalizePlayerStatusResistance,
  deterministicStatusRoll,
  getPlayerStatusModifiers,
  applyGlareToDamageBreakdown,
  applyIncomingHealing,
  resolveFamilyOrdinaryStatusForSolo,
} from "./familyPlayerStatus";

describe("七族普通攻擊異常", () => {
  test("七族都有固定且不剝奪射箭的核心異常", () => {
    expect(Object.fromEntries(Object.entries(FAMILY_PLAYER_STATUS).map(([family,value])=>[family,value.id]))).toEqual({
      ghost:"fear",mountain:"armorBreak",insect:"poison",workplace:"fatigue",
      exam:"pressure",temple:"bleed",treasure:"glare",
    });
    expect(Object.values(FAMILY_PLAYER_STATUS).every(status=>status.blocksShooting===false)).toBe(true);
  });

  test.each([
    [1,.2,10,1,2,3],
    [2,.2,10,1,2,3],
    [3,.3,15,2,3,4],
    [4,.3,15,2,3,4],
    [5,.4,20,3,4,5],
    [6,.4,20,3,4,5],
  ])("T%i 使用核准的觸發、強度與回合曲線",(tierIndex,chance,strength,duration,poison,bleed)=>{
    expect(getFamilyOrdinaryStatus({family:"ghost",tierIndex})).toMatchObject({chance,strength,duration});
    expect(getFamilyOrdinaryStatus({family:"insect",tierIndex}).strength).toBe(poison);
    expect(getFamilyOrdinaryStatus({family:"temple",tierIndex}).strength).toBe(bleed);
  });

  test("每位前衛獨立判定，後衛完全不參與", () => {
    const rolls=[.1,.9];
    const results=resolveFamilyOrdinaryStatusForParty({
      family:"ghost",tierIndex:1,
      members:[{id:"a",role:"front",alive:true},{id:"b",role:"front",alive:true},{id:"c",role:"rear",alive:true}],
      random:()=>rolls.shift(),
    });
    expect(results).toEqual([
      expect.objectContaining({targetId:"a",outcome:"applied"}),
      expect.objectContaining({targetId:"b",outcome:"not_triggered"}),
      expect.objectContaining({targetId:"c",outcome:"rear_immune"}),
    ]);
  });

  test("個人卡片與專精抗性只在命中後降低效果", () => {
    const [result]=resolveFamilyOrdinaryStatusForParty({
      family:"ghost",tierIndex:4,members:[{id:"a",role:"front",alive:true,mods:{statusStrengthReductionPct:20,statusDurationReduction:1}}],random:()=>0,
    });
    expect(result).toMatchObject({outcome:"resisted",rawStatus:{strength:15,duration:2},finalStatus:{strength:12,duration:1}});
  });

  test("昆蟲四卡的 100% 毒抗會明確回報完全免疫", () => {
    const [result]=resolveFamilyOrdinaryStatusForParty({
      family:"insect",tierIndex:6,members:[{id:"a",role:"front",alive:true,mods:{poisonResistPct:100}}],random:()=>0,
    });
    expect(result).toMatchObject({outcome:"immune",finalStatus:null});
  });

  test("流血只在實際恢復 HP 時解除", () => {
    const statuses=[{id:"bleed",duration:2},{id:"fear",duration:1}];
    expect(removeBleedOnEffectiveHeal(statuses,{healed:0})).toEqual(statuses);
    expect(removeBleedOnEffectiveHeal(statuses,{healed:5})).toEqual([{id:"fear",duration:1}]);
  });

  test("房間只保存可序列化且有上限的抗性快照", () => {
    expect(normalizePlayerStatusResistance({
      statusStrengthReductionPct:140,statusDurationReduction:2.9,poisonResistPct:-5,inflict:{poison:true},unknown:99,
    })).toEqual({statusStrengthReductionPct:100,statusDurationReduction:2,poisonResistPct:0});
  });

  test("同一場次、回合、玩家的權威判定可重播且不受名單順序影響", () => {
    const a=deterministicStatusRoll("room-1",3,"member-a","ghost");
    expect(deterministicStatusRoll("room-1",3,"member-a","ghost")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(deterministicStatusRoll("room-1",3,"member-b","ghost")).not.toBe(a);
  });

  test("疲勞、壓力與眩光提供集中且可疊加的戰鬥修正", () => {
    expect(getPlayerStatusModifiers([
      {id:"fatigue",strength:20,duration:1},{id:"pressure",strength:15,duration:1},{id:"glare",strength:10,duration:1},
    ])).toEqual({healingReceivedMultiplier:.8,shieldReceivedMultiplier:.8,damageTakenMultiplier:1.15,bonusDamageReductionPct:10});
  });

  test("眩光只削弱暴擊／部位加成，不改箭分造成的基礎傷害", () => {
    const result=applyGlareToDamageBreakdown([
      {label:"X",dmg:200,isCrit:true,partMult:2},{label:"9",dmg:90,isCrit:false,partMult:1},
    ],50);
    expect(result).toEqual([
      expect.objectContaining({label:"X",dmg:150,glareReduced:50}),
      expect.objectContaining({label:"9",dmg:90}),
    ]);
  });

  test("所有有效治療統一套用疲勞並解除流血", () => {
    expect(applyIncomingHealing({hp:50,maxHp:100,amount:30,statuses:[
      {id:"fatigue",strength:20,duration:2},{id:"bleed",strength:3,duration:2},
    ]})).toEqual({hp:74,healed:24,statuses:[{id:"fatigue",strength:20,duration:2}]});
    expect(applyIncomingHealing({hp:100,maxHp:100,amount:30,statuses:[{id:"bleed",duration:2}]})).toEqual({hp:100,healed:0,statuses:[{id:"bleed",duration:2}]});
  });

  test("單人普通攻擊沿用相同機率、抗性與可重播判定", () => {
    expect(resolveFamilyOrdinaryStatusForSolo({family:"ghost",tierIndex:4,battleId:"solo-1",round:2,mods:{statusDurationReduction:1}})).toMatchObject({
      targetId:"player",outcome:expect.stringMatching(/applied|resisted|not_triggered/),chance:.3,
    });
    expect(resolveFamilyOrdinaryStatusForSolo({family:"insect",tierIndex:6,battleId:"solo-immune",round:1,mods:{poisonResistPct:100},random:()=>0})).toMatchObject({outcome:"immune",finalStatus:null});
  });
});
