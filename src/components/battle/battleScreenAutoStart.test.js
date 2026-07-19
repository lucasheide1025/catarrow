// 迴圈回歸測試（2026-07-18）
// 症狀：地下城一進戰鬥，VS 開場畫面不斷重跳。
// 成因：呼叫端（DungeonBattleRoom）用行內物件字面值傳 monster/difficulty，父層每次 render 都是新參考，
//       handleStartBattle 的身分跟著變 → 自動開場 effect 每次 render 都重跑 → dispatch START 把 phase 打回 INTRO。
// 修法：以怪物 id 當閘門，換怪才重新開場（BattleScreen 的 autoStartedForRef）。
// 本測試不掛 React（專案無 @testing-library/react），只鎖住閘門的判斷邏輯。

// 與 BattleScreen 內 autoStart effect 相同的判斷
function runAutoStartEffect(ref, { autoStart, initialBattleSnapshot, monsterId }, onStart) {
  if (!autoStart || initialBattleSnapshot) return;
  const key = monsterId ?? "default";
  if (ref.current === key) return;
  ref.current = key;
  onStart();
}

describe("BattleScreen 自動開場閘門", () => {
  test("父層重複 render 只開場一次（VS 畫面不會狂跳）", () => {
    const ref = { current: null };
    let starts = 0;
    for (let render = 0; render < 30; render += 1) {
      runAutoStartEffect(ref, { autoStart: true, initialBattleSnapshot: null, monsterId: "ghost_t2_normal_c" }, () => { starts += 1; });
    }
    expect(starts).toBe(1);
  });

  test("換怪時重新開場", () => {
    const ref = { current: null };
    let starts = 0;
    const tick = monsterId => runAutoStartEffect(ref, { autoStart: true, initialBattleSnapshot: null, monsterId }, () => { starts += 1; });
    tick("ghost_t2_normal_c");
    tick("ghost_t2_normal_c");
    expect(starts).toBe(1);
    tick("exam_t3_boss");
    expect(starts).toBe(2);
  });

  test("有還原快照時不自動開場（續戰不重來）", () => {
    const ref = { current: null };
    let starts = 0;
    runAutoStartEffect(ref, { autoStart: true, initialBattleSnapshot: { battle: {} }, monsterId: "ghost_t2_normal_c" }, () => { starts += 1; });
    expect(starts).toBe(0);
  });

  test("autoStart 關閉時不開場", () => {
    const ref = { current: null };
    let starts = 0;
    runAutoStartEffect(ref, { autoStart: false, initialBattleSnapshot: null, monsterId: "ghost_t2_normal_c" }, () => { starts += 1; });
    expect(starts).toBe(0);
  });
});
