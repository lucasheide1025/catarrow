import { aggregateRewardChests, resolveSoloBattlePlayer, resolveSoloCatProfile, shouldFinishSoloPresentation } from "./multiMonsterSoloView";

test("free-hunt solo keeps calculated level and card totals", () => {
  expect(resolveSoloBattlePlayer({
    calculated:{ hp:640, atk:88, def:47 },
    playerStats:{ hp:200, maxHp:200, atk:15, def:10 },
    carryOver:false,
  })).toEqual({ maxHp:640, hp:640, atk:88, def:47 });
});

test("dungeon carry-over preserves current HP while retaining locked totals", () => {
  expect(resolveSoloBattlePlayer({
    calculated:{ hp:640, atk:88, def:47 },
    playerStats:{ hp:123, maxHp:640, atk:90, def:50 },
    carryOver:true,
  })).toEqual({ maxHp:640, hp:123, atk:90, def:50 });
});

test("equipped cat uses the live cats collection bond snapshot", () => {
  const profile={ equippedCat:{ catId:"diandian", name:"點點", bond:1 } };
  const result=resolveSoloCatProfile(profile,[{ catId:"diandian", name:"點點", bond:76, catXP:90 }]);
  expect(result.equippedCat.bond).toBe(76);
  expect(result.equippedCat.catXP).toBe(90);
});

test("identical reward chests collapse into one quantity row", () => {
  const rows=aggregateRewardChests([
    { id:"a", type:"family_mat", family:"ghost", tierIndex:1, name:"T1 系素材箱" },
    { id:"b", type:"coin", tier:"common", name:"common 金幣寶箱" },
    { id:"c", type:"family_mat", family:"ghost", tierIndex:1, name:"T1 系素材箱" },
    { id:"d", type:"family_mat", family:"ghost", tierIndex:1, name:"T1 系素材箱" },
    { id:"e", type:"coin", tier:"common", name:"common 金幣寶箱" },
  ]);
  expect(rows.map(row=>[row.name,row.quantity])).toEqual([
    ["T1 系素材箱",3], ["common 金幣寶箱",2],
  ]);
});

test("winning presentation ends immediately after the last living monster death", () => {
  expect(shouldFinishSoloPresentation({result:"win",eventType:"multi_monster_killed",killedCount:3,livingEnemyCount:3})).toBe(true);
  expect(shouldFinishSoloPresentation({result:"win",eventType:"multi_monster_killed",killedCount:2,livingEnemyCount:3})).toBe(false);
});
