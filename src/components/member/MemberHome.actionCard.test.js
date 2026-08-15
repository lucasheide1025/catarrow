import fs from "fs";
import path from "path";

const read = relative => fs.readFileSync(path.join(__dirname, relative), "utf8");

describe("首頁今日行動頂卡", () => {
  test("使用會員摘要顯示圖鑑數量，不以首頁局部資料重算", () => {
    const source = read("MemberHome.jsx");
    const hero = source.slice(source.indexOf("<section style={{"), source.indexOf("{/* 月卡申請 Modal */}"));
    expect(hero).toContain("profile?.dexTotalUnlocked");
    expect(hero).toContain("profile?.dexTotalAll");
    expect(hero).not.toContain("computeDexStats(");
  });

  test("頂卡提供報到下課、冒險與貓村，且不再主推練習", () => {
    const source = read("MemberHome.jsx");
    const hero = source.slice(source.indexOf("<section style={{"), source.indexOf("{/* 月卡申請 Modal */}"));
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
});
