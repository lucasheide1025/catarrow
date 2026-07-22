"use strict";

const GUEST_COMMON_EQUIPMENT = Object.freeze([
  { slotId:"arrow", itemId:"arr_easton_x10", name:"練習箭組", stat:"atk", price:200 },
  { slotId:"absorber", itemId:"abs_spigarelli", name:"基礎吸震器", stat:"atk", price:200 },
  { slotId:"module", itemId:"mod_beiter", name:"基礎配件模組", stat:"atk", price:200 },
  { slotId:"chest", itemId:"chest_fivics", name:"基礎護胸", stat:"def", price:180 },
  { slotId:"arm", itemId:"arm_fivics", name:"基礎護臂", stat:"def", price:180 },
  { slotId:"hand", itemId:"hand_shibuya", name:"基礎手套", stat:"def", price:180 },
  { slotId:"nutrition", itemId:"nut_powerbar", name:"基礎補給", stat:"hp", price:150 },
  { slotId:"quiver", itemId:"quiver_fivics", name:"基礎箭袋", stat:"hp", price:150 },
  { slotId:"toolkit", itemId:"tool_avalon", name:"基礎工具包", stat:"hp", price:150 },
]);
const ITEM_MAP = new Map(GUEST_COMMON_EQUIPMENT.map(item => [item.itemId, item]));

function assertActiveGuest(member, nowMs) {
  if (!member || !["guest", "kid"].includes(member.accountType)) throw new Error("guest_only");
  if (member.accountType === "kid") {
    const expires = member.expiresAt?.toMillis?.() || 0;
    if (!expires || expires <= nowMs) throw new Error("guest_expired");
  }
}
function starterPatch(member) {
  if (member.guestEquipmentSeeded) return null;
  const current = member.rpgEquip || {};
  return {
    coins:member.starterCoinsGranted ? Math.max(0, Number(member.coins) || 0) : Math.max(0, Number(member.coins) || 0) + 500,
    starterCoinsGranted:true, guestEquipmentSeeded:true,
    rpgEquip:{ ...current, bow:current.bow?.itemId ? current.bow : { itemId:"bow_practice", grade:"common", plusLevel:0 } },
    unlockedEquipItems:{ ...(member.unlockedEquipItems || {}), bow_practice:true },
  };
}
function purchasePatch(member, itemId) {
  const item = ITEM_MAP.get(itemId);
  if (!item) throw new Error("item_not_allowed");
  if (member.rpgEquip?.[item.slotId]?.itemId) throw new Error("slot_already_filled");
  const coins = Math.max(0, Math.floor(Number(member.coins) || 0));
  if (coins < item.price) throw new Error("insufficient_coins");
  return { item, patch:{ coins:coins - item.price,
    rpgEquip:{ ...(member.rpgEquip || {}), [item.slotId]:{ itemId:item.itemId, grade:"common", plusLevel:0 } },
    unlockedEquipItems:{ ...(member.unlockedEquipItems || {}), [item.itemId]:true } } };
}
module.exports = { GUEST_COMMON_EQUIPMENT, assertActiveGuest, starterPatch, purchasePatch };
