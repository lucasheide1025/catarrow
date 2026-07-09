// src/lib/dungeonDb.js — dungeonRooms Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, arrayUnion, getDoc, getDocs, query, where,
  orderBy, limit, setDoc, increment, deleteField, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, markDungeonUsed, createNotification } from "./db";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";
import {
  assignContracts, rerollContract, generatePathOptions,
  drawDungeonEvent, DUNGEON_SHOP_ITEMS, generateDungeonFloors,
  rollHiddenRoomDiscovery,
  FLOOR_TIER_OFFSET, FLOOR_STAT_SCALE, FLOOR_REWARD_SCALE,
  DIFFICULTY_REWARD_MULT, DYNAMIC_DIFFICULTY,
} from "./dungeonData";

const D = "dungeonRooms";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function calcCatDmg(catAtk, monsterDef) {
  if (!catAtk) return 0;
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const m = 0.5 + Math.random() * 1.5;
    total += Math.max(1, Math.round((catAtk - monsterDef * 0.5) * m));
  }
  return total;
}

const MODE_SCALE = {
  novice:  { hp:1.5, atk:1.0, def:1.0 },
  student: { hp:2.0, atk:1.0, def:1.0 },
  veteran: { hp:4.0, atk:2.0, def:2.0 },
};

const DEFAULT_MEMBER = (name) => ({
  name, hp:0, maxHP:0, atk:0, def:0,
  alive:true, ready:false, arrows:[],
  contract: null,
  buffs: { atkMult:1, defMult:1, dmgMult:1, hasRevival:false },
  revived: false,
  contractReset: false,
  role: "front",         // "front" | "rear" — 戰鬥用角色
  displayGroup: "front", // "front" | "rear" — 視覺分排（回合結束後才移動）
  rearChoice: null,      // "heal" | "dmg" | null
});

// ── 建立房間 ──────────────────────────────────────────────────
export async function createDungeonRoom(hostId, hostName, hostAtk = 10) {
  try {
    const code = genCode();
    const ref  = await addDoc(collection(db, D), {
      code, hostId,
      status: "waiting",
      length: "standard", totalFloors: 7,
      currentFloor: 0,
      mode: "student",
      arrowsPerRound: 6,
      targetFmt: "full_110",
      hostAtk,
      result: null,
      members: { [hostId]: DEFAULT_MEMBER(hostName) },
      monster: null, monsterHP: 0, monsterMaxHP: 0,
      round: 1, log: [],
      processing: false,
      pathOptions: null, chosenPath: null,
      shopItems: [], shopPurchases: {},
      currentEvent: null,
      nextFloorModifiers: {},
      createdAt: serverTimestamp(),
    });
    return { ok:true, roomId:ref.id, code };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 加入房間（用邀請碼）──────────────────────────────────────
export async function joinDungeonRoom(code, memberId, memberName) {
  try {
    const snap = await getDocs(
      query(collection(db, D),
        where("code", "==", code.toUpperCase()),
        where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok:false, reason:"找不到此邀請碼，或地下城已開始" };
    const roomDoc = snap.docs[0];
    const members = roomDoc.data().members || {};
    if (Object.keys(members).length >= 8)
      return { ok:false, reason:"地下城最多 8 人" };
    // 前衛固定 4 人：若已有 4 個前衛則預設為後衛
    const frontCount = Object.values(members).filter(m => (m.role || "front") !== "rear").length;
    const defaultRole = frontCount >= 4 ? "rear" : "front";
    await updateDoc(doc(db, D, roomDoc.id), {
      [`members.${memberId}`]: { ...DEFAULT_MEMBER(memberName), role: defaultRole, displayGroup: defaultRole },
    });
    return { ok:true, roomId:roomDoc.id };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 即時訂閱 ──────────────────────────────────────────────────
export function subscribeDungeonRoom(roomId, cb) {
  return onSnapshot(doc(db, D, roomId), snap => {
    if (snap.exists()) cb({ id:snap.id, ...snap.data() });
    else cb(null);
  });
}

// ── 各玩家寫入自己的 HP/ATK/DEF ─────────────────────────────
export async function updateDungeonMemberStats(roomId, memberId, hp, maxHP, atk, def, catName = "", archerStyle = "", catAtk = 0) {
  try {
    await updateDoc(doc(db, D, roomId), {
      [`members.${memberId}.hp`]:          hp,
      [`members.${memberId}.maxHP`]:       maxHP,
      [`members.${memberId}.atk`]:         atk,
      [`members.${memberId}.def`]:         def,
      [`members.${memberId}.catName`]:     catName,
      [`members.${memberId}.archerStyle`]: archerStyle,
      [`members.${memberId}.catAtk`]:      catAtk,
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 房主開啟第一層 ────────────────────────────────────────────
export async function startDungeonFloor(roomId, room, monster, mode, length, totalFloors) {
  try {
    const memberIds   = Object.keys(room.members || {});
    const ms          = MODE_SCALE[mode] || MODE_SCALE.student;
    const memberCount = memberIds.length;
    const currentFloor = 1;
    const fi = 0; // floor index = currentFloor - 1
    // 房主強度縮放：hostAtk / 12 決定怪物難度基底（0.7 ~ 2.0x）
    const hostAtk      = room.hostAtk || 10;
    const hostScale    = Math.max(0.8, Math.min(1.4, hostAtk / 18));
    // 人數 scaling：每多 1 人 → 怪物 HP+50% / ATK+15% / DEF+15%
    const extraMembers  = memberCount - 1;
    const monHPMult     = 1.0 + extraMembers * 0.5;
    const monAtkMult    = 1.0 + extraMembers * 0.15;
    const monDefMult    = 1.0 + extraMembers * 0.15;
    // 深度 scaling：越深層怪物越強
    const floorScale    = FLOOR_STAT_SCALE[fi] ?? 1.0;
    const tierOffset    = FLOOR_TIER_OFFSET[fi] ?? 0;
    const floorTier     = Math.min(9, (monster.tier || 1) + tierOffset);
    const rewardMult    = (1.0 + extraMembers * 0.2) * (FLOOR_REWARD_SCALE[fi] ?? 1.0);  // +20%/人 × 深度
    const scaledHP      = Math.round(monster.hp * ms.hp * monHPMult * hostScale * floorScale);
    const diffReward    = 1.0; // 起始層

    // 分配初始合約（後續每層 advanceDungeonFloor 會重新抽選）
    const contracts = assignContracts(memberIds);
    const upd = {};
    for (const mid of memberIds) {
      const m = room.members[mid] || {};
      upd[`members.${mid}.arrows`]   = [];
      upd[`members.${mid}.ready`]    = false;
      upd[`members.${mid}.alive`]    = true;
      upd[`members.${mid}.revived`]  = false;
      upd[`members.${mid}.contract`] = contracts[mid];
      if (!m.maxHP) {
        upd[`members.${mid}.hp`]    = 500;
        upd[`members.${mid}.maxHP`] = 500;
        upd[`members.${mid}.def`]   = 10;
      }
    }

    // 初始化動態難度追蹤
    const initPerf = {
      totalDeaths: 0,
      totalRounds: 0,
      totalCtrHits: 0,
      difficultyAdjust: 0,  // 累積難度偏移（正=更難，負=更簡單）
      rewardAdjust: 0,      // 累積獎勵偏移
      floorLog: [],
    };

    await updateDoc(doc(db, D, roomId), {
      ...upd,
      status: "active", length, totalFloors, currentFloor, mode,
      monster: {
        id: monster.id, name: monster.name, icon: monster.icon,
        hp:  Math.round(monster.hp  * ms.hp  * hostScale * floorScale),
        atk: Math.round(monster.atk * ms.atk * hostScale * monAtkMult * floorScale),
        def: Math.round(monster.def * ms.def * monDefMult * floorScale),
        tier: floorTier, family: monster.family,
      },
      monsterHP: scaledHP, monsterMaxHP: scaledHP,
      rewardMult,
      diffReward,
      floorPerformance: initPerf,
      round: 1, log: [], result: null, processing: false,
      pathOptions: null, chosenPath: null, nextFloorModifiers: {},
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

// ── 選擇前後衛角色（等待室使用）──────────────────────────────
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

    // Step 1：計算每人 6 箭（帶任務 + buff 加成；後衛heal選擇→傷害歸零）
    const allData = {};
    for (const id of aliveIds) {
      const m          = members[id];
      const isRear     = members[id].role === "rear";
      const rearHeal   = isRear && m.rearChoice === "heal";
      const rearDmgMul = isRear && m.rearChoice === "dmg" ? 0.5 : 1.0;
      const effectiveAtk = rearHeal ? 0 : Math.round((m.atk || 10) * (m.buffs?.atkMult || 1));
      const dmgMult      = (m.buffs?.dmgMult || 1) * (mods.dmgMult || 1) * rearDmgMul;
      const contract     = m.contract || { type:"standard", param:null };
      const raw = rearHeal
        ? { dmg:0, crits:0, arrowBreakdown:(m.arrows||[]).map(arrow=>({
            dmg:0, partIcon:"💚", partName:"治癒", label:arrow?.label || arrow,
          })) }
        : calcDmgFn(m.arrows || [], effectiveAtk, room.monster.def, contract, dmgMult);
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
        totalDmg: raw.dmg || 0,
        crits:    raw.crits || 0,
        arrowBreakdown,
        contract,
        rearHeal,
      };
    }

    // Step 2：隨機事件（沿用組隊打怪的觸發機制）
    const eventRaw  = shouldTriggerEvent() ? drawRandomEvent() : null;
    const eff       = eventRaw?.effect || {};
    const event     = eventRaw
      ? { id:eventRaw.id, icon:eventRaw.icon, title:eventRaw.title, desc:eventRaw.desc, type:eventRaw.type }
      : null;
    const skipAllCtr = !!eff.skipCounter;

    // Step 3：攻擊2箭 → 怪物反擊1次（分離的 mini 結構）
    // 攻擊順序：前衛 → 後衛（動畫用）
    const orderedAliveIds = [
      ...frontIds.filter(id => aliveIds.includes(id)),
      ...rearIds.filter(id => aliveIds.includes(id)),
    ];
    const arrowsPerRound = room.arrowsPerRound || 6;
    const miniRounds  = [];
    let   monsterHP   = room.monsterHP || 0;
    const memberHPNow = {};
    for (const id of aliveIds) memberHPNow[id] = members[id].hp || 0;
    const ctrAccum    = {};

    let lastHitInfo = null;

    for (let i = 0; i < arrowsPerRound; i++) {
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
        const msg   = dmg > 0
          ? `${m.name} 命中 ${entry.partIcon}${entry.partName}，造成 ${dmg} 傷害！`
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

    // 貓貓攻擊（所有存活成員的貓各出 6 箭，合算傷害）
    let catTotalDmg = 0;
    const catMiniLog = [];
    for (const id of aliveIds) {
      const m = members[id];
      if (!m.catAtk || memberHPNow[id] <= 0) continue;
      const dmg = calcCatDmg(m.catAtk, room.monster?.def || 10);
      catTotalDmg += dmg;
      catMiniLog.push({ id, name: m.name, catName: m.catName || "貓貓", dmg });
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

    // 大回合末：唯一一次怪物反擊（所有箭矢 + 貓貓攻擊後）
    if (!skipAllCtr && monsterHP > 0) {
      const monsterAtk = Math.round((room.monster.atk || 10) * (mods.monsterAtkMult || 1));
      const ctrLog     = [];
      const ctrTargets = frontIds.length > 0 ? frontIds : rearIds;
      for (const id of ctrTargets) {
        if (memberHPNow[id] <= 0) continue;
        const m            = members[id];
        const effectiveDef = Math.round((m.def || 10) * (m.buffs?.defMult || 1));
        const ctr          = Math.ceil(calcCtrFn(monsterAtk, effectiveDef));
        ctrAccum[id]       = (ctrAccum[id] || 0) + ctr;
        const prevHP       = memberHPNow[id];
        memberHPNow[id]    = Math.max(0, prevHP - ctr);
        const died         = prevHP > 0 && memberHPNow[id] <= 0;
        ctrLog.push({
          id, name: m.name, dmg: 0, ctr, arrowBreakdown: [],
          message: `${room.monster.icon||"👾"} ${room.monster.name} 反擊 ${m.name}，造成 ${ctr} 傷害！${died ? ` 💀 ${m.name} 陣亡！` : ""}`,
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

    // Step 5：計算後衛治癒（治癒量均分給全體存活隊友，不包含自己）
    const receivedHeal = {};
    for (const id of aliveIds) {
      if (!allData[id]?.rearHeal) continue;
      const pool    = Math.round((members[id].maxHP || 100) * 0.25);
      const targets = aliveIds.filter(t => t !== id && memberHPNow[t] > 0);
      if (!targets.length) continue;
      const perPerson = Math.round(pool / targets.length);
      for (const tid of targets) receivedHeal[tid] = (receivedHeal[tid] || 0) + perPerson;
    }

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
          // displayGroup：後衛位置有空才真正移動，否則維持在前排（只改狀態標籤）
          const curRearDisplayCount = Object.values(members)
            .filter(m2 => (m2.displayGroup || m2.role || "front") === "rear").length;
          if (curRearDisplayCount < 4) {
            memberUpd[`members.${id}.displayGroup`] = "rear";
          }
          liveAfter++;
        } else {
          // 後衛死亡 → 真的陣亡
          memberUpd[`members.${id}.alive`] = false;
        }
      } else {
        liveAfter++;
      }
      memberUpd[`members.${id}.hp`]        = hp;
      memberUpd[`members.${id}.arrows`]    = [];
      memberUpd[`members.${id}.ready`]     = false;
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
    }));

    const logEntry = {
      round, event, miniRounds, playerLog, totalDmg,
      monsterHPBefore: room.monsterHP, monsterHPAfter: monsterHP,
      counterRound: !skipAllCtr,
      lastHit: lastHitInfo,
      displayGroupsBefore, // 回合開始前各人的視覺分組（客戶端動畫用）
    };

    // Step 7：動態難度追蹤 + 調整
    const currentFloor = room.currentFloor || 1;
    const totalFloors  = room.totalFloors  || 7;
    let result    = null;
    let newStatus = "active";

    if (liveAfter === 0) {
      result    = "lose";
      newStatus = "completed";
    } else if (monsterHP <= 0) {
      if (currentFloor >= totalFloors) {
        result    = "win";
        newStatus = "completed";
      } else {
        newStatus = "path_select";
      }
    }

    // ── 動態難度更新（非結算回合才記錄性能） ────────────────
    const perf = room.floorPerformance || { totalDeaths:0, totalRounds:0, totalCtrHits:0, difficultyAdjust:0, rewardAdjust:0, floorLog:[] };
    if (newStatus === "path_select" || newStatus === "completed") {
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
    if (newStatus !== "completed") {
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
      processing: false,
      nextFloorModifiers: nextMods,
      floorPerformance: perf,
      ...(newStatus === "path_select"
        ? { pathOptions: generatePathOptions(), chosenPath: null }
        : {}),
    });

    return { ok:true, won:monsterHP <= 0, lost:liveAfter === 0 };
  } catch (e) {
    console.error("[processDungeonRound]", e);
    await updateDoc(doc(db, D, roomId), { processing:false }).catch(() => {});
    return { ok:false, reason:e.message };
  }
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
export async function confirmDungeonEvent(roomId, room) {
  try {
    const ev  = room.currentEvent;
    const eff = ev?.effect || {};
    const upd = { currentEvent:null, status:"floor_transition" };
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
          if (!id.startsWith("guest")) addCoins(id, eff.value).catch(() => {});
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

// ── 進入下一層（房主呼叫）────────────────────────────────────
export async function advanceDungeonFloor(roomId, room, nextMonster) {
  try {
    const currentFloor = (room.currentFloor || 0) + 1;
    const fi           = Math.min(currentFloor - 1, FLOOR_STAT_SCALE.length - 1); // currentFloor 是 1-based，陣列是 0-based
    const mode         = room.mode || "student";
    const ms           = MODE_SCALE[mode] || MODE_SCALE.student;
    const mods         = room.nextFloorModifiers || {};
    const chosenPath   = room.pathOptions?.[room.chosenPath || "A"];
    const eliteBoost   = chosenPath?.eliteBoost || 1.0;
    const memberIds    = Object.keys(room.members || {});
    const perf         = room.floorPerformance || { totalDeaths:0, totalRounds:0, totalCtrHits:0, difficultyAdjust:0, rewardAdjust:0, floorLog:[] };

    const hostAtk   = room.hostAtk || 10;
    const hostScale = Math.max(0.8, Math.min(1.4, hostAtk / 18)); // 與 startDungeonFloor 一致
    // 套用動態難度調整（由 processDungeonRound 寫入 nextFloorModifiers）
    const dynHpMult  = mods.dynamicHpMult || 1;
    const dynAtkMult = mods.dynamicAtkMult || 1;
    const dynDefMult = mods.dynamicDefMult || 1;
    const hpMult     = (1.0 + (memberIds.length - 1) * 0.5) * eliteBoost * (mods.monsterHpMult || 1) * dynHpMult;
    const atkMult    = eliteBoost * (mods.monsterAtkMult || 1) * dynAtkMult;
    // 深度 scaling：越深層怪物越強
    const floorScale = FLOOR_STAT_SCALE[fi] ?? 1.0;
    const scaledHP   = Math.round(nextMonster.hp  * ms.hp  * hpMult * hostScale * floorScale);
    const scaledAtk  = Math.round(nextMonster.atk * ms.atk * atkMult * hostScale * floorScale);
    const scaledDef  = Math.round(nextMonster.def * ms.def * floorScale * dynDefMult);
    // 深度獎勵 scaling
    const floorReward = FLOOR_REWARD_SCALE[fi] ?? 1.0;
    const baseReward  = (1.0 + (memberIds.length - 1) * 0.2);
    // 動態難度獎勵調整
    const dynamicReward = perf.rewardAdjust || 0;
    const newRewardMult = Math.max(0.5, baseReward * floorReward * (1 + dynamicReward));

    // tier offset：深度遞增
    const tierOffset = FLOOR_TIER_OFFSET[fi] ?? 0;
    const floorTier  = Math.min(9, (nextMonster.tier || 1) + tierOffset);

    // 每換一層怪物就重新抽任務
    const aliveIds = memberIds.filter(id => room.members[id]?.alive);
    const upd = {};
    for (const id of aliveIds) {
      upd[`members.${id}.arrows`]        = [];
      upd[`members.${id}.ready`]         = false;
      upd[`members.${id}.contract`]      = rerollContract();
      upd[`members.${id}.contractReset`] = false;
    }

    await updateDoc(doc(db, D, roomId), {
      ...upd,
      currentFloor,
      monster: {
        id: nextMonster.id, name: nextMonster.name, icon: nextMonster.icon,
        hp:  Math.round(nextMonster.hp  * ms.hp),
        atk: scaledAtk, def: scaledDef,
        tier: floorTier, family: nextMonster.family,
      },
      monsterHP: scaledHP, monsterMaxHP: scaledHP,
      rewardMult: newRewardMult,
      round: 1, log: [], result: null,
      status: "active", processing: false,
      pathOptions: null, chosenPath: null,
      shopItems: [], shopPurchases: {},
      currentEvent: null,
      nextFloorModifiers: {},
      // 保留 floorPerformance（跨樓層累積）
      floorPerformance: perf,
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 結算金幣（2x 地下城加成，房主替所有人呼叫）──────────────
export async function claimDungeonReward(memberId, baseCoins, goldMult = 1) {
  try {
    const totalCoins = Math.round(baseCoins * 3 * goldMult); // 地下城固定 3x
    if (!memberId.startsWith("guest")) await addCoins(memberId, totalCoins);
    return { ok:true, coins:totalCoins };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 離開房間 ─────────────────────────────────────────────────
export async function leaveDungeonRoom(roomId, memberId, isHost) {
  try {
    if (isHost) {
      await updateDoc(doc(db, D, roomId), { status:"completed", result:"lose" });
    } else {
      await updateDoc(doc(db, D, roomId), { [`members.${memberId}.alive`]: false });
    }
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 清除卡住的 processing ────────────────────────────────────
export async function clearDungeonProcessing(roomId) {
  try { await updateDoc(doc(db, D, roomId), { processing:false }); } catch (_) {}
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  新版地圖模式函式（Phase 2）  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 初始化地圖探索（開始時房主呼叫）— 隨機生成全部樓層並存入 Firestore
export async function initDungeonMapRun(roomId, dungeonId, hostId) {
  try {
    const generatedFloors = generateDungeonFloors(dungeonId);
    const startRoomId     = generatedFloors[0]?.startRoomId || "f0c0r0";
    await updateDoc(doc(db, D, roomId), {
      status:           "map_explore",
      mapDungeonId:     dungeonId,
      mapFloorIndex:    0,
      mapCurrentRoomId: startRoomId,
      mapExploredIds:   [startRoomId],
      mapClearedIds:    [],
      mapLoot:          {},
      mapVoteProposal:  null,
      mapVotes:         {},
      generatedFloors,
    });
    if (hostId) markDungeonUsed(hostId).catch(() => {});
    return { ok:true };
  } catch (e) { console.error("[initDungeonMapRun]", e); return { ok:false, reason:e.message }; }
}

// 保存地圖探索進度（房主移動後呼叫）
export async function saveMapExploration(roomId, { floorIndex, currentRoomId, exploredIds, clearedIds }) {
  try {
    await updateDoc(doc(db, D, roomId), {
      mapFloorIndex:    floorIndex,
      mapCurrentRoomId: currentRoomId,
      mapExploredIds:   [...exploredIds],
      mapClearedIds:    [...clearedIds],
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 提案移動（房主）：開始投票，所有成員看到目標房間
export async function proposeMapMove(roomId, targetRoomId) {
  try {
    await updateDoc(doc(db, D, roomId), {
      mapVoteProposal: { targetRoomId, proposedAt: serverTimestamp() },
      mapVotes: {},
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 投票（成員）
export async function castMapVote(roomId, memberId, targetRoomId) {
  try {
    await updateDoc(doc(db, D, roomId), {
      [`mapVotes.${memberId}`]: targetRoomId,
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 解析投票（房主 30 秒後呼叫）：票數最多的房間勝，平手由 hostId 決定
export async function resolveMapVote(roomId, room, hostVoteRoomId) {
  try {
    const votes   = room.mapVotes || {};
    const tally   = {};
    for (const v of Object.values(votes)) tally[v] = (tally[v] || 0) + 1;
    // 找票數最多的，平手選 hostVote
    let winner = hostVoteRoomId;
    let best   = 0;
    for (const [roomId_, count] of Object.entries(tally)) {
      if (count > best) { best = count; winner = roomId_; }
    }
    const prevExplored = room.mapExploredIds || [];
    const newExplored  = prevExplored.includes(winner) ? prevExplored : [...prevExplored, winner];
    await updateDoc(doc(db, D, roomId), {
      mapCurrentRoomId: winner,
      mapExploredIds:   newExplored,
      mapVoteProposal:  null,
      mapVotes:         {},
    });
    return { ok:true, winner };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 進入下一層（房主）— 接受 generatedFloors 陣列或舊格式 dungeon 物件
export async function advanceMapFloor(roomId, dungeonOrFloors, nextFloorIndex) {
  try {
    const floors    = Array.isArray(dungeonOrFloors) ? dungeonOrFloors : dungeonOrFloors?.floors;
    const nextFloor = floors?.[nextFloorIndex];
    if (!nextFloor) return { ok:false, reason:"no next floor" };
    await updateDoc(doc(db, D, roomId), {
      mapFloorIndex:    nextFloorIndex,
      mapCurrentRoomId: nextFloor.startRoomId,
      mapExploredIds:   [nextFloor.startRoomId],
      mapVoteProposal:  null,
      mapVotes:         {},
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// 進入戰鬥房（房主）：設定怪物合約 + 切換到 active 狀態
export async function enterMapCombatRoom(roomId, room, roomMeta, options = {}) {
  try {
    const { monster = null, formationMap = {}, runeMap = {}, totalFloors = 1 } = options;
    const contract = roomMeta?.contract
      ? { type: roomMeta.contract, param: roomMeta.contractParam ?? null }
      : { type:"standard", param:null };
    const memberIds = Object.keys(room.members || {});
    const floorIndex = room.mapFloorIndex ?? 0;
    const fi = Math.min(floorIndex, FLOOR_STAT_SCALE.length - 1);
    const floorScale = FLOOR_STAT_SCALE[fi] ?? 1.0;
    const rewardScale = FLOOR_REWARD_SCALE[fi] ?? 1.0;

    const upd = {};
    for (const id of memberIds) {
      const m = room.members[id] || {};
      upd[`members.${id}.contract`]  = contract;
      upd[`members.${id}.arrows`]    = [];
      upd[`members.${id}.ready`]     = false;
      upd[`members.${id}.revived`]   = false; // 每間房間重置復活旗標
      // 上一間死亡的成員進新房間復活（帶 30% HP）
      if (!m.alive) {
        upd[`members.${id}.alive`] = true;
        upd[`members.${id}.hp`]    = Math.max(1, Math.round((m.maxHP || 100) * 0.3));
      }
      if (formationMap[id]) upd[`members.${id}.formation`] = formationMap[id];
      if (runeMap[id])      upd[`members.${id}.rune`]      = runeMap[id];
    }

    // 遠征開始前已鎖定，進入每個戰鬥房時只沿用房間設定。
    const apr = [3, 6].includes(room.arrowsPerRound) ? room.arrowsPerRound : 6;

  // Boss 房間加成：套用 bossModifier 到怪物數值
    const bossMod = roomMeta?.bossModifier || null;
    const finalMonster = bossMod && monster ? {
      ...monster,
      hp:  Math.round((monster.hp  || 100) * (bossMod.hp  || 1) * floorScale),
      atk: Math.round((monster.atk || 10)  * (bossMod.atk || 1) * floorScale),
      def: Math.round((monster.def || 5)   * (bossMod.def || 1) * floorScale),
    } : (monster ? {
      ...monster,
      hp:  Math.round((monster.hp  || 100) * floorScale),
      atk: Math.round((monster.atk || 10)  * floorScale),
      def: Math.round((monster.def || 5)   * floorScale),
    } : null);
    const monsterHP = finalMonster?.hp || 100;
    const baseReward = 1.0 + Math.max(0, memberIds.length - 1) * 0.2;
    const rewardMult = baseReward * rewardScale;

    await updateDoc(doc(db, D, roomId), {
      ...upd,
      monster:             finalMonster,
      monsterHP:           monsterHP,
      monsterMaxHP:        monsterHP,
      arrowsPerRound:      apr,
      status:              "active",
      activeRoomContract:  contract,
      rewardMult,
      round:               1,
      log:                 [],
      result:              null,
      processing:          false,
      totalFloors:         totalFloors,
      currentFloor:        floorIndex + 1,
      // 標記 Boss 房間以利結算獎勵判斷
      ...(bossMod ? { isBossRoom: true } : {}),
    });
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

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

// 提議戰鬥（房主）：寫入 mapPendingRoom，讓非房主也能看到即將進入的房間資訊
export async function proposeMapBattle(roomId, roomData) {
  try {
    await updateDoc(doc(db, D, roomId), { mapPendingRoom: roomData || null });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 清除戰鬥提議（確認進入戰鬥或撤退時呼叫）
export async function clearMapPendingRoom(roomId) {
  try {
    await updateDoc(doc(db, D, roomId), { mapPendingRoom: deleteField() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  隱藏房間系統  ▼▼▼
// ══════════════════════════════════════════════════════════════

// 房主進入一個可觸發隱藏房間的房間後，呼叫此函式檢查是否有隱藏房間
// 若有，會將新的隱藏房間寫入 generatedFloors（只對當前樓層寫入）
// 回傳 { found: true, hiddenRoom } 或 { found: false }
export async function tryDiscoverHiddenRoom(roomId, room, floorIndex, currentRoomId) {
  try {
    const floors = room?.generatedFloors || [];
    const floor  = floors[floorIndex];
    if (!floor) return { found: false };
    // 檢查是否已有隱藏房間在該樓層
    const hasHidden = floor.rooms.some(r => r.type === "hidden");
    if (hasHidden) return { found: false }; // 每層最多一個隱藏房間
    const tier = room.mapDungeonId ? _dungeonTier(room.mapDungeonId) : 1;
    const result = rollHiddenRoomDiscovery(floor, currentRoomId, tier);
    if (!result) return { found: false };
    // 將新房間寫入 generatedFloors（更新 Firestore 中該樓層的 rooms 陣列）
    const updatedRooms = [...floor.rooms, result];
    const updatedConnections = [...(floor.connections || [])];
    // 連接隱藏房間到當前房間
    updatedConnections.push({ a: currentRoomId, b: result.id });
    // 更新到 Firestore
    await updateDoc(doc(db, D, roomId), {
      [`generatedFloors.${floorIndex}.rooms`]: updatedRooms,
      [`generatedFloors.${floorIndex}.connections`]: updatedConnections,
    });
    return { found: true, hiddenRoom: result };
  } catch (e) {
    return { found: false, reason: e.message };
  }
}

// 進入隱藏房間（房主呼叫）— 類似寶箱房間，但獎勵更豐
// 獎勵由 DungeonChest 元件在玩家點擊確認時個別發放（避免重複給幣）
export async function enterHiddenRoom(roomId, room, roomMeta) {
  try {
    const coins = roomMeta?.coins || 30;
    // 切換到寶箱模式顯示獎勵（DungeonChest 會讀 hiddenRoomLoot 發放獎勵）
    await updateDoc(doc(db, D, roomId), {
      status: "chest",
      activeRoomId: roomMeta?.id || null,
      roomConfirms: {},
      roomChoices:  {},
      hiddenRoomLoot: { coins, found: true },
    });
    return { ok: true, coins };
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
// ▼▼▼  累積地圖戰利品  ▼▼▼
export async function addMapLoot(roomId, prevLoot, newItems) {
  try {
    const merged = { ...prevLoot };
    for (const [k, v] of Object.entries(newItems)) {
      merged[k] = (merged[k] || 0) + v;
    }
    await updateDoc(doc(db, D, roomId), { mapLoot: merged });
    return { ok:true, loot: merged };
  } catch (e) { return { ok:false, reason:e.message }; }
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
      createdAt: serverTimestamp(),
    });
    const heroLabel = teamNames.length ? teamNames.join("、") : (memberName || "神秘射手");
    createNotification({
      type: "dungeon",
      title: `⚡ 地下城首殺！`,
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

// ── 檢查房間是否仍有效（MemberApp/AdminApp 載入時驗證，避免跳到已結束的房間）───
// 完成的地城（status=completed with result）視為無效
// 不存在的房間也視為無效
// 這樣 sessionStorage 的舊 roomId 就不會讓玩家卡在無限載入
export async function checkDungeonRoomExists(roomId) {
  try {
    const snap = await getDocs(query(collection(db, D), where("__name__", "==", roomId)));
    if (snap.empty) return { ok: false, exists: false, reason: "room_not_found" };
    const data = snap.docs[0].data();
    if (data.status === "completed" && data.result) return { ok: false, exists: false, reason: "completed" };
    const validStatuses = ["waiting", "map_explore", "active", "shop", "rest", "trap", "event", "chest", "path_select", "floor_transition"];
    if (!validStatuses.includes(data.status)) return { ok: false, exists: false, reason: "stale_status" };
    return { ok: true, exists: true };
  } catch (e) { return { ok: false, exists: false, reason: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  會員地下城狀態管理（斷線重連 / 防重複加入）▼▼▼
// ══════════════════════════════════════════════════════════════

// 設定該成員當前正在進行的地下城（寫入 members/{memberId}.activeDungeon）
export async function setActiveDungeon(memberId, roomId) {
  try {
    await updateDoc(doc(db, "members", memberId), {
      activeDungeon: { roomId, joinedAt: serverTimestamp() },
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 清除該成員的 activeDungeon（離開/完成地下城時呼叫）
export async function clearActiveDungeon(memberId) {
  try {
    await updateDoc(doc(db, "members", memberId), {
      activeDungeon: deleteField(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 檢查該 member 是否已經在進行中的地下城（用於防重複加入）
export async function checkMemberActiveDungeon(memberId) {
  try {
    const snap = await getDocs(query(collection(db, "members"), where("__name__", "==", memberId)));
    if (snap.empty) return { ok: true, inDungeon: false };
    const active = snap.docs[0].data()?.activeDungeon;
    if (!active?.roomId) return { ok: true, inDungeon: false };
    const roomSnap = await getDocs(query(collection(db, D), where("__name__", "==", active.roomId)));
    if (roomSnap.empty) return { ok: true, inDungeon: false };
    const data = roomSnap.docs[0].data();
    if (data.status === "completed" && data.result) return { ok: true, inDungeon: false };
    const validStatuses = ["waiting", "map_explore", "active", "shop", "rest", "trap", "event", "chest", "path_select", "floor_transition"];
    if (!validStatuses.includes(data.status)) return { ok: true, inDungeon: false };
    return { ok: true, inDungeon: true, roomId: active.roomId };
  } catch (e) { return { ok: false, inDungeon: false, reason: e.message }; }
}

// 訂閱最新一筆廣播（MemberApp/AdminApp 用）
export function subscribeLatestBroadcast(callback) {
  const q = query(collection(db, "dungeonBroadcasts"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { callback(null); return; }
    const d = snap.docs[0];
    callback({ id: d.id, ...d.data() });
  }, () => callback(null));
}

// 訂閱全部廣播（用於首殺歷史紀錄頁面）
export function subscribeAllDungeonBroadcasts(callback) {
  const q = query(collection(db, "dungeonBroadcasts"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, () => callback([]));
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

export function subscribeOpenDungeonRooms(callback) {
  const q = query(collection(db, D), where("status", "==", "waiting"));
  return onSnapshot(q, snap => {
    const cutoff = Date.now() - STALE_MS;
    const rooms = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => !r.createdAt || r.createdAt.toMillis() > cutoff)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(rooms);
  }, () => callback([]));
}

export async function cleanupStaleDungeonRooms() {
  try {
    const cutoff = Date.now() - STALE_MS;
    const snap = await getDocs(query(collection(db, D), where("status", "==", "waiting")));
    const stale = snap.docs.filter(d => {
      const t = d.data().createdAt?.toMillis?.();
      return t && t < cutoff;
    });
    await Promise.all(stale.map(d => deleteDoc(d.ref)));
  } catch (_) {}
}

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

// 訂閱收藏品（即時同步，用於圖鑑頁）
// cb 接收：{ [itemId]: qty }
export function subscribeCollectibles(memberId, cb) {
  return onSnapshot(doc(db, "members", memberId), snap => {
    cb(snap.data()?.dungeonCollectibles || {});
  }, () => cb({}));
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
  const snap = await getDocs(collection(db, D));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  return snap.size;
}
