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
import { EXPANSION_MATERIALS } from "../../lib/monsterExpansionCatalog";

// ── 分店（2026-07-26 作者要求）────────────────────────────
// 商品太多了，一條長列表捲不完 → 分成三家店，各自再有自己的分頁。
export const SHOP_SECTIONS = Object.freeze([
  { id: "weapon", label: "武器商店", icon: "🏹", hint: "弓與箭・靠打出來的高階款這裡沒有" },
  { id: "armor", label: "防具商店", icon: "🛡️", hint: "護具・箭袋・藥水袋" },
  { id: "material", label: "材料商店", icon: "📦", hint: "七大族素材・不限量・打怪缺什麼就補什麼" },
]);
// 槽位 → 分店
const SLOT_SECTION = { bow: "weapon", arrow: "weapon", armor: "armor", quiver: "armor", potionPouch: "armor" };

export const SHOP_TIER_META = Object.freeze({
  1: { label: "基礎貨架", hint: "見習就能買・常見款式" },
  2: { label: "進階貨架", hint: "銀牌解鎖・精良品級與進階款式" },
  3: { label: "特製貨架", hint: "白金解鎖・特殊流派款式（仍是精良品級）" },
});

// 商店能賣的品級上限：**精良（rare）**。再上去只能靠遠征掉落。
export const SHOP_MAX_GRADE = "rare";
const SELLABLE_GRADES = ["common", "rare"];

// ── 材料商店（2026-07-26 重做）────────────────────────────
// 舊版只賣「舊六族材料鏈」的 t1~t3（`<族>_m<1~3>`），但玩家實際掉的是**擴充材料**
// （`mat_<族>_t<N>_<role>`，252 種），所以商店貨架跟需求對不上。
// 作者拍板：**七大族全開、除了小王/大王素材以外都買得到、不限量**。
//   → 篩 `kind === "normal"`（一般怪素材，126 種）；miniBoss/boss 素材只能靠打。
//   → **不做階級鎖**（tier 一律 1），高階材料用「價格」當門檻就好。
export const MAT_FAMILY_META = Object.freeze({
  ghost:     { label: "鬼怪", icon: "👻" },
  mountain:  { label: "山林", icon: "🏔️" },
  insect:    { label: "毒蟲", icon: "🐛" },
  workplace: { label: "職場", icon: "💼" },
  exam:      { label: "考試", icon: "📚" },
  temple:    { label: "神殿", icon: "⛪" },
  treasure:  { label: "寶藏", icon: "💰" },
});
export const MAT_FAMILIES = Object.keys(MAT_FAMILY_META);

// 每階價格拉開差距（T6 一顆 320 CAT幣＝一趟 T5 遠征的 2.5 倍），高階自然買不多
const MAT_TIER_PRICE = { 1: 8, 2: 18, 3: 40, 4: 85, 5: 170, 6: 320 };
const BUNDLE_QTY = 5;
const BUNDLE_DISCOUNT = 0.8;

export const SHOP_MATERIALS = EXPANSION_MATERIALS.filter(m => m.kind === "normal");
// 查表放公會這邊自己建（主線目錄不動，維持隔離）
export const SHOP_MATERIAL_BY_ID = Object.freeze(Object.fromEntries(EXPANSION_MATERIALS.map(m => [m.id, m])));

const materialItems = SHOP_MATERIALS.flatMap(m => {
  const unit = MAT_TIER_PRICE[m.tierIndex] || 8;
  const base = { kind: "material", section: "material", tier: 1, materialId: m.id, family: m.family, matTier: m.tierIndex };
  return [
    { ...base, id: `buy_${m.id}`, costCat: unit, qty: 1 },
    { ...base, id: `buy_${m.id}_x${BUNDLE_QTY}`, costCat: Math.round(unit * BUNDLE_QTY * BUNDLE_DISCOUNT), qty: BUNDLE_QTY, bundle: true },
  ];
});

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
  section: SLOT_SECTION[GUILD_EQUIP_ARCHETYPES[archetypeId]?.slot] || "armor",
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

// 分店取貨（UI 用）
export function shopItemsOfSection(sectionId) {
  return GUILD_SHOP_ITEMS.filter(i => i.section === sectionId);
}

// 商店天花板說明（UI 用）：讓玩家知道高階裝要靠打
export const SHOP_GRADE_NOTE = `商店最高只賣「${GRADE_META[SHOP_MAX_GRADE].label}」品級；${GRADE_META.elite.label}以上只能從遠征掉落取得。`;

// 給測試/驗證用：商店不得出現超過 rare 的裝備
export function validateGuildShop() {
  const bad = GUILD_SHOP_ITEMS.filter(i => i.kind === "equip" && !SELLABLE_GRADES.includes(i.grade));
  return { ok: bad.length === 0, bad };
}
