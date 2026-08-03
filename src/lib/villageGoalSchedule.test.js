import {
  SCHEDULE_LIMITS, VILLAGE_GOAL_SCHEDULE_DEFAULTS, canAutoSpawn, describeSchedule,
  goalDurationHours, goalEndAtMs, normalizeGoalSchedule,
} from "./villageGoalSchedule";

const H = 3600000;

describe("時間要跟著目標值一起長", () => {
  test("⚠️ 目標值 tier0→tier3 成長 16 倍，時間不能一律 24 小時", () => {
    // 這就是作者回報「自然刷出的完成時間太短」的根因
    expect(goalDurationHours(3)).toBeGreaterThan(goalDurationHours(0));
    expect(goalDurationHours(0)).toBeGreaterThan(24);
  });

  test("每高一階就多給一段時間，單調遞增", () => {
    const hours = [0, 1, 2, 3].map(t => goalDurationHours(t));
    for (let i = 1; i < hours.length; i += 1) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
  });

  test("預設是 3/4/5/6 天", () => {
    expect(describeSchedule().map(r => r.days)).toEqual([3, 4, 5, 6]);
  });

  test("階級超出範圍會被夾住，不會算出爆炸的時間", () => {
    expect(goalDurationHours(99)).toBe(goalDurationHours(3));
    expect(goalDurationHours(-5)).toBe(goalDurationHours(0));
  });

  test("結束時間 = 現在 + 時數", () => {
    expect(goalEndAtMs(0, null, 0)).toBe(VILLAGE_GOAL_SCHEDULE_DEFAULTS.baseHours * H);
  });
});

describe("設定正規化", () => {
  test("教練可以自己調", () => {
    expect(goalDurationHours(0, { baseHours: 168 })).toBe(168);
    expect(goalDurationHours(2, { baseHours: 48, perTierHours: 12 })).toBe(72);
  });

  test("⚠️ 壞值一律退回預設，絕不回 NaN——村目標算錯時間會整個系統卡住", () => {
    for (const bad of [null, undefined, {}, { baseHours: "亂填" }, { baseHours: NaN }]) {
      const cfg = normalizeGoalSchedule(bad);
      for (const v of Object.values(cfg)) expect(Number.isFinite(v)).toBe(true);
      expect(cfg.baseHours).toBe(VILLAGE_GOAL_SCHEDULE_DEFAULTS.baseHours);
    }
  });

  test("⚠️ 下限不低於 12 小時——比一天還短就沒有「全村一起推」的意義", () => {
    expect(normalizeGoalSchedule({ baseHours: 1 }).baseHours).toBe(SCHEDULE_LIMITS.baseHours.min);
    expect(normalizeGoalSchedule({ baseHours: 99999 }).baseHours).toBe(SCHEDULE_LIMITS.baseHours.max);
  });

  test("每階增量可以設成 0（＝所有階級一樣長）", () => {
    expect(normalizeGoalSchedule({ perTierHours: 0 }).perTierHours).toBe(0);
    expect(goalDurationHours(3, { perTierHours: 0 })).toBe(VILLAGE_GOAL_SCHEDULE_DEFAULTS.baseHours);
  });
});

describe("什麼時候可以刷新", () => {
  const ended = endMs => ({ status: "expired", endAt: { toMillis: () => endMs } });

  test("沒有任何目標就可以刷", () => {
    expect(canAutoSpawn(null)).toMatchObject({ ok: true });
  });

  test("還有活躍目標就不刷", () => {
    expect(canAutoSpawn({ status: "active" })).toMatchObject({ ok: false, reason: "already_active" });
  });

  test("⚠️ 冷卻中要跟「還有活躍目標」分開回報，教練才看得出是哪一種", () => {
    const r = canAutoSpawn(ended(0), null, 6 * H);
    expect(r).toMatchObject({ ok: false, reason: "cooling_down" });
    expect(r.remainingMs).toBe(6 * H);
  });

  test("冷卻結束就可以刷", () => {
    expect(canAutoSpawn(ended(0), null, 12 * H)).toMatchObject({ ok: true, reason: "ready" });
  });

  test("冷卻可以設成 0＝結束就馬上刷下一個", () => {
    expect(canAutoSpawn(ended(0), { cooldownHours: 0 }, 1)).toMatchObject({ ok: true });
  });

  test("⚠️ 舊資料沒有 endAt 不能卡住——放行，不然村目標會永遠停擺", () => {
    expect(canAutoSpawn({ status: "expired" })).toMatchObject({ ok: true, reason: "no_end_time" });
  });
});
