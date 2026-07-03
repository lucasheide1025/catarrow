// src/lib/expeditionDb.js — 遠征模式 Firestore 操作
// 管理遠征中的臨時戰鬥房間、失敗廣播

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const D = "dungeonRooms";

/**
 * 建立一個遠征模式的單人戰鬥房間
 */
export async function createExpeditionBattleRoom({
  memberId, memberName, memberData,
  monster, difficultyTier,
  floorIndex, roomType,
}) {
  try {
    const member = {
      name: memberName,
      hp: memberData?.hp || 500,
      maxHP: memberData?.maxHP || 500,
      atk: memberData?.atk || 10,
      def: memberData?.def || 10,
      alive: true,
      ready: false,
      arrows: [],
      contract: { type: "standard", param: null },
      buffs: { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
      revived: false,
      role: "front",
      displayGroup: "front",
      rearChoice: null,
      catName: memberData?.catName || "",
      archerStyle: memberData?.archerStyle || "baobao",
      catAtk: memberData?.catAtk || 0,
    };

    const floorScale = [1.0, 1.05, 1.2][Math.min(floorIndex, 2)] || 1.0;
    const finalMonster = {
      ...monster,
      hp:  Math.round((monster.hp || 100) * floorScale),
      atk: Math.round((monster.atk || 10) * floorScale),
      def: Math.round((monster.def || 5) * floorScale),
    };

    const ref = await addDoc(collection(db, D), {
      status: "active",
      mode: "student",
      hostId: memberId,
      currentFloor: floorIndex + 1,
      totalFloors: 3,
      arrowsPerRound: 6,
      rewardMult: 1.0,
      monster: finalMonster,
      monsterHP: finalMonster.hp,
      monsterMaxHP: finalMonster.hp,
      round: 1,
      log: [],
      result: null,
      processing: false,
      members: { [memberId]: member },
      expeditionMode: true,
      expeditionDifficulty: difficultyTier,
      expeditionRoomType: roomType,
      expeditionFloorIndex: floorIndex,
      mapDungeonId: "expedition",
      createdAt: serverTimestamp(),
    });

    return { ok: true, roomId: ref.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/**
 * 清理遠征戰鬥房間
 */
export async function cleanupExpeditionRoom(roomId) {
  try {
    await deleteDoc(doc(db, D, roomId));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/**
 * 廣播遠征失敗訊息
 */
export async function broadcastExpeditionFailure(memberName, difficultyLabel) {
  try {
    await addDoc(collection(db, "dungeonBroadcasts"), {
      dungeonId: `expedition_${Date.now()}`,
      dungeonName: "遠征地下城",
      difficultyLabel,
      emoji: "💀",
      teamNames: [memberName],
      isExpedition: true,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("broadcastExpeditionFailure:", e?.message);
  }
}
