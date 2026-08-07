// src/lib/boardCardGacha.js
// 探索地圖「抽卡房」格子（08-08）：踩到開抽卡 overlay——免費抽 1 張／付費抽 3 張。
// 純邏輯（池選取、抽卡、卡片格式、計價）都放這裡，UI（單人/組隊）共用同一份答案。
// ⚠️ 池規則：只抽「該 T 階級」的普通怪（encounter==="normal"）——小王/大王/世界王不進池。
//    階級綁定：在 T1 地圖踩到就是抽 T1 卡（tierIndex === T）。
import { CARD_CATALOG } from "../components/member/cards/cardCatalog";

// 付費抽 3 張的價格（金幣）。免費抽 1 張不花錢（每踩一次格子送一次）。
// 2026-08-08 玩家定價：3000 金幣抽 3 張（一次格子限一次）。
export const CARD_GACHA_PAID_PRICE = 3000;

// 族系 emoji（卡片 icon 用；卡面實圖走 artKey）
const FAMILY_ICON = { ghost: "👻", mountain: "🏔️", insect: "🦂", workplace: "💼", exam: "📝", temple: "🏰", treasure: "📦" };

// 抽卡房卡片（含卡面資料）→ addMonsterCard 的卡片物件格式。
// addMonsterCard 需要 monsterId/name/icon/tier/family；卡面顯示用 artKey（cardCatalog 提供）。
export function cardToMonsterCard(entry) {
  return {
    monsterId: entry.monsterId,
    name: entry.name,
    icon: FAMILY_ICON[entry.family] || "🃏",
    tier: entry.tier,
    family: entry.family,
    artKey: entry.artKey,
    tierIndex: entry.tierIndex,
    encounter: entry.encounter,
  };
}

// 抽卡房卡面 view（給 CardArtImage / CardMiniCell 用——與卡片收集頁同一套卡面）
export function cardToView(entry, owned = false) {
  return {
    monsterId: entry.monsterId,
    name: entry.name,
    family: entry.family,
    tier: entry.tier,
    tierIndex: entry.tierIndex,
    encounter: entry.encounter,
    artKey: entry.artKey,
    owned,
  };
}

// 抽卡池：該 T 階級的全部「普通怪」卡片（每階 21 張：7 族 × 3 隻）。
// tier 用數字 1~6（旅程階級），對應 CARD_CATALOG.tierIndex。
// ⚠️ 排除小王（miniBoss）/大王（boss）——用戶明確只要普通怪。
export function cardGachaPool(tier) {
  const t = Math.max(1, Math.min(6, Number(tier) || 1));
  return CARD_CATALOG.filter(c => c.encounter === "normal" && c.tierIndex === t);
}

// 抽 1 張（回傳卡面 entry 或 null——池為空時給 null，呼叫端顯示「此階級尚無卡片」）
export function rollCardGachaOne(tier, rnd = Math.random) {
  const pool = cardGachaPool(tier);
  if (!pool.length) return null;
  return pool[Math.floor(rnd() * pool.length)];
}

// 抽 n 張（回傳 entry 陣列，可能有重複——重複卡片入帳時自動累計 duplicates 供升星）
export function rollCardGachaN(tier, count, rnd = Math.random) {
  const n = Math.max(1, Math.min(10, Number(count) || 1));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const c = rollCardGachaOne(tier, rnd);
    if (c) out.push(c);
  }
  return out;
}
