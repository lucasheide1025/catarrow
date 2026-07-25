// src/guild/data/guildShop.js
// ─────────────────────────────────────────────────────────────
// 公會商店：CAT幣的唯一去處（P3 經濟）。層級 tier 由階級解鎖（見 guildRank.js）。
// 賣兩類：
//   ① material → 兌換**主線材料**（回饋打怪/貓村經濟，公會刷的東西主線用得到）
//   ② equip    → 買公會專屬裝備（進倉庫，只影響公會遠征）
// 定價基準：一趟遠征約得 5~25 CAT幣（LOOT_BY_DANGER 的 catCoinBase + 雜貨評估）。
// ⚠️ 這裡是唯一的數值來源，調價只改這張表。
// ─────────────────────────────────────────────────────────────

export const SHOP_TIER_META = Object.freeze({
  1: { label: "基礎貨架", hint: "見習就能買" },
  2: { label: "進階貨架", hint: "銀牌解鎖" },
  3: { label: "傳說貨架", hint: "白金解鎖" },
});

// materialId 用主線材料 id（{family}_m{1..6}）；六族都給，讓玩家補自己缺的族
const MAT_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
const MAT_TIER_PRICE = { 1: 10, 2: 25, 3: 60 }; // 只賣 t1~t3，高階材料要自己打（保留成就感）

const materialItems = MAT_FAMILIES.flatMap(family =>
  [1, 2, 3].map(t => ({
    id: `mat_${family}_m${t}`,
    kind: "material",
    tier: t === 3 ? 3 : t === 2 ? 2 : 1,
    costCat: MAT_TIER_PRICE[t],
    materialId: `${family}_m${t}`,
    qty: 1,
  })),
);

// 公會裝：低階便宜當保底，高階當長期目標
const equipItems = [
  { id: "eq_wood_bow_rare",     kind: "equip", tier: 1, costCat: 45,  archetypeId: "wood_bow",       grade: "rare" },
  { id: "eq_cloth_armor_rare",  kind: "equip", tier: 1, costCat: 45,  archetypeId: "cloth_armor",    grade: "rare" },
  { id: "eq_sharp_arrow_rare",  kind: "equip", tier: 1, costCat: 35,  archetypeId: "sharp_arrow",    grade: "rare" },
  { id: "eq_small_quiver_rare", kind: "equip", tier: 1, costCat: 35,  archetypeId: "small_quiver",   grade: "rare" },
  { id: "eq_hunter_bow_elite",  kind: "equip", tier: 2, costCat: 140, archetypeId: "hunter_bow",     grade: "elite" },
  { id: "eq_leather_elite",     kind: "equip", tier: 2, costCat: 140, archetypeId: "leather_armor",  grade: "elite" },
  { id: "eq_pouch_l_elite",     kind: "equip", tier: 2, costCat: 120, archetypeId: "potion_pouch_l", grade: "elite" },
  { id: "eq_ranger_q_elite",    kind: "equip", tier: 2, costCat: 110, archetypeId: "ranger_quiver",  grade: "elite" },
  { id: "eq_long_bow_fierce",   kind: "equip", tier: 3, costCat: 380, archetypeId: "long_bow",       grade: "fierce" },
  { id: "eq_scout_fierce",      kind: "equip", tier: 3, costCat: 340, archetypeId: "scout_armor",    grade: "fierce" },
  { id: "eq_heavy_arrow_fierce",kind: "equip", tier: 3, costCat: 300, archetypeId: "heavy_arrow",    grade: "fierce" },
];

export const GUILD_SHOP_ITEMS = Object.freeze([...equipItems, ...materialItems]);

export function shopItemById(id) {
  return GUILD_SHOP_ITEMS.find(i => i.id === id) || null;
}

// 這個階級（shopTier）買得到的貨
export function shopItemsForTier(shopTier = 1) {
  return GUILD_SHOP_ITEMS.filter(i => i.tier <= shopTier);
}
