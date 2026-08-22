import { after, afterEach, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-catarrow",firestore:{rules:await readFile("firestore.rules","utf8")}});});
afterEach(async()=>env.clearFirestore());
after(async()=>env.cleanup());

test("v2 party battle remains readable but client cannot mutate or delete authority state",async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),"partyRooms","v2"),{combatVersion:2,status:"active",round:1,targets:{monster_0:{currentHp:100}},members:{m1:{hp:200}}}));
  const db=env.authenticatedContext("u1",{email:"u1@example.test"}).firestore(),ref=doc(db,"partyRooms","v2");
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref,{round:99}));
  await assertFails(updateDoc(ref,{"targets.monster_0.currentHp":0}));
  await assertFails(updateDoc(ref,{"members.m1.hp":9999}));
  await assertFails(deleteDoc(ref));
});

test("waiting and legacy rooms preserve the existing lobby client contract",async()=>{
  const db=env.authenticatedContext("u1",{email:"u1@example.test"}).firestore(),ref=doc(db,"partyRooms","legacy");
  await assertSucceeds(setDoc(ref,{status:"waiting",members:{m1:{name:"A"}}}));
  await assertSucceeds(updateDoc(ref,{arrowsPerRound:3}));
  await assertSucceeds(deleteDoc(ref));
});

test("v2 dungeon battle remains readable but client cannot mutate authority state",async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),"dungeonRooms","v2"),{combatVersion:2,status:"active",round:1,targets:{primary:{currentHp:100}},members:{m1:{hp:37}}}));
  const db=env.authenticatedContext("u1",{email:"u1@example.test"}).firestore(),ref=doc(db,"dungeonRooms","v2");
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref,{round:99}));
  await assertFails(updateDoc(ref,{"targets.primary.currentHp":0}));
  await assertFails(updateDoc(ref,{"members.m1.hp":9999}));
  await assertFails(deleteDoc(ref));
});
