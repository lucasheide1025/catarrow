import { buildBattleStatProvenance, appendBattleStatRuntimeSources } from "./battleStatProvenance";

describe("戰鬥三圍來源",()=>{
  test("保存基礎、等級、卡片與貓咪倍率並對得上最終值",()=>{
    expect(buildBattleStatProvenance({base:{hp:100,atk:20,def:10},level:{hp:10,atk:2,def:1},card:{hp:5,atk:3,def:4},catMultiplier:1.1})).toEqual({
      rows:[
        {id:"base",label:"基礎與裝備",hp:100,atk:20,def:10},
        {id:"level",label:"射手等級",hp:10,atk:2,def:1},
        {id:"card",label:"怪物卡片",hp:5,atk:3,def:4},
        {id:"cat",label:"貓咪羈絆 ×1.10",hp:12,atk:3,def:2},
      ],total:{hp:127,atk:28,def:17},
    });
  });
  test("戰鬥中的 Buff 與 Debuff 追加成可解釋的差額",()=>{
    expect(appendBattleStatRuntimeSources({rows:[],total:{atk:40,def:20}},{effectiveAtk:34,effectiveDef:24,buffLabel:"藥水／支援"}).rows).toEqual([
      {id:"runtimeAtk",label:"異常狀態",atk:-6,def:0,hp:0},
      {id:"runtimeDef",label:"藥水／支援",atk:0,def:4,hp:0},
    ]);
  });
});
