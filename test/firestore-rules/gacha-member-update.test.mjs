import { after, afterEach, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, increment, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "demo-catarrow-gacha-member-update";
const MEMBER_ID = "regular-member";
const AUTH = { uid: "regular-uid", email: "regular@example.test" };
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});

afterEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("regular member can persist a gacha draw and album progress", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "members", MEMBER_ID), {
      uid: AUTH.uid,
      email: AUTH.email,
      accountType: "member",
      gachaCoins: 5,
      catCards: {},
    });
  });

  const db = testEnv.authenticatedContext(AUTH.uid, { email: AUTH.email }).firestore();
  await assertSucceeds(updateDoc(doc(db, "members", MEMBER_ID), {
    gachaCoins: 4,
    "catCards.cat_001": increment(1),
    villageCardAlbums: {
      version: 1,
      xp: { market: 1 },
    },
  }));
});

test("regular member can spend a duplicate cat card to upgrade its star", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "members", MEMBER_ID), {
      uid: AUTH.uid,
      email: AUTH.email,
      accountType: "member",
      catCards: { cat_001: 3 },
      catCardStars: { cat_001: 1 },
    });
  });

  const db = testEnv.authenticatedContext(AUTH.uid, { email: AUTH.email }).firestore();
  await assertSucceeds(updateDoc(doc(db, "members", MEMBER_ID), {
    "catCards.cat_001": 2,
    "catCardStars.cat_001": 2,
  }));
});
