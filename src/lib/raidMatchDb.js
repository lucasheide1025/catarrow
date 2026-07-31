// src/lib/raidMatchDb.js
// ─────────────────────────────────────────────────────────────
// 🏆 比賽模式的房間層。**明天的實體比賽要用這個當計分系統**，
//    所以這裡的優先順序是「不出錯」＞「省」＞「好看」。
//
// ⚠️ 一場比賽 = **一顆文件**（`raidMatches/{YYYY-MM-DD}`）。
//    分成一人一份子文件的話，場外大螢幕要監聽整個 collection，
//    每個人每回合都會推一次給所有人。一顆文件只要一個監聽器。
//
// ⚠️ 文件 id 用日期，**不需要教練先去後台開比賽**。第一個進來的人建好，
//    後面的人直接加入。比賽當天沒有人有空處理「怎麼開場」。
//
// ⚠️ 寫入是**逐回合**（三箭一次），而且用回合序號當冪等鍵：
//    射箭場的網路很差，玩家一定會按第二次送出。重送不會重複計分。
// ─────────────────────────────────────────────────────────────

import {
  collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { endAcceptance, endResult } from "../worldboss/domain/matchScore";

const M = "raidMatches";

/**
 * 錯誤訊息翻成人話。
 * ⚠️ 比賽當天出事的時候，現場沒有人會去讀 "Missing or insufficient permissions"。
 *    訊息要直接講「該找誰、做什麼」。
 */
function humanError(e) {
  const msg = String(e?.message || e || "");
  if (/insufficient permissions|permission-denied/i.test(msg)) {
    return "資料庫權限還沒開（raidMatches）——請教練到 Firebase Console 貼上規則";
  }
  if (/offline|unavailable|network/i.test(msg)) return "網路連不上，等一下再按一次（分數不會不見）";
  if (/deadline|timeout/i.test(msg)) return "連線太慢，再按一次送出（不會重複計分）";
  return msg || "操作失敗";
}

/** 今天這一場的 id。用日期＝同一天所有人自動同一場。 */
export function todayMatchId(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const MATCH_BOSS_MAX_HP = 500000;

/**
 * 加入（沒有就順手建一場）。
 * ⚠️ **重進不能把分數歸零**——斷線、關掉 App、手機沒電再開，都會走到這裡。
 *    已經有紀錄的人只把 active 打開，score 一個字都不動。
 */
export async function joinMatch(matchId, memberId, memberName, { bowType = null } = {}) {
  if (!matchId || !memberId) return { ok: false, reason: "參數錯誤" };
  const ref = doc(db, M, matchId);
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          matchId, status: "open",
          bossMaxHp: MATCH_BOSS_MAX_HP,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          players: {
            [memberId]: {
              name: memberName || "射手", bowType: bowType || null,
              score: 0, damage: 0, arrows: 0, ends: 0, xCount: 0, tens: 0,
              active: true, joinedAt: Date.now(), lastAt: Date.now(),
            },
          },
        });
        return;
      }
      const existing = snap.data()?.players?.[memberId];
      if (existing) {
        // 回來了：只開 active，分數原封不動
        tx.update(ref, {
          [`players.${memberId}.active`]: true,
          [`players.${memberId}.name`]: memberName || existing.name || "射手",
          [`players.${memberId}.lastAt`]: Date.now(),
          updatedAt: serverTimestamp(),
        });
        return;
      }
      tx.update(ref, {
        [`players.${memberId}`]: {
          name: memberName || "射手", bowType: bowType || null,
          score: 0, damage: 0, arrows: 0, ends: 0, xCount: 0, tens: 0,
          active: true, joinedAt: Date.now(), lastAt: Date.now(),
        },
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true, matchId };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 送出一回合（三箭）。
 * @param endIndex 這是我的第幾回合（從 0 開始）。**冪等鍵**——
 *                 重送同一個序號只會回 duplicate，不會再加一次分。
 */
export async function submitMatchEnd(matchId, memberId, endIndex, arrows) {
  if (!matchId || !memberId) return { ok: false, reason: "參數錯誤" };
  const ref = doc(db, M, matchId);
  const r = endResult(arrows);
  try {
    let duplicate = false;
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("這場比賽不存在了");
      const p = snap.data()?.players?.[memberId];
      if (!p) throw new Error("你還沒加入這場比賽");

      const check = endAcceptance(p.ends, endIndex);
      if (!check.accept) {
        if (check.duplicate) { duplicate = true; return; }
        throw new Error(check.reason || "回合序號對不上");
      }

      tx.update(ref, {
        // ⚠️ 用讀到的值 + 增量，不用 increment()：整筆在交易裡算，
        //    才能跟上面的序號檢查是同一個原子操作。
        [`players.${memberId}.score`]: (Number(p.score) || 0) + r.score,
        [`players.${memberId}.damage`]: (Number(p.damage) || 0) + r.damage,
        [`players.${memberId}.arrows`]: (Number(p.arrows) || 0) + r.arrows,
        [`players.${memberId}.xCount`]: (Number(p.xCount) || 0) + r.xCount,
        [`players.${memberId}.tens`]: (Number(p.tens) || 0) + r.tens,
        [`players.${memberId}.ends`]: (Number(p.ends) || 0) + 1,
        [`players.${memberId}.lastEnd`]: r.labels,
        [`players.${memberId}.lastAt`]: Date.now(),
        [`players.${memberId}.active`]: true,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true, duplicate, end: r };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 離場。⚠️ 只把 active 關掉——**分數留著**，榜上還看得到他。 */
export async function leaveMatch(matchId, memberId) {
  if (!matchId || !memberId) return { ok: false, reason: "參數錯誤" };
  try {
    await updateDoc(doc(db, M, matchId), {
      [`players.${memberId}.active`]: false,
      [`players.${memberId}.leftAt`]: Date.now(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 一顆文件、一個監聽器。場外大螢幕跟場內選手用的是同一個。 */
export function subscribeMatch(matchId, cb) {
  if (!matchId) return () => {};
  return onSnapshot(
    doc(db, M, matchId),
    s => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    // 暫時性的連線錯誤不要回 null，否則畫面會把選手踢出比賽
    err => { console.warn("[raidMatch] snapshot error (ignored):", err?.message); },
  );
}

export async function getMatch(matchId) {
  if (!matchId) return null;
  try {
    const s = await getDoc(doc(db, M, matchId));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch { return null; }
}

/** 教練用：收榜（收了就不能再送分，但榜還看得到） */
export async function closeMatch(matchId) {
  try {
    await updateDoc(doc(db, M, matchId), { status: "closed", updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export async function reopenMatch(matchId) {
  try {
    await updateDoc(doc(db, M, matchId), { status: "open", updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 教練用：某人記錯要重來（整個人歸零，不動別人） */
export async function resetMatchPlayer(matchId, memberId) {
  try {
    await setDoc(doc(db, M, matchId), {
      players: {
        [memberId]: {
          score: 0, damage: 0, arrows: 0, ends: 0, xCount: 0, tens: 0,
          lastEnd: [], lastAt: Date.now(),
        },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export const MATCH_COLLECTION = M;
export const matchesRef = () => collection(db, M);
