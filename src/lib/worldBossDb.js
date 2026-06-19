// src/lib/worldBossDb.js — 世界大 Boss Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, increment, getDoc, getDocs, query,
  where, orderBy, limit, arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, addMaterials } from "./db";
import { openCoinChest } from "./lootTable";
import {
  WORLD_BOSSES, DEFAULT_REWARD, CONSOLATION_REWARD,
  LAST_HIT_EXTRA, buildKillAnnouncement, drawRandomBot, simulateBotRound,
} from "./worldBossData";

const WB  = "worldBossEvents";
const WBH = "worldBossHistory";

// ── 即時訂閱當前活躍大 Boss ───────────────────────────────────
export function subscribeActiveWorldBoss(cb) {
  const q = query(collection(db, WB), where("status", "==", "active"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0];
    cb({ id: d.id, ...d.data() });
  });
}

export function subscribeWorldBoss(eventId, cb) {
  return onSnapshot(doc(db, WB, eventId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
    else cb(null);
  });
}

// ── 後台建立活動 ──────────────────────────────────────────────
export async function createWorldBossEvent({ adminId, bossKey, durationDays, reward }) {
  try {
    const boss    = WORLD_BOSSES[bossKey];
    if (!boss) return { ok: false, reason: "無效的 Boss" };

    const startAt = new Date();
    const endAt   = new Date(startAt.getTime() + durationDays * 86400000);

    const ref = await addDoc(collection(db, WB), {
      bossKey,
      bossData: {
        name: boss.name, title: boss.title, desc: boss.desc,
        hp: boss.hp, atk: boss.atk, def: boss.def,
        pixelKey: boss.pixelKey, bg: boss.bg, accent: boss.accent,
        family: boss.family,
      },
      bossMaxHP:     boss.hp,
      bossCurrentHP: boss.hp,
      status:        "active",
      startAt:       serverTimestamp(),
      endAt:         endAt,
      durationDays,
      reward: reward || DEFAULT_REWARD,
      lastHitBy:     null,
      announcement:  null,
      totalParticipants: 0,
      participants:  {},
      createdBy:     adminId,
      createdAt:     serverTimestamp(),
    });
    return { ok: true, eventId: ref.id };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 攻擊大 Boss（每天一次，最多 5 回合 × 6 箭）────────────────
// roundResults = [{ arrows, dmg, crits }, ...] 最多 5 回合
// isGuest = true 時不寫 practiceLog
export async function attackWorldBoss({ eventId, memberId, memberName, weapon, roundResults, isGuest = false, potionDmgMult = 1, bots = [], memberAtk = 10, memberDef = 0, memberHP = 0 }) {
  try {
    const eventRef  = doc(db, WB, eventId);
    const snap      = await getDoc(eventRef);
    if (!snap.exists()) return { ok: false, reason: "活動不存在" };
    const ev = snap.data();

    if (ev.status !== "active") return { ok: false, reason: "活動已結束" };

    // 每日限一次
    const today   = new Date().toISOString().slice(0, 10);
    const myPrev  = ev.participants?.[memberId];
    if (myPrev?.lastAttackedDate === today) return { ok: false, reason: "今天已經攻擊過了" };

    // 計算玩家本次總傷害
    const totalDmg = roundResults.reduce((s, r) => s + (r.dmg || 0), 0) * potionDmgMult;

    // 計算機器人傷害
    let botTotalDmg = 0;
    const botLogs = [];
    for (const bot of bots) {
      let botDmg = 0;
      const botRounds = [];
      for (let i = 0; i < 5; i++) {
        const r = simulateBotRound(bot, ev.bossData.atk, ev.bossData.def);
        botDmg += r.dmg;
        botRounds.push(r);
      }
      botTotalDmg += botDmg;
      botLogs.push({ botId: bot.id, label: bot.label, dmg: botDmg, rounds: botRounds });
    }

    const combinedDmg = Math.round(totalDmg + botTotalDmg);
    const newHP       = Math.max(0, ev.bossCurrentHP - combinedDmg);
    const defeated    = newHP <= 0;

    // 最後一擊者
    const isLastHit = defeated;
    const upd = {
      bossCurrentHP: newHP,
      [`participants.${memberId}`]: {
        name: memberName,
        weapon: weapon || "訪客弓組",
        totalDmg: (myPrev?.totalDmg || 0) + combinedDmg,
        lastAttackedDate: today,
        sessions: arrayUnion({
          date: today, dmg: combinedDmg, playerDmg: Math.round(totalDmg),
          botDmg: botTotalDmg, rounds: roundResults.length,
        }),
        isGuest: !!isGuest,
        atk: memberAtk,
        def: memberDef || Math.round(memberAtk * 0.5),
        hp:  memberHP  || memberAtk * 5,
      },
    };

    // 首次參戰
    if (!myPrev) {
      upd.totalParticipants = increment(1);
    }

    if (defeated) {
      const announcement = buildKillAnnouncement(memberName, weapon || "訪客弓組");
      upd.status     = "defeated";
      upd.lastHitBy  = { memberId, memberName, weapon: weapon || "訪客弓組" };
      upd.announcement = announcement;
      upd.defeatedAt   = serverTimestamp();
    }

    await updateDoc(eventRef, upd);

    // 寫入練習日誌（非訪客）
    if (!isGuest && memberId) {
      const { addPracticeLog } = await import("./db");
      const totalArrows = roundResults.reduce((s, r) => s + (r.arrows?.length || 0), 0);
      const totalScore  = roundResults.reduce((s, r) =>
        s + (r.arrows || []).reduce((a, b) => a + (b.score || 0), 0), 0);
      await addPracticeLog(memberId, {
        type:      "world_boss",
        bossKey:   ev.bossKey,
        bossName:  ev.bossData.name,
        dmg:       combinedDmg,
        arrows:    totalArrows,
        score:     totalScore,
        note:      `挑戰世界大 Boss《${ev.bossData.name}》`,
      }).catch(() => {});
    }

    return { ok: true, dmg: combinedDmg, defeated, isLastHit, newHP };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 發放獎勵（defeated 後房主/系統呼叫）─────────────────────
export async function distributeWorldBossRewards(eventId) {
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false };
    const ev = snap.data();
    if (ev.rewardDistributed) return { ok: true }; // 防重複

    const reward     = ev.reward || DEFAULT_REWARD;
    const participants = ev.participants || {};
    const lastHitId  = ev.lastHitBy?.memberId;

    for (const [mid, p] of Object.entries(participants)) {
      if (p.isGuest) continue;

      // 金幣 + 金幣箱（世界王等級 = boss tier）
      const coinChest = openCoinChest("boss");
      await addCoins(mid, (reward.coins || 0) + coinChest.coins).catch(() => {});

      // 貓貓箱 + 黃金寶箱（寫入背包）
      const { addToChestInventory } = await import("./db").then(m => m).catch(() => ({}));
      if (addToChestInventory) {
        for (let i = 0; i < (reward.catBoxes || 1); i++) {
          await addToChestInventory(mid, "cat_box").catch(() => {});
        }
        for (let i = 0; i < (reward.goldChests || 1); i++) {
          await addToChestInventory(mid, "gold").catch(() => {});
        }
      }

      // 1% 卡片掉落
      if (Math.random() < (reward.cardChance || 0.01)) {
        const { addCardPack } = await import("./db").then(m => m).catch(() => ({}));
        if (addCardPack) await addCardPack(mid).catch(() => {});
      }
    }

    // 最後一擊額外獎勵
    if (lastHitId && !participants[lastHitId]?.isGuest) {
      const { addToChestInventory, addCardPack } = await import("./db").then(m => m).catch(() => ({}));
      if (addToChestInventory) await addToChestInventory(lastHitId, "cat_box").catch(() => {});
      if (addCardPack) await addCardPack(lastHitId).catch(() => {});
    }

    await updateDoc(doc(db, WB, eventId), { rewardDistributed: true });

    // 寫入歷史
    await addDoc(collection(db, WBH), {
      eventId,
      bossKey: ev.bossKey,
      bossName: ev.bossData?.name,
      result: "defeated",
      defeatedAt: serverTimestamp(),
      lastHitBy: ev.lastHitBy,
      announcement: ev.announcement,
      participants: ev.participants,
      totalParticipants: ev.totalParticipants,
    });

    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 時間到未擊殺 → 安慰獎 ────────────────────────────────────
export async function expireWorldBossEvent(eventId) {
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false };
    const ev = snap.data();
    if (ev.status !== "active") return { ok: true };

    await updateDoc(doc(db, WB, eventId), { status: "expired", expiredAt: serverTimestamp() });

    // 安慰獎：每人一個黃金寶箱
    for (const [mid, p] of Object.entries(ev.participants || {})) {
      if (p.isGuest) continue;
      await addCoins(mid, CONSOLATION_REWARD.coins || 0).catch(() => {});
    }

    await addDoc(collection(db, WBH), {
      eventId, bossKey: ev.bossKey, bossName: ev.bossData?.name,
      result: "expired", expiredAt: serverTimestamp(),
      participants: ev.participants, totalParticipants: ev.totalParticipants,
    });

    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 後台強制結束 ──────────────────────────────────────────────
export async function forceEndWorldBossEvent(eventId) {
  try {
    await updateDoc(doc(db, WB, eventId), { status: "expired", expiredAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 雇用 AI 機器人（100 金幣）────────────────────────────────
export async function hireWorldBossBot(eventId, memberId) {
  try {
    await addCoins(memberId, -100);
    const bot = drawRandomBot();
    await updateDoc(doc(db, WB, eventId), {
      [`participants.${memberId}.bots`]: arrayUnion({ ...bot, hiredAt: new Date().toISOString() }),
    });
    return { ok: true, bot };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 後台重置今日出戰紀錄 ─────────────────────────────────────
export async function resetWorldBossAttack(eventId, memberId) {
  try {
    await updateDoc(doc(db, WB, eventId), {
      [`participants.${memberId}.lastAttackedDate`]: null,
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

export async function resetAllWorldBossAttacks(eventId) {
  try {
    const snap  = await getDoc(doc(db, WB, eventId));
    const parts = snap.data()?.participants || {};
    const updates = {};
    Object.keys(parts).forEach(mid => {
      updates[`participants.${mid}.lastAttackedDate`] = null;
    });
    if (Object.keys(updates).length > 0) await updateDoc(doc(db, WB, eventId), updates);
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 歷史記錄（排行榜）───────────────────────────────────────
export async function getWorldBossHistory(n = 10) {
  try {
    const snap = await getDocs(
      query(collection(db, WBH), orderBy("defeatedAt", "desc"), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function getLatestWorldBossKill() {
  try {
    const snap = await getDocs(
      query(collection(db, WBH), where("result", "==", "defeated"), orderBy("defeatedAt", "desc"), limit(1))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch { return null; }
}
