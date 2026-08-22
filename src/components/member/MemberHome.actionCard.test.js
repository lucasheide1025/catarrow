import fs from "fs";
import path from "path";

const read = relative => fs.readFileSync(path.join(__dirname, relative), "utf8");

describe("首頁今日行動頂卡", () => {
  const heroSlice = source => source.slice(source.indexOf("<section style={{"), source.indexOf("<ClassEndSettlementModal"));

  test("使用會員摘要顯示圖鑑數量，不以首頁局部資料重算", () => {
    const source = read("MemberHome.jsx");
    const hero = heroSlice(source);
    expect(hero).toContain("profile?.dexTotalUnlocked");
    expect(hero).toContain("profile?.dexTotalAll");
    expect(hero).not.toContain("computeDexStats(");
  });

  test("頂卡提供報到下課、冒險與貓村，且不再主推練習", () => {
    const source = read("MemberHome.jsx");
    const hero = heroSlice(source);
    expect(hero).toContain("onCheckin");
    expect(hero).toContain("onClassEnd");
    expect(hero).toContain("選擇冒險");
    expect(hero).toContain("貓貓村");
    expect(hero).not.toContain("開始練習");
  });

  test("教練差異以頂卡返回後台 callback 表達", () => {
    const source = read("MemberHome.jsx");
    expect(source).toContain("onReturnAdmin");
    expect(source).toContain("返回後台");
  });

  test("下課統一使用結算視窗，月卡 1/2 小時先送待審核申請", () => {
    const source = read("MemberHome.jsx");
    expect(source).toContain("ClassEndSettlementModal");
    expect(source).toContain("submitMonthlyCardRequest");
    expect(source).toContain("monthlyReqs.some(r => r.status === \"pending\")");
    expect(source).toContain("const ok = await onClassEnd();");
    expect(source).not.toContain("onClassEnd(monthlyCardHours)");
  });

  test("首頁固定顯示月卡剩餘小時與到期日，不再藏在射手等級卡", () => {
    const source = read("MemberHome.jsx");
    const hero = heroSlice(source);
    expect(source).toContain("getMonthlyCardStatus");
    expect(hero).toContain("剩餘 {monthlyCardStatus.sessions} 小時");
    expect(hero).toContain("到期 {monthlyCardExpiryLabel}");
    expect(hero).toContain("可申請扣抵");
    expect(source).not.toContain("{/* 月卡資訊 */}");
  });
});
