"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const { buildDungeonBossEnvelope, buildFamilyMaterialChests, isRewardableDungeonRoom, isRewardableTeamDungeonBossRoom, publicEnvelope, validateChoices }=require("./dungeonBossReward");

test("server builds deterministic boss envelopes with valid choices",()=>{
  const input={ battleId:"run-1", memberId:"m1", monsterId:"ghost_t1_boss" };
  const a=buildDungeonBossEnvelope(input); const b=buildDungeonBossEnvelope(input);
  assert.deepEqual(a,b); assert.equal(a.cardResult.chance,.4); assert.equal(a.choiceCount,2);
  assert.equal(a.version,2); assert.equal(a.choiceOptions.length,6);
  assert.deepEqual(publicEnvelope(a).choiceOptions,a.choiceOptions.map(({id})=>({id})));
  assert.equal(validateChoices(a,a.choiceOptions.slice(0,2).map(option=>option.id)),true);
});

test("claims require authoritative win proof with matching member and monster",()=>{
  const room={status:"path_select",result:"win",monsterHP:0,monster:{id:"m1"},members:{u1:{}},log:[{monsterHPAfter:0,playerLog:[{id:"u1"}]}]};
  assert.equal(isRewardableDungeonRoom(room,"u1","m1"),true);
  assert.equal(isRewardableDungeonRoom({...room,monsterHP:1},"u1","m1"),false);
  assert.equal(isRewardableDungeonRoom(room,"u2","m1"),false);
  assert.equal(isRewardableDungeonRoom(room,"u1","m2"),false);
  assert.equal(isRewardableDungeonRoom({...room,result:null},"u1","m1"),false);

  // Backward recovery for rooms already mutated by the old expedition flow:
  // result was cleared while the terminal battle log still proves the boss died.
  const recovered={...room,status:"map_explore",result:null};
  assert.equal(isRewardableDungeonRoom(recovered,"u1","m1"),true);
  assert.equal(isRewardableDungeonRoom({...recovered,log:[{monsterHPAfter:1,playerLog:[{id:"u1"}]}]},"u1","m1"),false);
});

test("team members remain rewardable when they did not appear in the final attack log",()=>{
  const room={
    status:"path_select", result:"win", monsterHP:0, monster:{id:"m1"},
    members:{host:{role:"front"}, teammate:{role:"rear"}},
    log:[{monsterHPAfter:0,playerLog:[{id:"host"}]}],
  };
  assert.equal(isRewardableDungeonRoom(room,"teammate","m1"),true);
});

test("team coordination room preserves teammate reward eligibility after battle advances",()=>{
  const teamRoom={
    members:{host:{},teammate:{}},
    bossRewardBattleId:"boss-room",
    bossRewardMonsterId:"ghost_t1_boss",
    bossRewardEligibleMemberIds:["host","teammate"],
  };
  assert.equal(isRewardableTeamDungeonBossRoom(teamRoom,"boss-room","teammate","ghost_t1_boss"),true);
  assert.equal(isRewardableTeamDungeonBossRoom(teamRoom,"wrong-room","teammate","ghost_t1_boss"),false);
  assert.equal(isRewardableTeamDungeonBossRoom(teamRoom,"boss-room","outsider","ghost_t1_boss"),false);
});

test("material choices create canonical openable family chests",()=>{
  const chests=buildFamilyMaterialChests({claimId:"c",optionId:"o",family:"ghost",tierIndex:3,quantity:2,now:123});
  assert.equal(chests.length,2);
  assert.deepEqual(chests[0],{id:"c:o:0",type:"family_mat",family:"ghost",tierIndex:3,tier:"elite",name:"T3 鬼怪族素材箱",icon:"📦",color:"#a16207",from:"dungeon_boss_choice",ts:123});
});

test("six choices contain the approved T1 reward categories",()=>{
  const reward=buildDungeonBossEnvelope({battleId:"run-2",memberId:"m1",monsterId:"ghost_t1_mini_a"});
  assert.deepEqual(new Set(reward.choiceOptions.map(option=>option.type)),new Set(["largeCoins","largeMaterialChests","bossCard","regularCoins","regularMaterialChests","consolation"]));
  assert.equal(reward.choiceCount,1);
});

test("server rejects normal monsters for boss rewards",()=>{
  assert.throws(()=>buildDungeonBossEnvelope({ battleId:"b",memberId:"m",monsterId:"ghost_t1_normal_a" }),/boss_monster_required/);
});
