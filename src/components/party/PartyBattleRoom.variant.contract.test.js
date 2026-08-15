import fs from "fs";
import path from "path";

test("自由狩獵組隊優先使用房主已抽出的怪物快照", () => {
  const source = fs.readFileSync(path.join(__dirname, "PartyBattleRoom.jsx"), "utf8");
  expect(source).toContain("room?.monsterSnapshot || room?.monster || getFreeHuntBattleMonster");
});
