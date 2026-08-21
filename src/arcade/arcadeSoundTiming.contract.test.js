import fs from "fs";
import path from "path";

function source(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

describe("Visitor Arcade sound timing contracts", () => {
  test("score keypad gives immediate tap feedback after a valid pick", () => {
    const text = source("ArcadeArrowInput.jsx");
    expect(text).toMatch(/function pick\(v\)[\s\S]*onChange\(i, v\);\s*sfxTap\(\);/);
  });

  test("boss target only taps after a valid commit", () => {
    const text = source("ArcadeTarget.jsx");
    expect(text).toMatch(/function commit\(px, py\)[\s\S]*if \(full \|\| disabled\) return;[\s\S]*onArrow\([^;]+;\s*sfxTap\(\);/);
  });

  test("battle victory uses one presentation fanfare, not a second raw victory sound", () => {
    const solo = source("ArcadeAdventure.jsx");
    const team = source("ArcadeTeam.jsx");
    expect(solo).toContain('playBattleSound("monster_death"');
    expect(solo).toContain('playBattleSound("victory_fanfare"');
    expect(solo).not.toContain("sfxVictory");
    expect(team).toContain('playBattleSound("monster_death"');
    expect(team).toContain('playBattleSound("victory_fanfare"');
    expect(team).not.toContain("sfxVictory");
  });

  test("team submit confirms success instead of pretending a coin reward happened", () => {
    const team = source("ArcadeTeam.jsx");
    expect(team).toContain("sfxSuccess();");
    expect(team).not.toContain("sfxCoinDrop");
  });

  test("boss roar is delayed to the skill-name presentation beat", () => {
    expect(source("ArcadeAdventure.jsx")).toContain("setTimeout(() => sfxBossUlt(), 750)");
    expect(source("ArcadeTeam.jsx")).toContain("setTimeout(() => sfxBossUlt(), 750)");
  });
});
