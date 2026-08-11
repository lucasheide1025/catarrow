import { resolveGoalDisplay } from "./villageGoalData";

test("擊殺目標顯示明確活動與數量", () => {
  const display = resolveGoalDisplay({ goalType: "monster_kills", targetValue: 20 });
  expect(display.title).toContain("擊殺");
  expect(display.title).toContain("20");
});

test("舊 board_laps 文件顯示為完成貓咪探險地圖", () => {
  const display = resolveGoalDisplay({ goalType: "board_laps", targetValue: 30 });
  expect(display.goalType).toBe("exploration_completions");
  expect(display.title).toContain("探險");
});

test("自訂文案仍優先", () => {
  expect(resolveGoalDisplay({ goalType: "monster_kills", targetValue: 20, customTitle: "特別任務" }).title).toBe("特別任務");
});
