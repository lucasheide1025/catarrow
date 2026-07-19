// src/components/member/cards/cardCatalog.js
// 從正式 catalog（src/lib/monsterExpansionCatalog.js → src/data/monsterExpansionCatalog.json）
// 衍生「卡片目錄」。不複製 252 筆資料、不改 ID/artKey。世界王卡不在此（獨立來源）。
//
// catalog encounter 值：normal | miniBoss | boss（大王 = "boss"）。
// 252 隻正式 catalog 怪物皆已具備獨立背景卡面。

// 從 EXPANSION_MONSTERS 衍生（含 existing 標記 + monster.card）;
// EXPANSION_CARDS 不含 existing,故不用它。
import { EXPANSION_MONSTERS } from "../../../lib/monsterExpansionCatalog";

// ── L1 遭遇分類 ─────────────────────────────
export const L1_CATEGORIES = [
  { id: "all",       label: "全部" },
  { id: "normal",    label: "一般怪", encounter: "normal" },
  { id: "miniBoss",  label: "小王",   encounter: "miniBoss" },
  { id: "bigBoss",   label: "大王",   encounter: "boss" }, // catalog 用 "boss"
  { id: "worldboss", label: "世界王", source: "wb" },      // 獨立卡池,不在本 catalog
];

// ── L2 篩選選項 ─────────────────────────────
export const FAMILIES = [
  { id: "ghost", label: "鬼怪" }, { id: "mountain", label: "山林" }, { id: "insect", label: "毒蟲" },
  { id: "workplace", label: "職場" }, { id: "exam", label: "考試" }, { id: "temple", label: "西方" }, { id: "treasure", label: "寶箱" },
];
export const TIERS = [
  { id: "common", label: "T1" }, { id: "rare", label: "T2" }, { id: "elite", label: "T3" },
  { id: "fierce", label: "T4" }, { id: "boss", label: "T5" }, { id: "mythic", label: "T6" },
];

// ── 衍生目錄（純資料,不含 owned 狀態） ────────
export const CARD_CATALOG = EXPANSION_MONSTERS.map(m => ({
  monsterId: m.id,
  cardId: m.card.id,            // = monsterId
  artKey: m.card.artKey,
  expectedPath: `/cards/monsters/${m.card.artKey}.webp`,
  availability: "existing",
  family: m.family,
  tier: m.tier,
  tierIndex: m.tierIndex,
  encounter: m.encounter,       // normal | miniBoss | boss
  role: m.role,
  name: m.name,
  existing: !!m.existing,
}));

export const CARD_CATALOG_BY_ID = Object.freeze(
  Object.fromEntries(CARD_CATALOG.map(c => [c.monsterId, c])),
);

// L1 是否符合（世界王卡不在本 catalog,回 false）
export function matchL1(entry, l1) {
  if (l1 === "all") return true;
  if (l1 === "worldboss") return false;
  if (l1 === "bigBoss") return entry.encounter === "boss";
  return entry.encounter === l1; // normal | miniBoss
}

// 一組 = 族系 × Tier（最多 6：3 一般 + 2 小王 + 1 大王）
export function getGroup(family, tier) {
  return CARD_CATALOG.filter(c => c.family === family && c.tier === tier);
}

// 合併 owned 狀態（collection.cards[monsterId] = { duplicates, stars, chosenStat? }）
export function mergeOwned(entry, collection) {
  const owned = collection && collection.cards ? collection.cards[entry.monsterId] : null;
  const has = !!owned;
  return {
    ...entry,
    owned: has,
    stars: has ? (owned.stars || 1) : 0,
    duplicates: has ? (owned.duplicates || 0) : 0,
    chosenStat: (owned && owned.chosenStat) || null,
    source: "monster",
    equipped: (collection?.equipped || []).some(item => typeof item === "string"
      ? item === entry.monsterId
      : item?.key === entry.monsterId && (item.source || "monster") === "monster"),
  };
}

// 已取得卡的圖片來源鏈（fallback：/cards/monsters → /monsters-battle → /monsters → emoji）。
// 未取得回 []（不發任何圖片請求,由 UI 用純 CSS 剪影）。
export function ownedArtSources(view) {
  if (!view || !view.owned) return [];
  if (view.artSources) return view.artSources; // 外部來源（如世界王卡）自帶圖片鏈
  const portraitFallbacks = [
    `/monsters-battle/${view.monsterId}.webp`,
    `/monsters/${view.monsterId}.webp`,
  ];
  // 全部 catalog 怪物皆有正式獨立場景卡圖；載入失敗時才退回透明戰鬥立繪。
  return view.availability === "existing"
    ? [`/cards/monsters/${view.artKey}.webp`, ...portraitFallbacks]
    : portraitFallbacks;
}

// 卡圖主 URL：只有已取得才回傳（未取得 → null,不發請求）。
export function cardImageSrc(view) {
  const sources = ownedArtSources(view);
  return sources.length ? sources[0] : null;
}
