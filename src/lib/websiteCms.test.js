import { EMPTY_CMS_CONTENT, WEBSITE_CMS_PAGES } from "./websiteCmsSchema";

test("官網內容管理涵蓋新版首頁、主題頁與既有情境頁", () => {
  expect(WEBSITE_CMS_PAGES).toHaveLength(14);
  expect(new Set(WEBSITE_CMS_PAGES.map(page => page.id)).size).toBe(14);
  expect(WEBSITE_CMS_PAGES[0].id).toBe("home");
});

test("空白內容同時保留文字與圖片覆寫區", () => {
  expect(EMPTY_CMS_CONTENT).toEqual({ text: {}, images: {} });
});
