import fs from "fs";
import path from "path";

function source(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

describe("Visitor Arcade solo battle presentation contracts", () => {
  test("player HUD uses visitor nickname and keeps the cat as companion text", () => {
    const text = source("ArcadeAdventure.jsx");
    expect(text).toContain('arcade-raid-playerbar-name">🏹 {profile.nickname}');
    expect(text).toContain('arcade-fighter-name">🏹 {profile.nickname}');
    expect(text).toContain("同行：{cat.name}");
  });

  test("boss battle skips the generic monster battle intro", () => {
    const text = source("ArcadeAdventure.jsx");
    expect(text).toContain('if (phase !== "battle" || isBossFight || monster.ability === "boss") return undefined;');
    expect(text).toContain('playBattleSound("battle_intro"');
  });

  test("six arrows are presented sequentially while resolveRound remains authoritative once", () => {
    const text = source("ArcadeAdventure.jsx");
    const attack = text.slice(text.indexOf("function attack()"), text.indexOf("function afterVictory", text.indexOf("function attack()")));
    expect(attack).toContain("const arrowPresentation = [];");
    expect(attack).toContain("arrows.forEach((arrow, index) =>");
    expect(attack).toContain("...arrowPresentation");
    expect(attack.match(/resolveRound\(/g)).toHaveLength(1);
    expect(text).toContain("第 {shotFx.index + 1} 箭");
  });

  test("boss target is opened from a button into a full-screen overlay", () => {
    const text = source("ArcadeAdventure.jsx");
    const css = source("ArcadeApp.jsx");
    expect(text).toContain("const [targetOpen, setTargetOpen] = useState(false)");
    expect(text).toContain('className="arcade-target-overlay"');
    expect(text).toContain('onClick={() => setTargetOpen(true)}>🎯 輸入分數');
    expect(css).toContain(".arcade-target-overlay{position:fixed;inset:0");
  });

  test("lethal hit uses the formal knockdown overlay before settlement", () => {
    const text = source("ArcadeAdventure.jsx");
    const css = source("ArcadeApp.jsx");
    expect(text).toContain("arcade-knockdown-overlay");
    expect(text).toContain('className="arcade-knockdown-stamp">擊倒');
    expect(text).toContain("[3000, () => {");
    expect(css).toContain(".arcade-knockdown-stamp{");
  });
});
