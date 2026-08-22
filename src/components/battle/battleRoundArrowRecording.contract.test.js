import fs from "fs";
import path from "path";
const read=rel=>fs.readFileSync(path.join(__dirname,rel),"utf8");

test.each([
  ["solo free hunt","BattleScreen.jsx"],
  ["party free hunt","../party/PartyBattleRoom.jsx"],
  ["solo multi monster","MultiMonsterBattle.jsx"],
  ["party multi monster","MultiMonsterPartyRoom.jsx"],
  ["world boss","../worldboss/WorldBossAttack.jsx"],
])("%s uses the shared idempotent authoritative-round recorder",(_name,file)=>{
  const source=read(file);
  expect(source).toContain("recordBattleRoundArrows");
  expect(source).toContain("battleId:");
  expect(source).toContain("round:");
  expect(source).toContain("count:");
});

test("legacy direct counter is absent from all five battle submission paths",()=>{
  for(const file of ["BattleScreen.jsx","../party/PartyBattleRoom.jsx","MultiMonsterBattle.jsx","MultiMonsterPartyRoom.jsx","../worldboss/WorldBossAttack.jsx"]){
    expect(read(file)).not.toContain("addRoundArrows(");
  }
});

test("world boss records each resolved round immediately and uses the resumable sortie id",()=>{
  const source=read("../worldboss/WorldBossAttack.jsx");
  const roundCommit=source.indexOf("const physicalArrowCount");
  const finalSubmit=source.indexOf("async function submitAttack");
  expect(roundCommit).toBeGreaterThan(-1);
  expect(finalSubmit).toBeGreaterThan(-1);
  expect(source.slice(roundCommit,roundCommit+700)).toContain("battleId:sortieId");
  expect(source.slice(roundCommit,roundCommit+700)).toContain("!arrow?.consumableId");
  expect(source.match(/recordBattleRoundArrows/g)).toHaveLength(2); // import + one round commit
});
