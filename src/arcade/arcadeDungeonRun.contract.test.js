import fs from "fs";
import path from "path";

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("Visitor Arcade shared dungeon architecture contract", () => {
  const run = read("src/arcade/ArcadeDungeonRun.jsx");
  const adapter = read("src/arcade/ArcadeBattleScreenAdapter.jsx");
  const app = read("src/arcade/ArcadeApp.jsx");
  const stages = read("src/components/dungeon/DungeonStages.jsx");
  const battle = read("src/components/battle/BattleScreen.jsx");

  test("reuses shared dungeon stages and all five localMode rooms", () => {
    expect(run).toContain("GridMapStage");
    expect(run).toContain("BranchStage");
    for (const component of ["DungeonShop", "DungeonTrap", "DungeonEvent", "DungeonChest", "DungeonRest"]) {
      expect(run).toContain(component);
    }
    expect((run.match(/localMode/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(run).toContain("ArcadeBattleScreenAdapter");
  });

  test("controller persists local runtime and settles permanent profile only through Arcade settlement", () => {
    expect(run).toContain("updateAdventureSession");
    expect(run).toContain("applyArcadeSettlement");
    expect(run).toContain("buildArcadeDungeonSettlement");
    expect(run).not.toMatch(/from\s+["'][^"']*(?:dungeonDb|expeditionTeamDb|\/db)[^"']*["']/);
    expect(run).not.toMatch(/\b(?:setDoc|updateDoc|addDoc|runTransaction)\s*\(/);
  });

  test("adapts persisted visited id arrays to the Set contract required by GridMapStage", () => {
    expect(run).toContain("const visitedIdSet = useMemo(");
    expect(run).toContain("new Set(Array.isArray(runtime.visitedIds) ? runtime.visitedIds : [])");
    expect(run).toContain("visitedIds={visitedIdSet}");
    expect(run).not.toContain("visitedIds={runtime.visitedIds}");
  });

  test("ArcadeApp primary solo journey uses ArcadeDungeonRun and passes the resumable session", () => {
    expect(app).toContain('lazy(() => import("./ArcadeDungeonRun"))');
    expect(app).toContain("<ArcadeDungeonRun");
    expect(app).toContain("session={adventureSession}");
    expect(app).toContain("preserveSession");
  });

  test("BattleScreen is presentation only for Arcade combat", () => {
    expect(adapter).toContain("resolveRound");
    expect(adapter).toContain("isolateStudentProgression");
    expect(adapter).toContain("hideLeaveControl");
    expect(adapter).toContain("externalBattle");
    expect(adapter).toContain("targetRing={ring}");
    expect(adapter).not.toMatch(/<BattleScreen[\s\S]*?\bcat=\{/);
  });

  test("shared presentation switches are opt-in and keep student defaults", () => {
    expect(stages).toContain("showSaveAndLeave = true");
    expect(stages).toContain("showRetreat = true");
    expect(battle).toContain("hideLeaveControl=false");
  });
});
