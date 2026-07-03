// src/lib/dungeonExcavation.js — 地下城發掘進度核心邏輯
// 管理 members/{memberId}.dungeonExcavation 欄位
// 三種來源：① 定時自動生成 ② 練箭/報到挖掘 ③ 世界王卷軸

import { doc, updateDoc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { drawExpeditionBoss } from "./monsterData";

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

// ══════════════════════════════════════════════════════════════
// ① 定時自動生成系統
// ══════════════════════════════════════════════════════════════

/**
 * 初始化或重置自動挖掘定時器（隨機 24~144 小時）
 * 在玩家處理完自動生成的地下城後呼叫
 */
export async function resetAutoDigTimer(memberId) {
  if (!memberId) return;
  const hours = 24 + Math.floor(Math.random() * 121); // 24~144
  const nextAt = Date.now() + hours * 3600000;
  try {
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.autoDigNextAt": nextAt,
    }).catch(() => {});
  } catch (e) {
    console.warn("resetAutoDigTimer:", e?.message);
  }
}

/**
 * 初始化自動挖掘（首次使用時設定初始計時器）
 * 由 DungeonExcavationTab mount 時呼叫
 */
export async function initAutoDigTimer(memberId) {
  if (!memberId) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    // 已有計時器則不覆蓋
    if (excavation.autoDigNextAt) return;
    await resetAutoDigTimer(memberId);
  } catch (e) {
    console.warn("initAutoDigTimer:", e?.message);
  }
}

/**
 * 領取自動挖掘的地下城
 * 生成隨機種族 + 難度（weighted），寫入 pendingReveal
 */
export async function claimAutoDig(memberId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const nextAt = excavation.autoDigNextAt;
    if (!nextAt || Date.now() < nextAt) return { ok: false, reason: "尚未準備好" };

    const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
    const family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];

    // 自動挖掘的難度：均等機率 1~6
    const difficulty = 1 + Math.floor(Math.random() * 6);

    const result = {
      family,
      difficulty,
      isHidden: false,
      boss: drawExpeditionBoss(difficulty, family),
      revealedAt: Date.now(),
      fromAutoDig: true,
    };

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": result,
      "dungeonExcavation.revealedAt": serverTimestamp(),
      "dungeonExcavation.autoDigNextAt": null,
    }).catch(() => {});

    return { ok: true, dungeon: result };
  } catch (e) {
    console.warn("claimAutoDig:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

/**
 * 純函式：檢查自動挖掘狀態
 * 回傳 { ready: bool, remainingMs: number }
 */
export function checkAutoDigStatus(excavation) {
  const nextAt = excavation?.autoDigNextAt;
  if (!nextAt) return { ready: false, remainingMs: 0 };
  const remaining = nextAt - Date.now();
  return {
    ready: remaining <= 0,
    remainingMs: Math.max(0, remaining),
  };
}

// ══════════════════════════════════════════════════════════════
// ② 練箭/報到挖掘系統
// ══════════════════════════════════════════════════════════════

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
      const updates = {
        "dungeonExcavation.lastActiveDate": today,
        "dungeonExcavation.dailyArrowsUsed": 0,
        "dungeonExcavation.progress": increment(10),
      };
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
 * 報到時增加發掘進度 +20
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
      "dungeonExcavation.progress": increment(20),
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
 * 射箭時增加發掘進度（每箭 +1）
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

    if (lastActive !== today) {
      const current = data.dungeonExcavation || {};
      await setDoc(doc(db, "members", memberId), {
        dungeonExcavation: {
          ...current,
          lastActiveDate: today,
          progress: Math.min(100, (current.progress || 0) + Math.min(arrowCount, 100)),
          dailyArrowsUsed: arrowCount,
        },
      }, { merge: true }).catch(() => {});
      return;
    }

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.lastActiveDate": today,
      "dungeonExcavation.progress": increment(Math.min(arrowCount, 100)),
      "dungeonExcavation.dailyArrowsUsed": increment(arrowCount),
    }).catch(() => {});
  } catch (e) {
    console.warn("addExcavationByArrows:", e?.message);
  }
}

/**
 * 純函式：根據今日練箭量計算 T1~T6 開出機率
 * maxTier = min(6, 1 + floor(arrows / 30))
 * 回傳 [{ tier:1~6, pct:number }]
 */
export function getTierProbabilities(dailyArrows = 0) {
  const maxTier = Math.min(6, 1 + Math.floor(dailyArrows / 30));

  // 各 tier 基底權重（總和固定，隨 maxTier 調整比例）
  const weights = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < maxTier; i++) {
    // 越高等級權重越低：最高 tier 得最多權重
    const tierLevel = i + 1;
    // 核心：每個 tier 相對上一級的衰退率
    weights[i] = Math.max(5, 50 - (maxTier - tierLevel) * 10);
  }

  // 正規化為百分比
  const total = weights.reduce((s, v) => s + v, 0);
  if (total === 0) return [{ tier: 1, pct: 100 }];

  return weights.map((w, i) => ({
    tier: i + 1,
    pct: Math.round((w / total) * 100),
  }));
}

/**
 * 手動揭曉地下城（進度 100% 時鎖定 pendingReveal）
 * 使用新的 T1~T6 機率公式
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

    const dailyArrows = excavation.dailyArrowsUsed || 0;

    // 使用 T1~T6 機率系統
    const probs = getTierProbabilities(dailyArrows);
    const totalPct = probs.reduce((s, p) => s + p.pct, 0);
    const roll = Math.random() * totalPct;
    let difficulty = probs[0]?.tier || 1;
    let acc = 0;
    for (const p of probs) {
      acc += p.pct;
      if (roll < acc) { difficulty = p.tier; break; }
    }

    const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
    const family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];

    const isHidden = Math.random() < 0.05; // 5% 隱藏

    const result = {
      family,
      difficulty,
      isHidden,
      boss: drawExpeditionBoss(difficulty, family),
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
      "dungeonExcavation.pendingReveal": {
        ...pending,
        difficulty: newDifficulty,
        boss: drawExpeditionBoss(newDifficulty, pending.family),
      },
    });

    return { ok: true, newDifficulty, cost };
  } catch (e) {
    console.warn("upgradeExcavationDifficulty:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

/**
 * 免費降級一級（不限次數，最低降至 T1）
 */
export async function downgradeExcavationDifficulty(memberId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const pending = data.dungeonExcavation?.pendingReveal;
    if (!pending) return { ok: false, reason: "沒有待揭曉的地下城" };

    const currentDiff = pending.difficulty || 1;
    if (currentDiff <= 1) return { ok: false, reason: "已是最低難度" };

    const newDifficulty = currentDiff - 1;
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": {
        ...pending,
        difficulty: newDifficulty,
        boss: drawExpeditionBoss(newDifficulty, pending.family),
      },
    });

    return { ok: true, newDifficulty };
  } catch (e) {
    console.warn("downgradeExcavationDifficulty:", e?.message);
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
 * 放棄地下城（進度歸零），若來自自動挖掘則重設計時器
 */
export async function abandonExcavation(memberId) {
  if (!memberId) return;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    const data = snap.exists() ? snap.data() : {};
    const pending = data.dungeonExcavation?.pendingReveal;
    const wasAutoDig = pending?.fromAutoDig;

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.progress": 0,
      "dungeonExcavation.pendingReveal": null,
      "dungeonExcavation.revealedAt": null,
    }).catch(() => {});

    // 若放棄的是自動挖掘的地下城，重設計時器
    if (wasAutoDig) {
      await resetAutoDigTimer(memberId);
    }
  } catch (e) {
    console.warn("abandonExcavation:", e?.message);
  }
}

// ══════════════════════════════════════════════════════════════
// 儲存槽操作
// ══════════════════════════════════════════════════════════════

/**
 * 保存揭曉的地下城到儲存槽（最多 3 個）
 */
export async function saveExcavation(memberId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const pending = excavation.pendingReveal;
    if (!pending) return { ok: false, reason: "沒有待揭曉的地下城" };

    const saved = excavation.savedDungeons || [];
    if (saved.length >= 3) return { ok: false, reason: "儲存槽已滿（最多 3 個）" };

    const newDungeon = {
      id: `d${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      family: pending.family,
      difficulty: pending.difficulty,
      isHidden: pending.isHidden || false,
      boss: pending.boss || drawExpeditionBoss(pending.difficulty, pending.family),
      fromAutoDig: pending.fromAutoDig || false,
      fromWorldBoss: pending.fromWorldBoss || false,
      revealedAt: new Date().toISOString(),
    };

    const updatedSaved = [...saved, newDungeon];

    // 檢查是否需要重設自動挖掘計時器
    const wasAutoDig = pending.fromAutoDig;

    const updates = {
      "dungeonExcavation.pendingReveal": null,
      "dungeonExcavation.revealedAt": null,
      "dungeonExcavation.progress": 0,
      "dungeonExcavation.savedDungeons": updatedSaved,
    };

    await updateDoc(doc(db, "members", memberId), updates).catch(() => {});

    // 若保存的是自動挖掘的地下城，重設計時器
    if (wasAutoDig) {
      await resetAutoDigTimer(memberId);
    }

    return { ok: true, dungeon: newDungeon, savedDungeons: updatedSaved };
  } catch (e) {
    console.warn("saveExcavation:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

/**
 * 從儲存槽移除一個地下城
 */
export async function removeSavedDungeon(memberId, dungeonId) {
  if (!memberId || !dungeonId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const current = data.dungeonExcavation?.savedDungeons || [];
    if (!current.some(dungeon => dungeon.id === dungeonId)) {
      return { ok: false, reason: "地下城已不在儲存槽" };
    }
    const saved = current.filter(d => d.id !== dungeonId);
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.savedDungeons": saved,
    });
    return { ok: true, savedDungeons: saved };
  } catch (e) {
    console.warn("removeSavedDungeon:", e?.message);
    return { ok: false, reason: e?.message || "無法更新儲存槽" };
  }
}

/**
 * 讀取會員的儲存地下城清單
 */
export async function getSavedDungeons(memberId) {
  if (!memberId) return [];
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return [];
    return snap.data().dungeonExcavation?.savedDungeons || [];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// ③ 世界王卷軸系統
// ══════════════════════════════════════════════════════════════

/**
 * 給予玩家一個地下城卷軸
 */
export async function grantDungeonScroll(memberId) {
  if (!memberId) return { ok: false };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const scrolls = (data.dungeonExcavation?.scrolls || 0) + 1;

    if (!data.dungeonExcavation) {
      await setDoc(doc(db, "members", memberId), {
        dungeonExcavation: {
          progress: 0, dailyArrowsUsed: 0,
          lastActiveDate: new Date().toISOString().slice(0, 10),
          pendingReveal: null, revealedAt: null, completed: false,
          savedDungeons: [],
          scrolls,
        },
      }, { merge: true }).catch(() => {});
    } else {
      await updateDoc(doc(db, "members", memberId), {
        "dungeonExcavation.scrolls": increment(1),
      }).catch(() => {});
    }

    return { ok: true, scrolls };
  } catch (e) {
    console.warn("grantDungeonScroll:", e?.message);
    return { ok: false };
  }
}

/**
 * 使用地下城卷軸：隨機獲得一個地下城到儲存槽（需有空位）
 */
export async function useDungeonScroll(memberId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const scrolls = excavation.scrolls || 0;

    if (scrolls <= 0) return { ok: false, reason: "沒有可使用的卷軸" };
    if ((excavation.savedDungeons || []).length >= 3)
      return { ok: false, reason: "儲存槽已滿，請先使用或移除已有地下城" };

    const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
    const family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];
    const difficulty = 1 + Math.floor(Math.random() * 6); // 隨機 1~6

    const newDungeon = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      family,
      difficulty,
      isHidden: false,
      boss: drawExpeditionBoss(difficulty, family),
      fromWorldBoss: true,
      revealedAt: new Date().toISOString(),
    };

    const updatedSaved = [...(excavation.savedDungeons || []), newDungeon];
    const newScrolls = scrolls - 1;

    if (!data.dungeonExcavation) {
      await setDoc(doc(db, "members", memberId), {
        dungeonExcavation: {
          progress: 0, dailyArrowsUsed: 0,
          lastActiveDate: new Date().toISOString().slice(0, 10),
          pendingReveal: null, revealedAt: null, completed: false,
          savedDungeons: updatedSaved,
          scrolls: newScrolls,
        },
      }, { merge: true }).catch(() => {});
    } else {
      await updateDoc(doc(db, "members", memberId), {
        "dungeonExcavation.savedDungeons": updatedSaved,
        "dungeonExcavation.scrolls": newScrolls,
      }).catch(() => {});
    }

    return { ok: true, dungeon: newDungeon, savedDungeons: updatedSaved, scrolls: newScrolls };
  } catch (e) {
    console.warn("useDungeonScroll:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

/**
 * 讀取玩家持有的卷軸數量
 */
export async function getDungeonScrollCount(memberId) {
  if (!memberId) return 0;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return 0;
    return snap.data().dungeonExcavation?.scrolls || 0;
  } catch {
    return 0;
  }
}

// ══════════════════════════════════════════════════════════════
// 舊相容：世界王直接給地下城（改用卷軸系統取代）
// ══════════════════════════════════════════════════════════════
/**
 * 世界王擊殺獎勵：給玩家一個隨機地下城（舊版，改用卷軸）
 * 保留以相容歷史呼叫，但新流程應使用 grantDungeonScroll
 */
export async function grantWorldBossDungeon(memberId) {
  // 新流程：改為給予卷軸
  return await grantDungeonScroll(memberId);
}

// ══════════════════════════════════════════════════════════════
// 管理員工具
// ══════════════════════════════════════════════════════════════

export async function adminSetSavedDungeon(memberId, dungeonEntry, index = null) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();
    const saved = data.dungeonExcavation?.savedDungeons || [];

    const preparedEntry = {
      ...dungeonEntry,
      boss: dungeonEntry.boss
        || drawExpeditionBoss(dungeonEntry.difficulty || 1, dungeonEntry.family),
    };
    let updated;
    if (index !== null && index >= 0 && index < saved.length) {
      updated = [...saved];
      updated[index] = { ...updated[index], ...preparedEntry };
    } else {
      if (saved.length >= 3) return { ok: false, reason: "儲存槽已滿（最多 3 個）" };
      updated = [...saved, preparedEntry];
    }

    if (!data.dungeonExcavation) {
      await setDoc(doc(db, "members", memberId), {
        dungeonExcavation: {
          progress: 0, dailyArrowsUsed: 0,
          lastActiveDate: new Date().toISOString().slice(0, 10),
          pendingReveal: null, revealedAt: null, completed: false,
          savedDungeons: updated,
        },
      }, { merge: true }).catch(() => {});
    } else {
      await updateDoc(doc(db, "members", memberId), {
        "dungeonExcavation.savedDungeons": updated,
      }).catch(() => {});
    }

    return { ok: true, savedDungeons: updated };
  } catch (e) {
    console.warn("adminSetSavedDungeon:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}
