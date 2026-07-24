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
const shuffleArr = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 人數加成：×(1 + 0.12×(人數−1))，上限 ≈ ×1.84（8 人）
export function partyMultOf(count) {
  return 1 + 0.12 * Math.max(0, (count || 1) - 1);
}
function activeMembers(data) {
  return Object.entries(data.members || {}).filter(([, m]) => m != null);
}

// ── 房間生命週期 ─────────────────────────────────────────
export async function createBoardRoom({ hostId, hostName, mode, tier, accountType, avatarId }) {
  if (!hostId || !BOARD_MODE_MAP[mode]) return { ok: false, reason: "參數錯誤" };
  try {
    const code = genCode();
    const ref = await addDoc(collection(db, R), {
      code, hostId, hostName: hostName || "房主",
      status: "waiting", mode, tier: tier || 1,
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
    const snap = await getDocs(query(collection(db, R), where("code", "==", code.toUpperCase()), where("status", "==", "waiting")));
    if (snap.empty) return { ok: false, reason: "找不到房間，或遊戲已開始" };
    const roomDoc = snap.docs[0];
    const roomRef = doc(db, R, roomDoc.id);
    await runTransaction(db, async tx => {
      const latest = await tx.get(roomRef);
      if (!latest.exists()) throw new Error("房間不存在");
      const data = latest.data();
      if (data.status !== "waiting") throw new Error("遊戲已開始，無法加入");
      const members = Object.fromEntries(activeMembers(data));
      if (members[memberId]) return;
      if (Object.keys(members).length >= 8) throw new Error("房間已滿（最多 8 人）");
      tx.update(roomRef, { [`members.${memberId}`]: { name: memberName || "隊員", accountType: accountType || "official", avatarId: avatarId || null, joinedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
    });
    return { ok: true, roomId: roomDoc.id };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主開始遊戲：等待室 → 進行中
export async function startBoardRoom(roomId, hostId) {
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(doc(db, R, roomId));
      if (!s.exists()) throw new Error("房間不存在");
      if (s.data().hostId !== hostId) throw new Error("只有房主可開始");
      if (s.data().status !== "waiting") throw new Error("遊戲已開始");
      tx.update(doc(db, R, roomId), { status: "active", updatedAt: serverTimestamp() });
    });
    return { ok: true };
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
  return onSnapshot(query(collection(db, R), where("status", "==", "waiting")), snap => {
    cb(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, code: data.code, hostName: data.hostName, mode: data.mode, memberCount: activeMembers(data).length, createdAt: data.createdAt };
    }));
  }, () => cb([]));
}

// 斷線重連：找回仍含自己的進行中房間（取最新建立的，避免抓到舊殘房）
export async function findReconnectableBoardRoom(memberId) {
  if (!memberId) return { ok: false, room: null };
  try {
    const snap = await getDocs(query(collection(db, R), where("status", "in", ["waiting", "active"])));
    const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.members?.[memberId])
      .sort((a, b) => {
        // 以 createdAt 排序，最新的在前
        const ta = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const tb = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return tb - ta;
      });
    return { ok: true, room: rooms[0] || null };
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

// ── 房主行動：擲骰 → 寫 pendingMove（所有客戶端一起看動畫後才結算）──
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

      // ── 伺服器端防呆：檢查是否有未領取的 pending 事件/結算 ──
      const curSeq = room.seq || 0;
      const hasPendingSettle = room.pendingSettle?.seq === curSeq;
      const hasPendingEvent = room.pendingEvent?.seq === curSeq;
      if (hasPendingSettle || hasPendingEvent) {
        const memberIds = Object.keys(room.members || {}).filter(m => room.members[m] != null);
        const allClaimed = memberIds.every(mid =>
          (room.settleClaims?.[mid] || 0) >= curSeq ||
          (room.eventClaims?.[mid] || 0) >= curSeq
        );
        if (!allClaimed) throw new Error("請等待所有隊員領取獎勵後再擲骰");
      }

      const roll = 1 + Math.floor(Math.random() * 6);
      const from = room.boardPos || 0;
      const to = (from + roll) % BOARD_SIZE;
      const lapped = from + roll >= BOARD_SIZE;
      const tile = BOARD_LAYOUT[to];
      const count = activeMembers(room).length;
      tx.update(hostRef, { "villageBoard.dice": increment(-1) });
      // 只寫 pendingMove，不直接更新 boardPos / pendingSettle / pendingEvent
      // 等所有客戶端動畫結束後，房主再呼叫 commitBoardMove 完成結算
      tx.update(roomRef, {
        pendingMove: { from, to, roll, lapped, tile, partyMult: partyMultOf(count), modeId: room.mode, tier: room.tier || 1 },
        seq: (room.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      result = { ok: true, roll, from, to, lapped, tile };
    });
    if (result.lapped) import("./villageGoalDb").then(m => m.contributeLapToGoal(hostId, 1)).catch(() => {});
    return result;
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 動畫結束後房主確認移動 → 更新 boardPos + 設定 pendingSettle / pendingEvent
export async function commitBoardMove(roomId, hostId, { eventCard } = {}) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可確認");
      const room = s.data();
      const pm = room.pendingMove;
      if (!pm) throw new Error("無待確認的移動");

      const isShooting = TILE_TYPES[pm.tile]?.shooting;
      const isEventTile = pm.tile === "fate" || pm.tile === "opp";

      const updates = {
        boardPos: pm.to,
        ...(pm.lapped ? { lapCount: increment(1) } : {}),
        pendingMove: null,
        updatedAt: serverTimestamp(),
      };

      if (isEventTile && eventCard) {
        // 命運/機會：房主已抽牌，寫入 pendingEvent 讓隊員一起看
        updates.pendingEvent = { seq: room.seq, event: eventCard, partyMult: pm.partyMult };
      } else if (isShooting) {
        // 射箭格：隨機指派 1~2 位射手（不一定是房主），寫 pendingShoot 讓被指派者各自射。
        // 兩人射時最後由 finalizeBoardShoot 取平均評級。
        const mems = Object.keys(room.members || {}).filter(id => room.members[id] != null);
        const nShoot = (mems.length >= 2 && Math.random() < 0.5) ? 2 : 1;
        const shooters = shuffleArr(mems).slice(0, Math.min(nShoot, mems.length));
        updates.pendingShoot = {
          seq: room.seq, tileType: pm.tile, shooters, scores: {},
          partyMult: pm.partyMult,
          threshold: pm.tile === "monster" ? (30 + Math.floor(Math.random() * 16)) : 0,
        };
      } else {
        // 一般格子：直接設定結算
        updates.pendingSettle = { seq: room.seq, tileType: pm.tile, scoreRatio: 0, partyMult: pm.partyMult };
      }

      tx.update(ref, updates);
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 射手：交出自己這 6 箭的分數（score 0~60）與採集進度（mining 用）。只有被指派的射手能交。
export async function submitBoardShootScore(roomId, memberId, { score = 0, progress = 0 } = {}) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error("房間不存在");
      const ps = s.data().pendingShoot;
      if (!ps) throw new Error("目前不需射箭");
      if (!ps.shooters?.includes(memberId)) throw new Error("你不是本回合的射手");
      if (ps.scores?.[memberId] != null) throw new Error("已提交");
      tx.update(ref, { [`pendingShoot.scores.${memberId}`]: { score, progress }, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主：全部射手交完後結算（取平均分數 → pendingSettle，讓全員各自 claim）
export async function finalizeBoardShoot(roomId, hostId) {
  try {
    let done = false;
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可結算");
      const ps = s.data().pendingShoot;
      if (!ps) return;
      const shooters = ps.shooters || [];
      const submitted = Object.keys(ps.scores || {});
      if (submitted.length < shooters.length) return; // 還有射手沒交
      const vals = shooters.map(id => ps.scores[id] || { score: 0, progress: 0 });
      const avgScore = vals.reduce((a, v) => a + (v.score || 0), 0) / (vals.length || 1);
      const avgProgress = vals.reduce((a, v) => a + (v.progress || 0), 0) / (vals.length || 1);
      tx.update(ref, {
        pendingSettle: {
          seq: ps.seq, tileType: ps.tileType,
          scoreRatio: avgScore / 60,
          threshold: ps.threshold || 0,
          gatheringProgress: avgProgress || 0,
          partyMult: ps.partyMult || 1,
        },
        pendingShoot: null,
        updatedAt: serverTimestamp(),
      });
      done = true;
    });
    return { ok: true, done };
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
    // 以房主開房時選的 T 階（room.tier）為上限，不看各隊員自己的建築等級，
    // 否則低階隊員在房主的高階房間也只能拿到 T1 材料。
    const roomTier = room.tier || getModeTierCap(room.mode, villageBuildings);
    const reward = rollTileReward(ps.tileType, {
      mode, tierCap: roomTier, tier: roomTier,
      partyMult: ps.partyMult || 1,
      scoreRatio: ps.scoreRatio || 0,
      threshold: ps.threshold || 0,
      gatheringProgress: ps.gatheringProgress || 0,
    });
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
    const roomTier = room.tier || tierCap;
    const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    // 只處理「資源類/寶箱/貓咪/微獎勵/team.allBuff」——這些每人各自入帳。
    // 回傳實際變動明細，讓 UI 顯示「獲得/失去 X」，玩家才知道結果。
    let result = { kind: eff?.type || "flavor" };
    if (eff) {
      if (eff.type === "micro") {
        await applyBoardReward(memberId, { coins: eff.coins || 0 }, { catId });
        result = { kind: "micro", resource: "coins", amount: eff.coins || 0, sign: 1 };
      } else if (eff.type === "gain") {
        const amt = rnd(eff.min, eff.max);
        await applyGain(memberId, mode, eff.resource, amt, roomTier, catId);
        result = { kind: "gain", resource: eff.resource, amount: amt, sign: 1 };
      } else if (eff.type === "lose") {
        const amt = rnd(eff.min, eff.max);
        await applyLose(memberId, eff.resource, amt);
        result = { kind: "lose", resource: eff.resource, amount: amt, sign: -1 };
      } else if (eff.type === "chest") {
        await applyBoardReward(memberId, { chests: [{ kind: eff.kind, family: mode.family, tier: roomTier }] }, {});
        result = { kind: "chest" };
      } else if (eff.type === "catBond") {
        await applyBoardReward(memberId, { catXP: eff.xp || 0, catBond: eff.bond || 0 }, { catId });
        result = { kind: "catBond", xp: eff.xp || 0, bond: eff.bond || 0 };
      } else if (eff.type === "team") { // allBuff/gift/steal 在合作模式一律視為全員得益
        if (eff.resource) {
          const amt = rnd(eff.min ?? 1, eff.max ?? 3);
          await applyGain(memberId, mode, eff.resource, amt, roomTier, catId);
          result = { kind: "gain", resource: eff.resource, amount: amt, sign: 1 };
        } else result = { kind: "team" };
      } else if (eff.type === "dice") {
        result = { kind: "dice", delta: eff.delta }; // 骰數由房主端套用，這裡只回報給 UI 顯示
      }
      // move/teleport/multiplier/trigger 由房主端處理共享棋，不在此重複
    }
    await updateDoc(ref, { [`eventClaims.${memberId}`]: pe.seq });
    return { ok: true, ...result };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 事件「失去」：直接對 member 文件扣（coins/gachaCoins/村資源；家族素材不扣）
async function applyLose(memberId, resource, amount) {
  const n = -Math.abs(amount || 0);
  if (!n) return;
  const patch = {};
  if (resource === "coins") patch.coins = increment(n);
  else if (resource === "gachaToken") patch.gachaCoins = increment(n);
  else if (resource === "material" || resource === "catXP") return; // 這兩類不扣
  else patch[`village.resources.${resource}`] = increment(n); // arrowdew/ore/melon…
  await updateDoc(doc(db, "members", memberId), patch).catch(() => {});
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
