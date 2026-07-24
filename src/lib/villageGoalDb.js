// src/lib/villageGoalDb.js — 村目標 Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot, getDoc, getDocs,
  serverTimestamp, increment, query, where, orderBy, limit, Timestamp, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { assertCostCapability, COST_CAPABILITIES } from "./costControl";
import { addCoins, addArrowdew, addGachaCoins, createNotification } from "./db";
import {
  getGoalTarget, getGoalReward, CONSOLATION_REWARD,
  GOAL_TYPE_MAP, buildGoalTitle, buildGoalDesc,
  GOAL_TYPES,
} from "./villageGoalData";

const COLLECTION = "villageGoals";

const GATHERING_MATERIAL_TARGETS = [
  { id: "mountain_m1", label: "山岳族 T1素材" },
  { id: "mountain_m2", label: "山岳族 T2素材" },
  { id: "insect_m1", label: "昆蟲族 T1素材" },
  { id: "insect_m2", label: "昆蟲族 T2素材" },
  { id: "ghost_m1", label: "幽靈族 T1素材" },
  { id: "ghost_m2", label: "幽靈族 T2素材" },
  { id: "workplace_m1", label: "職場族 T1素材" },
  { id: "exam_m1", label: "考試族 T1素材" },
  { id: "temple_m1", label: "神殿族 T1素材" },
];

const GATHERING_RESOURCE_TARGETS = [
  { key: "ore_t1", label: "礦石 T1" },
  { key: "melon_t1", label: "瓜果 T1" },
  { key: "fish_t1", label: "鮮魚 T1" },
  { key: "meat_t1", label: "獸肉 T1" },
  { key: "driedfish_t1", label: "小魚乾 T1" },
  { key: "can_t1", label: "罐頭 T1" },
  { key: "fur_t1", label: "陪練貓毛 T1" },
  { key: "potion_t1", label: "貓草藥水材料 T1" },
];

function pickGatheringTarget(goalType) {
  if (goalType === "gathering_material") {
    return GATHERING_MATERIAL_TARGETS[Math.floor(Math.random() * GATHERING_MATERIAL_TARGETS.length)];
  }
  if (goalType === "gathering_resource") {
    return GATHERING_RESOURCE_TARGETS[Math.floor(Math.random() * GATHERING_RESOURCE_TARGETS.length)];
  }
  return null;
}

function applyGatheringTargetFields(goalType, target) {
  if (goalType === "gathering_material" && target?.id) {
    return { targetMaterialId: target.id, targetMaterialName: target.label };
  }
  if (goalType === "gathering_resource" && target?.key) {
    return { targetResourceKey: target.key, targetResourceName: target.label };
  }
  return {};
}

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

// 大富翁探索地圖繞圈貢獻（單人/組隊繞回起點時呼叫）
export async function contributeLapToGoal(memberId, count = 1) {
  const goal = _cachedActiveGoal;
  if (!goal || goal.goalType !== "board_laps" || count <= 0) return;
  try {
    await updateDoc(doc(db, COLLECTION, goal.id), {
      currentValue: increment(count),
      [`participants.${memberId}.contributed`]: increment(count),
    });
  } catch (e) {
    console.warn("[villageGoal] contributeLap failed:", e.message);
  }
}

export async function contributeGatheringToGoal(memberId, {
  progressPct = 0,
  participants = 1,
  materialId = "",
  materialCount = 0,
  villageResources = {},
} = {}) {
  const goal = _cachedActiveGoal;
  if (!goal || !memberId) return;

  let amount = 0;
  if (goal.goalType === "gathering_progress") {
    amount = Math.max(0, Math.round(Number(progressPct) || 0));
  } else if (goal.goalType === "gathering_participants") {
    amount = Math.max(0, Math.round(Number(participants) || 0));
  } else if (goal.goalType === "gathering_material") {
    if (goal.targetMaterialId && materialId !== goal.targetMaterialId) return;
    amount = Math.max(0, Math.round(Number(materialCount) || 0));
  } else if (goal.goalType === "gathering_resource") {
    const key = goal.targetResourceKey;
    if (!key) return;
    amount = Math.max(0, Math.round(Number(villageResources?.[key]) || 0));
  } else {
    return;
  }

  if (amount <= 0) return;
  try {
    await updateDoc(doc(db, COLLECTION, goal.id), {
      currentValue: increment(amount),
      [`participants.${memberId}.contributed`]: increment(amount),
      [`participants.${memberId}.gatheringRuns`]: increment(1),
    });
  } catch (e) {
    console.warn("[villageGoal] contributeGathering failed:", e.message);
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
    const gatheringTarget = pickGatheringTarget(goalType);
    const rewards = getGoalReward(villageLevel);
    const endAt = new Date(Date.now() + 86400000); // 24 小時後

    const ref = await addDoc(collection(db, COLLECTION), {
      goalType,
      targetValue,
      ...applyGatheringTargetFields(goalType, gatheringTarget),
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

// ── 完成目標（只標記狀態+公告，獎勵改由各參與者自行請領 claimVillageGoalReward）──
export async function completeGoal(goalId) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, goalId));
    if (!snap.exists()) return { ok: false };
    const goal = snap.data();
    if (goal.status === "completed") return { ok: true };

    await updateDoc(doc(db, COLLECTION, goalId), {
      status: "completed",
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

// ── 自行請領村目標獎勵（每個參與者用自己的帳號寫自己的 members 文件，避免權限問題）──
// 適用 status: completed（正式獎勵 goal.rewards）| expired（安慰獎 CONSOLATION_REWARD）
export async function claimVillageGoalReward(goalId, memberId) {
  try {
    // 先用 transaction 原子鎖定 claimed=true（只有一個請求會成功），避免連點/併發重複領取。
    let reward = null;
    await runTransaction(db, async tx => {
      const ref = doc(db, COLLECTION, goalId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("找不到目標");
      const goal = snap.data();
      if (goal.status !== "completed" && goal.status !== "expired") throw new Error("目標尚未結束");
      const mine = goal.participants?.[memberId];
      if (!mine || !(mine.contributed > 0)) throw new Error("沒有貢獻紀錄");
      if (mine.claimed) throw new Error("already_claimed");
      reward = goal.status === "completed" ? (goal.rewards || {}) : CONSOLATION_REWARD;
      tx.update(ref, { [`participants.${memberId}.claimed`]: true });
    });

    // claimed 已在交易內鎖定，才發獎（重複請求會在上面丟 already_claimed，不會走到這）
    if (reward) {
      if (reward.arrowdew > 0)   await addArrowdew(memberId, reward.arrowdew).catch(() => {});
      if (reward.coins > 0)      await addCoins(memberId, reward.coins).catch(() => {});
      if (reward.gachaToken > 0) await addGachaCoins(memberId, reward.gachaToken).catch(() => {});
    }
    return { ok: true, reward };
  } catch (e) {
    return { ok: false, reason: e.message === "already_claimed" ? "already_claimed" : (e.message || "領取失敗") };
  }
}

// ── 過期目標（只標記狀態，安慰獎改由各參與者自行請領 claimVillageGoalReward）──
export async function expireGoal(goalId) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, goalId));
    if (!snap.exists()) return { ok: false };
    const goal = snap.data();
    if (goal.status === "expired") return { ok: true };

    await updateDoc(doc(db, COLLECTION, goalId), {
      status: "expired",
      expiredAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 後台：補發歷史遺漏的村目標獎勵（僅限教練觸發，isAdmin() 才能寫入任意會員文件）──
// 掃描所有 completed/expired 目標，幫尚未 claimed 的參與者補發。
// 舊資料無法分辨「當初到底有沒有真的發成功」，可能讓少數已領過的人重複拿到一次
// （已跟使用者確認接受這個風險：獎勵金額小，寧可多發不要漏發）。
// 可重複執行：已標記 claimed 的參與者會被跳過，不會重複發放。
export async function adminBackfillVillageGoalRewards() {
  assertCostCapability(COST_CAPABILITIES.migrations);
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where("status", "in", ["completed", "expired"]))
    );
    let goalsScanned = 0;
    let membersGranted = 0;
    for (const docSnap of snap.docs) {
      goalsScanned++;
      const goal = docSnap.data();
      const participants = goal.participants || {};
      const reward = goal.status === "completed" ? (goal.rewards || {}) : CONSOLATION_REWARD;
      for (const [mid, p] of Object.entries(participants)) {
        if (!(p.contributed > 0) || p.claimed) continue;
        if (reward.arrowdew > 0)   await addArrowdew(mid, reward.arrowdew).catch(() => {});
        if (reward.coins > 0)      await addCoins(mid, reward.coins).catch(() => {});
        if (reward.gachaToken > 0) await addGachaCoins(mid, reward.gachaToken).catch(() => {});
        await updateDoc(doc(db, COLLECTION, docSnap.id), {
          [`participants.${mid}.claimed`]: true,
          [`participants.${mid}.claimedByBackfill`]: true,
        }).catch(() => {});
        membersGranted++;
      }
    }
    return { ok: true, goalsScanned, membersGranted };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 後台取消當前 active 目標 ──────────────────────────────
export async function adminCancelGoal(goalId) {
  try {
    await updateDoc(doc(db, COLLECTION, goalId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 後台強制完成目標（只標記狀態，獎勵一律走自行請領 claimVillageGoalReward，避免跟一般完成流程分岔）──
export async function adminForceCompleteGoal(goalId, rewardOverride) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, goalId));
    if (!snap.exists()) return { ok: false, reason: "找不到目標" };
    const goal = snap.data();
    if (goal.status === "completed") return { ok: true, reason: "already_completed" };

    const reward = rewardOverride || goal.rewards;
    if (!reward) return { ok: false, reason: "無獎勵設定" };

    const updates = {
      status: "completed",
      completedAt: serverTimestamp(),
      completedByAdmin: true,
    };
    if (rewardOverride) updates.rewards = rewardOverride;
    await updateDoc(doc(db, COLLECTION, goalId), updates);

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 後台修改目標（僅限 active 狀態）──────────────────────────
export async function adminUpdateGoal(goalId, updates) {
  try {
    const allowedFields = {};
    if (updates.targetValue !== undefined) allowedFields.targetValue = Number(updates.targetValue);
    if (updates.currentValue !== undefined) allowedFields.currentValue = Number(updates.currentValue);
    if (updates.targetMaterialId !== undefined) allowedFields.targetMaterialId = updates.targetMaterialId || "";
    if (updates.targetMaterialName !== undefined) allowedFields.targetMaterialName = updates.targetMaterialName || "";
    if (updates.targetResourceKey !== undefined) allowedFields.targetResourceKey = updates.targetResourceKey || "";
    if (updates.targetResourceName !== undefined) allowedFields.targetResourceName = updates.targetResourceName || "";
    if (updates.rewards) {
      allowedFields.rewards = {
        arrowdew: Number(updates.rewards.arrowdew ?? 0),
        coins: Number(updates.rewards.coins ?? 0),
        gachaToken: Number(updates.rewards.gachaToken ?? 0),
      };
    }
    if (updates.customTitle !== undefined) allowedFields.customTitle = updates.customTitle || null;
    if (updates.customDescription !== undefined) allowedFields.customDescription = updates.customDescription || null;
    if (updates.durationHours !== undefined) {
      allowedFields.endAt = new Date(Date.now() + Number(updates.durationHours) * 3600000);
    }
    if (Object.keys(allowedFields).length === 0) return { ok: false, reason: "無有效欄位" };

    allowedFields.updatedAt = serverTimestamp();
    allowedFields.updatedByAdmin = true;

    await updateDoc(doc(db, COLLECTION, goalId), allowedFields);
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
  targetMaterialId = "",
  targetMaterialName = "",
  targetResourceKey = "",
  targetResourceName = "",
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
    const fallbackTarget = pickGatheringTarget(goalType);
    const gatheringFields = goalType === "gathering_material"
      ? {
          targetMaterialId: targetMaterialId || fallbackTarget?.id || "",
          targetMaterialName: targetMaterialName || fallbackTarget?.label || "",
        }
      : goalType === "gathering_resource"
        ? {
            targetResourceKey: targetResourceKey || fallbackTarget?.key || "",
            targetResourceName: targetResourceName || fallbackTarget?.label || "",
          }
        : {};

    const ref = await addDoc(collection(db, COLLECTION), {
      goalType,
      targetValue: Number(targetValue),
      ...gatheringFields,
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
    await completeGoal(goal.id);
  } else if (endMs && now >= endMs) {
    await expireGoal(goal.id);
  }
}
