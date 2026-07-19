// src/lib/dungeonDb.js — dungeonRooms Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, arrayUnion, getDoc, getDocs, query, where,
  orderBy, limit, setDoc, increment, deleteField, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { assertCostCapability, COST_CAPABILITIES } from "./costControl";
import { addCoins, markDungeonUsed, createNotification } from "./db";
import { calcPotionBuffs, getPotion } from "./itemData";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";
import { resolveConsumable } from "./consumableSystem";
import { resolvePlayerCounter } from "./damage";
import {
  assignContracts, rerollContract, generatePathOptions,
  drawDungeonEvent, DUNGEON_SHOP_ITEMS, generateDungeonFloors,
  rollHiddenRoomDiscovery,
  FLOOR_TIER_OFFSET, FLOOR_STAT_SCALE, FLOOR_REWARD_SCALE,
  DIFFICULTY_REWARD_MULT, DYNAMIC_DIFFICULTY,
} from "./dungeonData";
import { createOrdinaryChestLoot } from "./dungeonChestLoot";
import { planDungeonRoundAbility, tickDungeonStatuses, getStatusStatMods } from "./dungeonAbilityRound";

const D = "dungeonRooms";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const MODE_SCALE = {
  novice:  { hp:1.5, atk:1.0, def:1.0 },
  student: { hp:2.0, atk:1.0, def:1.0 },
  veteran: { hp:4.0, atk:2.0, def:2.0 },
};

const DEFAULT_MEMBER = (name, extraData = {}) => ({
  name, hp:0, maxHP:0, atk:0, def:0,
  accountType: extraData.accountType || "official",
  alive:true, ready:false, arrows:[],
  contract: null,
  buffs: { atkMult:1, defMult:1, dmgMult:1, hasRevival:false },
  revived: false,
  contractReset: false,
  role: "front",         // "front" | "rear" — 戰鬥用角色
  displayGroup: "front", // "front" | "rear" — 視覺分排（回合結束後才移動）
  rearChoice: null,      // "heal" | "dmg" | null
});

// ── 即時訂閱 ──────────────────────────────────────────────────
export function subscribeDungeonRoom(roomId, cb) {
  return onSnapshot(doc(db, D, roomId), snap => {
    if (snap.exists()) cb({ id:snap.id, ...snap.data() });
    else cb(null);
  });
}

// Apply a carry potion to the shared room state before consuming inventory.
// A transaction prevents duplicate taps from applying the same round twice.
export async function applyDungeonCarryPotion(roomId, memberId, potionId) {
  const potion = getPotion(potionId);
  if (!roomId || !memberId || potion?.kind !== "carry") {
    return { ok:false, reason:"invalid potion" };
  }

  try {
    await runTransaction(db, async transaction => {
      const roomRef = doc(db, D, roomId);
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) throw new Error("room not found");

      const room = snap.data();
      const member = room.members?.[memberId];
      if (room.status !== "active" || !member?.alive) throw new Error("battle not active");

      const round = room.round || 1;
      if (member.potionUsedRound === round) throw new Error("potion already used this round");

      const effect = potion.effect || {};
      const updates = { [`members.${memberId}.potionUsedRound`]: round };
      if (effect.hpPct) {
        const maxHP = member.maxHP || 100;
        updates[`members.${memberId}.hp`] = Math.min(
          maxHP,
          (member.hp || 0) + Math.round(maxHP * effect.hpPct / 100)
        );
      }
      // 戰鬥級藥水依 family 保存，同類高級版覆蓋低級版，不因重複飲用無限累乘。
      const families = { ...(member.potionBuffs?.families || {}) };
      const current = getPotion(families[potion.family]);
      if (!current || (potion.level || 0) >= (current.level || 0)) families[potion.family] = potion.id;
      const buffs = calcPotionBuffs(Object.values(families));
      updates[`members.${memberId}.potionBuffs`] = {
        families,
        atkMult: buffs.atkMult,
        defMult: buffs.defMult,
        dmgMult: buffs.dmgMult,
        regenPct: buffs.regenPct,
        shield: Math.max(member.potionBuffs?.shield || 0, Math.round((member.maxHP || 100) * (buffs.shieldPct || 0) / 100)),
      };
      transaction.update(roomRef, updates);
    });
    return { ok:true };
  } catch (e) {
    return { ok:false, reason:e.message };
  }
}

export async function applyDungeonUtilityPotion(roomId, memberId, potionId) {
  const potion = getPotion(potionId);
  if (!roomId || !memberId || potion?.kind !== "throw" || potion.actionCost === "arrow" || potion.futureFeature) {
    return { ok:false, reason:"invalid utility" };
  }
  try {
    await runTransaction(db, async transaction => {
      const roomRef = doc(db, D, roomId);
      const snap = await transaction.get(roomRef);
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
      transaction.update(roomRef, updates);
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 送出箭分 ─────────────────────────────────────────────────
export async function submitDungeonArrows(roomId, memberId, arrows, rearChoice = null) {
  try {
    const upd = {
      [`members.${memberId}.arrows`]: arrows,
      [`members.${memberId}.ready`]:  true,
    };
    if (rearChoice !== null) upd[`members.${memberId}.rearChoice`] = rearChoice;
    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 選擇前後衛角色（等待室使用）— 已廢除（新模型開場全員前衛）
// 保留函式避免匯入端報錯，但不再被 UI 呼叫
export async function setDungeonMemberRole(roomId, memberId, role) {
  try {
    await updateDoc(doc(db, D, roomId), {
      [`members.${memberId}.role`]: role,
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 房主強制跳過（斷線成員）──────────────────────────────────
export async function forceSkipDungeonPlayer(roomId, memberId) {
  try {
    await updateDoc(doc(db, D, roomId), {
      [`members.${memberId}.arrows`]:  [],
      [`members.${memberId}.ready`]:   true,
      [`members.${memberId}.skipped`]: true,
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 回合結算（帶任務系統）────────────────────────────────────
// calcDmgFn(arrows, atk, monsterDef, contract, dmgMult) → { dmg, crits, arrowBreakdown }
// calcCtrFn(monsterAtk, archerDef) → number
export async function processDungeonRound(roomId, room, calcDmgFn, calcCtrFn) {
  if (room.processing) return { ok:false, reason:"already processing" };
  try {
    await updateDoc(doc(db, D, roomId), { processing:true });

    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    const frontIds = aliveIds.filter(id => (members[id].role || "front") !== "rear");
    const rearIds  = aliveIds.filter(id => members[id].role === "rear");
    const round    = room.round || 1;
    const mods     = room.nextFloorModifiers || {};

    // Step 1：計算每人 6 箭（帶任務 + buff 加成）
    // 後衛不再直接對怪物造成傷害：heal 選擇治癒隊友、dmg(預設) 選擇改為幫存活前衛加攻擊力
    // 兩者的池子都用「後衛本回合命中分數%」換算（不看後衛自己的 ATK/DEF），均分給受益人數
    const allData = {};
    const arrowsPerRoundForScore = room.arrowsPerRound || 6;
    function calcScorePct(arrows) {
      const sum = (arrows || []).reduce((s, a) => s + (a?.score || 0), 0);
      return Math.max(0, Math.min(1, sum / (arrowsPerRoundForScore * 10)));
    }
    // 先算後衛的加攻池：每位選 dmg(助攻) 的後衛貢獻 (命中分數% × 25%) ÷ 存活前衛數，多名後衛可疊加
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
    // 上一回合怪物技能掛的異常（atkDown/defDown）在這回合生效（dungeonAbilityRound）
    const abilityStatuses = { ...(room.abilityStatuses || {}) };
    // 怪物自身減傷（技能 selfReduction）：本回合生效，回合末 duration -1
    const monsterAbilityStateBefore = room.monsterAbilityState || null;
    const monsterReduceMult = (monsterAbilityStateBefore?.reductionDuration || 0) > 0
      ? Math.max(0, 1 - (monsterAbilityStateBefore.reductionPct || 0) / 100)
      : 1;
    for (const id of aliveIds) {
      const m          = members[id];
      const isRear     = members[id].role === "rear";
      const rearHeal   = isRear && m.rearChoice === "heal";
      const rearBuff   = isRear && !rearHeal;
      const statusMods = getStatusStatMods(abilityStatuses[id]);
      const effectiveAtk = isRear
        ? 0
        : Math.round((m.atk || 10) * (m.buffs?.atkMult || 1) * (m.potionBuffs?.atkMult || 1) * (1 + atkBuffPctForFront) * (1 - statusMods.atkPct / 100));
      const dmgMult      = (m.buffs?.dmgMult || 1) * (m.potionBuffs?.dmgMult || 1) * (mods.dmgMult || 1) * (room.consumableEffects?.teamDmgMult || 1) * (1 + (m.wbBonus?.dmgBonusPct || 0)) * monsterReduceMult;
      const contract     = m.contract || { type:"standard", param:null };
      const damageItems  = (m.arrows || []).filter(arrow => getPotion(arrow?.label || arrow)?.actionCost === "arrow");
      const scoreArrows  = (m.arrows || []).filter(arrow => !getPotion(arrow?.label || arrow));
      const directDmg    = isRear ? 0 : damageItems.reduce((sum, arrow) => sum + (resolveConsumable(arrow?.label || arrow, {
        mode:"dungeon", playerAtk:effectiveAtk, enemyHp:room.monsterHP, enemyMaxHp:room.monster?.hp,
        isBoss:["boss","mythic"].includes(room.monster?.tier),
      }).damage || 0), 0);
      const raw = isRear
        ? { dmg:0, crits:0, arrowBreakdown:(m.arrows||[]).map(arrow=>({
            dmg:0,
            partIcon: rearHeal ? "💚" : "🛡️",
            partName: rearHeal ? "治癒" : "助攻",
            label:arrow?.label || arrow,
          })) }
        : calcDmgFn(scoreArrows, effectiveAtk, room.monster.def, contract, dmgMult);
      const arrowBreakdown = (raw.arrowBreakdown || []).map((entry, index) => {
        const arrow = (m.arrows || [])[index];
        return Number.isFinite(arrow?.nx) && Number.isFinite(arrow?.ny)
          ? {
              ...entry,
              nx:arrow.nx,
              ny:arrow.ny,
              faceIndex:arrow.faceIndex || 0,
              targetFormat:arrow.targetFormat || room.targetFmt || "full_110",
            }
          : entry;
      });
      allData[id] = {
        name: m.name || "射手",
        totalDmg: (raw.dmg || 0) + directDmg,
        crits:    raw.crits || 0,
        arrowBreakdown,
        contract,
        rearHeal,
        rearBuff,
        scorePct: isRear ? (rearScorePct[id] ?? 0) : 0,
        validSubmission:members[id].skipped !== true && (members[id].arrows || []).length > 0,
      };
    }

    const poisonByMember = { ...(room.consumableEffects?.poisonByMember || {}) };
    for (const id of aliveIds) {
      const existing = poisonByMember[id];
      if (existing?.rounds > 0) {
        allData[id].totalDmg += existing.damage;
        poisonByMember[id] = { ...existing, rounds:existing.rounds - 1 };
      }
      const usedPoison = (members[id].arrows || []).some(arrow => (arrow?.label || arrow) === "throw_poison");
      if (usedPoison) {
        const atk = Math.round((members[id].atk || 10) * (members[id].buffs?.atkMult || 1) * (members[id].potionBuffs?.atkMult || 1));
        poisonByMember[id] = { damage:Math.round(atk * 0.4), rounds:2 };
      }
    }

    // Step 2：隨機事件（沿用組隊打怪的觸發機制）
    const eventRaw  = shouldTriggerEvent() ? drawRandomEvent() : null;
    const eff       = eventRaw?.effect || {};
    const event     = eventRaw
      ? { id:eventRaw.id, icon:eventRaw.icon, title:eventRaw.title, desc:eventRaw.desc, type:eventRaw.type }
      : null;
    const skipAllCtr = !!eff.skipCounter || room.consumableEffects?.skipCounterRound === round;

    // Step 3：攻擊2箭 → 怪物反擊1次（分離的 mini 結構）
    // 房主固定先手，其他人再依前／後衛順序出手，與新版組隊戰鬥演出一致。
    const orderedAliveIds = [
      ...(aliveIds.includes(room.hostId) ? [room.hostId] : []),
      ...frontIds.filter(id => id !== room.hostId && aliveIds.includes(id)),
      ...rearIds.filter(id => id !== room.hostId && aliveIds.includes(id)),
    ];
    const arrowsPerRound = room.arrowsPerRound || 6;
    const miniRounds  = [];
    let   monsterHP   = room.monsterHP || 0;
    const memberHPNow = {};
    for (const id of aliveIds) memberHPNow[id] = members[id].hp || 0;
    const potionShieldNow = Object.fromEntries(aliveIds.map(id => [id, members[id].potionBuffs?.shield || 0]));
    const ctrAccum    = {};

    let lastHitInfo = null;

    // Old per-arrow replay shape is retained only for reference.  New team
    // dungeon rounds are emitted in the same per-member shape as party mode.
    if (false) for (let i = 0; i < arrowsPerRound; i++) {
      if (monsterHP <= 0) break;

      // ── 攻擊小回合 ─────────────────────────────────────
      const miniLog = [];
      let   miniDmg = 0;
      let   lastHitPlayer = null;
      let   lastHitLabel = null;
      for (const id of orderedAliveIds) {
        if (memberHPNow[id] <= 0) continue;
        const m     = members[id];
        const entry = allData[id].arrowBreakdown[i] || { dmg:0, partIcon:"💨", partName:"脫靶", label:"M" };
        const dmg   = entry.dmg || 0;
        miniDmg    += dmg;
        if (dmg > 0) { lastHitPlayer = id; lastHitLabel = entry.label; }
        const isSupportArrow = entry.partName === "治癒" || entry.partName === "助攻";
        const msg   = dmg > 0
          ? `${m.name} 命中 ${entry.partIcon}${entry.partName}，造成 ${dmg} 傷害！`
          : isSupportArrow
            ? `${m.name} ${entry.partIcon}${entry.partName}中…`
            : `${m.name} 脫靶了…`;
        miniLog.push({ id, name:m.name, dmg, ctr:0, arrowBreakdown:[entry], message:msg });
      }
      monsterHP = Math.max(0, monsterHP - miniDmg);
      miniRounds.push({
        miniRound: i + 1, isCounter: false,
        playerLog: miniLog, totalDmg: miniDmg, monsterHPAfter: monsterHP,
      });

      // 記錄最後一擊
      if (monsterHP <= 0 && lastHitPlayer) {
        lastHitInfo = {
          memberId: lastHitPlayer,
          memberName: members[lastHitPlayer]?.name || "未知射手",
          label: lastHitLabel || "?",
        };
      }
    }

    // 貓貓協戰沿用組隊戰鬥的兩爪＋技能紀錄格式，讓共用 BattleScreen
    // 可以播出相同的貓貓卡片、爪擊與技能提示。
    // Rear support resolves as its own sequence before front members attack,
    // matching PartyBattleRoom and preserving the established front/rear rules.
    const healSupportLog = rearIds
      .filter(id => allData[id]?.rearHeal)
      .map(id => {
        const pool = Math.round((members[id].maxHP || 100) * 0.15 * (allData[id].scorePct || 0) * (1 + (members[id].wbBonus?.healBonusPct || 0)));
        const targets = frontIds.filter(targetId => memberHPNow[targetId] > 0);
        const perPerson = targets.length ? Math.round(pool / targets.length) : 0;
        return { id, name:members[id].name || "rear", kind:"heal", dmg:0, heal:pool, targets:targets.map(targetId => ({ id:targetId, name:members[targetId]?.name || "front", heal:perPerson })) };
      });
    const buffSupportLog = rearIds
      .filter(id => allData[id]?.rearBuff)
      .map(id => ({ id, name:members[id].name || "rear", kind:"buff", dmg:0, buffPct:Math.round((allData[id].scorePct || 0) * 25), targets:frontIds.map(targetId => ({ id:targetId, name:members[targetId]?.name || "front" })) }));
    if (healSupportLog.length) miniRounds.push({ miniRound:miniRounds.length + 1, isSupport:true, supportKind:"heal", playerLog:healSupportLog, totalDmg:0, monsterHPAfter:monsterHP });
    if (buffSupportLog.length) miniRounds.push({ miniRound:miniRounds.length + 1, isSupport:true, supportKind:"buff", playerLog:buffSupportLog, totalDmg:0, monsterHPAfter:monsterHP });

    const orderedFrontIds = [
      ...(frontIds.includes(room.hostId) ? [room.hostId] : []),
      ...frontIds.filter(id => id !== room.hostId),
    ];
    for (const id of orderedFrontIds) {
      if (monsterHP <= 0 || memberHPNow[id] <= 0) continue;
      const data = allData[id];
      const damage = data?.totalDmg || 0;
      const hpBefore = monsterHP;
      monsterHP = Math.max(0, monsterHP - damage);
      miniRounds.push({
        miniRound: miniRounds.length + 1,
        isCounter: false,
        attackerId: id,
        playerLog: [{ id, name:data?.name || members[id]?.name || "front", role:"front", dmg:damage, ctr:0, arrowBreakdown:data?.arrowBreakdown || [], crits:data?.crits || 0 }],
        totalDmg: damage,
        monsterHPAfter: monsterHP,
      });
      if (hpBefore > 0 && monsterHP <= 0) {
        const lastArrow = (data?.arrowBreakdown || []).filter(entry => (entry.dmg || 0) > 0).at(-1);
        lastHitInfo = { memberId:id, memberName:data?.name || members[id]?.name || "front", label:lastArrow?.label || "X" };
      }
    }

    let catTotalDmg = 0;
    const catMiniLog = [];
    for (const id of aliveIds) {
      const m = members[id];
      if (!m.catAtk || memberHPNow[id] <= 0) continue;
      let dmg = 0;
      const arrowBreakdown = [];
      for (let i = 0; i < 2; i++) {
        const score = Math.max(5, Math.min(10, Math.round(7 + (Math.random() * 6 - 3))));
        const mult = 0.85 + Math.random() * 0.3;
        const base = 8 + m.catAtk * 0.7 + score * 1.2 - (room.monster?.def || 0) * 0.35;
        const arrowDmg = Math.max(1, Math.round(base * mult));
        dmg += arrowDmg;
        arrowBreakdown.push({ label:String(score), dmg:arrowDmg, isCrit:mult > 1.1, partName:"貓爪", partIcon:"🐾" });
      }
      const skillTriggered = Math.random() < 0.25;
      const skillName = skillTriggered ? "連環貓掌" : null;
      const skillBonus = skillTriggered ? Math.max(1, Math.round(dmg * 0.25)) : 0;
      dmg += skillBonus;
      catTotalDmg += dmg;
      catMiniLog.push({
        id, catId:m.catId || "diandian", name:`🐱${m.catName || "貓貓"}`,
        catName:m.catName || "貓貓", dmg, ctr:0, arrowBreakdown, crits:0,
        isCat:true, skillTriggered, skillName, skillBonus,
      });
    }
    if (catTotalDmg > 0 && monsterHP > 0) {
      const hpBeforeCatAttack = monsterHP;
      monsterHP = Math.max(0, monsterHP - catTotalDmg);
      miniRounds.push({
        miniRound: "cat", isCounter: false, isCat: true,
        playerLog: catMiniLog, totalDmg: catTotalDmg, monsterHPAfter: monsterHP,
      });
      if (hpBeforeCatAttack > 0 && monsterHP <= 0) {
        const finisher = catMiniLog.at(-1);
        lastHitInfo = {
          memberId: finisher?.id || null,
          memberName: finisher?.catName || "貓貓",
          label: "貓爪",
        };
      }
    }

    // ── Step 2.5：怪物招牌/共用技能（每回合一次，權威端結算;母任務 PRD §39）──
    // 破解採全隊聚合（PRD §44）;flag off 或舊 60 隻怪無 signatureSkillId → plan 為 null，完全跳過。
    // 冪等：resolvedKey 含 roomId+round，log 已有同 key 就不重複結算（host 重試/重連保護）。
    let abilityPlan = null;
    if (monsterHP > 0) {
      const monsterMaxHPNow = room.monsterMaxHP || room.monster?.hp || 0;
      const candidatePlan = planDungeonRoundAbility({
        battleId: `dungeon:${roomId}`,
        monster: room.monster,
        round,
        participants: aliveIds.map(id => ({
          id,
          name: members[id].name,
          role: members[id].role || "front",
          alive: memberHPNow[id] > 0,
          hp: memberHPNow[id],
          maxHP: members[id].maxHP || 100,
          def: Math.round((members[id].def || 10) * (members[id].buffs?.defMult || 1) * (members[id].potionBuffs?.defMult || 1)
            * (1 - getStatusStatMods(abilityStatuses[id]).defPct / 100)),
          // 破解率只看計分箭：藥水箭在傷害路徑本來就被濾掉，這裡若算進去會變成 0 分箭拖累破解
          arrows: (members[id].arrows || [])
            .filter(arrow => !getPotion(arrow?.label || arrow))
            .map(arrow => arrow?.label ?? arrow?.score ?? arrow),
          validSubmission: allData[id]?.validSubmission,
        })),
        monsterAtk: Math.round((room.monster?.atk || 10) * (mods.monsterAtkMult || 1)),
        monsterHpRatio: monsterMaxHPNow > 0 ? Math.max(0, monsterHP / monsterMaxHPNow) : 1,
        calcCounter: (monsterAtk, def) => calcCtrFn(monsterAtk, def, 0),
        existingStatuses: abilityStatuses,
        targetFmt: room.targetFmt || "full_110",
      });
      const alreadyResolved = (room.log || []).some(entry => entry?.ability?.resolvedKey === candidatePlan?.resolvedKey);
      if (candidatePlan && !alreadyResolved) {
        abilityPlan = candidatePlan;
        const abilityLog = [];
        for (const [id, damage] of Object.entries(abilityPlan.damageByMember)) {
          if (!(damage > 0)) continue;
          memberHPNow[id] = Math.max(1, (memberHPNow[id] || 0) - damage);
          abilityLog.push({
            id, name: members[id]?.name || "射手", dmg: 0, ctr: damage, arrowBreakdown: [],
            message: `⚡ ${room.monster?.name || "怪物"} 發動「${abilityPlan.name}」，${members[id]?.name || "射手"} 受到 ${damage} 傷害！`,
          });
        }
        for (const [id, statuses] of Object.entries(abilityPlan.statusesByMember)) abilityStatuses[id] = statuses;
        if (abilityPlan.monsterEffect.shieldHp > 0) monsterHP += abilityPlan.monsterEffect.shieldHp;
        miniRounds.push({
          miniRound: "ability", isCounter: false, isAbility: true,
          ability: {
            name: abilityPlan.name, skillId: abilityPlan.skillId, enhanced: abilityPlan.enhanced,
            breakRatio: abilityPlan.breakRatio, breakLevel: abilityPlan.breakLevel,
            targetMode: abilityPlan.targetMode, targetIds: abilityPlan.targetIds,
            monsterEffect: abilityPlan.monsterEffect,
          },
          playerLog: abilityLog, totalDmg: 0, monsterHPAfter: monsterHP,
        });
      }
    }

    // 大回合末：唯一一次怪物反擊（所有箭矢 + 貓貓攻擊後）
    if (!skipAllCtr && monsterHP > 0) {
      const monsterAtk = Math.round((room.monster.atk || 10) * (mods.monsterAtkMult || 1));
      const ctrLog     = [];
      const ctrTargets = frontIds.length > 0 ? frontIds : rearIds;
      for (const id of ctrTargets) {
        if (memberHPNow[id] <= 0) continue;
        const m            = members[id];
        const effectiveDef = Math.round((m.def || 10) * (m.buffs?.defMult || 1) * (m.potionBuffs?.defMult || 1));
        const rawCtr       = Math.ceil(calcCtrFn(monsterAtk, effectiveDef, m.wbBonus?.dmgReducePct || 0) * (1 - (room.consumableEffects?.counterReducePct || 0) / 100));
        const counterHit   = resolvePlayerCounter({ arrows:m.arrows || [], baseDamage:rawCtr, maxHP:m.maxHP || memberHPNow[id] });
        const absorbed     = Math.min(potionShieldNow[id] || 0, counterHit.damage);
        potionShieldNow[id] = Math.max(0, (potionShieldNow[id] || 0) - absorbed);
        const ctr          = counterHit.damage - absorbed;
        ctrAccum[id]       = (ctrAccum[id] || 0) + ctr;
        const prevHP       = memberHPNow[id];
        memberHPNow[id]    = Math.max(0, prevHP - ctr);
        const died         = prevHP > 0 && memberHPNow[id] <= 0;
        ctrLog.push({
          id, name: m.name, dmg: 0, ctr, arrowBreakdown: [], hitPart:counterHit.part, averageScore:counterHit.averageScore,
          message: `${room.monster.icon||"👾"} ${room.monster.name} 命中${m.name}${counterHit.part.name}，造成 ${ctr} 傷害！${died ? ` 💀 ${m.name} 陣亡！` : ""}`,
          died,
        });
      }
      miniRounds.push({
        miniRound: null, isCounter: true,
        playerLog: ctrLog, totalDmg: 0, monsterHPAfter: monsterHP,
      });
    }

    // Step 4：事件額外效果
    const totalDmg = Object.values(allData).reduce((s, p) => s + p.totalDmg, 0) + catTotalDmg;
    if (eff.extraDmg)  monsterHP = Math.max(0, monsterHP - eff.extraDmg);
    if (eff.monsterHP) monsterHP = Math.max(0, monsterHP + eff.monsterHP);

    // Step 5：計算後衛治癒（池子 = maxHP × 15% × 命中分數%，均分給全體存活隊友，不包含自己；
    //         刻意比舊版固定 25%maxHP 更低、且看命中率，避免補血變成無腦選項）
    const receivedHeal = {};
    const healGivenBy  = {};
    for (const id of aliveIds) {
      if (!allData[id]?.rearHeal) continue;
      const scorePct = allData[id]?.scorePct || 0;
      const healBonusPct = members[id].wbBonus?.healBonusPct || 0;
      const pool    = Math.round((members[id].maxHP || 100) * 0.15 * scorePct * (1 + healBonusPct));
      healGivenBy[id] = pool;
      if (pool <= 0) continue;
      const targets = aliveIds.filter(t => t !== id && memberHPNow[t] > 0);
      if (!targets.length) continue;
      const perPerson = Math.round(pool / targets.length);
      for (const tid of targets) receivedHeal[tid] = (receivedHeal[tid] || 0) + perPerson;
    }

    // Step 5a2：怪物技能異常 tick（毒扣血不致死，所有異常 duration -1）
    const statusTick = tickDungeonStatuses(
      abilityStatuses,
      Object.fromEntries(aliveIds.map(id => [id, memberHPNow[id]])),
      Object.fromEntries(aliveIds.map(id => [id, members[id].maxHP || 100])),
    );
    for (const [id, hp] of Object.entries(statusTick.memberHP)) memberHPNow[id] = hp;
    const abilityStatusesAfter = statusTick.statuses;
    const monsterAbilityStateAfter = abilityPlan?.monsterEffect.reductionDuration > 0
      ? { reductionPct: abilityPlan.monsterEffect.reductionPct, reductionDuration: abilityPlan.monsterEffect.reductionDuration }
      : (monsterAbilityStateBefore?.reductionDuration > 0
        ? { ...monsterAbilityStateBefore, reductionDuration: monsterAbilityStateBefore.reductionDuration - 1 }
        : null);

    // Step 5b：更新成員 HP（含復活符 + 前後衛死亡邏輯）
    // 先快照各人的顯示分組（動畫播放期間讓客戶端知道回合開始前的位置）
    const displayGroupsBefore = Object.fromEntries(
      aliveIds.map(id => [id, members[id].displayGroup || members[id].role || "front"])
    );
    const memberUpd = {};
    let   liveAfter = 0;
    for (const id of aliveIds) {
      const m      = members[id];
      const isRear = m.role === "rear";
      let hp       = memberHPNow[id];
      if (m.potionBuffs?.regenPct && hp > 0) hp = Math.min(m.maxHP || 9999, hp + Math.round((m.maxHP || 100) * m.potionBuffs.regenPct / 100));
      // 後衛heal：治癒量由其他後衛分給（不補自己）
      if (receivedHeal[id]) hp = Math.min(m.maxHP || 9999, hp + receivedHeal[id]);
      if (eff.archerHP)   hp = Math.min(m.maxHP || 9999, hp + eff.archerHP);
      if (eff.healArcher) hp = Math.min(m.maxHP || 9999, hp + eff.healArcher);
      // 復活符：第一次陣亡自動回血（僅前衛）
      if (hp <= 0 && !isRear && m.buffs?.hasRevival && !m.revived) {
        hp = Math.round((m.maxHP || 100) * 0.3);
        memberUpd[`members.${id}.revived`]          = true;
        memberUpd[`members.${id}.buffs.hasRevival`] = false;
      }
      if (hp <= 0) {
        if (!isRear) {
          // 前衛第一次死亡 → role 改後衛，HP 復活 50%
          hp = Math.round((m.maxHP || 100) * 0.5);
          memberUpd[`members.${id}.role`] = "rear";
          // displayGroup：一律改為後排顯示（新模型無後衛上限）
          memberUpd[`members.${id}.displayGroup`] = "rear";
          liveAfter++;
        } else {
          // 後衛死亡 → 真的陣亡
          memberUpd[`members.${id}.alive`] = false;
        }
      } else {
        liveAfter++;
      }
      memberUpd[`members.${id}.hp`]        = hp;
      memberUpd[`members.${id}.potionBuffs.shield`] = potionShieldNow[id] || 0;
      memberUpd[`members.${id}.arrows`]    = [];
      memberUpd[`members.${id}.ready`]     = false;
      memberUpd[`members.${id}.skipped`]   = false;
      if (allData[id]?.validSubmission) {
        memberUpd[`members.${id}.validRounds`] = (Number(m.validRounds) || 0) + 1;
      }
      if (isRear) memberUpd[`members.${id}.rearChoice`] = null; // 每回合清除後衛選擇
    }

    // Step 6：log entry
    const playerLog = aliveIds.map(id => ({
      id, name: allData[id].name,
      dmg:   allData[id].totalDmg,
      ctr:   ctrAccum[id] || 0,
      crits: allData[id].crits,
      arrowBreakdown: allData[id].arrowBreakdown,
      contract: allData[id].contract,
      heal:     healGivenBy[id] || 0,
      buffPct:  allData[id]?.rearBuff ? Math.round((rearScorePct[id] || 0) * 25) : 0,
    }));

    const logEntry = {
      round, event, miniRounds, playerLog, totalDmg,
      monsterHPBefore: room.monsterHP, monsterHPAfter: monsterHP,
      counterRound: !skipAllCtr,
      lastHit: lastHitInfo,
      displayGroupsBefore, // 回合開始前各人的視覺分組（客戶端動畫用）
      // 怪物技能：成員端 BattleScreen 靠這個欄位播技能演出（沒出招就不寫，維持舊 log 形狀）
      ...(abilityPlan ? {
        ability: {
          resolvedKey: abilityPlan.resolvedKey,
          name: abilityPlan.name, skillId: abilityPlan.skillId, enhanced: abilityPlan.enhanced,
          breakRatio: abilityPlan.breakRatio, breakLevel: abilityPlan.breakLevel,
          targetMode: abilityPlan.targetMode, targetIds: abilityPlan.targetIds,
          damageByMember: abilityPlan.damageByMember,
          statusesByMember: abilityPlan.statusesByMember,
          monsterEffect: abilityPlan.monsterEffect,
          poisonDamage: statusTick.poisonDamage,
        },
      } : {}),
    };

    // Step 7：動態難度追蹤 + 調整
    const currentFloor = room.currentFloor || 1;
    const totalFloors  = room.totalFloors  || 7;
    let result    = null;
    let newStatus = "active";
    let pendingDungeonNextStatus = null;

    // 前衛全滅＝全體判輸：後衛沒有攻擊力，只剩後衛會「打不死怪又不算輸」而卡死（2026-07-12）。
    // frontIds 是本回合開始時存活的前衛；本回合結束後前衛全數 HP<=0 就判輸。
    const frontLiveAfter = frontIds.filter(id => (memberHPNow[id] || 0) > 0).length;
    if (liveAfter === 0 || (frontIds.length > 0 && frontLiveAfter === 0)) {
      // 與組隊戰鬥一致：先保留新版 BattleScreen 播完反擊與擊倒，
      // 房主確認後才正式寫入 completed。
      result    = "lose";
      newStatus = "resolving";
      pendingDungeonNextStatus = "completed";
    } else if (monsterHP <= 0) {
      if (currentFloor >= totalFloors) {
        result    = "win";
        pendingDungeonNextStatus = "completed";
      } else {
        pendingDungeonNextStatus = "path_select";
      }
      // Keep the new battle screen mounted until its shared round animation
      // and host confirmation have completed.
      newStatus = "resolving";
    }

    // ── 動態難度更新（非結算回合才記錄性能） ────────────────
    const perf = room.floorPerformance || { totalDeaths:0, totalRounds:0, totalCtrHits:0, difficultyAdjust:0, rewardAdjust:0, floorLog:[] };
    if (pendingDungeonNextStatus === "path_select" || pendingDungeonNextStatus === "completed" || newStatus === "completed") {
      // 更新該層的效能資料
      // 使用 liveAfter（本回合結束後存活人數）與 aliveIds（本回合開始時存活人數）計算新陣亡數
      const newDeaths = Math.max(0, aliveIds.length - liveAfter);
      const ctrHitsThisFloor = miniRounds.filter(m => m.isCounter).reduce((s, m) => s + m.playerLog.length, 0);

      perf.totalRounds  += round;
      perf.totalDeaths  += newDeaths;
      perf.totalCtrHits += ctrHitsThisFloor;

      if (DYNAMIC_DIFFICULTY.enabled) {
        // 依據表現調整下一層難度 & 獎勵
        let diffAdj = 0;
        let rewAdj  = 0;
        // 打得久（超過3回合）→ 下一層微調弱
        if (round > 3) {
          diffAdj -= DYNAMIC_DIFFICULTY.difficultyReductionPerDeath * (round - 3) * 0.5;
          rewAdj  += DYNAMIC_DIFFICULTY.rewardBonusPerExtraRound * (round - 3);
        }
        // 陣亡多人 → 降低難度
        if (newDeaths > 1) {
          diffAdj -= DYNAMIC_DIFFICULTY.difficultyReductionPerDeath * (newDeaths - 1);
        }
        // 被反擊命中多 → 獎勵加成
        if (ctrHitsThisFloor > 0) {
          rewAdj += DYNAMIC_DIFFICULTY.rewardBonusPerCounterHit * ctrHitsThisFloor;
        }

        // 累積調整（有正負界限）
        perf.difficultyAdjust = Math.max(-DYNAMIC_DIFFICULTY.maxAdjustment, Math.min(DYNAMIC_DIFFICULTY.maxAdjustment,
          (perf.difficultyAdjust || 0) + diffAdj
        ));
        perf.rewardAdjust = Math.max(-DYNAMIC_DIFFICULTY.maxAdjustment, Math.min(DYNAMIC_DIFFICULTY.maxAdjustment,
          (perf.rewardAdjust || 0) + rewAdj
        ));

        perf.floorLog.push({
          floor: currentFloor,
          rounds: round,
          deaths: newDeaths,
          ctrHits: ctrHitsThisFloor,
          diffAfter: perf.difficultyAdjust,
          rewAfter: perf.rewardAdjust,
        });
      }
    }

    // 適用 floorPerformance 到 nextFloorModifiers（後續層用）
    const diffAdj = perf.difficultyAdjust || 0;
    const nextMods = { ...(room.nextFloorModifiers || {}) };
    if (pendingDungeonNextStatus !== "completed" && newStatus !== "completed") {
      // 難度調整反映在下一層
      nextMods.dynamicHpMult  = Math.max(0.7, 1 + diffAdj);
      nextMods.dynamicAtkMult = Math.max(0.7, 1 + diffAdj * 0.7);
      nextMods.dynamicDefMult = Math.max(0.7, 1 + diffAdj * 0.5);
    }

    await updateDoc(doc(db, D, roomId), {
      ...memberUpd,
      monsterHP, round: round + 1,
      log: arrayUnion(logEntry),
      result, status: newStatus,
      pendingDungeonNextStatus,
      processing: false,
      nextFloorModifiers: nextMods,
      floorPerformance: perf,
      "consumableEffects.counterReducePct": 0,
      "consumableEffects.skipCounterRound": null,
      "consumableEffects.poisonByMember": poisonByMember,
      abilityStatuses: abilityStatusesAfter,
      monsterAbilityState: monsterAbilityStateAfter,
      ...(pendingDungeonNextStatus === "path_select"
        ? { pathOptions: generatePathOptions(), chosenPath: null }
        : {}),
    });

    return { ok:true, won:monsterHP <= 0, lost:result === "lose" };
  } catch (e) {
    console.error("[processDungeonRound]", e);
    await updateDoc(doc(db, D, roomId), { processing:false }).catch(() => {});
    return { ok:false, reason:e.message };
  }
}

export async function confirmDungeonResolution(roomId) {
  const snap = await getDoc(doc(db, D, roomId));
  if (!snap.exists()) return { ok:false, reason:"room not found" };
  const room = snap.data();
  if (room.status !== "resolving" || !room.pendingDungeonNextStatus) return { ok:false, reason:"no pending resolution" };
  await updateDoc(doc(db, D, roomId), {
    status: room.pendingDungeonNextStatus,
    pendingDungeonNextStatus: deleteField(),
  });
  return { ok:true };
}

// ── 房主選擇路線 ─────────────────────────────────────────────
export async function selectDungeonPath(roomId, pathKey, pathOptions) {
  try {
    const chosen = pathOptions?.[pathKey];
    const upd    = { chosenPath: pathKey };
    let   status = "floor_transition";

    if (chosen?.preContent === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      upd.shopItems     = shuffled.slice(0, 4).map(item => item.id);
      upd.shopPurchases = {};
      status = "shop";
    } else if (chosen?.preContent === "event") {
      upd.currentEvent = drawDungeonEvent();
      status = "event";
    }

    await updateDoc(doc(db, D, roomId), { ...upd, status });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 購買商店物品 ─────────────────────────────────────────────
export async function purchaseDungeonItem(roomId, memberId, item, memberData) {
  try {
    const m   = memberData;
    // hp_potion 不記錄到購買清單（允許重複購買）
    const upd = item.id === "hp_potion"
      ? {}
      : { [`shopPurchases.${memberId}`]: arrayUnion(item.id) };
    // 一次性商品（回血藥水以外）以 effect 記到 shopBoughtEffects——這個欄位「跨層保留」
    // （selectDungeonPath / advanceDungeonFloor 只清 shopPurchases，不清這個），
    // 所以換層後同款效果仍鎖定，避免多人組隊也能瘋狂堆疊。
    if (item.effect && item.effect !== "hp_restore") {
      upd[`shopBoughtEffects.${memberId}`] = arrayUnion(item.effect);
    }

    switch (item.effect) {
      case "hp_restore":
        upd[`members.${memberId}.hp`] = Math.min(
          m.maxHP || 999,
          Math.round((m.hp || 0) + (m.maxHP || 0) * item.value)
        );
        break;
      case "atk_mult":
        upd[`members.${memberId}.buffs.atkMult`] =
          Math.round((m.buffs?.atkMult || 1) * item.value * 100) / 100;
        break;
      case "def_mult":
        upd[`members.${memberId}.buffs.defMult`] =
          Math.round((m.buffs?.defMult || 1) * item.value * 100) / 100;
        break;
      case "revival":
        upd[`members.${memberId}.buffs.hasRevival`] = true;
        break;
      case "hp_max_boost":
        upd[`members.${memberId}.maxHP`] = Math.round((m.maxHP || 100) * (1 + item.value));
        upd[`members.${memberId}.hp`]    = Math.round((m.hp || m.maxHP || 100) * (1 + item.value));
        break;
      case "revival_front":
        upd[`members.${memberId}.buffs.hasFrontRevival`] = true;
        break;
    }

    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 確認事件效果（房主呼叫）─────────────────────────────────
// Bug #7 fix：不再立即設 status="floor_transition"，改為 store roomResolution 並保持 status="event"，
// 讓所有 client 有 2-3 秒查看結果的 phase，host 再手動呼叫 resolveNonCombatRoom 推進。
export async function confirmDungeonEvent(roomId, room) {
  try {
    const ev  = room.currentEvent;
    const eff = ev?.effect || {};
    // 保持 status="event"，不要立即跳轉；roomResolution 讓 client 知道已結算
    const upd = {
      currentEvent: null,
      roomResolution: { kind:"event", icon:ev?.icon, title:ev?.title, desc:ev?.desc, type:ev?.type },
    };
    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);

    switch (eff.type) {
      case "hp_restore_all":
        for (const id of aliveIds) {
          const m = members[id];
          upd[`members.${id}.hp`] = Math.min(m.maxHP || 999, Math.round((m.hp || 0) + (m.maxHP || 0) * eff.value));
        }
        break;
      case "atk_buff_one": {
        if (aliveIds.length > 0) {
          const lucky = aliveIds[Math.floor(Math.random() * aliveIds.length)];
          const m     = members[lucky];
          upd[`members.${lucky}.buffs.atkMult`] = Math.round((m.buffs?.atkMult || 1) * eff.value * 100) / 100;
        }
        break;
      }
      case "atk_debuff_all":
        for (const id of aliveIds) {
          const m = members[id];
          upd[`members.${id}.buffs.atkMult`] = Math.round((m.buffs?.atkMult || 1) * eff.value * 100) / 100;
        }
        break;
      case "dmg_mult_all":
        for (const id of aliveIds) {
          const m = members[id];
          upd[`members.${id}.buffs.dmgMult`] = Math.round((m.buffs?.dmgMult || 1) * eff.value * 100) / 100;
        }
        break;
      case "contract_standard_one": {
        if (aliveIds.length > 0) {
          const lucky = aliveIds[Math.floor(Math.random() * aliveIds.length)];
          upd[`members.${lucky}.contract`] = { type:"standard", param:null };
        }
        break;
      }
      case "gold_bonus":
        for (const id of aliveIds) {
          if (!["guest", "kid"].includes(members[id]?.accountType)) addCoins(id, eff.value).catch(() => {});
        }
        break;
      case "monster_hp_mult":
        upd.nextFloorModifiers = { ...(room.nextFloorModifiers || {}), monsterHpMult: eff.value };
        break;
      case "monster_atk_mult":
        upd.nextFloorModifiers = { ...(room.nextFloorModifiers || {}), monsterAtkMult: eff.value };
        break;
      case "gold_mult":
        upd.nextFloorModifiers = { ...(room.nextFloorModifiers || {}), goldMult: eff.value };
        break;
      case "def_mult_all":
        for (const id of aliveIds) {
          const m = members[id];
          upd[`members.${id}.buffs.defMult`] = Math.round((m.buffs?.defMult || 1) * eff.value * 100) / 100;
        }
        break;
      case "skip_counter":
        // skip_counter 在 processDungeonRound 中讀取 room.currentEvent 的 effect
        // 這裡不需要額外處理，該層級的怪物反擊已被跳過
        break;
    }

    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 結算金幣（2x 地下城加成，房主替所有人呼叫）──────────────
export async function claimDungeonReward(memberId, baseCoins, goldMult = 1, options = {}) {
  try {
    const totalCoins = Math.round(baseCoins * 3 * goldMult); // 地下城固定 3x
    if (!["guest", "kid"].includes(options.accountType)) await addCoins(memberId, totalCoins);
    return { ok:true, coins:totalCoins };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 清除卡住的 processing ────────────────────────────────────
export async function clearDungeonProcessing(roomId) {
  try { await updateDoc(doc(db, D, roomId), { processing:false }); } catch (_) {}
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  新版地圖模式函式（Phase 2）  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 戰鬥結束後返回地圖（房主）
export async function returnToMapAfterBattle(roomId, clearedRoomId, prevClearedIds, clearRoom = true) {
  try {
    const newCleared = (clearRoom && clearedRoomId && !prevClearedIds.includes(clearedRoomId))
      ? [...prevClearedIds, clearedRoomId]
      : prevClearedIds;
    await updateDoc(doc(db, D, roomId), {
      status:             "map_explore",
      mapClearedIds:      newCleared,
      activeRoomContract: null,
      result:             null,
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  隱藏房間系統  ▼▼▼
// ══════════════════════════════════════════════════════════════

// A normal chest must be generated by the host once, then every client reads the same payload.
export async function ensureChestRoomLoot(roomId, hostId, proposedLoot) {
  try {
    const ref = doc(db, D, roomId);
    let loot = null;
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("寶箱房間不存在");
      const room = snap.data();
      if (room.hostId !== hostId) throw new Error("只有房主可開啟寶箱");
      loot = room.chestLoot || proposedLoot;
      if (!room.chestLoot) tx.update(ref, { chestLoot: loot });
    });
    return { ok: true, loot };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 取得隱藏房間樓層的 dungeon tier
export { _dungeonTier };
function _dungeonTier(dungeonId) {
  return { normal:1, advanced:3, hard:4, hell:5 }[dungeonId?.split("_")[1]] || 1;
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  首殺 & 廣播系統  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 嘗試設定首殺（只有當該 dungeon 尚未有首殺記錄時才寫入）
// 回傳 { ok:true, isFirst:true } 首次首殺成功
// 回傳 { ok:true, isFirst:false } 已有首殺
// dungeonId 格式："ghost_normal", "temple_hell" 等
export async function trySetDungeonFirstClear(dungeonId, memberId, memberName, teamNames = []) {
  try {
    const ref = doc(db, "dungeonFirstClear", dungeonId);
    // transaction：讀取+判斷+寫入在同一原子操作內，組隊多人同時領獎時只有一人能拿到 isFirst:true
    const isFirst = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return false;
      tx.set(ref, { dungeonId, memberId, memberName, teamNames, clearedAt: serverTimestamp() });
      return true;
    });
    return { ok: true, isFirst };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 新增地下城首殺廣播（全域通知用）
export async function addDungeonBroadcast(dungeonId, dungeonName, difficultyLabel, emoji, teamNames = [], memberName = "") {
  try {
    const ref = await addDoc(collection(db, "dungeonBroadcasts"), {
      dungeonId, dungeonName, difficultyLabel, emoji,
      teamNames, memberName,
      kind: "firstClear", // 區分「真首殺」與「失敗廣播」，避免全系統橫幅把失敗誤顯示成首殺
      createdAt: serverTimestamp(),
    });
    const heroLabel = teamNames.length ? teamNames.join("、") : (memberName || "神秘射手");
    createNotification({
      type: "dungeon",
      // 標題直接帶地城名＋難度，讓通知鈴鐺/預覽只顯示標題時也看得出「哪個地下城被首殺」
      // （修 #2：原本標題寫死「⚡ 地下城首殺！」，名稱只在內文，使用者看不到是哪個地城）
      title: `⚡ ${dungeonName}（${difficultyLabel}）首殺！`,
      content: `${emoji} ${dungeonName}（${difficultyLabel}）— ${heroLabel} 成為首殺英雄！`,
      targetMemberId: null,
    }).catch(() => {});
    return { ok: true, id: ref.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 取得某個 dungeon 是否已被首殺
export async function checkDungeonFirstClear(dungeonId) {
  try {
    const snap = await getDoc(doc(db, "dungeonFirstClear", dungeonId));
    return { ok: true, isFirstClear: snap.exists(), data: snap.exists() ? { id: snap.id, ...snap.data() } : null };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  會員地下城狀態管理（斷線重連 / 防重複加入）▼▼▼
// ══════════════════════════════════════════════════════════════

// 訂閱最新一筆廣播（MemberApp/AdminApp 用）
export function subscribeLatestBroadcast(callback) {
  const q = query(collection(db, "dungeonBroadcasts"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { callback(null); return; }
    const d = snap.docs[0];
    callback({ id: d.id, ...d.data() });
  }, () => callback(null));
}

// 取得全部首殺統計（用於成就判定 / 統計頁面）
export async function getDungeonFirstClearStats() {
  try {
    const snap = await getDocs(collection(db, "dungeonFirstClear"));
    return { ok: true, clears: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ──────────────────────────────────────────────────────────────

const STALE_MS = 2 * 60 * 60 * 1000;

// ══════════════════════════════════════════════════════════════
// ▼▼▼  地下城收藏品  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 增加一件收藏品（qty 通常為 1）
// 寫入 members/{memberId}.dungeonCollectibles.{itemId}
export async function addCollectible(memberId, itemId, qty = 1) {
  try {
    await updateDoc(doc(db, "members", memberId), {
      [`dungeonCollectibles.${itemId}`]: increment(qty),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 一次加多個收藏品（批次）
export async function addCollectibles(memberId, drops = []) {
  if (!drops.length) return;
  const updates = {};
  drops.forEach(({ itemId, qty = 1 }) => {
    updates[`dungeonCollectibles.${itemId}`] = increment(qty);
  });
  try {
    await updateDoc(doc(db, "members", memberId), updates);
  } catch (_) {}
}


// ══════════════════════════════════════════════════════════════
// ▼▼▼  非戰鬥房間系統（商人/休息/陷阱）  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 進入非戰鬥房間（商人/休息/陷阱）— 房主呼叫
// roomType: "shop" | "rest" | "trap" | "event"
export async function enterNonCombatRoom(roomId, roomType, extraData = {}) {
  try {
    // 標準化房間類型：地圖裡的 merchant/chest 等映射到系統狀態
    const normalizedType = roomType === "merchant" ? "shop" : roomType;
    const upd = {
      status: normalizedType,
      activeRoomId: extraData.roomId || null,
      roomConfirms: {},
      // Every functional room is a new transaction.  Leaving prior votes or
      // a prior resolution here causes a newly entered rest/trap room to
      // replay the old effect before anyone has made a choice.
      roomChoices: {},
      roomResolution: null,
    };
    if (normalizedType === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      upd.shopItems = shuffled.slice(0, 5).map(item => item.id);
      // 不重置 shopPurchases，讓購買記錄跨商店持久（hp_potion 除外）
    }
    if (normalizedType === "event") {
      upd.currentEvent = drawDungeonEvent();
    }
    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 成員確認完成非戰鬥房間
// 可同時傳入該成員的選擇（休息選項/陷阱確認等）
export async function confirmNonCombatRoom(roomId, memberId, choice = null) {
  try {
    const upd = { [`roomConfirms.${memberId}`]: true };
    if (choice !== null) upd[`roomChoices.${memberId}`] = choice;
    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 房主結算非戰鬥房間（全員確認或房主強制）→ 回地圖探索
// 會將該房間標記為已清除
export async function resolveNonCombatRoom(roomId, room, hostId, clearedRoomId) {
  try {
    const allAliveIds = Object.entries(room.members || {})
      .filter(([, m]) => m.alive)
      .map(([id]) => id);
    const confirmed = Object.keys(room.roomConfirms || {});
    const allConfirmed = allAliveIds.length === 0 || allAliveIds.every(id => confirmed.includes(id));
    if (!allConfirmed && !confirmed.includes(hostId)) {
      return { ok:false, reason:"not all confirmed" };
    }
    const prevCleared = room.mapClearedIds || [];
    const newCleared  = clearedRoomId && !prevCleared.includes(clearedRoomId)
      ? [...prevCleared, clearedRoomId]
      : prevCleared;
    await updateDoc(doc(db, D, roomId), {
      status:        "map_explore",
      roomConfirms:  {},
      roomChoices:   {},
      currentEvent:  null,
      mapClearedIds: newCleared,
      // 不清空 shopPurchases，讓購買記錄跨房間持久
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 管理員：刪除所有地下城房間（重置中心用）
export async function deleteAllDungeonRooms() {
  assertCostCapability(COST_CAPABILITIES.bulkAdminWrites);
  const snap = await getDocs(collection(db, D));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  return snap.size;
}
