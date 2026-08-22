import { buildCombatModifiers } from "./combatModifiers";
import {
  aggregateMultiMonsterRewardClaims,
  createMultiMonsterBattleState,
  getMultiMonsterPlayerStats,
  MULTI_BATTLE_EVENT,
  MULTI_BATTLE_PHASE,
  processMultiMonsterRound,
} from "./multiMonsterBattle";

const monsters = () => ([
  { id:"exam_1", instanceId:"a", name:"甲", hp:180, atk:20, def:5, position:"front" },
  { id:"exam_2", instanceId:"b", name:"乙", hp:180, atk:20, def:5, position:"front" },
]);
const monstersWithPillar = () => ([
  ...monsters(),
  { id:"rune_pillar", instanceId:"p", name:"治療符文柱", hp:40, atk:0, def:0, position:"rear", isRunePillar:true },
]);
const player = { hp:3000, maxHp:3000, atk:45, def:60 };
const six = score => Array.from({length:6},()=>({score,targetIndex:0,isMiss:score==="M"}));
const phases = result => result.events.filter(e=>e.type!==MULTI_BATTLE_EVENT.PHASE).map(e=>e.phase);

describe("multi monster battle full round",()=>{
  test("live player stats reflect runtime buffs and ATK/DEF status reductions",()=>{
    const state=createMultiMonsterBattleState(monsters(),player);
    state.player.atkMult=1.2;
    state.player.defFlat=10;
    state.player.statuses=[
      {id:"fear",strength:25,duration:2},
      {id:"armorBreak",strength:20,duration:1},
    ];
    const stats=getMultiMonsterPlayerStats(state);
    expect(stats.baseAtk).toBe(45);
    expect(stats.baseDef).toBe(60);
    expect(stats.atk).toBeCloseTo(40.5);
    expect(stats.def).toBeCloseTo(56);
    expect(stats.hp).toBe(3000);
  });

  test("round formulas use the same live ATK/DEF values as the HUD",()=>{
    // Keep DEF below calcStandardCounter's 1-damage floor so the test can
    // actually observe the runtime DEF multiplier changing counter damage.
    const formulaPlayer={...player,def:5};
    const normal=createMultiMonsterBattleState(monsters(),formulaPlayer);
    const buffed=createMultiMonsterBattleState(monsters(),formulaPlayer);
    buffed.player.atkMult=2;
    buffed.player.defMult=2;
    const normalResult=processMultiMonsterRound(normal,[{score:"8",targetIndex:0}],{rand:()=>.5});
    const buffedResult=processMultiMonsterRound(buffed,[{score:"8",targetIndex:0}],{rand:()=>.5});
    const arrowDamage=result=>result.events.find(e=>e.type===MULTI_BATTLE_EVENT.ARROW_HIT)?.payload.damage||0;
    const counterDamage=result=>result.events.find(e=>e.type===MULTI_BATTLE_EVENT.MONSTER_ATTACK)?.payload.damage||0;
    expect(arrowDamage(buffedResult)).toBeGreaterThan(arrowDamage(normalResult));
    expect(counterDamage(buffedResult)).toBeLessThan(counterDamage(normalResult));
  });

  test("six arrow player events finish before counter/recovery",()=>{
    const state=createMultiMonsterBattleState(monsters(),player);
    const result=processMultiMonsterRound(state,six("M"),{rand:()=>.99});
    const phaseMarkers=result.events.filter(e=>e.type===MULTI_BATTLE_EVENT.PHASE).map(e=>e.phase);
    const lastPlayer=result.events.map(e=>e.phase).lastIndexOf(MULTI_BATTLE_PHASE.PLAYER);
    const counter=result.events.findIndex(e=>e.type===MULTI_BATTLE_EVENT.PHASE&&e.phase===MULTI_BATTLE_PHASE.COUNTER);
    const recovery=result.events.findIndex(e=>e.type===MULTI_BATTLE_EVENT.PHASE&&e.phase===MULTI_BATTLE_PHASE.RECOVERY);
    expect(result.events.filter(e=>[MULTI_BATTLE_EVENT.ARROW_HIT,MULTI_BATTLE_EVENT.ARROW_CRIT,MULTI_BATTLE_EVENT.ARROW_MISS].includes(e.type))).toHaveLength(6);
    expect(phaseMarkers).toEqual(expect.arrayContaining([MULTI_BATTLE_PHASE.PLAYER,MULTI_BATTLE_PHASE.STATUS,MULTI_BATTLE_PHASE.COUNTER,MULTI_BATTLE_PHASE.RECOVERY,MULTI_BATTLE_PHASE.ROUND_END]));
    expect(lastPlayer).toBeLessThan(counter);
    expect(counter).toBeLessThan(recovery);
  });

  test("outgoing card modifier increases player damage",()=>{
    const plainMods=buildCombatModifiers();
    const boostedMods=buildCombatModifiers({cardFx:{damagePct:50}});
    const base=processMultiMonsterRound(createMultiMonsterBattleState(monsters(),player,{mods:plainMods}),[{score:"8",targetIndex:0}],{mods:plainMods,rand:()=>.99});
    const boosted=processMultiMonsterRound(createMultiMonsterBattleState(monsters(),player,{mods:boostedMods}),[{score:"8",targetIndex:0}],{mods:boostedMods,rand:()=>.99});
    const dmg=r=>r.events.find(e=>e.type===MULTI_BATTLE_EVENT.ARROW_HIT)?.payload.damage||0;
    expect(dmg(boosted)).toBeGreaterThan(dmg(base));
  });

  test("status tick occurs before counter and recovery occurs after counter",()=>{
    const state=createMultiMonsterBattleState(monsters(),player);
    state.monsters[0].statuses=[{id:"poison",turns:2,duration:2,strength:3}];
    const result=processMultiMonsterRound(state,six("M"),{rand:()=>.99});
    const tick=result.events.findIndex(e=>e.type===MULTI_BATTLE_EVENT.STATUS_TICK);
    const counter=result.events.findIndex(e=>e.type===MULTI_BATTLE_EVENT.MONSTER_ATTACK);
    const recovery=result.events.findIndex(e=>e.phase===MULTI_BATTLE_PHASE.RECOVERY);
    expect(tick).toBeGreaterThan(-1);
    expect(counter).toBeGreaterThan(tick);
    expect(recovery).toBeGreaterThan(counter);
  });

  test("later arrows retarget when locked monster was killed",()=>{
    const ms=monsters(); ms[0].hp=1;
    const state=createMultiMonsterBattleState(ms,player);
    const result=processMultiMonsterRound(state,six("10"),{rand:()=>.99});
    const hits=result.events.filter(e=>[MULTI_BATTLE_EVENT.ARROW_HIT,MULTI_BATTLE_EVENT.ARROW_CRIT].includes(e.type));
    expect(hits.some(e=>e.payload.targetId==="b")).toBe(true);
  });

  test("all enemies dead skips monster counter",()=>{
    const ms=monsters().map(m=>({...m,hp:1}));
    const state=createMultiMonsterBattleState(ms,{...player,atk:500});
    const result=processMultiMonsterRound(state,six("X"),{rand:()=>.99});
    expect(result.result).toBe("win");
    expect(result.events.some(e=>e.type===MULTI_BATTLE_EVENT.MONSTER_ATTACK)).toBe(false);
  });

  test("focus mode can directly damage a rear rune pillar",()=>{
    const state=createMultiMonsterBattleState(monstersWithPillar(),player);
    const result=processMultiMonsterRound(state,[{score:"8",targetIndex:2}],{attackMode:"focus",rand:()=>.5});
    const hit=result.events.find(e=>[MULTI_BATTLE_EVENT.ARROW_HIT,MULTI_BATTLE_EVENT.ARROW_CRIT].includes(e.type));
    expect(hit?.payload?.targetId).toBe("p");
    expect(result.nextState.monsters[2].currentHp).toBeLessThan(40);
  });

  test("attack-all hits every living target at half comparable focus damage",()=>{
    const focus=processMultiMonsterRound(
      createMultiMonsterBattleState(monstersWithPillar(),player),
      [{score:"8",targetIndex:0}],
      {attackMode:"focus",rand:()=>.5},
    );
    const all=processMultiMonsterRound(
      createMultiMonsterBattleState(monstersWithPillar(),player),
      [{score:"8",targetIndex:-1}],
      {attackMode:"all",rand:()=>.5},
    );
    const focusHit=focus.events.find(e=>e.type===MULTI_BATTLE_EVENT.ARROW_HIT&&e.payload.targetId==="a");
    const allHits=all.events.filter(e=>[MULTI_BATTLE_EVENT.ARROW_HIT,MULTI_BATTLE_EVENT.ARROW_CRIT].includes(e.type));
    expect(allHits.map(e=>e.payload.targetId)).toEqual(expect.arrayContaining(["a","b","p"]));
    const allA=allHits.find(e=>e.payload.targetId==="a");
    expect(allA.payload.damage).toBe(Math.floor(focusHit.payload.damage*.5));
  });

  test("reward settlement aggregates trusted receipts and excludes rune pillars from XP",()=>{
    const killed = [
      { id:"exam_1", tier:"common" },
      { id:"rune_pillar", tier:"rare", isRunePillar:true },
      { id:"exam_2", tier:"rare" },
    ];
    const claims = [
      { reward:{ coins:12, materialTotals:{ paper:2 }, chests:[{ id:"c1" }], card:null } },
      { reward:{ coins:8, materialTotals:{ paper:1, ink:3 }, chests:[], card:{ monsterId:"exam_2" } } },
    ];
    const reward = aggregateMultiMonsterRewardClaims(killed, claims, { common:5, rare:10 });
    expect(reward.coins).toBe(20);
    expect(reward.exp).toBe(15);
    expect(reward.materialTotals).toEqual({ paper:3, ink:3 });
    expect(reward.chests).toHaveLength(1);
    expect(reward.cards).toEqual([{ monsterId:"exam_2" }]);
  });
});
