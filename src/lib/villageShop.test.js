// src/lib/villageShop.test.js — 商店販售模擬器純邏輯測試
import {
  SHOP_LEVEL_THRESHOLDS, MAX_SHOP_LEVEL, getShopLevel, getShopSpeedBonus, getShopCapBonus,
  getLevelReward, getLevelProgress, FURNITURE_DEFS, getFurniturePrice, getFurnitureTotalPrice,
  calcShopSlots, calcShopRate, calcShopCap, calcWaitingVisitors,
  SHOP_CUSTOMERS, getUnlockedCustomers, pickCustomer,
  simulateServe, SHOP_EXCHANGE_REWARDS, getExchangeRewardById, getExchangeUsed,
  getExchangeRemaining, defaultShopState, normalizeShop, todayStr, weekStr,
} from "./villageShop";
import { SHOP_GOODS, RESOURCE_WORTH, TIER_GOLD } from "./shopGoodsCatalog";

const GOODS_MAP = {};
SHOP_GOODS.forEach(g => { GOODS_MAP[g.id] = g; });

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
      expect(g.visualKey).toMatch(/^(weapon|armor|food)_[0-7]$/);
      expect(g.visualLabel).toBeTruthy();
      expect(g.motifArt).toMatch(/^\/ui\/village\/resource-[a-z]+[1-5]\.webp$/);
    });
    expect(SHOP_GOODS.find(g => g.visualKey === "weapon_0")?.art).toBe("/assets/cat_equip/bow.jpg");
    expect(SHOP_GOODS.find(g => g.visualKey === "armor_0")?.art).toBe("/assets/cat_equip/armor.jpg");
  });

  test("每級解鎖 4 件（L1 起手 4 件，L30 全 120）", () => {
    const byLevel = {};
    SHOP_GOODS.forEach(g => { byLevel[g.unlockLevel] = (byLevel[g.unlockLevel] || 0) + 1; });
    expect(Object.keys(byLevel)).toHaveLength(30); // 30 級全都有新食譜
    Object.values(byLevel).forEach(n => expect(n).toBe(4));
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

  test("配方資源/等級合法，製作費符合 tier", () => {
    for (const g of SHOP_GOODS) {
      expect(g.recipe.length).toBeGreaterThan(0);
      for (const r of g.recipe) {
        expect(["ore", "melon", "fish", "meat", "driedfish", "can"].includes(r.resource)).toBe(true);
        expect(r.tier).toBe(g.tier);
        expect(r.count).toBeGreaterThan(0);
      }
      expect(g.gold).toBe(TIER_GOLD[g.tier]);
      // price = ceil(sum × RESOURCE_WORTH)
      const sum = g.recipe.reduce((s, r) => s + r.count, 0);
      expect(g.price).toBe(Math.ceil(sum * RESOURCE_WORTH[g.tier]));
    }
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
    expect(calcShopCap(null, 1)).toBe(10);
    // 滿級：rate = 1×(1+speed/100)×(1.8)×(2.0)×(1.25)
    const speedBonus = getShopSpeedBonus(30);
    expect(calcShopRate({ flower: 10, sign: 10, luckyCat: 1 }, 30))
      .toBeCloseTo((1 + speedBonus / 100) * 1.8 * 2.0 * 1.25);
    // cap = (10 + 8×10 + capBonus30) × 1.1
    const capBonus = getShopCapBonus(30);
    expect(calcShopCap({ flag: 10, starLamp: 1 }, 30)).toBe(Math.round((10 + 80 + capBonus) * 1.1));
  });

  test("顧客累積：時間越久越多，cap 截斷", () => {
    const shop = defaultShopState(0);
    shop.lastVisitedAt = 1000 * 60 * 60; // 顯式基準點（defaultShopState 預設回首 1 小時）
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60)).toBe(0);
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60 + 5 * 60000)).toBe(5);
    expect(calcWaitingVisitors(shop, 1000 * 60 * 60 + 60 * 60000)).toBe(10); // cap
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
    // 60 分鐘 → 10 位（cap）
    const res = simulateServe(shop, { now: Date.now() + 60 * 60000, goodsMap: GOODS_MAP, rng: makeRng(3) });
    expect(res.waiting).toBe(10);
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
    expect(res.waiting).toBe(10);
    expect(res.served).toBe(0);
    expect(res.disappointed).toBe(10);
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
  test("38 項獎勵：35 個材料箱 + 3 個特殊獎勵", () => {
    expect(SHOP_EXCHANGE_REWARDS).toHaveLength(38);
    expect(SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat")).toHaveLength(35);
    expect(SHOP_EXCHANGE_REWARDS.some(r => r.type === "gold")).toBe(false);
  });

  test("材料箱涵蓋七族 T1~T5，沒有 T6", () => {
    const mats = SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat");
    expect(new Set(mats.map(r => r.family)).size).toBe(7);
    expect([...new Set(mats.map(r => r.tierIndex))].sort()).toEqual([1,2,3,4,5]);
    expect(mats.some(r => r.tierIndex === 6)).toBe(false);
  });

  test("五階材料價格、解鎖與共用每日額度正確", () => {
    const expected = {
      1: { price:15, dailyLimit:3, unlockLevel:1 },
      2: { price:25, dailyLimit:3, unlockLevel:7 },
      3: { price:40, dailyLimit:2, unlockLevel:13 },
      4: { price:60, dailyLimit:2, unlockLevel:19 },
      5: { price:90, dailyLimit:1, unlockLevel:25 },
    };
    for (const [tierText, cfg] of Object.entries(expected)) {
      const tier = Number(tierText);
      const rewards = SHOP_EXCHANGE_REWARDS.filter(r => r.type === "family_mat" && r.tierIndex === tier);
      expect(rewards).toHaveLength(7);
      rewards.forEach(r => {
        expect(r.price).toBe(cfg.price);
        expect(r.dailyLimit).toBe(cfg.dailyLimit);
        expect(r.unlockLevel).toBe(cfg.unlockLevel);
        expect(r.limitKey).toBe(`material_t${tier}`);
        expect(r.period).toBe("daily");
      });
    }
  });

  test("藥水、卡包、貓貓箱價值與週期正確", () => {
    expect(getExchangeRewardById("potion")).toMatchObject({ price:40, dailyLimit:2, period:"daily", unlockLevel:1 });
    expect(getExchangeRewardById("card_pack")).toMatchObject({ price:600, weeklyLimit:1, period:"weekly", unlockLevel:13 });
    expect(getExchangeRewardById("cat_box")).toMatchObject({ price:2000, weeklyLimit:1, period:"weekly", unlockLevel:25 });
  });

  test("同階不同族材料箱共用每日額度", () => {
    const shop = defaultShopState(Date.now());
    shop.exchange.counts.material_t3 = 1;
    expect(getExchangeUsed(shop, "mat_ghost_t3")).toBe(1);
    expect(getExchangeRemaining(shop, "mat_treasure_t3")).toBe(1);
    shop.exchange.counts.material_t3 = 2;
    expect(getExchangeRemaining(shop, "mat_exam_t3")).toBe(0);
  });

  test("每日限量會換日重置", () => {
    const shop = defaultShopState(Date.now());
    shop.exchange = { ...shop.exchange, date: todayStr(), counts: { material_t1: 3 } };
    expect(getExchangeRemaining(shop, "mat_ghost_t1")).toBe(0);
    shop.exchange.date = "2000-01-01";
    expect(getExchangeUsed(shop, "mat_ghost_t1")).toBe(0);
    expect(getExchangeRemaining(shop, "mat_ghost_t1")).toBe(3);
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
