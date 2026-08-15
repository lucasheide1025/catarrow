import fs from "fs";
import path from "path";

describe("BattleScreen presentation cleanup contract", () => {
  const source = fs.readFileSync(path.join(__dirname, "BattleScreen.jsx"), "utf8");

  test("單人技能特效計時器被取消時會立即清除特效", () => {
    expect(source).toContain("return () => { clearTimeout(t); setSkillFx(null); };");
    expect(source).not.toContain("return () => { clearTimeout(timer); setSkillFx(null); };");
  });

  test("組隊演出被新回合取代時會清除所有蓋版狀態", () => {
    expect(source).toContain(
      "return()=>{cancelled=true;setPartyAction(null);setPartyPhase(null);setSkillFx(null);};"
    );
  });

  test("玩家加成改由按鈕開啟，不再以右上角常駐 chips 遮住怪物", () => {
    expect(source).toContain('data-battle-bonus-trigger="true"');
    expect(source).toContain("<BattleBonusSheet");
    expect(source).not.toContain('maxWidth:"44%",display:"flex",flexWrap:"wrap"');
  });

  test("貓咪職能先轉成動畫支援的 atk heal def 鍵", () => {
    expect(source).toContain("getCatBattlePresentationType(getCatBattleArchetype(catId).type)");
  });

  test("中央演示訊息依序播放，不在射箭期間重疊", () => {
    expect(source).toContain("catMsg&&isProcessing&&animStep===7&&!skillFx");
    expect(source).toContain("skillFx&&!partyMode&&isRoundRes");
    expect(source).toContain("!reso || partyMode || battle.phase !== PHASE.ROUND_RES");
  });

  test("組隊怪物技能只交給 partyPhase 序列，不另開即時 skillFx", () => {
    expect(source).toContain("void info;");
    expect(source).not.toContain("setSkillFx(info)");
  });

  test("護盾全吸收仍播放怪物攻擊，並有獨立回合效果演出", () => {
    expect(source).toContain("battle.pendingCounter>0||battle.shieldAbsorbed>0");
    expect(source).toContain('data-battle-presentation-message="round-effects"');
  });
});
