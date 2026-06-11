// src/lib/partyDb.js — partyRooms 的所有 Firestore 操作
import {
  collection, doc, getDoc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion
} from "firebase/firestore";
import { db } from "./firebase";
import { addChests } from "./db";
import { CHEST_TYPES } from "./itemData";

const PARTY = "partyRooms";

// 生成 6 碼大寫邀請碼
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// 組隊打怪 HP 倍率：1 + (人數-1) * 0.5
export function partyHPMult(playerCount) {
  return 1 + (Math.max(1, playerCount) - 1) * 0.5;
}

// ── 建立房間 ──────────────────────────────────────────────────
export async function createPartyRoom(hostId, hostName, type) {
  try {
    const code = genCode();
    const base = {
      code,
      type,           // "quest" | "battle"
      status: "waiting",
      hostId,
      createdAt: serverTimestamp(),
      members: {
        [hostId]: type === "quest"
          ? { name: hostName, taskDesc: "", distance: "", done: false, doneAt: null }
          : { name: hostName, hp: 0, maxHP: 0, atk: 0, def: 0, arrows: [], ready: false, alive: true }
      },
    };
    if (type === "battle") {
      Object.assign(base, {
        monster: null,
        monsterHP: 0,
        monsterMaxHP: 0,
        mode: "student",
        distanceMode: "preset",
        distance: 18,
        round: 1,
        log: [],
        result: null,
        processing: false,
      });
    }
    const ref = await addDoc(collection(db, PARTY), base);
    return { ok: true, roomId: ref.id, code };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 加入房間（用邀請碼） ───────────────────────────────────────
export async function joinPartyRoom(code, memberId, memberName) {
  try {
    // 找出邀請碼符合的房間（client-side filter，房間數少可接受）
    const { getDocs, query, where, collection: col } = await import("firebase/firestore");
    const snap = await getDocs(
      query(col(db, PARTY), where("code", "==", code.toUpperCase()), where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok: false, reason: "找不到此邀請碼，或房間已開始/結束" };
    const roomDoc = snap.docs[0];
    const room = roomDoc.data();
    const memberCount = Object.keys(room.members || {}).length;
    if (room.type === "battle" && memberCount >= 8) return { ok: false, reason: "房間已滿（最多 8 人）" };
    if (room.type === "quest" && memberCount >= 2) return { ok: false, reason: "任務分享房間只能 2 人" };

    const memberData = room.type === "quest"
      ? { name: memberName, taskDesc: "", distance: "", done: false, doneAt: null }
      : { name: memberName, hp: 0, maxHP: 0, atk: 0, def: 0, arrows: [], ready: false, alive: true };

    await updateDoc(doc(db, PARTY, roomDoc.id), {
      [`members.${memberId}`]: memberData,
    });
    return { ok: true, roomId: roomDoc.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 即時訂閱房間 ──────────────────────────────────────────────
export function subscribePartyRoom(roomId, callback) {
  return onSnapshot(doc(db, PARTY, roomId), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

// ── Quest：更新自己的任務設定 ─────────────────────────────────
export async function updateQuestTask(roomId, memberId, taskDesc, distance) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.taskDesc`]: taskDesc,
      [`members.${memberId}.distance`]: distance,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Quest：標記完成 ────────────────────────────────────────────
export async function markQuestDone(roomId, memberId, done) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.done`]: done,
      [`members.${memberId}.doneAt`]: done ? serverTimestamp() : null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Quest：雙方完成 → 各發寶箱 ────────────────────────────────
// 寶箱型別加權：wood 50%, iron 30%, gold 15%, epic 4%, cat 1%
const QUEST_REWARD_TABLE = [
  { type: "wood",  w: 50 },
  { type: "iron",  w: 30 },
  { type: "gold",  w: 15 },
  { type: "epic",  w:  4 },
  { type: "cat",   w:  1 },
];
function drawQuestChest() {
  const total = QUEST_REWARD_TABLE.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of QUEST_REWARD_TABLE) { r -= e.w; if (r <= 0) return e.type; }
  return "wood";
}

export async function giveQuestRewards(roomId, memberIds) {
  try {
    const chestType = drawQuestChest();
    for (const mid of memberIds) {
      const chest = {
        id: `chest_quest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: chestType,
        family: "admin",
        tier: "rare",
        from: "組隊任務獎勵",
        ts: Date.now(),
      };
      await addChests(mid, [chest]);
    }
    await updateDoc(doc(db, PARTY, roomId), {
      status: "completed",
      rewardChestType: chestType,
    });
    return { ok: true, chestType };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主設定怪物 & 開始 ───────────────────────────────
export async function startPartyBattle(roomId, room, monster, mode, distanceMode, distance) {
  try {
    const memberIds = Object.keys(room.members || {});
    const playerCount = memberIds.length;
    const scaledHP = Math.round(monster.hp * partyHPMult(playerCount));

    // 從 archerStats 計算每人初始 hp（這裡給預設值，實際由各 client 補寫自己的 stats）
    const membersUpdate = {};
    for (const mid of memberIds) {
      const m = room.members[mid];
      membersUpdate[`members.${mid}.arrows`] = [];
      membersUpdate[`members.${mid}.ready`]  = false;
      membersUpdate[`members.${mid}.alive`]  = true;
      // hp/atk/def 留給各 client 用 updateBattleMemberStats 寫入
      if (!m.maxHP) {
        membersUpdate[`members.${mid}.hp`]    = 500;
        membersUpdate[`members.${mid}.maxHP`] = 500;
        membersUpdate[`members.${mid}.atk`]   = 10;
        membersUpdate[`members.${mid}.def`]   = 10;
      }
    }

    await updateDoc(doc(db, PARTY, roomId), {
      ...membersUpdate,
      monster: { id: monster.id, name: monster.name, icon: monster.icon,
                 hp: monster.hp, atk: monster.atk, def: monster.def,
                 tier: monster.tier, family: monster.family },
      monsterHP: scaledHP,
      monsterMaxHP: scaledHP,
      mode, distanceMode, distance,
      round: 1,
      log: [],
      result: null,
      processing: false,
      status: "active",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：各玩家更新自己的 archerStats ─────────────────────
export async function updateBattleMemberStats(roomId, memberId, hp, maxHP, atk, def) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.hp`]:    hp,
      [`members.${memberId}.maxHP`]: maxHP,
      [`members.${memberId}.atk`]:   atk,
      [`members.${memberId}.def`]:   def,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：送出箭分 ──────────────────────────────────────────
export async function submitArrows(roomId, memberId, arrows) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.arrows`]: arrows,
      [`members.${memberId}.ready`]:  true,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主強制跳過斷線玩家（以空箭分 + ready=true 標記）──
export async function forceSkipPlayer(roomId, memberId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.arrows`]: [],
      [`members.${memberId}.ready`]:  true,
      [`members.${memberId}.skipped`]: true,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主處理回合（所有人 ready 後呼叫）───────────────
// calcDmgFn(arrows, atk, monsterDEF) → number
// calcCtrFn(monsterATK, archerDEF)   → number
export async function processPartyRound(roomId, room, calcDmgFn, calcCtrFn) {
  if (room.processing) return { ok: false, reason: "already processing" };
  try {
    await updateDoc(doc(db, PARTY, roomId), { processing: true });

    const members = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    const playerCount = aliveIds.length;

    // 1. 各玩家傷害加總
    let totalDmg = 0;
    const dmgMap = {};
    for (const id of aliveIds) {
      const m = members[id];
      const dmg = calcDmgFn(m.arrows || [], m.atk || 10, room.monster.def);
      dmgMap[id] = dmg;
      totalDmg += dmg;
    }

    const newMonsterHP = Math.max(0, (room.monsterHP || 0) - totalDmg);

    // 2. 怪物反擊（均分給存活玩家）
    const ctrPerPlayer = playerCount > 0
      ? Math.ceil(calcCtrFn(room.monster.atk, 10) / playerCount)
      : 0;

    const memberUpdates = {};
    let liveAfter = 0;
    for (const id of aliveIds) {
      const m = members[id];
      const newHP = Math.max(0, (m.hp || 0) - ctrPerPlayer);
      memberUpdates[`members.${id}.hp`]    = newHP;
      memberUpdates[`members.${id}.arrows`] = [];
      memberUpdates[`members.${id}.ready`]  = false;
      if (newHP <= 0) memberUpdates[`members.${id}.alive`] = false;
      else liveAfter++;
    }

    // 3. 建立 log 條目
    const logEntry = {
      round: room.round,
      dmgMap,
      totalDmg,
      monsterHPBefore: room.monsterHP,
      monsterHPAfter: newMonsterHP,
      ctrPerPlayer,
    };

    // 4. 判斷勝負
    let result = null;
    if (newMonsterHP <= 0) result = "win";
    else if (liveAfter === 0) result = "lose";

    await updateDoc(doc(db, PARTY, roomId), {
      ...memberUpdates,
      monsterHP: newMonsterHP,
      round: (room.round || 1) + 1,
      log: arrayUnion(logEntry),
      result,
      status: result ? "completed" : "active",
      processing: false,
    });

    return { ok: true, won: result === "win", lost: result === "lose" };
  } catch (e) {
    await updateDoc(doc(db, PARTY, roomId), { processing: false }).catch(() => {});
    return { ok: false, reason: e.message };
  }
}

// ── 離開房間 ──────────────────────────────────────────────────
export async function leavePartyRoom(roomId, memberId, isHost) {
  try {
    if (isHost) {
      await updateDoc(doc(db, PARTY, roomId), { status: "completed" });
    } else {
      const snap = await getDoc(doc(db, PARTY, roomId));
      if (!snap.exists()) return { ok: true };
      // 用 deleteField 移除玩家 — 需動態 import
      const { deleteField: del } = await import("firebase/firestore");
      await updateDoc(doc(db, PARTY, roomId), {
        [`members.${memberId}`]: del(),
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
