const test=require('node:test');
const assert=require('node:assert/strict');
const {CATEGORIES,buildWorldBossRewardSnapshot,rewardCategoryForBoss,validateWorldBossRewardSnapshot,largestRemainderAllocation}=require('./worldBossRewardSnapshot');

test('v2 snapshot rolls every approved field independently and validates all categories',()=>{
  for(const category of Object.keys(CATEGORIES)){
    let n=0;const random=()=>((n++%10)+0.25)/11;
    const snapshot=buildWorldBossRewardSnapshot({category,bossFamily:'forest',generatedAt:123,random});
    assert.equal(snapshot.version,2);assert.equal(snapshot.generatedAt,123);assert.equal(validateWorldBossRewardSnapshot(snapshot),true);
    assert.ok(new Set([snapshot.participation.coins,snapshot.participation.arrowDew,snapshot.participation.archerXP]).size>1);
    assert.equal(n,Object.keys(CATEGORIES[category].participation).length+Object.keys(CATEGORIES[category].kill).length+Object.keys(CATEGORIES[category].effortPool).length);
  }
  assert.equal(buildWorldBossRewardSnapshot({category:'family_small',bossFamily:'forest',random:()=>0}).kill.materialFamily,'mountain');
});

test('separate spawns consume fresh randomness while one snapshot remains immutable data',()=>{
  const low=buildWorldBossRewardSnapshot({category:'family_small',random:()=>0});
  const high=buildWorldBossRewardSnapshot({category:'family_small',random:()=>0.999999});
  assert.notDeepEqual(low,high);assert.equal(low.participation.coins,80);assert.equal(high.participation.coins,120);
});

test('manual and lifecycle templates resolve the same category, including legacy small boss data',()=>{
  assert.equal(rewardCategoryForBoss({bossKey:'ghost_boss_small',bossData:{family:'ghost'}}),'family_small');
  assert.equal(rewardCategoryForBoss({bossKey:'ghost_boss',bossData:{family:'ghost',familyTier:'big'}}),'family_big');
  assert.equal(rewardCategoryForBoss({bossKey:'cat_haji',bossData:{family:'cat'}}),'cat');
  assert.equal(rewardCategoryForBoss({bossKey:'head_coach',bossData:{family:'coach'}}),'coach');
});

test('effort pool allocation conserves every approved doubled pool field',()=>{
  const pool={coins:2001,arrowDew:401,archerXP:1601,catXP:501,bond:61};
  const allocation=largestRemainderAllocation(pool,{a:{totalDmg:100,sessions:[{}]},b:{totalDmg:400,sessions:[{},{}]},guest:{totalDmg:999,isGuest:true}});
  for(const field of Object.keys(pool))assert.equal(Object.values(allocation).reduce((sum,reward)=>sum+reward[field],0),pool[field]);
  assert.equal(allocation.guest,undefined);
});

test('honor boxes stack and keep last hit as an extra',()=>{
  const snapshot=buildWorldBossRewardSnapshot({category:'coach',random:()=>0});
  assert.equal(snapshot.honor.rank1.materialChests,30);assert.equal(snapshot.honor.rank1.coinChests,30);assert.equal(snapshot.honor.rank1.catBoxes,1);
  assert.equal(snapshot.honor.rank2.materialChests,20);assert.equal(snapshot.honor.rank2.coinChests,20);assert.equal(snapshot.honor.rank2.catBoxes,0);
  assert.equal(snapshot.honor.rank3.materialChests,10);assert.equal(snapshot.honor.lastHit.materialChests,5);assert.equal(snapshot.honor.lastHit.catBoxes,1);
});
