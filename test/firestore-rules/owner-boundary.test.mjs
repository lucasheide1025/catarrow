import { after, afterEach, before, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "demo-catarrow";
const OWNER_MEMBER_ID = "member-owner";
const OWNER_AUTH = { uid: "owner-uid", email: "owner@example.test" };
const OTHER_AUTH = { uid: "other-uid", email: "other@example.test" };
const ADMIN_AUTH = { uid: "admin-uid", email: "admin@example.test" };
const OWNER_COLLECTIONS = [
  "memberPerformanceSync",
  "chestInventory",
  "potionInventory",
  "fragmentInventory",
  "chestStats",
  "potionDex",
  "cardCollections",
];

let testEnv;

async function seedIdentityDocuments() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "members", OWNER_MEMBER_ID), {
      uid: OWNER_AUTH.uid,
      email: OWNER_AUTH.email,
      accountType: "member",
    });
    await setDoc(doc(db, "admins", ADMIN_AUTH.uid), { active: true });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe("owner-bound P0 collections", () => {
  for (const collectionName of OWNER_COLLECTIONS) {
    test(`${collectionName}: owner can read and write own document`, async () => {
      await seedIdentityDocuments();
      const db = testEnv.authenticatedContext(OWNER_AUTH.uid, { email: OWNER_AUTH.email }).firestore();
      const ref = doc(db, collectionName, OWNER_MEMBER_ID);
      await assertSucceeds(setDoc(ref, { revision: 1, value: 1 }));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(deleteDoc(ref));
    });

    test(`${collectionName}: authenticated other cannot read or mutate owner document`, async () => {
      await seedIdentityDocuments();
      const ownerDb = testEnv.authenticatedContext(OWNER_AUTH.uid, { email: OWNER_AUTH.email }).firestore();
      await assertSucceeds(setDoc(doc(ownerDb, collectionName, OWNER_MEMBER_ID), { value: 1 }));

      const otherDb = testEnv.authenticatedContext(OTHER_AUTH.uid, { email: OTHER_AUTH.email }).firestore();
      const victimRef = doc(otherDb, collectionName, OWNER_MEMBER_ID);
      await assertFails(getDoc(victimRef));
      await assertFails(setDoc(victimRef, { value: 999 }));
      await assertFails(deleteDoc(victimRef));
    });

    test(`${collectionName}: anonymous cannot read or mutate owner document`, async () => {
      await seedIdentityDocuments();
      const db = testEnv.unauthenticatedContext().firestore();
      const ref = doc(db, collectionName, OWNER_MEMBER_ID);
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { value: 999 }));
      await assertFails(deleteDoc(ref));
    });

    test(`${collectionName}: admin retains maintenance access`, async () => {
      await seedIdentityDocuments();
      const db = testEnv.authenticatedContext(ADMIN_AUTH.uid, { email: ADMIN_AUTH.email }).firestore();
      const ref = doc(db, collectionName, OWNER_MEMBER_ID);
      await assertSucceeds(setDoc(ref, { value: 1 }));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(deleteDoc(ref));
    });
  }
});

test("identity lookup cannot be redirected by payload memberId", async () => {
  await seedIdentityDocuments();
  const db = testEnv.authenticatedContext(OTHER_AUTH.uid, { email: OTHER_AUTH.email }).firestore();
  await assertFails(setDoc(doc(db, "chestInventory", OWNER_MEMBER_ID), {
    memberId: "member-other",
    value: 999,
  }));
});
