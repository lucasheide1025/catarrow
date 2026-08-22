import { applyDungeonRouteImmediateEffect, chooseDungeonRouteMark, chooseDungeonRouteMarkAsController, createDungeonRouteV2, currentDungeonRouteOptions, getDungeonRouteModifiers, resolveDungeonRouteSequence } from "./dungeonRouteV2";

test("route v2 is deterministic and locks three visible decisions",()=>{
  const a=createDungeonRouteV2("run-7"), b=createDungeonRouteV2("run-7");
  expect(a).toEqual(b);
  expect(a.activeDecision).toBe(0);
  let route=a;
  for(let i=0;i<3;i+=1){ const option=currentDungeonRouteOptions(route)[0]; route=chooseDungeonRouteMark(route,option); }
  expect(route.marks).toHaveLength(3);
  expect(route.rooms).toHaveLength(5);
  expect(route.activeDecision).toBeNull();
  expect(currentDungeonRouteOptions(route)).toEqual([]);
});

test("route rejects hidden or repeated choices",()=>{
  const route=createDungeonRouteV2("locked");
  expect(chooseDungeonRouteMark(route,"forged")).toBe(route);
  expect(chooseDungeonRouteMarkAsController(route,currentDungeonRouteOptions(route)[0],false)).toBe(route);
});

test("route effects are accumulated and immediate hp changes are bounded",()=>{
  expect(applyDungeonRouteImmediateEffect({hp:50,maxHP:100},"supply").hp).toBe(65);
  expect(applyDungeonRouteImmediateEffect({hp:5,maxHP:100},"curse").hp).toBe(1);
  expect(getDungeonRouteModifiers({marks:["hunt","curse"]})).toMatchObject({threatPct:.15,dropPct:.2,rarePct:.25,bossDefPct:-.1});
  const sequence=resolveDungeonRouteSequence({marks:["hunt","curse"],rooms:[{id:"r",routeMark:"hunt"}]},{id:"boss"},{id:"loot"});
  expect(sequence[0].threatMultiplier).toBe(1.15);
  expect(sequence[1].bossDefenseMultiplier).toBe(.9);
  expect(sequence[2].rewardMultiplier).toBe(1.25);
});
