// src/lib/villageGoalDb.js — 村目標 Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot, getDoc, getDocs,
  serverTimestamp, increment, query, where, orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, addArrowdew, addGachaCoins, createNotification } from "./db";
import {
  getGoalTarget, getGoalReward, CONSOLATION_REWARD,
  GOAL_TYPE_MAP, buildGoalTitle, buildGoalDesc,
  GOAL_TYPES,
} from "./villageGoalData";

const COLLECTION = "villageGoals";

// ── 模組級快取：當前 active 目標的 ID ────────────────────────
// 由 initGoalTracker 在 App 啟動時訂閱，供貢獻 hook 讀取
let _cachedActiveGoal = null;  // { id, goalType, ... } | null
export function getActiveGoal() { return _cachedActiveGoal; }

// ── 訂閱當前 active 目標（前端用）────────────────────────────
export function subscribeActiveGoal(cb) {
  return _subscribeByStatus("active", cb);
}

// ── 訂閱最新目標（用於自動刷新檢查）──────────────────────────
export function subscribeLatestGoal(cb) {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    cb({ id: snap.docs[0].id, ...snap.docs[0].data() });
  }, () => cb(null));
}

function _subscribeByStatus(status, cb) {
  const q = query(collection(db, COLLECTION), where("status", "==", status), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); _cachedActiveGoal = null; return; }
    const d = { id: snap.docs[0].id, ...snap.docs[0].data() };
    _cachedActiveGoal = d;
    cb(d);
  }, err => { console.warn("[villageGoal] sub error:", err.message); cb(null); });
}

// ── 初始化目標追蹤器（在 App 層級啟動一次）──────────────────
// 回傳 unsubscribe function
export function initGoalTracker() {
  return _subscribeByStatus("active", () => {});
}

// ── 會員貢獻箭數（由 addRoundArrows 自動呼叫）────────────────
export async function contributeArrowsToGoal(memberId, count) {
  const goal = _cachedActiveGoal;
  if (!goal || goal.goalType !== "total_arrows") return;
  try {
    await updateDoc(doc(db, COLLECTION, goal.id), {
      currentValue: increment(count),
      [`participants.${memberId}.contributed`]: increment(count),
    });
  } catch (e) {
    console.warn("[villageGoal] contributeArrows failed:", e.message);
  }
}

// ── 會員貢獻傷害（由戰鬥模式呼叫）───────────────────────────
export async function contributeDamageToGoal(memberId, amount) {
  const goal = _cachedActiveGoal;
  if (!goal || goal.goalType !== "total_damage") return;
  try {
    await updateDoc(doc(db, COLLECTION, goal.id), {
      currentValue: increment(amount),
      [`participants.${memberId}.contributed`]: increment(amount),
    });
  } catch (e) {
    console.warn("[villageGoal] contributeDamage failed:", e.message);
  }
}

// ── 會員貢獻擊殺（由 saveMonsterLog 呼叫）───────────────────
export async function contributeKillToGoal(memberId) {
  const goal = _cachedActiveGoal;
  if (!goal || goal.goalType !== "monster_kills") return;
  try {
    await updateDoc(doc(db, COLLECTION, goal.id), {
      currentValue: increment(1),
      [`participants.${memberId}.contributed`]: increment(1),
    });
  } catch (e) {
    console.warn("[villageGoal] contributeKill failed:", e.message);
  }
}

// ── 自動刷新村目標（任何人進入貓村時觸發，內部防重複）──────
export async function autoSpawnVillageGoal(villageLevel = 1) {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(1))
    );

    if (!snap.empty) {
      const latest = { id: snap.docs[0].id, ...snap.docs[0].data() };
      // 若還有 active 目標 → 不刷新
      if (latest.status === "active") return { ok: false, reason: "already_active" };
      // 若上次結束還不到 24 小時 → 不刷新
      const endMs = latest.endAt?.toMillis?.();
      if (endMs && Date.now() - endMs < 86400000) return { ok: false, reason: "too_soon" };
    }

    // 防重複：更新最新一筆的 spawnedAt 欄位（先用 addDoc 建立新目標）
    const typeMeta = GOAL_TYPES[Math.floor(Math.random() * GOAL_TYPES.length)];
    const goalType = typeMeta.id;
    const targetValue = getGoalTarget(villageLevel, goalType);
    const rewards = getGoalReward(villageLevel);
    const endAt = new Date(Date.now() + 86400000); // 24 小時後

    const ref = await addDoc(collection(db, COLLECTION), {
      goalType,
      targetValue,
      currentValue: 0,
      status: "active",
      startAt: serverTimestamp(),
      endAt,
      rewards,
      participants: {},
      announced: false,
      createdAt: serverTimestamp(),
    });

    // 發公告通知全體會員
    await createNotification({
      type: "village_goal",
      title: buildGoalTitle(goalType, targetValue),
      content: buildGoalDesc(goalType, targetValue) + " 一起來完成吧！",
      targetMemberId: null,
    }, "system").catch(() => {});

    return { ok: true, goalId: ref.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 完成目標 & 發放獎勵 ──────────────────────────────────────
export async function completeGoal(goalId, reward) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, goalId));
    if (!snap.exists()) return { ok: false };
    const goal = snap.data();
    if (goal.rewardDistributed) return { ok: true };

    const participants = goal.participants || {};
    for (const [mid, p] of Object.entries(participants)) {
      if (p.contributed > 0) {
        if (reward.arrowdew > 0)  await addArrowdew(mid, reward.arrowdew).catch(() => {});
        if (reward.coins > 0)     await addCoins(mid, reward.coins).catch(() => {});
        if (reward.gachaToken > 0) await addGachaCoins(mid, reward.gachaToken).catch(() => {});
      }
    }

    await updateDoc(doc(db, COLLECTION, goalId), {
      status: "completed",
      rewardDistributed: true,
      completedAt: serverTimestamp(),
    });

    // 發完成公告
    const goalType = goal.goalType;
    const meta = GOAL_TYPE_MAP[goalType];
    await createNotification({
      type: "village_goal_complete",
      title: `🎉 村目標達成！${meta?.icon || "🏡"}`,
      content: `全村合作達成了「${meta?.name || "村目標"}」！所有貢獻者已獲得獎勵 🎁`,
      targetMemberId: null,
    }, "system").catch(() => {});

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 過期目標 & 安慰獎 ────────────────────────────────────────
export async function expireGoal(goalId) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, goalId));
    if (!snap.exists()) return { ok: false };
    const goal = snap.data();
    if (goal.rewardDistributed) return { ok: true };

    const participants = goal.participants || {};
    for (const [mid, p] of Object.entries(participants)) {
      if (p.contributed > 0) {
        await addArrowdew(mid, CONSOLATION_REWARD.arrowdew).catch(() => {});
        await addCoins(mid, CONSOLATION_REWARD.coins).catch(() => {});
        if (CONSOLATION_REWARD.gachaToken > 0) {
          await addGachaCoins(mid, CONSOLATION_REWARD.gachaToken).catch(() => {});
        }
      }
    }
    await updateDoc(doc(db, COLLECTION, goalId), {
      status: "expired",
      rewardDistributed: true,
      expiredAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 後台自定義村目標 ──────────────────────────────────────
export async function adminCreateCustomGoal({
  goalType,
  targetValue,
  rewards,
  title,
  description,
  durationHours = 24,
}) {
  try {
    // 先關閉現有 active 目標（如果有）
    const activeSnap = await getDocs(
      query(collection(db, COLLECTION), where("status", "==", "active"), limit(1))
    );
    if (!activeSnap.empty) {
      await updateDoc(doc(db, COLLECTION, activeSnap.docs[0].id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });
    }

    const endAt = new Date(Date.now() + durationHours * 3600000);

    const ref = await addDoc(collection(db, COLLECTION), {
      goalType,
      targetValue: Number(targetValue),
      currentValue: 0,
      status: "active",
      startAt: serverTimestamp(),
      endAt,
      rewards: {
        arrowdew: Number(rewards.arrowdew || 0),
        coins: Number(rewards.coins || 0),
        gachaToken: Number(rewards.gachaToken || 0),
      },
      participants: {},
      announced: false,
      createdAt: serverTimestamp(),
      isAdminCreated: true,
      customTitle: title || null,
      customDescription: description || null,
    });

    // 發公告
    await createNotification({
      type: "village_goal",
      title: title || buildGoalTitle(goalType, targetValue),
      content: description || buildGoalDesc(goalType, targetValue) + " 一起來完成吧！",
      targetMemberId: null,
    }, "system").catch(() => {});

    return { ok: true, goalId: ref.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 檢查目標狀態（完成或過期）— 前端每分鐘呼叫一次 ────────
export async function checkGoalStatus(goal) {
  if (!goal || goal.status !== "active") return;
  const now = Date.now();
  const endMs = goal.endAt?.toMillis?.();
  if (goal.currentValue >= goal.targetValue) {
    await completeGoal(goal.id, goal.rewards);
  } else if (endMs && now >= endMs) {
    await expireGoal(goal.id);
  }
}
