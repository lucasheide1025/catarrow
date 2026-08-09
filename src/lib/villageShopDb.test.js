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

const { exchangeTicketsForReward, settleVillageShopAutoSales, completeLiveShopSession } = require("./villageShopDb");
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
  });

  expect(result).toMatchObject({ ok:true, rushSeconds:12, consumedRushSeconds:8 });
  expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
  expect(mockTransactionUpdate.mock.calls[0][1]["village.shop.rushSeconds"]).toBe(12);
});

test("ending a live session deposits sold-item tickets in the same transaction", async () => {
  const now = 1700000000000;
  const shop = defaultShopState(now);
  const good = SHOP_GOODS[0];
  shop.display = [{ slot:"counter", goodId:good.id }];
  shop.stock = { [good.id]:50 };
  mockTransactionGet.mockResolvedValue(memberSnapshot({ village:{ shop } }));

  const result = await completeLiveShopSession("member-1", {
    startedAt:now,
    seed:123,
    expectedLastVisitedAtMs:now - 60 * 60000,
    manualElapsedSeconds:30,
    manualMode:"manual",
  });

  expect(result.result.totalItems).toBeGreaterThan(0);
  expect(result.result.awardedTickets).toBeGreaterThan(0);
  expect(increment).toHaveBeenCalledWith(result.result.awardedTickets);
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
