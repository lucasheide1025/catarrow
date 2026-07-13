// src/lib/runeDb.js — 符文 Firestore 操作
import { doc, getDoc, updateDoc, onSnapshot, increment } from "firebase/firestore";
import { db } from "./firebase";
import { RUNES, MAX_RUNE_SLOTS } from "./runeData";

// ── 讀取符文背包 ──────────────────────────────────────────────
// 回傳 { runeId: qty, ... }
export async function getRuneInventory(memberId) {
  const snap = await getDoc(doc(db, "members", memberId));
  return snap.data()?.runeInventory || {};
}

export function subscribeRuneInventory(memberId, cb) {
  return onSnapshot(doc(db, "members", memberId), snap => {
    cb(snap.data()?.runeInventory || {});
  });
}

// ── 增加符文（掉落獎勵用）────────────────────────────────────
export async function addRune(memberId, runeId, qty = 1) {
  if (!RUNES[runeId]) return;
  await updateDoc(doc(db, "members", memberId), {
    [`runeInventory.${runeId}`]: increment(qty),
  });
}


// ── 消耗符文耐久（每次進地下城 -1 耐久）──────────────────────
// equippedRunes: [{runeId, durability}]
// 回傳更新後的 equippedRunes（耐久 0 的已移除）
export async function consumeRuneDurability(memberId, equippedRunes = []) {
  if (!equippedRunes.length) return equippedRunes;

  const updates = {};
  const remaining = [];

  for (const slot of equippedRunes) {
    const newDur = (slot.durability ?? 1) - 1;
    if (newDur > 0) {
      remaining.push({ ...slot, durability: newDur });
    }
    // 耐久 0：從背包移除一個（qty -1）
    if (newDur <= 0) {
      updates[`runeInventory.${slot.runeId}`] = increment(-1);
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, "members", memberId), updates).catch(() => {});
  }

  return remaining;
}

// ── 裝備符文到地下城（寫進 dungeonRooms/{roomId}）─────────────
export async function equipRunesToDungeon(roomId, memberId, equippedRunes = []) {
  await updateDoc(doc(db, "dungeonRooms", roomId), {
    [`memberRunes.${memberId}`]: equippedRunes,
  });
}

// ── 讀取某人的裝備符文 ────────────────────────────────────────
export function getEquippedRunes(room, memberId) {
  return room?.memberRunes?.[memberId] || [];
}

// ── 校驗裝備合法性：max 3 槽、不同 typeId ────────────────────
export function validateRuneEquip(equippedRunes) {
  if (equippedRunes.length > MAX_RUNE_SLOTS) return false;
  const types = equippedRunes.map(s => RUNES[s.runeId]?.typeId);
  return new Set(types).size === types.length;
}
