jest.mock("../../lib/equipSpecializationDb", () => ({
  getEquipSpecializations: jest.fn(() => Promise.resolve({
    weapon:{ activeTrackId:null, tracks:{} },
    armor:{ activeTrackId:null, tracks:{} },
    accessory:{ activeTrackId:null, tracks:{} },
  })),
}));

jest.mock("../../lib/db", () => ({
  addRoundArrows: jest.fn(() => Promise.resolve()),
  subscribeCardCollection: jest.fn(() => () => {}),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ profile:null }),
}));

const { battleReducer, resolvePartySelectedAlly, shouldSyncPartyPlayer, getPartyHuntPresentationPhase, getPartyHuntVisibility, getDisplayedMonsterShield, shouldStartPartyVictoryPresentation, getMonsterVariantPresentation, getMonsterTaxonomyPresentation, getPartyResolutionAbilitySource, shouldPlayPartyResolution } = require("./BattleScreen");

describe("BattleScreen party authoritative state", () => {
  test("狩獵與地下城的階級和族系只顯示中文",()=>{
    expect(getMonsterTaxonomyPresentation({family:"ghost",tierIndex:3,tier:"elite"})).toEqual({familyLabel:"幽冥系",tierLabel:"第 3 階"});
    expect(getMonsterTaxonomyPresentation({family:"unknown_internal",tierIndex:2})).toEqual({familyLabel:"未知族系",tierLabel:"第 2 階"});
  });
  test("怪物個體類型顯示實際抽中的三圍修正",()=>{
    expect(getMonsterVariantPresentation({variant:"strong",variantMult:{hp:1.32,atk:1.24,def:1.24}})).toMatchObject({label:"強悍個體",hpText:"+32%",atkText:"+24%",defText:"+24%"});
    expect(getMonsterVariantPresentation({variant:"normal",variantMult:{hp:1,atk:1,def:1}})).toMatchObject({label:"普通個體",summary:"能力無修正"});
  });
  test("同一個組隊結算 key 的勝利演出只啟動一次",()=>{
    expect(shouldStartPartyVictoryPresentation({partyMode:true,partyResult:"win",completedKey:8,resolutionKey:8,presentedKey:0})).toBe(true);
    expect(shouldStartPartyVictoryPresentation({partyMode:true,partyResult:"win",completedKey:8,resolutionKey:8,presentedKey:8})).toBe(false);
  });
  test("組隊怪物護盾顯示權威剩餘點數，不使用技能百分比猜測",()=>{
    expect(getDisplayedMonsterShield({partyMode:true,partyMonsterShield:137,battleShield:999})).toBe(137);
    expect(getDisplayedMonsterShield({partyMode:false,partyMonsterShield:137,battleShield:42})).toBe(42);
  });
  test("hunt presentation changes from input to waiting to resolution", () => {
    expect(getPartyHuntPresentationPhase({})).toBe("input");
    expect(getPartyHuntPresentationPhase({ partySubmitted:true })).toBe("waiting");
    expect(getPartyHuntPresentationPhase({ partySubmitted:true, partyProcessing:true })).toBe("resolution");
    expect(getPartyHuntPresentationPhase({ partySubmitted:true, partyResolutionKey:2, completedPartyResolutionKey:1 })).toBe("resolution");
  });

  test("completed resolution keeps a summary until both the rest floor and summary beat finish", () => {
    const base={partyResolutionKey:2,completedPartyResolutionKey:2,resolutionStartedAt:1_000,resolutionCompletedAt:6_000};
    expect(getPartyHuntPresentationPhase({...base,now:7_500})).toBe("summary");
    expect(getPartyHuntPresentationPhase({...base,now:8_999})).toBe("summary");
    expect(getPartyHuntPresentationPhase({...base,now:9_000})).toBe("input");
  });

  test.each([
    ["input",{showInput:true,showWaiting:false,showResolution:false,showSummary:false}],
    ["waiting",{showInput:false,showWaiting:true,showResolution:false,showSummary:false}],
    ["resolution",{showInput:false,showWaiting:false,showResolution:true,showSummary:false}],
    ["summary",{showInput:false,showWaiting:false,showResolution:false,showSummary:true}],
  ])("%s exposes only its primary mobile surface",(phase,expected)=>{
    expect(getPartyHuntVisibility(phase)).toEqual(expected);
  });

  test("selected ally detail resolves the latest HP and role by id", () => {
    const id = "mate-1";
    const before = resolvePartySelectedAlly([{ id, hp:80, maxHp:100, role:"front" }], id);
    const after = resolvePartySelectedAlly([{ id, hp:50, maxHp:100, role:"rear" }], id);
    expect(before).toMatchObject({ hp:80, role:"front" });
    expect(after).toMatchObject({ hp:50, role:"rear" });
  });

  test("party player HP waits for the shared resolution animation before syncing", () => {
    expect(shouldSyncPartyPlayer({ partyMode:true, inBattle:true, partyResolutionKey:2, completedPartyResolutionKey:1 })).toBe(false);
    expect(shouldSyncPartyPlayer({ partyMode:true, inBattle:true, partyResolutionKey:2, completedPartyResolutionKey:2 })).toBe(true);
  });

  test("SYNC_PARTY_PLAYER updates player HP without overriding monster animation state", () => {
    const state = { playerHp:20, playerMaxHp:100, monsterHp:321, monsterMaxHp:500, phase:"playing", messages:[] };
    const next = battleReducer(state, { type:"SYNC_PARTY_PLAYER", playerHp:50, playerMaxHp:100 });
    expect(next.playerHp).toBe(50);
    expect(next.playerMaxHp).toBe(100);
    expect(next.monsterHp).toBe(321);
    expect(next.monsterMaxHp).toBe(500);
  });

  test("地下城與一般組隊技能共用同一個演出來源解析",()=>{
    expect(getPartyResolutionAbilitySource({ability:{resolvedKey:"dungeon:2",name:"裂浪"}})).toMatchObject({kind:"dungeon"});
    expect(getPartyResolutionAbilitySource({monsterAbility:{scheduled:{name:"護甲"}}})).toMatchObject({kind:"party"});
    expect(getPartyResolutionAbilitySource({})).toBeNull();
  });

  test("地下城技能即使沒有 miniRounds 也必須啟動 resolution 演出生命週期",()=>{
    const resolution={miniRounds:[],ability:{resolvedKey:"dungeon:exam:2",name:"考試壓力"}};
    expect(shouldPlayPartyResolution({partyMode:true,resolution,resolutionKey:2,seenKey:1})).toBe(true);
  });

  test("一般怪族系異常即使沒有 miniRounds 也必須啟動 resolution 演出生命週期",()=>{
    const resolution={familyStatusResults:[{family:"exam",statusId:"pressure",outcome:"applied"}]};
    expect(shouldPlayPartyResolution({partyMode:true,resolution,resolutionKey:3,seenKey:2})).toBe(true);
  });

  test("相同 resolution key 不重播",()=>{
    expect(shouldPlayPartyResolution({partyMode:true,resolution:{miniRounds:[]},resolutionKey:4,seenKey:4})).toBe(false);
  });

  test("沒有有效 resolution 或 key 時不啟動",()=>{
    expect(shouldPlayPartyResolution({partyMode:true,resolution:null,resolutionKey:5,seenKey:0})).toBe(false);
    expect(shouldPlayPartyResolution({partyMode:true,resolution:{},resolutionKey:0,seenKey:0})).toBe(false);
    expect(shouldPlayPartyResolution({partyMode:false,resolution:{},resolutionKey:5,seenKey:0})).toBe(false);
  });

  test("START preserves a valid zero HP instead of replacing it with max HP", () => {
    const next = battleReducer({}, {
      type:"START",
      monster:{ name:"測試怪", family:"ghost", hp:100, maxHp:100, atk:10, def:5 },
      diff:{ hp:1, atk:1, def:1 },
      battleMode:"score",
      playerHp:0,
      playerMaxHp:100,
      playerAtk:10,
      playerDef:10,
    });
    expect(next.playerHp).toBe(0);
    expect(next.playerMaxHp).toBe(100);
  });
});
