import fs from "fs";
import path from "path";

function source(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Arcade shared presentation safety contracts", () => {
  test("BattleScreen external visitor mode can isolate student progression and keeps target coordinates", () => {
    const src = source("src/components/battle/BattleScreen.jsx");
    expect(src).toContain("isolateStudentProgression=false");
    expect(src).toMatch(/if \(isolateStudentProgression\) \{ setCardFx\(null\); return undefined; \}/);
    expect(src).toMatch(/if \(isolateStudentProgression\) \{ setEquipSpec\(null\); return undefined; \}/);
    expect(src).toContain("previewDamage:!(partyMode||externalBattle)");
    expect(src).toContain("nx:landing?.nx??null");
    expect(src).toContain("ny:landing?.ny??null");
  });

  test("DungeonChest localMode returns before student DB writers", () => {
    const src = source("src/components/dungeon/DungeonChest.jsx");
    const localIndex = src.indexOf("if (localMode) {");
    const studentWriter = src.indexOf('await import("../../lib/db")');
    expect(localIndex).toBeGreaterThanOrEqual(0);
    expect(studentWriter).toBeGreaterThan(localIndex);
    const localBranch = src.slice(localIndex, studentWriter);
    expect(localBranch).toContain("onLocalEffect");
    expect(localBranch).toContain("return;");
  });
});
