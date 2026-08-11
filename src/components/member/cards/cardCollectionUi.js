export const CARD_COLLECTION_MODES = Object.freeze([
  { id:"deck", label:"我的牌組" },
  { id:"catalog", label:"卡片圖鑑" },
  { id:"effects", label:"效果說明" },
]);

export function activeFilterSummary({ l1="all", statFilter="all", ownedFilter="all", upgradableOnly=false, newOnly=false } = {}) {
  const labels = [];
  if (l1 !== "all") labels.push(l1);
  if (statFilter !== "all") labels.push(statFilter.toUpperCase());
  if (ownedFilter !== "all") labels.push(ownedFilter === "owned" ? "已取得" : "未取得");
  if (upgradableOnly) labels.push("可升星");
  if (newOnly) labels.push("新取得");
  return labels;
}

export const limitCardGroup = cards => (Array.isArray(cards) ? cards : []).slice(0, 6);

export function selectAllFamilyTierGroups(views = [], { tier, showUnowned = false } = {}) {
  if (!tier) return [];
  const groups = new Map();
  views.filter(view => view.tier === tier && (showUnowned || view.owned)).forEach(view => {
    const list = groups.get(view.family) || [];
    if (list.length < 6) list.push(view);
    groups.set(view.family, list);
  });
  return Array.from(groups, ([family, cards]) => ({ family, tier, cards }));
}
