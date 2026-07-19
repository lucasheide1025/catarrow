// src/lib/partyDb.js — partyRooms 的所有 Firestore 操作
import {
  collection, doc, getDoc, addDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, arrayUnion, query, where, getDocs, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { assertCostCapability, COST_CAPABILITIES } from "./costControl";
import { addChests, recordBattleDex } from "./db";
import { CHEST_TYPES, makeChests, calcPotionBuffs, getPotion } from "./itemData";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";
import { resolveConsumable } from "./consumableSystem";
import { resolvePlayerCounter } from "./damage";
import { addPartyCombatStatus, applyPartyStatusesForRound, buildPartyAbilityPreview, resolvePartyMonsterAbility } from "./partyMonsterAbilityEngine";
import { buildPartyExpansionReward } from "./partyRewardEngine";
import { getPartyChallengeProfile } from "./monsterExpansionAdapter";
import { makeCoinChest } from "./lootTable";
import { stripUndefinedDeep } from "./firestoreSafeWrite";

const PARTY = "partyRooms";

// 技能發動的戰鬥訊息（左上角訊息列）。玩家原本只看到怪物「做了什麼」卻不知道結果，
// 這裡把「技能名 → 破解程度 → 實際後果」寫成一句話，權威端產生確保雙端一致。
const BREAK_TEXT = {
  full:    "🛡️ 完全破解，技能無效",
  major:   "💪 高分破解，威力大幅削弱",
  partial: "👍 部分破解，效果減半",
  none:    "💢 未能破解，全額生效",
};

function buildAbilityMessage({ monsterName, ability, targetName }) {
  const name = ability?.resolved?.name || ability?.scheduled?.name || "技能";
  const target = targetName ? `鎖定 ${targetName}` : "全隊";
  const level = ability?.resolved?.outcome?.level;
  const parts = [`⚡ ${monsterName} 發動「${name}」（${target}）`];
  if (level) parts.push(BREAK_TEXT[level] || BREAK_TEXT.none);
  const statuses = ability?.resolved?.statuses || [];
  if (statuses.length) {
    parts.push(`附加 ${statuses.map(s => s.name || s.id).join("、")}`);
  }
  if ((ability?.resolved?.selfShieldMaxHpPct || 0) > 0) parts.push("怪物展開護盾");
  if ((ability?.resolved?.delayedMult || 0) > 0) parts.push("蓄力中，下回合追加攻擊");
  return parts.join(" ｜ ");
}

// Keep the event selected before score entry so every player sees the same
// conditions and the server can resolve the exact same effect after reload.
function makeRoundEvent() {
  const event = shouldTriggerEvent() ? drawRandomEvent() : null;
  return event
    ? { id: event.id, icon: event.icon, title: event.title, desc: event.desc, type: event.type, effect: event.effect || {} }
    : null;
}

// 生成 6 碼大寫邀請碼（排除易混淆字元 0/O、1/I）
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// HP 倍率顯示範圍（用於大廳預覽）
export function partyHPRange(playerCount) {
  const extra = Math.max(0, playerCount - 1);
  return { min: 1 + extra * 0.5, max: 1 + extra * 1.0 };
}

// 開戰時一次性產生實際隨機倍率（每多一人 +0.5~1.0）
function genPartyHPMult(playerCount) {
  // 每多 1 人 → 怪物 HP+50%
  return 1.0 + Math.max(0, playerCount - 1) * 0.5;
}

// ── 建立房間（自動清除該使用者的舊 waiting 房間）────────────
export async function createPartyRoom(hostId, hostName, type, extraData = {}) {
  try {
    // 清除該使用者所有舊的 waiting 房間（防止前次 crash 殘留導致無法開房）
    const oldSnap = await getDocs(
      query(collection(db, PARTY), where("hostId", "==", hostId), where("status", "==", "waiting"))
    );
    await Promise.all(oldSnap.docs.map(d => deleteDoc(d.ref)));

    const code = genCode();
    const base = {
      code,
      type,           // "quest" | "battle"
      status: "waiting",
      hostId,
      createdAt: serverTimestamp(),
      members: {
        [hostId]: type === "quest"
          ? { name: hostName, accountType: extraData.accountType || "official", done: false, doneAt: null }
          : { name: hostName, accountType: extraData.accountType || "official", level: Number(extraData.level) || 1, hp: 0, maxHP: 0, atk: 0, def: 0, arrows: [], ready: false, skipped: false, alive: true, role: "front", rearChoice: null }
      },
    };
    if (type === "quest") {
      base.task = extraData.task || null;
      base.hostCheckinId = extraData.checkinId || null;
    }
    if (type === "battle") {
      Object.assign(base, {
        monster: null,
        monsterHP: 0,
        monsterMaxHP: 0,
        mode: "student",
        distanceMode: "preset",
        distance: 18,
        round: 1,
        log: [],
        result: null,
        processing: false,
      });
    }
    const ref = await addDoc(collection(db, PARTY), base);
    return { ok: true, roomId: ref.id, code };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 加入房間（用邀請碼） ───────────────────────────────────────
export async function joinPartyRoom(code, memberId, memberName, extraData = {}) {
  try {
    // 找出邀請碼符合的房間（client-side filter，房間數少可接受）
    const { getDocs, query, where, collection: col } = await import("firebase/firestore");
    const snap = await getDocs(
      query(col(db, PARTY), where("code", "==", code.toUpperCase()), where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok: false, reason: "找不到此邀請碼，或房間已開始/結束" };
    const roomDoc = snap.docs[0];
    const room = roomDoc.data();
    const memberCount = Object.keys(room.members || {}).length;
    if (room.type === "battle" && memberCount >= 8) return { ok: false, reason: "房間已滿（最多 8 人）" };
    if (room.type === "quest" && memberCount >= 4) return { ok: false, reason: "組隊任務房間最多 4 人" };

    const memberData = room.type === "quest"
      ? { name: memberName, accountType: extraData.accountType || "official", done: false, doneAt: null }
      : { name: memberName, accountType: extraData.accountType || "official", level: Number(extraData.level) || 1, hp: 0, maxHP: 0, atk: 0, def: 0, arrows: [], ready: false, skipped: false, alive: true, role: "front", rearChoice: null };

    await updateDoc(doc(db, PARTY, roomDoc.id), {
      [`members.${memberId}`]: memberData,
    });
    return { ok: true, roomId: roomDoc.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：等待室選擇初始角色（前衛/後衛）───────────────
// 已改為新模型：開場全員前衛，無上限；前衛倒下自動復活轉後衛
// 保留函式避免匯入端報錯，但不再被 UI 呼叫（等待室已移除選角步驟）
export async function setPartyMemberRole(roomId, memberId, role) {
  try {
    if (!["front", "rear"].includes(role)) return { ok: false, reason: "角色錯誤" };
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.role`]: role,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 即時訂閱房間 ──────────────────────────────────────────────
export function subscribePartyRoom(roomId, callback) {
  return onSnapshot(doc(db, PARTY, roomId), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

// ── Quest：更新自己的任務設定 ─────────────────────────────────
export async function updateQuestTask(roomId, memberId, taskDesc, distance) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.taskDesc`]: taskDesc,
      [`members.${memberId}.distance`]: distance,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Quest：標記完成 ────────────────────────────────────────────
export async function markQuestDone(roomId, memberId, done) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.done`]: done,
      [`members.${memberId}.doneAt`]: done ? serverTimestamp() : null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Quest：放棄任務 ────────────────────────────────────────────
export async function markQuestGaveUp(roomId, memberId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.gaveUp`]: true,
      [`members.${memberId}.gaveUpAt`]: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Quest：雙方完成 → 各發寶箱 ────────────────────────────────
// 寶箱型別加權：wood 50%, iron 30%, gold 15%, epic 4%, cat 1%
const QUEST_REWARD_TABLE = [
  { type: "wood",  w: 50 },
  { type: "iron",  w: 30 },
  { type: "gold",  w: 15 },
  { type: "epic",  w:  4 },
  { type: "cat",   w:  1 },
];
function drawQuestChest() {
  const total = QUEST_REWARD_TABLE.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of QUEST_REWARD_TABLE) { r -= e.w; if (r <= 0) return e.type; }
  return "wood";
}

export async function giveQuestRewards(roomId, memberIds) {
  try {
    const chestType = drawQuestChest();
    for (const mid of memberIds) {
      const chest = {
        id: `chest_quest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: chestType,
        family: "admin",
        tier: "rare",
        from: "組隊任務獎勵",
        ts: Date.now(),
      };
      await addChests(mid, [chest]);
    }
    await updateDoc(doc(db, PARTY, roomId), {
      status: "completed",
      rewardChestType: chestType,
    });
    return { ok: true, chestType };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 各模式對怪物的基礎倍率
const MODE_SCALE = {
  novice:  { hp: 1.5, atk: 1, def: 1 },
  student: { hp: 2.0, atk: 1, def: 1 },
  veteran: { hp: 4.0, atk: 2, def: 2 },
};

// ── Battle：房主設定怪物 & 開始 ───────────────────────────────
export async function startPartyBattle(roomId, room, monster, mode, distanceMode, distance, targetFormat = "full_110", battleBackground = "", targetInputMode = "button") {
  try {
    const memberIds = Object.keys(room.members || {});
    const playerCount = memberIds.length;
    const ms         = MODE_SCALE[mode] || MODE_SCALE.student;
    const extraMembers = playerCount - 1;
    const rewardMult = 1.0 + extraMembers * 0.2;    // 金幣/XP+20%/人
    // 挑戰強度（方案A,房主選）×人數加成（+10%/額外人,使用者規格,會顯示在房間）
    const challengeProfile = getPartyChallengeProfile(room.challengeLevel || "standard", playerCount);
    const hpMult     = challengeProfile.monsterStatMult;
    const monAtkMult = challengeProfile.monsterStatMult;
    const monDefMult = challengeProfile.monsterStatMult;
    // 先套模式基準（組隊 HP×2 步調）,再套 挑戰×人數 倍率
    const scaledHP = Math.round(monster.hp * ms.hp * hpMult);

    // 從 archerStats 計算每人初始 hp（這裡給預設值，實際由各 client 補寫自己的 stats）
    const membersUpdate = {};
    for (const mid of memberIds) {
      const m = room.members[mid];
      membersUpdate[`members.${mid}.arrows`] = [];
      membersUpdate[`members.${mid}.ready`]  = false;
      membersUpdate[`members.${mid}.skipped`] = false;
      membersUpdate[`members.${mid}.alive`]  = true;
      membersUpdate[`members.${mid}.role`] = "front";
      membersUpdate[`members.${mid}.rearChoice`] = null;
      membersUpdate[`members.${mid}.combatStatuses`] = [];
      membersUpdate[`members.${mid}.potionBuffs`] = { atkMult:1, defMult:1, dmgMult:1, families:{}, shield:0, regenPct:0 };
      // hp/atk/def 留給各 client 用 updateBattleMemberStats 寫入
      if (!m.maxHP) {
        membersUpdate[`members.${mid}.hp`]    = 500;
        membersUpdate[`members.${mid}.maxHP`] = 500;
        membersUpdate[`members.${mid}.atk`]   = 10;
        membersUpdate[`members.${mid}.def`]   = 10;
      }
    }

    await updateDoc(doc(db, PARTY, roomId), stripUndefinedDeep({
      ...membersUpdate,
      // ⚠️ 每個欄位都必須有預設值：Firestore 不接受 undefined，只要一個欄位是 undefined
      // 整筆寫入就會被拒絕（invalid-argument / HTTP 400），表現為「點開始戰鬥沒反應」。
      // 舊的 60 隻怪沒有 tierIndex / encounter / signature* 這些擴充欄位，一律補 null。
      monster: { id: monster.id, name: monster.name, icon: monster.icon || "👾",
                 hp:  scaledHP,
                 atk: Math.round(monster.atk * ms.atk * monAtkMult),
                 def: Math.round(monster.def * ms.def * monDefMult),
                 tier: monster.tier || "common",
                 tierIndex: monster.tierIndex ?? null,
                 family: monster.family || null,
                 encounter: monster.encounter || null,
                 signatureSkillId: monster.signatureSkillId || null,
                 signatureName: monster.signatureName || null,
                 signatureSummary: monster.signatureSummary || null,
                 counterSummary: monster.counterSummary || null, // 技能預告要顯示破解方式
                 commonSkillIds:monster.commonSkillIds || [], expansionVersion:monster.expansionVersion || 0 },
      monsterMaterialId: monster.materialId || null,
      monsterCardId: monster.cardId || monster.id,
      monsterHP: scaledHP,
      monsterMaxHP: scaledHP,
      hpMult, rewardMult,
      // 供全房 UI 顯示：強度檔位＋人數加成明細
      challengeLevel: room.challengeLevel || "standard",
      challengeProfile: {
        label: challengeProfile.label, memberCount: challengeProfile.memberCount,
        monsterBonusPct: challengeProfile.monsterBonusPct, monsterStatMult: challengeProfile.monsterStatMult,
        materialQty: challengeProfile.materialQty, cardChance: challengeProfile.cardChance,
        coinChestChance: challengeProfile.coinChestChance,
      },
      mode, distanceMode, distance, targetFormat, battleBackground,
      targetInputMode: targetInputMode === "target" ? "target" : "button",
      round: 1,
      // 第一回合只做 VS 進場與射擊，不插入回合事件。
      roundEvent: null,
      log: [],
      result: null,
      processing: false,
      consumableEffects: {},
      status: "active",
      monsterAbilityPreview: null,
    }));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：各玩家更新自己的 archerStats ─────────────────────
export async function updateBattleMemberStats(roomId, memberId, hp, maxHP, atk, def, archerStyle = "", catATK = 0, catName = "", catId = "", avatarId = "", wbBonus = null, displayName = "", level = 1, battleCosmetics = null) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.hp`]:      hp,
      [`members.${memberId}.maxHP`]:   maxHP,
      [`members.${memberId}.atk`]:     atk,
      [`members.${memberId}.def`]:     def,
      [`members.${memberId}.baseAtk`]: atk,
      [`members.${memberId}.baseDef`]: def,
      [`members.${memberId}.level`]:   Math.max(1, Number(level) || 1),
      ...(archerStyle ? { [`members.${memberId}.archerStyle`]: archerStyle } : {}),
      [`members.${memberId}.catATK`]:  catATK || 0,
      [`members.${memberId}.catName`]: catName || "",
      [`members.${memberId}.catId`]:   catId || "",
      [`members.${memberId}.avatarId`]: avatarId || "",
      ...(displayName ? { [`members.${memberId}.name`]: displayName } : {}),
      ...(wbBonus ? { [`members.${memberId}.wbBonus`]: wbBonus } : {}),
      ...(battleCosmetics ? { [`members.${memberId}.battleCosmetics`]: battleCosmetics } : {}),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Keep legacy / already-active rooms in sync without overwriting their live HP.
export async function updateBattleMemberLevel(roomId, memberId, level) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.level`]: Math.max(1, Number(level) || 1),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function updateBattleMemberCosmetics(roomId, memberId, battleCosmetics) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.battleCosmetics`]: battleCosmetics || null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function applyPartyCarryPotion(roomId, memberId, potionId) {
  const potion = getPotion(potionId);
  if (!potion || potion.kind !== "carry" || potion.futureFeature) return { ok:false, reason:"invalid potion" };
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, PARTY, roomId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("room not found");
      const room = snap.data();
      const member = room.members?.[memberId];
      const round = room.round || 1;
      if (room.status !== "active" || !member?.alive) throw new Error("battle not active");
      if (member.potionUsedRound === round) throw new Error("potion already used this round");
      const families = { ...(member.potionBuffs?.families || {}) };
      const current = getPotion(families[potion.family]);
      if (!current || (potion.level || 0) >= (current.level || 0)) families[potion.family] = potion.id;
      const buffs = calcPotionBuffs(Object.values(families));
      const maxHP = member.maxHP || 100;
      const updates = {
        [`members.${memberId}.potionUsedRound`]:round,
        [`members.${memberId}.potionBuffs`]:{
          families, atkMult:buffs.atkMult, defMult:buffs.defMult, dmgMult:buffs.dmgMult,
          regenPct:buffs.regenPct,
          shield:Math.max(member.potionBuffs?.shield || 0, Math.round(maxHP * (buffs.shieldPct || 0) / 100)),
        },
      };
      if (potion.effect?.hpPct) updates[`members.${memberId}.hp`] = Math.min(maxHP, (member.hp || 0) + Math.round(maxHP * potion.effect.hpPct / 100));
      tx.update(ref, updates);
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

export async function applyPartyUtilityPotion(roomId, memberId, potionId) {
  const potion = getPotion(potionId);
  if (!potion || potion.kind !== "throw" || potion.actionCost === "arrow" || potion.futureFeature) return { ok:false, reason:"invalid utility" };
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, PARTY, roomId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("room not found");
      const room = snap.data();
      const member = room.members?.[memberId];
      const round = room.round || 1;
      if (room.status !== "active" || !member?.alive) throw new Error("battle not active");
      if (member.potionUsedRound === round) throw new Error("potion already used this round");
      const effect = potion.effect || {};
      const updates = { [`members.${memberId}.potionUsedRound`]:round };
      if (effect.monAtkPct) updates["monster.atk"] = Math.max(1, Math.round((room.monster?.atk || 1) * (1 - effect.monAtkPct / 100)));
      if (effect.monDefPct) updates["monster.def"] = Math.max(0, Math.round((room.monster?.def || 0) * (1 - effect.monDefPct / 100)));
      if (effect.teamDmgPct) updates["consumableEffects.teamDmgMult"] = Math.max(room.consumableEffects?.teamDmgMult || 1, 1 + effect.teamDmgPct / 100);
      if (effect.skipRound === "big") updates["consumableEffects.skipCounterRound"] = round;
      if (effect.counterReducePct) updates["consumableEffects.counterReducePct"] = Math.min(70, (room.consumableEffects?.counterReducePct || 0) + effect.counterReducePct);
      tx.update(ref, updates);
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── Battle：送出箭分 ──────────────────────────────────────────
export async function submitArrows(roomId, memberId, arrows, role = "front", rearChoice = null) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.arrows`]:     arrows,
      [`members.${memberId}.ready`]:      true,
      // 曾被房主略過的旗標不能殘留到下一輪；正常送分一律清除。
      [`members.${memberId}.skipped`]:    false,
      [`members.${memberId}.role`]:       role,
      [`members.${memberId}.rearChoice`]: role === "rear" ? rearChoice : null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 隊友加油（任何人都可以發送，覆蓋上一則）──────────────────
export async function sendPartyCheer(roomId, fromName) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      cheer: { fromName, ts: Date.now() },
    });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// ── Battle：房主強制跳過斷線玩家（以空箭分 + ready=true 標記）──
export async function forceSkipPlayer(roomId, memberId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.arrows`]: [],
      [`members.${memberId}.ready`]:  true,
      [`members.${memberId}.skipped`]: true,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 房主進場時清除可能卡住的 processing（前次異常遺留）
export async function clearPartyProcessing(roomId) {
  try { await updateDoc(doc(db, PARTY, roomId), { processing: false }); } catch (_) {}
}

// ── Battle：房主處理回合（所有人 ready 後呼叫）───────────────
// calcDmgFn(arrows, atk, monsterDEF) → { dmg, crits } | number
// calcCtrFn(monsterATK, archerDEF)   → number
export async function processPartyRound(roomId, room, calcDmgFn, calcCtrFn) {
  try {
    // 手動「立即結算」可能在隊員離房或重新連線的瞬間觸發；不能使用 UI 傳入的舊快照。
    const freshSnap = await getDoc(doc(db, PARTY, roomId));
    if (!freshSnap.exists()) return { ok: false, reason: "room not found" };
    room = freshSnap.data();
    if (room.status !== "active") return { ok: false, reason: "room is not active" };
    if (room.processing) return { ok: false, reason: "already processing" };

    const freshAlive = Object.values(room.members || {}).filter(member => member.alive);
    if (!freshAlive.length || !freshAlive.every(member => member.ready)) {
      return { ok: false, reason: "waiting for active members" };
    }
    await updateDoc(doc(db, PARTY, roomId), { processing: true });

    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    const round    = room.round || 1;
    const arrowsPerRound = room.arrowsPerRound || 6;
    const partyAbility = room.monster?.expansionVersion === 1
      ? resolvePartyMonsterAbility({ roomId, monster:room.monster, round, members:room.members || {}, targetFmt: room.targetFormat || "full_110" })
      : null;
    const statusRoundByMember = Object.fromEntries(Object.entries(room.members || {}).map(([id, member]) => [id, applyPartyStatusesForRound(member)]));

    // 前後衛分類（undefined / "front" 都算前衛）
    const frontIds = aliveIds.filter(id => (members[id].role || "front") === "front");
    const rearIds  = aliveIds.filter(id => (members[id].role || "front") === "rear");

    function calcScorePct(arrows) {
      const sum = (arrows || []).reduce((s, a) => s + (a?.score || 0), 0);
      return Math.max(0, Math.min(1, sum / (arrowsPerRound * 10)));
    }

    // 後衛不再直接對怪物造成傷害：heal 選擇治癒隊友、dmg(預設) 選擇改成幫存活前衛加攻擊力
    // 兩者的池子都用「後衛本回合命中分數%」換算，均分給受益人數（比照地下城系統，見前後衛重構任務）
    let atkBuffPctForFront = 0;
    const rearScorePct = {};
    for (const id of rearIds) {
      const m = members[id];
      const scorePct = calcScorePct(m.arrows);
      rearScorePct[id] = scorePct;
      if (m.rearChoice !== "heal" && frontIds.length > 0) {
        atkBuffPctForFront += (scorePct * 0.25) / frontIds.length;
      }
    }

    // Step 1: 計算每人全部 6 箭（body part 在此決定，不可拆開分批算）
    const eventRaw = room.roundEvent || null;
    const eff = eventRaw?.effect || {};
    const event = eventRaw
      ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
      : null;
    const eventAtkMult = 1 + ((eff.archerATK || 0) / 100);
    const allPlayerData = {};
    for (const id of aliveIds) {
      const m      = members[id];
      const isRear = (m.role || "front") === "rear";
      const rearHeal = isRear && m.rearChoice === "heal";
      const rearBuff = isRear && !rearHeal;
      // 後衛的分數只決定治療／助攻強度，不會對怪物造成箭傷。
      if (isRear) {
        const scorePct = rearScorePct[id] || 0;
        allPlayerData[id] = {
          name: m.name || "射手",
          totalDmg: 0,
          crits: 0,
          arrowBreakdown: (m.arrows || []).map(a => ({
            label: a?.label || a, dmg: 0,
            partIcon: rearHeal ? "💚" : "🛡️",
            partName: rearHeal ? "治癒" : "助攻",
          })),
          rearHeal, rearBuff, scorePct,
        };
        continue;
      }
      const buffedAtk = Math.max(1, Math.round((m.baseAtk || m.atk || 10) * (statusRoundByMember[id]?.atkMultiplier || 1) * (m.potionBuffs?.atkMult || 1) * (1 + atkBuffPctForFront) * eventAtkMult));
      const damageItems = (m.arrows || []).filter(arrow => getPotion(arrow?.label || arrow)?.actionCost === "arrow");
      const scoreArrows = (m.arrows || []).filter(arrow => !getPotion(arrow?.label || arrow));
      const directDmg = damageItems.reduce((sum, arrow) => sum + (resolveConsumable(arrow?.label || arrow, {
        mode:"party", playerAtk:buffedAtk, enemyHp:room.monsterHP, enemyMaxHp:room.monster?.hp,
        isBoss:["boss","mythic"].includes(room.monster?.tier),
      }).damage || 0), 0);
      const raw = calcDmgFn(scoreArrows, buffedAtk, room.monster.def, m.wbBonus?.dmgBonusPct || 0);
      const rawDmg = typeof raw === "number" ? raw : (raw.dmg || 0);
      const rawBreakdown = [
        ...(typeof raw === "object" ? (raw.arrowBreakdown || []) : []),
        ...damageItems.map(arrow => ({ label:arrow?.label || arrow, dmg:resolveConsumable(arrow?.label || arrow, { mode:"party", playerAtk:buffedAtk, enemyHp:room.monsterHP, enemyMaxHp:room.monster?.hp, isBoss:["boss","mythic"].includes(room.monster?.tier) }).damage || 0, partName:"投擲道具", partIcon:getPotion(arrow?.label || arrow)?.icon || "💣" })),
      ];
      allPlayerData[id] = {
        name:           m.name || "射手",
        totalDmg:       Math.round((rawDmg + directDmg) * (m.potionBuffs?.dmgMult || 1) * (room.consumableEffects?.teamDmgMult || 1)),
        crits:          typeof raw === "number" ? 0 : (raw.crits || 0),
        arrowBreakdown: rawBreakdown,
        rearHeal, rearBuff, scorePct: isRear ? (rearScorePct[id] || 0) : 0,
      };
    }

    const poisonByMember = { ...(room.consumableEffects?.poisonByMember || {}) };
    for (const id of aliveIds) {
      const existing = poisonByMember[id];
      if (existing?.rounds > 0) {
        allPlayerData[id].totalDmg += existing.damage;
        poisonByMember[id] = { ...existing, rounds:existing.rounds - 1 };
      }
      const usedPoison = (members[id].arrows || []).some(arrow => (arrow?.label || arrow) === "throw_poison");
      if (usedPoison) {
        const atk = Math.round((members[id].baseAtk || members[id].atk || 10) * (members[id].potionBuffs?.atkMult || 1));
        poisonByMember[id] = { damage:Math.round(atk * 0.4), rounds:2 };
      }
    }

    // Step 2: 隨機事件（大回合開始時決定）
    const skipAllCtr = !!eff.skipCounter || room.consumableEffects?.skipCounterRound === round;

    // Step 3: 大回合制 — 每位玩家一個 mini-round 包含全部箭矢，前衛先後衛後，最後怪物反擊一次
    // 攻擊順序：前衛 → 後衛（動畫用）
    // 房主固定先手，其他人再依前／後衛順序出手，讓實際演出與規則一致。
    const orderedAliveIds = [
      ...(frontIds.includes(room.hostId) ? [room.hostId] : []),
      ...frontIds.filter(id => id !== room.hostId),
    ];
    const miniRounds  = [];
    let   monsterHP   = room.monsterHP || 0;
    if (partyAbility?.resolved?.monsterHealMaxHpPct) {
      monsterHP = Math.min(room.monsterMaxHP || monsterHP, monsterHP + Math.round((room.monsterMaxHP || monsterHP) * partyAbility.resolved.monsterHealMaxHpPct / 100));
    }
    if (eff.extraDmg) monsterHP = Math.max(0, monsterHP - eff.extraDmg);
    if (eff.monsterHP) monsterHP = Math.max(0, monsterHP + eff.monsterHP);
    const memberHPNow = {};
    // 若 hp 尚未寫入（stats 還沒到位），預設用 maxHP；避免誤判為陣亡
    for (const id of aliveIds) {
      const currentHp = statusRoundByMember[id]?.hp ?? (members[id].hp > 0 ? members[id].hp : (members[id].maxHP || 500));
      const adjustedHp = currentHp + (eff.archerHP || 0) + (eff.healArcher || 0);
      memberHPNow[id] = Math.max(0, Math.min(members[id].maxHP || adjustedHp, adjustedHp));
    }
    // 後衛支援先結算：治療在前衛出手前回復 HP，助攻已在前方 atkBuffPctForFront 套入。
    const receivedHeal = {};
    const healGivenBy = {};
    const supportLog = [];
    for (const id of rearIds) {
      const scorePct = rearScorePct[id] || 0;
      if (members[id].rearChoice === "heal") {
        const healBonusPct = members[id].wbBonus?.healBonusPct || 0;
        const pool = Math.round((members[id].maxHP || 100) * 0.15 * scorePct * (1 + healBonusPct));
        healGivenBy[id] = pool;
        const targets = frontIds.filter(tid => memberHPNow[tid] > 0);
        const perPerson = targets.length ? Math.round(pool / targets.length) : 0;
        for (const tid of targets) {
          receivedHeal[tid] = (receivedHeal[tid] || 0) + perPerson;
          memberHPNow[tid] = Math.min(members[tid].maxHP || 9999, memberHPNow[tid] + perPerson);
        }
        supportLog.push({ id, name: members[id].name || "後衛", kind:"heal", dmg:0, heal:pool, targets:targets.map(tid=>({id:tid,name:members[tid]?.name||"前衛",heal:perPerson})) });
      } else {
        supportLog.push({ id, name: members[id].name || "後衛", kind:"buff", dmg:0, buffPct:Math.round(scorePct * 25), targets:frontIds.map(tid=>({id:tid,name:members[tid]?.name||"前衛"})) });
      }
    }
    const ctrAccum    = {};
    let   bossKilled  = false;
    let   catRoundDmg = 0;

    const healSupportLog = supportLog.filter(item => item.kind === "heal");
    const buffSupportLog = supportLog.filter(item => item.kind === "buff");
    // 同時有兩種支援時，固定先治療、再助攻，讓前衛卡片依序演出。
    if (healSupportLog.length > 0) miniRounds.push({ miniRound:miniRounds.length+1, isSupport:true, supportKind:"heal", playerLog:healSupportLog, totalDmg:0, monsterHPAfter:monsterHP });
    if (buffSupportLog.length > 0) miniRounds.push({ miniRound:miniRounds.length+1, isSupport:true, supportKind:"buff", playerLog:buffSupportLog, totalDmg:0, monsterHPAfter:monsterHP });

    for (const id of orderedAliveIds) {
      if (bossKilled) break;
      if (memberHPNow[id] <= 0) continue;
      const pd = allPlayerData[id];
      const allArrows  = pd.arrowBreakdown.slice(0, arrowsPerRound);
      // `totalDmg` is the authoritative individual result after all personal
      // potion, poison, and team multipliers. Never replace it with a shared
      // round total when building the per-player animation log.
      const totalDmgP  = pd.totalDmg;
      const totalCrits = allArrows.filter(a => a.isCrit).length;
      monsterHP = Math.max(0, monsterHP - totalDmgP);
      miniRounds.push({
        miniRound:      miniRounds.length + 1,
        isCounter:      false,
        attackerId:     id,
        playerLog:      [{ id, name: pd.name, role: members[id].role || "front", dmg: totalDmgP, ctr: 0, arrowBreakdown: allArrows, crits: totalCrits }],
        totalDmg:       totalDmgP,
        monsterHPAfter: monsterHP,
      });
      if (monsterHP <= 0) { bossKilled = true; break; }
    }

    // 貓咪攻擊（三輪結束後 Boss 仍存活時）
    if (!bossKilled) {
      const catAttackers = aliveIds.filter(id => (members[id].catATK || 0) > 0 && memberHPNow[id] > 0);
      if (catAttackers.length > 0) {
        const catLog = [];
        for (const id of catAttackers) {
          const cATK  = members[id].catATK || 0;
          const cName = members[id].catName || "貓貓";
          let cDmg = 0;
          const cArrows = [];
          for (let i = 0; i < 2; i++) {
            const sc   = Math.max(5, Math.min(10, Math.round(7 + (Math.random() * 6 - 3))));
            const base = 8 + cATK * 0.7 + sc * 1.2 - (room.monster.def || 0) * 0.35;
            const mult = 0.85 + Math.random() * 0.3;
            const d    = Math.max(1, Math.round(base * mult));
            cDmg += d;
            cArrows.push({ label: String(sc), dmg: d, isCrit: mult > 1.1, partName: "貓爪", partIcon: "🐾" });
          }
          const skillTriggered = Math.random() < 0.25;
          const skillName = skillTriggered ? "連環貓掌" : null;
          const skillBonus = skillTriggered ? Math.max(1, Math.round(cDmg * 0.25)) : 0;
          cDmg += skillBonus;
          catRoundDmg += cDmg;
          catLog.push({ id, catId: members[id].catId || "diandian", name: `🐱${cName}`, dmg: cDmg, ctr: 0, arrowBreakdown: cArrows, crits: 0, isCat: true, skillTriggered, skillName, skillBonus });
        }
        monsterHP = Math.max(0, monsterHP - catRoundDmg);
        if (monsterHP <= 0) bossKilled = true;
        miniRounds.push({
          miniRound:      miniRounds.length + 1,
          isCounter:      false,
          isCat:          true,
          attackerId:     "__cats__",
          playerLog:      catLog,
          totalDmg:       catRoundDmg,
          monsterHPAfter: monsterHP,
        });
      }
    }

    const memberUpdates = {};
    // 最後怪物反擊：只打前衛；前衛全滅時才打全體
    if (!skipAllCtr && monsterHP > 0) {
      const allFrontDead = frontIds.every(id => memberHPNow[id] <= 0);
      const ctrTargets   = allFrontDead
        ? aliveIds.filter(id => memberHPNow[id] > 0)
        : frontIds.filter(id => memberHPNow[id] > 0);
      const ctrLog = [];
      for (const id of ctrTargets) {
        const mem = members[id];
        const effectiveDef = Math.round((mem?.baseDef || mem?.def || 10) * (statusRoundByMember[id]?.defMultiplier || 1) * (mem?.potionBuffs?.defMult || 1));
        const ctrCrit = Math.random() < 0.1;
        const abilityTargetsMember = !partyAbility?.targetId || partyAbility.targetId === id;
        const skillMult = abilityTargetsMember && partyAbility?.resolved?.skillDamageMult > 0 ? partyAbility.resolved.skillDamageMult : 1;
        const rawCtr = Math.ceil(calcCtrFn(room.monster.atk, effectiveDef, mem?.wbBonus?.dmgReducePct || 0, ctrCrit) * skillMult * (1 - (room.consumableEffects?.counterReducePct || 0) / 100));
        const counterHit = resolvePlayerCounter({ arrows:mem?.arrows || [], baseDamage:rawCtr, maxHP:mem?.maxHP || memberHPNow[id] });
        const absorbed = Math.min(mem?.potionBuffs?.shield || 0, counterHit.damage);
        const ctr = counterHit.damage - absorbed;
        memberUpdates[`members.${id}.potionBuffs.shield`] = Math.max(0, (mem?.potionBuffs?.shield || 0) - absorbed);
        ctrAccum[id]    = (ctrAccum[id] || 0) + ctr;
        memberHPNow[id] = Math.max(0, memberHPNow[id] - ctr);
        ctrLog.push({ id, name: mem.name || "射手", dmg: 0, ctr, ctrCrit, hitPart:counterHit.part, averageScore:counterHit.averageScore });
      }
      miniRounds.push({
        miniRound:      miniRounds.length + 1,
        isCounter:      true,
        playerLog:      ctrLog,
        totalDmg:       0,
        monsterHPAfter: monsterHP,
      });
    }

    // 後衛治癒：池子 = maxHP × 15% × 命中分數%，均分給存活隊友（比照地下城系統）
    const resolvedSupportLog = [];
    for (const id of []) {
      if (members[id].rearChoice !== "heal") continue;
      const scorePct = rearScorePct[id] || 0;
      const healBonusPct = members[id].wbBonus?.healBonusPct || 0;
      const pool    = Math.round((members[id].maxHP || 100) * 0.15 * scorePct * (1 + healBonusPct));
      healGivenBy[id] = pool;
      if (pool <= 0) continue;
      const targets = aliveIds.filter(t => t !== id && memberHPNow[t] > 0);
      if (!targets.length) continue;
      const perPerson = Math.round(pool / targets.length);
      for (const tid of targets) receivedHeal[tid] = (receivedHeal[tid] || 0) + perPerson;
      resolvedSupportLog.push({
        id,
        name: members[id].name || "後衛",
        dmg: 0,
        heal: pool,
        targets: targets.map(tid => ({ id: tid, name: members[tid]?.name || "隊友", heal: perPerson })),
      });
    }

    for (const id of []) {
      if (members[id].rearChoice === "heal") continue;
      resolvedSupportLog.push({
        id,
        name: members[id].name || "後衛",
        dmg: 0,
        buffPct: Math.round((rearScorePct[id] || 0) * 25),
      });
    }

    // 支援已在前衛出手前加入 miniRounds；這裡不再重複結算。

    // Step 4: 套用事件額外效果（作用於大回合總結）
    const totalDmg = Object.values(allPlayerData).reduce((s, p) => s + p.totalDmg, 0) + catRoundDmg;

    let   liveAfter     = 0;
    const demotedMembers = [];
    for (const id of aliveIds) {
      let hp = memberHPNow[id];
      // 後衛治癒
      // 事件效果
      memberUpdates[`members.${id}.arrows`] = [];
      memberUpdates[`members.${id}.ready`]  = false;
      memberUpdates[`members.${id}.skipped`] = false;
      if (hp <= 0) {
        const isCurrentlyFront = (members[id].role || "front") === "front";
        if (isCurrentlyFront) {
          // 前衛第一次倒下 → 轉後衛、復活至 50% HP
          hp = Math.round((members[id].maxHP || 100) * 0.5);
          memberUpdates[`members.${id}.role`]       = "rear";
          memberUpdates[`members.${id}.rearChoice`] = null;
          demotedMembers.push({ id, name: members[id].name || "隊員" });
          liveAfter++;
        } else {
          memberUpdates[`members.${id}.alive`] = false;
        }
      } else {
        liveAfter++;
      }
      memberUpdates[`members.${id}.hp`] = hp;
      const incomingStatus = partyAbility?.targetId === id ? partyAbility?.resolved?.status : null;
      memberUpdates[`members.${id}.combatStatuses`] = addPartyCombatStatus(statusRoundByMember[id]?.remainingStatuses || [], incomingStatus);
      if (members[id]?.potionBuffs?.regenPct && hp > 0) memberUpdates[`members.${id}.hp`] = Math.min(members[id]?.maxHP || 9999, hp + Math.round((members[id]?.maxHP || 100) * members[id].potionBuffs.regenPct / 100));
    }

    // Step 5: 聚合 playerLog（歷史記錄用）
    const playerLog = aliveIds.map(id => ({
      id,
      name:           allPlayerData[id].name,
      dmg:            allPlayerData[id].totalDmg,
      ctr:            ctrAccum[id] || 0,
      crits:          allPlayerData[id].crits,
      arrowBreakdown: allPlayerData[id].arrowBreakdown,
      heal:           healGivenBy[id] || 0,
      buffPct:        allPlayerData[id].rearBuff ? Math.round((rearScorePct[id] || 0) * 25) : 0,
    }));

    const logEntry = {
      round, event,
      miniRounds,   // 動畫用：6 個小回合明細
      playerLog,    // 歷史記錄用：聚合
      totalDmg,
      monsterHPBefore: room.monsterHP,
      monsterHPAfter:  monsterHP,
      counterRound:    !skipAllCtr,
      demotedMembers,
      ...(partyAbility?.scheduled ? {
        monsterAbility:partyAbility,
        // 給左上角戰鬥訊息用的一行敘述（權威端產生，雙端看到的文字才會一致）
        abilityMessage: buildAbilityMessage({
          monsterName: room.monster?.name || "怪物",
          ability: partyAbility,
          targetName: partyAbility.targetId ? (members[partyAbility.targetId]?.name || "隊友") : null,
        }),
      } : {}),
      statusTicks:Object.fromEntries(aliveIds.filter(id => statusRoundByMember[id]?.ticks?.length).map(id => [id, statusRoundByMember[id].ticks])),
    };

    // 前衛全滅＝全體判輸：後衛沒有攻擊力，只剩後衛會打不死怪又不算輸而卡死（2026-07-12）。
    const frontLiveAfter = frontIds.filter(id => (memberHPNow[id] || 0) > 0).length;
    let result = null;
    if (monsterHP <= 0) result = "win";
    else if (liveAfter === 0 || (frontIds.length > 0 && frontLiveAfter === 0)) result = "lose";

    const newStatus = result === "win" || result === "lose" ? "pending_confirm"
                    : "active";
    const nextMembers = Object.fromEntries(Object.entries(members).map(([id, member]) => [id, {
      ...member,
      alive: memberUpdates[`members.${id}.alive`] ?? member.alive,
      role: memberUpdates[`members.${id}.role`] ?? member.role,
    }]));
    const nextAbilityPreview = newStatus === "active" && room.monster?.expansionVersion === 1
      ? buildPartyAbilityPreview({ monster:room.monster, round:round + 1, members:nextMembers })
      : null;

    await updateDoc(doc(db, PARTY, roomId), stripUndefinedDeep({
      ...memberUpdates,
      monsterHP,
      round: round + 1,
      log: arrayUnion(logEntry),
      result,
      status: newStatus,
      // 2026-07-19：組隊比照單人（07-18 已停用）取消每回合突發事件。
      // makeRoundEvent 保留供未來正式事件系統使用，但不再於每回合擲骰。
      roundEvent: null,
      monsterAbilityPreview: nextAbilityPreview,
      "consumableEffects.counterReducePct": 0,
      "consumableEffects.skipCounterRound": null,
      "consumableEffects.poisonByMember": poisonByMember,
      processing: false,
    }));

    return { ok: true, won: result === "win", lost: result === "lose" };
  } catch (e) {
    console.error("[processPartyRound] failed:", e);
    await updateDoc(doc(db, PARTY, roomId), { processing: false }).catch(() => {});
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主勝利後為所有人存入待領獎勵 ───────────────────
export async function storeBattleRewards(roomId, memberIds, monster, mode = "student") {
  try {
    const roomSnap = await getDoc(doc(db, PARTY, roomId));
    if (!roomSnap.exists()) return { ok:false, reason:"room not found" };
    const room = roomSnap.data();
    if (room.rewardPending) return { ok:true, alreadyStored:true };
    const rewardPending = {};
    const expansionRewardPending = {};
    for (const member of memberIds) {
      const mid = typeof member === "string" ? member : member.id;
      const isGuest = typeof member === "object" && ["guest", "kid"].includes(member.accountType);
      if (isGuest) continue; // 訪客/兒童不拿正式寶箱，避免衝擊正式經濟
      // 挑戰強度×人數加成（素材/掉卡/金幣寶箱依人數提升,使用者規格）
      const profile = room.challengeProfile
        || getPartyChallengeProfile(room.challengeLevel || "standard", memberIds.length);
      const { mainChest, bonusChest, potionChest } = makeChests(monster, mode);
      const coinChest = Math.random() < (profile.coinChestChance ?? 0.5) ? makeCoinChest(monster.tier, "組隊掉落") : null;
      rewardPending[mid] = [mainChest, bonusChest, potionChest, coinChest].filter(Boolean);
      const participated = (room.log || []).some(entry => (entry.playerLog || []).some(player => player.id === mid && (player.arrowBreakdown || []).length > 0));
      if (participated) {
        const expansionMonster = { ...monster, materialId:room.monsterMaterialId || monster.materialId, cardId:room.monsterCardId || monster.cardId };
        const expansionReward = buildPartyExpansionReward({
          roomId, memberId:mid, monster:expansionMonster,
          materialQty: profile.materialQty ?? 5,
          cardChance: profile.cardChance ?? 0.3,
        });
        if (expansionReward) expansionRewardPending[mid] = expansionReward;
      }
    }
    await updateDoc(doc(db, PARTY, roomId), { rewardPending, expansionRewardPending });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：玩家領取自己的戰鬥獎勵 ─────────────────────────
// monsterId / result / dmgDealt 用於更新怪物圖鑑
// 訪客/兒童跳過正式寶箱 & 圖鑑寫入，但仍標記已領取
export async function claimBattleReward(roomId, memberId, chests, monsterId, result, dmgDealt, options = {}) {
  try {
    if (!options.isGuest) {
      await addChests(memberId, chests);
      if (monsterId && result) {
        await recordBattleDex(memberId, monsterId, result, dmgDealt || 0);
      }
    }
    await updateDoc(doc(db, PARTY, roomId), {
      rewardClaimed: arrayUnion(memberId),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── Battle：房主重置房間（繼續下一場，保留成員不需重新加入）──
export async function resetPartyRoom(roomId, memberIds) {
  try {
    const membersUpdate = {};
    for (const mid of memberIds) {
      membersUpdate[`members.${mid}.arrows`]  = [];
      membersUpdate[`members.${mid}.ready`]   = false;
      membersUpdate[`members.${mid}.skipped`] = false;
      membersUpdate[`members.${mid}.alive`]   = true;
      membersUpdate[`members.${mid}.role`]    = "front";
      membersUpdate[`members.${mid}.rearChoice`] = null;
      membersUpdate[`members.${mid}.hp`]      = 0;
      membersUpdate[`members.${mid}.maxHP`]   = 0;
    }
    await updateDoc(doc(db, PARTY, roomId), {
      ...membersUpdate,
      status:        "waiting",
      result:        null,
      monster:       null,
      monsterHP:     0,
      monsterMaxHP:  0,
      round:         1,
      log:           [],
      processing:    false,
      rewardPending: null,
      expansionRewardPending: null,
      rewardClaimed: [],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 房主確認結算（怪物死亡後按下才正式跳到結算畫面）──────────
export async function confirmBattleResult(roomId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), { status: "completed" });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 離開房間 ──────────────────────────────────────────────────
export async function leavePartyRoom(roomId, memberId, isHost) {
  try {
    if (isHost) {
      await updateDoc(doc(db, PARTY, roomId), { status: "completed" });
    } else {
      const snap = await getDoc(doc(db, PARTY, roomId));
      if (!snap.exists()) return { ok: true };
      // 用 deleteField 移除玩家 — 需動態 import
      const { deleteField: del } = await import("firebase/firestore");
      await updateDoc(doc(db, PARTY, roomId), {
        [`members.${memberId}`]: del(),
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── AI 機器人加入房間 ─────────────────────────────────────────
export async function addBotToPartyRoom(roomId, botId, botName, difficulty, stats) {
  try {
    const snap = await getDoc(doc(db, PARTY, roomId));
    if (!snap.exists()) return { ok: false, reason: "房間不存在" };
    const room = snap.data();
    if (Object.keys(room.members || {}).length >= 8) return { ok: false, reason: "房間已滿" };
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${botId}`]: {
        name: botName, isBot: true, difficulty,
        hp: stats.hp, maxHP: stats.hp, atk: stats.atk, def: stats.def,
        arrows: [], ready: false, alive: true,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 移除機器人 ────────────────────────────────────────────────
export async function removeBotFromPartyRoom(roomId, botId) {
  try {
    const { deleteField: del } = await import("firebase/firestore");
    await updateDoc(doc(db, PARTY, roomId), { [`members.${botId}`]: del() });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

const STALE_MS = 2 * 60 * 60 * 1000; // 2 小時

// ── 訂閱所有等待中房間（過濾 2 小時以上的舊房）─────────────
export function subscribeOpenPartyRooms(callback) {
  const q = query(collection(db, PARTY), where("status", "==", "waiting"));
  return onSnapshot(q, snap => {
    const cutoff = Date.now() - STALE_MS;
    const rooms = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => !r.createdAt || r.createdAt.toMillis() > cutoff)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(rooms);
  }, () => callback([]));
}

// ── 清除 2 小時以上未開始的殭屍房間 ─────────────────────────
export async function cleanupStalePartyRooms() {
  try {
    const cutoff = Date.now() - STALE_MS;
    const snap = await getDocs(query(collection(db, PARTY), where("status", "==", "waiting")));
    const stale = snap.docs.filter(d => {
      const t = d.data().createdAt?.toMillis?.();
      return t && t < cutoff;
    });
    await Promise.all(stale.map(d => deleteDoc(d.ref)));
  } catch (_) {}
}


// 管理員：刪除所有組隊房間（重置中心用）
export async function deleteAllPartyRooms() {
  assertCostCapability(COST_CAPABILITIES.bulkAdminWrites);
  const snap = await getDocs(query(collection(db, PARTY)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  return snap.size;
}
