import { getCatBattlePresentationType } from "./catBattlePresentation";

test("貓咪戰鬥職能正確對應演出類型", () => {
  expect(getCatBattlePresentationType("heal")).toBe("heal");
  expect(getCatBattlePresentationType("attack")).toBe("atk");
  expect(getCatBattlePresentationType("defense")).toBe("def");
});
