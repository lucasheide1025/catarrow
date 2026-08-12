import fs from "fs";
import path from "path";

describe("首頁排行榜容錯顯示", () => {
  test("沒有快取或讀取失敗時仍保留排行榜卡片", () => {
    const source = fs.readFileSync(path.join(__dirname, "HomeLeaderboardBlock.jsx"), "utf8");

    expect(source).toContain("if (!myId) return null");
    expect(source).not.toContain("if (!myId || mine === null) return null");
    expect(source).toContain("正在讀取你的排行榜資料");
    expect(source).toContain("暫時無法取得排名");
  });
});

describe("首頁世界王狀態", () => {
  test("沒有活躍世界王時不會因舊 spawned 週期而隱藏整張狀態卡", () => {
    const source = fs.readFileSync(path.join(__dirname, "MemberHome.jsx"), "utf8");

    expect(source).not.toContain('![' + '"spawned"' + '].includes(worldBossCycle.status)');
  });
});
