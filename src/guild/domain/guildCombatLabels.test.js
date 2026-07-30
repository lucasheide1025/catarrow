import { attackRangeLabel, counterConditionLabel } from "./guildCombatLabels";

describe("怪物戰場情報文字", () => {
  test("射程 0 顯示為近戰而不是裸數字", () => {
    expect(attackRangeLabel(0)).toBe("近戰（貼身）");
    expect(attackRangeLabel(3)).toBe("3 格");
  });

  test("技能預告顯示四種破解條件", () => {
    expect(counterConditionLabel({ type:"minScore", threshold:8 })).toBe("任一箭至少 8 分");
    expect(counterConditionLabel({ type:"totalScore", threshold:20 })).toBe("本回合累積 20 分");
    expect(counterConditionLabel({ type:"defeatCaster" })).toBe("本回合擊倒施法者");
    expect(counterConditionLabel({
      type:"exactRing",
      exactRing:3,
      exactRings:{ half_610:7 },
    }, "half_610")).toBe("命中指定 7 分環");
  });
});
