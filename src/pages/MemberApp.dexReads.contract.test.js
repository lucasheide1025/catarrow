import fs from "fs";
import path from "path";

test("圖鑑重型監聽只在需要相關資料的頁面啟動", () => {
  const source = fs.readFileSync(path.join(__dirname, "MemberApp.jsx"), "utf8");
  expect(source).toContain('const needsDexData = ["dex", "monster", "monsterdex"');
  expect(source).toContain("if (!needsDexData) return;");
  expect(source).toContain("}, [profile?.id, page]);");
  expect(source).not.toContain("成就即時偵測（App 層，全站有效）");
});
