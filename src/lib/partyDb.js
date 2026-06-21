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

// 生成 6 碼大寫邀請碼（排除易混淆字元 0/O、1/I）
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
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
export async function updateBattleMemberStats(roomId, memberId, hp, maxHP, atk, def, archerStyle = "") {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.hp`]:    hp,
      [`members.${memberId}.maxHP`]: maxHP,
      [`members.${memberId}.atk`]:   atk,
      [`members.${memberId}.def`]:   def,
      ...(archerStyle ? { [`members.${memberId}.archerStyle`]: archerStyle } : {}),
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

// ── 隊友加油（任何人都可以發送，覆蓋上一則）──────────────────
export async function sendPartyCheer(roomId, fromName) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      cheer: { fromName, ts: Date.now() },
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
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

// 房主進場時清除可能卡住的 processing（前次異常遺留）
export async function clearPartyProcessing(roomId) {
  try { await updateDoc(doc(db, PARTY, roomId), { processing: false }); } catch (_) {}
}

// ── Battle：房主處理回合（所有人 ready 後呼叫）───────────────
// calcDmgFn(arrows, atk, monsterDEF) → { dmg, crits } | number
// calcCtrFn(monsterATK, archerDEF)   → number
export async function processPartyRound(roomId, room, calcDmgFn, calcCtrFn) {
  if (room.processing) return { ok: false, reason: "already processing" };
  try {
    await updateDoc(doc(db, PARTY, roomId), { processing: true });

    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    const round    = room.round || 1;

    // Step 1: 計算每人全部 6 箭（body part 在此決定，不可拆開分批算）
    const allPlayerData = {};
    for (const id of aliveIds) {
      const m   = members[id];
      const raw = calcDmgFn(m.arrows || [], m.atk || 10, room.monster.def);
      allPlayerData[id] = {
        name:           m.name || "射手",
        totalDmg:       typeof raw === "number" ? raw        : (raw.dmg   || 0),
        crits:          typeof raw === "number" ? 0          : (raw.crits || 0),
        arrowBreakdown: typeof raw === "object"  ? (raw.arrowBreakdown || []) : [],
      };
    }

    // Step 2: 隨機事件（大回合開始時決定）
    const eventRaw   = shouldTriggerEvent() ? drawRandomEvent() : null;
    const eff        = eventRaw?.effect || {};
    const event      = eventRaw
      ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
      : null;
    const skipAllCtr = !!eff.skipCounter;

    // Step 3: 每位玩家依序攻擊（每人整輪 6 箭為一個小回合），最後怪物反擊全體一次
    const miniRounds  = [];
    let   monsterHP   = room.monsterHP || 0;
    const memberHPNow = {};
    for (const id of aliveIds) memberHPNow[id] = members[id].hp || 0;
    const ctrAccum    = {};

    for (const id of aliveIds) {
      if (memberHPNow[id] <= 0) continue; // 已陣亡，跳過
      const pd  = allPlayerData[id];
      const dmg = pd.totalDmg;
      monsterHP = Math.max(0, monsterHP - dmg);

      miniRounds.push({
        miniRound:      miniRounds.length + 1,
        isCounter:      false,
        attackerId:     id,
        playerLog:      [{ id, name: pd.name, dmg, ctr: 0, arrowBreakdown: pd.arrowBreakdown, crits: pd.crits }],
        totalDmg:       dmg,
        monsterHPAfter: monsterHP,
      });

      if (monsterHP <= 0) break; // 怪物已死，後續玩家不再出手
    }

    // 最後怪物反擊全體存活玩家（除非事件跳過）
    if (!skipAllCtr && monsterHP > 0) {
      const ctrLog = [];
      for (const id of aliveIds) {
        if (memberHPNow[id] <= 0) continue;
        const mem = members[id];
        const ctr = Math.ceil(calcCtrFn(room.monster.atk, mem?.def || 10));
        ctrAccum[id]    = (ctrAccum[id] || 0) + ctr;
        memberHPNow[id] = Math.max(0, memberHPNow[id] - ctr);
        ctrLog.push({ id, name: mem.name || "射手", dmg: 0, ctr });
      }
      miniRounds.push({
        miniRound:      miniRounds.length + 1,
        isCounter:      true,
        playerLog:      ctrLog,
        totalDmg:       0,
        monsterHPAfter: monsterHP,
      });
    }

    // Step 4: 套用事件額外效果（作用於大回合總結）
    const totalDmg = Object.values(allPlayerData).reduce((s, p) => s + p.totalDmg, 0);
    if (eff.extraDmg)                       monsterHP = Math.max(0, monsterHP - eff.extraDmg);
    if (eff.archerATK && eff.archerATK > 0) monsterHP = Math.max(0, monsterHP - eff.archerATK * aliveIds.length);
    if (eff.monsterHP)                      monsterHP = Math.max(0, monsterHP + eff.monsterHP);

    const memberUpdates = {};
    let   liveAfter     = 0;
    for (const id of aliveIds) {
      let hp = memberHPNow[id];
      if (eff.archerHP)                       hp = Math.max(0, Math.min(members[id].maxHP || hp + 200, hp + eff.archerHP));
      if (eff.healArcher)                     hp = Math.min(members[id].maxHP || hp + 200, hp + eff.healArcher);
      if (eff.archerATK && eff.archerATK < 0) hp = Math.max(0, hp + eff.archerATK);
      memberUpdates[`members.${id}.hp`]     = hp;
      memberUpdates[`members.${id}.arrows`] = [];
      memberUpdates[`members.${id}.ready`]  = false;
      if (hp <= 0) memberUpdates[`members.${id}.alive`] = false;
      else liveAfter++;
    }

    // Step 5: 聚合 playerLog（歷史記錄用）
    const playerLog = aliveIds.map(id => ({
      id,
      name:           allPlayerData[id].name,
      dmg:            allPlayerData[id].totalDmg,
      ctr:            ctrAccum[id] || 0,
      crits:          allPlayerData[id].crits,
      arrowBreakdown: allPlayerData[id].arrowBreakdown,
    }));

    const logEntry = {
      round, event,
      miniRounds,   // 動畫用：6 個小回合明細
      playerLog,    // 歷史記錄用：聚合
      totalDmg,
      monsterHPBefore: room.monsterHP,
      monsterHPAfter:  monsterHP,
      counterRound:    !skipAllCtr,
    };

    let result = null;
    if (monsterHP <= 0) result = "win";
    else if (liveAfter === 0) result = "lose";

    const newStatus = result === "win"  ? "pending_confirm"
                    : result === "lose" ? "completed"
                    : "active";

    await updateDoc(doc(db, PARTY, roomId), {
      ...memberUpdates,
      monsterHP,
      round: round + 1,
      log: arrayUnion(logEntry),
      result,
      status: newStatus,
      processing: false,
    });

    return { ok: true, won: result === "win", lost: result === "lose" };
  } catch (e) {
    console.error("[processPartyRound] failed:", e);
    await updateDoc(doc(db, PARTY, roomId), { processing: false }).catch(() => {});
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主勝利後為所有人存入待領獎勵 ───────────────────
export async function storeBattleRewards(roomId, memberIds, monster) {
  try {
    const rewardPending = {};
    for (const mid of memberIds) {
      if (mid.startsWith("guest")) continue; // 訪客無背包，不需要寶箱紀錄
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
// 訪客（guest_ 開頭）跳過寶箱 & 圖鑑寫入，但仍標記已領取
export async function claimBattleReward(roomId, memberId, chests, monsterId, result, dmgDealt) {
  try {
    if (!memberId?.startsWith("guest")) {
      await addChests(memberId, chests);
      if (monsterId && result) {
        await recordBattleDex(memberId, monsterId, result, dmgDealt || 0);
      }
    }
    await updateDoc(doc(db, PARTY, roomId), {
      rewardClaimed: arrayUnion(memberId),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主重置房間（繼續下一場，保留成員不需重新加入）──
export async function resetPartyRoom(roomId, memberIds) {
  try {
    const membersUpdate = {};
    for (const mid of memberIds) {
      membersUpdate[`members.${mid}.arrows`]  = [];
      membersUpdate[`members.${mid}.ready`]   = false;
      membersUpdate[`members.${mid}.alive`]   = true;
      membersUpdate[`members.${mid}.hp`]      = 0;
      membersUpdate[`members.${mid}.maxHP`]   = 0;
    }
    await updateDoc(doc(db, PARTY, roomId), {
      ...membersUpdate,
      status:        "waiting",
      result:        null,
      monster:       null,
      monsterHP:     0,
      monsterMaxHP:  0,
      round:         1,
      log:           [],
      processing:    false,
      rewardPending: null,
      rewardClaimed: [],
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

// ── AI 機器人加入房間 ─────────────────────────────────────────
export async function addBotToPartyRoom(roomId, botId, botName, difficulty, stats) {
  try {
    const snap = await getDoc(doc(db, PARTY, roomId));
    if (!snap.exists()) return { ok: false, reason: "房間不存在" };
    const room = snap.data();
    if (Object.keys(room.members || {}).length >= 8) return { ok: false, reason: "房間已滿" };
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${botId}`]: {
        name: botName, isBot: true, difficulty,
        hp: stats.hp, maxHP: stats.hp, atk: stats.atk, def: stats.def,
        arrows: [], ready: false, alive: true,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 移除機器人 ────────────────────────────────────────────────
export async function removeBotFromPartyRoom(roomId, botId) {
  try {
    const { deleteField: del } = await import("firebase/firestore");
    await updateDoc(doc(db, PARTY, roomId), { [`members.${botId}`]: del() });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
