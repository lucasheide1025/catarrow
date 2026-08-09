const mockDocuments = new Map();
let mockTransactionTail = Promise.resolve();

const mockPathOf = (...parts) => parts.filter(part => part !== undefined && part !== null && typeof part !== "object").join("/");

jest.mock("./firebase", () => ({ db: { id: "test-db" } }));
jest.mock("firebase/firestore", () => {
  return {
    collection: (...parts) => ({ path: mockPathOf(...parts) }),
    doc: (...parts) => ({ path: mockPathOf(...parts) }),
    getDoc: async target => {
      const value = mockDocuments.get(target.path);
      return { exists: () => value !== undefined, data: () => value };
    },
    getDocs: jest.fn(),
    getDocsFromCache: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    setDoc: async (target, patch) => {
      await Promise.resolve();
      mockDocuments.set(target.path, { ...(mockDocuments.get(target.path) || {}), ...patch });
    },
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: () => "timestamp",
    onSnapshot: jest.fn(),
    increment: jest.fn(value => ({ increment: value })),
    arrayUnion: jest.fn(),
    Timestamp: { fromDate: jest.fn() },
    deleteField: jest.fn(),
    writeBatch: jest.fn(),
    runTransaction: async (_db, callback) => {
      const execute = () => callback({
        get: async target => {
          const value = mockDocuments.get(target.path);
          return { exists: () => value !== undefined, data: () => value };
        },
        set: (target, patch) => mockDocuments.set(target.path, { ...(mockDocuments.get(target.path) || {}), ...patch }),
        update: (target, patch) => mockDocuments.set(target.path, { ...(mockDocuments.get(target.path) || {}), ...patch }),
      });
      const result = mockTransactionTail.then(execute, execute);
      mockTransactionTail = result.catch(() => {});
      return result;
    },
  };
});

const { addMonsterCard } = require("./db");

beforeEach(() => {
  mockDocuments.clear();
  mockTransactionTail = Promise.resolve();
  mockDocuments.set("members/member-1", { role: "member" });
  mockDocuments.set("cardCollections/member-1", { cards: {}, wbCards: {}, equipped: [] });
});

test("concurrent card rewards preserve every awarded card", async () => {
  await Promise.all([
    addMonsterCard("member-1", { monsterId: "ghost-a", name: "A", tier: "common", family: "ghost" }),
    addMonsterCard("member-1", { monsterId: "ghost-b", name: "B", tier: "common", family: "ghost" }),
  ]);

  expect(Object.keys(mockDocuments.get("cardCollections/member-1").cards).sort()).toEqual(["ghost-a", "ghost-b"]);
});
