import { collection, onSnapshot, query, where } from "firebase/firestore";
import { subscribeKidAccounts } from "./db";

jest.mock("./firebase", () => ({ db: { name: "test-db" } }));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
  onSnapshot: jest.fn(),
  increment: jest.fn(),
  arrayUnion: jest.fn(),
  Timestamp: { fromDate: jest.fn() },
  deleteField: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  getDocsFromCache: jest.fn(),
}));

describe("subscribeKidAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collection.mockReturnValue("members-ref");
    where.mockReturnValue("account-type-filter");
    query.mockReturnValue("guest-kid-query");
  });

  test("filters guest and kid accounts in Firestore and preserves callback sorting", () => {
    const unsubscribe = jest.fn();
    let emitSnapshot;
    onSnapshot.mockImplementation((target, onNext) => {
      emitSnapshot = onNext;
      return unsubscribe;
    });
    const callback = jest.fn();

    expect(subscribeKidAccounts(callback)).toBe(unsubscribe);
    expect(collection).toHaveBeenCalledWith({ name: "test-db" }, "members");
    expect(where).toHaveBeenCalledWith("accountType", "in", ["guest", "kid"]);
    expect(query).toHaveBeenCalledWith("members-ref", "account-type-filter");
    expect(onSnapshot).toHaveBeenCalledWith("guest-kid-query", expect.any(Function));

    emitSnapshot({
      docs: [
        { id: "guest-older", data: () => ({ accountType: "guest", lastLoginAt: { toMillis: () => 10 } }) },
        { id: "kid-newer", data: () => ({ accountType: "kid", lastLoginAt: { toMillis: () => 20 } }) },
      ],
    });

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({ id: "kid-newer", accountType: "kid" }),
      expect.objectContaining({ id: "guest-older", accountType: "guest" }),
    ]);
  });

  test("does not swallow synchronous subscription errors", () => {
    const error = new Error("listener setup failed");
    onSnapshot.mockImplementation(() => { throw error; });

    expect(() => subscribeKidAccounts(jest.fn())).toThrow(error);
  });
});
