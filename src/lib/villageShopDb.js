// src/lib/villageShopDb.js — 貓貓村商店販售模擬器・DB 層
// 全部寫入都走 members/{id} 的 village.shop（village 已在 firestore.rules 白名單）
// 純邏輯（等級/顧客/模擬/兌換表）在 villageShop.js，此檔只做驗證 + 套用寫入。

import { doc, getDoc, updateDoc, increment, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { addChests } from "./db";
import { SHOP_GOODS, SHOP_GOOD_STOCK_CAP, getGoodById } from "./shopGoodsCatalog";
import {
  normalizeShop, defaultShopState, simulateServe,
  getFurniturePrice, FURNITURE_DEFS, calcShopSlots, calcShopRate, planQuickShopDisplay,
  getExchangeRewardById, getExchangeRemaining, getShopLastVisitedMs, todayStr, weekStr,
  planShopExchange,
  claimShopRushTime,
} from "./villageShop";
import { advanceManualShopClock, buildAutoShopSale, buildLiveShopSession, countCompletedLiveVisitors, evaluateLiveShopMission, liveShopStateSignature } from "./villageShopLive";
import { SHOP_MANAGER_OPTIONS } from "./shopArt";

const MEMBERS = "members";

// 下課成功後領取旺季時間。官方累計箭數與商店 checkpoint 在同一份會員文件，
// 因此用 transaction 讀取、計算、寫回，讓多分頁或重送都不會重複發放。
export async function claimVillageShopRushTime(memberId) {
  if (!memberId) throw new Error("參數錯誤");
  const ref = doc(db, MEMBERS, memberId);
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("找不到會員");
    const data = snap.data();
    const result = claimShopRushTime(
      data.village?.shop,
      data.totalArrowsAllTime,
    );
    if (!result.isReplay) {
      transaction.update(ref, {
        "village.shop.rushSeconds": result.rushSeconds,
        "village.shop.rushArrowRemainder": result.rushArrowRemainder,
        "village.shop.rushClaimedArrowTotal": result.rushClaimedArrowTotal,
      });
    }
    return { ok: true, ...result };
  });
}

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
      exchange: { date: todayStr(), counts: {}, daily: { specialTickets:{} }, week: weekStr(), weeklyCounts: {} },
      lastAutoSaleAt: new Date(Date.now()),
      createdAt: serverTimestamp(),
    },
  });
}

function shopTimestampMs(value, fallback = 0) {
  if (typeof value === "number") return value;
  const millis = value?.toMillis?.();
  return Number.isFinite(millis) ? millis : fallback;
}

export async function settleVillageShopAutoSales(memberId, settlement = {}) {
  if (!memberId) throw new Error("memberId is required");
  const settledAt = Number(settlement.now) || Date.now();
  const ref = doc(db, MEMBERS, memberId);
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("member not found");
    const shop = normalizeShop(snap.data().village?.shop);
    const actualCursor = shopTimestampMs(shop.lastAutoSaleAt, settledAt);
    if (Number.isFinite(settlement.expectedLastAutoSaleAtMs)
        && actualCursor !== settlement.expectedLastAutoSaleAtMs) {
      throw new Error("auto sale cursor changed; refresh before settling again");
    }
    if (Number.isFinite(settlement.stateSignature)
        && liveShopStateSignature(shop) !== settlement.stateSignature) {
      throw new Error("shop state changed; refresh before settling auto sales");
    }
    const goodsMap = Object.fromEntries(SHOP_GOODS.map(g => [g.id, g]));
    const auto = buildAutoShopSale(shop, { now:settledAt, goodsMap });
    const sale = auto.result;
    const stats = shop.stats || {};
    const log = [...(stats.customerLog || [])];
    sale.sales.forEach(entry => log.push({
      customer:entry.customerId,
      customerEmoji:entry.customerEmoji,
      tickets:entry.tickets,
      items:entry.items.length,
      at:settledAt,
      source:"auto",
    }));
    transaction.update(ref, {
      "village.shop.tickets":increment(sale.totalTickets),
      "village.shop.stock":sale.stockAfter,
      "village.shop.lastAutoSaleAt":new Date(settledAt),
      "village.shop.lastVisitedAt":new Date(settledAt),
      "village.shop.stats.totalRevenue":increment(sale.totalTickets),
      "village.shop.stats.totalTickets":increment(sale.totalTickets),
      "village.shop.stats.totalSales":increment(sale.totalItems),
      "village.shop.stats.customersServed":increment(sale.served),
      "village.shop.stats.discoveredCustomers":[...new Set([...(stats.discoveredCustomers || []), ...sale.newCustomers])],
      "village.shop.stats.customerLog":log.slice(-30),
    });
    return { ok:true, result:auto };
  });
}

// ── 製作販售商品（V9 起只消耗村莊分層資源；V10 可同一次寫入順手上架）──
async function craftShopGoodInternal(memberId, goodId, count = 1, { quickStock = false } = {}) {
  if (!memberId || !goodId || !Number.isFinite(count) || !Number.isInteger(count) || count <= 0) throw new Error("參數錯誤");
  const good = getGoodById(goodId);
  if (!good) throw new Error("找不到商品");

  const snap = await getDoc(doc(db, MEMBERS, memberId));
  if (!snap.exists()) throw new Error("找不到會員");
  const data = snap.data();
  const shop = normalizeShop(data.village?.shop);
  if ((shop.level || 1) < good.unlockLevel) throw new Error("商店等級不足，尚未解鎖此食譜");

  const resources = data.village?.resources || {};
  const stock = { ...(shop.stock || {}) };
  const currentStock = Math.max(0, Math.floor(Number(stock[goodId]) || 0));
  const room = Math.max(0, SHOP_GOOD_STOCK_CAP - currentStock);
  if (room <= 0) throw new Error(`商品庫存已達上限 ${SHOP_GOOD_STOCK_CAP}`);

  // V9：要求做 500 件但倉庫只剩 20 格時，只製作/扣除 20 件。
  // 舊版先用 requested count 扣材料，再把庫存 clamp 到 99，會白白吃掉大量資源。
  const craftCount = Math.min(count, room);
  const needResources = {};
  good.recipe.forEach(r => {
    const key = `${r.resource}_t${r.tier}`;
    needResources[key] = (needResources[key] || 0) + r.count * craftCount;
  });
  const needGold = Math.max(0, Number(good.gold) || 0) * craftCount;

  const missing = [];
  for (const [key, need] of Object.entries(needResources)) {
    const have = Math.floor(resources[key] || 0);
    if (have < need) missing.push(`${key}（需 ${need}，有 ${have}）`);
  }
  const coins = Math.max(0, Number(data.coins) || 0);
  if (needGold > 0 && coins < needGold) missing.push(`金幣（需 ${needGold}，有 ${Math.floor(coins)}）`);
  if (missing.length) throw new Error(`材料不足：${missing.join("、")}`);

  const next = currentStock + craftCount;
  const updates = {
    "village.shop.stock": { ...stock, [goodId]: next },
  };
  const displayPlan = quickStock ? planQuickShopDisplay(shop, good.id, good.category) : null;
  if (displayPlan?.changed) updates["village.shop.display"] = displayPlan.display;
  if (needGold > 0) updates.coins = increment(-needGold);
  for (const [key, need] of Object.entries(needResources)) {
    updates[`village.resources.${key}`] = increment(-need);
  }
  await updateDoc(doc(db, MEMBERS, memberId), updates);
  return {
    ok:true,
    count:craftCount,
    requested:count,
    added:craftCount,
    stock:next,
    displayed:Boolean(displayPlan && !displayPlan.full),
    alreadyDisplayed:Boolean(displayPlan?.alreadyDisplayed),
    displayFull:Boolean(displayPlan?.full),
    displayIndex:displayPlan?.index ?? null,
    slot:displayPlan?.slot || null,
  };
}

export async function craftShopGood(memberId, goodId, count = 1) {
  return craftShopGoodInternal(memberId, goodId, count, { quickStock:false });
}

// V10：大量加工 + 智慧補貨共用同一次 getDoc / updateDoc，不多花一輪 Firestore 讀寫。
export async function craftAndStockShopGood(memberId, goodId, count = 1) {
  return craftShopGoodInternal(memberId, goodId, count, { quickStock:true });
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

// ── V6 即時營運：動畫結束後一次權威結算 ────────────────────
// 開店過程完全在前端演出，避免「每位顧客一次 Firestore write」。
// 結算依真實經過時間重建客流，lastVisitedAt 只推進到實際完成接待的需求游標；
// 尚未完成的顧客保留給下一輪。
export async function completeLiveShopSession(memberId, session) {
  if (!memberId || !session || !Number.isFinite(session.startedAt) || !Number.isFinite(session.seed)) {
    throw new Error("營業場次參數錯誤");
  }
  if (session.manualMode != null && !["rush_manual", "manual"].includes(session.manualMode)) {
    throw new Error("invalid manual mode");
  }
  const manualMode = session.manualMode || "manual";
  const ref = doc(db, MEMBERS, memberId);
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("找不到會員");
    const data = snap.data();
    const shop = normalizeShop(data.village?.shop);
    const allowedStockAdditions = Object.fromEntries(Object.entries(session.allowedStockAdditions || {})
      .map(([goodId, count]) => [goodId, Math.max(0, Math.floor(Number(count) || 0))])
      .filter(([, count]) => count > 0));
    const sessionShop = {
      ...shop,
      display:Array.isArray(session.initialDisplay) ? session.initialDisplay : shop.display,
      stock:Object.fromEntries(Object.entries(shop.stock || {}).map(([goodId, count]) => [
        goodId,
        Math.max(0, Math.floor(Number(count) || 0) - (allowedStockAdditions[goodId] || 0)),
      ])),
    };
    const actualLastVisitedAtMs = getShopLastVisitedMs(shop, session.startedAt);

    // transaction 會在資料被其他分頁改寫時自動重試；重試後 guard 會拒絕同批客流再次結算。
    if (Number.isFinite(session.expectedLastVisitedAtMs)
        && Math.abs(actualLastVisitedAtMs - session.expectedLastVisitedAtMs) > 1500) {
      throw new Error("商店已在另一個頁面或裝置更新，請重新開店以避免重複結算。");
    }
    // 營業中允許製造、補貨，也可能同時收到父層 Firestore 快照更新。
    // 因此不能用整份庫存雜湊拒絕結算；重複結算仍由 lastVisitedAt
    // 場次游標防止，庫存則以 transaction 讀到的最新狀態為準。

    const goodsMap = {};
    SHOP_GOODS.forEach(g => { goodsMap[g.id] = g; });
    const fullLive = buildLiveShopSession(sessionShop, {
      now: session.startedAt,
      seed: session.seed,
      goodsMap,
      mode:manualMode,
      elapsedSeconds:session.manualElapsedSeconds,
    });
    const authoritativeCompletedVisitors = countCompletedLiveVisitors(
      fullLive.timeline,
      Math.max(0, Number(session.manualElapsedSeconds) || 0) * 1000,
    );
    const completedVisitors = Math.min(
      fullLive.result.events.length,
      authoritativeCompletedVisitors,
      Number.isFinite(Number(session.completedVisitors))
        ? Math.max(0, Math.floor(Number(session.completedVisitors)))
        : authoritativeCompletedVisitors,
    );
    const live = completedVisitors === fullLive.result.events.length
      ? fullLive
      : buildLiveShopSession(sessionShop, {
          now:session.startedAt,
          seed:session.seed,
          goodsMap,
          mode:manualMode,
          elapsedSeconds:session.manualElapsedSeconds,
          visitorLimit:completedVisitors,
        });
    const result = live.result;

    let mission = null;
    let missionBonus = 0;
    if (session.missionId && session.missionId === fullLive.mission?.id) {
      const requestedStart = Math.floor(Number(session.missionStartIndex));
      const missionStartIndex = Number.isFinite(requestedStart)
        ? Math.max(fullLive.offerAt, requestedStart)
        : fullLive.offerAt;
      mission = evaluateLiveShopMission(fullLive.mission, result.events, missionStartIndex);
      if (mission?.completed) missionBonus = Math.max(0, Math.floor(mission.rewardTickets || 0));
    }

    const awardedTickets = result.totalTickets + missionBonus;
    const rushClock = advanceManualShopClock({
      rushSeconds:shop.rushSeconds, manualActive:true,
      manualMode,
      elapsedSeconds:session.manualElapsedSeconds,
    });
    const persistedStock = Object.fromEntries(Array.from(new Set([
      ...Object.keys(result.stockAfter || {}), ...Object.keys(allowedStockAdditions),
    ])).map(goodId => [goodId, Math.max(0, Number(result.stockAfter?.[goodId]) || 0) + (allowedStockAdditions[goodId] || 0)]));
    const rate = Math.max(0.0001, calcShopRate(sessionShop.furniture, sessionShop.level));
    const consumedThroughMs = completedVisitors >= fullLive.result.waiting
      ? fullLive.authoritativeNow
      : Math.min(fullLive.authoritativeNow, actualLastVisitedAtMs + (completedVisitors / rate) * 60000);
    const updates = {
      "village.shop.tickets": increment(awardedTickets),
      "village.shop.stock": persistedStock,
      "village.shop.lastVisitedAt": new Date(consumedThroughMs),
      "village.shop.stats.totalRevenue": increment(result.totalTickets),
      "village.shop.stats.totalTickets": increment(awardedTickets),
      "village.shop.stats.totalSales": increment(result.totalItems),
      "village.shop.stats.customersServed": increment(result.served),
      "village.shop.rushSeconds": rushClock.rushSeconds,
    };
    const stats = shop.stats || {};
    updates["village.shop.stats.discoveredCustomers"] = [
      ...new Set([...(stats.discoveredCustomers || []), ...result.newCustomers]),
    ];
    const log = [...(stats.customerLog || [])];
    result.sales.forEach(s => {
      log.push({ customer: s.customerId, customerEmoji: s.customerEmoji, tickets: s.tickets, items: s.items.length, at: session.startedAt });
    });
    updates["village.shop.stats.customerLog"] = log.slice(-30);

    transaction.update(ref, updates);
    const shopAfter = {
      ...shop,
      tickets:(Number(shop.tickets) || 0) + awardedTickets,
      stock:persistedStock,
      lastVisitedAt:consumedThroughMs,
      rushSeconds:rushClock.rushSeconds,
      stats:{
        ...stats,
        totalRevenue:(Number(stats.totalRevenue) || 0) + result.totalTickets,
        totalTickets:(Number(stats.totalTickets) || 0) + awardedTickets,
        totalSales:(Number(stats.totalSales) || 0) + result.totalItems,
        customersServed:(Number(stats.customersServed) || 0) + result.served,
        discoveredCustomers:updates["village.shop.stats.discoveredCustomers"],
        customerLog:updates["village.shop.stats.customerLog"],
      },
    };
    return {
      ok: true,
      rushSeconds:rushClock.rushSeconds,
      consumedRushSeconds:rushClock.consumedRushSeconds,
      salesClock:fullLive.demandClock,
      result: { ...result, mission, missionBonus, awardedTickets },
      shopAfter,
    };
  });
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

export async function selectVillageShopManager(memberId, managerId) {
  if (!memberId || !SHOP_MANAGER_OPTIONS.some(manager => manager.id === managerId)) throw new Error("店長選擇參數錯誤");
  await updateDoc(doc(db, MEMBERS, memberId), { "village.shop.managerId":managerId });
  return { ok:true, managerId };
}

// ── 票券兌換真實獎勵（材料同階共享日限；卡包 / 貓貓箱使用週限）──
export async function exchangeTicketsForReward(memberId, rewardId, count = 1) {
  if (!memberId || !Number.isFinite(count) || !Number.isInteger(count) || count < 1) throw new Error("參數錯誤");
  const reward = getExchangeRewardById(rewardId);
  if (!reward) throw new Error("找不到兌換項目");
  if (reward.type === "special_ticket") {
    const ref = doc(db, MEMBERS, memberId);
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("找不到會員");
      const member = snap.data();
      const shop = normalizeShop(member.village?.shop);
      const plan = planShopExchange(shop, rewardId, count, member.specialItems);
      const exchange = {
        ...shop.exchange,
        date: todayStr(),
        daily: {
          ...(shop.exchange?.daily || {}),
          specialTickets: {
            ...(shop.exchange?.daily?.specialTickets || {}),
            [plan.ticketId]: (shop.exchange?.daily?.specialTickets?.[plan.ticketId] || 0) + count,
          },
        },
      };
      transaction.update(ref, {
        "village.shop.tickets": shop.tickets - plan.cost,
        "village.shop.exchange": exchange,
        [`specialItems.${plan.ticketId}`]: plan.heldAfter,
      });
      return { ok:true, reward, count, cost:plan.cost, held:plan.heldAfter };
    });
  }
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
  else if (reward.period !== "unlimited") exCounts[key] = (exCounts[key] || 0) + count;
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
