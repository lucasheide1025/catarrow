"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTrustedMonsterReward } = require("./monsterReward");

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

test("new monster reward keeps its expansion material and card ids", () => {
  const reward = buildTrustedMonsterReward({ battleId:"rock_2", memberId:"m1", monsterId:"mountain_t2_normal_b", rewardType:"solo_hunt", mode:"novice", challengeLevel:"hard" });
  assert.deepEqual(reward.materialTotals, { mat_mountain_t2_normal_b:7 });
  assert.equal(reward.card?.monsterId, "mountain_t2_normal_b");
  assert.equal(reward.card?.name, "岩甲山衛");
});
