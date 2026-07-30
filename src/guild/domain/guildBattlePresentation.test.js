import {
  GUILD_VICTORY_CONFIRM_MS,
  guildBattleFinalizeDelay,
  retargetPendingShots,
} from "./guildBattlePresentation";

describe("公會戰結束演出", () => {
  test("全部敵人陣亡後保留確認動畫時間", () => {
    expect(guildBattleFinalizeDelay("won", 700)).toBe(700 + GUILD_VICTORY_CONFIRM_MS);
  });

  test("尚未勝利不額外拖慢每回合", () => {
    expect(guildBattleFinalizeDelay("fighting", 700)).toBe(700);
  });

  test("切換鎖定目標會同步改派尚未送出的箭", () => {
    const shots = [
      { targetInstanceId: "old", score: 10 },
      { targetInstanceId: "old", score: 9 },
    ];
    expect(retargetPendingShots(shots, "new")).toEqual([
      { targetInstanceId: "new", score: 10 },
      { targetInstanceId: "new", score: 9 },
    ]);
    expect(shots[0].targetInstanceId).toBe("old");
  });
});
