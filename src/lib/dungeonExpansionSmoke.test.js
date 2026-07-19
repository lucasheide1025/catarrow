// 全族系 × 全難度 × 全樓層的整合煙霧測試：確認擴充池與技能引擎在真實 catalog 上不會爆，
// 且中途樓層永遠不會混進小王/大王（母任務 PRD §151-152 的回歸防線）。
import { drawDungeonFloorMonsters } from "./dungeonExpansionMonsters";
import { planDungeonRoundAbility } from "./dungeonAbilityRound";
import { createLockedDungeonBossEncounter } from "./dungeonBossEncounter";

const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"];
const DIFFICULTIES = [1, 2, 3, 4];
const calcCounter = (atk, def) => Math.max(1, atk * 2 - def);

beforeAll(() => window.localStorage.setItem("monsterExpansionV1", "on"));
afterAll(() => window.localStorage.removeItem("monsterExpansionV1"));

describe("地下城擴充接線煙霧測試", () => {
  test("每個族系×難度×樓層都抽得出怪，中途樓層永不出現王", () => {
    for (const family of FAMILIES) {
      for (const difficulty of DIFFICULTIES) {
        const boss = createLockedDungeonBossEncounter({
          runId: `smoke:${family}:${difficulty}`, roomId: "floor-3-boss", family, difficultyTier: difficulty,
        });
        for (const floorIndex of [0, 1, 2]) {
          const floor = drawDungeonFloorMonsters(floorIndex, difficulty, {
            family, fixedBoss: boss.monsterSnapshot,
          });
          expect(floor.monsters.length).toBeGreaterThan(0);
          const midFloorMonsters = [...floor.monsters, ...(floor.elite ? [floor.elite] : [])];
          for (const monster of midFloorMonsters) {
            expect(monster.encounter).toBe("normal");
            expect(monster.hp).toBeGreaterThan(0);
            expect(monster.atk).toBeGreaterThan(0);
          }
          if (floorIndex === 2) expect(["miniBoss", "boss"]).toContain(floor.boss.encounter);
        }
      }
    }
  });

  test("抽到的怪都能跑完技能結算（含王房怪的偶數回合排程）", () => {
    for (const family of FAMILIES) {
      for (const difficulty of DIFFICULTIES) {
        const boss = createLockedDungeonBossEncounter({
          runId: `smoke2:${family}:${difficulty}`, roomId: "floor-3-boss", family, difficultyTier: difficulty,
        });
        const floor = drawDungeonFloorMonsters(2, difficulty, { family, fixedBoss: boss.monsterSnapshot });
        for (const monster of [...floor.monsters, floor.boss]) {
          for (const round of [2, 4, 6, 8]) {
            const plan = planDungeonRoundAbility({
              battleId: `dungeon:smoke:${family}:${difficulty}:${monster.id}`,
              monster, round, monsterAtk: monster.atk, calcCounter,
              participants: [
                { id: "a", role: "front", alive: true, hp: 500, maxHP: 500, def: 20, validSubmission: true, arrows: [8, 7, 9, 8, 6, 10] },
                { id: "b", role: "rear", alive: true, hp: 400, maxHP: 400, def: 15, validSubmission: true, arrows: [5, "M", 7, 8, 8, "X"] },
              ],
            });
            if (!plan) continue;
            expect(plan.resolvedKey).toBeTruthy();
            expect(["full", "major", "partial", "none"]).toContain(plan.breakLevel);
            for (const damage of Object.values(plan.damageByMember)) {
              expect(Number.isFinite(damage)).toBe(true);
              expect(damage).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });
});
