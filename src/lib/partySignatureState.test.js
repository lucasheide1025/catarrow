import { applyPartySignatureBeforeDamage, applyPartySignatureAfterAbility, tickPartySignatureState } from "./partySignatureState";

describe("組隊招牌技能權威狀態",()=>{
  test("護盾先吸收玩家傷害，減傷再作用於穿盾後傷害",()=>{
    expect(applyPartySignatureBeforeDamage({damage:100,shield:30,reductionPct:20,reductionDuration:1})).toEqual({
      damage:56,absorbed:30,state:{shield:0,reductionPct:20,reductionDuration:1,delayedMult:0,reflectPct:0,reflectDuration:0},
    });
  });
  test("技能結算保存護盾、減傷、延遲與反射，完整破解不憑空新增",()=>{
    expect(applyPartySignatureAfterAbility({shield:5},{selfShieldMaxHpPct:10,selfReductionPct:15,selfReductionDuration:2,delayedMult:.5,selfReflectPct:8,selfReflectDuration:1},{monsterMaxHp:1000})).toEqual({
      shield:105,reductionPct:15,reductionDuration:2,delayedMult:.5,reflectPct:8,reflectDuration:1,
    });
  });
  test("回合結束會倒數減傷與反射，但保留未破護盾",()=>{
    expect(tickPartySignatureState({shield:20,reductionPct:15,reductionDuration:1,reflectPct:8,reflectDuration:2,delayedMult:.5})).toEqual({shield:20,reductionPct:0,reductionDuration:0,reflectPct:8,reflectDuration:1,delayedMult:.5});
  });
});
