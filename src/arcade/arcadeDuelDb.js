// src/arcade/arcadeDuelDb.js — 射手競技場最小雲端協調層
// 原則：每位玩家整場固定 1 顆 top-level 小 submission、每回合覆寫；只有房主讀 submissions；
// 其他手機只訂閱 1 顆 room 文件。沒有逐箭寫入、沒有 heartbeat、沒有完整 profile 上雲。
import {
  deleteDoc, doc, onSnapshot, runTransaction,
  serverTimestamp, setDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  DUEL_MAX_PLAYERS, buildInitialDuelCombat, duelModeById, duelSubmissionDocId, normalizeArrowsPerRound,
  requiredDuelSubmitterIds, resolveDuelRound, summarizeDuelArrows, validDuelPlayerCount,
} from "./arcadeDuelLogic";

const C = "arcadeRooms";
export const DUEL_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
export const DUEL_HOST_LEASE_MS = 5 * 60 * 1000;
export const DUEL_ROUND_TIMEOUT_MS = 4 * 60 * 1000;

function roomRef(code) { return doc(db, C, code); }
function subRef(code, sessionKey, visitorId) { return doc(db, C, duelSubmissionDocId(code, sessionKey, visitorId)); }

function humanError(e) {
  const msg = String(e?.message || e || "");
  if (/__ROOM_NOT_FOUND__/.test(msg)) return "找不到這個競技場，檢查一下代碼？";
  if (/__WRONG_ROOM_KIND__/.test(msg)) return "這個代碼是組隊冒險房，不是射手競技場";
  if (/__ROOM_FULL__/.test(msg)) return "競技場已滿（最多 8 人）";
  if (/__ALREADY_STARTED__/.test(msg)) return "這場已經開始了";
  if (/__NOT_HOST__/.test(msg)) return "目前只有房主可以操作";
  if (/__HOST_ALIVE__/.test(msg)) return "房主控制權仍有效";
  if (/__NOT_PLAYER__/.test(msg)) return "你不在這個競技場裡";
  if (/__BAD_COUNT__/.test(msg)) return "目前人數不符合這個模式";
  if (/__ROUND_MISMATCH__/.test(msg)) return "回合已經往前，重新整理狀態即可";
  if (/__NOT_READY__/.test(msg)) return "還有人沒送出";
  if (/__TOO_EARLY__/.test(msg)) return "回合尚未超時，先等其他射手";
  if (/insufficient permissions|permission-denied/i.test(msg)) return "競技場資料庫權限尚未開啟";
  if (/offline|unavailable|network/i.test(msg)) return "網路暫時連不上；已輸入的箭仍留在這支手機";
  return msg || "操作失敗";
}

function playerEntry(profile) {
  const cat = profile?.cat || {};
  return {
    visitorId: profile.visitorId,
    nickname: profile.nickname || "貓客",
    catId: cat.id || profile.selectedCat || profile.catId || "haji",
    catName: cat.name || "貓貓",
    catImage: cat.image || `/cats/${cat.id || profile.selectedCat || "haji"}.webp`,
    joinedAt: Date.now(),
  };
}

function validCode(code) { return /^\d{5}$/.test(String(code || "")); }

export async function createDuelRoom(profile, { mode = "duel", arrowsPerRound = 3 } = {}) {
  if (!profile?.visitorId) return { ok: false, reason: "缺少訪客身分" };
  const safeMode = duelModeById(mode).id;
  const arrowCount = normalizeArrowsPerRound(arrowsPerRound);
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const roomCode = String(Math.floor(10000 + Math.random() * 90000));
    const sessionKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await runTransaction(db, async (tx) => {
        const ref = roomRef(roomCode);
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error("__COLLISION__");
        const now = Date.now();
        tx.set(ref, {
          kind: "duel",
          roomCode,
          sessionKey,
          hostId: profile.visitorId,
          hostLeaseUntil: now + DUEL_HOST_LEASE_MS,
          status: "waiting",
          mode: safeMode,
          arrowsPerRound: arrowCount,
          players: { [profile.visitorId]: playerEntry(profile) },
          combat: null,
          round: 0,
          roundStartedAt: 0,
          lastResolution: null,
          result: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: now + DUEL_ROOM_TTL_MS,
        });
      });
      return { ok: true, roomCode };
    } catch (e) {
      if (/__COLLISION__/.test(String(e?.message))) continue;
      return { ok: false, reason: humanError(e) };
    }
  }
  return { ok: false, reason: "房號一直撞號，再按一次" };
}

export async function joinDuelRoom(roomCode, profile) {
  if (!validCode(roomCode)) return { ok: false, reason: "請輸入 5 位數房號" };
  if (!profile?.visitorId) return { ok: false, reason: "缺少訪客身分" };
  try {
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.kind !== "duel") throw new Error("__WRONG_ROOM_KIND__");
      const existing = data.players?.[profile.visitorId];
      if (existing) return; // 重整／回鍋不額外寫 room
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      if (Object.keys(data.players || {}).length >= DUEL_MAX_PLAYERS) throw new Error("__ROOM_FULL__");
      tx.update(ref, {
        [`players.${profile.visitorId}`]: playerEntry(profile),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true, roomCode };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

export async function setDuelRoomConfig(roomCode, visitorId, { mode, arrowsPerRound }) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.kind !== "duel") throw new Error("__WRONG_ROOM_KIND__");
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      if (data.hostId !== visitorId) throw new Error("__NOT_HOST__");
      tx.update(ref, {
        mode: duelModeById(mode).id,
        arrowsPerRound: normalizeArrowsPerRound(arrowsPerRound),
        hostLeaseUntil: Date.now() + DUEL_HOST_LEASE_MS,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export async function startDuelRoom(roomCode, visitorId) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.kind !== "duel") throw new Error("__WRONG_ROOM_KIND__");
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      if (data.hostId !== visitorId) throw new Error("__NOT_HOST__");
      const count = Object.keys(data.players || {}).length;
      if (!validDuelPlayerCount(data.mode, count)) throw new Error("__BAD_COUNT__");
      const now = Date.now();
      tx.update(ref, {
        combat: buildInitialDuelCombat(data.players || {}, { mode: data.mode, arrowsPerRound: data.arrowsPerRound }),
        status: "fighting",
        round: 1,
        roundStartedAt: now,
        hostLeaseUntil: now + DUEL_HOST_LEASE_MS,
        lastResolution: null,
        result: null,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 玩家送出：只覆寫自己固定的 1 顆 top-level submission 文件，不會隨回合累積文件。
 * 箭的逐箭值不進 Firestore，只有可重算戰鬥所需的小摘要。
 */
export async function submitDuelRound(roomCode, visitorId, { sessionKey, round, targetId, arrows, arrowsPerRound }) {
  if (!validCode(roomCode) || !visitorId) return { ok: false, reason: "房間資料不完整" };
  const summary = summarizeDuelArrows(arrows, arrowsPerRound);
  try {
    await setDoc(subRef(roomCode, sessionKey, visitorId), {
      visitorId,
      round: Number(round) || 0,
      targetId: targetId || null,
      ...summary,
      submittedAt: serverTimestamp(),
    });
    return { ok: true, summary };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 只有房主呼叫：其他 7 支手機不讀 submissions。
 * 每位玩家整場固定一顆 top-level arcadeRooms 文件；跨回合持續監聽同一組 exact docs，
 * 避免每回合重掛 query 造成重複 initial reads。
 */
export function subscribeDuelSubmissions(roomCode, sessionKey, visitorIds, cb) {
  const ids = [...new Set((visitorIds || []).map(String).filter(Boolean))].slice(0, DUEL_MAX_PLAYERS);
  if (!validCode(roomCode) || !ids.length) return () => {};
  const latest = new Map();
  const emit = () => cb(ids.map((id) => latest.get(id)).filter(Boolean));
  const unsubs = ids.map((visitorId) => onSnapshot(subRef(roomCode, sessionKey, visitorId), (snap) => {
    if (snap.exists()) latest.set(visitorId, { id: snap.id, ...snap.data() });
    else latest.delete(visitorId);
    emit();
  }, (err) => console.warn("[arcadeDuel] submission snapshot ignored:", err?.message)));
  return () => unsubs.forEach((unsub) => unsub());
}

/**
 * 房主用自己已訂閱到的 submissions 做純函式結算，避免為結算再做額外讀取。
 * transaction 只重讀 room 1 次做 round/host 冪等守衛，再寫 1 次共享結果。
 */
export async function resolveDuelRoomRound(roomCode, visitorId, submissions, { force = false } = {}) {
  try {
    let resolution = null;
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.kind !== "duel") throw new Error("__WRONG_ROOM_KIND__");
      if (data.status !== "fighting") return;
      if (data.hostId !== visitorId) throw new Error("__NOT_HOST__");
      const round = Number(data.round) || 1;
      const currentSubs = (submissions || []).filter((s) => Number(s.round) === round);
      const required = requiredDuelSubmitterIds(data.combat || {});
      const have = new Set(currentSubs.map((s) => s.visitorId));
      const missing = required.filter((id) => !have.has(id));
      if (missing.length && !force) throw new Error("__NOT_READY__");
      if (missing.length && force && Date.now() - Number(data.roundStartedAt || 0) < DUEL_ROUND_TIMEOUT_MS) {
        throw new Error("__TOO_EARLY__");
      }
      resolution = resolveDuelRound({
        mode: data.mode,
        round,
        combat: data.combat || {},
        submissions: currentSubs,
      });
      const now = Date.now();
      const patch = {
        combat: resolution.combat,
        lastResolution: {
          round: resolution.round,
          attacks: resolution.attacks,
          supports: resolution.supports,
          knockouts: resolution.knockouts,
          damageByPlayer: resolution.damageByPlayer,
          submittedIds: resolution.submittedIds,
          missingIds: resolution.missingIds,
          finished: resolution.finished,
          winnerId: resolution.winnerId,
          winnerTeam: resolution.winnerTeam,
          resolvedAt: now,
        },
        hostLeaseUntil: now + DUEL_HOST_LEASE_MS,
        updatedAt: serverTimestamp(),
      };
      if (resolution.finished) {
        patch.status = "result";
        patch.result = {
          winnerId: resolution.winnerId,
          winnerTeam: resolution.winnerTeam,
          rounds: round,
          finishedAt: now,
        };
      } else {
        patch.round = round + 1;
        patch.roundStartedAt = now;
      }
      tx.update(ref, patch);
    });
    return { ok: true, resolution };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export function subscribeDuelRoom(roomCode, cb) {
  if (!validCode(roomCode)) return () => {};
  return onSnapshot(roomRef(roomCode), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, (err) => console.warn("[arcadeDuel] room snapshot ignored:", err?.message));
}

export async function takeOverDuelHost(roomCode, visitorId) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.kind !== "duel") throw new Error("__WRONG_ROOM_KIND__");
      if (!data.players?.[visitorId]) throw new Error("__NOT_PLAYER__");
      if (Number(data.hostLeaseUntil || 0) > Date.now() && data.hostId !== visitorId) throw new Error("__HOST_ALIVE__");
      tx.update(ref, {
        hostId: visitorId,
        hostLeaseUntil: Date.now() + DUEL_HOST_LEASE_MS,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 大廳離開直接移出；戰鬥中離開只標記 forfeited，讓 required submitter 立即排除，房間不會卡死。
 * 房主離開時把 lease 歸零，其他玩家可立即接管；沒有背景 heartbeat。
 */
export async function leaveDuelRoom(roomCode, visitorId) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = roomRef(roomCode);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.kind !== "duel" || !data.players?.[visitorId]) return;
      const patch = { updatedAt: serverTimestamp() };
      const isHost = data.hostId === visitorId;
      if (data.status === "waiting") {
        const ids = Object.keys(data.players || {}).filter((id) => id !== visitorId);
        if (!ids.length) { tx.delete(ref); return; }
        // 改寫整份 players（最多 8 人），仍只是一顆 room write。
        const players = { ...(data.players || {}) };
        delete players[visitorId];
        patch.players = players;
        if (isHost) {
          const next = Object.values(players).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
          patch.hostId = next.visitorId;
          patch.hostLeaseUntil = Date.now() + DUEL_HOST_LEASE_MS;
        }
      } else if (data.status === "fighting") {
        patch[`combat.${visitorId}.forfeited`] = true;
        patch[`combat.${visitorId}.hp`] = 0;
        patch[`combat.${visitorId}.state`] = "spirit";
        if (isHost) patch.hostLeaseUntil = 0;
      }
      tx.update(ref, patch);
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 比賽結束後房主清掉最多 8 顆 submission；直接用 room.players 已知 id 組 ref，
 * 不為 cleanup 額外 getDocs。room 結果保留給其他手機看。
 */
export async function cleanupDuelSubmissions(roomCode, sessionKey, visitorIds = []) {
  const ids = [...new Set((visitorIds || []).filter(Boolean))].slice(0, DUEL_MAX_PLAYERS);
  if (!ids.length) return { ok: true, count: 0 };
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(subRef(roomCode, sessionKey, id)));
    await batch.commit();
    return { ok: true, count: ids.length };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export async function deleteDuelRoom(roomCode, sessionKey, visitorIds = []) {
  if (!validCode(roomCode)) return { ok: false };
  try {
    await cleanupDuelSubmissions(roomCode, sessionKey, visitorIds);
    await deleteDoc(roomRef(roomCode));
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export const DUEL_COLLECTION = C;
