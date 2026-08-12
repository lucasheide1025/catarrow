"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {WORLD_BOSS_CATALOG}=require("./worldBossCatalog");
test("server spawn catalog contains all 26 fixed bosses including both treasure bosses",()=>{assert.equal(Object.keys(WORLD_BOSS_CATALOG).length,26);assert.deepEqual(WORLD_BOSS_CATALOG.treasure_boss_small,{...WORLD_BOSS_CATALOG.treasure_boss_small,name:"鎏金寶匣獸",family:"treasure",familyTier:"small",hp:96000,atk:52,def:50});assert.equal(WORLD_BOSS_CATALOG.treasure_boss.name,"萬寶藏王");});
test("server catalog preserves strict fixed HP order",()=>{assert.ok(WORLD_BOSS_CATALOG.head_coach.hp>WORLD_BOSS_CATALOG.cat_haji.hp);assert.ok(WORLD_BOSS_CATALOG.cat_haji.hp>WORLD_BOSS_CATALOG.ghost_boss.hp);assert.ok(WORLD_BOSS_CATALOG.ghost_boss.hp>WORLD_BOSS_CATALOG.ghost_boss_small.hp);});
