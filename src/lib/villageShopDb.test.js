const mockTransactionUpdate = jest.fn();
const mockTransactionGet = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, collection, id) => ({ collection, id })),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn(amount => ({ amount })),
  serverTimestamp: jest.fn(() => "server-time"),
  runTransaction: jest.fn(async (db, callback) => callback({
    get: mockTransactionGet,
    update: mockTransactionUpdate,
  })),
}));
jest.mock("./firebase", () => ({ db:{} }));
jest.mock("./db", () => ({ addChests:jest.fn() }));

const { initVillageShopIfNeeded, exchangeTicketsForReward, settleVillageShopAutoSales, completeLiveShopSession, claimVillageShopRushTime } = require("./villageShopDb");
const { todayStr } = require("./villageShop");
const { defaultShopState } = require("./villageShop");
const { liveShopStateSignature } = require("./villageShopLive");
const { SHOP_GOODS } = require("./shopGoodsCatalog");
const { addChests } = require("./db");
const { increment, runTransaction } = require("firebase/firestore");

function memberSnapshot(overrides = {}) {
  const data = {
    specialItems:{ partyBattleTicket:2 },
    coinShopPurchases:{ "some-coin-shop-period":{ party_battle_ticket:99 } },
    village:{ shop:{ tickets:1000, exchange:{ date:todayStr(), counts:{} } } },
    ...overrides,
  };
  return { exists:() => true, data:() => data };
}

beforeEach(() => {
  mockTransactionUpdate.mockReset();
  mockTransactionGet.mockReset();
  addChests.mockReset();
  increment.mockClear();
  runTransaction.mockImplementation(async (db, callback) => callback({
    get:mockTransactionGet,
    update:mockTransactionUpdate,
  }));
});

test("shop initialization never overwrites a persisted shop when caller passes a null or stale village hint", async () => {
  const persistedShop = defaultShopState(1700000000000);
  persistedShop.level = 9;
  persistedShop.tickets = 4321;
  persistedShop.stock.weapon_0 = 77;
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop:persistedShop } }));

  await expect(initVillageShopIfNeeded("member-1", null)).resolves.toBeUndefined();

  expect(mockTransactionGet).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate).not.toHaveBeenCalled();
});

test("shop initialization creates defaults only when persisted member really has no shop", async () => {
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{} }));

  await expect(initVillageShopIfNeeded("member-1", null)).resolves.toBeUndefined();

  expect(mockTransactionGet).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate.mock.calls[0][1]["village.shop"]).toMatchObject({
    level:1,
    tickets:0,
    stock:{},
    stats:{ totalSales:0, totalTickets:0, customersServed:0, totalRevenue:0 },
  });
});

test("special ticket exchange atomically updates existing specialItems and village-only daily usage", async () => {
  mockTransactionGet.mockResolvedValue(memberSnapshot());

  await expect(exchangeTicketsForReward("member-1", "partyBattleTicket", 1)).resolves.toMatchObject({
    ok:true, held:3, count:1,
  });

  expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({
    "village.shop.tickets":250,
    "specialItems.partyBattleTicket":3,
    "village.shop.exchange":{
      date:todayStr(),
      daily:{ specialTickets:{ partyBattleTicket:1 } },
    },
  });
  expect(addChests).not.toHaveBeenCalled();
});

test("transaction revalidates hold cap before any write", async () => {
  mockTransactionGet.mockResolvedValue(memberSnapshot({
    specialItems:{ partyBattleTicket:3 },
  }));

  await expect(exchangeTicketsForReward("member-1", "partyBattleTicket", 1))
    .rejects.toThrow("持有上限 3");
  expect(mockTransactionUpdate).not.toHaveBeenCalled();
});

test("live session persists batched rush consumption in its single guarded transaction", async () => {
  const shop = defaultShopState(1700000000000);
  shop.rushSeconds = 20;
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:1700000000000, seed:123,
    expectedLastVisitedAtMs:1699996400000, manualElapsedSeconds:8,
    manualMode:"rush_manual",
  });

  expect(result).toMatchObject({ ok:true, rushSeconds:12, consumedRushSeconds:8 });
  expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate.mock.calls[0][1]["village.shop.rushSeconds"]).toBe(12);
});

test("live settlement rebuilds authoritative sales with the submitted manual mode", async () => {
  const now = 1700000000000;
  const shop = defaultShopState(now - 20 * 60000);
  shop.lastVisitedAt = now - 20 * 60000;
  shop.furniture.flag = 10;
  const good = SHOP_GOODS[0];
  shop.display = [{ slot:"counter", goodId:good.id }];
  shop.stock = { [good.id]:200 };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:now, seed:9876, expectedLastVisitedAtMs:now - 20 * 60000,
    manualElapsedSeconds:1200, manualMode:"manual",
  });
  expect(result.result.processedVisitors).toBe(30); // 20 backlog + 10 during live session
});

test("transaction settlement bounds rush economics by persisted rush and defaults omitted mode to manual", async () => {
  const now = 1700000000000;
  const good = SHOP_GOODS[0];
  const makeShop = rushSeconds => {
    const shop = defaultShopState(now);
    shop.lastVisitedAt = now - 20 * 60000;
    shop.rushSeconds = rushSeconds;
    shop.furniture.flag = 10;
    shop.furniture.flower = 100;
    shop.furniture.sign = 100;
    shop.display = [{ slot:"counter", goodId:good.id }];
    shop.stock = { [good.id]:500 };
    return shop;
  };
  mockTransactionGet.mockResolvedValueOnce(memberSnapshot({ village:{ shop:makeShop(1) } }));
  const partial = await completeLiveShopSession("member-1", {
    startedAt:now, seed:123, expectedLastVisitedAtMs:now - 20 * 60000,
    manualElapsedSeconds:2, manualMode:"rush_manual",
  });
  expect(partial.result.processedVisitors).toBe(0); // no checkout can finish in two real seconds
  expect(partial.salesClock).toMatchObject({ consumedRushSeconds:1, timelineSeconds:1.5 });
  expect(partial.salesClock).toEqual(expect.objectContaining({
    consumedRushSeconds:partial.consumedRushSeconds,
  }));

  mockTransactionGet.mockResolvedValueOnce(memberSnapshot({ village:{ shop:makeShop(1200) } }));
  const omitted = await completeLiveShopSession("member-1", {
    startedAt:now, seed:123, expectedLastVisitedAtMs:now - 20 * 60000,
    manualElapsedSeconds:2,
  });
  expect(omitted.result.processedVisitors).toBe(0);
  expect(omitted.consumedRushSeconds).toBe(0);
});

test("live settlement rejects an unknown manual mode", async () => {
  await expect(completeLiveShopSession("member-1", {
    startedAt:1700000000000, seed:1, manualMode:"turbo",
  })).rejects.toThrow("manual mode");
  expect(mockTransactionGet).not.toHaveBeenCalled();
});

test("ending a live session deposits sold-item tickets in the same transaction", async () => {
  const now = 1700000000000;
  const shop = defaultShopState(now);
  shop.tickets = 1000;
  const good = SHOP_GOODS[0];
  shop.display = [{ slot:"counter", goodId:good.id }];
  shop.stock = { [good.id]:50 };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:now,
    seed:123,
    expectedLastVisitedAtMs:now - 60 * 60000,
    manualElapsedSeconds:120,
    manualMode:"manual",
  });

  expect(result.result.totalItems).toBeGreaterThan(0);
  expect(result.result.awardedTickets).toBeGreaterThan(0);
  expect(increment).toHaveBeenCalledWith(result.result.awardedTickets);
});

test("ending early settles only customers completed at the button press and preserves the remaining queue", async () => {
  const now = 1700000000000;
  const shop = defaultShopState(now);
  shop.tickets = 1000;
  const good = SHOP_GOODS[0];
  shop.display = [{ slot:"counter", goodId:good.id }];
  shop.stock = { [good.id]:100 };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:now,
    seed:456,
    expectedLastVisitedAtMs:now - 60 * 60000,
    completedVisitors:1,
    manualElapsedSeconds:120,
    manualMode:"manual",
  });

  expect(result.result.events).toHaveLength(1);
  expect(result.result.served + result.result.disappointed).toBe(1);
  const updates = mockTransactionUpdate.mock.calls[0][1];
  expect(updates["village.shop.lastVisitedAt"].getTime()).toBeLessThan(now);
  expect(result.shopAfter.tickets).toBe(1000 + result.result.awardedTickets);
  expect(result.shopAfter.stock).toEqual(updates["village.shop.stock"]);
});

test("live settlement accepts in-session crafting and preserves the added stock", async () => {
  const baseline = defaultShopState(1700000000000);
  baseline.stock.weapon_0 = 8;
  baseline.display = [{ slot:"shelf", goodId:"weapon_0" }];
  const current = { ...baseline, stock:{ ...baseline.stock, weapon_0:11 }, display:[...baseline.display, { slot:"counter", goodId:"food_0" }] };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop:current } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:1700000000000,
    seed:321,
    expectedLastVisitedAtMs:1699996400000,
    stateSignature:liveShopStateSignature(baseline),
    allowedStockAdditions:{ weapon_0:3 },
    initialDisplay:baseline.display,
    manualElapsedSeconds:2,
  });

  const persisted = mockTransactionUpdate.mock.calls[0][1]["village.shop.stock"];
  expect(persisted.weapon_0).toBe((result.result.stockAfter.weapon_0 || 0) + 3);
});

test("live settlement is not rejected when the current stock snapshot changed during business", async () => {
  const baseline = defaultShopState(1700000000000);
  baseline.stock.weapon_0 = 8;
  baseline.display = [{ slot:"shelf", goodId:"weapon_0" }];
  const current = { ...baseline, stock:{ ...baseline.stock, weapon_0:12, armor_0:5 } };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop:current } }));

  await expect(completeLiveShopSession("member-1", {
    startedAt:1700000000000,
    seed:321,
    expectedLastVisitedAtMs:1699996400000,
    stateSignature:liveShopStateSignature(baseline),
    allowedStockAdditions:{ weapon_0:4, armor_0:5 },
    initialDisplay:baseline.display,
    manualElapsedSeconds:2,
  })).resolves.toMatchObject({ ok:true });
});

test("offline sales settle atomically and advance the exact cursor", async () => {
  const shop = defaultShopState(1700000000000);
  shop.lastAutoSaleAt = 1700000000000;
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));
  const result = await settleVillageShopAutoSales("member-1", {
    now:1700003600000,
    expectedLastAutoSaleAtMs:1700000000000,
    stateSignature:liveShopStateSignature(shop),
  });
  expect(result).toMatchObject({ ok:true, result:{ profile:"auto", settledAt:1700003600000 } });
  expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({
    "village.shop.lastAutoSaleAt":new Date(1700003600000),
  });
});

test("offline sales reject a replayed cursor before writing", async () => {
  const shop = defaultShopState(1700000000000);
  shop.lastAutoSaleAt = 1700000005000;
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));
  await expect(settleVillageShopAutoSales("member-1", {
    now:1700003600000,
    expectedLastAutoSaleAtMs:1700000000000,
  })).rejects.toThrow("auto sale cursor");
  expect(mockTransactionUpdate).not.toHaveBeenCalled();
});

test("class end atomically grants rush from official arrow delta and checkpoint prevents replay", async () => {
  const shop = defaultShopState(1700000000000);
  shop.rushArrowRemainder = 7;
  shop.rushClaimedArrowTotal = 100;
  mockTransactionGet.mockResolvedValueOnce(memberSnapshot({ totalArrowsAllTime:108, village:{ shop } }));

  await expect(claimVillageShopRushTime("member-1")).resolves.toMatchObject({
    rushSeconds:60,
    rushArrowRemainder:5,
    rushClaimedArrowTotal:108,
    awardedSeconds:60,
    isReplay:false,
  });
  expect(mockTransactionUpdate.mock.calls[0][1]).toEqual({
    "village.shop.rushSeconds":60,
    "village.shop.rushArrowRemainder":5,
    "village.shop.rushClaimedArrowTotal":108,
  });

  mockTransactionUpdate.mockClear();
  mockTransactionGet.mockResolvedValueOnce(memberSnapshot({
    totalArrowsAllTime:108,
    village:{ shop:{ ...shop, rushSeconds:60, rushArrowRemainder:5, rushClaimedArrowTotal:108 } },
  }));
  await expect(claimVillageShopRushTime("member-1")).resolves.toMatchObject({ isReplay:true, awardedSeconds:0 });
  expect(mockTransactionUpdate).not.toHaveBeenCalled();
});
