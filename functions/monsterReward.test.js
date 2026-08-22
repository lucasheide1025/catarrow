"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTrustedMonsterReward, buildTrustedMultiMonsterReward } = require("./monsterReward");

test("server reward ignores client-provided amounts and is deterministic", () => {
  const input = { battleId:"monster_m1_123", memberId:"m1", monsterId:"ghost_t1_normal_a", rewardType:"solo_hunt", mode:"student", coins:999999, materials:[{ id:"fake", quantity:9999 }] };
  const first = buildTrustedMonsterReward(input);
  const second = buildTrustedMonsterReward(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.materialTotals, { mat_ghost_t1_normal_a:5 });
  assert.ok(first.coins >= 6 && first.coins <= 16);
});

test("server rejects unknown monsters and reward types", () => {
  assert.throws(() => buildTrustedMonsterReward({ battleId:"b", memberId:"m", monsterId:"fake", rewardType:"solo_hunt" }), /monster_not_rewardable/);
  assert.throws(() => buildTrustedMonsterReward({ battleId:"b", memberId:"m", monsterId:"ghost_t1_normal_a", rewardType:"admin_grant" }), /invalid_reward_type/);
});

test("solo challenge controls trusted material quantity", () => {
  const base = { battleId:"challenge_battle", memberId:"m1", monsterId:"mountain_t2_normal_b", rewardType:"solo_hunt", mode:"novice" };
  assert.deepEqual(buildTrustedMonsterReward({ ...base, challengeLevel:"easy" }).materialTotals, { mat_mountain_t2_normal_b:3 });
  assert.deepEqual(buildTrustedMonsterReward({ ...base, challengeLevel:"standard" }).materialTotals, { mat_mountain_t2_normal_b:5 });
  assert.deepEqual(buildTrustedMonsterReward({ ...base, challengeLevel:"hard" }).materialTotals, { mat_mountain_t2_normal_b:7 });
  assert.throws(() => buildTrustedMonsterReward({ ...base, challengeLevel:"fake" }), /invalid_challenge_level/);
});

test("solo reward chests are deterministic and include one material chest",()=>{
  const input={battleId:"chest_battle",memberId:"m1",monsterId:"ghost_t1_normal_a",rewardType:"solo_hunt",mode:"student",challengeLevel:"standard"};
  const first=buildTrustedMonsterReward(input),second=buildTrustedMonsterReward(input);
  assert.deepEqual(first.chests,second.chests);
  assert.equal(first.chests.filter(chest=>chest.type==="family_mat").length,1);
});

test("new monster reward keeps its expansion material and card ids", () => {
  const reward = buildTrustedMonsterReward({ battleId:"rock_2", memberId:"m1", monsterId:"mountain_t2_normal_b", rewardType:"solo_hunt", mode:"novice", challengeLevel:"hard" });
  assert.deepEqual(reward.materialTotals, { mat_mountain_t2_normal_b:7 });
  assert.equal(reward.card?.monsterId, "mountain_t2_normal_b");
  assert.equal(reward.card?.name, "岩甲山衛");
});

test("generic callable rejects mode-specific reward identities",()=>{
  const base={battleId:"policy",memberId:"m1",monsterId:"ghost_t1_normal_a"};
  for(const rewardType of ["team_hunt","guild_hunt","dungeon_normal"]){assert.throws(()=>buildTrustedMonsterReward({...base,rewardType}),/invalid_reward_type/);}
});


test("multi monster reward is one deterministic server-derived envelope", () => {
  const input={battleId:"multi_battle_1",memberId:"m1",family:"ghost",tierIndex:1,monsterIds:["ghost_t1_normal_a","ghost_1","ghost_t1_normal_b"],mode:"student",challengeLevel:"standard",coins:999999};
  const first=buildTrustedMultiMonsterReward(input),second=buildTrustedMultiMonsterReward(input);
  assert.deepEqual(first,second);
  assert.equal(first.archerXP,15);
  assert.equal(first.coins < 999999,true);
  assert.equal(first.chests.filter(chest=>chest.type==="family_mat").length,3);
  assert.deepEqual(Object.values(first.materialTotals),[5,5,5]);
});

test("multi monster reward rejects reordered or forged encounter monsters", () => {
  const base={battleId:"multi_battle_2",memberId:"m1",family:"ghost",tierIndex:1,mode:"student",challengeLevel:"standard"};
  assert.throws(()=>buildTrustedMultiMonsterReward({...base,monsterIds:["ghost_1","ghost_t1_normal_a","ghost_t1_normal_b"]}),/multi_monster_set_mismatch/);
  assert.throws(()=>buildTrustedMultiMonsterReward({...base,monsterIds:["ghost_t1_normal_a","ghost_1","fake"]}),/multi_monster_set_mismatch/);
});
