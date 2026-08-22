import fs from "fs";
import path from "path";

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");

describe("共用下課結算視窗", () => {
  test("首頁與練箭共用同一個結算 UI，顯示箭數、箭露、里程碑與待審核月卡選項", () => {
    const modal = read("ClassEndSettlementModal.jsx");
    const home = read("MemberHome.jsx");
    const daily = read("DailyQuest.jsx");

    expect(modal).toContain("今日累積");
    expect(modal).toContain("下課立即結算");
    expect(modal).toContain("今日里程碑獎勵");
    expect(modal).toContain("申請扣 1 小時（月卡 -1 次）");
    expect(modal).toContain("申請扣 2 小時（月卡 -2 次）");
    expect(modal).toContain("教練核准後才真正扣除");
    expect(home).toContain("<ClassEndSettlementModal");
    expect(daily).toContain("<ClassEndSettlementModal");
  });

  test("練箭不再保留舊 1/2/3 小時勾選式下課介面", () => {
    const daily = read("DailyQuest.jsx");
    expect(daily).toContain("subscribeMyMonthlyRequests");
    expect(daily).toContain("submitMonthlyCardRequest");
    expect(daily).not.toContain("wantUseMonthly");
    expect(daily).not.toContain("monthlyHours");
    expect(daily).not.toContain("[1, 2, 3].map");
  });
});
