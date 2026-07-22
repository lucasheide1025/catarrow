import { after, afterEach, before, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, increment, setDoc, updateDoc, writeBatch } from "firebase/firestore";

// Keep a separate namespace because node:test executes files concurrently and
// each suite calls clearFirestore() in afterEach.
const PROJECT_ID = "demo-catarrow-card-market";
const SELLER = { uid: "seller-uid", email: "seller@example.test", memberId: "member-seller" };
const BUYER = { uid: "buyer-uid", email: "buyer@example.test", memberId: "member-buyer" };
const OTHER = { uid: "other-uid", email: "other@example.test", memberId: "member-other" };
const ADMIN = { uid: "admin-uid", email: "admin@example.test" };
let testEnv;

const listing = {
  sellerId: SELLER.memberId,
  sellerName: "Seller",
  cardId: "cat-card-a",
  cardName: "Card A",
  cardEmoji: "cat",
  cardBg: "blue",
  cardCat: "cat-a",
  priceType: "arrowdew",
  priceAmount: 10,
  status: "active",
  listedAt: new Date("2026-07-22T00:00:00Z"),
  expiredAt: new Date("2026-07-29T00:00:00Z"),
};

async function seedIdentities() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const actor of [SELLER, BUYER, OTHER]) {
      await setDoc(doc(db, "members", actor.memberId), {
        uid: actor.uid,
        email: actor.email,
        accountType: "member",
        village: { resources: { arrowdew: 100 } },
        gachaCoins: 100,
        catCards: { "cat-card-a": actor === SELLER ? 3 : 0, "cat-card-trade": 3 },
      });
    }
    await setDoc(doc(db, "admins", ADMIN.uid), { active: true });
  });
}

function actorDb(actor) {
  return testEnv.authenticatedContext(actor.uid, { email: actor.email }).firestore();
}

async function buyWithAtomicPayment({ priceType, priceAmount, offeredCardId = null }) {
  await createListing({ priceType, priceAmount });
  const db = actorDb(BUYER);
  const batch = writeBatch(db);
  const buyerRef = doc(db, "members", BUYER.memberId);
  if (priceType === "arrowdew") {
    batch.update(buyerRef, { "village.resources.arrowdew": increment(-priceAmount) });
  } else if (priceType === "gachaToken") {
    batch.update(buyerRef, { gachaCoins: increment(-priceAmount) });
  } else {
    batch.update(buyerRef, { [`catCards.${offeredCardId}`]: increment(-1) });
  }
  batch.update(buyerRef, { "catCards.cat-card-a": increment(1) });
  batch.update(doc(db, "cardMarket", "listing-a"), {
    status: "sold", buyerId: BUYER.memberId, buyerName: "Buyer", soldAt: new Date(),
    sellerClaimed: false, offeredCardId,
  });
  await assertSucceeds(batch.commit());
}

async function createListing(overrides = {}) {
  const db = actorDb(SELLER);
  const batch = writeBatch(db);
  batch.update(doc(db, "members", SELLER.memberId), { "catCards.cat-card-a": increment(-1) });
  batch.set(doc(db, "cardMarket", "listing-a"), { ...listing, ...overrides });
  await assertSucceeds(batch.commit());
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});
afterEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

describe("cardMarket global economy boundary", () => {
  test("seller can create an owned active listing; other cannot spoof sellerId", async () => {
    await seedIdentities();
    await assertFails(setDoc(doc(actorDb(SELLER), "cardMarket", "listing-a"), listing));
    await createListing();
    await assertFails(setDoc(doc(actorDb(OTHER), "cardMarket", "listing-b"), listing));
  });

  test("authenticated users may read active market listings", async () => {
    await seedIdentities();
    await createListing();
    await assertSucceeds(getDoc(doc(actorDb(BUYER), "cardMarket", "listing-a")));
  });

  test("seller can cancel only without mutating listing identity or price", async () => {
    await seedIdentities();
    const sellerDb = actorDb(SELLER);
    const ref = doc(sellerDb, "cardMarket", "listing-a");
    await createListing();
    await assertFails(updateDoc(ref, { status: "cancelled", priceAmount: 1 }));
    await assertFails(updateDoc(ref, { status: "cancelled" }));
    const batch = writeBatch(sellerDb);
    batch.update(doc(sellerDb, "members", SELLER.memberId), { "catCards.cat-card-a": increment(1) });
    batch.update(ref, { status: "cancelled" });
    await assertSucceeds(batch.commit());
  });

  test("[current-vulnerability regression] buyer cannot mark sold without atomic payment", async () => {
    await seedIdentities();
    await createListing();
    const buyerRef = doc(actorDb(BUYER), "cardMarket", "listing-a");
    await assertFails(updateDoc(buyerRef, {
      status: "sold", buyerId: BUYER.memberId, buyerName: "Buyer", soldAt: new Date(),
      sellerClaimed: false, offeredCardId: null, priceAmount: 1,
    }));
    await assertFails(updateDoc(buyerRef, {
      status: "sold", buyerId: BUYER.memberId, buyerName: "Buyer", soldAt: new Date(),
      sellerClaimed: false, offeredCardId: null,
    }));
  });

  test("buyer atomic arrowdew payment and card receipt may mark sold", async () => {
    await seedIdentities();
    await buyWithAtomicPayment({ priceType: "arrowdew", priceAmount: 10 });
  });

  test("buyer atomic gachaToken payment and card receipt may mark sold", async () => {
    await seedIdentities();
    await buyWithAtomicPayment({ priceType: "gachaToken", priceAmount: 10 });
  });

  test("buyer atomic card exchange and card receipt may mark sold", async () => {
    await seedIdentities();
    await buyWithAtomicPayment({ priceType: "card", priceAmount: 1, offeredCardId: "cat-card-trade" });
  });

  test("other cannot cancel/delete and buyer cannot impersonate another buyer", async () => {
    await seedIdentities();
    await createListing();
    const otherRef = doc(actorDb(OTHER), "cardMarket", "listing-a");
    await assertFails(updateDoc(otherRef, { status: "cancelled" }));
    await assertFails(updateDoc(otherRef, {
      status: "sold", buyerId: BUYER.memberId, buyerName: "Buyer", soldAt: new Date(),
      sellerClaimed: false, offeredCardId: null,
    }));
    await assertFails(deleteDoc(otherRef));
  });

  test("only seller can mark sold proceeds claimed; admin retains delete access", async () => {
    await seedIdentities();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "cardMarket", "listing-a"), {
        ...listing, status: "sold", buyerId: BUYER.memberId, sellerClaimed: false,
      });
    });
    await assertFails(updateDoc(doc(actorDb(BUYER), "cardMarket", "listing-a"), {
      sellerClaimed: true, sellerClaimedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(actorDb(SELLER), "cardMarket", "listing-a"), {
      sellerClaimed: true, sellerClaimedAt: new Date(),
    }));
    const sellerDb = actorDb(SELLER);
    const claimBatch = writeBatch(sellerDb);
    claimBatch.update(doc(sellerDb, "members", SELLER.memberId), {
      "village.resources.arrowdew": increment(10),
    });
    claimBatch.update(doc(sellerDb, "cardMarket", "listing-a"), {
      sellerClaimed: true, sellerClaimedAt: new Date(),
    });
    await assertSucceeds(claimBatch.commit());
    await assertSucceeds(deleteDoc(doc(actorDb(ADMIN), "cardMarket", "listing-a")));
  });
});
