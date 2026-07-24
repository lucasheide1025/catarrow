// src/lib/villageBoardTeamDb.js
// 貓貓村大富翁：組隊房間（全員一起一顆棋、只吃房主骰子、成員各自 claim 獎勵）。
// 規格見 docs/second_brain/village-board-spec.md §3。
// ⚠️ Firestore 規則禁止「一人幫全部人寫入 members」→ 房主只寫「待結算」到房間，
//    每位成員各自 claim（寫自己的 member 文件），比照 claimTeamExpeditionResult。
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, onSnapshot,
  query, where, runTransaction, serverTimestamp, deleteDoc, deleteField, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { BOARD_LAYOUT, BOARD_SIZE, BOARD_MODE_MAP, getModeTierCap, rollTileReward, TILE_TYPES } from "./boardData";
import { applyBoardReward } from "./villageBoardDb";

const R = "villageBoardRooms";
const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// 人數加成：×(1 + 0.12×(人數−1))，上限 ≈ ×1.84（8 人）
export function partyMultOf(count) {
  return 1 + 0.12 * Math.max(0, (count || 1) - 1);
}
function activeMembers(data) {
  return Object.entries(data.members || {}).filter(([, m]) => m != null);
}

// ── 房間生命週期 ─────────────────────────────────────────
export async function createBoardRoom({ hostId, hostName, mode, accountType, avatarId }) {
  if (!hostId || !BOARD_MODE_MAP[mode]) return { ok: false, reason: "參數錯誤" };
  try {
    const code = genCode();
    const ref = await addDoc(collection(db, R), {
      code, hostId, hostName: hostName || "房主",
      status: "active", mode,
      boardPos: 0, lapCount: 0,
      seq: 0, pendingSettle: null, pendingEvent: null,
      settleClaims: {}, eventClaims: {},
      members: { [hostId]: { name: hostName || "房主", accountType: accountType || "official", avatarId: avatarId || null, joinedAt: serverTimestamp() } },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ok: true, roomId: ref.id, code };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function joinBoardRoom(code, memberId, memberName, { accountType, avatarId } = {}) {
  try {
    const snap = await getDocs(query(collection(db, R), where("code", "==", code.toUpperCase()), where("status", "==", "active")));
    if (snap.empty) return { ok: false, reason: "找不到房間或已結束" };
    const roomDoc = snap.docs[0];
    const roomRef = doc(db, R, roomDoc.id);
    await runTransaction(db, async tx => {
      const latest = await tx.get(roomRef);
      if (!latest.exists()) throw new Error("房間不存在");
      const data = latest.data();
      if (data.status !== "active") throw new Error("房間已結束");
      const members = Object.fromEntries(activeMembers(data));
      if (members[memberId]) return;
      if (Object.keys(members).length >= 8) throw new Error("房間已滿（最多 8 人）");
      tx.update(roomRef, { [`members.${memberId}`]: { name: memberName || "隊員", accountType: accountType || "official", avatarId: avatarId || null, joinedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
    });
    return { ok: true, roomId: roomDoc.id };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export function subscribeBoardRoom(roomId, cb) {
  return onSnapshot(doc(db, R, roomId), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => cb(null));
}

export async function leaveBoardRoom(roomId, memberId) {
  try { await updateDoc(doc(db, R, roomId), { [`members.${memberId}`]: deleteField() }); return { ok: true }; }
  catch (e) { return { ok: false, reason: e?.message }; }
}

export async function disbandBoardRoom(roomId, hostId) {
  try {
    const s = await getDoc(doc(db, R, roomId));
    if (!s.exists()) return { ok: true };
    if (s.data().hostId !== hostId) return { ok: false, reason: "只有房主可解散" };
    await updateDoc(doc(db, R, roomId), { status: "completed" });
    await deleteDoc(doc(db, R, roomId)).catch(() => {});
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export function subscribeOpenBoardRooms(cb) {
  return onSnapshot(query(collection(db, R), where("status", "==", "active")), snap => {
    cb(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, code: data.code, hostName: data.hostName, mode: data.mode, memberCount: activeMembers(data).length, createdAt: data.createdAt };
    }));
  }, () => cb([]));
}

// 斷線重連：找回仍含自己的進行中房間
export async function findReconnectableBoardRoom(memberId) {
  if (!memberId) return { ok: false, room: null };
  try {
    const snap = await getDocs(query(collection(db, R), where("status", "==", "active")));
    const room = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(r => r.members?.[memberId]);
    return { ok: true, room: room || null };
  } catch (e) { return { ok: false, reason: e?.message, room: null }; }
}

export async function setRoomMode(roomId, hostId, mode) {
  if (!BOARD_MODE_MAP[mode]) return { ok: false };
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(doc(db, R, roomId));
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可改模式");
      tx.update(doc(db, R, roomId), { mode, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 房主行動：擲骰（吃房主 members.villageBoard.dice）→ 前進共享棋 → 設定待結算 ──
export async function roomRollAndMove(roomId, hostId) {
  try {
    let result = { ok: false };
    await runTransaction(db, async tx => {
      const roomRef = doc(db, R, roomId);
      const hostRef = doc(db, "members", hostId);
      const [rs, hs] = await Promise.all([tx.get(roomRef), tx.get(hostRef)]);
      if (!rs.exists()) throw new Error("房間不存在");
      const room = rs.data();
      if (room.hostId !== hostId) throw new Error("只有房主可擲骰");
      const dice = hs.data()?.villageBoard?.dice || 0;
      if (dice <= 0) throw new Error("房主骰子用完了");
      const roll = 1 + Math.floor(Math.random() * 6);
      const from = room.boardPos || 0;
      const to = (from + roll) % BOARD_SIZE;
      const lapped = from + roll >= BOARD_SIZE;
      const tile = BOARD_LAYOUT[to];
      const count = activeMembers(room).length;
      tx.update(hostRef, { "villageBoard.dice": increment(-1) });
      tx.update(roomRef, {
        boardPos: to, ...(lapped ? { lapCount: increment(1) } : {}),
        // 射箭/事件格先不結算（等房主射箭/翻牌）；其餘立即設 pendingSettle
        ...(TILE_TYPES[tile]?.shooting || tile === "fate" || tile === "opp"
          ? {}
          : { pendingSettle: { seq: (room.seq || 0) + 1, tileType: tile, scoreRatio: 0, partyMult: partyMultOf(count) }, seq: (room.seq || 0) + 1 }),
        updatedAt: serverTimestamp(),
      });
      result = { ok: true, roll, from, to, lapped, tile };
    });
    return result;
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主：射箭格結算（房主代表射，帶 scoreRatio）
export async function roomSettleShoot(roomId, hostId, tileType, scoreRatio) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可結算");
      const room = s.data();
      const count = activeMembers(room).length;
      tx.update(ref, { pendingSettle: { seq: (room.seq || 0) + 1, tileType, scoreRatio, partyMult: partyMultOf(count) }, seq: (room.seq || 0) + 1, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主：命運/機會抽牌 → 設 pendingEvent
export async function roomDrawEvent(roomId, hostId, event) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可抽牌");
      const room = s.data();
      const count = activeMembers(room).length;
      tx.update(ref, { pendingEvent: { seq: (room.seq || 0) + 1, event, partyMult: partyMultOf(count) }, seq: (room.seq || 0) + 1, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主：共享棋移動/傳送/加骰（命運機會的 move/teleport/dice）
export async function roomApplyBoardEffect(roomId, hostId, { pos, diceDelta }) {
  try {
    const patch = { updatedAt: serverTimestamp() };
    if (pos != null) patch.boardPos = ((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
    await updateDoc(doc(db, R, roomId), patch);
    if (diceDelta) await updateDoc(doc(db, "members", hostId), { "villageBoard.dice": increment(diceDelta) });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 成員自行 claim（寫自己的 member 文件）──────────────────
// 每位成員偵測到新的 pendingSettle.seq > 自己已 claim 的 seq，就用「自己的建築階級」算獎勵並入帳。
export async function claimBoardSettle(roomId, memberId, { villageBuildings = {}, catId } = {}) {
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false };
    const room = s.data();
    const ps = room.pendingSettle;
    if (!ps) return { ok: false, reason: "無待結算" };
    if ((room.settleClaims?.[memberId] || 0) >= ps.seq) return { ok: false, reason: "已領取" };
    const mode = BOARD_MODE_MAP[room.mode];
    const tierCap = getModeTierCap(room.mode, villageBuildings);
    const reward = rollTileReward(ps.tileType, { mode, tierCap, partyMult: ps.partyMult || 1, scoreRatio: ps.scoreRatio || 0 });
    await applyBoardReward(memberId, reward, { catId });
    await updateDoc(ref, { [`settleClaims.${memberId}`]: ps.seq });
    return { ok: true, reward };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 命運/機會：成員各自 claim（資源類入自己帳；移動/傳送/加骰由房主套用到房間，成員不重複）
export async function claimBoardEvent(roomId, memberId, { villageBuildings = {}, catId } = {}) {
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false };
    const room = s.data();
    const pe = room.pendingEvent;
    if (!pe) return { ok: false };
    if ((room.eventClaims?.[memberId] || 0) >= pe.seq) return { ok: false, reason: "已領取" };
    const eff = pe.event?.effect;
    const mode = BOARD_MODE_MAP[room.mode];
    const tierCap = getModeTierCap(room.mode, villageBuildings);
    const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    // 只處理「資源類/寶箱/貓咪/微獎勵/team.allBuff」——這些每人各自入帳。
    if (eff) {
      if (eff.type === "micro") await applyBoardReward(memberId, { coins: eff.coins || 0 }, { catId });
      else if (eff.type === "gain") await applyGain(memberId, mode, eff.resource, rnd(eff.min, eff.max), tierCap, catId);
      else if (eff.type === "chest") await applyBoardReward(memberId, { chests: [{ kind: eff.kind, family: mode.family, tier: tierCap }] }, {});
      else if (eff.type === "catBond") await applyBoardReward(memberId, { catXP: eff.xp || 0, catBond: eff.bond || 0 }, { catId });
      else if (eff.type === "team") { // allBuff/gift/steal 在合作模式一律視為全員得益
        if (eff.resource) await applyGain(memberId, mode, eff.resource, rnd(eff.min ?? 1, eff.max ?? 3), tierCap, catId);
      }
      // move/teleport/dice/multiplier/trigger 由房主端處理共享棋，不在此重複
    }
    await updateDoc(ref, { [`eventClaims.${memberId}`]: pe.seq });
    return { ok: true, kind: eff?.type || "flavor" };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

async function applyGain(memberId, mode, resource, amount, tierCap, catId) {
  if (resource === "material") {
    const tier = Math.min(6, Math.max(1, Math.ceil(Math.random() * tierCap)));
    return applyBoardReward(memberId, { familyMaterials: { [`${mode.family}_m${tier}`]: amount } }, {});
  }
  const r = { coins: 0, arrowdew: 0, gachaToken: 0, catXP: 0 };
  if (resource === "coins") r.coins = amount;
  else if (resource === "arrowdew") r.arrowdew = amount;
  else if (resource === "gachaToken") r.gachaToken = amount;
  else if (resource === "catXP") r.catXP = amount;
  else return applyBoardReward(memberId, { villageResources: { [resource]: amount } }, {});
  return applyBoardReward(memberId, r, { catId });
}
