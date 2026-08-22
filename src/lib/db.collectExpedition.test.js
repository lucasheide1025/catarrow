// 回歸測試：collectExpedition 帶 shopGoods 入庫時，絕對不能把既有商店覆寫回 Lv.1 預設。
// 歷史背景：2026-08-16 商店重置事件——舊版 initVillageShopIfNeeded 只看呼叫端
// 傳入的 village?.shop（collectExpedition 傳 null 恆為 undefined），導致每次探險
// 拿到商店道具就把整份 village.shop 覆寫成 Lv.1（葉浩生/施聖凱/楊皇偉受害）。
// 新版在 transaction 內重讀 Firestore 權威資料，只有真的沒有 shop 才建立。
const mockDocuments = new Map();

const mockPathOf = (...parts) => parts.filter(part => part !== undefined && part !== null && typeof part !== "object").join("/");

// nested path + increment + null 的 patch 套用（足以模擬 collectExpedition 的寫入形態）
function mockApplyPatch(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const parts = key.split(".");
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value && typeof value === "object" && "increment" in value && typeof value.increment === "number") {
      cur[last] = (Number(cur[last]) || 0) + value.increment;
    } else if (value === null) {
      cur[last] = null;
    } else {
      cur[last] = value;
    }
  }
  return target;
}

jest.mock("./firebase", () => ({ db: { id: "test-db" } }));
jest.mock("firebase/firestore", () => ({
  collection: (...parts) => ({ path: mockPathOf(...parts) }),
  doc: (...parts) => ({ path: mockPathOf(...parts) }),
  getDoc: async target => {
    const value = mockDocuments.get(target.path);
    return { exists: () => value !== undefined, data: () => value };
  },
  getDocs: jest.fn(),
  getDocsFromCache: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: async (target, patch) => {
    mockDocuments.set(target.path, mockApplyPatch({ ...(mockDocuments.get(target.path) || {}) }, patch));
  },
  deleteDoc: jest.fn(),
  setDoc: async (target, patch) => {
    mockDocuments.set(target.path, { ...(mockDocuments.get(target.path) || {}), ...patch });
  },
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: () => "server-time",
  onSnapshot: jest.fn(),
  increment: value => ({ increment: value }),
  arrayUnion: jest.fn(),
  Timestamp: { fromDate: jest.fn() },
  deleteField: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: async (_db, callback) => {
    return callback({
      get: async target => {
        const value = mockDocuments.get(target.path);
        return { exists: () => value !== undefined, data: () => value };
      },
      set: (target, patch) => mockDocuments.set(target.path, { ...(mockDocuments.get(target.path) || {}), ...patch }),
      update: (target, patch) => mockDocuments.set(target.path, mockApplyPatch({ ...(mockDocuments.get(target.path) || {}) }, patch)),
    });
  },
}));

const { collectExpedition } = require("./db");

beforeEach(() => {
  mockDocuments.clear();
});

// 商店上線後長期經營的玩家：level 由 stats.totalRevenue 推導、tickets 有餘額、家具已升級
function establishedShop() {
  return {
    level: 9,
    tickets: 4321,
    stock: { weapon_1_0: 10 },
    display: [{ slot: "cabinet", goodId: "weapon_1_0" }],
    furniture: { cabinet: 4, counter: 3, flower: 2, flag: 2, sign: 1, luckyCat: 0, starLamp: 0 },
    managerId: "diandian",
    lastVisitedAt: 1700000000000,
    stats: {
      totalSales: 500, totalTickets: 9000, customersServed: 348, totalRevenue: 4009,
      discoveredCustomers: ["小貓仔"], customerLog: [],
    },
    exchange: { date: "2026-08-14", counts: {}, daily: { specialTickets: {} }, week: "2026-08-10", weeklyCounts: {} },
    rushSeconds: 0, rushArrowRemainder: 0, rushClaimedArrowTotal: 0,
    lastAutoSaleAt: 1700000000000,
    createdAt: 1700000000000,
  };
}

function setupEstablishedMember() {
  mockDocuments.set("members/member-1", {
    name: "老玩家",
    village: { resources: { fur_t1: 5 }, shop: establishedShop() },
  });
  mockDocuments.set("chestInventory/member-1", { chests: [] });
}

const SHOP_GOODS_REWARDS = {
  fur_t1: 3,
  chests: [{ id: "exp_chest_1", type: "common", family: "ghost", tier: "common", from: "expedition", ts: 1700000000000 }],
  shopGoods: { weapon_1_3: 2, food_1_5: 1 },
};

test("collectExpedition 帶 shopGoods：既有商店完整保留，僅庫存增量入庫", async () => {
  setupEstablishedMember();

  const result = await collectExpedition("member-1", 0, SHOP_GOODS_REWARDS);

  expect(result).toEqual({ ok: true });
  const member = mockDocuments.get("members/member-1");
  const shop = member.village.shop;

  // 商店本身沒有被覆寫：tickets / 家具 / stats / level 全保留
  expect(shop.tickets).toBe(4321);
  expect(shop.furniture).toEqual(establishedShop().furniture);
  expect(shop.stats).toEqual(establishedShop().stats);
  expect(shop.managerId).toBe("diandian");
  expect(shop.createdAt).toBe(1700000000000);

  // 探險庫存增量入庫（既有庫存不丟）
  expect(shop.stock).toEqual({ weapon_1_0: 10, weapon_1_3: 2, food_1_5: 1 });

  // 資源照常入帳、探險格清空
  expect(member.village.resources.fur_t1).toBe(8);
  expect(member.expeditions).toEqual({ "0": null });

  // 寶箱獨立寫入 chestInventory
  expect(mockDocuments.get("chestInventory/member-1").chests).toHaveLength(1);
});

test("collectExpedition 帶 shopGoods：無商店玩家才建立預設商店並入庫", async () => {
  mockDocuments.set("members/member-1", {
    name: "新玩家",
    village: { resources: {} },
  });
  mockDocuments.set("chestInventory/member-1", { chests: [] });

  const result = await collectExpedition("member-1", 0, SHOP_GOODS_REWARDS);

  expect(result).toEqual({ ok: true });
  const shop = mockDocuments.get("members/member-1").village.shop;

  // 建立的是全新預設商店（等級 1、無票券），但庫存確實入庫
  expect(shop.level).toBe(1);
  expect(shop.tickets).toBe(0);
  expect(shop.stock).toEqual({ weapon_1_3: 2, food_1_5: 1 });
  expect(shop.furniture).toMatchObject({ cabinet: 1, counter: 1 });
  expect(shop.stats.totalRevenue).toBe(0);
});

test("collectExpedition 不帶 shopGoods：完全不觸碰商店（不建立也不覆寫）", async () => {
  setupEstablishedMember();

  const result = await collectExpedition("member-1", 0, { fur_t1: 3 });

  expect(result).toEqual({ ok: true });
  const member = mockDocuments.get("members/member-1");
  const shop = member.village.shop;

  // 商店保持原樣
  expect(shop.tickets).toBe(4321);
  expect(shop.stock).toEqual({ weapon_1_0: 10 });
  expect(member.village.resources.fur_t1).toBe(8);
});

test("collectExpedition 帶 shopGoods：商店結構欄位（票券/家具/stats/店長）零改動，只增量庫存", async () => {
  setupEstablishedMember();
  const stripStock = shop => {
    const { stock, ...rest } = shop;
    return JSON.stringify(rest);
  };
  const before = stripStock(mockDocuments.get("members/member-1").village.shop);

  await collectExpedition("member-1", 0, SHOP_GOODS_REWARDS);

  const after = stripStock(mockDocuments.get("members/member-1").village.shop);
  expect(after).toBe(before);
});
