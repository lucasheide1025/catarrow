const mockDocuments = new Map();
const mockDirectUpdate = jest.fn();

const mockPath = (...parts) => parts.filter(value => typeof value !== "object").join("/");

jest.mock("./firebase", () => ({ db:{} }));
jest.mock("firebase/firestore", () => ({
  collection:(...parts) => ({ path:mockPath(...parts) }),
  doc:(...parts) => ({ path:mockPath(...parts) }),
  getDoc:async ref => ({ exists:() => mockDocuments.has(ref.path), data:() => mockDocuments.get(ref.path) }),
  getDocs:jest.fn(),
  setDoc:jest.fn(),
  updateDoc:(...args) => mockDirectUpdate(...args),
  onSnapshot:jest.fn(),
  serverTimestamp:() => "timestamp",
  arrayUnion:jest.fn(),
  increment:jest.fn(),
  runTransaction:async (_db, callback) => callback({
    get:async ref => ({ exists:() => mockDocuments.has(ref.path), data:() => mockDocuments.get(ref.path) }),
    update:(ref, patch) => mockDocuments.set(ref.path, { ...(mockDocuments.get(ref.path) || {}), ...patch }),
  }),
}));

const { upgradeCatEquip } = require("./catDb");

beforeEach(() => {
  mockDocuments.clear();
  mockDocuments.set("members/member-1", {
    uid:"old-login-uid",
    email:"player@example.test",
    village:{ resources:{ melon_t3:52 } },
    equippedCat:{ catId:"guagua", equip:{} },
  });
  mockDocuments.set("members/member-1/cats/guagua", { equip:{} });
  mockDirectUpdate.mockReset();
  mockDirectUpdate.mockRejectedValue(new Error("Missing or insufficient permissions"));
});

test("forge upgrade is atomic and does not depend on a separate cat update", async () => {
  const result = await upgradeCatEquip("member-1", "guagua", "arrow", "精英", 4, { melon_t3:34 });

  expect(result).toEqual({ ok:true });
  expect(mockDirectUpdate).not.toHaveBeenCalled();
  expect(mockDocuments.get("members/member-1")["village.resources.melon_t3"]).toBe(18);
  expect(mockDocuments.get("members/member-1/cats/guagua")["equip.arrow"]).toEqual({ grade:"精英", plusLevel:4 });
});
