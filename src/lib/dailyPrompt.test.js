import { dailyPromptKey, markDailyPromptShown, wasDailyPromptShown } from "./dailyPrompt";

test("同帳號同一天重新登入不重播今日提示，隔天才可再顯示", () => {
  const data = new Map();
  const storage = { getItem:key => data.get(key) || null, setItem:(key,value) => data.set(key,value) };
  const today = new Date(2026, 7, 13);
  const tomorrow = new Date(2026, 7, 14);
  expect(dailyPromptKey("member-checkin", "m1", today)).toBe("member-checkin:m1:2026-08-13");
  expect(wasDailyPromptShown(storage, "member-checkin", "m1", today)).toBe(false);
  markDailyPromptShown(storage, "member-checkin", "m1", today);
  expect(wasDailyPromptShown(storage, "member-checkin", "m1", today)).toBe(true);
  expect(wasDailyPromptShown(storage, "member-checkin", "m1", tomorrow)).toBe(false);
});
