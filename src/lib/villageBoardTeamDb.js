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
import { BOARD_MODE_MAP, getModeTierCap, rollTileReward, rollTrapEvent, trapEffectOf } from "./boardData";
import {
  JOURNEY_SHOOTING_TILES, JOURNEY_MAP_META, generateJourney, randomSeed, nextPos,
  applyTrapPos, applyShortcutPos, findNextTile, mergeBuffs, applyJourneyMultipliers, normalizeVillageBoard,
  rollJourneyDice,
} from "./boardJourney";
import { applyBoardReward, claimCardGachaTeamFree } from "./villageBoardDb";

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
      boardPos: 0, journeySeed: 0, buffs: {}, clears: 0, forkVotes: {},
      seq: 0, pendingSettle: null, pendingEvent: null, pendingFork: null,
      settleClaims: {}, eventClaims: {}, ackClaims: {},
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

// 房主開始遊戲：等待室 → 進行中，並把「房主的旅程」帶進房間。
// ⚠️ 組隊共用的部分吃房主的進度：房主那張圖已有進行中的旅程（length≥100 才是真的
//    旅程，非 legacy 28 格棋盤）就直接續走；沒有就開一條新旅程。旅程 seed 寫進房間
//    （journeySeed），所有客戶端用 generateJourney(mode, seed) 確定性重算同一條路線。
export async function startBoardRoom(roomId, hostId) {
  try {
    let result = { ok: false };
    await runTransaction(db, async tx => {
      const roomRef = doc(db, R, roomId);
      const hostRef = doc(db, "members", hostId);
      const [s, hs] = await Promise.all([tx.get(roomRef), tx.get(hostRef)]);
      if (!s.exists()) throw new Error("房間不存在");
      const room = s.data();
      if (room.hostId !== hostId) throw new Error("只有房主可開始");
      if (room.status !== "waiting") throw new Error("遊戲已開始");
      const norm = normalizeVillageBoard(hs.data()?.villageBoard || {});
      const m = norm.maps[room.mode];
      let seed, pos, clears, tier, buffs;
      if (m && m.length >= 100 && m.seed) {
        seed = m.seed; pos = m.pos || 0; clears = m.clears || 0; tier = m.tier || room.tier || 1;
        buffs = m.buffs || {};   // ⚠️ 續走房主旅程：把上一個房間累積的加成帶過來（骰子用完不消失）
      } else {
        seed = randomSeed(); pos = 0; clears = 0; tier = room.tier || 1; buffs = {};
      }
      const j = generateJourney(room.mode, seed);
      tx.update(hostRef, { [`villageBoard.maps.${room.mode}`]: { seed, pos, length: j.length, clears, tier, buffs } });
      tx.update(roomRef, {
        status: "active",
        journeySeed: seed,
        boardPos: pos,
        tier,            // ⚠️ 沿用旅程鎖定階級：進行中→房主鎖定的 T；新旅程→房主選的 T。
        //    以前不寫，若房主有進行中旅程但 lobby 重選 T，獎勵會用錯的 room.tier。
        buffs,
        clears: 0,
        forkVotes: {},
        updatedAt: serverTimestamp(),
      });
      result = { ok: true };
    });
    return result;
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 依落點計算本步的 room patch（boardPos + pending* + buffs）。純計算，無 IO。
// 房主擲骰與分岔路決定共用同一套「落點結算」邏輯。
// room 需含 mode/tier/buffs；j 為 generateJourney 結果；seq 為本步編號。
function landingPatch(room, j, finalTo, seq, partyMult, memberIds) {
  const tile = j.cells[finalTo];
  const patch = { boardPos: finalTo, pendingSettle: null, pendingShoot: null, pendingEvent: null, pendingFork: null };
  const campMult = room.buffs?.campMult || 1;
  if (JOURNEY_SHOOTING_TILES.has(tile)) {
    // 終點 Boss：全員開弓；一般怪物格：隨機抽半數（保底 1 人）
    let shooters = memberIds;
    if (tile === "monster") {
      shooters = memberIds.filter(() => Math.random() < 0.5);
      if (shooters.length === 0 && memberIds.length) shooters = [memberIds[Math.floor(Math.random() * memberIds.length)]];
    }
    patch.pendingShoot = { seq, tileType: tile, shooters, scores: {}, partyMult };
  } else if (tile === "fork") {
    // 分岔路：預算兩條路的目標格（與單人版同一套 findNextTile 規則）
    const li = findNextTile(j.cells, finalTo, ["material", "mining"]);
    const ri = findNextTile(j.cells, finalTo, ["monster"]);
    patch.pendingFork = {
      seq,
      options: {
        left: li != null ? { pos: li, tile: j.cells[li], dist: li - finalTo } : null,
        right: ri != null ? { pos: ri, tile: j.cells[ri], dist: ri - finalTo } : null,
      },
    };
  } else if (tile === "camp" || tile === "empower" || tile === "catmate") {
    // buff 格：效果寫進房間（共享），成員各自 ack
    const reward = rollTileReward(tile, { mode: JOURNEY_MAP_META[room.mode], tierCap: room.tier || 1, tier: room.tier || 1, partyMult });
    patch.buffs = mergeBuffs(room.buffs || {}, reward);
    patch.pendingSettle = { seq, tileType: tile, partyMult, campMult };
  } else {
    patch.pendingSettle = { seq, tileType: tile, partyMult, campMult };
  }
  return { patch, tile };
}

export function subscribeBoardRoom(roomId, cb) {
  // 文件存在 → 回資料；不存在（房間被解散）→ 回 null 讓前端退出。
  // 但「暫時性連線錯誤」不要回 null（否則會把玩家踢回大廳＝跳掉）——錯誤時保持現況，等下次快照。
  return onSnapshot(
    doc(db, R, roomId),
    s => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    err => { console.warn("[boardRoom] snapshot error (ignored):", err?.message); },
  );
}

// 全員領完當前這步後，房主清空 pending（否則殘留在房間文件，離開再回來會重複看到同一張卡/結算）
export async function clearRoomPending(roomId, hostId) {
  try {
    const s = await getDoc(doc(db, R, roomId));
    if (!s.exists() || s.data().hostId !== hostId) return { ok: false };
    await updateDoc(doc(db, R, roomId), { pendingEvent: null, pendingSettle: null, pendingFork: null, updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 隊員按下「收下！」＝確認看完這一步的演出。
// 與 settleClaims（領取）刻意分開：領取是動畫追上就自動寫入，確保獎勵不會因為沒按而丟失；
// ack 才是「人看完了」。房主的推進閘門吃 ack，所以不會在隊員還在看獎勵時就骰下一步。
// 沒有獎勵可看的步驟（清單為空、或事件只跳 toast）由前端立即 ack，避免全隊互等。
export async function ackBoardStep(roomId, memberId, seq) {
  try {
    const n = Math.max(0, Math.floor(Number(seq) || 0));
    if (!roomId || !memberId || n <= 0) return { ok: false, reason: "參數不足" };
    const ref = doc(db, R, roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, reason: "房間不存在" };
    if ((snap.data().ackClaims?.[memberId] || 0) >= n) return { ok: true, already: true };
    await updateDoc(ref, { [`ackClaims.${memberId}`]: n, updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 房主的兩個解卡工具（隊員斷線/關 App 時全隊會永遠互等）────────────
// ⚠️ 共同前提：`allPassed` 要成立才推得動，而斷線的人不會再寫任何 claim。

// ① 移除隊員：等同幫他按「離開」。若他正好是本回合被指派的射手，也要從 shooters
//    移掉，否則 finalizeBoardShoot 永遠收不齊，換成踢人也解不了卡。
export async function kickBoardMember(roomId, hostId, memberId) {
  if (!memberId || memberId === hostId) return { ok: false, reason: "不能移除房主" };
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可移除隊員");
      const room = s.data();
      const upd = { [`members.${memberId}`]: deleteField(), updatedAt: serverTimestamp() };
      const ps = room.pendingShoot;
      if (ps?.shooters?.includes(memberId)) {
        const shooters = ps.shooters.filter(id => id !== memberId);
        const scores = { ...(ps.scores || {}) };
        delete scores[memberId];
        upd.pendingShoot = { ...ps, shooters, scores };
      }
      tx.update(ref, upd);
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ② 強制推進：不等沒完成的人。哪一段卡住就推哪一段——
//    卡在射箭 → 用「已交的分數」直接結算（沒交的不計）；卡在領取 → 記 forcedSeq，
//    讓所有客戶端把這一步視為已通過。沒領到的人就是沒領到（作者拍板）。
export async function forceAdvanceRoom(roomId, hostId) {
  try {
    // 卡在分岔路 → 用目前的票直接決定（不等沒投的人）
    const pre = await getDoc(doc(db, R, roomId));
    if (!pre.exists()) return { ok: false, reason: "房間不存在" };
    if (pre.data().hostId !== hostId) return { ok: false, reason: "只有房主可強制推進" };
    if (pre.data().pendingFork) {
      await resolveFork(roomId, hostId, { force: true });
      return { ok: true, kind: "fork" };
    }
    let kind = "none";
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可強制推進");
      const room = s.data();
      const ps = room.pendingShoot;
      if (ps) {
        const submitted = Object.values(ps.scores || {});
        const avgScore = submitted.reduce((a, v) => a + (v.score || 0), 0) / (submitted.length || 1);
        tx.update(ref, {
          pendingSettle: {
            seq: ps.seq, tileType: ps.tileType,
            scoreRatio: Math.min(1, avgScore / 60 + (Number(room.buffs?.catmate) || 0) * 0.05),
            shootMult: room.buffs?.nextShootMult || 1,
            campMult: room.buffs?.campMult || 1,
            partyMult: ps.partyMult || 1,
          },
          pendingShoot: null,
          updatedAt: serverTimestamp(),
        });
        kind = "shoot";
      } else {
        tx.update(ref, { forcedSeq: room.seq || 0, updatedAt: serverTimestamp() });
        kind = "claims";
      }
    });
    return { ok: true, kind };
  } catch (e) { return { ok: false, reason: e?.message }; }
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

// ── 房主行動：擲骰（一次原子完成，權威狀態機，不依賴動畫）──
// 直接更新 boardPos + 設好本步的 pending（射箭/事件/結算），寫 lastMove 給前端做「跟隨動畫」。
// 這樣房主本機動畫就算卡住/被 re-render 打斷，權威狀態仍正確，不會再「丟了骰系統判斷沒丟、隊員走了房主原地」。
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
      if (!room.journeySeed) throw new Error("旅程尚未開始");

      // 防呆：本步（curSeq）還有沒射完/沒完成（含分岔投票）的 pending → 擋
      const curSeq = room.seq || 0;
      const memberIds = Object.keys(room.members || {}).filter(m => room.members[m] != null);
      if (room.pendingShoot?.seq === curSeq) throw new Error("還有射手沒射完");
      if (room.pendingSettle?.seq === curSeq || room.pendingEvent?.seq === curSeq || room.pendingFork?.seq === curSeq) {
        const allClaimed = memberIds.every(mid =>
          (room.settleClaims?.[mid] || 0) >= curSeq || (room.eventClaims?.[mid] || 0) >= curSeq || !!room.forkVotes?.[mid]);
        if (!allClaimed) throw new Error("請等待所有隊員完成後再擲骰");
      }

      const dice = hs.data()?.villageBoard?.dice || 0;
      if (dice <= 0) throw new Error("房主骰子用完了");

      // ── 旅程內前進（直線 100~200 格，夾在終點）＋陷阱/捷徑的特殊移動 ──
      const j = generateJourney(room.mode, room.journeySeed);
      // 🎲 多骰（強化格 diceCount buff）：一次擲 2~3 顆骰子；用完即消耗（null＝未啟用）。
      //   消耗要先算——若這步又踩到 buff 格，landingPatch 吃的 buffs 必須是「已消耗」後的，
      //   否則舊 diceCount 會被併回新 buffs，下次擲骰又生效（幽靈多骰）。
      const diceN = room.buffs?.diceCount || 1;
      const consumedBuffs = diceN > 1 ? { ...(room.buffs || {}), diceCount: null } : null;
      const effRoom = consumedBuffs ? { ...room, buffs: consumedBuffs } : room;
      const { rolls, total } = rollJourneyDice(diceN);
      const roll = total;
      const from = room.boardPos || 0;
      const to = nextPos(from, roll, j.length);
      const landTile = j.cells[to];
      let finalTo = to;
      let trapEv = null;
      if (landTile === "trap") { trapEv = rollTrapEvent(room.tier || 1); finalTo = applyTrapPos(to, j.length, trapEv.back); }
      else if (landTile === "shortcut") finalTo = applyShortcutPos(to, j.length, 3 + Math.floor(Math.random() * 3));
      const pMult = partyMultOf(memberIds.length);
      const nextSeq = curSeq + 1;
      const atBoss = finalTo === j.length - 1 && j.cells[finalTo] === "boss";
      let patch, tile;
      if (atBoss || (landTile !== "trap" && landTile !== "shortcut")) {
        ({ patch, tile } = landingPatch(effRoom, j, finalTo, nextSeq, pMult, memberIds));
      } else {
        // 陷阱/捷徑本身：token 已移動，本步結算陷阱懲罰或捷徑訊息
        patch = {
          boardPos: finalTo,
          pendingSettle: {
            seq: nextSeq, tileType: landTile, partyMult: pMult, campMult: room.buffs?.campMult || 1,
            trapType: trapEv?.type || null,   // ⚠️ 陷阱類型要帶進 pending——組隊 claim 時同一個事件，別各自重抽
          },
          pendingShoot: null, pendingEvent: null, pendingFork: null,
        };
        tile = landTile;
      }
      const upd = {
        ...patch,
        hostDiceLeft: dice - 1,
        seq: nextSeq,
        // lastMove：前端據此把棋子從 from 逐格走到 to（骰子落點），再跳/退到 finalTo
        lastMove: { seq: nextSeq, from, to, finalTo, roll, rolls, tile, viaTile: landTile, partyMult: pMult, modeId: room.mode, tier: room.tier || 1 },
        updatedAt: serverTimestamp(),
      };
      // 多骰消耗（沒踩到新 buff 格時）：把 diceCount:null 寫回房間，避免下次擲骰幽靈生效
      if (consumedBuffs && !patch.buffs) upd.buffs = consumedBuffs;
      // 同步寫回房主旅程進度（明天繼續 / 斷線不丟進度）
      // ⚠️ buff 格同時把疊加結果寫回房主旅程——骰子用完/房間解散後 buff 不消失（08-07 玩家需求）
      const hostPatch = { "villageBoard.dice": increment(-1), [`villageBoard.maps.${room.mode}.pos`]: finalTo };
      if (patch.buffs) hostPatch[`villageBoard.maps.${room.mode}.buffs`] = patch.buffs;
      else if (consumedBuffs) hostPatch[`villageBoard.maps.${room.mode}.buffs`] = consumedBuffs;
      tx.update(hostRef, hostPatch);
      tx.update(roomRef, upd);
      result = { ok: true, roll, rolls, from, to, finalTo, tile };
    });
    if (result.ok) import("./worldBossDb").then(module => module.contributeWorldBossSpawnProgress({
      memberId:hostId, type:"villageDice", amount:1, operationId:`village-team-dice:${roomId}:${result.from}:${result.to}:${Date.now()}`,
    })).catch(() => {});
    return result;
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
      const hostRef = doc(db, "members", hostId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可結算");
      const room = s.data();
      const ps = room.pendingShoot;
      if (!ps) return;
      const shooters = ps.shooters || [];
      const submitted = Object.keys(ps.scores || {});
      if (submitted.length < shooters.length) return; // 還有射手沒交
      const vals = shooters.map(id => ps.scores[id] || { score: 0, progress: 0 });
      const avgScore = vals.reduce((a, v) => a + (v.score || 0), 0) / (vals.length || 1);
      // 貓夥伴 buff：射箭完成度 +5%/層（可疊加；與單人旅程一致）
      const effRatio = Math.min(1, avgScore / 60 + (Number(room.buffs?.catmate) || 0) * 0.05);
      const shootMult = room.buffs?.nextShootMult || 1;
      const campMult = room.buffs?.campMult || 1;
      const upd = {
        pendingSettle: {
          seq: ps.seq, tileType: ps.tileType,
          scoreRatio: effRatio,
          shootMult, campMult,
          partyMult: ps.partyMult || 1,
        },
        pendingShoot: null,
        updatedAt: serverTimestamp(),
      };
      if (ps.tileType === "boss") {
        // 🏁 完成旅程：房主 maps clears+1、換新 seed、位置歸零；房間同步新 seed
        const hs = await tx.get(hostRef);
        const vb = normalizeVillageBoard(hs.data()?.villageBoard || {});
        const m = vb.maps[room.mode] || {};
        const clears = (m.clears || 0) + 1;
        const newSeed = randomSeed();
        const j2 = generateJourney(room.mode, newSeed);
        // ⚠️ 階級重選（08-07）：房主每趟走完後，下次開房在 lobby 重選 T——tier 歸 0＝未鎖定。
        //    同房間繼續的新一趟仍用 room.tier（獎勵一致），只有下次開房（startBoardRoom）才重選。
        tx.update(hostRef, {
          [`villageBoard.maps.${room.mode}`]: { seed: newSeed, pos: 0, length: j2.length, clears, tier: 0, buffs: {} },
        });
        upd.journeySeed = newSeed;
        upd.boardPos = 0;
        upd.buffs = {};
        upd.clears = increment(1);
      } else {
        // 強化 buff 用完即棄（下一射箭格不再 ×2）——同步回房主旅程，
        // 避免下次開房把已消耗的強化當成「幽靈加成」復活
        const consumedBuffs = { ...(room.buffs || {}), nextShootMult: null };
        upd.buffs = consumedBuffs;
        tx.update(hostRef, { [`villageBoard.maps.${room.mode}.buffs`]: consumedBuffs });
      }
      tx.update(ref, upd);
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

// 房主：共享棋移動/加骰（舊版命運機會用；旅程模式不再翻卡，保留供相容）
export async function roomApplyBoardEffect(roomId, hostId, { pos, diceDelta }) {
  try {
    const patch = { updatedAt: serverTimestamp() };
    if (pos != null) patch.boardPos = Math.max(0, Math.floor(pos) || 0);
    if (diceDelta) patch.hostDiceLeft = increment(diceDelta); // 房間同步房主骰數（+骰事件）
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
    const partyMult = ps.partyMult || 1;
    let reward;
    if (ps.tileType === "cardgacha") {
      // 🃏 抽卡房：組隊自動化結算——每人免費抽 1 張該 T 階普通怪卡（不開付費互動，
      //    付費抽 3 張留單人版）。卡片直接入個人收集，reward 帶 views 供 UI 顯示。
      const gacha = await claimCardGachaTeamFree(memberId, roomTier);
      // ⚠️ 跟一般格一樣要寫 settleClaims——否則重整/斷線重連會再 claim 一次（重複領卡），
      //    房主的「全員領完清 pending」也讀這欄位，少了它會卡等。
      await updateDoc(ref, { [`settleClaims.${memberId}`]: ps.seq });
      return { ok: true, reward: { band: "cardgacha", cardGachaViews: gacha?.ok ? gacha.views : [] } };
    }
    if (ps.tileType === "fate" || ps.tileType === "opp") {
      // 旅程中命運/機會＝給少量金幣（不翻卡，與單人旅程一致）
      reward = { coins: (20 + Math.floor(Math.random() * 60) * roomTier) * partyMult, band: ps.tileType };
    } else if (ps.tileType === "trap") {
      // 陷阱：多種事件（蛇咬/流沙/竊金/骰子/箭露）——同一事件全隊共用（房主已抽好放進 pendingSettle）。
      // 後退已由房主移動；這裡只懲罰資源（每人各自扣，下限 0）。
      const ev = trapEffectOf(ps.trapType, roomTier);
      reward = { band: ev.label, trapType: ev.type, icon: ev.icon };
      const me = await getDoc(doc(db, "members", memberId));
      const coins = me.data()?.coins || 0;
      const lose = Math.min(coins, ev.loseCoins || 0);
      const patch = {};
      if (lose > 0) patch.coins = increment(-lose);
      const dewLose = Math.min((ev.loseArrowdew || 0) * 1, Math.max(0, me.data()?.arrowdew || 0));
      if (dewLose > 0) patch.arrowdew = increment(-dewLose);
      if (Object.keys(patch).length) await updateDoc(doc(db, "members", memberId), patch);
      reward = { ...reward, coins: 0, loseCoins: lose, loseArrowdew: dewLose };
    } else {
      // 採集格不射箭（旅程規則）：沒給進度就預設「完成」帶（×1.2）
      const gatheringProgress = ps.tileType === "mining" ? (ps.gatheringProgress || 100) : (ps.gatheringProgress || 0);
      reward = rollTileReward(ps.tileType, {
        mode, tierCap: roomTier, tier: roomTier,
        partyMult,
        scoreRatio: ps.scoreRatio || 0,
        gatheringProgress,
      });
      // 旅程 buff（強化×2／營地資源×1.2）乘在個人獎勵上
      reward = applyJourneyMultipliers(reward, { shootMult: ps.shootMult || 1, campMult: ps.campMult || 1 });
    }
    await applyBoardReward(memberId, reward, { catId });
    await updateDoc(ref, { [`settleClaims.${memberId}`]: ps.seq });
    return { ok: true, reward };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 分岔路口（Phase 3）：全員投票、票多者勝 ─────────────────
// 成員投「左路（穩妥＝素材/採集）」或「右路（冒險＝怪物戰）」。
// 投票同時視為「看過這一步」（forkVotes 存在即該員已表態），
// 全員投完（+ack）房主才自動 resolveFork 跳到勝出的那格並照常結算。
export async function voteForkPath(roomId, memberId, side) {
  if (!roomId || !memberId || (side !== "left" && side !== "right")) return { ok: false, reason: "參數錯誤" };
  try {
    const ref = doc(db, R, roomId);
    const s = await getDoc(ref);
    if (!s.exists()) return { ok: false, reason: "房間不存在" };
    const room = s.data();
    const pf = room.pendingFork;
    if (!pf || pf.seq !== (room.seq || 0)) return { ok: false, reason: "分岔路已結束" };
    if (room.forkVotes?.[memberId]) return { ok: false, reason: "已投票" };
    if (!room.members?.[memberId]) return { ok: false, reason: "不在房間內" };
    await updateDoc(ref, {
      [`forkVotes.${memberId}`]: side,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 房主：全員投完後決定路線（跳到勝出的那格，照常結算該格）。
// force=true（房主按「強制推進」）時用目前的票數直接決定（沒人投就左路）。
export async function resolveFork(roomId, hostId, { force = false } = {}) {
  try {
    let done = false;
    await runTransaction(db, async tx => {
      const ref = doc(db, R, roomId);
      const s = await tx.get(ref);
      if (!s.exists() || s.data().hostId !== hostId) throw new Error("只有房主可決定");
      const room = s.data();
      const pf = room.pendingFork;
      if (!pf || pf.seq !== (room.seq || 0)) { done = true; return; }
      const memberIds = Object.keys(room.members || {}).filter(m => room.members[m] != null);
      const votes = room.forkVotes || {};
      const leftN = memberIds.filter(id => votes[id] === "left").length;
      const rightN = memberIds.filter(id => votes[id] === "right").length;
      if (!force && leftN + rightN < memberIds.length) return; // 還沒全員投
      // 票多者勝；平手 → 房主那一票決定（房主沒投就走左路穩妥）
      const side = leftN > rightN ? "left" : rightN > leftN ? "right"
        : (votes[hostId] === "right" ? "right" : "left");
      const j = generateJourney(room.mode, room.journeySeed);
      const opt = (pf.options || {})[side];
      const fallback = side === "right" ? 4 : 2;
      let finalTo = opt?.pos != null ? opt.pos : Math.min(j.length - 1, (room.boardPos || 0) + fallback);
      // 保險：fallback 若又踩到分岔路 → 再往前推，避免分岔無限接龍
      let guard = 0;
      while (j.cells[finalTo] === "fork" && finalTo < j.length - 1 && guard < 5) {
        finalTo = Math.min(j.length - 1, finalTo + 2); guard += 1;
      }
      const { patch, tile } = landingPatch(room, j, finalTo, pf.seq, pf.partyMult || partyMultOf(memberIds.length), memberIds);
      tx.update(ref, {
        ...patch,
        pendingFork: null,
        forkVotes: {},   // 清空舊票，避免影響下一條分岔路
        lastMove: { seq: pf.seq, from: room.boardPos || 0, to: room.boardPos || 0, finalTo, roll: 0, tile, viaTile: "fork", partyMult: pf.partyMult || 1, modeId: room.mode, tier: room.tier || 1, fork: true },
        updatedAt: serverTimestamp(),
      });
      tx.update(doc(db, "members", hostId), { [`villageBoard.maps.${room.mode}.pos`]: finalTo });
      done = true;
    });
    return { ok: true, done };
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
