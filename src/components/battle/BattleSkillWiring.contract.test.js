import fs from "fs";
import path from "path";

const read=relative=>fs.readFileSync(path.join(__dirname,relative),"utf8");

describe("新版玩家與貓咪技能入口",()=>{
  test("BattleScreen only uses the new cat archetype and engine",()=>{
    const source=read("BattleScreen.jsx");
    expect(source).toContain("getCatBattleArchetype");
    expect(source).toContain("resolveCatRound");
    expect(source).not.toContain("calcCatSkillChance");
    expect(source).not.toContain("calcCatSkillEffect");
    expect(source).not.toContain("CAT_SKILL_GROUPS");
  });

  test("MonsterBattle passes the real equipped cat progression",()=>{
    const source=read("../member/MonsterBattle.jsx");
    expect(source).toContain("type: equippedCat?.type");
    expect(source).toContain("catXP: equippedCat?.catXP || 0");
    expect(source).toContain("bond: equippedCat?.bond || 0");
    expect(source).not.toContain('type: "allround", catXP: 0, bond: 0');
  });

  test("shared cat hook no longer exports the obsolete random-arrow skill path",()=>{
    const source=read("../../hooks/useCatCompanion.js");
    expect(source).not.toContain("calcCatRoundDamage");
    expect(source).not.toContain("triggerCatSkill");
    expect(source).not.toContain("calcCatSkillChance");
    expect(source).not.toContain("calcCatSkillEffect");
  });

  test("player cards and specialization remain wired into battle",()=>{
    const source=read("BattleScreen.jsx");
    expect(source).toContain("cardFx");
    expect(source).toContain("equipSpec");
    expect(source).toContain("firstStrikePct");
    expect(source).toContain("openingShieldPct");
    expect(source).toContain("rollInflict");
  });
});
