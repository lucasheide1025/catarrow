// src/lib/expeditionDb.js — 遠征模式 Firestore 操作
// 管理遠征中的臨時戰鬥房間、失敗廣播

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeDungeonRunSettings } from "./dungeonRunSettings";

const D = "dungeonRooms";

/**
 * 建立一個遠征模式的單人戰鬥房間
 */
export async function createExpeditionBattleRoom({
  memberId, memberName, memberData,
  monster, difficultyTier,
  floorIndex, roomType,
  arrowsPerRound,
  targetFmt,
}) {
  try {
    const settings = normalizeDungeonRunSettings({ arrowsPerRound, targetFmt });
    const member = {
      name: memberName,
      hp: memberData?.hp ?? 500,
      maxHP: memberData?.maxHP ?? 500,
      atk: memberData?.atk ?? 10,
      def: memberData?.def ?? 10,
      alive: true,
      ready: false,
      arrows: [],
      contract: { type: "standard", param: null },
      // 帶入遠征途中累積的 buff（商店符/事件/陷阱），未提供時維持預設
      buffs: {
        atkMult: memberData?.buffs?.atkMult ?? 1,
        defMult: memberData?.buffs?.defMult ?? 1,
        dmgMult: memberData?.buffs?.dmgMult ?? 1,
        hasRevival: memberData?.buffs?.hasRevival ?? false,
      },
      revived: false,
      role: "front",
      displayGroup: "front",
      rearChoice: null,
      catId: memberData?.catId || "",
      catName: memberData?.catName || "",
      archerStyle: memberData?.archerStyle || "baobao",
      catAtk: memberData?.catAtk ?? 0,
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
      arrowsPerRound: settings.arrowsPerRound,
      targetFmt: settings.targetFmt,
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

/**
 * 獎勵倍率表（依難度 tier）
 */
const EXPEDITION_REWARD_TABLE = {
  1: { coinBase: 80,  coinRange: 40,  dewBase: 3,   xpBase: 30,  xpRange: 20,  label:"普通" },
  2: { coinBase: 150, coinRange: 60,  dewBase: 5,   xpBase: 50,  xpRange: 30,  label:"稀有" },
  3: { coinBase: 250, coinRange: 80,  dewBase: 8,   xpBase: 80,  xpRange: 40,  label:"精英" },
  4: { coinBase: 400, coinRange: 120, dewBase: 12,  xpBase: 120, xpRange: 50,  label:"強悍" },
  5: { coinBase: 600, coinRange: 180, dewBase: 18,  xpBase: 180, xpRange: 60,  label:"頭目" },
  6: { coinBase: 1000,coinRange: 300, dewBase: 30,  xpBase: 300, xpRange: 100, label:"神話" },
};

/**
 * 計算遠征獎勵
 * @param {object} options
 * @param {number} options.difficultyTier - 難度 1~6
 * @param {number} options.floorsCleared - 通過層數（0~3）
 * @param {boolean} options.won - 是否通關
 * @returns {{ coins: number, arrowDew: number, archerXP: number, breakdown: object }}
 */
export function calculateExpeditionRewards({ difficultyTier, floorsCleared, won }) {
  const tier = Math.max(1, Math.min(6, difficultyTier || 1));
  const table = EXPEDITION_REWARD_TABLE[tier];
  const floorMult = won ? 1.0 : Math.max(0.1, floorsCleared / 3);

  const coinsBase = table.coinBase + Math.floor(Math.random() * table.coinRange);
  const coins = Math.round(coinsBase * floorMult);

  const dewBase = table.dewBase + Math.floor(Math.random() * table.dewBase);
  const arrowDew = Math.max(1, Math.round(dewBase * floorMult));

  const xpBase = table.xpBase + Math.floor(Math.random() * table.xpRange);
  const archerXP = Math.round(xpBase * floorMult);

  return {
    coins,
    arrowDew,
    archerXP,
    won,
    difficultyLabel: table.label,
    floorsCleared,
    totalFloors: 3,
    breakdown: {
      coinBase: coinsBase, floorMult, dewBase, xpBase,
    },
  };
}

/**
 * 儲存遠征紀錄到 members/{memberId}.expeditionRecords 陣列
 * @param {string} memberId
 * @param {object} record - { family, difficulty, isHidden, floorsCleared, won, coins, arrowDew, archerXP }
 */
export async function saveExpeditionRecord(memberId, record) {
  if (!memberId) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return;
    const data = snap.data();
    const prev = data.expeditionRecords || [];
    const newRecord = {
      id: `er_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      completedAt: new Date().toISOString(),
      ...record,
    };
    // 保留最近 20 筆
    const updated = [newRecord, ...prev].slice(0, 20);
    await updateDoc(doc(db, "members", memberId), {
      expeditionRecords: updated,
    }).catch(() => {});
  } catch (e) {
    console.warn("saveExpeditionRecord:", e?.message);
  }
}

/**
 * 發放遠征獎勵（金幣 + 箭露 + 經驗）
 */
export async function grantExpeditionRewards(memberId, rewards) {
  if (!memberId || !rewards) return;
  try {
    const updates = {};
    if (rewards.coins > 0) updates.coins = increment(rewards.coins);
    if (rewards.arrowDew > 0) updates["village.resources.arrowdew"] = increment(rewards.arrowDew);
    if (rewards.archerXP > 0) updates.archerXP = increment(rewards.archerXP);
    await updateDoc(doc(db, "members", memberId), updates).catch(() => {});
  } catch (e) {
    console.warn("grantExpeditionRewards:", e?.message);
  }
}
