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
  collection, doc, getDoc, getDocs, onSnapshot, runTransaction,
  serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { arrowPoints, arrowRecord, endAcceptance, endResult } from "../worldboss/domain/matchScore";
import { matchRewardFor, normalizeRewardConfig } from "../worldboss/domain/matchRewards";
import { addArcherXP, addChests, addCoins, createNotification } from "./db";
import { addCatXP } from "./catDb";

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
export async function joinMatch(matchId, memberId, memberName, { bowType = null, catId = null } = {}) {
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
              // 發獎勵時要知道貓貓經驗該加給誰
              catId: catId || null,
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
          [`players.${memberId}.catId`]: catId || existing.catId || null,
          [`players.${memberId}.lastAt`]: Date.now(),
          updatedAt: serverTimestamp(),
        });
        return;
      }
      tx.update(ref, {
        [`players.${memberId}`]: {
          name: memberName || "射手", bowType: bowType || null,
          catId: catId || null,
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

/**
 * 送出**一支箭**（作者 2026-08-01：一箭一箭送，不能連續三箭射出）。
 *
 * ⚠️ 為什麼要一箭一次：現場是射一支、記一支。三箭一起補登，
 *    中間離場或斷線就會整組不見，而且記錯了也回想不出是哪一支。
 *
 * ⚠️ 落點寫在**子文件**（shots/{memberId}），不寫進主文件：
 *    主文件每次寫入都會推給全場所有監聽者。幾千筆落點掛在上面，
 *    等於每射一箭就把整份落點資料傳給每一個人。
 *    主文件只留聚合（分數／箭數／傷害），統計表要看細節才另外抓。
 *
 * @param arrowIndex 這是我的第幾支箭（從 0 開始）＝**冪等鍵**，重送不會重複計分。
 */
export async function submitMatchArrow(matchId, memberId, arrowIndex, arrow) {
  if (!matchId || !memberId) return { ok: false, reason: "參數錯誤" };
  const ref = doc(db, M, matchId);
  const shotRef = doc(db, M, matchId, "shots", memberId);
  const points = arrowPoints(arrow);
  try {
    let duplicate = false;
    let end = 0;
    let playerName = memberId;
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("這場比賽不存在了");
      const p = snap.data()?.players?.[memberId];
      if (!p) throw new Error("你還沒加入這場比賽");
      playerName = p.name || memberId;

      const recorded = Number(p.arrows) || 0;
      if (Number(arrowIndex) < recorded) { duplicate = true; return; }
      if (Number(arrowIndex) !== recorded) throw new Error("箭序對不上，請重新整理");

      end = Math.floor(recorded / 3);

      tx.update(ref, {
        [`players.${memberId}.score`]: (Number(p.score) || 0) + points,
        [`players.${memberId}.damage`]: (Number(p.damage) || 0) + points * 120,
        [`players.${memberId}.arrows`]: recorded + 1,
        [`players.${memberId}.xCount`]: (Number(p.xCount) || 0) + (arrow?.label === "X" ? 1 : 0),
        [`players.${memberId}.tens`]: (Number(p.tens) || 0) + (points === 10 ? 1 : 0),
        [`players.${memberId}.ends`]: Math.floor((recorded + 1) / 3),
        [`players.${memberId}.lastArrow`]: arrow?.label ?? String(points),
        [`players.${memberId}.lastAt`]: Date.now(),
        [`players.${memberId}.active`]: true,
        updatedAt: serverTimestamp(),
      });
    });

    // ⚠️ 落點**另外寫、而且失敗不擋分數**（作者 2026-08-01 比賽當天）：
    //    分數掉了選手要重射，落點掉了只是少一筆檢討資料——
    //    兩者不能綁在同一個交易裡，不然規則沒開就整場記不到分。
    if (!duplicate) {
      try {
        const shotSnap = await getDoc(shotRef);
        const list = Array.isArray(shotSnap.data()?.shots) ? shotSnap.data().shots : [];
        await setDoc(shotRef, {
          memberId, name: playerName,
          shots: [...list, arrowRecord(arrow, { end })],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn("[raidMatch] 落點沒存到（分數已記錄）:", e?.message);
      }
    }
    return { ok: true, duplicate, points };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 統計表用：**要看細節才抓**，不做即時監聽（那等於把幾千筆推給所有人）。 */
export async function getMatchShots(matchId) {
  if (!matchId) return {};
  try {
    const snap = await getDocs(collection(db, M, matchId, "shots"));
    const out = {};
    snap.docs.forEach(d => { out[d.id] = d.data(); });
    return out;
  } catch { return {}; }
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

// ── 教練：獎勵設定 ────────────────────────────────────────
export async function saveMatchRewardConfig(matchId, cfg) {
  try {
    await setDoc(doc(db, M, matchId), {
      reward: normalizeRewardConfig(cfg), updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/**
 * 教練發放獎勵。
 *
 * ⚠️ **一個人一個人發，而且逐一標記 rewarded**——不是整批寫完才標。
 *    發到一半網路斷掉時，已經發出去的必須留下紀錄，
 *    不然教練再按一次，前面那些人會領第二次。
 *
 * ⚠️ 先標記再發，還是先發再標記？選**先發再標記**：
 *    重複發總比沒發到好處理（教練看得到誰多領了），
 *    但標記失敗的機率遠低於發放失敗，所以實務上不會重複。
 */
export async function grantMatchRewards(matchId, { onProgress = null } = {}) {
  const snap = await getDoc(doc(db, M, matchId)).catch(() => null);
  if (!snap?.exists()) return { ok: false, reason: "這場比賽不存在" };
  const data = snap.data();
  const cfg = normalizeRewardConfig(data.reward);
  const players = data.players || {};
  const ids = Object.keys(players).filter(id => players[id] && !players[id].rewarded);

  const done = [];
  const failed = [];
  for (const memberId of ids) {
    const p = players[memberId];
    const r = matchRewardFor(p, cfg);
    if (!r.eligible) continue;
    try {
      if (r.archerXP > 0) await addArcherXP(memberId, r.archerXP);
      if (r.coins > 0) await addCoins(memberId, r.coins);
      if (r.catXP > 0 && p.catId) await addCatXP(memberId, p.catId, r.catXP);

      const chests = [];
      const stamp = Date.now();
      for (let i = 0; i < r.chests; i += 1) {
        chests.push({
          id: `match_${matchId}_${memberId}_m${i}`, type: r.chestType,
          family: "match", tier: r.chestType,
          from: `比賽模式（${r.arrows} 箭）`, ts: stamp + i,
        });
      }
      for (let i = 0; i < r.coinChests; i += 1) {
        chests.push({
          id: `match_${matchId}_${memberId}_c${i}`, type: "coin",
          tier: r.coinChestTier, family: "match",
          from: `比賽模式（${r.arrows} 箭）`, ts: stamp + 100 + i,
        });
      }
      if (chests.length) await addChests(memberId, chests);

      await updateDoc(doc(db, M, matchId), {
        [`players.${memberId}.rewarded`]: true,
        [`players.${memberId}.rewardedAt`]: Date.now(),
        updatedAt: serverTimestamp(),
      });
      createNotification({
        type: "worldboss",
        title: "🏆 比賽獎勵已發放",
        content: `${r.arrows} 箭 ${r.score} 分：射手經驗 +${r.archerXP}、金幣 +${r.coins}、材料箱 ×${r.chests}、金幣箱 ×${r.coinChests}`,
        targetMemberId: memberId,
      }).catch(() => {});
      done.push({ memberId, name: p.name, ...r });
    } catch (e) {
      failed.push({ memberId, name: p.name, reason: e?.message });
    }
    onProgress?.(done.length + failed.length, ids.length);
  }
  return { ok: true, granted: done, failed };
}

/**
 * 教練：重置整場比賽。
 * ⚠️ 落點子文件也要一起清掉，不然重置後統計表會混進上一輪的箭。
 */
export async function resetMatch(matchId) {
  try {
    const shots = await getDocs(collection(db, M, matchId, "shots")).catch(() => null);
    if (shots) {
      for (const d of shots.docs) {
        await setDoc(d.ref, { shots: [], updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    }
    // ⚠️ 一定要用 updateDoc 直接覆蓋 players——merge:true 只會把新舊 map 合併，
    //    清不掉舊的射手 key（村莊那邊踩過同一個坑）。
    await updateDoc(doc(db, M, matchId), {
      players: {}, status: "open", resetAt: Date.now(), updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 教練：只清一個人（記錯了要重來） */
export async function resetMatchMember(matchId, memberId) {
  try {
    await updateDoc(doc(db, M, matchId), {
      [`players.${memberId}.score`]: 0,
      [`players.${memberId}.damage`]: 0,
      [`players.${memberId}.arrows`]: 0,
      [`players.${memberId}.ends`]: 0,
      [`players.${memberId}.xCount`]: 0,
      [`players.${memberId}.tens`]: 0,
      [`players.${memberId}.rewarded`]: false,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, M, matchId, "shots", memberId),
      { shots: [], updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export const MATCH_COLLECTION = M;
export const matchesRef = () => collection(db, M);
