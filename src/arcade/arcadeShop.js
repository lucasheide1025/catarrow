// src/arcade/arcadeShop.js — 金幣商店（M2）＋等級系統（M3）
// 所有函式為純函式（無副作用），可單元測試。
import {
  applyPlayerXp,
  playerLevelProgress,
  xpForPlayerLevel,
} from "./arcadeProgression";

// ── M2：商店商品 ─────────────────────────────────────────────
export const SHOP_ITEMS = [
  { id: "fire_arrow",   name: "火焰箭",   icon: "🏹", price: 100, desc: "下一場攻擊變強", category: "道具", maxBuy: 20 },
  { id: "cat_riceball", name: "貓咪飯糰", icon: "🍙", price: 80,  desc: "恢復 20 生命", category: "道具", maxBuy: 20 },
  { id: "catnip",       name: "貓薄荷",   icon: "🌿", price: 120, desc: "下一場技能率 +15%", category: "道具", maxBuy: 20 },
  { id: "cat_fur",      name: "貓毛",     icon: "🧶", price: 200, desc: "稀有素材，用於裝備強化", category: "素材", maxBuy: 10 },
  { id: "energy_drink", name: "能量飲料", icon: "🥤", price: 150, desc: "冒險中回復 30 HP", category: "道具", maxBuy: 10 },
  { id: "lucky_clover", name: "幸運草",   icon: "🍀", price: 250, desc: "下次冒險寶箱掉落 ×2", category: "道具", maxBuy: 5 },
];

/** 取得商品資料（找不到返回 null） */
export function getShopItem(itemId) {
  return SHOP_ITEMS.find((x) => x.id === itemId) || null;
}

/** 購買純函式：回傳 { ok, reason, updated }——不動原始 profile（不可變更新） */
export function buyItem(profile, itemId, qty = 1) {
  const item = getShopItem(itemId);
  if (!item) return { ok: false, reason: "找不到這個商品" };
  if (qty < 1) return { ok: false, reason: "數量必須 ≥ 1" };
  const cost = item.price * qty;
  const coins = profile.coins || 0;
  if (coins < cost) return { ok: false, reason: `金幣不足！需要 ${cost}，目前 ${coins}` };
  const inv = { ...(profile.inventory || {}) };
  const currentQty = inv[item.id] || 0;
  if (item.maxBuy && currentQty + qty > item.maxBuy) {
    return { ok: false, reason: `已達上限（最多 ${item.maxBuy} 個）` };
  }
  inv[item.id] = currentQty + qty;
  const updated = { ...profile, coins: coins - cost, inventory: inv, lastPlayedAt: Date.now() };
  return { ok: true, updated };
}

// ── M3：等級系統 ─────────────────────────────────────────────
// 玩家（冒險者）等級：透過冒險獲得 XP，升級解鎖獎勵。
// 升級曲線：Lv.N 需要 N × 100 XP（Lv1→2: 100, Lv2→3: 200...）
export function xpForLevel(level) {
  return xpForPlayerLevel(level);
}

/** 冒險結束後獲得的 XP（依難度與評等） */
export function calcBattleXP({ mode = "forest", grade = "C", isTeam = false, bossKills = 0 }) {
  const baseXP = { forest: 30, moon: 50, abyss: 80 };
  const gradeMult = { S: 1.5, A: 1.3, B: 1.1, C: 1.0 };
  const xp = (baseXP[mode] || 30) * (gradeMult[grade] || 1.0);
  const teamBonus = isTeam ? 1.3 : 1.0;
  const bossBonus = bossKills > 0 ? 10 : 0;
  return Math.round(xp * teamBonus) + bossBonus;
}

/** 升級處理純函式：回傳 { updated, levelsGained, rewards } */
export function applyLevelUp(profile, xpGained) {
  return applyPlayerXp(profile, xpGained);
}

/** 升級進度百分比（0~100），供進度條顯示 */
export function levelProgress(catLevel, xp) {
  return playerLevelProgress(catLevel, xp);
}
