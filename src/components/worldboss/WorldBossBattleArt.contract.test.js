import { bossImageChain } from "./WorldBossSVG";

describe("世界王戰鬥立繪路徑", () => {
  test.each([
    "head_coach", "wife", "yumi", "cat_daming", "cat_gege", "cat_meimei",
    "cat_niuniu", "cat_haji", "cat_baobao", "cat_youyou", "cat_xiaoan", "cat_diandian",
  ])("%s 優先使用 battle-v3 透明全身圖", bossKey => {
    expect(bossImageChain(bossKey)[0]).toBe(`/worldboss/battle-v3/${bossKey}.png`);
  });

  test("人物王仍保留舊立繪回退", () => {
    expect(bossImageChain("wife")).toEqual([
      "/worldboss/battle-v3/wife.png",
      "/worldboss/wife-v2.png",
    ]);
  });

  test("貓王仍保留舊世界王圖與貓咪肖像回退", () => {
    expect(bossImageChain("cat_daming")).toEqual([
      "/worldboss/battle-v3/cat_daming.png",
      "/worldboss/cat_daming.webp",
      "/cats/portraits/daming.webp",
    ]);
  });

  test("卡片素材路徑不會混入戰鬥圖片鏈", () => {
    expect(bossImageChain("head_coach").some(path => path.includes("/cards/"))).toBe(false);
  });
});
