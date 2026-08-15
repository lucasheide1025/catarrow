import fs from "fs";
import path from "path";

test("自由狩獵結算只顯示權威收據",()=>{
  const solo=fs.readFileSync(path.join(__dirname,"../member/MonsterBattle.jsx"),"utf8");
  const party=fs.readFileSync(path.join(__dirname,"../party/PartyBattleRoom.jsx"),"utf8");
  expect(solo).toContain("<HuntBattleReport");
  expect(solo).toContain("自由狩獵的素材箱／金幣箱／藥水箱由 claimMonsterBattleReward");
  expect(solo).toContain("gradeArcheryPerformance(allArrows");
  expect(party).toContain("<HuntBattleReport");
  expect(party).toContain("gradeArcheryPerformance(myArrowBreakdown");
  expect(party).toContain("畫面在確認前只顯示同步中，不做客戶端預抽");
  expect(party).not.toContain("setPreviewReward(");
  const report=fs.readFileSync(path.join(__dirname,"HuntBattleReport.jsx"),"utf8");
  for(const label of ["總分","平均","命中率","射箭評價","評分"])expect(report).toContain(label);
});
