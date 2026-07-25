// src/guild/data/guildShop.js
// ─────────────────────────────────────────────────────────────
// 公會商店：CAT幣的唯一去處。層級 tier 由階級解鎖（見 guildRank.js）。
//
// ⚠️ 2026-07-25 重新架構（作者拍板）：**商店買不到高階裝備**。
//   賣的裝備只有 `common`（基礎）與 `rare`（多一階）兩種品級——
//   `elite` 以上（優秀/稀有/史詩/傳說）**只能靠打**，這樣刷裝才有意義。
//   貨架分層改成「款式深度」而不是「品級高低」：
//     貨架1 常見款 common ／ 貨架2 常見款 rare + 進階款 common ／ 貨架3 進階款 rare
//   材料同理只賣 t1~t3，高階材料靠打。
// ⚠️ 這裡是唯一的數值來源，調價只改這張表。
// ─────────────────────────────────────────────────────────────
import { GRADE_META, GUILD_EQUIP_ARCHETYPES } from "./guildEquipCatalog";

export const SHOP_TIER_META = Object.freeze({
  1: { label: "基礎貨架", hint: "見習就能買・常見款式" },
  2: { label: "進階貨架", hint: "銀牌解鎖・精良品級與進階款式" },
  3: { label: "特製貨架", hint: "白金解鎖・特殊流派款式（仍是精良品級）" },
});

// 商店能賣的品級上限：**精良（rare）**。再上去只能靠遠征掉落。
export const SHOP_MAX_GRADE = "rare";
const SELLABLE_GRADES = ["common", "rare"];

const MAT_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
// 材料是商店的主力（作者：讓玩家自由採購缺的素材，補打怪賺不夠的洞）。
// 只賣 t1~t3（高階材料靠打），但**每族每階都有單買與 5 入包**，5 入包打 8 折。
const MAT_TIER_PRICE = { 1: 8, 2: 18, 3: 40 };
const MAT_TIER_SHELF = { 1: 1, 2: 2, 3: 3 };
const BUNDLE_QTY = 5;
const BUNDLE_DISCOUNT = 0.8;

const materialItems = MAT_FAMILIES.flatMap(family =>
  [1, 2, 3].flatMap(t => [
    {
      id: `mat_${family}_m${t}`,
      kind: "material",
      tier: MAT_TIER_SHELF[t],
      costCat: MAT_TIER_PRICE[t],
      materialId: `${family}_m${t}`,
      qty: 1,
    },
    {
      id: `mat_${family}_m${t}_x${BUNDLE_QTY}`,
      kind: "material",
      tier: MAT_TIER_SHELF[t],
      costCat: Math.round(MAT_TIER_PRICE[t] * BUNDLE_QTY * BUNDLE_DISCOUNT),
      materialId: `${family}_m${t}`,
      qty: BUNDLE_QTY,
      bundle: true,
    },
  ]),
);

// 款式分層：常見款（新手好懂）→ 進階款（流派分明）
const COMMON_STYLE = ["wood_bow", "iron_bow", "bamboo_bow", "wood_arrow", "sharp_arrow", "feather_arrow",
  "cloth_armor", "leather_armor", "hide_armor", "small_quiver", "hunter_quiver",
  "potion_pouch_s", "herb_pouch", "waterskin"];
const ADVANCED_STYLE = ["hunter_bow", "short_bow", "horn_bow", "spirit_bow", "bodkin_arrow", "blessed_arrow",
  "scout_armor", "robe_armor", "fortune_vest", "ranger_quiver", "wide_quiver", "swift_quiver",
  "potion_pouch_l", "ration_pack", "medic_bag"];

// 價格：基礎裝依「六維總量 × 品級」估價，避免手動一個個填錯。
// common 便宜當保底；rare 明顯貴（但仍遠比打到的高階裝便宜）。
const GRADE_PRICE_MULT = { common: 1, rare: 2.4 };
function priceOf(archetypeId, grade) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  const power = Object.values(a?.base || {}).reduce((s, v) => s + Math.max(0, v), 0);
  // 係數 1.5：一趟 T2 遠征（約 28 CAT幣＋雜貨）就能換一件基礎裝，不用刷十趟才買得起
  return Math.max(15, Math.round(power * 1.5 * (GRADE_PRICE_MULT[grade] || 1) / 5) * 5);
}
const equipItem = (archetypeId, grade, shelf) => ({
  id: `eq_${archetypeId}_${grade}`,
  kind: "equip",
  tier: shelf,
  costCat: priceOf(archetypeId, grade),
  archetypeId,
  grade,
});

const equipItems = [
  ...COMMON_STYLE.map(id => equipItem(id, "common", 1)),     // 貨架1：常見款・基礎品級
  ...COMMON_STYLE.map(id => equipItem(id, "rare", 2)),       // 貨架2：常見款・精良
  ...ADVANCED_STYLE.map(id => equipItem(id, "common", 2)),   // 貨架2：進階款・基礎
  ...ADVANCED_STYLE.map(id => equipItem(id, "rare", 3)),     // 貨架3：進階款・精良（商店天花板）
];

export const GUILD_SHOP_ITEMS = Object.freeze([...equipItems, ...materialItems]);

export function shopItemById(id) {
  return GUILD_SHOP_ITEMS.find(i => i.id === id) || null;
}

// 這個階級（shopTier）買得到的貨
export function shopItemsForTier(shopTier = 1) {
  return GUILD_SHOP_ITEMS.filter(i => i.tier <= shopTier);
}

// 商店天花板說明（UI 用）：讓玩家知道高階裝要靠打
export const SHOP_GRADE_NOTE = `商店最高只賣「${GRADE_META[SHOP_MAX_GRADE].label}」品級；${GRADE_META.elite.label}以上只能從遠征掉落取得。`;

// 給測試/驗證用：商店不得出現超過 rare 的裝備
export function validateGuildShop() {
  const bad = GUILD_SHOP_ITEMS.filter(i => i.kind === "equip" && !SELLABLE_GRADES.includes(i.grade));
  return { ok: bad.length === 0, bad };
}
