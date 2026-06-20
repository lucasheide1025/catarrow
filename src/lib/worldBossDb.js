// src/lib/worldBossDb.js — 世界大 Boss Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, increment, getDoc, getDocs, query,
  where, orderBy, limit, arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, addMaterials, addChests, addCardPack } from "./db";
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

// ── 訂閱最新一筆 Boss（active 或 defeated 皆包含，expired 排除）
export function subscribeLatestWorldBoss(cb) {
  const q = query(collection(db, WB), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0];
    const data = { id: d.id, ...d.data() };
    if (data.status === "expired") { cb(null); return; }
    cb(data);
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

// ── 每回合即時更新 Boss HP（讓大廳即時顯示）──────────────────
export async function updateWorldBossHP(eventId, newHP) {
  try {
    await updateDoc(doc(db, WB, eventId), { bossCurrentHP: Math.max(0, newHP) });
  } catch { /* silent */ }
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

    // expired 直接拒絕；defeated 允許繼續（讓本次傷害仍能領每日獎勵）
    if (ev.status === "expired") return { ok: false, reason: "活動已結束" };
    const alreadyDefeated = ev.status === "defeated";

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
    const newHP       = alreadyDefeated ? ev.bossCurrentHP : Math.max(0, ev.bossCurrentHP - combinedDmg);
    const defeated    = !alreadyDefeated && newHP <= 0;

    // 最後一擊者
    const isLastHit = defeated;
    const upd = {
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

    // boss 尚未被擊倒時才更新 HP 與狀態
    if (!alreadyDefeated) {
      upd.bossCurrentHP = newHP;
      if (defeated) {
        const announcement = buildKillAnnouncement(memberName, weapon || "訪客弓組");
        upd.status       = "defeated";
        upd.lastHitBy    = { memberId, memberName, weapon: weapon || "訪客弓組" };
        upd.announcement = announcement;
        upd.defeatedAt   = serverTimestamp();
      }
    }

    await updateDoc(eventRef, upd);

    // ── 每日出戰獎勵（非訪客）──────────────────────────────
    let dailyReward = null;
    if (!isGuest && memberId) {
      const rewardCoins = 60;
      await addCoins(memberId, rewardCoins).catch(() => {});

      const pct = combinedDmg / (ev.bossMaxHP || 1);
      let chestType = null;
      if (pct >= 0.025) chestType = "gold";
      else if (pct >= 0.01) chestType = "iron";

      if (chestType) {
        await addChests(memberId, [{
          id: `wb_daily_${memberId}_${today}`,
          type: chestType,
          family: "worldboss",
          tier: chestType,
          from: `世界王出戰獎勵（${Math.round(pct * 1000) / 10}% 傷害）`,
          ts: Date.now(),
        }]).catch(() => {});
      }

      dailyReward = { coins: rewardCoins, chest: chestType, pct: Math.round(pct * 1000) / 10 };
    }

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

    return { ok: true, dmg: combinedDmg, defeated, isLastHit, newHP, dailyReward, bossAlreadyDefeated: alreadyDefeated };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 發放獎勵（defeated 後房主/系統呼叫）─────────────────────
export async function distributeWorldBossRewards(eventId) {
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false };
    const ev = snap.data();
    if (ev.rewardDistributed) return { ok: true }; // 防重複

    const reward       = ev.reward || DEFAULT_REWARD;
    const participants = ev.participants || {};
    const lastHitId    = ev.lastHitBy?.memberId;

    // 判斷新/舊獎勵格式
    const isNewFormat = !!(reward.base || reward.rank1 || reward.rank3 || reward.rankAll);
    const base    = isNewFormat ? (reward.base    || {}) : {};
    const rank1   = isNewFormat ? (reward.rank1   || {}) : reward; // 舊格式：全員同一份
    const rank3   = isNewFormat ? (reward.rank3   || {}) : reward;
    const rankAll = isNewFormat ? (reward.rankAll || {}) : reward;

    // 依傷害排行排序（訪客排除）
    const sorted = Object.entries(participants)
      .filter(([, p]) => !p.isGuest)
      .map(([mid, p]) => ({ mid, ...p }))
      .sort((a, b) => (b.totalDmg || 0) - (a.totalDmg || 0));

    for (let idx = 0; idx < sorted.length; idx++) {
      const { mid } = sorted[idx];
      const rankLabel = idx === 0 ? "第1名" : idx <= 2 ? `第${idx+1}名` : "參戰者";
      const tier = idx === 0 ? rank1 : idx <= 2 ? rank3 : rankAll;

      // 1. 保底獎勵（新格式才發）
      if (isNewFormat) {
        if (base.coins > 0) await addCoins(mid, base.coins).catch(() => {});
        if (base.woodChests > 0) {
          const woodList = Array.from({ length: base.woodChests }, (_, i) => ({
            id: `wb_base_${mid}_${Date.now()}_${i}`,
            type: "wood", family: "worldboss", tier: "common", from: "世界王保底獎勵", ts: Date.now(),
          }));
          await addChests(mid, woodList).catch(() => {});
        }
      }

      // 2. 分層獎勵：金幣
      if (tier.coins > 0) await addCoins(mid, tier.coins).catch(() => {});

      // 3. 黃金寶箱 + 貓貓箱
      const chests = [];
      for (let i = 0; i < (tier.goldChests || 0); i++) {
        chests.push({ id: `wb_gold_${mid}_${Date.now()}_${i}`, type: "gold", family: "worldboss", tier: "boss", from: `世界王擊殺獎勵（${rankLabel}）`, ts: Date.now() });
      }
      for (let i = 0; i < (tier.catBoxes || 0); i++) {
        chests.push({ id: `wb_cat_${mid}_${Date.now()}_${i}`, type: "cat_box", family: "worldboss", tier: "boss", from: `世界王擊殺獎勵（${rankLabel}）`, ts: Date.now() });
      }
      if (chests.length > 0) await addChests(mid, chests).catch(() => {});

      // 4. 咪咪箱：立即解鎖貓咪（重複時 +50 羈絆）
      if ((tier.mimiBoxes || 0) > 0) {
        const { openCatBox } = await import("./catDb");
        for (let i = 0; i < tier.mimiBoxes; i++) {
          await openCatBox(mid, { bondOnDuplicate: 50 }).catch(() => {});
        }
      }

      // 5. 卡片掉落
      if ((tier.cardChance || 0) > 0 && Math.random() < tier.cardChance) {
        await addCardPack(mid).catch(() => {});
      }
    }

    // 最後一擊額外獎勵（疊加）
    if (lastHitId && !participants[lastHitId]?.isGuest) {
      await addChests(lastHitId, [{
        id: `wb_lasthit_${lastHitId}_${Date.now()}`,
        type: "cat_box", family: "worldboss", tier: "boss", from: "世界王最後一擊", ts: Date.now(),
      }]).catch(() => {});
      await addCardPack(lastHitId).catch(() => {});
    }

    await updateDoc(doc(db, WB, eventId), { rewardDistributed: true });

    // 寫入歷史
    await addDoc(collection(db, WBH), {
      eventId,
      bossKey: ev.bossKey,
      bossName: ev.bossData?.name,
      result: "defeated",
      ts: serverTimestamp(),
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
      result: "expired", ts: serverTimestamp(), expiredAt: serverTimestamp(),
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
      query(collection(db, WBH), orderBy("ts", "desc"), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function getLatestWorldBossKill() {
  try {
    const snap = await getDocs(
      query(collection(db, WBH), orderBy("ts", "desc"), limit(5))
    );
    const defeated = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(d => d.result === "defeated");
    return defeated || null;
  } catch { return null; }
}
