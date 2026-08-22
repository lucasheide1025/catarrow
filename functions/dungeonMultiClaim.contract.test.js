"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("solo dungeon multi claim ledger and every grant share one transaction",()=>{
  const source=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
  const start=source.indexOf("exports.claimDungeonMultiSoloReward");
  const end=source.indexOf("exports.claimPartyBattleRewardV2",start);
  const body=source.slice(start,end);
  assert.match(body,/db\.runTransaction/);
  assert.match(body,/claimSnap\.exists/);
  assert.match(body,/tx\.create\(claimRef/);
  assert.match(body,/tx\.set\(chestRef/);
  assert.match(body,/tx\.set\(cardRef/);
  assert.match(body,/tx\.update\(memberRef/);
  assert.match(body,/buildDungeonMultiReward/);
});
