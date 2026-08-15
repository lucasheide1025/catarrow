import fs from "fs";
import path from "path";

describe("教練射手模式返回後台", () => {
  test("不呼叫已移除的 member setter，並回到今日營運的課表", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminApp.jsx"), "utf8");
    const returnButton = source.match(
      /<button onClick=\{\(\)=>\{([^}]*)\}\}[\s\S]*?⚙️ 返回後台/
    );

    expect(returnButton).not.toBeNull();
    expect(returnButton[1]).not.toContain("setMemberSub");
    expect(returnButton[1]).toContain('setPage("daily")');
    expect(returnButton[1]).toContain('setDailySub("booking")');
  });

  test("升級卡讀取實際儲存的舊等級與新等級欄位", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminApp.jsx"), "utf8");
    expect(source).toContain("coachLevelUp?.oldLevel");
    expect(source).toContain("coachLevelUp?.newLevel");
    expect(source).not.toContain("coachLevelUp?.from");
    expect(source).not.toContain("coachLevelUp?.to");
  });
});
