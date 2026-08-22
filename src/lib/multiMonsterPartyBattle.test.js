import { resolveMultiMonsterPartyRound } from "./multiMonsterPartyBattle";

function member(overrides = {}) {
  return { name:"A", hp:200, maxHp:200, maxHP:200, atk:30, def:10, baseAtk:30, baseDef:10, atkMult:1, defMult:1, alive:true, ready:true, huntDistanceM:5, huntTargetFmt:"half_17", bowType:"recurve_bare", submission:{ round:1, arrows:["10"], attackMode:"focus", targetId:"monster_0" }, ...overrides };
}
function target(id, overrides = {}) {
  return { id, instanceId:id, name:id, position:"front", currentHp:500, maxHp:500, hp:500, atk:20, def:5, alive:true, statuses:[], ...overrides };
}
function room(overrides = {}) {
  return {
    id:"roomA", huntType:"multi", multiMonster:true, hostId:"p1", encounterSeed:12345, round:1, arrowsPerRound:1,
    targetOrder:["monster_0","monster_1","monster_2"],
    targets:{ monster_0:target("monster_0"), monster_1:target("monster_1"), monster_2:target("monster_2") },
    members:{ p1:member() },
    ...overrides,
  };
}

test("same room + round resolves deterministically", () => {
  const input = room();
  expect(resolveMultiMonsterPartyRound({ room:input, expectedRound:1 })).toEqual(resolveMultiMonsterPartyRound({ room:input, expectedRound:1 }));
});

test("all attack deals exactly half of comparable focus damage to each living target", () => {
  const focus = resolveMultiMonsterPartyRound({ room:room(), expectedRound:1 });
  const allRoom = room({ members:{ p1:member({ submission:{ round:1, arrows:["10"], attackMode:"all", targetId:null } }) } });
  const all = resolveMultiMonsterPartyRound({ room:allRoom, expectedRound:1 });
  const focusDamage = 500 - focus.targets.monster_0.currentHp;
  expect(500 - all.targets.monster_0.currentHp).toBe(Math.floor(focusDamage * 0.5));
  expect(500 - all.targets.monster_1.currentHp).toBeGreaterThan(0);
  expect(500 - all.targets.monster_2.currentHp).toBeGreaterThan(0);
});

test("pillar healing runs once after all players, not once per player", () => {
  const r = room({
    targetOrder:["monster_0","monster_1","monster_2","rune_pillar_0"],
    targets:{
      monster_0:target("monster_0",{currentHp:300}), monster_1:target("monster_1",{currentHp:300}), monster_2:target("monster_2",{currentHp:300}),
      rune_pillar_0:target("rune_pillar_0",{ id:"rune_pillar", position:"rear", isRunePillar:true, currentHp:50, maxHp:50, hp:50, atk:0, def:0 }),
    },
    members:{ p1:member({ submission:{round:1,arrows:["M"],attackMode:"focus",targetId:"monster_0"} }), p2:member({name:"B",submission:{round:1,arrows:["M"],attackMode:"focus",targetId:"monster_1"}}) },
  });
  const result = resolveMultiMonsterPartyRound({ room:r, expectedRound:1 });
  expect(result.lastResolution.events.filter(event => event.type === "rune_heal")).toHaveLength(3);
  expect(result.targets.monster_0.currentHp).toBeGreaterThan(300);
  expect(result.targets.monster_1.currentHp).toBeGreaterThan(300);
  expect(result.targets.monster_2.currentHp).toBeGreaterThan(300);
});

test("counter damage reads the member live DEF", () => {
  const low = resolveMultiMonsterPartyRound({ room:room({ members:{p1:member({def:10,baseDef:10,submission:{round:1,arrows:["M"],attackMode:"focus",targetId:"monster_0"}})} }), expectedRound:1 });
  const high = resolveMultiMonsterPartyRound({ room:room({ members:{p1:member({def:10,baseDef:10,defMult:3,submission:{round:1,arrows:["M"],attackMode:"focus",targetId:"monster_0"}})} }), expectedRound:1 });
  expect(high.members.p1.hp).toBeGreaterThan(low.members.p1.hp);
});

test("victory ignores a still-living rune pillar", () => {
  const r = room({
    targetOrder:["monster_0","monster_1","monster_2","rune_pillar_0"],
    targets:{
      monster_0:target("monster_0",{currentHp:1,maxHp:1,hp:1,atk:0,def:0}),
      monster_1:target("monster_1",{currentHp:0,alive:false}), monster_2:target("monster_2",{currentHp:0,alive:false}),
      rune_pillar_0:target("rune_pillar_0",{id:"rune_pillar",position:"rear",isRunePillar:true,currentHp:50,maxHp:50,hp:50,atk:0,def:0}),
    },
    members:{p1:member({atk:100,baseAtk:100})},
  });
  const result = resolveMultiMonsterPartyRound({ room:r, expectedRound:1 });
  expect(result.status).toBe("victory");
  expect(result.targets.rune_pillar_0.alive).toBe(true);
});

test("defeat is terminal when counters down the final member", () => {
  const r = room({ members:{p1:member({hp:1,maxHp:200,submission:{round:1,arrows:["M"],attackMode:"focus",targetId:"monster_0"}})} });
  const result = resolveMultiMonsterPartyRound({ room:r, expectedRound:1 });
  expect(result.status).toBe("defeat");
  expect(result.members.p1.alive).toBe(false);
});

test("round resolution clears every submission and ready flag", () => {
  const result = resolveMultiMonsterPartyRound({ room:room(), expectedRound:1 });
  expect(result.members.p1.ready).toBe(false);
  expect(result.members.p1.submission).toBeNull();
  expect(result.members.p1.arrows).toBeUndefined();
});

test("focus retargets if an earlier member killed the requested target", () => {
  const r = room({
    targets:{monster_0:target("monster_0",{currentHp:1,maxHp:1,hp:1,atk:0}),monster_1:target("monster_1",{atk:0}),monster_2:target("monster_2",{atk:0})},
    members:{
      p1:member({atk:100,baseAtk:100}),
      p2:member({name:"B",atk:30,baseAtk:30,submission:{round:1,arrows:["10"],attackMode:"focus",targetId:"monster_0"}}),
    },
  });
  const result = resolveMultiMonsterPartyRound({ room:r, expectedRound:1 });
  expect(result.targets.monster_0.currentHp).toBe(0);
  expect(result.targets.monster_1.currentHp).toBeLessThan(500);
  expect(result.lastResolution.events.some(event => event.type === "player_attack" && event.memberId === "p2")).toBe(true);
});

test("v2 snapshot is authoritative over forged legacy member stats", () => {
  const result = resolveMultiMonsterPartyRound({ room:room({ members:{ p1:member({ atk:9999, baseAtk:9999, loadoutSnapshot:{ version:2, baseStats:{hp:200,atk:30,def:10}, cards:{familyDamageBonusPct:{}} } }) } }), expectedRound:1 });
  expect(500 - result.targets.monster_0.currentHp).toBeLessThan(100);
});

test("equipped cat attacks the selected living target once", () => {
  const result = resolveMultiMonsterPartyRound({ room:room({ members:{ p1:member({ catId:"niuniu", catATK:40 }) } }), expectedRound:1 });
  const cats = result.lastResolution.events.filter(event => event.type === "cat_action");
  expect(cats).toHaveLength(1);
  expect(cats[0]).toMatchObject({ memberId:"p1", targetId:"monster_0" });
});
