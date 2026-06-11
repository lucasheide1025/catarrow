// src/lib/partyDb.js — partyRooms 的所有 Firestore 操作
import {
  collection, doc, getDoc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion
} from "firebase/firestore";
import { db } from "./firebase";
import { addChests, recordBattleDex } from "./db";
import { CHEST_TYPES, makeChests } from "./itemData";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";

const PARTY = "partyRooms";

// 生成 6 碼大寫邀請碼
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// HP 倍率顯示範圍（用於大廳預覽）
export function partyHPRange(playerCount) {
  const extra = Math.max(0, playerCount - 1);
  return { min: 1 + extra * 0.5, max: 1 + extra * 1.0 };
}

// 開戰時一次性產生實際隨機倍率（每多一人 +0.5~1.0）
function genPartyHPMult(playerCount) {
  let mult = 1.0;
  for (let i = 1; i < Math.max(1, playerCount); i++) {
    mult += 0.5 + Math.random() * 0.5;
  }
  return Math.round(mult * 100) / 100;
}

// ── 建立房間 ──────────────────────────────────────────────────
export async function createPartyRoom(hostId, hostName, type, extraData = {}) {
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
          ? { name: hostName, done: false, doneAt: null }
          : { name: hostName, hp: 0, maxHP: 0, atk: 0, def: 0, arrows: [], ready: false, alive: true }
      },
    };
    if (type === "quest") {
      base.task = extraData.task || null;
      base.hostCheckinId = extraData.checkinId || null;
    }
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
    if (room.type === "quest" && memberCount >= 4) return { ok: false, reason: "組隊任務房間最多 4 人" };

    const memberData = room.type === "quest"
      ? { name: memberName, done: false, doneAt: null }
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

// ── Quest：放棄任務 ────────────────────────────────────────────
export async function markQuestGaveUp(roomId, memberId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.gaveUp`]: true,
      [`members.${memberId}.gaveUpAt`]: serverTimestamp(),
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

// 各模式對怪物的基礎倍率
const MODE_SCALE = {
  novice:  { hp: 1.5, atk: 1, def: 1 },
  student: { hp: 2.0, atk: 1, def: 1 },
  veteran: { hp: 4.0, atk: 2, def: 2 },
};

// ── Battle：房主設定怪物 & 開始 ───────────────────────────────
export async function startPartyBattle(roomId, room, monster, mode, distanceMode, distance) {
  try {
    const memberIds = Object.keys(room.members || {});
    const playerCount = memberIds.length;
    const ms      = MODE_SCALE[mode] || MODE_SCALE.student;
    const hpMult  = genPartyHPMult(playerCount);
    // 先套模式倍率，再套人數倍率
    const scaledHP = Math.round(monster.hp * ms.hp * hpMult);

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
                 hp: Math.round(monster.hp * ms.hp),
                 atk: Math.round(monster.atk * ms.atk),
                 def: Math.round(monster.def * ms.def),
                 tier: monster.tier, family: monster.family },
      monsterHP: scaledHP,
      monsterMaxHP: scaledHP,
      hpMult,
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
// calcDmgFn(arrows, atk, monsterDEF) → { dmg, crits } | number
// calcCtrFn(monsterATK, archerDEF)   → number
// 每兩回合怪物才反擊一次（偶數回合反擊）
export async function processPartyRound(roomId, room, calcDmgFn, calcCtrFn) {
  if (room.processing) return { ok: false, reason: "already processing" };
  try {
    await updateDoc(doc(db, PARTY, roomId), { processing: true });

    const members    = room.members || {};
    const aliveIds   = Object.keys(members).filter(id => members[id].alive);
    const round      = room.round || 1;
    let   shouldCtr  = round % 2 === 0; // 偶數回合才反擊（事件可覆蓋）

    // 1. 各玩家傷害（calcDmgFn 可回傳數字或 { dmg, crits }）
    let totalDmg = 0;
    const playerLog = [];
    for (const id of aliveIds) {
      const m     = members[id];
      const raw   = calcDmgFn(m.arrows || [], m.atk || 10, room.monster.def);
      const dmg   = typeof raw === "number" ? raw : (raw.dmg   || 0);
      const crits = typeof raw === "number" ? 0   : (raw.crits || 0);
      totalDmg += dmg;
      playerLog.push({ id, name: m.name || "射手", dmg, ctr: 0, crits });
    }

    // 2. 隨機事件（由房主決定，存入 log 後所有人同步看見）
    const eventRaw = shouldTriggerEvent() ? drawRandomEvent() : null;
    const eff      = eventRaw?.effect || {};
    const event    = eventRaw
      ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
      : null;

    // 套用事件：正向 ATK → 換算成額外總傷害；skipCounter
    if (eff.extraDmg)                       totalDmg += eff.extraDmg;
    if (eff.archerATK && eff.archerATK > 0) totalDmg += eff.archerATK * aliveIds.length;
    if (eff.skipCounter)                    shouldCtr = false;

    // 怪物 HP（含事件直接增減）
    let newMonsterHP = Math.max(0, (room.monsterHP || 0) - totalDmg);
    if (eff.monsterHP) newMonsterHP = Math.max(0, newMonsterHP + eff.monsterHP);

    // 3. 怪物反擊 + 事件 HP 效果（各人依自己 DEF）
    const memberUpdates = {};
    let liveAfter = 0;
    for (const entry of playerLog) {
      const m   = members[entry.id];
      let   ctr = 0;
      if (shouldCtr) {
        ctr = Math.ceil(calcCtrFn(room.monster.atk, m.def || 10));
        entry.ctr = ctr;
      }
      let newHP = Math.max(0, (m.hp || 0) - ctr);
      // 事件 HP 效果（正 = 回血，負 = 受傷；負向 archerATK 也轉為傷害）
      if (eff.archerHP)                       newHP = Math.max(0, Math.min(m.maxHP || newHP + 200, newHP + eff.archerHP));
      if (eff.healArcher)                     newHP = Math.min(m.maxHP || newHP + 200, newHP + eff.healArcher);
      if (eff.archerATK && eff.archerATK < 0) newHP = Math.max(0, newHP + eff.archerATK);
      memberUpdates[`members.${entry.id}.hp`]     = newHP;
      memberUpdates[`members.${entry.id}.arrows`] = [];
      memberUpdates[`members.${entry.id}.ready`]  = false;
      if (newHP <= 0) memberUpdates[`members.${entry.id}.alive`] = false;
      else liveAfter++;
    }

    // 4. log 條目（含事件）
    const logEntry = {
      round, event,
      playerLog,
      totalDmg,
      monsterHPBefore: room.monsterHP,
      monsterHPAfter:  newMonsterHP,
      counterRound:    shouldCtr,
    };

    // 4. 勝負判斷
    let result = null;
    if (newMonsterHP <= 0) result = "win";
    else if (liveAfter === 0) result = "lose";

    // 怪物死亡時先進入 pending_confirm（等房主確認），落敗直接 completed
    const newStatus = result === "win"  ? "pending_confirm"
                    : result === "lose" ? "completed"
                    : "active";

    await updateDoc(doc(db, PARTY, roomId), {
      ...memberUpdates,
      monsterHP: newMonsterHP,
      round: round + 1,
      log: arrayUnion(logEntry),
      result,
      status: newStatus,
      processing: false,
    });

    return { ok: true, won: result === "win", lost: result === "lose" };
  } catch (e) {
    await updateDoc(doc(db, PARTY, roomId), { processing: false }).catch(() => {});
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主勝利後為所有人存入待領獎勵 ───────────────────
export async function storeBattleRewards(roomId, memberIds, monster) {
  try {
    const rewardPending = {};
    for (const mid of memberIds) {
      const { mainChest, catChest, potionChest } = makeChests(monster);
      rewardPending[mid] = [mainChest, catChest, potionChest].filter(Boolean);
    }
    await updateDoc(doc(db, PARTY, roomId), { rewardPending });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：玩家領取自己的戰鬥獎勵 ─────────────────────────
// monsterId / result / dmgDealt 用於更新怪物圖鑑
export async function claimBattleReward(roomId, memberId, chests, monsterId, result, dmgDealt) {
  try {
    await addChests(memberId, chests);
    if (monsterId && result) {
      await recordBattleDex(memberId, monsterId, result, dmgDealt || 0);
    }
    await updateDoc(doc(db, PARTY, roomId), {
      rewardClaimed: arrayUnion(memberId),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 房主確認結算（怪物死亡後按下才正式跳到結算畫面）──────────
export async function confirmBattleResult(roomId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), { status: "completed" });
    return { ok: true };
  } catch (e) {
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
