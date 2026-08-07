// src/lib/villageShopDb.js — 貓貓村商店販售模擬器・DB 層
// 全部寫入都走 members/{id} 的 village.shop（village 已在 firestore.rules 白名單）
// 純邏輯（等級/顧客/模擬/兌換表）在 villageShop.js，此檔只做驗證 + 套用寫入。

import { doc, getDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { addChests } from "./db";
import { SHOP_GOODS, getGoodById } from "./shopGoodsCatalog";
import {
  normalizeShop, defaultShopState, simulateServe,
  getFurniturePrice, FURNITURE_DEFS, calcShopSlots,
  getExchangeRewardById, getExchangeRemaining, todayStr, weekStr,
} from "./villageShop";

const MEMBERS = "members";

// ── 初始化（無 village.shop 才寫；lastVisitedAt 回首 1 小時 → 首次開店即有開場顧客）──
export async function initVillageShopIfNeeded(memberId, village) {
  if (!memberId || village?.shop) return;
  const state = defaultShopState(Date.now());
  await updateDoc(doc(db, MEMBERS, memberId), {
    "village.shop": {
      level: 1,
      tickets: 0,
      stock: {},
      display: state.display,
      furniture: state.furniture,
      lastVisitedAt: new Date(Date.now() - 60 * 60000),
      stats: {
        totalSales: 0, totalTickets: 0, customersServed: 0, totalRevenue: 0,
        discoveredCustomers: [], customerLog: [],
      },
      exchange: { date: todayStr(), counts: {}, week: weekStr(), weeklyCounts: {} },
      createdAt: serverTimestamp(),
    },
  });
}

// ── 製作販售商品（消耗村資源 + 金幣 → 增加庫存，上限 99）──
export async function craftShopGood(memberId, goodId, count = 1) {
  if (!memberId || !goodId || !Number.isFinite(count) || count <= 0) throw new Error("參數錯誤");
  const good = getGoodById(goodId);
  if (!good) throw new Error("找不到商品");

  const snap = await getDoc(doc(db, MEMBERS, memberId));
  if (!snap.exists()) throw new Error("找不到會員");
  const data = snap.data();
  const shop = normalizeShop(data.village?.shop);
  if ((shop.level || 1) < good.unlockLevel) throw new Error("商店等級不足，尚未解鎖此食譜");

  const resources = data.village?.resources || {};
  const coins = data.coins || 0;
  const needResources = {};
  good.recipe.forEach(r => {
    const key = `${r.resource}_t${r.tier}`;
    needResources[key] = (needResources[key] || 0) + r.count * count;
  });
  const needGold = good.gold * count;

  const missing = [];
  for (const [key, need] of Object.entries(needResources)) {
    const have = Math.floor(resources[key] || 0);
    if (have < need) missing.push(`${key}（需 ${need}，有 ${have}）`);
  }
  if (coins < needGold) missing.push(`金幣（需 ${needGold}，有 ${Math.floor(coins)}）`);
  if (missing.length) throw new Error(`材料不足：${missing.join("、")}`);

  const stock = { ...(shop.stock || {}) };
  const next = Math.min(99, (stock[goodId] || 0) + count);
  const updates = {
    "village.shop.stock": { ...stock, [goodId]: next },
    coins: increment(-needGold),
  };
  for (const [key, need] of Object.entries(needResources)) {
    updates[`village.resources.${key}`] = increment(-need);
  }
  await updateDoc(doc(db, MEMBERS, memberId), updates);
  return { ok: true, count, added: next - (stock[goodId] || 0), stock: next };
}

// ── 擺放/調整上架格位（display = [{slot, goodId}]，長度不超過格位數）──
export async function arrangeShopDisplay(memberId, display) {
  if (!memberId || !Array.isArray(display)) throw new Error("參數錯誤");
  const snap = await getDoc(doc(db, MEMBERS, memberId));
  const shop = normalizeShop(snap.data()?.village?.shop);
  const capacity = calcShopSlots(shop.furniture);
  const next = display.slice(0, capacity).map(d => ({
    slot: d.slot || "cabinet",
    goodId: d.goodId || null,
  }));
  while (next.length < capacity) next.push({ slot: "counter", goodId: null });
  await updateDoc(doc(db, MEMBERS, memberId), { "village.shop.display": next });
  return { ok: true, display: next };
}

// ── 開門營業（批次結算等待顧客 → 套用票券/庫存/統計）──
export async function serveShop(memberId, village) {
  if (!memberId) throw new Error("參數錯誤");
  const snap = await getDoc(doc(db, MEMBERS, memberId));
  if (!snap.exists()) throw new Error("找不到會員");
  const data = snap.data();
  const shop = normalizeShop(data.village?.shop || village?.shop);

  const goodsMap = {};
  SHOP_GOODS.forEach(g => { goodsMap[g.id] = g; });
  const result = simulateServe(shop, { now: Date.now(), goodsMap });

  const updates = {
    "village.shop.tickets": increment(result.totalTickets),
    "village.shop.stock": result.stockAfter,
    "village.shop.lastVisitedAt": serverTimestamp(),
    "village.shop.stats.totalRevenue": increment(result.totalTickets),
    "village.shop.stats.totalTickets": increment(result.totalTickets),
    "village.shop.stats.totalSales": increment(result.totalItems),
    "village.shop.stats.customersServed": increment(result.served),
  };
  const stats = shop.stats || {};
  const discovered = [...new Set([...(stats.discoveredCustomers || []), ...result.newCustomers])];
  updates["village.shop.stats.discoveredCustomers"] = discovered;
  const log = [...(stats.customerLog || [])];
  result.sales.forEach(s => {
    log.push({ customer: s.customerId, customerEmoji: s.customerEmoji, tickets: s.tickets, items: s.items.length, at: Date.now() });
  });
  updates["village.shop.stats.customerLog"] = log.slice(-30);

  await updateDoc(doc(db, MEMBERS, memberId), updates);
  return { ok: true, result };
}

// ── 購買家具（票券 ×2 指數成長）──
export async function buyShopFurniture(memberId, furnitureId) {
  if (!memberId) throw new Error("參數錯誤");
  const def = FURNITURE_DEFS[furnitureId];
  if (!def) throw new Error("找不到家具");
  const snap = await getDoc(doc(db, MEMBERS, memberId));
  const shop = normalizeShop(snap.data()?.village?.shop);
  const cur = shop.furniture?.[furnitureId] || 0;
  const price = getFurniturePrice(furnitureId, cur);
  if (price <= 0) throw new Error("已達最高等級");
  if ((shop.tickets || 0) < price) throw new Error(`票券不足（需 ${price.toLocaleString()}）`);
  await updateDoc(doc(db, MEMBERS, memberId), {
    [`village.shop.furniture.${furnitureId}`]: cur + 1,
    "village.shop.tickets": increment(-price),
  });
  return { ok: true, furnitureId, level: cur + 1, price };
}

// ── 票券兌換真實獎勵（材料同階共享日限；卡包 / 貓貓箱使用週限）──
export async function exchangeTicketsForReward(memberId, rewardId, count = 1) {
  if (!memberId || !Number.isFinite(count) || !Number.isInteger(count) || count < 1) throw new Error("參數錯誤");
  const reward = getExchangeRewardById(rewardId);
  if (!reward) throw new Error("找不到兌換項目");
  const snap = await getDoc(doc(db, MEMBERS, memberId));
  const shop = normalizeShop(snap.data()?.village?.shop);
  if ((shop.level || 1) < (reward.unlockLevel || 1)) throw new Error(`商店 Lv.${reward.unlockLevel} 才能兌換`);
  const remaining = getExchangeRemaining(shop, rewardId);
  const periodLabel = reward.period === "weekly" ? "本週" : "今日";
  if (count > remaining) throw new Error(`${periodLabel}限購剩 ${remaining} 次`);
  const cost = reward.price * count;
  if ((shop.tickets || 0) < cost) throw new Error(`票券不足（需 ${cost.toLocaleString()}）`);

  const key = reward.limitKey || reward.id;
  const exCounts = { ...((shop.exchange || {}).counts || {}) };
  const weeklyCounts = { ...((shop.exchange || {}).weeklyCounts || {}) };
  if (reward.period === "weekly") weeklyCounts[key] = (weeklyCounts[key] || 0) + count;
  else exCounts[key] = (exCounts[key] || 0) + count;
  await updateDoc(doc(db, MEMBERS, memberId), {
    "village.shop.tickets": increment(-cost),
    "village.shop.exchange": { date: todayStr(), counts: exCounts, week: weekStr(), weeklyCounts },
  });

  const chests = [];
  for (let i = 0; i < count; i++) {
    const chest = { id: `vshop_${Date.now()}_${i}`, type: reward.type, from: "village_shop", ts: Date.now() };
    if (reward.family) chest.family = reward.family;
    if (Number.isInteger(reward.tierIndex)) chest.tierIndex = reward.tierIndex;
    chests.push(chest);
  }
  await addChests(memberId, chests);
  return { ok: true, reward, count, cost };
}
