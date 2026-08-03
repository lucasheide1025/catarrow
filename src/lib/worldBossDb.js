// src/lib/worldBossDb.js — 世界大 Boss Firestore 操作

import {
  collection, doc, addDoc, updateDoc, setDoc, onSnapshot,
  serverTimestamp, increment, getDoc, getDocs, query,
  where, orderBy, limit, arrayUnion, runTransaction,
} from "firebase/firestore";
import { grantWorldBossDungeon } from "./dungeonExcavation";
import { db } from "./firebase";
import app from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { assertCostCapability, COST_CAPABILITIES } from "./costControl";
import { addCoins, addMaterials, addChests, addCardPack, addWorldBossCard, addArrowdew, addArcherXP, createNotification } from "./db";
import { addCatXP, addCatBond } from "./catDb";
import { calcWorldBossRewards } from "./worldBossRewards";
import { COIN_CHEST_TIERS } from "./lootTable";
import {
  WORLD_BOSSES, WORLD_BOSS_KEYS, DEFAULT_REWARD, CONSOLATION_REWARD,
  LAST_HIT_EXTRA, BOSS_DURATION_MAX_DAYS, WB_FAMILY_TO_DUNGEON_FAMILY,
  buildKillAnnouncement, drawRandomBot, simulateBotRound, getRewardByBossKey,
  DROP_TABLE_BY_CATEGORY, getDropCategory, WB_CARD_DUPLICATE_COINS, WB_NO_CAT_COIN_RATE,
  // 🌍 貨幣改由三層整合模組決定（2026-08-03）：出席保底＋努力分潤＋名次榮譽
  WB_TROPHY_MAP,
} from "./worldBossData";
import { findPendingWorldBossEvents, normalizeWorldBossState } from "./worldBossState";

// 怪物階級順序，對照 T1~T6（index 0 = T1）
const MONSTER_TIER_ORDER = ["common", "rare", "elite", "fierce", "boss", "mythic"];
// 材料寶箱型別對照（itemData.js CHEST_TYPES 只有5階，T5/T6 都對到 mythic）
const MATERIAL_CHEST_TYPE_BY_TIER = ["wood", "iron", "gold", "epic", "mythic", "mythic"];
const ALL_DUNGEON_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];

function randTierNameInRange([min, max]) {
  const idx = (min - 1) + Math.floor(Math.random() * (max - min + 1));
  return MONSTER_TIER_ORDER[idx];
}

const WB  = "worldBossEvents";
const WBH = "worldBossHistory";
const WBSC = "worldBossSpawnCycles";
const WBSC_CURRENT = "current";
const WBSC_OPS = "worldBossSpawnOps";

export function subscribeWorldBossSpawnCycle(cb) {
  return onSnapshot(doc(db, WBSC, WBSC_CURRENT), snap => cb(snap.exists() ? { id:snap.id, ...snap.data() } : null), () => cb(null));
}

// ⚠️ 客戶端的 beginWorldBossSpawnCycle 已於 2026-08-03 刪除。
//
//    它在王被擊倒的當下就把 worldBossSpawnCycles/current 寫掉，用的是**寫死的
//    預設值**（8 小時／48 小時／10000 箭），完全不讀 sysConfig/worldBossSpawn。
//    雲端的 ensureCycle 之後來看到 previousEventId 已經對上就直接跳過——
//    結果是**後台改重生設定永遠沒有效果**，客戶端每次都先寫且忽略設定。
//    這就是作者回報的「重生機制似乎是兩套卡在一起」。
//
//    現在改成擊倒後直接請雲端建週期（它會讀教練的設定），權威只有一套。

export async function contributeWorldBossSpawnProgress({ memberId, type, amount = 1, operationId }) {
  memberId = String(memberId || "");
  if (!memberId || !operationId || !["arrows", "dungeonClears", "monsterKills", "villageDice"].includes(type)) {
    return { ok:false, reason:"invalid_spawn_contribution" };
  }
  try {
    const result = await httpsCallable(getFunctions(app, "asia-east1"), "contributeWorldBossSpawnProgress")({
      memberId, type, amount, operationId,
    });
    return result.data;
  } catch (e) { return { ok:false, reason:e.message }; }
}

export async function ensureWorldBossLifecycle() {
  try {
    const result = await httpsCallable(getFunctions(app, "asia-east1"), "ensureWorldBossLifecycle")({});
    return result.data;
  } catch (e) { return { ok:false, reason:e.message }; }
}

export async function forceSpawnWorldBossFromCycle() {
  try {
    const result = await httpsCallable(getFunctions(app, "asia-east1"), "forceSpawnWorldBossFromCycle")({});
    return result.data;
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ⚠️ 客戶端的 trySpawnWorldBossFromCycle 已於 2026-08-03 刪除（本來就沒有人呼叫）。
//    生成的權威在 functions/worldBossLifecycle.js::trySpawn，由三個地方觸發：
//    大廳載入（ensureWorldBossLifecycle）、後台強制生成、以及排程。
//    ⚠️ **不要再在客戶端寫生成邏輯**，兩套同時寫同一份文件會雙重生成。

function taipeiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Older attack records used UTC. Keep that key readable so a player is never
// offered a second entry while the migration naturally replaces their record.
export function getWorldBossAttackDateKeys(date = new Date()) {
  return [...new Set([taipeiDateKey(date), date.toISOString().slice(0, 10)])];
}

// ── 即時訂閱當前活躍大 Boss ───────────────────────────────────
export function subscribeActiveWorldBoss(cb) {
  const q = query(collection(db, WB), where("status", "==", "active"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0];
    cb(normalizeWorldBossState({ id: d.id, ...d.data() }));
  });
}

// ── 「全體常駐訂閱」專用的極小狀態文件（2026-07-26 讀寫量稽核）────────────
//
// 問題：`subscribeActiveWorldBoss` 訂閱的是**完整王文件**，而每一次攻擊都在寫那份文件
// （bossCurrentHP、totalParticipants、participants 傷害榜）。Firestore 是「文件一變動就推給
// 所有訂閱者、每人計 1 次讀取」——而這支監聽**常駐在 MemberApp**（每個學生全程掛著）：
//   20 人在線、每人打 10 次 = 200 次寫入 → 200 × 20 = **4,000 次讀取**，全部只為了顯示一句
//   「世界王現身」。App 層其實只需要 status 與名字，HP 每次跳動它根本用不到。
//
// 解法：另存一份 `worldBossStatus/current`，**只在開場／被擊殺／結束時寫**（一場活動個位數次）。
// App 層訂閱這份小的；完整王文件只在戰鬥畫面內訂閱（那裡本來就要看 HP）。
//
// ⚠️ 需要 Firestore 規則（記得**手動貼到 Console**，CLI 會 403）：
//     match /worldBossStatus/{id} { allow read: if true; allow write: if request.auth != null; }
//   「擊殺」是由學生的攻擊觸發的，所以寫入權必須開給登入者。這份文件只有狀態與名字、
//   沒有經濟價值，被亂改最多是橫幅顯示錯誤。
// ⚠️ 規則還沒貼、或文件還不存在時，會**自動退回舊的完整訂閱**——功能不會壞，只是省不到。
const WBS = "worldBossStatus";
const WBS_DOC = "current";

async function writeWorldBossStatus(patch) {
  try {
    await setDoc(doc(db, WBS, WBS_DOC), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("writeWorldBossStatus:", e?.message);   // 寫不進去不影響主流程
  }
}

export function subscribeWorldBossStatus(cb) {
  let inner = null;                 // 退回舊訂閱時的 unsubscribe
  const fallback = () => {
    if (inner) return;
    inner = subscribeActiveWorldBoss(cb);
  };
  const unsubDoc = onSnapshot(
    doc(db, WBS, WBS_DOC),
    snap => {
      const d = snap.exists() ? snap.data() : null;
      if (!d || !d.eventId) { fallback(); return; }   // 還沒建立過（舊活動）→ 用舊方式
      if (inner) { inner(); inner = null; }
      cb(d.status === "active" || d.status === "defeated"
        ? {
          id: d.eventId, status: d.status,
          bossData: { name: d.bossName || "" },
          announcement: d.announcement || null,
          killReplay: d.killReplay || null,     // 全服擊倒重播（見 raidKill.buildKillPayload）
        }
        : null);
    },
    err => { console.warn("subscribeWorldBossStatus fallback:", err?.message); fallback(); },
  );
  return () => { unsubDoc?.(); inner?.(); };
}

// ── 訂閱最新一筆 Boss（active 或 defeated 皆包含，expired 排除）
export function subscribeLatestWorldBoss(cb) {
  const q = query(collection(db, WB), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0];
    const data = normalizeWorldBossState({ id: d.id, ...d.data() });
    if (data.status === "expired" || data.status === "cancelled") { cb(null); return; }
    cb(data);
  });
}

export function subscribeWorldBoss(eventId, cb) {
  return onSnapshot(doc(db, WB, eventId), snap => {
    if (snap.exists()) cb(normalizeWorldBossState({ id: snap.id, ...snap.data() }));
    else cb(null);
  });
}

// ── 後台建立活動 ──────────────────────────────────────────────
export async function createWorldBossEvent({ adminId, bossKey, durationDays, reward }) {
  try {
    const boss = WORLD_BOSSES[bossKey];
    if (!boss) return { ok: false, reason: "無效的 Boss" };

    const days    = Math.min(durationDays || 7, BOSS_DURATION_MAX_DAYS);
    const startAt = new Date();
    const endAt   = new Date(startAt.getTime() + days * 86400000);

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
      durationDays:  days,
      reward:        reward || getRewardByBossKey(bossKey),
      lastHitBy:     null,
      announcement:  null,
      totalParticipants: 0,
      participants:  {},
      createdBy:     adminId,
      createdAt:     serverTimestamp(),
      autoSpawned:   !reward, // 標記是否為系統自動刷新
    });
    await writeWorldBossStatus({ eventId: ref.id, status: "active", bossName: boss.name, announcement: null });
    return { ok: true, eventId: ref.id };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 世界王自動刷新設定（活動天數，後台可調，預設固定 30 天）───
const WB_SPAWN_CONFIG_DEFAULT = 30;

export async function getWorldBossSpawnConfig() {
  try {
    const snap = await getDoc(doc(db, "sysConfig", "worldBossSpawn"));
    return snap.exists() ? (snap.data().durationDays || WB_SPAWN_CONFIG_DEFAULT) : WB_SPAWN_CONFIG_DEFAULT;
  } catch { return WB_SPAWN_CONFIG_DEFAULT; }
}

export async function saveWorldBossSpawnConfig(durationDays, operatorId) {
  try {
    await setDoc(doc(db, "sysConfig", "worldBossSpawn"), {
      durationDays: Math.max(1, Math.min(BOSS_DURATION_MAX_DAYS, durationDays || WB_SPAWN_CONFIG_DEFAULT)),
      updatedAt: serverTimestamp(), updatedBy: operatorId || null,
    }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 自動刷新世界王（被擊殺隔天自動隨機產生新 Boss）────────────
// 呼叫時機：前端載入世界王頁面時（任何人皆可呼叫，內部防重複）
export async function autoSpawnWorldBoss() {
  return { ok:false, reason:"automatic_spawn_disabled" };
}

export async function getWorldBossCycleConfig() {
  try {
    const snap = await getDoc(doc(db, "sysConfig", "worldBossSpawn"));
    const data = snap.data() || {};
    return {
      restHours:Math.max(0, Number(data.restHours) || 8),
      deadlineHours:Math.min(48, Math.max(8, Number(data.deadlineHours) || 48)),
      targets:{
        arrows:Math.max(1, Number(data.targets?.arrows) || 10000),
        dungeonClears:Math.max(1, Number(data.targets?.dungeonClears) || 30),
        monsterKills:Math.max(1, Number(data.targets?.monsterKills) || 500),
        villageDice:Math.max(1, Number(data.targets?.villageDice) || 300),
      },
    };
  } catch {
    return { restHours:8, deadlineHours:48, targets:{ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 } };
  }
}

export async function saveWorldBossCycleConfig(config, operatorId) {
  try {
    const normalized = {
      restHours:Math.max(0, Math.min(48, Number(config?.restHours) || 8)),
      deadlineHours:Math.max(1, Math.min(48, Number(config?.deadlineHours) || 48)),
      targets:Object.fromEntries(
        ["arrows", "dungeonClears", "monsterKills", "villageDice"]
          .map(key => [key, Math.max(1, Math.floor(Number(config?.targets?.[key]) || 1))]),
      ),
    };
    normalized.deadlineHours = Math.max(normalized.restHours, normalized.deadlineHours);
    await setDoc(doc(db, "sysConfig", "worldBossSpawn"), {
      ...normalized, updatedAt:serverTimestamp(), updatedBy:operatorId || null,
    }, { merge:true });
    return { ok:true, config:normalized };
  } catch (e) { return { ok:false, reason:e.message }; }
}

export async function repairWorldBossTerminalState(eventId) {
  try {
    const ref = doc(db, WB, eventId);
    const repaired = await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const event = snap.data();
      if (event.status !== "defeated" || Number(event.bossCurrentHP) <= 0) return false;
      tx.update(ref, { bossCurrentHP:0 });
      return true;
    });
    return { ok:true, repaired };
  } catch (e) { return { ok:false, reason:e.message }; }
}

export async function getPendingWorldBossRewards(memberId, maxEvents = 100) {
  if (!memberId) return [];
  try {
    const snap = await getDocs(query(
      collection(db, WB),
      orderBy("createdAt", "desc"),
      limit(Math.max(1, Math.min(200, maxEvents))),
    ));
    return findPendingWorldBossEvents(
      snap.docs.map(entry => ({ id:entry.id, ...entry.data() })),
      memberId,
    );
  } catch { return []; }
}

// ── 每回合即時更新 Boss HP（讓大廳即時顯示）──────────────────
export async function updateWorldBossHP(eventId, newHP) {
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, WB, eventId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const current = snap.data();
      const hp = current.status === "defeated"
        ? 0
        : Math.min(Number(current.bossCurrentHP) || 0, Math.max(0, Number(newHP) || 0));
      tx.update(ref, { bossCurrentHP: hp });
    });
  } catch { /* silent */ }
}

// ── 攻擊大 Boss（每天一次，最多 5 回合 × 6 箭）────────────────
// roundResults = [{ arrows, dmg, crits }, ...] 最多 5 回合
// isGuest = true 時不寫 practiceLog
export async function attackWorldBoss({ eventId, memberId, memberName, weapon, roundResults, isGuest = false, accountType = "official", sessionSourceId = null, potionDmgMult = 1, bots = [], memberAtk = 10, memberDef = 0, memberHP = 0, killerStyle = "baobao", finishingArrow = null, killPayload = null,
  // ⚠️ 呼叫端如果自己會寫練習紀錄，**一定要傳 false**，否則同一次攻擊會被記兩筆。
  //    舊的 WorldBossAttack.jsx 自己寫一筆、這裡又寫一筆——原本因為這裡缺 date
  //    查詢撈不到才沒爆出來，補上 date 之後就會變成箭數翻倍。
  //    新的 RaidGate.jsx 沒有自己寫，靠的就是這一筆。（2026-08-03）
  logPractice = true }) {
  try {
    const eventRef  = doc(db, WB, eventId);
    const snap      = await getDoc(eventRef);
    if (!snap.exists()) return { ok: false, reason: "活動不存在" };
    const ev = snap.data();

    // expired 直接拒絕；defeated 允許繼續（讓本次傷害仍能領每日獎勵）
    if (ev.status === "expired") return { ok: false, reason: "活動已結束" };
    const alreadyDefeated = ev.status === "defeated";

    // 每日限一次
    const [today, ...legacyTodayKeys] = getWorldBossAttackDateKeys();
    const myPrev  = ev.participants?.[memberId];
    if ([today, ...legacyTodayKeys].includes(myPrev?.lastAttackedDate)) return { ok: false, reason: "今天已經攻擊過了" };

    // 計算玩家本次總傷害
    const totalDmg = roundResults.reduce((s, r) => s + (r.dmg || 0), 0) * potionDmgMult;

    // 計算機器人傷害
    let botTotalDmg = 0;
    const botLogs = [];
    for (const bot of bots) {
      let botDmg = 0;
      const botRounds = [];
      for (let i = 0; i < 5; i++) {
        const r = simulateBotRound(bot, ev.bossData.atk, ev.bossData.def, memberAtk || 80);
        botDmg += r.dmg;
        botRounds.push(r);
      }
      botTotalDmg += botDmg;
      botLogs.push({ botId: bot.id, label: bot.label, dmg: botDmg, rounds: botRounds });
    }

    const combinedDmg = Math.round(totalDmg + botTotalDmg);
    const committed = await runTransaction(db, async tx => {
      const freshSnap = await tx.get(eventRef);
      if (!freshSnap.exists()) throw new Error("活動不存在");
      const fresh = freshSnap.data();
      if (fresh.status === "expired") throw new Error("活動已結束");
      const freshPrev = fresh.participants?.[memberId];
      if ([today, ...legacyTodayKeys].includes(freshPrev?.lastAttackedDate)) throw new Error("今天已經攻擊過了");
      const wasDefeated = fresh.status === "defeated";
      const nextHP = wasDefeated ? 0 : Math.max(0, (Number(fresh.bossCurrentHP) || 0) - combinedDmg);
      const didDefeat = !wasDefeated && nextHP <= 0;
      const update = {
        [`participants.${memberId}`]: {
          name: memberName,
          weapon: weapon || "訪客弓組",
          totalDmg: (freshPrev?.totalDmg || 0) + combinedDmg,
          lastAttackedDate: today,
          sessions: arrayUnion({
            date: today, dmg: combinedDmg, playerDmg: Math.round(totalDmg),
            botDmg: botTotalDmg, rounds: roundResults.length,
          }),
          isGuest: !!isGuest,
          accountType: accountType || (isGuest ? "guest" : "official"),
          sessionSourceId: sessionSourceId || null,
          atk: memberAtk,
          def: memberDef || Math.round(memberAtk * 0.5),
          hp: memberHP || memberAtk * 5,
        },
        bossCurrentHP: nextHP,
      };
      if (!freshPrev) update.totalParticipants = increment(1);
      if (didDefeat) {
        const announcement = buildKillAnnouncement(memberName, weapon || "訪客弓組");
        update.status = "defeated";
        update.lastHitBy = { memberId, memberName, weapon: weapon || "訪客弓組", killerStyle: killerStyle || "baobao", finishingArrow: finishingArrow || null };
        update.announcement = announcement;
        update.defeatedAt = serverTimestamp();
      }
      tx.update(eventRef, update);
      return { ev:fresh, myPrev:freshPrev, alreadyDefeated:wasDefeated, newHP:nextHP, defeated:didDefeat, upd:update };
    });
    const { ev: committedEvent, newHP, defeated, upd } = committed;
    Object.assign(ev, committedEvent);
    const isLastHit = defeated;
    if (defeated) {
      // ⚠️ 擊倒重播放在**狀態小文件**上（作者 2026-07-31）：
      //    全服玩家原本就訂閱這一份，多帶一個欄位是零額外讀取。
      //    放在王文件上就要所有人訂閱整份王 → 那正是 changelog.md:310 的 4000 次讀取。
      writeWorldBossStatus({
        eventId, status:"defeated", bossName:ev.bossData?.name || "", announcement:upd.announcement,
        killReplay: killPayload || null,
      });
      createNotification({
        type:"worldboss",
        title:`⚔️ 世界王擊殺！${ev.bossData?.name || "Boss"} 已倒下！`,
        content:`${memberName || "英雄"} 給予最後一擊！全員功勛已發放 🎁`,
        targetMemberId:null,
      }).catch(() => {});
    }
    if (defeated) {
      // 讓**雲端**建立重生週期（它會讀 sysConfig 裡教練設定的休息時數／期限／目標）
      await ensureWorldBossLifecycle().catch(() => {});
      await addDoc(collection(db, WBH), {
        eventId, bossKey: ev.bossKey, bossName: ev.bossData?.name,
        result: "defeated", ts: serverTimestamp(), defeatedAt: serverTimestamp(),
        lastHitBy: upd.lastHitBy, announcement: upd.announcement,
        participants: { ...(ev.participants || {}), [memberId]: upd[`participants.${memberId}`] },
        totalParticipants: ev.totalParticipants,
      }).catch(() => {});
    }

    // ── 每日出戰獎勵（非訪客）──────────────────────────────
    let dailyReward = null;
    if (!isGuest && memberId) {
      const rewardCoins = 60;
      await addCoins(memberId, rewardCoins).catch(() => {});
      // 排行榜：世界王個人累計傷害
      await updateDoc(doc(db, "members", memberId), { worldBossDmgTotal: increment(Math.round(combinedDmg) || 0) }).catch(() => {});

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

    // 寫入練習日誌（非訪客，且呼叫端沒有自己寫）
    if (!isGuest && memberId && logPractice) {
      const { addPracticeLog } = await import("./db");
      const totalArrows = roundResults.reduce((s, r) => s + (r.arrows?.length || 0), 0);
      const totalScore  = roundResults.reduce((s, r) =>
        s + (r.arrows || []).reduce((a, b) => a + (b.score || 0), 0), 0);
      // ⚠️ `date` 與 `totalArrows` **不能少**：
      //    練習歷史用 orderBy("date","desc") 查，今日箭數用 where("date","==",today)——
      //    Firestore 會**直接跳過缺少排序欄位的文件**，不會報錯也不會有半點跡象。
      //    這筆本來只寫 arrows/score，所以世界王射的箭在歷史與今日箭數都是隱形的。
      //    （2026-08-03 追「數據不同步」時抓到）
      const todayStr = new Date().toISOString().slice(0, 10);
      await addPracticeLog(memberId, {
        date:        todayStr,
        source:      "worldboss",
        type:        "world_boss",
        bossKey:     ev.bossKey,
        bossName:    ev.bossData.name,
        dmg:         combinedDmg,
        totalArrows: totalArrows,
        total:       totalScore,
        // 舊欄位保留，避免既有畫面讀不到
        arrows:      totalArrows,
        score:       totalScore,
        note:        `挑戰世界大 Boss《${ev.bossData.name}》`,
      }).catch(() => {});
    }

    return { ok: true, dmg: combinedDmg, defeated, isLastHit, newHP, dailyReward, bossAlreadyDefeated: alreadyDefeated };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 結算定案（defeated 後任何參戰者的瀏覽器都可能呼叫，只寫事件本身+寫入歷史，
//    不再幫別人寫入 members 文件——實際發放改由每個人自己呼叫 claimWorldBossKillReward）──
export async function distributeWorldBossRewards(eventId) {
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false };
    const ev = snap.data();
    if (ev.rewardDistributed) return { ok: true }; // 防重複

    const participants = ev.participants || {};

    // 依傷害排行取前三名（訪客排除），存到事件文件供各自請領時查詢
    const top3Ids = Object.entries(participants)
      .filter(([, p]) => p.accountType === "official" || p.isGuest !== true)
      .map(([mid, p]) => ({ mid, dmg: p.totalDmg || 0 }))
      .sort((a, b) => b.dmg - a.dmg)
      .slice(0, 3)
      .map(p => p.mid);

    await updateDoc(doc(db, WB, eventId), { rewardDistributed: true, top3Ids });

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
      top3Ids,
    });

    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 參戰者自行請領世界王擊殺獎勵（每人各自寫自己的 members 文件，避免權限問題）──
// 均分獎勵 = 保底（既有5檔 base）+ 比例貨幣/寶箱/卡片/召喚卷（依 DROP_TABLE_BY_CATEGORY 四分類）。
// 排名加成（1st/2nd/3rd/尾刀）+ 專屬收藏獎盃，跟均分獎勵分開、疊加發放。
export async function claimWorldBossKillReward(memberId, eventId) {
  if (!memberId || !eventId) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false, reason: "活動不存在" };
    const ev = snap.data();
    if (!ev.rewardDistributed) {
      if (ev.status !== "defeated") return { ok: false, reason: "尚未結算" };
      const top3Ids = Object.entries(ev.participants || {})
        .filter(([, participant]) => participant.accountType === "official" || participant.isGuest !== true)
        .sort(([, a], [, b]) => (b.totalDmg || 0) - (a.totalDmg || 0))
        .slice(0, 3)
        .map(([id]) => id);
      await updateDoc(doc(db, WB, eventId), { rewardDistributed: true, top3Ids });
      ev.rewardDistributed = true;
      ev.top3Ids = top3Ids;
      // 首位玩家領取時才建立結算快照，讓新王出現後仍能保留一次待領獎勵。
      // 歷史只保留最新一場，因此下一場結算後會自然覆蓋這次待領狀態。
      await addDoc(collection(db, WBH), {
        eventId,
        bossKey: ev.bossKey,
        bossName: ev.bossData?.name || WORLD_BOSSES[ev.bossKey]?.name || "世界王",
        result: "defeated",
        ts: serverTimestamp(),
        defeatedAt: ev.defeatedAt || serverTimestamp(),
        lastHitBy: ev.lastHitBy || null,
        announcement: ev.announcement || null,
        participants: ev.participants || {},
        totalParticipants: ev.totalParticipants || Object.keys(ev.participants || {}).length,
        top3Ids,
      }).catch(() => {});
    }
    const mine = ev.participants?.[memberId];
    if (!mine || (mine.isGuest === true && mine.accountType !== "official")) return { ok: false, reason: "此帳號沒有世界王結算資格" };
    if (mine.claimed) return { ok: false, reason: "already_claimed" };

    const boss = WORLD_BOSSES[ev.bossKey] || {};
    const category = getDropCategory(boss);
    const dropCfg = DROP_TABLE_BY_CATEGORY[category] || DROP_TABLE_BY_CATEGORY.family_big;
    const isFamilyBoss = category === "family_small" || category === "family_big";
    const dungeonFamily = isFamilyBoss ? WB_FAMILY_TO_DUNGEON_FAMILY[boss.family] : null;

    const summary = {
      coins: 0, arrowDew: 0, archerXP: 0, catXP: 0, bond: 0,
      coinChests: 0, materialChests: 0, catBoxes: 0, mimiBoxes: 0, cardPacks: 0,
      scrolls: 0, wbCard: null, wbCardDuplicateCoins: 0, trophy: null, rank: null,
      participation: null, effort: null,
    };

    // ── 貨幣：三層整合（2026-08-03）────────────────────────────
    // ⚠️ 舊版是「pool × 自己傷害/總傷害，下限 1 金幣」——幫忙的人等於沒獎勵，
    //    而且人越多每人越少。新的算法在 worldBossRewards.js，理念寫成測試守著：
    //      出席保底（不看傷害、不被稀釋）＋ 努力分潤（√傷害 × 出席天數）＋ 名次榮譽
    const allRewards = calcWorldBossRewards(ev.participants || {}, category, {
      top3Ids: ev.top3Ids || [],
      lastHitBy: ev.lastHitBy?.memberId || null,
    });
    const myReward = allRewards[memberId];
    if (!myReward) return { ok: false, reason: "此帳號沒有世界王結算資格" };
    summary.participation = myReward.participation;
    summary.effort = myReward.effort;

    const owed = myReward.total;
    // 貓咪經驗/羈絆值：讀取結算當下裝備哪隻貓，有裝備才給，沒裝備改發等值金幣
    const memberSnap    = await getDoc(doc(db, "members", memberId));
    const equippedCatId = memberSnap.data()?.equippedCat?.catId || null;

    let coinsToGive = owed.coins || 0;
    if (equippedCatId) {
      if (owed.catXP > 0) { await addCatXP(memberId, equippedCatId, owed.catXP).catch(() => {}); summary.catXP += owed.catXP; }
      if (owed.bond > 0)  { await addCatBond(memberId, equippedCatId, "worldboss", owed.bond).catch(() => {}); summary.bond += owed.bond; }
    } else {
      coinsToGive += ((owed.catXP || 0) + (owed.bond || 0)) * WB_NO_CAT_COIN_RATE;
    }
    if (coinsToGive > 0)    { await addCoins(memberId, coinsToGive).catch(() => {});        summary.coins    += coinsToGive; }
    if (owed.arrowDew > 0)  { await addArrowdew(memberId, owed.arrowDew).catch(() => {});   summary.arrowDew += owed.arrowDew; }
    if (owed.archerXP > 0)  { await addArcherXP(memberId, owed.archerXP).catch(() => {});   summary.archerXP += owed.archerXP; }
    if (owed.gachaCoins > 0) {
      const { addGachaCoins } = await import("./db");
      await addGachaCoins(memberId, owed.gachaCoins).catch(() => {});
    }

    // ── 寶箱組裝 ─────────────────────────────────────────────
    const chests = [];
    if (isFamilyBoss) {
      // 六族小王/大王：該族 T1~T3 或 T4~T6 材料寶箱，不掉金幣寶箱（比例貨幣已含金幣）
      const tierName = randTierNameInRange(dropCfg.chestTierRange);
      const chestType = MATERIAL_CHEST_TYPE_BY_TIER[MONSTER_TIER_ORDER.indexOf(tierName)];
      chests.push({
        id: `wb_mat_${memberId}_${Date.now()}`, type: chestType, family: dungeonFamily, tier: tierName,
        from: `世界王均分獎勵（${boss.name || "?"}）`, ts: Date.now(),
      });
      summary.materialChests += 1;
    } else {
      // 貓貓/教練：T?~T6 金幣寶箱 × count（隨機階級）
      const { count, tierRange } = dropCfg.coinChests;
      for (let i = 0; i < count; i++) {
        const tierName = randTierNameInRange(tierRange);
        const info = COIN_CHEST_TIERS[tierName] || COIN_CHEST_TIERS.common;
        chests.push({
          id: `wb_coin_${memberId}_${Date.now()}_${i}`, type: "coin", family: "worldboss", tier: tierName,
          min: info.min, max: info.max, from: `世界王均分獎勵（${boss.name || "?"}）`, ts: Date.now(),
        });
      }
      summary.coinChests += count;
      if (category === "coach") {
        // 教練限定：六族材料寶箱 T1~T6 隨機10個，族別隨機
        const { count: matCount, tierRange: matRange } = dropCfg.materialChests;
        for (let i = 0; i < matCount; i++) {
          const tierName = randTierNameInRange(matRange);
          const chestType = MATERIAL_CHEST_TYPE_BY_TIER[MONSTER_TIER_ORDER.indexOf(tierName)];
          const randFam = ALL_DUNGEON_FAMILIES[Math.floor(Math.random() * ALL_DUNGEON_FAMILIES.length)];
          chests.push({
            id: `wb_coachmat_${memberId}_${Date.now()}_${i}`, type: chestType, family: randFam, tier: tierName,
            from: `世界王均分獎勵（${boss.name || "?"}）`, ts: Date.now(),
          });
        }
        summary.materialChests += matCount;
      }
    }
    if (dropCfg.mimiBoxes > 0) {
      for (let i = 0; i < dropCfg.mimiBoxes; i++) {
        chests.push({ id: `wb_mimi_${memberId}_${Date.now()}_${i}`, type: "mimi_box", family: "worldboss", tier: "boss", from: "世界王均分獎勵", ts: Date.now() });
      }
      summary.mimiBoxes += dropCfg.mimiBoxes;
    }
    if ((dropCfg.catBoxChance || 0) > 0 && Math.random() < dropCfg.catBoxChance) {
      chests.push({ id: `wb_cat_${memberId}_${Date.now()}`, type: "cat_box", family: "worldboss", tier: "boss", from: "世界王均分獎勵", ts: Date.now() });
      summary.catBoxes += 1;
    }
    if (chests.length > 0) await addChests(memberId, chests).catch(() => {});

    // 一般怪物卡包（貓貓/教練限定，1~3隨機）
    if (dropCfg.cardPacksRange) {
      const [min, max] = dropCfg.cardPacksRange;
      const n = min + Math.floor(Math.random() * (max - min + 1));
      await addCardPack(memberId, n).catch(() => {});
      summary.cardPacks += n;
    }

    // ── 世界王卡：擊殺結算當下直接判定，重複已擁有則改發金幣 ──
    if (ev.bossKey && Math.random() < (dropCfg.wbCardChance || 0)) {
      const res = await addWorldBossCard(memberId, ev.bossKey, null).catch(() => ({ ok: false }));
      if (res?.ok) summary.wbCard = ev.bossKey;
      else if (res?.reason === "已擁有此王卡") {
        await addCoins(memberId, WB_CARD_DUPLICATE_COINS).catch(() => {});
        summary.coins += WB_CARD_DUPLICATE_COINS;
        summary.wbCardDuplicateCoins += WB_CARD_DUPLICATE_COINS;
      }
    }

    // 世界王地下城召喚卷：人人都有
    for (let i = 0; i < (dropCfg.scrolls || 0); i++) await grantWorldBossDungeon(memberId).catch(() => {});
    summary.scrolls += dropCfg.scrolls || 0;

    // ── 排名加成（疊加，不取代均分獎勵）──────────────────────
    const isLastHit = ev.lastHitBy?.memberId === memberId;
    const isTop3    = (ev.top3Ids || []).includes(memberId);
    const rank      = (ev.top3Ids || []).indexOf(memberId) + 1; // 1/2/3，找不到是0
    let trophy = null;

    // ⚠️ 名次的**貨幣**已經在上面的 owed 裡一次發完（榮譽層也算在 total 內），
    //    這裡只補發名次的**箱子**，不要重複發金幣／箭露／抽獎幣。
    const honor = myReward.honor || {};
    if (rank >= 1 && rank <= 3) { summary.rank = rank; trophy = "top3"; }
    if (isLastHit) trophy = "lastHit";
    if (honor.catBoxes > 0 || honor.mimiBoxes > 0) {
      const honorChests = [];
      const label = isLastHit && rank < 1 ? "世界王尾刀榮譽" : `世界王第${rank || "?"}名榮譽`;
      for (let i = 0; i < (honor.catBoxes  || 0); i++) honorChests.push({ id: `wb_honor_cat_${memberId}_${Date.now()}_${i}`,  type: "cat_box",  family: "worldboss", tier: "boss", from: label, ts: Date.now() });
      for (let i = 0; i < (honor.mimiBoxes || 0); i++) honorChests.push({ id: `wb_honor_mimi_${memberId}_${Date.now()}_${i}`, type: "mimi_box", family: "worldboss", tier: "boss", from: label, ts: Date.now() });
      await addChests(memberId, honorChests).catch(() => {});
      summary.catBoxes  += honor.catBoxes  || 0;
      summary.mimiBoxes += honor.mimiBoxes || 0;
    }

    // ── 專屬收藏獎盃（跟排名加成疊加，純收藏+成就用）───────────
    if (isLastHit) {
      const t = WB_TROPHY_MAP[`${ev.bossKey}_lasthit_trophy`];
      if (t) await updateDoc(doc(db, "members", memberId), { [`dungeonCollectibles.${t.id}`]: increment(1) }).catch(() => {});
    }
    if (rank >= 1 && rank <= 3) {
      const t = WB_TROPHY_MAP[`${ev.bossKey}_top3_trophy`];
      if (t) await updateDoc(doc(db, "members", memberId), { [`dungeonCollectibles.${t.id}`]: increment(1) }).catch(() => {});
    }
    summary.trophy = trophy;

    await updateDoc(doc(db, WB, eventId), { [`participants.${memberId}.claimed`]: true });
    const historySnap = await getDocs(query(collection(db, WBH), where("eventId", "==", eventId), limit(5))).catch(() => null);
    if (historySnap) for (const historyDoc of historySnap.docs) {
      await updateDoc(historyDoc.ref, { [`participants.${memberId}.claimed`]: true }).catch(() => {});
    }
    return { ok: true, reward: summary, trophy };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 只產生領獎前預覽，不寫入玩家資料；隨機王卡會在確認領取時才判定。
export async function previewWorldBossKillReward(memberId, eventId) {
  try {
    const snap = await getDoc(doc(db, WB, eventId));
    if (!snap.exists()) return { ok: false, reason: "活動不存在" };
    const ev = snap.data();
    const mine = ev.participants?.[memberId];
    if (!mine || (mine.isGuest === true && mine.accountType !== "official") || mine.claimed) return { ok: false, reason: "無可領取獎勵" };
    const boss = WORLD_BOSSES[ev.bossKey] || {};
    const cfg = DROP_TABLE_BY_CATEGORY[getDropCategory(boss)] || DROP_TABLE_BY_CATEGORY.family_big;
    const totalDamage = Object.values(ev.participants || {}).reduce((s, p) => s + (p.totalDmg || 0), 0) || 1;
    const share = pool => Math.max(1, Math.round((pool || 0) * ((mine.totalDmg || 0) / totalDamage)));
    const base = ev.reward?.base || {};
    const rank = (ev.top3Ids || []).indexOf(memberId) + 1;
    return { ok: true, preview: true, reward: {
      coins: (base.coins || 0) + share(cfg.coinsPool),
      arrowDew: share(cfg.arrowDewPool), archerXP: share(cfg.archerXPPool),
      catXP: share(cfg.catXPPool), bond: share(cfg.bondPool),
      coinChests: cfg.coinChests?.count || 0, materialChests: getDropCategory(boss).startsWith("family_") ? 1 : 0,
      catBoxes: cfg.catBoxChance ? 1 : 0, mimiBoxes: cfg.mimiBoxes || 0,
      cardPacks: cfg.cardPacksRange ? `${cfg.cardPacksRange[0]}~${cfg.cardPacksRange[1]}` : 0,
      scrolls: cfg.scrolls || 0, wbCardChance: cfg.wbCardChance || 0, rank: rank > 0 ? rank : null,
    }};
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
    await writeWorldBossStatus({ eventId: null, status: "expired", bossName: ev.bossData?.name || "" });

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

// ── 後台直接移除（不發任何獎勵、不記錄到歷史，用於建錯王/測試用王要立刻撤掉）──
// 跟 expireWorldBossEvent（時間到→安慰獎）不同：這個是教練主動取消，參戰者什麼都不會拿到
export async function forceEndWorldBossEvent(eventId) {
  try {
    await updateDoc(doc(db, WB, eventId), { status: "cancelled", cancelledAt: serverTimestamp() });
    await writeWorldBossStatus({ eventId: null, status: "cancelled" });
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
  assertCostCapability(COST_CAPABILITIES.bulkAdminWrites);
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
