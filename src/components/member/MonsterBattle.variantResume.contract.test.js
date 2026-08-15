import fs from "fs";
import path from "path";

test("返回同一場自由狩獵時使用怪物快照，不重新抽選強度", () => {
  const source = fs.readFileSync(path.join(__dirname, "MonsterBattle.jsx"), "utf8");
  expect(source).toContain("autoResumeBattle && savedBattle?.huntMonsterId === huntMonsterId && savedBattle?.monster?.id === huntMonsterId");
  expect(source).toContain("setPickedMonster(s.monster)");
  expect(source).toContain("setMonster(s.monster)");
});
