// src/zombie/db/zombieDb.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — Firestore 資料庫操作
//  Phase 0：基礎 CRUD + 訂閱
//  完全獨立於 dungeonDb / partyDb
// ═══════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  onSnapshot, getDoc, serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ZOMBIE_PHASE } from "../domain";

const COLLECTION = "zombieRooms";

// ── 輔助 ─────────────────────────────────────────────────

function genRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── 建立房間 ──────────────────────────────────────────────

/**
 * 建立新殭屍生存房間
 * @param {string} hostId — 房主 member ID
 * @param {object} settings — 房間設定
 * @param {string[]} [settings.targetSlots] — 靶位（預設 A-D）
 * @param {number}  [settings.realDistanceM] — 實際射距（預設 10m）
 * @param {number}  [settings.maxArchers] — 主射手上限（預設 5）
 * @param {number}  [settings.maxSnipers] — 遠端狙擊上限（預設 3）
 * @returns {Promise<{ok:boolean, roomId?:string, code?:string, reason?:string}>}
 */
export async function createZombieRoom(hostId, hostName, settings = {}) {
  try {
    const code = genRoomCode();
    const roomData = {
      schemaVersion: 1,
      hostId,
      status: ZOMBIE_PHASE.LOBBY,
      settings: {
        targetSlots:   settings.targetSlots || ["A","B","C","D"],
        realDistanceM: settings.realDistanceM || 10,
        maxArchers:    settings.maxArchers || 5,
        maxSnipers:    settings.maxSnipers || 3,
        timerProfileId: settings.timerProfileId || "standard",
      },
      members: {
        [hostId]: {
          name: hostName,
          lifeState: "healthy",
          role: "main_archer",
          armor: {},
          supplies: {},
          submissions: {},
          accessories: [],
          accessoryUses: 0,
          carriedWeight: 0,
        },
      },
      safety: {
        paused: false,
      },
      commandVersion: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, COLLECTION), roomData);
    return { ok: true, roomId: ref.id, code };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 加入房間 ──────────────────────────────────────────────

/**
 * 加入現有殭屍房間
 * @param {string} roomId
 * @param {string} memberId
 * @param {string} memberName
 * @param {"main_archer"|"remote_sniper"} [role]
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function joinZombieRoom(roomId, memberId, memberName, role = "main_archer") {
  try {
    const ref = doc(db, COLLECTION, roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("房間不存在");

      const room = snap.data();
      if (room.status !== ZOMBIE_PHASE.LOBBY) {
        throw new Error("房間已不在大廳階段");
      }

      const memberCount = Object.keys(room.members).length;
      const maxAllowed = role === "remote_sniper"
        ? (room.settings.maxSnipers || 3)
        : (room.settings.maxArchers || 5);

      // 簡單計數：統計同 role 人數
      const roleCount = Object.values(room.members).filter(m => m.role === role).length;
      if (roleCount >= maxAllowed) {
        throw new Error(`該角色已達上限（${maxAllowed} 人）`);
      }

      tx.update(ref, {
        [`members.${memberId}`]: {
          name: memberName,
          lifeState: "healthy",
          role,
          armor: {},
          supplies: {},
          submissions: {},
          accessories: [],
          accessoryUses: 0,
          carriedWeight: 0,
        },
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 離開房間 ──────────────────────────────────────────────

/**
 * 離開殭屍房間
 * @param {string} roomId
 * @param {string} memberId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function leaveZombieRoom(roomId, memberId) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("房間不存在");

      const room = snap.data();
      if (room.hostId === memberId) {
        // 房主離開 → 刪除房間
        tx.delete(ref);
      } else {
        tx.update(ref, {
          [`members.${memberId}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 射擊設定（房主）─────────────────────────────────────

/**
 * 開始射擊倒數（房主）
 * @param {string} roomId
 * @param {string} hostId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function startShootingCountdown(roomId, hostId) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("房間不存在");
      const room = snap.data();
      if (room.hostId !== hostId) throw new Error("只有房主可以開始射擊");
      if (room.status !== ZOMBIE_PHASE.WAITING_FOR_SHOOTERS) {
        throw new Error("當前階段無法開始射擊");
      }
      tx.update(ref, {
        status: ZOMBIE_PHASE.SAFETY_COUNTDOWN,
        "safety.shootingStartedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 提交箭分 ──────────────────────────────────────────────

/**
 * 提交玩家的箭矢記錄
 * @param {string} roomId
 * @param {string} memberId
 * @param {import("../domain/types").ZombieArrow[]} arrows
 * @param {number} round — 回合編號
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function submitZombieArrows(roomId, memberId, arrows, round) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    await updateDoc(ref, {
      [`members.${memberId}.submissions.${round}`]: arrows,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 房主送出結算 ──────────────────────────────────────────

/**
 * 房主送出回合結算
 * @param {string} roomId
 * @param {string} hostId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function hostSubmitRound(roomId, hostId) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("房間不存在");
      const room = snap.data();
      if (room.hostId !== hostId) throw new Error("只有房主可送出結算");
      if (room.status !== ZOMBIE_PHASE.SCORE_INPUT) {
        throw new Error("當前階段無法結算");
      }
      tx.update(ref, {
        status: ZOMBIE_PHASE.RESOLVING,
        commandVersion: (room.commandVersion || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 緊急暫停 ──────────────────────────────────────────────

/**
 * 切換緊急暫停（任何成員皆可）
 * @param {string} roomId
 * @param {boolean} paused
 * @param {string} [reason]
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function toggleEmergencyPause(roomId, paused, reason) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    const upd = {
      "safety.paused": paused,
      "safety.pauseReason": reason || null,
      updatedAt: serverTimestamp(),
    };
    if (paused) {
      upd.status = ZOMBIE_PHASE.SAFETY_PAUSED;
    }
    await updateDoc(ref, upd);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 即時訂閱 ──────────────────────────────────────────────

/**
 * 訂閱殭屍房間即時更新
 * @param {string} roomId
 * @param {(room: object|null) => void} callback
 * @returns {function} unsubscribe
 */
export function subscribeZombieRoom(roomId, callback) {
  return onSnapshot(doc(db, COLLECTION, roomId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

// ── 刪除房間 ──────────────────────────────────────────────

/**
 * 刪除殭屍房間（僅房主或管理員）
 * @param {string} roomId
 * @param {string} requesterId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function deleteZombieRoom(roomId, requesterId) {
  try {
    const ref = doc(db, COLLECTION, roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("房間不存在");
    const room = snap.data();
    if (room.hostId !== requesterId) throw new Error("只有房主可刪除房間");

    await deleteDoc(ref);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
