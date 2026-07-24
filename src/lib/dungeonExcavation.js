// src/lib/dungeonExcavation.js — 地下城發掘進度核心邏輯
// 管理 members/{memberId}.dungeonExcavation 欄位
// 三種來源：① 定時自動生成 ② 練箭/報到挖掘 ③ 世界王卷軸

import { doc, updateDoc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { drawExpeditionBoss, drawTreasureKing } from "./monsterData";
import { createLockedDungeonBossEncounter } from "./dungeonBossEncounter";
import { addCatXP } from "./catDb";
import { catBusyElsewhere, catBusyReason } from "./catAssignment";

// 地下城儲存槽上限（2026-07-23 作者：3 → 6）
export const MAX_SAVED_DUNGEONS = 6;

// ── 王房抽王統一入口（2026-07-19）──────────────────────────────
// 舊 drawExpeditionBoss 是「找該族該階第一隻怪再套 boss 倍率」，完全沒過濾
// isKing/encounter，王房的王其實是一隻被放大的雜怪（實測 ghost_3 林投姐、
// temple_2 骷髏劍士）。改走 createLockedDungeonBossEncounter：Tn 只出 Tn 的王
// （小王 2 隻擇一 / 大王 1 隻），連續小王後保底大王。
//
// ⚠️ 刻意複用戰鬥端（DungeonExpedition）那顆引擎，而不是另寫一套抽王：
// 地下城物件把整筆 encounter 存進 bossEncounter 欄位後，戰鬥端會直接沿用
// （isLockedDungeonBossEncounter 命中就不重算），所以「選擇畫面預覽的王」與
// 「實際打到的王」保證是同一隻。各抽各的必然對不上。
//
// runId 用地下城自己的穩定 id：同一座地下城的王因此是決定性的，玩家反覆
// 「花金幣升級 → 免費降級」也只會在各難度固定的王之間切換，無法重抽刷王。
const BOSS_ROOM_ID = "floor-3-boss";

function rollExcavationBoss(difficulty, family, excavation, { runId } = {}) {
  try {
    const encounter = createLockedDungeonBossEncounter({
      runId: runId || `excav:${family}:${Date.now()}`,
      roomId: BOSS_ROOM_ID,
      family,
      difficultyTier: difficulty,
      consecutiveNonBoss: excavation?.miniBossStreak || 0,
    });
    return {
      boss: encounter.monsterSnapshot,
      bossEncounter: encounter,
      miniStreak: encounter.nextConsecutiveNonBoss,
    };
  } catch {
    // 該族該階湊不齊「2 小王 + 1 大王」時引擎會 throw（例如寶箱族）→ 退回舊路徑
    return { boss: drawExpeditionBoss(difficulty, family), bossEncounter: null, miniStreak: null };
  }
}

// 地下城的穩定 runId：升降級要沿用同一個，王才不會被反覆重抽
function makeBossRunId(family) {
  return `excav:${family}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 今日日期字串 YYYY-MM-DD
 */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── session 級記憶體快取：避免 addExcavationByArrows（每箭觸發一次）每次都重讀整份 member 文件 ──
// memberId -> { ...dungeonExcavation 欄位, ts }
// 注意：本檔案任何「其他」會寫入 dungeonExcavation 欄位的函式，寫入成功後都必須呼叫
// _excavCache.delete(memberId) 讓快取失效，否則後續射箭會用到舊資料覆蓋掉這些函式剛寫入的新值。
const _excavCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分鐘安全網，正確性主要靠 lastActiveDate 換日比對，不是靠 TTL 撐

async function readExcavationCached(memberId) {
  const cached = _excavCache.get(memberId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;
  const snap = await getDoc(doc(db, "members", memberId));
  if (!snap.exists()) return null;
  const fresh = { ...(snap.data().dungeonExcavation || {}), ts: Date.now() };
  _excavCache.set(memberId, fresh);
  return fresh;
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
    _excavCache.delete(memberId);
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

    const bossRunId = makeBossRunId(family);
    const rolled = rollExcavationBoss(difficulty, family, excavation, { runId: bossRunId });
    const result = {
      family,
      difficulty,
      isHidden: false,
      boss: rolled.boss,
      bossEncounter: rolled.bossEncounter,
      bossRunId,
      revealedAt: Date.now(),
      fromAutoDig: true,
    };

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": result,
      "dungeonExcavation.revealedAt": serverTimestamp(),
      "dungeonExcavation.autoDigNextAt": null,
      ...(rolled.miniStreak === null ? {} : { "dungeonExcavation.miniBossStreak": rolled.miniStreak }),
    }).catch(() => {});
    _excavCache.delete(memberId);

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
      _excavCache.delete(memberId);
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
    _excavCache.delete(memberId);
  } catch (e) {
    console.warn("addExcavationByCheckin:", e?.message);
  }
}

/**
 * 射箭時增加發掘進度（每箭 +1）
 * 由 addRoundArrows 內部呼叫（動態 import）。
 *
 * 舊版 addExcavationByArrows 自己 getDoc+updateDoc/setDoc；新版改為「只計算 patch，不自己寫入」，
 * 由呼叫端（db.js::addRoundArrows）把 patch 併進同一次 updateDoc，同時用 _excavCache 避免每箭都重讀整份文件。
 * 回傳 { patch } 給呼叫端 merge 進 members/{id} 的 updateDoc；沒有需要更新時回傳 null。
 */
export async function computeExcavationPatch(memberId, arrowCount) {
  if (!memberId || !arrowCount || arrowCount <= 0) return null;
  try {
    const excavation = await readExcavationCached(memberId);
    if (!excavation) return null;
    if ((excavation.progress || 0) >= 100) return null;

    const today = todayStr();
    const lastActive = excavation.lastActiveDate || "";

    let newProgress, newDailyArrowsUsed;
    if (lastActive !== today) {
      // 換日：沿用舊版 setDoc 分支的算法（progress 封頂在 100，dailyArrowsUsed 重置為這次的箭數）
      newProgress = Math.min(100, (excavation.progress || 0) + Math.min(arrowCount, 100));
      newDailyArrowsUsed = arrowCount;
    } else {
      // 同一天：沿用舊版 updateDoc(increment(...)) 分支的算法（不額外封頂在 100，跟原本行為一致）
      newProgress = (excavation.progress || 0) + Math.min(arrowCount, 100);
      newDailyArrowsUsed = (excavation.dailyArrowsUsed || 0) + arrowCount;
    }

    const patch = {
      "dungeonExcavation.lastActiveDate": today,
      "dungeonExcavation.progress": newProgress,
      "dungeonExcavation.dailyArrowsUsed": newDailyArrowsUsed,
    };

    // 算完立刻寫回快取（不是刪除逼下次重讀），讓同一場戰鬥後續每一發箭都只讀記憶體
    _excavCache.set(memberId, {
      ...excavation,
      lastActiveDate: today,
      progress: newProgress,
      dailyArrowsUsed: newDailyArrowsUsed,
      ts: Date.now(),
    });

    return { patch };
  } catch (e) {
    console.warn("computeExcavationPatch:", e?.message);
    return null;
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

export const CAT_DIG_SPECIALTIES = {
  daming:   { id: "daming",   name: "大娘", type: "family", family: "ghost",     icon: "👻", label: "幽冥系專精", desc: "揭曉時大幅提升幽冥系地下城出現率" },
  gege:     { id: "gege",     name: "哥哥", type: "family", family: "mountain",  icon: "⛰️", label: "山嶺系專精", desc: "揭曉時大幅提升山嶺系地下城出現率" },
  meimei:   { id: "meimei",   name: "妹妹", type: "family", family: "insect",    icon: "🦋", label: "昆蟲系專精", desc: "揭曉時大幅提升昆蟲系地下城出現率" },
  niuniu:   { id: "niuniu",   name: "妞妞", type: "family", family: "workplace", icon: "💼", label: "職場系專精", desc: "揭曉時大幅提升職場系地下城出現率" },
  haji:     { id: "haji",     name: "哈吉", type: "family", family: "exam",      icon: "📝", label: "考試系專精", desc: "揭曉時大幅提升考試系地下城出現率" },
  baobao:   { id: "baobao",   name: "寶寶", type: "family", family: "temple",    icon: "🏛️", label: "神廟系專精", desc: "揭曉時大幅提升神廟系地下城出現率" },
  youyou:   { id: "youyou",   name: "悠悠", type: "family", family: "treasure",  icon: "📦", label: "寶藏系專精", desc: "揭曉時大幅提升寶箱族與隱藏地下城出現率" },
  xiaoan:   { id: "xiaoan",   name: "小安", type: "treasure", lootType: "coins_materials", icon: "💰", label: "財富喵喵", desc: "揭曉時額外帶回大量金幣與隨機材料包" },
  diandian: { id: "diandian", name: "點點", type: "treasure", lootType: "dew_crystals",    icon: "💧", label: "甘露喵喵", desc: "揭曉時額外帶回神聖箭露與罕見結晶" },
};

/**
 * 指派地下城陪練貓
 */
export async function assignDigCat(memberId, catId) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const data = snap.data();

    // 一隻貓同時只能在一個地方工作（戰鬥夥伴/遠征/建築工作/挖掘）——統一偵測
    if (catId) {
      const busy = catBusyElsewhere(data, catId, { job: "dig" });
      if (busy) return { ok: false, reason: catBusyReason(busy.job) };
    }

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.assignedCatId": catId || null,
    });
    _excavCache.delete(memberId);
    return { ok: true, assignedCatId: catId };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/**
 * 貓貓專屬揭曉地下城 (貓貓獨立進度條達 100% 時執行)
 */
export async function revealCatExcavation(memberId) {
  if (!memberId) return null;
  try {
    const snap = await getDoc(doc(db, "members", memberId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const excavation = data.dungeonExcavation || {};
    const catDigProgress = excavation.catDigProgress || 0;
    if (catDigProgress < 100) return null;

    const assignedCatId = excavation.assignedCatId || "baobao";
    const catSpec = CAT_DIG_SPECIALTIES[assignedCatId] || CAT_DIG_SPECIALTIES.baobao;
    const dailyArrows = excavation.dailyArrowsUsed || 0;

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
    let isHidden = Math.random() < (catSpec?.family === "treasure" ? 0.35 : 0.05);
    let family = isHidden
      ? "treasure"
      : (catSpec?.type === "family" && catSpec.family && catSpec.family !== "treasure")
        ? (Math.random() < 0.85 ? catSpec.family : FAMILIES[Math.floor(Math.random() * FAMILIES.length)])
        : FAMILIES[Math.floor(Math.random() * FAMILIES.length)];

    let extraBonus = null;
    if (catSpec?.type === "treasure") {
      if (catSpec.lootType === "coins_materials") {
        const bonusCoins = 1500 + Math.floor(Math.random() * 2000);
        extraBonus = { type: "coins_materials", coins: bonusCoins, label: `${catSpec.name} 挖掘時發現了 ${bonusCoins} 金幣與稀有材料！` };
        await updateDoc(doc(db, "members", memberId), { coins: increment(bonusCoins) }).catch(() => {});
      } else if (catSpec.lootType === "dew_crystals") {
        const bonusDew = 3 + Math.floor(Math.random() * 3);
        extraBonus = { type: "dew_crystals", dew: bonusDew, label: `${catSpec.name} 幫你凝結了 ${bonusDew} 滴神聖箭露！` };
        await updateDoc(doc(db, "members", memberId), { holyDew: increment(bonusDew) }).catch(() => {});
      }
    }

    const bossRunId = makeBossRunId(family);
    const rolled = isHidden
      ? { boss: drawTreasureKing(difficulty), bossEncounter: null, miniStreak: null }
      : rollExcavationBoss(difficulty, family, excavation, { runId: bossRunId });

    const result = {
      family,
      difficulty,
      isHidden,
      boss: rolled.boss,
      bossEncounter: rolled.bossEncounter,
      bossRunId,
      revealedAt: Date.now(),
      catBonus: extraBonus,
      fromCatDig: true,
      catName: catSpec.name,
    };

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.catDigProgress": 0,
      "dungeonExcavation.pendingReveal": result,
      "dungeonExcavation.revealedAt": serverTimestamp(),
    }).catch(() => {});
    // 陪練貓 XP 必須寫到 members/{id}/cats/{catId} 子集合（addCatXP），
    // 不能寫成 member 文件的 cats.X 欄位——那不但位置錯，cats 也不在白名單，會被規則整包擋掉。
    await addCatXP(memberId, assignedCatId, 150).catch(() => {});
    _excavCache.delete(memberId);

    return result;
  } catch (e) {
    console.warn("revealCatExcavation:", e?.message);
    return null;
  }
}

/**
 * 手動揭曉地下城（支援貓貓專長加成）
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
    const assignedCatId = excavation.assignedCatId || null;
    const catSpec = CAT_DIG_SPECIALTIES[assignedCatId] || null;

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
    let isHidden = Math.random() < (catSpec?.family === "treasure" ? 0.35 : 0.05); // 悠悠特長：隱藏地穴提升至 35%
    
    let family;
    if (isHidden) {
      family = "treasure";
    } else if (catSpec?.type === "family" && catSpec.family && catSpec.family !== "treasure") {
      // 專精貓貓：75% 出現該貓貓專精族系，25% 出現隨機種族
      family = Math.random() < 0.75 ? catSpec.family : FAMILIES[Math.floor(Math.random() * FAMILIES.length)];
    } else {
      family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];
    }

    // 尋寶貓貓加成獎勵計算
    let extraBonus = null;
    if (catSpec?.type === "treasure") {
      if (catSpec.lootType === "coins_materials") {
        const bonusCoins = 1000 + Math.floor(Math.random() * 2000);
        extraBonus = { type: "coins_materials", coins: bonusCoins, label: `小安挖到了 ${bonusCoins} 金幣與材料！` };
        await updateDoc(doc(db, "members", memberId), { coins: increment(bonusCoins) }).catch(() => {});
      } else if (catSpec.lootType === "dew_crystals") {
        const bonusDew = 2 + Math.floor(Math.random() * 4);
        extraBonus = { type: "dew_crystals", dew: bonusDew, label: `點點為你凝結了 ${bonusDew} 滴神聖箭露！` };
        await updateDoc(doc(db, "members", memberId), { holyDew: increment(bonusDew) }).catch(() => {});
      }
    }

    const bossRunId = makeBossRunId(family);
    const rolled = isHidden
      ? { boss: drawTreasureKing(difficulty), bossEncounter: null, miniStreak: null }
      : rollExcavationBoss(difficulty, family, excavation, { runId: bossRunId });
    const result = {
      family,
      difficulty,
      isHidden,
      boss: rolled.boss,
      bossEncounter: rolled.bossEncounter,
      bossRunId,
      revealedAt: Date.now(),
      catBonus: extraBonus,
    };

    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": result,
      "dungeonExcavation.revealedAt": serverTimestamp(),
      ...(rolled.miniStreak === null ? {} : { "dungeonExcavation.miniBossStreak": rolled.miniStreak }),
    }).catch(() => {});
    _excavCache.delete(memberId);

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
    // 沿用同一個 bossRunId：新難度的王是決定性的，升上去再降回來會拿到原本那隻，
    // 不能靠反覆升降級重抽（降級免費，否則就是無限刷王）
    const upgraded = rollExcavationBoss(newDifficulty, pending.family, data.dungeonExcavation, {
      runId: pending.bossRunId,
    });
    await updateDoc(doc(db, "members", memberId), {
      coins: increment(-cost),
      "dungeonExcavation.pendingReveal": {
        ...pending,
        difficulty: newDifficulty,
        boss: upgraded.boss,
        bossEncounter: upgraded.bossEncounter,
      },
    });
    _excavCache.delete(memberId);

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
    const downgraded = rollExcavationBoss(newDifficulty, pending.family, data.dungeonExcavation, {
      runId: pending.bossRunId, // 同上：沿用 runId，降級不能當作重抽王的手段
    });
    await updateDoc(doc(db, "members", memberId), {
      "dungeonExcavation.pendingReveal": {
        ...pending,
        difficulty: newDifficulty,
        boss: downgraded.boss,
        bossEncounter: downgraded.bossEncounter,
      },
    });
    _excavCache.delete(memberId);

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
    _excavCache.delete(memberId);
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
    _excavCache.delete(memberId);

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
    if (saved.length >= MAX_SAVED_DUNGEONS) return { ok: false, reason: `儲存槽已滿（最多 ${MAX_SAVED_DUNGEONS} 個）` };

    const newDungeon = {
      id: `d${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      family: pending.family,
      difficulty: pending.difficulty,
      isHidden: pending.isHidden || false,
      // pending 揭曉時就抽好王了，這裡只是防呆 fallback，不推進小王保底計數
      boss: pending.boss
        || rollExcavationBoss(pending.difficulty, pending.family, excavation, { runId: pending.bossRunId }).boss,
      // 王的身分必須跟著進儲存槽，否則遠征時會重抽，變成「預覽一隻、打到另一隻」
      bossEncounter: pending.bossEncounter || null,
      bossRunId: pending.bossRunId || null,
      fromAutoDig: pending.fromAutoDig || false,
      fromWorldBoss: pending.fromWorldBoss || false,
      // 領取地下城時就鎖定掉落倍率（2~5），不再等開房時隨機，避免重開房洗倍率
      lootMult: 2 + Math.floor(Math.random() * 4),
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
    _excavCache.delete(memberId);

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
    _excavCache.delete(memberId);
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
    _excavCache.delete(memberId);

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
    if ((excavation.savedDungeons || []).length >= MAX_SAVED_DUNGEONS)
      return { ok: false, reason: "儲存槽已滿，請先使用或移除已有地下城" };

    const FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
    const family = FAMILIES[Math.floor(Math.random() * FAMILIES.length)];
    const difficulty = 1 + Math.floor(Math.random() * 6); // 隨機 1~6

    const bossRunId = makeBossRunId(family);
    const rolled = rollExcavationBoss(difficulty, family, excavation, { runId: bossRunId });
    const newDungeon = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      family,
      difficulty,
      isHidden: false,
      boss: rolled.boss,
      bossEncounter: rolled.bossEncounter,
      bossRunId,
      fromWorldBoss: true,
      // 領取地下城時就鎖定掉落倍率（2~5），避免重開房洗倍率
      lootMult: 2 + Math.floor(Math.random() * 4),
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
          ...(rolled.miniStreak === null ? {} : { miniBossStreak: rolled.miniStreak }),
        },
      }, { merge: true }).catch(() => {});
    } else {
      await updateDoc(doc(db, "members", memberId), {
        "dungeonExcavation.savedDungeons": updatedSaved,
        "dungeonExcavation.scrolls": newScrolls,
        ...(rolled.miniStreak === null ? {} : { "dungeonExcavation.miniBossStreak": rolled.miniStreak }),
      }).catch(() => {});
    }
    _excavCache.delete(memberId);

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

    // 教練手動塞地下城：一樣要抽真正的王並存下 bossEncounter，
    // 否則遠征時戰鬥端會自行重抽，教練看到的和玩家打到的不是同一隻
    const bossRunId = dungeonEntry.bossRunId || makeBossRunId(dungeonEntry.family);
    const adminRolled = dungeonEntry.boss
      ? { boss: dungeonEntry.boss, bossEncounter: dungeonEntry.bossEncounter || null }
      : rollExcavationBoss(dungeonEntry.difficulty || 1, dungeonEntry.family, data.dungeonExcavation, { runId: bossRunId });
    const preparedEntry = {
      ...dungeonEntry,
      boss: adminRolled.boss,
      bossEncounter: adminRolled.bossEncounter,
      bossRunId,
    };
    let updated;
    if (index !== null && index >= 0 && index < saved.length) {
      updated = [...saved];
      updated[index] = { ...updated[index], ...preparedEntry };
    } else {
      if (saved.length >= MAX_SAVED_DUNGEONS) return { ok: false, reason: `儲存槽已滿（最多 ${MAX_SAVED_DUNGEONS} 個）` };
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
    _excavCache.delete(memberId);

    return { ok: true, savedDungeons: updated };
  } catch (e) {
    console.warn("adminSetSavedDungeon:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}
