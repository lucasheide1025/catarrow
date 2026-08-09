// src/lib/villageShopLive.js — 貓貓村商店 V7 即時營運邏輯
// 經濟結果仍由 deterministic simulateServe 產生；此檔只增加可重播的營運時間軸、顧客演出與臨時委託。

import { SHOP_CUSTOMERS, simulateServe, getShopLastVisitedMs } from "./villageShop";

export const SHOP_SALES_RATE_PROFILES = Object.freeze({
  rush_manual: Object.freeze({ id:"rush_manual", multiplier:5, consumesRush:true }),
  manual: Object.freeze({ id:"manual", multiplier:0.5, consumesRush:false }),
  auto: Object.freeze({ id:"auto", multiplier:0.05, consumesRush:false }),
});

export function getShopSalesRateProfile(mode) {
  return SHOP_SALES_RATE_PROFILES[mode] || SHOP_SALES_RATE_PROFILES.auto;
}

export function advanceManualShopClock({ rushSeconds = 0, manualActive = false, manualMode = null, elapsedSeconds = 0 } = {}) {
  const remainingRush = Math.max(0, Number(rushSeconds) || 0);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (!manualActive) {
    const profile = getShopSalesRateProfile("auto");
    return { profile, rushSeconds:remainingRush, consumedRushSeconds:0, timelineSeconds:elapsed * profile.multiplier };
  }
  if (manualMode === "manual") {
    const profile = getShopSalesRateProfile("manual");
    return { profile, rushSeconds:remainingRush, consumedRushSeconds:0, timelineSeconds:elapsed * profile.multiplier };
  }
  const consumedRushSeconds = Math.min(remainingRush, elapsed);
  const normalSeconds = elapsed - consumedRushSeconds;
  const rushSecondsAfter = remainingRush - consumedRushSeconds;
  return {
    profile:getShopSalesRateProfile(rushSecondsAfter > 0 ? "rush_manual" : "manual"),
    rushSeconds:rushSecondsAfter,
    consumedRushSeconds,
    timelineSeconds:consumedRushSeconds * SHOP_SALES_RATE_PROFILES.rush_manual.multiplier
      + normalSeconds * SHOP_SALES_RATE_PROFILES.manual.multiplier,
  };
}

export const SHOP_AUTO_SALE_ELAPSED_CAP_MS = 24 * 60 * 60 * 1000;

function timestampMs(value, fallback = 0) {
  if (typeof value === "number") return value;
  const millis = value?.toMillis?.();
  return Number.isFinite(millis) ? millis : fallback;
}

function toUint32(value) {
  return Number(value) >>> 0;
}

export function hashShopSessionSeed(...parts) {
  let hash = 2166136261;
  const text = parts.map(v => String(v ?? "")).join("|");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return toUint32(hash || 1);
}

export function createSeededRng(seed = 1) {
  let state = toUint32(seed || 1);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function liveShopStateSignature(shop) {
  const compact = JSON.stringify({
    display: shop?.display || [],
    stock: shop?.stock || {},
    furniture: shop?.furniture || {},
    level: Number(shop?.level) || 1,
    totalRevenue: Number(shop?.stats?.totalRevenue) || 0,
    lastVisitedAtMs: getShopLastVisitedMs(shop, 0),
  });
  return hashShopSessionSeed(compact);
}

// Offline sales reuse the canonical customer-demand and inventory engine. Scaling the
// elapsed interval (instead of sale values) preserves whole-customer/item semantics.
export function buildAutoShopSale(shop, {
  now = Date.now(),
  goodsMap = {},
  elapsedCapMs = SHOP_AUTO_SALE_ELAPSED_CAP_MS,
} = {}) {
  const settledAt = Number(now) || Date.now();
  const expectedLastAutoSaleAtMs = timestampMs(shop?.lastAutoSaleAt, settledAt);
  const elapsedMs = Math.min(
    Math.max(0, settledAt - expectedLastAutoSaleAtMs),
    Math.max(0, Number(elapsedCapMs) || 0),
  );
  const profile = getShopSalesRateProfile("auto");
  const effectiveElapsedMs = Math.floor(elapsedMs * profile.multiplier);
  const seed = hashShopSessionSeed(
    "auto",
    expectedLastAutoSaleAtMs,
    settledAt,
    liveShopStateSignature(shop),
  );
  const result = simulateServe({
    ...shop,
    lastVisitedAt:settledAt - effectiveElapsedMs,
  }, {
    now:settledAt,
    goodsMap,
    rng:createSeededRng(seed),
  });
  return {
    profile:profile.id,
    rateMultiplier:profile.multiplier,
    expectedLastAutoSaleAtMs,
    stateSignature:liveShopStateSignature(shop),
    settledAt,
    elapsedMs,
    effectiveElapsedMs,
    seed,
    result,
  };
}

const CUSTOMER_GROUP_PROFILES = {
  "貪吃系": { label:"美食巡禮", icon:"🍜", browseScale:1.08, checkoutScale:1 },
  "冒險系": { label:"武器獵人", icon:"🏹", browseScale:1.02, checkoutScale:1 },
  "裝扮系": { label:"裝備控", icon:"🎀", browseScale:1.15, checkoutScale:1.02 },
  "村莊系": { label:"熟客", icon:"🏘️", browseScale:.92, checkoutScale:.92 },
  "神秘系": { label:"神秘客", icon:"🔮", browseScale:1.2, checkoutScale:1.05 },
  "批量系": { label:"大宗採購", icon:"📦", browseScale:1.18, checkoutScale:1.25 },
  "收藏系": { label:"收藏家", icon:"✨", browseScale:1.38, checkoutScale:1.08 },
  "旅行系": { label:"旅人", icon:"🧳", browseScale:1.08, checkoutScale:1 },
};

export function getLiveCustomerProfile(customerOrId) {
  const customer = typeof customerOrId === "string"
    ? SHOP_CUSTOMERS.find(entry => entry.id === customerOrId)
    : customerOrId;
  if (!customer) {
    return { label:"逛店客", icon:"🐾", detail:"正在看看今天的商品", browseScale:1, checkoutScale:1 };
  }
  const base = CUSTOMER_GROUP_PROFILES[customer.group]
    || (String(customer.mode || "").includes("collector")
      ? { label:"收藏家", icon:"✨", browseScale:1.35, checkoutScale:1.08 }
      : { label:"逛店客", icon:"🐾", browseScale:1, checkoutScale:1 });
  const traits = [];
  const qtyMax = Math.max(1, Number(customer.qtyMax) || 1);
  const priceMult = Number(customer.priceMult) || 1;
  const minTier = Math.max(1, Number(customer.minTier) || 1);
  if (qtyMax >= 5) traits.push("會大量採買");
  if (priceMult < 1) traits.push("精打細算");
  else if (priceMult >= 2.5) traits.push("出手豪爽");
  else if (priceMult >= 1.5) traits.push("預算充足");
  if (minTier >= 4) traits.push("偏愛高階品");
  if (String(customer.mode || "").includes("collector")) traits.push("稀有品優先");
  const affinity = customer.affinities?.food > .75 ? "偏愛料理"
    : customer.affinities?.weapon > .75 ? "偏愛武器"
      : customer.affinities?.armor > .75 ? "偏愛裝備" : null;
  if (affinity) traits.push(affinity);
  return {
    ...base,
    detail: traits.slice(0, 2).join("・") || "會依今天的陳列慢慢挑選",
  };
}

export function getLiveActorStage(actor, elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (!actor || elapsed < actor.entryAt || elapsed >= actor.exitAt) return null;
  if (elapsed < actor.browseAt) return "enter";
  if (elapsed < actor.queueAt) return "browse";
  if (elapsed < actor.checkoutAt) return "queue";
  if (elapsed < actor.checkoutEnd) return "checkout";
  return "exit";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// V8：把既有家具轉成「看得見的即時營運節奏」。
// 只影響前端時間軸，不改 simulateServe 的銷售、票券或庫存結果。
export function getShopOperationsProfile(shop) {
  const furniture = shop?.furniture || {};
  const levelOf = id => clamp(
    Math.floor(Number(furniture[id]) || 0),
    0,
    id === "luckyCat" || id === "starLamp" ? 1 : 10,
  );
  const cabinet = Math.max(1, levelOf("cabinet"));
  const counter = Math.max(1, levelOf("counter"));
  const flower = levelOf("flower");
  const flag = levelOf("flag");
  const sign = levelOf("sign");
  const luckyCat = levelOf("luckyCat");
  const starLamp = levelOf("starLamp");

  const checkoutDuration = clamp(960 - counter * 45, 500, 915);
  const checkoutSpeedLabel = checkoutDuration <= 600 ? "俐落" : checkoutDuration <= 760 ? "流暢" : "標準";
  const attraction = clamp(flower * 4 + sign * 5 + luckyCat * 18 + starLamp * 4, 0, 100);
  const entryGapMult = clamp(1 - attraction * .0045, .68, 1);
  const attractionLabel = entryGapMult <= .76 ? "人氣旺" : entryGapMult <= .9 ? "有口碑" : "街坊店";
  const maxConcurrent = (flag >= 3 || starLamp >= 1) ? 3 : 2;
  const comfort = clamp(flower * 7 + starLamp * 25, 0, 95);
  const patienceMs = clamp(950 + comfort * 10, 950, 1900);
  const comfortLabel = comfort >= 60 ? "很舒適" : comfort >= 28 ? "舒服" : "樸實";
  const restockDuration = clamp(840 - cabinet * 37, 450, 803);
  const restockSpeedLabel = restockDuration <= 520 ? "快速補貨" : restockDuration <= 680 ? "順手補貨" : "基本補貨";

  return {
    cabinet, counter, flower, flag, sign, luckyCat, starLamp,
    checkoutDuration, checkoutSpeedLabel,
    attraction, attractionLabel, entryGapMult,
    maxConcurrent,
    comfort, comfortLabel, patienceMs,
    restockDuration, restockSpeedLabel,
  };
}

export function buildLiveShopTimeline(shop, events = [], {
  seed = 1,
  maxConcurrent = null,
  mode = "manual",
} = {}) {
  const baseOperations = getShopOperationsProfile(shop);
  const requestedMax = maxConcurrent == null ? NaN : Number(maxConcurrent);
  const safeMax = Number.isFinite(requestedMax)
    ? Math.max(2, Math.min(3, Math.floor(requestedMax)))
    : baseOperations.maxConcurrent;
  const operations = { ...baseOperations, maxConcurrent:safeMax };
  const rng = createSeededRng(toUint32(seed) ^ 0xA511E9B3);
  const actors = [];
  let previousCheckoutEnd = 0;

  (Array.isArray(events) ? events : []).forEach((event, index) => {
    const customer = SHOP_CUSTOMERS.find(entry => entry.id === event?.customerId);
    const profile = getLiveCustomerProfile(customer || event?.customerId);
    const enterDuration = 430 + Math.floor(rng() * 190);
    const browseDuration = Math.round((1350 + rng() * 760) * profile.browseScale);
    const checkoutDuration = Math.max(430, Math.round(operations.checkoutDuration * profile.checkoutScale));
    // 旺季是連續客潮：前一位推門後下一位立即銜接，不再插入一般來客空窗。
    const desiredGap = mode === "rush_manual"
      ? 120
      : Math.round((650 + Math.floor(rng() * 210)) * operations.entryGapMult);
    let entryAt = index === 0 ? 0 : actors[index - 1].entryAt + desiredGap;
    if (index >= safeMax) entryAt = Math.max(entryAt, actors[index - safeMax].exitAt + 90);
    const browseAt = entryAt + enterDuration;
    const queueAt = browseAt + browseDuration;
    const checkoutAt = Math.max(queueAt, previousCheckoutEnd + 90);
    const checkoutEnd = checkoutAt + checkoutDuration;
    const exitAt = checkoutEnd + 470 + Math.floor(rng() * 180);
    const queueWaitMs = Math.max(0, checkoutAt - queueAt);
    const queueMood = queueWaitMs <= operations.patienceMs * .55 ? "calm"
      : queueWaitMs <= operations.patienceMs * 1.12 ? "waiting" : "strained";
    const greetAt = entryAt;
    const greetEnd = Math.min(browseAt, entryAt + 520);
    const restockAt = event?.outcome === "sale" ? checkoutEnd : null;
    const restockEnd = restockAt == null ? null : restockAt + operations.restockDuration;
    previousCheckoutEnd = checkoutEnd;
    const firstCategory = event?.items?.[0]?.category;
    const browseSide = firstCategory === "food" ? "right"
      : firstCategory === "weapon" ? "left"
        : rng() < .5 ? "left" : "right";
    actors.push({
      eventIndex:index,
      event,
      customerId:event?.customerId,
      profile,
      browseSide,
      entryAt,
      browseAt,
      queueAt,
      checkoutAt,
      checkoutEnd,
      exitAt,
      queueWaitMs,
      queueMood,
      greetAt,
      greetEnd,
      restockAt,
      restockEnd,
    });
  });

  return {
    actors,
    maxConcurrent:safeMax,
    operations,
    totalDuration:actors.length ? Math.max(...actors.map(actor => actor.exitAt)) : 0,
  };
}

export function createLiveShopMission(shop, {
  waiting = 0,
  events = [],
  startIndex = 0,
  rng = Math.random,
} = {}) {
  const level = Math.max(1, Number(shop?.level) || 1);
  const baseReward = Math.min(68, 8 + level * 2);
  const pool = [];
  const future = (Array.isArray(events) ? events : []).slice(Math.max(0, Number(startIndex) || 0));
  const futureSales = future.filter(event => event?.outcome === "sale");
  const futureItems = futureSales.flatMap(event => event?.items || []);
  const futureUnits = futureItems.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
  const futureRevenue = future.reduce((sum, event) => sum + (Number(event?.tickets) || 0), 0);

  if (futureSales.length) {
    const serveTarget = Math.min(futureSales.length, waiting >= 6 ? 4 : waiting >= 3 ? 2 : 1);
    pool.push({
      kind:"serve",
      title:"熟客急單",
      icon:"🐾",
      description:`接單後成功接待 ${serveTarget} 位客人。`,
      target:serveTarget,
      rewardTickets:baseReward,
    });
  } else if (future.length) {
    const target = Math.min(future.length, waiting >= 4 ? 2 : 1);
    pool.push({
      kind:"traffic",
      title:"忙碌時段支援",
      icon:"🚪",
      description:`接單後完成招呼 ${target} 位進店客人。`,
      target,
      rewardTickets:Math.max(6, baseReward - 4),
    });
  }

  const categories = [...new Set(futureItems.map(item => item.category).filter(Boolean))];
  if (categories.length) {
    const category = categories[Math.floor(rng() * categories.length)];
    const label = category === "food" ? "料理" : category === "weapon" ? "武器" : "裝備";
    const available = futureItems.filter(item => item.category === category)
      .reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const target = Math.max(1, Math.min(available, waiting >= 5 ? 2 : 1));
    pool.push({
      kind:"sell_category",
      category,
      title:`${label}採購委託`,
      icon:category === "food" ? "🍜" : category === "weapon" ? "⚔️" : "🛡️",
      description:`接單後賣出 ${target} 件${label}商品。`,
      target,
      rewardTickets:Math.min(76, baseReward + 6),
    });
  }

  const goodCounts = futureItems.reduce((map, item) => {
    if (!item?.goodId) return map;
    const previous = map.get(item.goodId) || { ...item, units:0 };
    previous.units += Number(item.qty) || 1;
    map.set(item.goodId, previous);
    return map;
  }, new Map());
  const vipCandidates = [...goodCounts.values()];
  if (vipCandidates.length) {
    const wanted = vipCandidates[Math.floor(rng() * vipCandidates.length)];
    const target = Math.min(2, Math.max(1, wanted.units));
    pool.push({
      kind:"sell_good",
      goodId:wanted.goodId,
      goodName:wanted.goodName,
      title:`VIP 指定：${wanted.goodName}`,
      icon:"👑",
      description:`VIP 剛進村，接單後替他準備 ${target} 件「${wanted.goodName}」。`,
      target,
      rewardTickets:Math.min(92, baseReward + 14),
    });
  }

  if (futureUnits >= 3) {
    const target = Math.min(futureUnits, waiting >= 7 ? 5 : waiting >= 4 ? 4 : 3);
    pool.push({
      kind:"sell_items",
      title:"商隊大宗採購",
      icon:"🛒",
      description:`商隊臨時補給，接單後總共售出 ${target} 件商品。`,
      target,
      rewardTickets:Math.min(96, baseReward + 16),
    });
  }

  let bestStreak = 0;
  let streak = 0;
  future.forEach(event => {
    streak = event?.outcome === "sale" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  });
  if (bestStreak >= 2) {
    const target = Math.min(3, bestStreak);
    pool.push({
      kind:"sale_streak",
      title:"人氣連單",
      icon:"🔥",
      description:`趁客潮正旺，連續成功成交 ${target} 位客人。`,
      target,
      rewardTickets:Math.min(100, baseReward + 18),
    });
  }

  if (futureRevenue > 0) {
    const plannedTarget = Math.max(18, Math.min(260, 18 + level * 7));
    const revenueTarget = Math.max(1, Math.min(futureRevenue, plannedTarget));
    pool.push({
      kind:"revenue",
      title:"村長臨時採買",
      icon:"📜",
      description:`接單後再賺到 ${revenueTarget} 票券營業額。`,
      target:revenueTarget,
      rewardTickets:Math.min(84, baseReward + 10),
    });
  }

  const fallback = {
    kind:"traffic",
    title:"店內支援",
    icon:"🚪",
    description:"完成招呼 1 位進店客人。",
    target:1,
    rewardTickets:Math.max(6, baseReward - 4),
  };
  const mission = pool[Math.floor(rng() * pool.length)] || pool[0] || fallback;
  return {
    ...mission,
    id:`${mission.kind}:${mission.goodId || mission.category || "all"}:${mission.target}`,
  };
}

export function evaluateLiveShopMission(mission, events, startIndex = 0) {
  if (!mission) return null;
  const safeStart = Math.max(0, Math.floor(Number(startIndex) || 0));
  const source = Array.isArray(events) ? events.slice(safeStart) : [];
  let progress = 0;

  if (mission.kind === "serve") {
    progress = source.filter(event => event?.outcome === "sale").length;
  } else if (mission.kind === "traffic") {
    progress = source.length;
  } else if (mission.kind === "sell_category") {
    progress = source.reduce((sum, event) => sum + (event?.items || [])
      .filter(item => item.category === mission.category)
      .reduce((n, item) => n + (Number(item.qty) || 1), 0), 0);
  } else if (mission.kind === "revenue") {
    progress = source.reduce((sum, event) => sum + (Number(event?.tickets) || 0), 0);
  } else if (mission.kind === "sell_good") {
    progress = source.reduce((sum, event) => sum + (event?.items || [])
      .filter(item => item.goodId === mission.goodId)
      .reduce((n, item) => n + (Number(item.qty) || 1), 0), 0);
  } else if (mission.kind === "sell_items") {
    progress = source.reduce((sum, event) => sum + (event?.items || [])
      .reduce((n, item) => n + (Number(item.qty) || 1), 0), 0);
  } else if (mission.kind === "sale_streak") {
    let run = 0;
    source.forEach(event => {
      run = event?.outcome === "sale" ? run + 1 : 0;
      progress = Math.max(progress, run);
    });
  }

  const target = Math.max(1, Number(mission.target) || 1);
  return {
    ...mission,
    progress,
    completed:progress >= target,
    pct:Math.min(100, Math.round((progress / target) * 100)),
  };
}

export function buildLiveShopSession(shop, {
  now = Date.now(),
  seed = null,
  goodsMap = {},
  mode = "manual",
  visitorLimit = Infinity,
} = {}) {
  const startedAt = Number(now) || Date.now();
  const expectedLastVisitedAtMs = getShopLastVisitedMs(shop, startedAt);
  const resolvedSeed = seed == null
    ? hashShopSessionSeed(expectedLastVisitedAtMs, startedAt, shop?.stats?.totalRevenue || 0)
    : toUint32(seed);
  const result = simulateServe(shop, {
    now:startedAt,
    goodsMap,
    rng:createSeededRng(resolvedSeed),
    visitorLimit,
  });
  const offerAt = result.waiting <= 1
    ? 0
    : Math.min(result.waiting - 1, Math.max(1, Math.floor(result.waiting * .2)));
  const mission = createLiveShopMission(shop, {
    waiting:result.waiting,
    events:result.events,
    startIndex:offerAt,
    rng:createSeededRng(resolvedSeed ^ 0x9E3779B9),
  });
  const timeline = buildLiveShopTimeline(shop, result.events, { seed:resolvedSeed, mode });

  return {
    seed:resolvedSeed,
    startedAt,
    expectedLastVisitedAtMs,
    stateSignature:liveShopStateSignature(shop),
    initialDisplay:(shop.display || []).map(entry => ({ slot:entry.slot || "counter", goodId:entry.goodId || null })),
    offerAt,
    mission,
    timeline,
    result,
  };
}
