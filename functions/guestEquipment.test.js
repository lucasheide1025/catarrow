"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const { GUEST_COMMON_EQUIPMENT, assertActiveGuest, starterPatch, purchasePatch }=require("./guestEquipment");
test("catalog contains nine individual common items and fixed prices",()=>{ assert.equal(GUEST_COMMON_EQUIPMENT.length,9); assert.deepEqual(new Set(GUEST_COMMON_EQUIPMENT.map(x=>x.price)),new Set([150,180,200])); });
test("starter is idempotent and preserves previously granted coins",()=>{ const member={accountType:"guest",coins:320,starterCoinsGranted:true}; const p=starterPatch(member); assert.equal(p.coins,320); assert.equal(p.rpgEquip.bow.itemId,"bow_practice"); assert.equal(starterPatch({...member,guestEquipmentSeeded:true}),null); });
test("legacy guest receives starter coins once",()=>{ assert.equal(starterPatch({accountType:"guest",coins:20}).coins,520); });
test("purchase rejects unknown, duplicate and insufficient transactions",()=>{ assert.throws(()=>purchasePatch({coins:500},"bad"),/item_not_allowed/); assert.throws(()=>purchasePatch({coins:500,rpgEquip:{arrow:{itemId:"x"}}},"arr_easton_x10"),/slot_already_filled/); assert.throws(()=>purchasePatch({coins:1},"arr_easton_x10"),/insufficient_coins/); });
test("QR guests fail closed after expiry",()=>{ assert.throws(()=>assertActiveGuest({accountType:"kid",expiresAt:{toMillis:()=>99}},100),/guest_expired/); assert.doesNotThrow(()=>assertActiveGuest({accountType:"kid",expiresAt:{toMillis:()=>101}},100)); });
