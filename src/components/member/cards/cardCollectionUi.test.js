import { CARD_COLLECTION_MODES, activeFilterSummary, limitCardGroup, selectAllFamilyTierGroups } from "./cardCollectionUi";

test("卡片收藏固定三模式且預設入口為我的牌組", () => {
  expect(CARD_COLLECTION_MODES.map(mode => mode.id)).toEqual(["deck", "catalog", "effects"]);
});

test("進階篩選摘要只列出啟用條件", () => {
  expect(activeFilterSummary({ statFilter:"atk", ownedFilter:"owned", newOnly:true })).toEqual(["ATK", "已取得", "新取得"]);
});

test("任何最終卡片分組最多六張", () => {
  expect(limitCardGroup(Array.from({ length:252 }, (_, id) => id))).toHaveLength(6);
});

test("全族仍限制單一 Tier，預設隱藏未取得卡", () => {
  const views = [
    { family:"ghost", tier:"common", owned:true }, { family:"ghost", tier:"common", owned:false },
    { family:"exam", tier:"rare", owned:true }, { family:"exam", tier:"common", owned:true },
  ];
  const groups = selectAllFamilyTierGroups(views, { tier:"common" });
  expect(groups.flatMap(group => group.cards)).toHaveLength(2);
  expect(groups.flatMap(group => group.cards).every(card => card.tier === "common" && card.owned)).toBe(true);
});

test("主動顯示未取得卡時只補目前 Tier，且每族仍最多六張", () => {
  const views = Array.from({ length:14 }, (_, index) => ({ family:index < 8 ? "ghost" : "exam", tier:"common", owned:index % 2 === 0 }));
  views.push({ family:"ghost", tier:"rare", owned:false });
  const groups = selectAllFamilyTierGroups(views, { tier:"common", showUnowned:true });
  expect(groups.every(group => group.tier === "common" && group.cards.length <= 6)).toBe(true);
  expect(groups.flatMap(group => group.cards).some(card => !card.owned)).toBe(true);
});
