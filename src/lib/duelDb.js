// src/lib/duelDb.js — 決鬥模式 Firestore 操作
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, onSnapshot,
  serverTimestamp, arrayUnion, increment, query, where, runTransaction, deleteField
} from "firebase/firestore";
import { db } from "./firebase";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";

const DUEL = "duelRooms";
const DUEL_STATS = "duelStats";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── 決鬥數值平衡（壓縮強度差距，老手僅略有優勢）──────────
export function balanceDuelStats(raw) {
  return {
    hp:  Math.max(200, Math.round(200 + Math.min((raw.hp  - 200) * 0.12, 80))),  // 200~280
    atk: Math.max(5,   Math.round(5   + Math.min((raw.atk - 15)  * 0.05, 9))),   // 5~14
    def: Math.max(2,   Math.round(2   + Math.min((raw.def - 8)   * 0.15, 5))),   // 2~7
  };
}

// ── 隨機分隊（host）────────────────────────────────────────
export async function shuffleDuelTeams(roomId, room) {
  try {
    const all = [
      ...Object.entries(room.teamA || {}).map(([id, m]) => [id, m]),
      ...Object.entries(room.teamB || {}).map(([id, m]) => [id, m]),
    ];
    // Fisher-Yates shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const half = Math.ceil(all.length / 2);
    const newA = {}, newB = {};
    all.slice(0, half).forEach(([id, m]) => { newA[id] = m; });
    all.slice(half).forEach(([id, m])   => { newB[id] = m; });
    await updateDoc(doc(db, DUEL, roomId), { teamA: newA, teamB: newB });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 建立房間 ────────────────────────────────────────────────
export async function createDuelRoom(hostId, hostName, type, hostTeam, stats, isGuest = false) {
  try {
    const code = genCode();
    const member = {
      name: hostName, isGuest,
      hp: stats.hp, maxHP: stats.hp,
      atk: stats.atk, def: stats.def,
      catName: stats.catName || "",
      arrows: [], ready: false, alive: true,
    };
    const room = {
      code, type, status: "waiting",
      hostId, createdAt: serverTimestamp(),
      teamA: hostTeam === "A" ? { [hostId]: member } : {},
      teamB: hostTeam === "B" ? { [hostId]: member } : {},
      round: 1, log: [], result: null, processing: false,
      cheer: null,
      lastSeen: { [hostId]: Date.now() },
    };
    const ref = await addDoc(collection(db, DUEL), room);
    return { ok: true, roomId: ref.id, code };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 加入房間 ────────────────────────────────────────────────
export async function joinDuelRoom(code, memberId, memberName, team, stats, isGuest = false) {
  try {
    const snap = await getDocs(
      query(collection(db, DUEL), where("code", "==", code.toUpperCase()), where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok: false, reason: "找不到此邀請碼或房間已開始" };

    const roomRef = snap.docs[0].ref;
    const maxMap = { "1v1":1, "2v2":2, "3v3":3, "4v4":4, "uneven":8 };
    const member = {
      name: memberName, isGuest,
      hp: stats.hp, maxHP: stats.hp,
      atk: stats.atk, def: stats.def,
      catName: stats.catName || "",
      arrows: [], ready: false, alive: true,
    };

    // 用 transaction 讓「讀人數 → 寫入成員」變成原子操作，避免多人同時加入超員
    let actualType = null;
    await runTransaction(db, async (tx) => {
      const roomDoc = await tx.get(roomRef);
      if (!roomDoc.exists()) throw new Error("房間不存在");
      const room = roomDoc.data();
      if (room.status !== "waiting") throw new Error("房間已開始，無法加入");
      actualType = room.type;
      const max = maxMap[room.type] || 8;
      // 不對等模式：所有加入者強制 B 隊
      const joinTeam = room.type === "uneven" ? "B" : team;
      const teamKey = `team${joinTeam}`;
      const curSize = Object.keys(room[teamKey] || {}).length;
      if (curSize >= max) throw new Error("此隊伍已滿，請選擇另一隊");
      tx.update(roomRef, {
        [`${teamKey}.${memberId}`]: member,
        [`lastSeen.${memberId}`]: Date.now(),
      });
    });

    return { ok: true, roomId: roomRef.id, roomType: actualType };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 訂閱房間 ────────────────────────────────────────────────
export function subscribeDuelRoom(roomId, callback) {
  return onSnapshot(doc(db, DUEL, roomId), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ── 開始戰鬥（host）────────────────────────────────────────
export async function startDuelBattle(roomId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), { status: "active" });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 送出箭分 ────────────────────────────────────────────────
export async function submitDuelArrows(roomId, team, memberId, arrows) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      [`team${team}.${memberId}.arrows`]: arrows,
      [`team${team}.${memberId}.ready`]: true,
      [`lastSeen.${memberId}`]: Date.now(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 心跳更新（防斷線偵測）────────────────────────────────────
export async function updateDuelHeartbeat(roomId, memberId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      [`lastSeen.${memberId}`]: Date.now(),
    });
  } catch {}
}

// ── 強制跳過斷線玩家（host）────────────────────────────────
export async function skipDisconnected(roomId, team, memberId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      [`team${team}.${memberId}.alive`]: false,
      [`team${team}.${memberId}.disconnected`]: true,
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── 加油 ────────────────────────────────────────────────────
export async function sendDuelCheer(roomId, fromName) {
  try {
    await updateDoc(doc(db, DUEL, roomId), { cheer: { fromName, ts: Date.now() } });
    return { ok: true };
  } catch { return { ok: false }; }
}

// ── 再來一局投票 ─────────────────────────────────────────────
export async function proposeRematch(roomId, hostId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      rematch: { pending: true, votes: { [hostId]: true }, proposedAt: Date.now() }
    });
  } catch {}
}
export async function voteRematch(roomId, memberId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), { [`rematch.votes.${memberId}`]: true });
  } catch {}
}
export async function clearRematch(roomId) {
  try { await updateDoc(doc(db, DUEL, roomId), { rematch: null }); } catch {}
}

// ── 再來一局（host 重置）────────────────────────────────────
export async function resetDuelRoom(roomId, room) {
  try {
    const updates = { round: 1, log: [], result: null, status: "active", processing: false, rematch: null };
    for (const [id, m] of Object.entries(room.teamA || {})) {
      updates[`teamA.${id}.hp`]    = m.maxHP;
      updates[`teamA.${id}.alive`] = true;
      updates[`teamA.${id}.ready`] = false;
      updates[`teamA.${id}.arrows`]= [];
      updates[`teamA.${id}.disconnected`] = false;
    }
    for (const [id, m] of Object.entries(room.teamB || {})) {
      updates[`teamB.${id}.hp`]    = m.maxHP;
      updates[`teamB.${id}.alive`] = true;
      updates[`teamB.${id}.ready`] = false;
      updates[`teamB.${id}.arrows`]= [];
      updates[`teamB.${id}.disconnected`] = false;
    }
    await updateDoc(doc(db, DUEL, roomId), updates);
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── 清除卡住的 processing 旗標（host 進場時呼叫）─────────────
export async function clearDuelProcessing(roomId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), { processing: false });
  } catch {}
}

// ── 處理回合（host）────────────────────────────────────────
// calcDmgFn(arrows, atk, targetDef) → { dmg, crits, arrowBreakdown }
export async function processDuelRound(roomId, room, calcDmgFn) {
  try {
    const teamA = room.teamA || {};
    const teamB = room.teamB || {};
    const aliveA = Object.keys(teamA).filter(id => teamA[id].alive);
    const aliveB = Object.keys(teamB).filter(id => teamB[id].alive);

    // 隨機事件（決鬥模式才能抽到 duelOnly 事件）
    const eventRaw = shouldTriggerEvent() ? drawRandomEvent("duel") : null;
    let eventData = eventRaw
      ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
      : null;
    const eff = eventRaw?.effect || {};

    // ── 叛變：換隊先行，本回合用換後隊伍計算攻擊 ──────────
    let effTeamA = teamA, effTeamB = teamB;
    let effAliveA = aliveA, effAliveB = aliveB;

    if (eventData?.id === "betrayal" && room.type !== "1v1" && aliveA.length > 0 && aliveB.length > 0) {
      const swapAId = aliveA[Math.floor(Math.random() * aliveA.length)];
      const swapBId = aliveB[Math.floor(Math.random() * aliveB.length)];
      eventData = { ...eventData, swapAId, swapAName: teamA[swapAId]?.name || "?", swapBId, swapBName: teamB[swapBId]?.name || "?" };
      // 建立換隊後的有效隊伍（淺拷貝後交換成員）
      effTeamA = { ...teamA, [swapBId]: teamB[swapBId] };
      effTeamB = { ...teamB, [swapAId]: teamA[swapAId] };
      delete effTeamA[swapAId];
      delete effTeamB[swapBId];
      effAliveA = aliveA.filter(id => id !== swapAId).concat([swapBId]);
      effAliveB = aliveB.filter(id => id !== swapBId).concat([swapAId]);
    } else if (eventData?.id === "betrayal") {
      eventData = null; // 1v1 或無存活，不觸發叛變
    }

    // 隨機配對目標
    function pickTarget(myTeam) {
      const pool = myTeam === "A" ? effAliveB : effAliveA;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 計算每人傷害
    const attacks = [];
    for (const id of effAliveA) {
      const m = effTeamA[id];
      const targetId = pickTarget("A");
      if (!targetId) continue;
      const raw = calcDmgFn(m.arrows || [], m.atk || 20, effTeamB[targetId]?.def || 10);
      const dmg        = typeof raw === "object" ? (raw.dmg || 0)           : raw;
      const crits      = typeof raw === "object" ? (raw.crits || 0)         : 0;
      const arrowBreakdown = typeof raw === "object" ? (raw.arrowBreakdown || []) : [];
      const luckyEvent = typeof raw === "object" ? (raw.luckyEvent || null)  : null;
      attacks.push({ attackerId: id, attackerTeam: "A", targetId, dmg, crits, arrowBreakdown, luckyEvent });
    }
    for (const id of effAliveB) {
      const m = effTeamB[id];
      const targetId = pickTarget("B");
      if (!targetId) continue;
      const raw = calcDmgFn(m.arrows || [], m.atk || 20, effTeamA[targetId]?.def || 10);
      const dmg        = typeof raw === "object" ? (raw.dmg || 0)           : raw;
      const crits      = typeof raw === "object" ? (raw.crits || 0)         : 0;
      const arrowBreakdown = typeof raw === "object" ? (raw.arrowBreakdown || []) : [];
      const luckyEvent = typeof raw === "object" ? (raw.luckyEvent || null)  : null;
      attacks.push({ attackerId: id, attackerTeam: "B", targetId, dmg, crits, arrowBreakdown, luckyEvent });
    }

    // 加總傷害
    const hpDelta = {};
    for (const atk of attacks) {
      let dmg = atk.dmg;
      if (eff.extraDmg) dmg += Math.floor(eff.extraDmg / attacks.length);
      hpDelta[atk.targetId] = (hpDelta[atk.targetId] || 0) - dmg;
    }

    // 更新 HP
    const updates = { round: (room.round || 1) + 1 };

    if (eventData?.swapAId) {
      // 叛變：整體重建 teamA/teamB（成員跨隊，無法用 dot notation 逐欄寫入）
      const newTeamA = {}, newTeamB = {};
      for (const [id, m] of Object.entries(effTeamA)) {
        if (!m.alive) { newTeamA[id] = { ...m, arrows: [], ready: false }; continue; }
        let hp = Math.max(0, (m.hp || 0) + (hpDelta[id] || 0));
        if (eff.healArcher) hp = Math.min(m.maxHP || 0, hp + eff.healArcher);
        newTeamA[id] = { ...m, hp, arrows: [], ready: false, alive: hp > 0 };
      }
      for (const [id, m] of Object.entries(effTeamB)) {
        if (!m.alive) { newTeamB[id] = { ...m, arrows: [], ready: false }; continue; }
        let hp = Math.max(0, (m.hp || 0) + (hpDelta[id] || 0));
        if (eff.healArcher) hp = Math.min(m.maxHP || 0, hp + eff.healArcher);
        newTeamB[id] = { ...m, hp, arrows: [], ready: false, alive: hp > 0 };
      }
      updates.teamA = newTeamA;
      updates.teamB = newTeamB;
    } else {
      // 一般：逐欄位更新（dot notation）
      for (const id of effAliveA) {
        let hp = Math.max(0, (effTeamA[id].hp || 0) + (hpDelta[id] || 0));
        if (eff.healArcher) hp = Math.min(effTeamA[id].maxHP, hp + eff.healArcher);
        updates[`teamA.${id}.hp`] = hp;
        updates[`teamA.${id}.arrows`] = [];
        updates[`teamA.${id}.ready`] = false;
        if (hp <= 0) updates[`teamA.${id}.alive`] = false;
      }
      for (const id of effAliveB) {
        let hp = Math.max(0, (effTeamB[id].hp || 0) + (hpDelta[id] || 0));
        if (eff.healArcher) hp = Math.min(effTeamB[id].maxHP, hp + eff.healArcher);
        updates[`teamB.${id}.hp`] = hp;
        updates[`teamB.${id}.arrows`] = [];
        updates[`teamB.${id}.ready`] = false;
        if (hp <= 0) updates[`teamB.${id}.alive`] = false;
      }
    }

    // 勝負判斷（統一用 updates 最終結果）
    let aliveAAfter, aliveBAfter;
    if (eventData?.swapAId) {
      aliveAAfter = Object.values(updates.teamA).filter(m => m.alive);
      aliveBAfter = Object.values(updates.teamB).filter(m => m.alive);
    } else {
      aliveAAfter = effAliveA.filter(id => (updates[`teamA.${id}.hp`] ?? effTeamA[id].hp) > 0);
      aliveBAfter = effAliveB.filter(id => (updates[`teamB.${id}.hp`] ?? effTeamB[id].hp) > 0);
    }
    let result = null;
    if (aliveAAfter.length === 0 && aliveBAfter.length === 0) result = "draw";
    else if (aliveAAfter.length === 0) result = "teamB";
    else if (aliveBAfter.length === 0) result = "teamA";

    const logEntry = { round: room.round || 1, event: eventData, attacks, hpDelta };
    updates.log = arrayUnion(logEntry);
    if (result) { updates.result = result; updates.status = "finished"; }

    await updateDoc(doc(db, DUEL, roomId), updates);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 決鬥統計（全員，排行榜用）────────────────────────────────
export async function getAllDuelStats() {
  try {
    const snap = await getDocs(collection(db, DUEL_STATS));
    return snap.docs.map(d => ({ memberId: d.id, ...d.data() }));
  } catch { return []; }
}

// ── 決鬥統計 ────────────────────────────────────────────────
export async function getDuelStats(memberId) {
  try {
    const snap = await getDoc(doc(db, DUEL_STATS, memberId));
    if (snap.exists()) return snap.data();
  } catch {}
  return { wins: 0, losses: 0, draws: 0, soloWins: 0, soloLosses: 0, teamWins: 0, teamLosses: 0, flawless: 0, totalDmg: 0 };
}

// ── 再來一局：重新分隊後重置（部分同意的情況）─────────────
export async function resetWithRedistribution(roomId, room) {
  try {
    const hostId = room.hostId;
    const allPlayers = [
      ...Object.entries(room.teamA || {}).map(([id, m]) => [id, m]),
      ...Object.entries(room.teamB || {}).map(([id, m]) => [id, m]),
    ];
    // Fisher-Yates shuffle（保持隨機分配）
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }
    let newTeamA = {}, newTeamB = {};
    if (room.type === "uneven") {
      // 不對等：房主固定 A，其他人全 B
      for (const [id, m] of allPlayers) {
        if (id === hostId) newTeamA[id] = m;
        else newTeamB[id] = m;
      }
    } else {
      // 一般：重新均分
      const half = Math.ceil(allPlayers.length / 2);
      allPlayers.slice(0, half).forEach(([id, m]) => { newTeamA[id] = m; });
      allPlayers.slice(half).forEach(([id, m])   => { newTeamB[id] = m; });
    }
    // 重置個人狀態
    const resetM = m => ({ ...m, hp: m.maxHP, arrows: [], ready: false, alive: true, disconnected: false });
    Object.keys(newTeamA).forEach(id => { newTeamA[id] = resetM(newTeamA[id]); });
    Object.keys(newTeamB).forEach(id => { newTeamB[id] = resetM(newTeamB[id]); });
    await updateDoc(doc(db, DUEL, roomId), {
      teamA: newTeamA, teamB: newTeamB,
      round: 1, log: [], result: null, status: "active",
      processing: false, rematch: null,
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── 關閉房間（host）────────────────────────────────────────
export async function closeDuelRoom(roomId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), { status: "closed" });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── 踢出玩家（刪除房間內成員資料）────────────────────────────
export async function removePlayerFromRoom(roomId, team, memberId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      [`team${team}.${memberId}`]: deleteField(),
      [`lastSeen.${memberId}`]:    deleteField(),
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── 不對等模式：依對手人數強化房主數值（開始時呼叫一次）────
export async function scaleUnevenHost(roomId, room) {
  try {
    const hostId = room.hostId;
    const host   = room.teamA?.[hostId];
    if (!host) return { ok: false, reason: "找不到房主" };
    const N = Object.keys(room.teamB || {}).length;
    if (N <= 1) return { ok: true }; // 1v1 以下不需加成
    const scale = (base, factor) => Math.round(base * (1 + (N - 1) * factor));
    const newHp  = scale(host.maxHP, 0.7);
    const newAtk = scale(host.atk,   0.4);
    const newDef = scale(host.def,   0.25);
    await updateDoc(doc(db, DUEL, roomId), {
      [`teamA.${hostId}.hp`]:    newHp,
      [`teamA.${hostId}.maxHP`]: newHp,
      [`teamA.${hostId}.atk`]:   newAtk,
      [`teamA.${hostId}.def`]:   newDef,
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

export async function recordDuelResult(memberId, outcome, mode, extraStats = {}) {
  // outcome: "win"|"loss"|"draw"
  // mode: "solo"|"team"
  try {
    const ref = doc(db, DUEL_STATS, memberId);
    const snap = await getDoc(ref);
    const upd = {};
    if (outcome === "win")   { upd.wins = increment(1); upd[`${mode}Wins`] = increment(1); }
    if (outcome === "loss")  { upd.losses = increment(1); upd[`${mode}Losses`] = increment(1); }
    if (outcome === "draw")  { upd.draws = increment(1); }
    if (extraStats.flawless) upd.flawless = increment(1);
    if (extraStats.dmg > 0)  upd.totalDmg = increment(extraStats.dmg);

    if (snap.exists()) {
      await updateDoc(ref, upd);
    } else {
      const init = { wins:0, losses:0, draws:0, soloWins:0, soloLosses:0, teamWins:0, teamLosses:0, flawless:0, totalDmg:0 };
      if (outcome === "win")  { init.wins++; init[`${mode}Wins`]++; }
      if (outcome === "loss") { init.losses++; init[`${mode}Losses`]++; }
      if (outcome === "draw") init.draws++;
      if (extraStats.flawless) init.flawless++;
      if (extraStats.dmg > 0) init.totalDmg += extraStats.dmg;
      await setDoc(ref, init);
    }
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── AI 機器人加入決鬥房間 ─────────────────────────────────────
export async function addBotToDuelRoom(roomId, team, botId, botName, difficulty, stats) {
  try {
    const teamKey = `team${team}`;
    await updateDoc(doc(db, DUEL, roomId), {
      [`${teamKey}.${botId}`]: {
        name: botName, isBot: true, difficulty,
        hp: stats.hp, maxHP: stats.hp, atk: stats.atk, def: stats.def,
        arrows: [], ready: false, alive: true,
      },
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 移除決鬥機器人 ────────────────────────────────────────────
export async function removeBotFromDuelRoom(roomId, team, botId) {
  try {
    await updateDoc(doc(db, DUEL, roomId), {
      [`team${team}.${botId}`]: deleteField(),
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}
