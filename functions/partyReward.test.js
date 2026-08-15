"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{buildPartyReward}=require("./partyReward");

function rewardableRoom(overrides={}){
  return {
    battleInstanceId:"battle-1",status:"completed",result:"win",mode:"student",
    challengeLevel:"standard",challengeProfile:{coinChestChance:.5},
    monster:{id:"ghost_t1_normal_a"},members:{u:{}},
    log:[{playerLog:[{id:"u",arrowBreakdown:[1,2,3]}]}],
    ...overrides,
  };
}

test("party reward grants one chest pair per party member",()=>{
  const reward=buildPartyReward({roomId:"r",battleInstanceId:"battle-1",memberId:"u",room:rewardableRoom()});
  assert.equal(reward.materialTotals.mat_ghost_t1_normal_a,8);
  assert.equal(reward.arrowDew,5);
  assert.equal(reward.archerXP,8);
  assert.deepEqual(reward.chests.map(chest=>chest.type),["family_mat","coin"]);
  assert.equal(reward.cardChance,.3);
});

test("each additional teammate adds one family and one coin chest",()=>{
  const room=rewardableRoom({members:{u:{},mate1:{},mate2:{}}});
  const reward=buildPartyReward({roomId:"r",battleInstanceId:"battle-1",memberId:"u",room});
  assert.equal(reward.chests.filter(chest=>chest.type==="family_mat").length,3);
  assert.equal(reward.chests.filter(chest=>chest.type==="coin").length,3);
});

test("party reward chest rolls are stable for duplicate claim replays",()=>{
  const input={roomId:"r",battleInstanceId:"battle-1",memberId:"u",room:rewardableRoom()};
  assert.deepEqual(buildPartyReward(input).chests,buildPartyReward(input).chests);
});

test("party reward still requires the authoritative battle instance",()=>{
  assert.throws(()=>buildPartyReward({roomId:"r",battleInstanceId:"old",memberId:"u",room:rewardableRoom()}),/invalid/);
});
