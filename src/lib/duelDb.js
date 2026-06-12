// src/lib/duelDb.js — 決鬥模式 Firestore 操作
import {
  collection, doc, getDoc, addDoc, updateDoc, setDoc, onSnapshot,
  serverTimestamp, arrayUnion, increment
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
    atk: Math.max(20,  Math.round(20  + Math.min((raw.atk - 15)  * 0.20, 35))),  // 20~55
    def: Math.max(10,  Math.round(10  + Math.min((raw.def - 10)  * 0.16, 18))),  // 10~28
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
    const { getDocs, query, where, collection: col } = await import("firebase/firestore");
    const snap = await getDocs(
      query(col(db, DUEL), where("code", "==", code.toUpperCase()), where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok: false, reason: "找不到此邀請碼或房間已開始" };
    const roomDoc = snap.docs[0];
    const room = roomDoc.data();

    const maxMap = { "1v1":1, "2v2":2, "3v3":3, "4v4":4, "uneven":8 };
    const max = maxMap[room.type] || 8;
    const teamKey = `team${team}`;
    const curSize = Object.keys(room[teamKey] || {}).length;
    if (curSize >= max) return { ok: false, reason: "此隊伍已滿" };

    const member = {
      name: memberName, isGuest,
      hp: stats.hp, maxHP: stats.hp,
      atk: stats.atk, def: stats.def,
      arrows: [], ready: false, alive: true,
    };
    await updateDoc(doc(db, DUEL, roomDoc.id), {
      [`${teamKey}.${memberId}`]: member,
      [`lastSeen.${memberId}`]: Date.now(),
    });
    return { ok: true, roomId: roomDoc.id };
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

// ── 再來一局（host 重置）────────────────────────────────────
export async function resetDuelRoom(roomId, room) {
  try {
    const updates = { round: 1, log: [], result: null, status: "active", processing: false };
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

// ── 處理回合（host）────────────────────────────────────────
// calcDmgFn(arrows, atk, targetDef) → { dmg, crits, arrowBreakdown }
export async function processDuelRound(roomId, room, calcDmgFn) {
  if (room.processing) return { ok: false, reason: "processing" };
  try {
    await updateDoc(doc(db, DUEL, roomId), { processing: true });

    const teamA = room.teamA || {};
    const teamB = room.teamB || {};
    const aliveA = Object.keys(teamA).filter(id => teamA[id].alive);
    const aliveB = Object.keys(teamB).filter(id => teamB[id].alive);

    // 隨機事件
    const eventRaw = shouldTriggerEvent() ? drawRandomEvent() : null;
    const event = eventRaw
      ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
      : null;
    const eff = eventRaw?.effect || {};

    // 隨機配對目標（每攻擊者 → 隨機存活對手）
    function pickTarget(myTeam) {
      const pool = myTeam === "A" ? aliveB : aliveA;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 計算每人傷害
    const attacks = []; // { attackerId, attackerTeam, targetId, dmg, crits, arrowBreakdown, luckyEvent }
    for (const id of aliveA) {
      const m = teamA[id];
      const targetId = pickTarget("A");
      if (!targetId) continue;
      const targetDef = (teamB[targetId]?.def || 10);
      const raw = calcDmgFn(m.arrows || [], m.atk || 20, targetDef);
      const dmg        = typeof raw === "object" ? (raw.dmg || 0)           : raw;
      const crits      = typeof raw === "object" ? (raw.crits || 0)         : 0;
      const arrowBreakdown = typeof raw === "object" ? (raw.arrowBreakdown || []) : [];
      const luckyEvent = typeof raw === "object" ? (raw.luckyEvent || null)  : null;
      attacks.push({ attackerId: id, attackerTeam: "A", targetId, dmg, crits, arrowBreakdown, luckyEvent });
    }
    for (const id of aliveB) {
      const m = teamB[id];
      const targetId = pickTarget("B");
      if (!targetId) continue;
      const targetDef = (teamA[targetId]?.def || 10);
      const raw = calcDmgFn(m.arrows || [], m.atk || 20, targetDef);
      const dmg        = typeof raw === "object" ? (raw.dmg || 0)           : raw;
      const crits      = typeof raw === "object" ? (raw.crits || 0)         : 0;
      const arrowBreakdown = typeof raw === "object" ? (raw.arrowBreakdown || []) : [];
      const luckyEvent = typeof raw === "object" ? (raw.luckyEvent || null)  : null;
      attacks.push({ attackerId: id, attackerTeam: "B", targetId, dmg, crits, arrowBreakdown, luckyEvent });
    }

    // 加總傷害到各目標
    const hpDelta = {};
    for (const atk of attacks) {
      let dmg = atk.dmg;
      if (eff.extraDmg) dmg += Math.floor(eff.extraDmg / attacks.length);
      hpDelta[atk.targetId] = (hpDelta[atk.targetId] || 0) - dmg;
    }

    // 更新 HP
    const updates = { processing: false, round: (room.round || 1) + 1 };
    for (const id of aliveA) {
      let hp = Math.max(0, (teamA[id].hp || 0) + (hpDelta[id] || 0));
      if (eff.healArcher) hp = Math.min(teamA[id].maxHP, hp + eff.healArcher);
      updates[`teamA.${id}.hp`] = hp;
      updates[`teamA.${id}.arrows`] = [];
      updates[`teamA.${id}.ready`] = false;
      if (hp <= 0) updates[`teamA.${id}.alive`] = false;
    }
    for (const id of aliveB) {
      let hp = Math.max(0, (teamB[id].hp || 0) + (hpDelta[id] || 0));
      if (eff.healArcher) hp = Math.min(teamB[id].maxHP, hp + eff.healArcher);
      updates[`teamB.${id}.hp`] = hp;
      updates[`teamB.${id}.arrows`] = [];
      updates[`teamB.${id}.ready`] = false;
      if (hp <= 0) updates[`teamB.${id}.alive`] = false;
    }

    // 勝負判斷
    const aliveAAfter = aliveA.filter(id => (updates[`teamA.${id}.hp`] ?? teamA[id].hp) > 0);
    const aliveBAfter = aliveB.filter(id => (updates[`teamB.${id}.hp`] ?? teamB[id].hp) > 0);
    let result = null;
    if (aliveAAfter.length === 0 && aliveBAfter.length === 0) result = "draw";
    else if (aliveAAfter.length === 0) result = "teamB";
    else if (aliveBAfter.length === 0) result = "teamA";

    const logEntry = { round: room.round || 1, event, attacks, hpDelta };
    updates.log = arrayUnion(logEntry);
    if (result) { updates.result = result; updates.status = "finished"; }

    await updateDoc(doc(db, DUEL, roomId), updates);
    return { ok: true, result };
  } catch (e) {
    await updateDoc(doc(db, DUEL, roomId), { processing: false }).catch(() => {});
    return { ok: false, reason: e.message };
  }
}

// ── 決鬥統計 ────────────────────────────────────────────────
export async function getDuelStats(memberId) {
  try {
    const snap = await getDoc(doc(db, DUEL_STATS, memberId));
    if (snap.exists()) return snap.data();
  } catch {}
  return { wins: 0, losses: 0, draws: 0, soloWins: 0, soloLosses: 0, teamWins: 0, teamLosses: 0, flawless: 0, totalDmg: 0 };
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
