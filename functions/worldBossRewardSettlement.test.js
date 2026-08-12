"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {materialChest,coinChest,mergeNumeric}=require("./worldBossRewardSnapshot");

test("stable reward inventory entries are identical on retry",()=>{
  const args={id:"claim_mat_0",range:[3,5],family:null,seed:"event:member:claim:0",from:"世界王"};
  const a=materialChest(args),b=materialChest(args),c=coinChest({...args,id:"claim_coin_0"}),d=coinChest({...args,id:"claim_coin_0"});delete a.ts;delete b.ts;delete c.ts;delete d.ts;
  assert.deepEqual(a,b);assert.deepEqual(c,d);
});

test("rank and last-hit numeric rewards add instead of replacing each other",()=>{
  assert.deepEqual(mergeNumeric({arrowDew:200,materialChests:30},{arrowDew:150,materialChests:5}),{arrowDew:350,materialChests:35});
});

test("both v2 claims persist inventory and marker inside one Firestore transaction",()=>{
  const source=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
  for(const name of ["claimWorldBossParticipationV2","claimWorldBossKillRewardV2"]){
    const start=source.indexOf(`exports.${name}`),end=source.indexOf("exports.",start+10),body=source.slice(start,end<0?source.length:end);
    assert.match(body,/runTransaction/);assert.match(body,/claimSnap\.exists/);assert.match(body,/tx\.create\(claimRef/);assert.match(body,/tx\.set\(memberRef/);
  }
});

test("participation claim records completion atomically for reconnect recovery",()=>{
  const source=fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),start=source.indexOf("exports.claimWorldBossParticipationV2"),end=source.indexOf("exports.claimWorldBossKillRewardV2"),body=source.slice(start,end);
  assert.match(body,/participationRewardClaimedAt/);assert.match(body,/tx\.create\(claimRef/);assert.match(body,/tx\.update\(eventRef/);
  const client=fs.readFileSync(path.join(__dirname,"..","src","lib","worldBossDb.js"),"utf8");assert.match(client,/recoveredParticipation:true,dmg:0/);
});
