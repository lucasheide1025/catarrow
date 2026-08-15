import fs from "fs";
import path from "path";

describe("三位教練王卡面 v3", () => {
  const source = fs.readFileSync(path.join(__dirname, "CardCollectionPrototype.jsx"), "utf8");

  test.each(["head_coach", "wife", "yumi"])("%s 優先載入新版卡面並保留回退", key => {
    expect(source).toContain(`${key}: ["${key}-v3.png", "${key}-v2.png", "${key}.webp"]`);
    expect(fs.existsSync(path.join(process.cwd(), "public", "cards", "worldboss", `${key}-v3.png`))).toBe(true);
  });

  test("戰鬥透明素材與卡面素材維持不同資料夾", () => {
    expect(source).not.toContain("/worldboss/battle-v3/");
  });
});
