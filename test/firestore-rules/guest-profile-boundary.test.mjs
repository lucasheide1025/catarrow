import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";

const PROJECT_ID = "demo-catarrow-guest-boundary";
const OWNER_UID = "qr-owner";
const OTHER_UID = "qr-other";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId:PROJECT_ID,
    firestore:{ rules:await readFile("firestore.rules", "utf8") },
  });
});
afterEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

async function seedKid(id, patch = {}) {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "members", id), {
      accountType:"kid", lifecycle:"qr-temporary", uid:OWNER_UID,
      sessionSourceId:"camp-1", expiresAt:Timestamp.fromMillis(Date.now() + 60_000), coins:500,
      ...patch,
    });
  });
}

describe("QR guest profile boundary", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "campSessions", "camp-1"), { active:true });
    });
  });
  test("owner can read and update an active profile", async () => {
    await seedKid("kid-active");
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "members", "kid-active")));
    await assertSucceeds(updateDoc(doc(db, "members", "kid-active"), { coins:450 }));
  });

  test("another authenticated account cannot read or update it", async () => {
    await seedKid("kid-owned");
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "members", "kid-owned")));
    await assertFails(updateDoc(doc(db, "members", "kid-owned"), { coins:999 }));
  });

  test("authenticated accounts cannot enumerate guest profiles", async () => {
    await seedKid("kid-owned");
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDocs(collection(otherDb, "members")));
    await assertFails(getDocs(query(collection(otherDb, "members"), where("accountType", "==", "kid"))));
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDocs(query(collection(ownerDb, "members"), where("uid", "==", OWNER_UID))));
  });

  test("expired QR profile fails closed for its owner", async () => {
    await seedKid("kid-expired", { expiresAt:Timestamp.fromMillis(Date.now() - 60_000) });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(getDoc(doc(db, "members", "kid-expired")));
    await assertFails(updateDoc(doc(db, "members", "kid-expired"), { coins:499 }));
  });

  test("QR create requires owner, session linkage, lifecycle and bounded expiry", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const valid = { accountType:"kid", lifecycle:"qr-temporary", uid:OWNER_UID, createdAt:serverTimestamp(),
      sessionSourceId:"camp-1", expiresAt:Timestamp.fromMillis(Date.now() + 119 * 60_000), coins:500,
      starterCoinsGranted:true, guestEquipmentSeeded:true,
      rpgEquip:{ bow:{ itemId:"bow_practice", grade:"common", plusLevel:0 } },
      unlockedEquipItems:{ bow_practice:true } };
    await assertSucceeds(addDoc(collection(db, "members"), valid));
    await assertSucceeds(addDoc(collection(db, "members"), { ...valid, sessionSourceId:"fixed-guest-qr" }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, uid:OTHER_UID }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, coins:999999 }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, rpgEquip:{ bow:{ itemId:"forged" } } }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, sessionSourceId:"" }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, sessionSourceId:"missing-camp" }));
    const { createdAt: _createdAt, ...withoutCreatedAt } = valid;
    await assertFails(addDoc(collection(db, "members"), withoutCreatedAt));
    await assertFails(addDoc(collection(db, "members"), { ...valid, expiresAt:Timestamp.fromMillis(Date.now() + 3 * 60 * 60_000) }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, coins:5000 }));
    await assertFails(addDoc(collection(db, "members"), { ...valid, rpgEquip:{ bow:valid.rpgEquip.bow, chest:{ itemId:"free", grade:"common", plusLevel:0 } } }));
  });

  test("legacy official profiles without accountType remain owner-readable and updatable", async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "members", "legacy-official"), { uid:OWNER_UID, coins:10 });
    });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "members", "legacy-official")));
    await assertSucceeds(updateDoc(doc(db, "members", "legacy-official"), { coins:11 }));
  });

  test("owner cannot extend expiry or rewrite identity", async () => {
    const expiry = Timestamp.fromMillis(Date.now() + 60_000);
    await seedKid("kid-immutable", { expiresAt:expiry });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "members", "kid-immutable"), { expiresAt:Timestamp.fromMillis(expiry.toMillis() + 60_000) }));
    await assertFails(updateDoc(doc(db, "members", "kid-immutable"), { uid:OTHER_UID }));
  });
});
