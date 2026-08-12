// src/lib/villageShop.test.js — 商店販售模擬器純邏輯測試
import {
  SHOP_LEVEL_THRESHOLDS, MAX_SHOP_LEVEL, getShopLevel, getShopSpeedBonus, getShopCapBonus,
  getLevelReward, getLevelProgress, FURNITURE_DEFS, getFurniturePrice, getFurnitureTotalPrice,
  calcShopSlots, calcShopRate, calcShopCap, calcWaitingVisitors,
  SHOP_CUSTOMERS, getUnlockedCustomers, pickCustomer,
  simulateServe, SHOP_EXCHANGE_REWARDS, getExchangeRewardById, getExchangeUsed,
  getExchangeRemaining, defaultShopState, normalizeShop, getShopLastVisitedMs, todayStr, weekStr,
  planQuickShopDisplay,
  claimShopRushTime,
  planShopExchange,
} from "./villageShop";
import { SPECIAL_TICKET_META } from "./shopData";
import {
  SHOP_GOODS, RESOURCE_WORTH, TIER_GOLD, SHOP_GOOD_STOCK_CAP,
  SHOP_VILLAGE_RESOURCE_META, SHOP_QUICK_REFILL_THRESHOLD, SHOP_QUICK_REFILL_TARGET,
  getShopSinkRecommendations, getShopTierOverflowEntries, getShopQuickRefillPlan,
} from "./shopGoodsCatalog";
import {
  buildLiveShopSession, buildLiveShopTimeline, createSeededRng, evaluateLiveShopMission,
  getLiveActorStage, getLiveCustomerProfile, getShopOperationsProfile, hashShopSessionSeed, liveShopStateSignature,
  getShopSalesRateProfile, buildAutoShopSale, advanceManualShopClock,
  countCompletedLiveVisitors,
} from "./villageShopLive";

const GOODS_MAP = {};
SHOP_GOODS.forEach(g => { GOODS_MAP[g.id] = g; });

describe("manual shop rush clock", () => {
  test("旺季時間以真實時間 1:1 消耗與推進", () => {
    expect(advanceManualShopClock({ rushSeconds:30, manualActive:true, manualMode:"rush_manual", elapsedSeconds:12 })).toMatchObject({
      profile:getShopSalesRateProfile("rush_manual"), rushSeconds:18, consumedRushSeconds:12, timelineSeconds:12,
    });
  });
  test("crossing rush expiry seamlessly continues at the 50% manual rate", () => {
    expect(advanceManualShopClock({ rushSeconds:3, manualActive:true, manualMode:"rush_manual", elapsedSeconds:7 })).toMatchObject({
      profile:getShopSalesRateProfile("manual"), rushSeconds:0, consumedRushSeconds:3, timelineSeconds:5,
    });
  });
  test("a closed shop uses auto profile without consuming rush", () => {
    expect(advanceManualShopClock({ rushSeconds:30, manualActive:false, elapsedSeconds:10 })).toMatchObject({
      profile:getShopSalesRateProfile("auto"), rushSeconds:30, consumedRushSeconds:0, timelineSeconds:0.5,
    });
  });
  test("choosing normal business preserves stored rush time", () => {
    expect(advanceManualShopClock({ rushSeconds:30, manualActive:true, manualMode:"manual", elapsedSeconds:10 })).toMatchObject({
      profile:getShopSalesRateProfile("manual"), rushSeconds:30, consumedRushSeconds:0, timelineSeconds:5,
    });
  });
  test("omitting manual mode defaults safely to normal business", () => {
    expect(advanceManualShopClock({ rushSeconds:30, manualActive:true, elapsedSeconds:10 })).toMatchObject({
      profile:getShopSalesRateProfile("manual"), rushSeconds:30, consumedRushSeconds:0, timelineSeconds:5,
    });
  });
});

describe("新版商店旺季時間", () => {
  test("每 10 支新箭兌換 60 秒，未滿 10 支的餘數延續", () => {
    const first = claimShopRushTime({ rushArrowRemainder: 7, rushClaimedArrowTotal: 100 }, 108);
    expect(first).toMatchObject({
      rushSeconds: 60,
      rushArrowRemainder: 5,
      rushClaimedArrowTotal: 108,
      claimedArrowDelta: 8,
      awardedSeconds: 60,
    });
  });

  test("最多保存 1800 秒，重送同一累計箭數可辨識為冪等重放", () => {
    const capped = claimShopRushTime({
      rushSeconds: 1770,
      rushArrowRemainder: 0,
      rushClaimedArrowTotal: 100,
    }, 120);
    expect(capped).toMatchObject({ rushSeconds: 1800, awardedSeconds: 30, isReplay: false });

    const replay = claimShopRushTime(capped, 120);
    expect(replay).toMatchObject({
      rushSeconds: 1800,
      rushClaimedArrowTotal: 120,
      claimedArrowDelta: 0,
      awardedSeconds: 0,
      isReplay: true,
    });
  });
});

describe("offline auto sales", () => {
  test("settles elapsed time at the 5% auto profile and returns itemized sales deterministically", () => {
    const shop = defaultShopState(1700000000000);
    shop.display = SHOP_GOODS.slice(0, 3).map(g => ({ slot:"counter", goodId:g.id }));
    shop.stock = Object.fromEntries(SHOP_GOODS.slice(0, 3).map(g => [g.id, 20]));
    shop.lastAutoSaleAt = 1700000000000;
    const now = 1700000000000 + 60 * 60000;
    const a = buildAutoShopSale(shop, { now, goodsMap:GOODS_MAP });
    const b = buildAutoShopSale(shop, { now, goodsMap:GOODS_MAP });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ profile:"auto", rateMultiplier:0.05, elapsedMs:3600000, effectiveElapsedMs:180000 });
    expect(a.expectedLastAutoSaleAtMs).toBe(1700000000000);
    expect(a.result.waiting).toBe(calcWaitingVisitors({ ...shop, lastVisitedAt:now - 3 * 60000 }, now));
    expect(a.result.totalItems).toBeGreaterThan(0);
    expect(a.result.totalTickets).toBeGreaterThan(0);
    expect(a.result.sales[0].items[0]).toMatchObject({ goodId:expect.any(String), goodName:expect.any(String) });
  });

  test("only sells displayed stock and caps stale elapsed time", () => {
    const shop = defaultShopState(1700000000000);
    const displayedId = SHOP_GOODS[0].id;
    const hiddenId = SHOP_GOODS[10].id;
    shop.display = [{ slot:"counter", goodId:displayedId }];
    shop.stock = { [displayedId]:2, [hiddenId]:50 };
    shop.lastAutoSaleAt = 1700000000000;
    const sale = buildAutoShopSale(shop, { now:1700000000000 + 30 * 86400000, goodsMap:GOODS_MAP });
    expect(sale.elapsedMs).toBe(86400000);
    expect(sale.result.stockAfter[hiddenId]).toBe(50);
    expect(sale.result.totalItems).toBeLessThanOrEqual(2);
  });
});

describe("新版商店營業速率", () => {
  test("旺季使用真實時間 100%，一般手動與離店自動維持 50%／5%", () => {
    expect(getShopSalesRateProfile("rush_manual")).toMatchObject({ multiplier: 1, consumesRush: true });
    expect(getShopSalesRateProfile("manual")).toMatchObject({ multiplier: 0.5, consumesRush: false });
    expect(getShopSalesRateProfile("auto")).toMatchObject({ multiplier: 0.05, consumesRush: false });
  });

  test("三種速度以 100:50:5 改變權威客流，且都由同一庫存規則防止超賣", () => {
    const shop = defaultShopState(1700000000000);
    const good = SHOP_GOODS[0];
    shop.display = [{ slot:"counter", goodId:good.id }];
    shop.stock = { [good.id]:20 };
    shop.furniture.flag = 10;
    shop.rushSeconds = 1200;
    shop.lastVisitedAt = 1699994000000;
    const sessions = ["rush_manual", "manual", "auto"].map(mode =>
      buildLiveShopSession(shop, { now:1700000000000, seed:9876, goodsMap:GOODS_MAP, mode, elapsedSeconds:1200 }).result
    );
    // 100 customers were already waiting when the shop opened. The live
    // session then adds 20/10/1 arrivals at rush/manual/auto demand rates.
    expect(sessions.map(result => result.processedVisitors)).toEqual([120, 110, 101]);
    expect(sessions.every(result => result.totalItems <= 20)).toBe(true);
    expect(sessions.every(result => result.stockAfter[good.id] >= 0)).toBe(true);
  });

  test("權威旺季客流受持久化秒數限制，零秒、部分到期與省略模式都回到一般倍率", () => {
    const last = 1700000000000;
    const base = defaultShopState(last);
    base.lastVisitedAt = last;
    base.furniture.flag = 10;
    base.stock = { [SHOP_GOODS[0].id]:500 };
    base.display = [{ slot:"counter", goodId:SHOP_GOODS[0].id }];
    const build = (rushSeconds, elapsedSeconds, mode) => buildLiveShopSession(
      { ...base, rushSeconds },
      { now:last + 6000 * 1000, elapsedSeconds, seed:123, goodsMap:GOODS_MAP, ...(mode ? { mode } : {}) },
    );
    // 100 were waiting before opening. Only arrivals after opening use the
    // chosen rate; historical backlog is never retroactively accelerated.
    expect(build(0, 1200, "rush_manual").result.processedVisitors).toBe(110);
    expect(build(60, 1200, "rush_manual").result.processedVisitors).toBe(110);
    expect(build(1200, 1200, "rush_manual").result.processedVisitors).toBe(120);
    expect(build(1200, 1200).result.processedVisitors).toBe(110);
    expect(build(1, 2, "rush_manual").demandClock).toMatchObject({
      consumedRushSeconds:1, rushSeconds:0, timelineSeconds:1.5,
    });
  });

  test("1x/2x/4x 只改畫面播放，權威完成數只看真實經過時間", () => {
    const timeline = { actors:[
      { checkoutEnd:1000 }, { checkoutEnd:2000 }, { checkoutEnd:3000 },
    ] };
    expect(countCompletedLiveVisitors(timeline, 1500)).toBe(1);
    expect(countCompletedLiveVisitors(timeline, 1500 * 2)).toBe(3); // visual-only comparison
    expect(countCompletedLiveVisitors(timeline, 1500)).toBe(1);
  });
});

describe("新版商店舊資料相容", () => {
  test("normalizeShop 保留既有資料並補齊、限制新版持久化欄位", () => {
    const normalized = normalizeShop({
      tickets: 88,
      legacyProgress: { badge: "kept" },
      rushSeconds: 9999,
      rushArrowRemainder: 17,
      rushClaimedArrowTotal: 123.9,
      lastAutoSaleAt: 456,
      exchange: {
        date: todayStr(),
        counts: { potion: 1 },
        daily: { specialTickets: { soloBattleTicket: 1 } },
      },
    });
    expect(normalized).toMatchObject({
      tickets: 88,
      legacyProgress: { badge: "kept" },
      rushSeconds: 1800,
      rushArrowRemainder: 9,
      rushClaimedArrowTotal: 123,
      lastAutoSaleAt: 456,
      exchange: {
        counts: { potion: 1 },
        daily: { specialTickets: { soloBattleTicket: 1 } },
      },
    });
  });
});

// 可重現的 LCG rng
function makeRng(seed = 42) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

describe("商品目錄（120 件）", () => {
  test("總數 120：武器/裝備/料理 各 40", () => {
    expect(SHOP_GOODS).toHaveLength(120);
    expect(SHOP_GOODS.filter(g => g.category === "weapon")).toHaveLength(40);
    expect(SHOP_GOODS.filter(g => g.category === "armor")).toHaveLength(40);
    expect(SHOP_GOODS.filter(g => g.category === "food")).toHaveLength(40);
  });

  test("V5 商品視覺 metadata：120 件都有 visualKey / motif，24 種基礎造型跨 T1~T5 共用", () => {
    expect(new Set(SHOP_GOODS.map(g => g.visualKey)).size).toBe(24);
    SHOP_GOODS.forEach(g => {
      expect(g.visualKey).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(g.visualLabel).toBeTruthy();
      expect(g.motifArt).toMatch(/^\/ui\/village\/resource-[a-z]+[1-5]\.webp$/);
    });
    expect(SHOP_GOODS.find(g => g.visualKey === "bow")?.art).toBe("/assets/cat_equip/bow.jpg");
    expect(SHOP_GOODS.find(g => g.visualKey === "chest-armor")?.art).toBe("/assets/cat_equip/armor.jpg");
  });

  test("每級解鎖 4 件（L1 起手 4 件，L30 全 120）", () => {
    const byLevel = {};
    SHOP_GOODS.forEach(g => { byLevel[g.unlockLevel] = (byLevel[g.unlockLevel] || 0) + 1; });
    expect(Object.keys(byLevel)).toHaveLength(30); // 30 級全都有新食譜
    Object.values(byLevel).forEach(n => expect(n).toBe(4));
  });

  test("Lv1 同時開放武器、裝備與料理，讓初始檯面立即可用", () => {
    const levelOneCategories = new Set(SHOP_GOODS.filter(g => g.unlockLevel === 1).map(g => g.category));
    expect(levelOneCategories).toEqual(new Set(["weapon", "armor", "food"]));
  });

  test("tier 門檻：T3 最早 Lv5、T4 最早 Lv10、T5 最早 Lv13", () => {
    const minUnlock = {};
    SHOP_GOODS.forEach(g => {
      minUnlock[g.tier] = Math.min(minUnlock[g.tier] ?? 99, g.unlockLevel);
    });
    expect(minUnlock[1]).toBeLessThanOrEqual(1);
    expect(minUnlock[3]).toBeGreaterThanOrEqual(5);
    expect(minUnlock[4]).toBeGreaterThanOrEqual(10);
    expect(minUnlock[5]).toBeGreaterThanOrEqual(13);
  });

  test("定價區間符合 spec：T1 6~12、T2 15~25、T3 30~50、T4 60~100、T5 120~200", () => {
    const ranges = { 1: [Infinity, -Infinity], 2: [Infinity, -Infinity], 3: [Infinity, -Infinity], 4: [Infinity, -Infinity], 5: [Infinity, -Infinity] };
    SHOP_GOODS.forEach(g => {
      ranges[g.tier][0] = Math.min(ranges[g.tier][0], g.price);
      ranges[g.tier][1] = Math.max(ranges[g.tier][1], g.price);
    });
    expect(ranges[1][0]).toBeGreaterThanOrEqual(6);  expect(ranges[1][1]).toBeLessThanOrEqual(12);
    expect(ranges[2][0]).toBeGreaterThanOrEqual(15); expect(ranges[2][1]).toBeLessThanOrEqual(25);
    expect(ranges[3][0]).toBeGreaterThanOrEqual(30); expect(ranges[3][1]).toBeLessThanOrEqual(50);
    expect(ranges[4][0]).toBeGreaterThanOrEqual(60); expect(ranges[4][1]).toBeLessThanOrEqual(100);
    expect(ranges[5][0]).toBeGreaterThanOrEqual(120); expect(ranges[5][1]).toBeLessThanOrEqual(200);
  });

  test("V9 配方只消耗九種村莊分層資源，不吃箭露/扭蛋幣/怪物素材", () => {
    const allowed = new Set(Object.keys(SHOP_VILLAGE_RESOURCE_META));
    for (const g of SHOP_GOODS) {
      expect(g.recipe.length).toBeGreaterThan(0);
      for (const r of g.recipe) {
        expect(allowed.has(r.resource)).toBe(true);
        expect(["arrowdew", "gachaToken", "mission"].includes(r.resource)).toBe(false);
        expect(r.tier).toBe(g.tier);
        expect(r.count).toBeGreaterThan(0);
      }
      expect(g.gold).toBe(TIER_GOLD[g.tier]);
      // price = ceil(sum × RESOURCE_WORTH)
      const sum = g.recipe.reduce((s, r) => s + r.count, 0);
      expect(g.price).toBe(Math.ceil(sum * RESOURCE_WORTH[g.tier]));
    }
  });

  test("V9 九種村莊資源都有實際商品去處，貓毛/貓薄荷/貓貓射手正式進入配方", () => {
    const used = new Set(SHOP_GOODS.flatMap(g => g.recipe.map(r => r.resource)));
    expect([...used].sort()).toEqual(Object.keys(SHOP_VILLAGE_RESOURCE_META).sort());
    expect(used.has("fur")).toBe(true);
    expect(used.has("potion")).toBe(true);
    expect(used.has("archer")).toBe(true);
  });

  test("V9 T1/T2 不要求後段採集資源，T3 起才導入 potion/fur/archer", () => {
    const early = SHOP_GOODS.filter(g => g.tier <= 2).flatMap(g => g.recipe);
    expect(early.some(r => ["potion", "fur", "archer"].includes(r.resource))).toBe(false);
    const late = SHOP_GOODS.filter(g => g.tier >= 3).flatMap(g => g.recipe);
    expect(late.some(r => r.resource === "potion")).toBe(true);
    expect(late.some(r => r.resource === "fur")).toBe(true);
    expect(late.some(r => r.resource === "archer")).toBe(true);
  });

  test("V9 商品製作不再消耗金幣，庫存上限提高為 999", () => {
    expect(new Set(Object.values(TIER_GOLD))).toEqual(new Set([0]));
    expect(SHOP_GOOD_STOCK_CAP).toBe(999);
    SHOP_GOODS.forEach(g => expect(g.gold).toBe(0));
  });

  test("V9 去化推薦會優先挑能實際大量消耗現有村莊資源的已解鎖商品", () => {
    const shop = defaultShopState(1700000000000);
    shop.level = 30;
    shop.stock = {};
    const resources = {};
    for (const id of Object.keys(SHOP_VILLAGE_RESOURCE_META)) {
      for (let tier = 1; tier <= 5; tier++) resources[`${id}_t${tier}`] = 500;
    }
    const recommendations = getShopSinkRecommendations(resources, shop, 4);
    expect(recommendations).toHaveLength(4);
    recommendations.forEach(entry => {
      expect(entry.good.unlockLevel).toBeLessThanOrEqual(30);
      expect(entry.maxCraft).toBeGreaterThan(0);
      expect(entry.maxCraft).toBeLessThanOrEqual(SHOP_GOOD_STOCK_CAP);
      expect(entry.sinkUnits).toBeGreaterThan(0);
    });
    expect(recommendations[0].sinkUnits).toBeGreaterThanOrEqual(recommendations[1].sinkUnits);
  });
});

describe("V10 加工後智慧上架", () => {
  function displayShop() {
    const shop = defaultShopState(1700000000000);
    shop.furniture = { ...shop.furniture, cabinet:2, counter:2 };
    shop.display = [
      { slot:"cabinet", goodId:"weapon-old" },
      { slot:"counter", goodId:"food-old" },
      { slot:"cabinet", goodId:null },
      { slot:"counter", goodId:null },
    ];
    return shop;
  }

  test("料理優先補到空檯面；武器/裝備優先補到空櫃子", () => {
    const shop = displayShop();
    const food = planQuickShopDisplay(shop, "food-new", "food");
    expect(food).toMatchObject({ index:3, slot:"counter", changed:true, full:false });
    expect(food.display[3].goodId).toBe("food-new");

    const weapon = planQuickShopDisplay(shop, "weapon-new", "weapon");
    expect(weapon).toMatchObject({ index:2, slot:"cabinet", changed:true, full:false });
    expect(weapon.display[2].goodId).toBe("weapon-new");
  });

  test("商品已經上架時維持原位，不額外佔展示格", () => {
    const shop = displayShop();
    const plan = planQuickShopDisplay(shop, "food-old", "food");
    expect(plan).toMatchObject({ index:1, slot:"counter", alreadyDisplayed:true, changed:false, full:false });
    expect(plan.display).toEqual(shop.display);
  });

  test("展示格全滿時不替換玩家原本陳列", () => {
    const shop = displayShop();
    shop.display[2].goodId = "armor-old";
    shop.display[3].goodId = "food-other";
    const before = shop.display.map(d => ({ ...d }));
    const plan = planQuickShopDisplay(shop, "weapon-new", "weapon");
    expect(plan).toMatchObject({ index:-1, full:true, changed:false, alreadyDisplayed:false });
    expect(plan.display).toEqual(before);
  });
});

describe("V11 exact-tier 爆倉雷達與快速補貨", () => {
  function resourcesForGood(good, multiplier = 100) {
    return good.recipe.reduce((out, part) => {
      const key = `${part.resource}_t${part.tier}`;
      out[key] = (out[key] || 0) + part.count * multiplier;
      return out;
    }, {});
  }

  test("爆倉雷達固定列出九族 × T1~T5 共 45 個 exact-tier stack，並標出解鎖/可去化狀態", () => {
    const shop = defaultShopState(1700000000000);
    shop.level = 30;
    const consumer = SHOP_GOODS.find(g => g.tier === 3 && g.recipe.some(part => part.resource === "archer"));
    expect(consumer).toBeTruthy();
    const resources = { ...resourcesForGood(consumer, 50), archer_t3:3800 };
    const entries = getShopTierOverflowEntries(resources, shop);
    expect(entries).toHaveLength(45);
    const archer = entries.find(entry => entry.key === "archer_t3");
    expect(archer).toMatchObject({ resource:"archer", tier:3, name:"貓貓射手", amount:3800, unlocked:true, actionable:true });
    expect(archer.minUnlockLevel).toBeGreaterThanOrEqual(1);
    const earlyArcher = entries.find(entry => entry.key === "archer_t1");
    expect(earlyArcher.consumerCount).toBe(0);
    expect(earlyArcher.actionable).toBe(false);
  });

  test("指定 exact resource 後只推薦會消耗該 key 的商品，且依 focused units 排序", () => {
    const shop = defaultShopState(1700000000000);
    shop.level = 30;
    const resources = {};
    for (const id of Object.keys(SHOP_VILLAGE_RESOURCE_META)) {
      for (let t = 1; t <= 5; t++) resources[`${id}_t${t}`] = 1000;
    }
    resources.archer_t3 = 5000;
    const recommendations = getShopSinkRecommendations(resources, shop, 8, "archer_t3");
    expect(recommendations.length).toBeGreaterThan(0);
    recommendations.forEach(entry => {
      expect(entry.good.recipe.some(part => `${part.resource}_t${part.tier}` === "archer_t3")).toBe(true);
      expect(entry.focusUnits).toBeGreaterThan(0);
    });
    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].focusUnits).toBeGreaterThanOrEqual(recommendations[i].focusUnits);
    }
  });

  test("低庫存已上架商品只補到安全目標 30，不會變成另一個 MAX", () => {
    expect(SHOP_QUICK_REFILL_THRESHOLD).toBe(10);
    expect(SHOP_QUICK_REFILL_TARGET).toBe(30);
    const good = SHOP_GOODS[0];
    const shop = defaultShopState(1700000000000);
    shop.display[0] = { slot:"cabinet", goodId:good.id };
    shop.stock[good.id] = 7;
    const plan = getShopQuickRefillPlan(resourcesForGood(good, 100), shop, good.id);
    expect(plan).toMatchObject({ displayed:true, currentStock:7, needsRefill:true, canRefill:true, refillCount:23, target:30 });
  });

  test("快速補貨數量會被實際材料能力限制", () => {
    const good = SHOP_GOODS[0];
    const shop = defaultShopState(1700000000000);
    shop.display[0] = { slot:"cabinet", goodId:good.id };
    shop.stock[good.id] = 0;
    const plan = getShopQuickRefillPlan(resourcesForGood(good, 3), shop, good.id);
    expect(plan.needsRefill).toBe(true);
    expect(plan.refillCount).toBe(3);
    expect(plan.canRefill).toBe(true);
  });

  test("未上架或庫存高於門檻的商品不提供快速補貨；庫存上限狀態也不會誤提示", () => {
    const good = SHOP_GOODS[0];
    const resources = resourcesForGood(good, 100);
    const notDisplayed = defaultShopState(1700000000000);
    notDisplayed.stock[good.id] = 0;
    expect(getShopQuickRefillPlan(resources, notDisplayed, good.id).needsRefill).toBe(false);

    const healthy = defaultShopState(1700000000000);
    healthy.display[0] = { slot:"cabinet", goodId:good.id };
    healthy.stock[good.id] = SHOP_QUICK_REFILL_THRESHOLD + 1;
    expect(getShopQuickRefillPlan(resources, healthy, good.id).needsRefill).toBe(false);

    healthy.stock[good.id] = SHOP_GOOD_STOCK_CAP;
    const capped = getShopQuickRefillPlan(resources, healthy, good.id);
    expect(capped.needsRefill).toBe(false);
    expect(capped.refillCount).toBe(0);
  });
});

describe("商店等級（30 級）", () => {
  test("門檻數值與 spec §5.3 一致", () => {
    expect(SHOP_LEVEL_THRESHOLDS).toEqual([
      0, 300, 700, 1400, 2600, 4500, 7500, 12000, 18500, 28000,
      41000, 59000, 84000, 118000, 165000, 230000, 320000, 440000, 600000, 820000,
      1100000, 1450000, 1900000, 2450000, 3100000, 3900000, 4900000, 6100000, 7500000, 9200000,
    ]);
    expect(MAX_SHOP_LEVEL).toBe(30);
  });

  test("getShopLevel 邊界", () => {
    expect(getShopLevel(0)).toBe(1);
    expect(getShopLevel(299)).toBe(1);
    expect(getShopLevel(300)).toBe(2);
    expect(getShopLevel(9199999)).toBe(29);
    expect(getShopLevel(9200000)).toBe(30);
    expect(getShopLevel(99999999)).toBe(30);
  });

  test("每級獎勵都是 +客速 或 +上限（升級永不空手）", () => {
    for (let lv = 2; lv <= 30; lv++) {
      const r = getLevelReward(lv);
      expect(r).not.toBeNull();
      expect((r.speed || 0) > 0 || (r.cap || 0) > 0).toBe(true);
    }
    expect(getLevelReward(1)).toBeNull();
  });

  test("里程碑：Lv10/20/25/30", () => {
    expect(getLevelReward(10).milestone).toContain("招牌");
    expect(getLevelReward(20).milestone).toContain("招牌");
    expect(getLevelReward(25).milestone).toContain("25");
    expect(getLevelReward(30).milestone).toContain("傳說");
  });

  test("進度條", () => {
    const p = getLevelProgress(150);
    expect(p.level).toBe(1);
    expect(p.next).toBe(300);
    expect(p.maxed).toBe(false);
    const p30 = getLevelProgress(9200000);
    expect(p30.level).toBe(30);
    expect(p30.next).toBeNull();
    expect(p30.maxed).toBe(true);
  });
});

describe("家具（7 類 × 10 階）", () => {
  test("價格 ×2 指數成長 + 總投入 ≈ 79.3 萬", () => {
    expect(getFurniturePrice("cabinet", 0)).toBe(100);
    expect(getFurniturePrice("cabinet", 9)).toBe(51200);
    const sum = ["cabinet", "counter", "flower", "flag", "sign"]
      .reduce((s, f) => s + getFurnitureTotalPrice(f, 10), 0) + 10000 + 16000;
    expect(sum).toBe(793250);
  });

  test("滿級後價格為 0（不可再買）", () => {
    expect(getFurniturePrice("cabinet", 10)).toBe(0);
    expect(getFurniturePrice("luckyCat", 1)).toBe(0);
  });

  test("格位：開局 2 格 → 滿級 21 格", () => {
    expect(calcShopSlots(null)).toBe(2);
    expect(calcShopSlots({})).toBe(2);
    expect(calcShopSlots({ cabinet: 11, counter: 10 })).toBe(21);
  });

  test("客速/上限公式", () => {
    expect(calcShopRate(null, 1)).toBeCloseTo(1.0);
    expect(calcShopCap(null, 1)).toBe(50);
    // 滿級：rate = 1×(1+speed/100)×(1.8)×(2.0)×(1.25)
    const speedBonus = getShopSpeedBonus(30);
    expect(calcShopRate({ flower: 10, sign: 10, luckyCat: 1 }, 30))
      .toBeCloseTo((1 + speedBonus / 100) * 1.8 * 2.0 * 1.25);
    // cap = (10 + 8×10 + capBonus30) × 1.1
    const capBonus = getShopCapBonus(30);
    expect(calcShopCap({ flag: 10, starLamp: 1 }, 30)).toBe(Math.round((10 + 80 + capBonus) * 1.1) * 5);
  });

  test("顧客累積：時間越久越多，cap 截斷", () => {
    const shop = defaultShopState(0);
    shop.lastVisitedAt = 1000 * 60 * 60; // 顯式基準點（defaultShopState 預設回首 1 小時）
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60)).toBe(0);
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60 + 5 * 60000)).toBe(5);
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60 + 60 * 60000)).toBe(50); // 5× cap
  });
});

describe("NPC 顧客（24 位）", () => {
  test("8 族群 × 3 階 = 24 位，逐級解鎖", () => {
    expect(SHOP_CUSTOMERS).toHaveLength(24);
    const groups = new Set(SHOP_CUSTOMERS.map(c => c.group));
    expect(groups.size).toBe(8);
    expect(SHOP_CUSTOMERS.filter(c => c.tier === "common")).toHaveLength(8);
    expect(SHOP_CUSTOMERS.filter(c => c.tier === "rare")).toHaveLength(8);
    expect(SHOP_CUSTOMERS.filter(c => c.tier === "legend")).toHaveLength(8);
    expect(getUnlockedCustomers(1)).toHaveLength(8);
    expect(getUnlockedCustomers(30)).toHaveLength(24);
  });

  test("傳說顧客只在 Lv10 之後陸續登場", () => {
    const legends = SHOP_CUSTOMERS.filter(c => c.tier === "legend").map(c => c.unlockLevel).sort((a, b) => a - b);
    expect(Math.min(...legends)).toBe(10);
    expect(Math.max(...legends)).toBe(30);
  });

  test("pickCustomer 只會抽到已解鎖的，且加權可重現", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const c = pickCustomer(1, rng);
      expect(c.unlockLevel).toBeLessThanOrEqual(1);
    }
    const rngA = makeRng(1), rngB = makeRng(1);
    const seqA = Array.from({ length: 20 }, () => pickCustomer(30, rngA).id);
    const seqB = Array.from({ length: 20 }, () => pickCustomer(30, rngB).id);
    expect(seqA).toEqual(seqB);
  });
});

describe("開店模擬（simulateServe）", () => {
  function shopWithStock(goods, stockCount = 10) {
    const shop = defaultShopState(Date.now());
    shop.display = goods.map((g, i) => ({ slot: i % 2 === 0 ? "cabinet" : "counter", goodId: g.id, qty: stockCount }));
    goods.forEach(g => { shop.stock[g.id] = stockCount; });
    return shop;
  }

  test("等待顧客依時間累積並結算票券", () => {
    const shop = shopWithStock(SHOP_GOODS.slice(0, 8));
    // 60 分鐘 → 50 位（5× cap）
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(3) });
    expect(res.waiting).toBe(50);
    expect(res.totalItems).toBeGreaterThan(0);
    expect(res.totalTickets).toBeGreaterThan(0);
    expect(res.oldLevel).toBe(1);
  });

  test("庫存會減少、不會賣超過庫存", () => {
    const shop = shopWithStock(SHOP_GOODS.slice(0, 2), 3);
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(5) });
    let sold = 0;
    res.sales.forEach(s => sold += s.items.length);
    expect(sold).toBeLessThanOrEqual(6); // 2 商品 × 3 庫存
    res.sales.forEach(s => s.items.forEach(it => {
      expect(shop.stock[it.goodId]).toBeGreaterThanOrEqual(0);
    }));
  });

  test("完全沒上架 → 全員失望、0 收入", () => {
    const shop = defaultShopState(Date.now());
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(9) });
    expect(res.waiting).toBe(50);
    expect(res.served).toBe(0);
    expect(res.disappointed).toBe(50);
    expect(res.totalTickets).toBe(0);
  });

  test("跨等級門檻會推進 newLevel", () => {
    const shop = shopWithStock(SHOP_GOODS.slice(0, 12), 50);
    shop.stats.totalRevenue = 290; // 差 10 就到 Lv2
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(11) });
    expect(res.oldLevel).toBe(1);
    if (res.totalTickets >= 10) {
      expect(res.newLevel).toBeGreaterThanOrEqual(2);
    }
  });

  test("顧客 tier 偏好：小貓仔（maxTier 2）有 T1~T2 可選時不買 T5", () => {
    let kittenSeen = false;
    for (const seed of [3, 7, 11, 13, 17, 19, 23, 29]) {
      const t1 = SHOP_GOODS.find(g => g.tier === 1 && g.category === "food");
      const t5 = SHOP_GOODS.find(g => g.tier === 5 && g.category === "food");
      const shop = defaultShopState(Date.now());
      shop.display = [{ slot: "counter", goodId: t1.id }, { slot: "cabinet", goodId: t5.id }];
      shop.stock = { [t1.id]: 30, [t5.id]: 30 };
      const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(seed) });
      res.sales.forEach(s => {
        if (s.customerId === "小貓仔") {
          kittenSeen = true;
          s.items.forEach(it => expect(it.goodId).toBe(t1.id)); // 只買 T1
        }
      });
    }
    expect(kittenSeen).toBe(true);
  });

  test("顧客 tier 偏好：美食家貓（minTier 5）有 T5 可選時不買 T1", () => {
    let gourmetSeen = false;
    for (let seed = 3; seed < 80 && !gourmetSeen; seed++) {
      const t1 = SHOP_GOODS.find(g => g.tier === 1 && g.category === "food");
      const t5 = SHOP_GOODS.find(g => g.tier === 5 && g.category === "food");
      const shop = defaultShopState(Date.now());
      shop.level = 10; // 解鎖美食家貓
      shop.display = [{ slot: "counter", goodId: t1.id }, { slot: "cabinet", goodId: t5.id }];
      shop.stock = { [t1.id]: 30, [t5.id]: 30 };
      const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(seed) });
      res.sales.forEach(s => {
        if (s.customerId === "美食家貓") {
          gourmetSeen = true;
          s.items.forEach(it => expect(it.tier).toBe(5));
        }
      });
    }
    expect(gourmetSeen).toBe(true);
  });

  test("served + disappointed 不會超過 waiting（不重複計數）", () => {
    const shop = defaultShopState(Date.now());
    shop.display = [{ slot: "cabinet", goodId: SHOP_GOODS[0].id }];
    shop.stock = { [SHOP_GOODS[0].id]: 2 }; // 庫存極少 → 大部分顧客失望
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(29) });
    expect(res.served + res.disappointed).toBeLessThanOrEqual(res.waiting);
  });

  test("同 seed 可重現（DB 端需可重放）", () => {
    const a = simulateServe(shopWithStock(SHOP_GOODS.slice(0, 8)), { now: 1700000000000, goodsMap: GOODS_MAP, rng: makeRng(21) });
    const b = simulateServe(shopWithStock(SHOP_GOODS.slice(0, 8)), { now: 1700000000000, goodsMap: GOODS_MAP, rng: makeRng(21) });
    expect(a.totalTickets).toBe(b.totalTickets);
    expect(a.sales).toEqual(b.sales);
  });
});

describe("票券兌換（經濟 v2）", () => {
  test("40 項獎勵包含三種既有冒險特殊券，且不再提供貓貓箱", () => {
    expect(SHOP_EXCHANGE_REWARDS).toHaveLength(40);
    expect(SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat")).toHaveLength(35);
    expect(SHOP_EXCHANGE_REWARDS.some(r => r.type === "gold")).toBe(false);
    expect(getExchangeRewardById("cat_box")).toBeNull();
    Object.entries(SPECIAL_TICKET_META).forEach(([ticketId, meta]) => {
      expect(getExchangeRewardById(ticketId)).toMatchObject({
        type:"special_ticket", ticketId, label:meta.name, icon:meta.icon,
        holdCap:meta.holdCap, dailyLimit:1, period:"daily",
      });
    });
  });

  test("特殊券各自每日限換一張，且不讀取金幣商店購買紀錄", () => {
    const shop = normalizeShop({
      level:30,
      tickets:9999,
      exchange:{
        date:todayStr(),
        counts:{},
        daily:{ specialTickets:{ soloBattleTicket:1 } },
      },
    });
    expect(getExchangeRemaining(shop, "soloBattleTicket")).toBe(0);
    expect(getExchangeRemaining(shop, "partyBattleTicket")).toBe(1);
    expect(planShopExchange(shop, "partyBattleTicket", 1, {
      partyBattleTicket:2,
    }, {
      // CoinShop 的額度屬於 member.coinShopPurchases，不得影響村莊商店。
      coinShopPurchases:{ "irrelevant-period":{ party_battle_ticket:99 } },
    })).toMatchObject({ ticketId:"partyBattleTicket", heldAfter:3, count:1 });
  });

  test("特殊券兌換在持有上限與每日額度處拒絕，不建立替代道具欄位", () => {
    const shop = normalizeShop({ level:30, tickets:9999 });
    expect(() => planShopExchange(shop, "soloBattleTicket", 1, { soloBattleTicket:5 }))
      .toThrow("持有上限 5");
    expect(() => planShopExchange(shop, "boardDiceTicket", 2, { boardDiceTicket:0 }))
      .toThrow("今日限購剩 1 次");
    const plan = planShopExchange(shop, "boardDiceTicket", 1, { boardDiceTicket:4 });
    expect(plan).toMatchObject({ ticketId:"boardDiceTicket", heldAfter:5 });
    expect(Object.keys(plan)).not.toContain("itemField");
  });

  test("材料箱涵蓋七族 T1~T5，沒有 T6", () => {
    const mats = SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat");
    expect(new Set(mats.map(r => r.family)).size).toBe(7);
    expect([...new Set(mats.map(r => r.tierIndex))].sort()).toEqual([1,2,3,4,5]);
    expect(mats.some(r => r.tierIndex === 6)).toBe(false);
  });

  test("五階材料價格、解鎖與無限兌換正確", () => {
    const expected = {
      1: { price:15, unlockLevel:1 },
      2: { price:25, unlockLevel:7 },
      3: { price:40, unlockLevel:13 },
      4: { price:60, unlockLevel:19 },
      5: { price:90, unlockLevel:25 },
    };
    for (const [tierText, cfg] of Object.entries(expected)) {
      const tier = Number(tierText);
      const rewards = SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat" && r.tierIndex === tier);
      expect(rewards).toHaveLength(7);
      rewards.forEach(r => {
        expect(r.price).toBe(cfg.price);
        expect(r.unlockLevel).toBe(cfg.unlockLevel);
        expect(r.period).toBe("unlimited");
        expect(getExchangeRemaining(defaultShopState(Date.now()), r.id)).toBe(Infinity);
      });
    }
  });

  test("藥水與卡包價值及週期正確", () => {
    expect(getExchangeRewardById("potion")).toMatchObject({ price:40, dailyLimit:2, period:"daily", unlockLevel:1 });
    expect(getExchangeRewardById("card_pack")).toMatchObject({ price:600, weeklyLimit:1, period:"weekly", unlockLevel:13 });
  });

  test("材料箱不受舊每日使用紀錄限制", () => {
    const shop = defaultShopState(Date.now());
    shop.exchange.counts.material_t3 = 1;
    expect(getExchangeUsed(shop, "mat_ghost_t3")).toBe(0);
    expect(getExchangeRemaining(shop, "mat_treasure_t3")).toBe(Infinity);
    shop.exchange.counts.material_t3 = 2;
    expect(getExchangeRemaining(shop, "mat_exam_t3")).toBe(Infinity);
  });

  test("材料箱在換日前後都維持無限兌換", () => {
    const shop = defaultShopState(Date.now());
    shop.exchange = { ...shop.exchange, date: todayStr(), counts: { material_t1: 3 } };
    expect(getExchangeRemaining(shop, "mat_ghost_t1")).toBe(Infinity);
    shop.exchange.date = "2000-01-01";
    expect(getExchangeUsed(shop, "mat_ghost_t1")).toBe(0);
    expect(getExchangeRemaining(shop, "mat_ghost_t1")).toBe(Infinity);
  });

  test("每週限量會換週重置", () => {
    const shop = defaultShopState(Date.now());
    shop.exchange = { ...shop.exchange, week: weekStr(), weeklyCounts: { card_pack: 1 } };
    expect(getExchangeRemaining(shop, "card_pack")).toBe(0);
    shop.exchange.week = "2000-01-03";
    expect(getExchangeUsed(shop, "card_pack")).toBe(0);
    expect(getExchangeRemaining(shop, "card_pack")).toBe(1);
  });

  test("normalizeShop 相容舊 exchange 資料並初始化 weekly 欄位", () => {
    const legacy = normalizeShop({ exchange: { date: todayStr(), counts: { material_t1: 2 } } });
    expect(legacy.exchange.counts.material_t1).toBe(2);
    expect(legacy.exchange.week).toBe(weekStr());
    expect(legacy.exchange.weeklyCounts).toEqual({});
  });

  test("normalizeShop 補齊缺欄位並由營業額推導等級", () => {
    const shop = normalizeShop({ tickets: 5 });
    expect(shop.level).toBe(1);
    expect(shop.display).toHaveLength(2);
    expect(shop.furniture.cabinet).toBe(1);
    const rich = normalizeShop({ stats: { totalRevenue: 300 } });
    expect(rich.level).toBe(2);
  });
});

describe("V6 即時營運 session / 任務", () => {
  function makeLiveShop() {
    const shop = defaultShopState(1700000000000);
    shop.display = SHOP_GOODS.slice(0, 6).map((g, i) => ({ slot: i % 2 ? "counter" : "cabinet", goodId: g.id }));
    shop.stock = Object.fromEntries(SHOP_GOODS.slice(0, 6).map(g => [g.id, 20]));
    shop.lastVisitedAt = 1700000000000;
    return shop;
  }

  test("simulateServe 逐客 events 能完整對回成交與失望人數", () => {
    const shop = makeLiveShop();
    const res = simulateServe(shop, {
      now: 1700000000000 + 60 * 60000,
      goodsMap: GOODS_MAP,
      rng: createSeededRng(31),
    });
    expect(res.events).toHaveLength(res.waiting);
    expect(res.events.filter(e => e.outcome === "sale")).toHaveLength(res.served);
    expect(res.events.filter(e => e.outcome === "disappointed")).toHaveLength(res.disappointed);
    res.events.filter(e => e.outcome === "sale").forEach(e => {
      e.items.forEach(item => expect(["weapon", "armor", "food"]).toContain(item.category));
    });
  });

  test("seed hash / rng 可重現", () => {
    const seed = hashShopSessionSeed("member", 123, 456);
    const a = createSeededRng(seed), b = createSeededRng(seed);
    expect(Array.from({ length: 8 }, () => a())).toEqual(Array.from({ length: 8 }, () => b()));
  });

  test("同一 shop + startedAt + seed 產出相同 live session", () => {
    const shop = makeLiveShop();
    const now = 1700000000000 + 30 * 60000;
    const a = buildLiveShopSession(shop, { now, seed: 123456, goodsMap: GOODS_MAP });
    const b = buildLiveShopSession(shop, { now, seed: 123456, goodsMap: GOODS_MAP });
    expect(a.result.events).toEqual(b.result.events);
    expect(a.mission).toEqual(b.mission);
    expect(a.offerAt).toBe(b.offerAt);
    expect(a.expectedLastVisitedAtMs).toBe(1700000000000);
    expect(a.stateSignature).toBe(b.stateSignature);
  });

  test("任務只計算接單後的逐客事件", () => {
    const mission = { id:"serve:test:2", kind:"serve", target:2, rewardTickets:20 };
    const events = [
      { outcome:"sale", tickets:10, items:[] },
      { outcome:"disappointed", tickets:0, items:[] },
      { outcome:"sale", tickets:10, items:[] },
      { outcome:"sale", tickets:10, items:[] },
    ];
    expect(evaluateLiveShopMission(mission, events, 0)).toMatchObject({ progress:3, completed:true });
    expect(evaluateLiveShopMission(mission, events, 2)).toMatchObject({ progress:2, completed:true });
    expect(evaluateLiveShopMission(mission, events, 3)).toMatchObject({ progress:1, completed:false });
  });

  test("分類任務與營業額任務依 items/tickets 正確累積", () => {
    const events = [
      { outcome:"sale", tickets:15, items:[{ category:"food", qty:1 }, { category:"weapon", qty:1 }] },
      { outcome:"sale", tickets:20, items:[{ category:"food", qty:1 }] },
    ];
    expect(evaluateLiveShopMission({ kind:"sell_category", category:"food", target:2 }, events, 0)).toMatchObject({ progress:2, completed:true });
    expect(evaluateLiveShopMission({ kind:"revenue", target:40 }, events, 0)).toMatchObject({ progress:35, completed:false });
  });

  test("getShopLastVisitedMs 同時支援 number / Timestamp-like", () => {
    expect(getShopLastVisitedMs({ lastVisitedAt:123 }, 999)).toBe(123);
    expect(getShopLastVisitedMs({ lastVisitedAt:{ toMillis:()=>456 } }, 999)).toBe(456);
    expect(getShopLastVisitedMs({}, 999)).toBe(999);
  });

  test("stateSignature 在貨架、庫存或營收基準變更時會改變", () => {
    const shop = makeLiveShop();
    const base = liveShopStateSignature(shop);
    expect(liveShopStateSignature({ ...shop, stock: { ...shop.stock, [SHOP_GOODS[0].id]: 19 } })).not.toBe(base);
    expect(liveShopStateSignature({ ...shop, display: [...shop.display].reverse() })).not.toBe(base);
    expect(liveShopStateSignature({ ...shop, stats: { ...shop.stats, totalRevenue: 1 } })).not.toBe(base);
  });
});


describe("V7 多顧客即時營運舞台", () => {
  function makeV7Shop() {
    const shop = defaultShopState(1700000000000);
    shop.level = 20;
    shop.display = SHOP_GOODS.slice(0, 8).map((g, i) => ({ slot:i % 2 ? "counter" : "cabinet", goodId:g.id }));
    shop.stock = Object.fromEntries(SHOP_GOODS.slice(0, 8).map(g => [g.id, 80]));
    shop.lastVisitedAt = 1700000000000;
    shop.furniture = { ...shop.furniture, counter:4, cabinet:4 };
    return shop;
  }

  test("多人時間軸 deterministic，且保持原事件順序", () => {
    const shop = makeV7Shop();
    const events = Array.from({ length:7 }, (_, i) => ({ customerId:SHOP_CUSTOMERS[i].id, outcome:"sale", items:[{ category:i % 2 ? "food" : "weapon" }], tickets:10 }));
    const a = buildLiveShopTimeline(shop, events, { seed:777, maxConcurrent:3 });
    const b = buildLiveShopTimeline(shop, events, { seed:777, maxConcurrent:3 });
    expect(a).toEqual(b);
    expect(a.actors.map(actor => actor.eventIndex)).toEqual([0,1,2,3,4,5,6]);
    expect(a.actors.map(actor => actor.event)).toEqual(events);
  });

  test("旺季客潮取消一般來客空窗，連續送入可用顧客", () => {
    const shop = makeV7Shop();
    const events = Array.from({ length:7 }, (_, i) => ({ customerId:SHOP_CUSTOMERS[i].id, outcome:"sale", items:[], tickets:10 }));
    const normal = buildLiveShopTimeline(shop, events, { seed:777, maxConcurrent:3, mode:"manual" });
    const rush = buildLiveShopTimeline(shop, events, { seed:777, maxConcurrent:3, mode:"rush_manual" });
    expect(rush.actors[1].entryAt - rush.actors[0].entryAt).toBe(120);
    expect(rush.actors[1].entryAt).toBeLessThan(normal.actors[1].entryAt);
    expect(rush.actors[2].entryAt - rush.actors[1].entryAt).toBe(120);
    expect(rush.actors.map(actor => actor.checkoutEnd - actor.checkoutAt))
      .toEqual(normal.actors.map(actor => actor.checkoutEnd - actor.checkoutAt));
  });

  test("店內最多同時 3 位，而且客流足夠時真的會重疊", () => {
    const shop = makeV7Shop();
    const events = Array.from({ length:9 }, (_, i) => ({ customerId:SHOP_CUSTOMERS[i].id, outcome:"sale", items:[{ category:"food" }], tickets:10 }));
    const timeline = buildLiveShopTimeline(shop, events, { seed:123, maxConcurrent:3 });
    let maxSeen = 0;
    for (let ms = 0; ms <= timeline.totalDuration; ms += 40) {
      const active = timeline.actors.filter(actor => getLiveActorStage(actor, ms)).length;
      maxSeen = Math.max(maxSeen, active);
      expect(active).toBeLessThanOrEqual(3);
    }
    expect(maxSeen).toBeGreaterThanOrEqual(2);
  });

  test("收銀櫃台依序結帳，不會同時處理兩位顧客", () => {
    const shop = makeV7Shop();
    const events = Array.from({ length:6 }, (_, i) => ({ customerId:SHOP_CUSTOMERS[i].id, outcome:"sale", items:[], tickets:10 }));
    const actors = buildLiveShopTimeline(shop, events, { seed:321 }).actors;
    actors.slice(1).forEach((actor, index) => {
      expect(actor.checkoutAt).toBeGreaterThanOrEqual(actors[index].checkoutEnd + 90);
    });
  });

  test("顧客個性直接由既有客群資料派生", () => {
    const bulk = SHOP_CUSTOMERS.find(c => c.group === "批量系");
    const collector = SHOP_CUSTOMERS.find(c => c.group === "收藏系");
    expect(getLiveCustomerProfile(bulk)).toMatchObject({ label:"大宗採購", icon:"📦" });
    expect(getLiveCustomerProfile(collector)).toMatchObject({ label:"收藏家", icon:"✨" });
    expect(getLiveCustomerProfile(bulk).detail.length).toBeGreaterThan(0);
  });

  test("VIP 指定、大宗採購、連續成交任務進度正確", () => {
    const events = [
      { outcome:"sale", tickets:20, items:[{ goodId:"good-a", category:"food", qty:2 }] },
      { outcome:"sale", tickets:15, items:[{ goodId:"good-b", category:"weapon", qty:1 }] },
      { outcome:"disappointed", tickets:0, items:[] },
      { outcome:"sale", tickets:10, items:[{ goodId:"good-a", category:"food", qty:1 }] },
    ];
    expect(evaluateLiveShopMission({ kind:"sell_good", goodId:"good-a", target:3 }, events, 0)).toMatchObject({ progress:3, completed:true });
    expect(evaluateLiveShopMission({ kind:"sell_items", target:4 }, events, 0)).toMatchObject({ progress:4, completed:true });
    expect(evaluateLiveShopMission({ kind:"sale_streak", target:2 }, events, 0)).toMatchObject({ progress:2, completed:true });
  });

  test("session 產生的臨時委託在該輪剩餘 deterministic 事件中可完成", () => {
    const shop = makeV7Shop();
    const session = buildLiveShopSession(shop, { now:1700000000000 + 6 * 60 * 60000, seed:998877, goodsMap:GOODS_MAP });
    expect(session.timeline.actors).toHaveLength(session.result.events.length);
    const finalProgress = evaluateLiveShopMission(session.mission, session.result.events, session.offerAt);
    expect(finalProgress.completed).toBe(true);
  });
});

describe("V8 家具驅動的即時營運", () => {
  const events = Array.from({ length:8 }, (_, i) => ({
    customerId:SHOP_CUSTOMERS[i].id,
    outcome:"sale",
    items:[{ goodId:`good-${i}`, category:i % 2 ? "food" : "weapon", qty:1 }],
    tickets:10 + i,
  }));

  function shopWithFurniture(furniture) {
    const shop = defaultShopState(1700000000000);
    shop.furniture = { ...shop.furniture, ...furniture };
    return shop;
  }

  test("檯面升級會讓即時結帳更快，但不會低於安全下限", () => {
    const low = getShopOperationsProfile(shopWithFurniture({ counter:1 }));
    const high = getShopOperationsProfile(shopWithFurniture({ counter:10 }));
    expect(high.checkoutDuration).toBeLessThan(low.checkoutDuration);
    expect(high.checkoutDuration).toBeGreaterThanOrEqual(500);
  });

  test("花飾/招牌/招財貓提升招客節奏，同 seed 下一位更早進店", () => {
    const quietShop = shopWithFurniture({ flower:0, sign:0, luckyCat:0 });
    const popularShop = shopWithFurniture({ flower:10, sign:10, luckyCat:1 });
    const quiet = buildLiveShopTimeline(quietShop, events, { seed:4242, maxConcurrent:3 });
    const popular = buildLiveShopTimeline(popularShop, events, { seed:4242, maxConcurrent:3 });
    expect(popular.operations.entryGapMult).toBeLessThan(quiet.operations.entryGapMult);
    expect(popular.actors[1].entryAt).toBeLessThan(quiet.actors[1].entryAt);
  });

  test("旗幟 Lv3 或星塵燈會把店內同場容量從 2 提升到 3", () => {
    const low = shopWithFurniture({ flag:0, starLamp:0 });
    const flagShop = shopWithFurniture({ flag:3, starLamp:0 });
    const starShop = shopWithFurniture({ flag:0, starLamp:1 });
    expect(getShopOperationsProfile(low).maxConcurrent).toBe(2);
    expect(getShopOperationsProfile(flagShop).maxConcurrent).toBe(3);
    expect(getShopOperationsProfile(starShop).maxConcurrent).toBe(3);
    expect(buildLiveShopTimeline(flagShop, events, { seed:18 }).maxConcurrent).toBe(3);
  });

  test("舒適家具增加排隊耐性，actor 會產生可重現的 queueMood / wait time", () => {
    const plain = shopWithFurniture({ flower:0, starLamp:0, counter:1 });
    const cozy = shopWithFurniture({ flower:10, starLamp:1, counter:1 });
    expect(getShopOperationsProfile(cozy).patienceMs).toBeGreaterThan(getShopOperationsProfile(plain).patienceMs);
    const a = buildLiveShopTimeline(plain, events, { seed:731, maxConcurrent:3 });
    const b = buildLiveShopTimeline(plain, events, { seed:731, maxConcurrent:3 });
    expect(a).toEqual(b);
    a.actors.forEach(actor => {
      expect(actor.queueWaitMs).toBeGreaterThanOrEqual(0);
      expect(["calm", "waiting", "strained"]).toContain(actor.queueMood);
    });
  });

  test("櫃子升級會縮短補貨演出時間", () => {
    const low = getShopOperationsProfile(shopWithFurniture({ cabinet:1 }));
    const high = getShopOperationsProfile(shopWithFurniture({ cabinet:10 }));
    expect(high.restockDuration).toBeLessThan(low.restockDuration);
    expect(high.restockDuration).toBeGreaterThanOrEqual(450);
  });

  test("V8 時間軸仍保留原始 deterministic 經濟事件，不改商品/票券/outcome", () => {
    const shop = shopWithFurniture({ counter:8, flower:7, flag:3, cabinet:6 });
    const timeline = buildLiveShopTimeline(shop, events, { seed:99 });
    expect(timeline.actors.map(actor => actor.event)).toEqual(events);
    timeline.actors.forEach((actor, index) => {
      expect(actor.event.outcome).toBe(events[index].outcome);
      expect(actor.event.tickets).toBe(events[index].tickets);
      expect(actor.event.items).toEqual(events[index].items);
      expect(actor.restockEnd).toBeGreaterThan(actor.restockAt);
    });
  });
});
