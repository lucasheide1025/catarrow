// src/guild/db/guildTeamDb.js
// ─────────────────────────────────────────────────────────────
// 公會組隊遠征的房間 I/O。**只做讀寫，規則全在 domain/teamExpeditionFlow.js**。
//
// 集合：`guildTeamRooms/{roomId}`
//   status     waiting | active | done
//   contract   房主選的委託（整份帶著走，成員不必再各自抽）
//   battle     teamExpeditionFlow 的狀態（怪物共享、成員各自 HP/補給/表現）
//   loadouts   { [memberId]: { guildStats, supplies, cats, arrowsPerRound } }  出發前備包
//   submits    { [memberId]: { seq, shots } }  這一回合誰交了箭
//   claims     { [memberId]: true }            結算誰領過獎（防重複領）
//
// ⚠️ 寫入量（見 feedback：省不到的不要動）：一回合＝每人 1 次交箭 ＋ 房主 1 次處理。
//    這是即時多人的固有成本，不做每箭寫入、也不用 writeBatch（Firestore 按文件計費，batch 不省錢）。
//
// ⚠️ 踩過的坑都補在這裡：
//    ① 交箭/領獎的寫入**一定要重試**——一次網路抖動就會讓全隊卡住等他
//       （地下城 confirmNonCombatRoom 就是這樣，房主只能按強制推進）。
//    ② 房間快照的錯誤回呼**不要回 null**，否則暫時斷線會把人踢出房間。
//    ③ 新集合要**手動把 firestore.rules 貼到 Console**（CLI 會 403）。
// ─────────────────────────────────────────────────────────────
import {
  collection, doc, addDoc, getDocs, onSnapshot, query, where,
  runTransaction, serverTimestamp, updateDoc, deleteDoc, limit,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MAX_TEAM_SIZE } from "../domain/teamExpeditionFlow";

// ⚠️ 2026-07-26 作者拍板：**不用房號**。等待中的隊伍直接列出來，點一下就進去
//    （報房號這個動作在現場很沒必要——大家都在同一間箭館）。
const R = "guildTeamRooms";
const roomRef = roomId => doc(db, R, roomId);

// ⚠️ Firestore **拒收 undefined**，而且是直接丟 exception（不是回錯誤碼）——
//    所以任何來自 domain/目錄的物件（委託、遠征、戰鬥狀態）在寫入前都要先過這一層。
//    這是「多人送出戰鬥出錯」的根因：物件裡只要有一個 optional 欄位是 undefined 就整個炸。
//    修一個欄位治不了本，統一在寫入邊界剝掉才是。
function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;          // 直接丟掉，不要寫成 null（讀回來時語意不同）
      out[k] = prune(v);
    }
    return out;
  }
  return value;
}

// 寫入重試：可重試的錯誤退避重試 3 次；權限/不存在這種重試也沒用的直接放棄
async function retryWrite(fn, label) {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await fn(); return { ok: true }; }
    catch (e) {
      last = e?.message || String(e);
      if (/permission|not-found|invalid|房間/i.test(last)) break;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  console.warn(`${label} failed:`, last);
  return { ok: false, reason: last };
}

export async function createGuildTeamRoom({ hostId, hostName, contract, targetFormat = "full_110" }) {
  if (!hostId || !contract) return { ok: false, reason: "參數錯誤" };
  try {
    const ref = await addDoc(collection(db, R), {
      hostId, hostName: hostName || "房主",
      status: "waiting",
      contract: prune(contract),
      battle: null, submits: {}, claims: {}, seq: 0,
      settings: { arrowsPerRound: 3, targetFormat },
      loadouts: {},
      members: { [hostId]: { name: hostName || "房主", ready: false, joinedAt: serverTimestamp() } },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ok: true, roomId: ref.id };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function joinGuildTeamRoomById(roomId, memberId, memberName) {
  if (!roomId || !memberId) return { ok: false, reason: "參數錯誤" };
  try {
    await runTransaction(db, async tx => {
      const latest = await tx.get(roomRef(roomId));
      if (!latest.exists()) throw new Error("這支隊伍已經解散了");
      const data = latest.data();
      if (data.status !== "waiting") throw new Error("這支隊伍已經出發了");
      const members = data.members || {};
      if (members[memberId]) return;                       // 重複加入＝視為成功
      if (Object.keys(members).length >= MAX_TEAM_SIZE) throw new Error(`小隊已滿（最多 ${MAX_TEAM_SIZE} 人）`);
      tx.update(roomRef(roomId), {
        [`members.${memberId}`]: { name: memberName || "隊員", ready: false, joinedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true, roomId };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 備包完成 → 寫進 loadouts 並標記 ready（房主用這個判斷可不可以出發）
export function setGuildTeamLoadout(roomId, memberId, loadout) {
  return retryWrite(() => updateDoc(roomRef(roomId), {
    [`loadouts.${memberId}`]: prune(loadout),
    [`members.${memberId}.ready`]: true,
    updatedAt: serverTimestamp(),
  }), "setGuildTeamLoadout");
}

export function unreadyGuildTeamMember(roomId, memberId) {
  return retryWrite(() => updateDoc(roomRef(roomId), {
    [`members.${memberId}.ready`]: false,
    updatedAt: serverTimestamp(),
  }), "unreadyGuildTeamMember");
}

export async function setGuildTeamSettings(roomId, hostId, settings) {
  try {
    await runTransaction(db, async tx => {
      const snapshot = await tx.get(roomRef(roomId));
      if (!snapshot.exists()) throw new Error("找不到組隊房間");
      const room = snapshot.data();
      if (room.hostId !== hostId) throw new Error("只有房主可以調整戰鬥設定");
      if (room.status !== "waiting") throw new Error("遠征開始後不能更改設定");
      tx.update(roomRef(roomId), {
        settings: prune({
          arrowsPerRound: Number(settings?.arrowsPerRound) === 6 ? 6 : 3,
          targetFormat: settings?.targetFormat || "full_110",
        }),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message };
  }
}

// 房主出發：把 domain 算好的初始 battle 狀態寫進房間
export async function startGuildTeamExpedition(roomId, hostId, battle, journey = null) {
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(roomRef(roomId));
      if (!s.exists()) throw new Error("房間不存在");
      const d = s.data();
      if (d.hostId !== hostId) throw new Error("只有房主可以出發");
      if (d.status !== "waiting") throw new Error("遠征已經出發了");
      tx.update(roomRef(roomId), {
        status:"active", battle:prune(battle), journey:journey ? prune(journey) : null,
        stage:journey ? "map" : "battle", seq:1, submits:{}, updatedAt:serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function advanceGuildTeamJourney(roomId, hostId, journey, battle, stage) {
  try {
    await runTransaction(db, async tx => {
      const ref = roomRef(roomId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("房間不存在");
      const room = snap.data();
      if (room.hostId !== hostId) throw new Error("只有房主可以推進探索");
      if (room.status !== "active") throw new Error("遠征目前不能推進");
      tx.update(ref, {
        journey:prune(journey), battle:prune(battle), stage,
        seq:(room.seq || 0) + 1, submits:{}, updatedAt:serverTimestamp(),
      });
    });
    return { ok:true };
  } catch (error) {
    return { ok:false, reason:error?.message };
  }
}

// 成員交箭（帶 seq：避免上一回合的箭被算進這一回合）
export function submitGuildTeamShots(roomId, memberId, seq, shots) {
  return retryWrite(() => updateDoc(roomRef(roomId), {
    [`submits.${memberId}`]: prune({ seq, shots, at: Date.now() }),
    updatedAt: serverTimestamp(),
  }), "submitGuildTeamShots");
}

// 房主處理回合：把 domain 算好的新 battle 寫回，並清空這回合的 submits
export async function commitGuildTeamRound(roomId, hostId, battle, nextSeq) {
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(roomRef(roomId));
      if (!s.exists()) throw new Error("房間不存在");
      const d = s.data();
      if (d.hostId !== hostId) throw new Error("只有房主可以推進回合");
      if ((d.seq || 0) >= nextSeq) return;          // 已經被推進過（重複點擊/重試）→ 視為成功
      tx.update(roomRef(roomId), {
        battle: prune(battle), seq: nextSeq, submits: {},
        status: battle.status === "fighting" ? "active" : "done",
        ...(battle.awaitingMap ? { stage:"map" } : {}),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 領獎標記（防重複領；實際發獎走 guildDb.grantExpeditionRewards）
export function markGuildTeamClaimed(roomId, memberId) {
  return retryWrite(() => updateDoc(roomRef(roomId), {
    [`claims.${memberId}`]: true,
    updatedAt: serverTimestamp(),
  }), "markGuildTeamClaimed");
}

export async function leaveGuildTeamRoom(roomId, memberId) {
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(roomRef(roomId));
      if (!s.exists()) return;
      const d = s.data();
      const members = { ...(d.members || {}) };
      delete members[memberId];
      // 房主離開且還在等待室 → 直接解散（沒人能出發）
      if (d.hostId === memberId && d.status === "waiting") { tx.delete(roomRef(roomId)); return; }
      tx.update(roomRef(roomId), { members, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function disbandGuildTeamRoom(roomId, hostId) {
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(roomRef(roomId));
      if (!s.exists()) return;
      if (s.data().hostId !== hostId) throw new Error("只有房主可以解散");
      tx.delete(roomRef(roomId));
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 斷線重連（2026-07-26）─────────────────────────────────────
// 組隊的戰鬥狀態本來就存在房間文件裡，斷線其實**沒有掉任何進度**——缺的只是
// 「回來的時候有人告訴你還有一場在打」。這支就是那個角色：找出我還在裡面的房間。
//
// ⚠️ 為什麼不用 `where('members.<id>', '!=', null)`：Firestore 的巢狀 map 鍵無法動態查詢，
//    而且會需要為每個 memberId 建索引。房間數量本來就少（同時最多幾間），
//    抓 waiting/active 再在 client 端過濾最單純——跟貓貓村的 findReconnectableBoardRoom 同一手法。
export async function findReconnectableGuildTeamRoom(memberId) {
  if (!memberId) return { ok: false, room: null };
  try {
    const snap = await getDocs(query(collection(db, R), where("status", "in", ["waiting", "active"]), limit(30)));
    const rooms = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.members?.[memberId])
      .sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
        const tb = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
        return tb - ta;   // 最近有動作的優先
      });
    return { ok: true, room: rooms[0] || null };
  } catch (e) { return { ok: false, reason: e?.message, room: null }; }
}

export function subscribeGuildTeamRoom(roomId, cb) {
  return onSnapshot(
    roomRef(roomId),
    s => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    // ⚠️ 暫時性連線錯誤不要回 null——否則會把人踢出房間（貓貓村踩過）
    err => { console.warn("[guildTeamRoom] snapshot error (ignored):", err?.message); },
  );
}

// 等待中的隊伍列表（取代房號：看得到就點得進去）。
// 只在「組隊大廳」畫面掛著，離開就取消訂閱——不常駐，不會變成隱形的讀取來源。
export function subscribeOpenGuildTeamRooms(cb) {
  return onSnapshot(
    query(collection(db, R), where("status", "==", "waiting"), limit(20)),
    s => cb(s.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        hostName: data.hostName || "房主",
        contract: data.contract || null,
        size: Object.keys(data.members || {}).length,
        createdAt: data.createdAt || null,
      };
    })),
    err => { console.warn("[guildTeamRooms] open list error:", err?.message); cb([]); },
  );
}
