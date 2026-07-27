import { guildScoreButtons } from "../ui/guildTargetFace";

describe("公會戰鬥靶紙分數", () => {
  test("一般全靶保留原始環數", () => {
    const ten = guildScoreButtons("full_110").find(button => button.label === "10");
    expect(ten.score).toBe(10);
    expect(ten.rawScore).toBe(10);
  });

  test("原野靶換算為標準戰鬥分數並保留原始分數", () => {
    const buttons = guildScoreButtons("field_16");
    expect(buttons.find(button => button.label === "5")).toMatchObject({ rawScore: 5, score: 10 });
    expect(buttons.find(button => button.label === "4")).toMatchObject({ rawScore: 4, score: 9 });
    expect(buttons.find(button => button.label === "1")).toMatchObject({ rawScore: 1, score: 6 });
  });
});
