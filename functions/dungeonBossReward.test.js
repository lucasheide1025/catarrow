"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const { buildDungeonBossEnvelope, validateChoices }=require("./dungeonBossReward");

test("server builds deterministic boss envelopes with valid choices",()=>{
  const input={ battleId:"run-1", memberId:"m1", monsterId:"ghost_t1_boss", firstDefeat:true, cardMisses:0 };
  const a=buildDungeonBossEnvelope(input); const b=buildDungeonBossEnvelope(input);
  assert.deepEqual(a,b); assert.equal(a.cardResult.dropped,true); assert.equal(a.choiceCount,2);
  assert.equal(validateChoices(a,a.choiceOptions.slice(0,2).map(option=>option.id)),true);
});

test("server rejects normal monsters for boss rewards",()=>{
  assert.throws(()=>buildDungeonBossEnvelope({ battleId:"b",memberId:"m",monsterId:"ghost_t1_normal_a" }),/boss_monster_required/);
});
