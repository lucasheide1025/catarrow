// src/lib/worldBossDb.js — 世界大 Boss Firestore 操作

import {
  collection, doc, addDoc, updateDoc, setDoc, onSnapshot,
  serverTimestamp, increment, getDoc, getDocs, query,
  where, orderBy, limit, arrayUnion,
} from "firebase/firestore";
import { grantWorldBossDungeon } from "./dungeonExcavation";
import { db } from "./firebase";
import { addCoins, addMaterials, addChests, addCardPack, addWorldBossCard, addArrowdew, addArcherXP, createNotification } from "./db";
import { addCatXP, addCatBond } from "./catDb";
import { COIN_CHEST_TIERS } from "./lootTable";
import {
  WORLD_BOSSES, WORLD_BOSS_KEYS, DEFAULT_REWARD, CONSOLATION_REWARD,
  LAST_HIT_EXTRA, BOSS_DURATION_MAX_DAYS, WB_FAMILY_TO_DUNGEON_FAMILY,
  buildKillAnnouncement, drawRandomBot, simulateBotRound, getRewardByBossKey,
  DROP_TABLE_BY_CATEGORY, getDropCategory, WB_CARD_DUPLICATE_COINS, WB_NO_CAT_COIN_RATE,
  RANK_BONUS, WB_TROPHY_MAP,
} from "./worldBossData";

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
    if (data.status === "expired" || data.status === "cancelled") { cb(null); return; }
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
  try {
    // 查最新一筆
    const q = query(collection(db, WB), orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { ok: false, reason: "no_boss" };

    const latest = snap.docs[0].data();

    // 若仍 active → 不刷新
    if (latest.status === "active") return { ok: false, reason: "still_active" };

    // 已 defeated：判斷是否已過 24 小時
    if (latest.status === "defeated") {
      const defeatedAt = latest.defeatedAt?.toDate?.() || new Date(0);
      const hoursSince = (Date.now() - defeatedAt.getTime()) / 3600000;
      if (hoursSince < 24) return { ok: false, reason: "too_soon" };
    }

    // 防重複：最新一筆若已是今天建立的就跳過
    const createdAt = latest.createdAt?.toDate?.() || new Date(0);
    const today = new Date().toISOString().slice(0, 10);
    if (createdAt.toISOString().slice(0, 10) === today && latest.status === "active") {
      return { ok: false, reason: "already_today" };
    }

    // 隨機選一隻 Boss（排除上一隻，避免連續重複）
    const lastKey = latest.bossKey;
    const pool = WORLD_BOSS_KEYS.filter(k => k !== lastKey);
    const nextKey = pool[Math.floor(Math.random() * pool.length)];

    const durationDays = await getWorldBossSpawnConfig();
    return await createWorldBossEvent({ adminId: "system", bossKey: nextKey, durationDays });
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
export async function attackWorldBoss({ eventId, memberId, memberName, weapon, roundResults, isGuest = false, accountType = "official", sessionSourceId = null, potionDmgMult = 1, bots = [], memberAtk = 10, memberDef = 0, memberHP = 0, killerStyle = "baobao", finishingArrow = null }) {
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
        const r = simulateBotRound(bot, ev.bossData.atk, ev.bossData.def, memberAtk || 80);
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
        accountType: accountType || (isGuest ? "guest" : "official"),
        sessionSourceId: sessionSourceId || null,
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
        upd.lastHitBy    = { memberId, memberName, weapon: weapon || "訪客弓組", killerStyle: killerStyle || "baobao", finishingArrow: finishingArrow || null };
        upd.announcement = announcement;
        upd.defeatedAt   = serverTimestamp();
        createNotification({
          type: "worldboss",
          title: `⚔️ 世界王擊殺！${ev.bossData?.name || "Boss"} 已倒下！`,
          content: `${memberName || "英雄"} 給予最後一擊！全員功勛已發放 🎁`,
          targetMemberId: null,
        }).catch(() => {});
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
      .filter(([, p]) => !p.isGuest)
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
    if (!ev.rewardDistributed) return { ok: false, reason: "尚未結算" };
    const mine = ev.participants?.[memberId];
    if (!mine || mine.isGuest) return { ok: false, reason: "非參戰者" };
    if (mine.claimed) return { ok: false, reason: "already_claimed" };

    const boss = WORLD_BOSSES[ev.bossKey] || {};
    const category = getDropCategory(boss);
    const dropCfg = DROP_TABLE_BY_CATEGORY[category] || DROP_TABLE_BY_CATEGORY.family_big;
    const isFamilyBoss = category === "family_small" || category === "family_big";
    const dungeonFamily = isFamilyBoss ? WB_FAMILY_TO_DUNGEON_FAMILY[boss.family] : null;

    const reward = ev.reward || DEFAULT_REWARD;
    const base = reward.base || {};

    const summary = {
      coins: 0, arrowDew: 0, archerXP: 0, catXP: 0, bond: 0,
      coinChests: 0, materialChests: 0, catBoxes: 0, mimiBoxes: 0, cardPacks: 0,
      scrolls: 0, wbCard: null, wbCardDuplicateCoins: 0, trophy: null, rank: null,
    };

    // ── 保底（沿用既有5檔系統 base 部分）─────────────────────
    if (base.coins > 0) { await addCoins(memberId, base.coins).catch(() => {}); summary.coins += base.coins; }

    // ── 比例貨幣（依自己傷害佔全團總傷害% 分配，下限1）────────
    const totalDamage = Object.values(ev.participants || {}).reduce((s, p) => s + (p.totalDmg || 0), 0) || 1;
    const myDmgPct = (mine.totalDmg || 0) / totalDamage;
    const shareOf = pool => Math.max(1, Math.round((pool || 0) * myDmgPct));

    const coinsShare    = shareOf(dropCfg.coinsPool);
    const arrowDewShare = shareOf(dropCfg.arrowDewPool);
    const archerXPShare = shareOf(dropCfg.archerXPPool);
    await addCoins(memberId, coinsShare).catch(() => {});     summary.coins    += coinsShare;
    await addArrowdew(memberId, arrowDewShare).catch(() => {}); summary.arrowDew += arrowDewShare;
    await addArcherXP(memberId, archerXPShare).catch(() => {}); summary.archerXP += archerXPShare;

    // 貓咪經驗/羈絆值：讀取結算當下裝備哪隻貓，有裝備才給，沒裝備改發等值金幣
    const memberSnap    = await getDoc(doc(db, "members", memberId));
    const equippedCatId = memberSnap.data()?.equippedCat?.catId || null;
    const catXPShare  = shareOf(dropCfg.catXPPool);
    const bondShare   = shareOf(dropCfg.bondPool);
    if (equippedCatId) {
      await addCatXP(memberId, equippedCatId, catXPShare).catch(() => {});      summary.catXP += catXPShare;
      await addCatBond(memberId, equippedCatId, "worldboss", bondShare).catch(() => {}); summary.bond += bondShare;
    } else {
      const noCatCoins = (catXPShare + bondShare) * WB_NO_CAT_COIN_RATE;
      await addCoins(memberId, noCatCoins).catch(() => {}); summary.coins += noCatCoins;
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

    if (rank >= 1 && rank <= 3) {
      const rb = RANK_BONUS[rank];
      if (rb.coins)      { await addCoins(memberId, rb.coins).catch(() => {});         summary.coins    += rb.coins; }
      if (rb.arrowDew)   { await addArrowdew(memberId, rb.arrowDew).catch(() => {});    summary.arrowDew += rb.arrowDew; }
      if (rb.gachaCoins) { const { addGachaCoins } = await import("./db"); await addGachaCoins(memberId, rb.gachaCoins).catch(() => {}); }
      const rankChests = [];
      for (let i = 0; i < (rb.catBoxes  || 0); i++) rankChests.push({ id: `wb_rank_cat_${memberId}_${Date.now()}_${i}`,  type: "cat_box",  family: "worldboss", tier: "boss", from: `世界王第${rank}名獎勵`, ts: Date.now() });
      for (let i = 0; i < (rb.mimiBoxes || 0); i++) rankChests.push({ id: `wb_rank_mimi_${memberId}_${Date.now()}_${i}`, type: "mimi_box", family: "worldboss", tier: "boss", from: `世界王第${rank}名獎勵`, ts: Date.now() });
      if (rankChests.length > 0) await addChests(memberId, rankChests).catch(() => {});
      summary.catBoxes  += rb.catBoxes  || 0;
      summary.mimiBoxes += rb.mimiBoxes || 0;
      summary.rank = rank;
      trophy = "top3";
    }
    if (isLastHit) {
      const rb = RANK_BONUS.lastHit;
      if (rb.arrowDew) { await addArrowdew(memberId, rb.arrowDew).catch(() => {}); summary.arrowDew += rb.arrowDew; }
      if (rb.mimiBoxes > 0) {
        await addChests(memberId, [{ id: `wb_lasthit_mimi_${memberId}_${Date.now()}`, type: "mimi_box", family: "worldboss", tier: "boss", from: "世界王尾刀獎勵", ts: Date.now() }]).catch(() => {});
        summary.mimiBoxes += rb.mimiBoxes;
      }
      trophy = "lastHit";
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
    return { ok: true, reward: summary, trophy };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
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

// ── 後台直接移除（不發任何獎勵、不記錄到歷史，用於建錯王/測試用王要立刻撤掉）──
// 跟 expireWorldBossEvent（時間到→安慰獎）不同：這個是教練主動取消，參戰者什麼都不會拿到
export async function forceEndWorldBossEvent(eventId) {
  try {
    await updateDoc(doc(db, WB, eventId), { status: "cancelled", cancelledAt: serverTimestamp() });
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
