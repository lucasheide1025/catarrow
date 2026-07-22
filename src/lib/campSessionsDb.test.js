import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  createCampSession,
  deleteCampSession,
  getCampSessions,
  subscribeCampSessions,
  updateCampSession,
} from "./campSessionsDb";

jest.mock("./firebase", () => ({ db: { test: true } }));
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
}));

const snapshot = (...items) => ({
  docs: items.map(({ id, ...data }) => ({ id, data: () => data })),
});

beforeEach(() => {
  collection.mockImplementation((...parts) => ({ kind: "collection", parts }));
  doc.mockImplementation((...parts) => ({ kind: "doc", parts }));
  serverTimestamp.mockReturnValue("SERVER_TIMESTAMP");
});

test("gets and subscribes to camp sessions newest first", async () => {
  const older = { id: "older", createdAt: { toMillis: () => 10 } };
  const newer = { id: "newer", createdAt: { toMillis: () => 20 } };
  getDocs.mockResolvedValue(snapshot(older, newer));

  await expect(getCampSessions()).resolves.toEqual([newer, older]);
  expect(collection).toHaveBeenCalledWith({ test: true }, "campSessions");

  const callback = jest.fn();
  onSnapshot.mockImplementation((_ref, handler) => {
    handler(snapshot(older, newer));
    return "unsubscribe";
  });
  expect(subscribeCampSessions(callback)).toBe("unsubscribe");
  expect(callback).toHaveBeenCalledWith([newer, older]);
});

test("creates a normalized camp session and preserves an explicit inactive state", async () => {
  addDoc.mockResolvedValue({ id: "session-1" });
  await expect(createCampSession({ name: "Camp", active: false }, "coach-1"))
    .resolves.toBe("session-1");

  expect(addDoc).toHaveBeenCalledWith(expect.anything(), {
    name: "Camp",
    startDate: "",
    endDate: "",
    active: false,
    createdBy: "coach-1",
    createdAt: "SERVER_TIMESTAMP",
  });
  expect(serverTimestamp).toHaveBeenCalledTimes(1);
});

test("updates and deletes the expected camp session document", async () => {
  await updateCampSession("session-1", { active: false });
  expect(updateDoc).toHaveBeenCalledWith(
    { kind: "doc", parts: [{ test: true }, "campSessions", "session-1"] },
    { active: false },
  );

  await deleteCampSession("session-1");
  expect(deleteDoc).toHaveBeenCalledWith(
    { kind: "doc", parts: [{ test: true }, "campSessions", "session-1"] },
  );
  expect(doc).toHaveBeenCalledTimes(2);
});
