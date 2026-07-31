// src/lib/raidTeamDb.js
// 世界王組隊討伐的房間層。比照 villageBoardTeamDb / dungeonRooms 的既有慣例。
//
// ⚠️ 成本紀律（記憶：Firestore Cost Discipline，changelog.md:310 的 4000 次讀取）：
//    **逐回合同步，不逐箭**。一回合的寫入 = 每人 1 次送出 + 房主 1 次結算 = 5 次；
//    4 個監聽者 × 5 次 = 20 次讀取／回合，一場五回合共 ~100 次。
//    絕對不要把「每射一箭就寫房間」加回來。
//
// ⚠️ Firestore 規則禁止「一人幫全部人寫入」→ 每位成員只寫自己的 submissions 欄位，
//    房主只寫房間層級的 state/round（比照 villageBoardTeamDb 的 claim 模式）。
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, onSnapshot,
  query, where, runTransaction, serverTimestamp, deleteDoc, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import { createRaidState, resolveRaidRound } from "../worldboss/domain/raidFlow";
import {
  collectRoomArrows, hydrateRaidState, roomPhase, rosterFromRoom, serializeRaidState,
} from "../worldboss/domain/raidRoomState";
import { RAID_MAX_TEAM, canTeamDepart } from "../worldboss/domain/raidTeam";
import { WORLD_BOSSES } from "./worldBossData";
import { WORLD_BOSS_SKILLS } from "./worldBossSkillData";

const R = "worldBossRaidRooms";
const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const activeIds = data => Object.keys(data?.members || {}).filter(id => data.members[id]);

// ── 房間生命週期 ─────────────────────────────────────────
export async function createRaidRoom({
  hostId, hostName, bossKey, eventId,
  targetFmt = "half_17", distanceM = 10,
  stats, archerLevel = 1, cats = [],
}) {
  if (!hostId || !bossKey) return { ok: false, reason: "參數錯誤" };
  try {
    const code = genCode();
    const ref = await addDoc(collection(db, R), {
      code, hostId, hostName: hostName || "房主",
      status: "waiting", eventId: eventId || null,
      bossKey, targetFmt, distanceM,
      round: 1, seq: 0,
      state: null, lastLog: null,
      submissions: {},
      members: {
        [hostId]: {
          name: hostName || "房主", ready: true,
          atk: Number(stats?.atk) || 0, def: Number(stats?.def) || 0, hp: Number(stats?.hp) || 100,
          archerLevel, cats: cats || [], joinedAt: serverTimestamp(),
        },
      },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ok: true, roomId: ref.id, code };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function joinRaidRoom(code, memberId, memberName, { stats, archerLevel = 1, cats = [] } = {}) {
  if (!code || !memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDocs(query(
      collection(db, R), where("code", "==", String(code).toUpperCase()), where("status", "==", "waiting"),
    ));
    if (snap.empty) return { ok: false, reason: "找不到房間，或討伐已開始" };
    const roomRef = doc(db, R, snap.docs[0].id);
    let joined = false;
    await runTransaction(db, async tx => {
      const s = await tx.get(roomRef);
      if (!s.exists()) throw new Error("房間不存在");
      const data = s.data();
      if (data.status !== "waiting") throw new Error("討伐已開始");
      if (data.members?.[memberId]) { joined = true; return; }      // 重進不算新加入
      if (activeIds(data).length >= RAID_MAX_TEAM) throw new Error(`最多 ${RAID_MAX_TEAM} 人`);
      tx.update(roomRef, {
        [`members.${memberId}`]: {
          name: memberName || "隊員", ready: false,
          atk: Number(stats?.atk) || 0, def: Number(stats?.def) || 0, hp: Number(stats?.hp) || 100,
          archerLevel, cats: cats || [], joinedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      joined = true;
    });
    return { ok: joined, roomId: snap.docs[0].id };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function setRaidReady(roomId, memberId, ready = true) {
  try {
    await updateDoc(doc(db, R, roomId), {
      [`members.${memberId}.ready`]: !!ready, updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

/**
 * 房主開打。
 * ⚠️ 作者指定：**出發前要確定全隊每個人都還有次數**。
 *    participants 由呼叫端從世界王事件文件帶進來（房間不自己去讀那份文件，
 *    否則每個人都要監聽王文件＝又是那個 4000 次讀取的坑）。
 */
export async function startRaidRoom(roomId, hostId, { participants = {}, dateKey } = {}) {
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false, reason: "房間不存在" };
    const data = s.data();
    if (data.hostId !== hostId) return { ok: false, reason: "只有房主可以開始" };
    if (data.status !== "waiting") return { ok: false, reason: "已經開始了" };

    const roster = activeIds(data).map(id => ({
      memberId: id,
      name: data.members[id]?.name || id,
      ready: !!data.members[id]?.ready,
      participant: participants[id] || {},
    }));
    const check = canTeamDepart(roster, dateKey);
    if (!check.ok) return { ok: false, reason: check.blockers[0]?.text, blockers: check.blockers };

    const boss = WORLD_BOSSES[data.bossKey];
    const maxHp = Math.max(1, Number(boss?.hp) || 1);
    const state = createRaidState({
      boss: {
        key: data.bossKey, name: boss?.name || data.bossKey,
        hp: maxHp, maxHp, atk: boss?.atk || 100, def: boss?.def || 0,
        skillConfig: WORLD_BOSS_SKILLS[data.bossKey] || null,
      },
      members: rosterFromRoom(data),
      targetFmt: data.targetFmt, distanceM: data.distanceM,
    });

    await updateDoc(ref, {
      status: "active", round: 1, seq: 1,
      state: serializeRaidState(state), submissions: {},
      startedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 逐回合同步 ───────────────────────────────────────────

/** 隊員送出自己這回合的箭。**一回合只寫一次**——不要改成每射一箭就寫。 */
export async function submitRaidArrows(roomId, memberId, round, arrows) {
  try {
    if (!roomId || !memberId || !Array.isArray(arrows) || !arrows.length) {
      return { ok: false, reason: "沒有箭可以送出" };
    }
    // 只留結算需要的欄位，房間文件才不會愈長愈肥
    const lean = arrows.map(a => ({
      nx: Number(a.nx) || 0, ny: Number(a.ny) || 0,
      faceIndex: Number(a.faceIndex) || 0,
      score: Number(a.score) || 0,
      label: a.label || null,
    }));
    await updateDoc(doc(db, R, roomId), {
      [`submissions.${memberId}`]: { round: Math.max(1, Number(round) || 1), arrows: lean },
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

/**
 * 房主結算這一回合。全員送出才推得動（roomPhase.canResolve）。
 * 結算在**房主的裝置上**跑純函數，結果寫回房間；隊員看到 seq 變了就照 lastLog 重播。
 */
export async function resolveRaidRoomRound(roomId, hostId) {
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false, reason: "房間不存在" };
    const data = s.data();
    if (data.hostId !== hostId) return { ok: false, reason: "只有房主可以推進" };
    if (data.status !== "active") return { ok: false, reason: "討伐還沒開始" };

    const phase = roomPhase(data);
    if (!phase.canResolve) {
      return { ok: false, reason: `還在等 ${phase.waitingNames.join("、")}`, waitingFor: phase.waitingFor };
    }

    const state = hydrateRaidState(data.state);
    if (!state) return { ok: false, reason: "戰鬥狀態遺失" };

    const { state: next, log } = resolveRaidRound({ state, arrows: collectRoomArrows(data) });

    await updateDoc(ref, {
      state: serializeRaidState(next),
      lastLog: JSON.parse(JSON.stringify(log)),      // log 只有純資料，直接存
      round: next.round,
      seq: (Number(data.seq) || 0) + 1,
      submissions: {},                               // 清空，下一回合重來
      status: next.finished ? "done" : "active",
      ...(next.finished ? { finishedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, finished: next.finished, seq: (Number(data.seq) || 0) + 1 };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 監聽與離開 ───────────────────────────────────────────
export function subscribeRaidRoom(roomId, cb) {
  // 文件不存在（房間被解散）→ 回 null 讓前端退出；
  // 但暫時性連線錯誤不要回 null，否則會把玩家踢回大廳（villageBoardTeamDb 踩過）。
  return onSnapshot(
    doc(db, R, roomId),
    s => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    err => { console.warn("[raidRoom] snapshot error (ignored):", err?.message); },
  );
}

export function subscribeOpenRaidRooms(cb) {
  return onSnapshot(
    query(collection(db, R), where("status", "==", "waiting")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("[raidRoom] open rooms error (ignored):", err?.message); },
  );
}

export async function leaveRaidRoom(roomId, memberId) {
  try {
    await updateDoc(doc(db, R, roomId), {
      [`members.${memberId}`]: deleteField(),
      [`submissions.${memberId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function disbandRaidRoom(roomId, hostId) {
  try {
    const s = await getDoc(doc(db, R, roomId));
    if (!s.exists() || s.data().hostId !== hostId) return { ok: false, reason: "只有房主可以解散" };
    await deleteDoc(doc(db, R, roomId));
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

/**
 * ⚠️ 房主的強制推進：**有人斷線就永遠等不到他，全隊會卡死。**
 * 用「已經交上來的箭」直接結算——沒交的人這回合就是空手，不補假箭
 * （替他生箭等於幫他打，那是作弊；空手是誠實的結果）。
 * 比照 villageBoardTeamDb.forceAdvanceRoom 的解卡設計。
 */
export async function forceAdvanceRaidRoom(roomId, hostId) {
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false, reason: "房間不存在" };
    const data = s.data();
    if (data.hostId !== hostId) return { ok: false, reason: "只有房主可以強制推進" };
    if (data.status !== "active") return { ok: false, reason: "討伐還沒開始" };

    const phase = roomPhase(data);
    const arrows = collectRoomArrows(data);
    if (!arrows.length) return { ok: false, reason: "還沒有任何人送出，沒有東西可以結算" };

    const state = hydrateRaidState(data.state);
    if (!state) return { ok: false, reason: "戰鬥狀態遺失" };

    const { state: next, log } = resolveRaidRound({ state, arrows });
    await updateDoc(ref, {
      state: serializeRaidState(next),
      lastLog: JSON.parse(JSON.stringify(log)),
      round: next.round,
      seq: (Number(data.seq) || 0) + 1,
      submissions: {},
      status: next.finished ? "done" : "active",
      forcedAt: serverTimestamp(),
      forcedSkipped: phase.waitingFor,        // 誰被跳過，前端可以提示
      ...(next.finished ? { finishedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, skipped: phase.waitingNames, finished: next.finished };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

/**
 * 防斷線／防重整：找回我還在進行中的房間。
 * 比照 villageBoardTeamDb.findReconnectableBoardRoom。
 */
export async function findReconnectableRaidRoom(memberId) {
  if (!memberId) return { ok: false, room: null };
  try {
    const snap = await getDocs(query(collection(db, R), where("status", "in", ["waiting", "active"])));
    const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.members?.[memberId])
      .sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
        const tb = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
        return tb - ta;
      });
    return { ok: true, room: rooms[0] || null };
  } catch (e) { return { ok: false, reason: e?.message, room: null }; }
}

/** 房主的解卡工具：有人斷線就永遠等不到他，比照 villageBoardTeamDb.kickBoardMember */
export async function kickRaidMember(roomId, hostId, memberId) {
  try {
    const s = await getDoc(doc(db, R, roomId));
    if (!s.exists() || s.data().hostId !== hostId) return { ok: false, reason: "只有房主可以移除隊員" };
    if (memberId === hostId) return { ok: false, reason: "房主不能移除自己" };
    return await leaveRaidRoom(roomId, memberId);
  } catch (e) { return { ok: false, reason: e?.message }; }
}
