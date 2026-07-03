// src/lib/dungeonExcavation.js — 地下城發掘進度核心邏輯
// 管理 members/{memberId}.dungeonExcavation 欄位
// 進度來源：每日登入 +10、報到 +10、每箭 +0.3

import { doc, updateDoc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * 今日日期字串 YYYY-MM-DD
 */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 取得會員目前的發掘進度資料
 */
export async function getExcavation(memberId) {
  if (!memberId) return null;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.dungeonExcavation || null;
  } catch {
    return null;
  }
}

/**
 * 初始化或重置每日發掘進度（檢查換日）
 * 每天第一次呼叫時 +10 並重置 dailyArrowsUsed
 * 由 MemberApp/AdminApp 登入時呼叫
 */
export async function initDailyExcavation(memberId) {
  if (!memberId) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const today = todayStr();
    const lastActive = excavation.lastActiveDate || "";

    if (lastActive !== today) {
      // 換日重置：dailyArrowsUsed 歸零，progress 保留
      const updates = {
        "dungeonExcavation.lastActiveDate": today,
        "dungeonExcavation.dailyArrowsUsed": 0,
        "dungeonExcavation.progress": increment(10),
      };
      // 若進度已達 100%，不再自動 +10（等待玩家手動處理）
      if ((excavation.progress || 0) >= 100) {
        delete updates["dungeonExcavation.progress"];
      }
      await updateDoc(doc(db, "members", memberId), updates).catch(() => {});
    }
  } catch (e) {
    console.warn("initDailyExcavation:", e?.message);
  }
}

/**
 * 報到時增加發掘進度 +10
 * 由 submitCheckin / approveCheckin 內部呼叫
 */
export async function addExcavationByCheckin(memberId) {
  if (!memberId) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    if ((excavation.progress || 0) >= 100) return;

    const today = todayStr();
    const lastActive = excavation.lastActiveDate || "";

    const baseUpdates = {
      "dungeonExcavation.lastActiveDate": today,
      "dungeonExcavation.progress": increment(10),
    };
    if (lastActive !== today) {
      baseUpdates["dungeonExcavation.dailyArrowsUsed"] = 0;
    }

    await updateDoc(doc(db, "members", memberId), baseUpdates).catch(() => {});
  } catch (e) {
    console.warn("addExcavationByCheckin:", e?.message);
  }
}

/**
 * 射箭時增加發掘進度（每箭 +0.3）
 * 由 addRoundArrows 內部呼叫（動態 import）
 */
export async function addExcavationByArrows(memberId, arrowCount) {
  if (!memberId || !arrowCount || arrowCount <= 0) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    if ((excavation.progress || 0) >= 100) return;

    const today = todayStr();
    const lastActive = excavation.lastActiveDate || "";
    const progressGain = Math.round(arrowCount * 0.3 * 10) / 10;

    // 遇換日需重置 dailyArrowsUsed（用 setDoc merge 因為 increment 無法重置為箭數值）
    if (lastActive !== today) {
      const current = data.dungeonExcavation || {};
      await setDoc(doc(db, "members", memberId), {
        dungeonExcavation: {
          ...current,
          lastActiveDate: today,
          progress: Math.min(100, (current.progress || 0) + progressGain),
          dailyArrowsUsed: arrowCount,
        },
      }, { merge: true }).catch(() => {});
      return;
    }

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.lastActiveDate": today,
      "dungeonExcavation.progress": increment(progressGain),
      "dungeonExcavation.dailyArrowsUsed": increment(arrowCount),
    }).catch(() => {});
  } catch (e) {
    console.warn("addExcavationByArrows:", e?.message);
  }
}

/**
 * 手動揭曉地下城（進度 100% 時鎖定 pendingReveal）
 * 回傳 { family, difficulty, isHidden }
 */
export async function revealExcavation(memberId) {
  if (!memberId) return null;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const progress = excavation.progress || 0;

    if (progress < 100) return null;

    // 稀有度骰子（依練箭量決定權重）
    const dailyArrows = excavation.dailyArrowsUsed || 0;
    let weights = { common: 60, rare: 30, hidden: 10 };
    if (dailyArrows >= 30) { weights.common -= 10; weights.rare += 10; }
    if (dailyArrows >= 60) { weights.rare -= 5; weights.hidden += 15; }
    if (dailyArrows >= 90) { weights.rare -= 5; weights.hidden += 10; }

    const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);
    const roll = Math.random() * totalWeight;
    let rarity = "common";
    let acc = 0;
    for (const [key, val] of Object.entries(weights)) {
      acc += val;
      if (roll < acc) { rarity = key; break; }
    }

    // 稀有度 → 難度級別
    const DIFFICULTY_TIER_MAP = {
      common: 1,
      rare:   3,
      hidden: 6,
    };

    // 從六族隨機抽
    const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
    const family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];

    const result = {
      family,
      difficulty: DIFFICULTY_TIER_MAP[rarity] || 1,
      isHidden: rarity === "hidden",
      revealedAt: Date.now(),
    };

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": result,
      "dungeonExcavation.revealedAt": serverTimestamp(),
    }).catch(() => {});

    return result;
  } catch (e) {
    console.warn("revealExcavation:", e?.message);
    return null;
  }
}

/**
 * 金幣強化一級
 * 費用：隨機 500~2000 金幣
 */
export async function upgradeExcavationDifficulty(memberId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const pending = data.dungeonExcavation?.pendingReveal;
    if (!pending) return { ok: false, reason: "沒有待揭曉的地下城" };

    const currentDiff = pending.difficulty || 1;
    if (currentDiff >= 6) return { ok: false, reason: "已是最高難度" };

    const cost = 500 + Math.floor(Math.random() * 1501);
    const coins = data.coins || 0;
    if (coins < cost) return { ok: false, reason: `金幣不足` };

    const newDifficulty = currentDiff + 1;

    await updateDoc(doc(db, "members", memberId), {
      coins: increment(-cost),
      "dungeonExcavation.pendingReveal.difficulty": newDifficulty,
    }).catch(() => {});

    return { ok: true, newDifficulty, cost };
  } catch (e) {
    console.warn("upgradeExcavationDifficulty:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

/**
 * 完成地下城後清除 pendingReveal 並重置進度
 */
export async function completeExcavation(memberId) {
  if (!memberId) return;
  try {
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.progress": 0,
      "dungeonExcavation.pendingReveal": null,
      "dungeonExcavation.revealedAt": null,
      "dungeonExcavation.completed": true,
    }).catch(() => {});
  } catch (e) {
    console.warn("completeExcavation:", e?.message);
  }
}

/**
 * 放棄地下城（進度歸零）
 */
export async function abandonExcavation(memberId) {
  if (!memberId) return;
  try {
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.progress": 0,
      "dungeonExcavation.pendingReveal": null,
      "dungeonExcavation.revealedAt": null,
    }).catch(() => {});
  } catch (e) {
    console.warn("abandonExcavation:", e?.message);
  }
}
