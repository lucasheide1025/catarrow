"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { collectFiles, normalizeConfig, deployDirectory } = require("./competitionWebsitePublisher");

test("collectFiles uses slash paths and sha1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-test-"));
  fs.mkdirSync(path.join(dir,"a")); fs.writeFileSync(path.join(dir,"a","x.txt"),"hello");
  const rows = collectFiles(dir); assert.equal(rows.length,1); assert.equal(rows[0].file,"a/x.txt"); assert.equal(rows[0].sha.length,40); assert.equal(rows[0].size,5);
});

test("normalizeConfig never accepts incomplete secret", () => {
  assert.throws(()=>normalizeConfig("{}"));
  assert.deepEqual(normalizeConfig('{"token":"t","teamId":"team_1","projectName":"catarrow-archery"}'),{token:"t",teamId:"team_1",projectName:"catarrow-archery"});
});

test("deployDirectory uploads digests then creates production deployment", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-test-")); fs.writeFileSync(path.join(dir,"index.html"),"ok");
  const calls=[];
  const fakeFetch=async(url,opts)=>{ calls.push({url,opts}); const isDeploy=url.includes("deployments"); return {ok:true,status:200,text:async()=>JSON.stringify(isDeploy?{id:"d1",url:"demo.vercel.app",readyState:"QUEUED"}:{})}; };
  const result=await deployDirectory(dir,{token:"secret",teamId:"team_1",projectName:"catarrow-archery"},fakeFetch,1);
  assert.equal(result.id,"d1"); assert.equal(calls.length,2); assert.match(calls[0].url,/\/v2\/now\/files/); assert.match(calls[1].url,/\/v12\/now\/deployments/); assert.equal(JSON.parse(calls[1].opts.body).target,"production"); assert.ok(!calls[1].opts.body.includes("secret"));
});
