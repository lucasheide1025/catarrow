// src/lib/dungeonDb.js — dungeonRooms Firestore 操作

import {
  collection, doc, addDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, arrayUnion, getDocs, query, where,
  orderBy, limit, setDoc, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, markDungeonUsed } from "./db";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";
import {
  assignContracts, rerollContract, generatePathOptions,
  drawDungeonEvent, DUNGEON_SHOP_ITEMS, generateDungeonFloors,
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
  role: "front",    // "front" | "rear"
  rearChoice: null, // "heal" | "dmg" | null
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
    if (Object.keys(roomDoc.data().members || {}).length >= 4)
      return { ok:false, reason:"地下城最多 4 人" };
    await updateDoc(doc(db, D, roomDoc.id), {
      [`members.${memberId}`]: DEFAULT_MEMBER(memberName),
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
    // 房主強度縮放：hostAtk / 12 決定怪物難度基底（0.7 ~ 2.0x）
    const hostAtk     = room.hostAtk || 10;
    const hostScale   = Math.max(0.8, Math.min(1.4, hostAtk / 18));
    // 人數加成：每多一名隊友，怪物 HP +10%，玩家 ATK +20%
    const hpMult         = 1.0 + (memberCount - 1) * 0.1;
    const memberAtkMult  = 1.0 + (memberCount - 1) * 0.2;
    const scaledHP  = Math.round(monster.hp * ms.hp * hpMult * hostScale);

    // 一次性分配任務（全程有效，買重置才換）
    const contracts = assignContracts(memberIds);
    const upd = {};
    for (const mid of memberIds) {
      const m = room.members[mid] || {};
      upd[`members.${mid}.arrows`]   = [];
      upd[`members.${mid}.ready`]    = false;
      upd[`members.${mid}.alive`]    = true;
      upd[`members.${mid}.revived`]  = false;
      upd[`members.${mid}.contract`] = contracts[mid];
      // 套用人數 ATK 加成（無論是否有預設值）
      upd[`members.${mid}.atk`] = Math.round((m.atk || 10) * memberAtkMult);
      if (!m.maxHP) {
        upd[`members.${mid}.hp`]    = 500;
        upd[`members.${mid}.maxHP`] = 500;
        upd[`members.${mid}.def`]   = 10;
      }
    }

    await updateDoc(doc(db, D, roomId), {
      ...upd,
      status: "active", length, totalFloors, currentFloor: 1, mode,
      monster: {
        id: monster.id, name: monster.name, icon: monster.icon,
        hp:  Math.round(monster.hp  * ms.hp  * hostScale),
        atk: Math.round(monster.atk * ms.atk * hostScale),
        def: Math.round(monster.def * ms.def),
        tier: monster.tier, family: monster.family,
      },
      monsterHP: scaledHP, monsterMaxHP: scaledHP,
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
      const rearDmgMul = isRear && m.rearChoice === "dmg" ? 1.5 : 1.0;
      const effectiveAtk = rearHeal ? 0 : Math.round((m.atk || 10) * (m.buffs?.atkMult || 1));
      const dmgMult      = (m.buffs?.dmgMult || 1) * (mods.dmgMult || 1) * rearDmgMul;
      const contract     = m.contract || { type:"standard", param:null };
      const raw = rearHeal
        ? { dmg:0, crits:0, arrowBreakdown:(m.arrows||[]).map(l=>({ dmg:0, partIcon:"💚", partName:"治癒", label:l })) }
        : calcDmgFn(m.arrows || [], effectiveAtk, room.monster.def, contract, dmgMult);
      allData[id] = {
        name: m.name || "射手",
        totalDmg: raw.dmg || 0,
        crits:    raw.crits || 0,
        arrowBreakdown: raw.arrowBreakdown || [],
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
    const ARROWS_PER_CTR = 2;
    const miniRounds  = [];
    let   monsterHP   = room.monsterHP || 0;
    const memberHPNow = {};
    for (const id of aliveIds) memberHPNow[id] = members[id].hp || 0;
    const ctrAccum    = {};

    for (let i = 0; i < 6; i++) {
      if (monsterHP <= 0) break;

      // ── 攻擊小回合 ─────────────────────────────────────
      const miniLog = [];
      let   miniDmg = 0;
      for (const id of aliveIds) {
        if (memberHPNow[id] <= 0) continue;
        const m     = members[id];
        const entry = allData[id].arrowBreakdown[i] || { dmg:0, partIcon:"💨", partName:"脫靶", label:"M" };
        const dmg   = entry.dmg || 0;
        miniDmg    += dmg;
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

      // ── 反擊小回合（每 ARROWS_PER_CTR 箭後，怪物尚存時；後衛免疫反擊）──
      if (!skipAllCtr && (i + 1) % ARROWS_PER_CTR === 0 && monsterHP > 0) {
        const monsterAtk = Math.round((room.monster.atk || 10) * (mods.monsterAtkMult || 1));
        const ctrLog     = [];
        const ctrTargets = frontIds.length > 0 ? frontIds : rearIds; // 前衛全滅時後衛暴露
        for (const id of ctrTargets) {  // 有前衛→只打前衛；前衛全陣亡→打後衛
          if (memberHPNow[id] <= 0) continue;
          const m            = members[id];
          const effectiveDef = Math.round((m.def || 10) * (m.buffs?.defMult || 1));
          const ctr          = Math.ceil(calcCtrFn(monsterAtk, effectiveDef));
          ctrAccum[id]       = (ctrAccum[id] || 0) + ctr;
          const prevHP       = memberHPNow[id];
          memberHPNow[id]    = Math.max(0, prevHP - ctr);
          const died         = prevHP > 0 && memberHPNow[id] <= 0;
          ctrLog.push({
            id, name:m.name, dmg:0, ctr, arrowBreakdown:[],
            message: `${room.monster.icon||"👾"} ${room.monster.name} 反擊 ${m.name}，造成 ${ctr} 傷害！${died ? ` 💀 ${m.name} 陣亡！` : ""}`,
            died,
          });
        }
        miniRounds.push({
          miniRound: null, isCounter: true,
          playerLog: ctrLog, totalDmg: 0, monsterHPAfter: monsterHP,
        });
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
      monsterHP = Math.max(0, monsterHP - catTotalDmg);
      miniRounds.push({
        miniRound: "cat", isCounter: false, isCat: true,
        playerLog: catMiniLog, totalDmg: catTotalDmg, monsterHPAfter: monsterHP,
      });
    }

    // Step 4：事件額外效果
    const totalDmg = Object.values(allData).reduce((s, p) => s + p.totalDmg, 0) + catTotalDmg;
    if (eff.extraDmg)  monsterHP = Math.max(0, monsterHP - eff.extraDmg);
    if (eff.monsterHP) monsterHP = Math.max(0, monsterHP + eff.monsterHP);

    // Step 5：更新成員 HP（含復活符 + 前後衛死亡邏輯）
    const memberUpd = {};
    let   liveAfter = 0;
    for (const id of aliveIds) {
      const m      = members[id];
      const isRear = m.role === "rear";
      let hp       = memberHPNow[id];
      // 後衛heal：回復 25% maxHP（不計傷害）
      if (allData[id]?.rearHeal) hp = Math.min(m.maxHP || 9999, hp + Math.round((m.maxHP || 100) * 0.25));
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
          // 前衛第一次死亡 → 變後衛，HP 復活 50%
          hp = Math.round((m.maxHP || 100) * 0.5);
          memberUpd[`members.${id}.role`] = "rear";
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
    };

    // Step 7：判斷結果 & 下一狀態
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

    await updateDoc(doc(db, D, roomId), {
      ...memberUpd,
      monsterHP, round: round + 1,
      log: arrayUnion(logEntry),
      result, status: newStatus,
      processing: false,
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
      upd.shopItems     = shuffled.slice(0, 4);
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
    const upd = { [`shopPurchases.${memberId}`]: arrayUnion(item.id) };

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
      case "contract_reset":
        upd[`members.${memberId}.contractReset`] = true;
        break;
      case "revival":
        upd[`members.${memberId}.buffs.hasRevival`] = true;
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
      case "contract_reassign": {
        const newC = assignContracts(aliveIds);
        for (const id of aliveIds) upd[`members.${id}.contract`] = newC[id];
        break;
      }
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
    }

    await updateDoc(doc(db, D, roomId), upd);
    return { ok:true };
  } catch (e) { return { ok:false, reason:e.message }; }
}

// ── 進入下一層（房主呼叫）────────────────────────────────────
export async function advanceDungeonFloor(roomId, room, nextMonster) {
  try {
    const currentFloor = (room.currentFloor || 0) + 1;
    const mode         = room.mode || "student";
    const ms           = MODE_SCALE[mode] || MODE_SCALE.student;
    const mods         = room.nextFloorModifiers || {};
    const chosenPath   = room.pathOptions?.[room.chosenPath || "A"];
    const eliteBoost   = chosenPath?.eliteBoost || 1.0;
    const memberIds    = Object.keys(room.members || {});

    const hostAtk   = room.hostAtk || 10;
    const hostScale = Math.max(0.8, Math.min(1.4, hostAtk / 18)); // 與 startDungeonFloor 一致
    const hpMult    = (1.0 + (memberIds.length - 1) * 0.1) * eliteBoost * (mods.monsterHpMult || 1);
    const atkMult   = eliteBoost * (mods.monsterAtkMult || 1);
    const scaledHP  = Math.round(nextMonster.hp  * ms.hp  * hpMult * hostScale);
    const scaledAtk = Math.round(nextMonster.atk * ms.atk * atkMult * hostScale);
    const scaledDef = Math.round(nextMonster.def * ms.def);

    // 每換一層怪物就重新抽任務
    const aliveIds = memberIds.filter(id => room.members[id].alive);
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
        tier: nextMonster.tier, family: nextMonster.family,
      },
      monsterHP: scaledHP, monsterMaxHP: scaledHP,
      round: 1, log: [], result: null,
      status: "active", processing: false,
      pathOptions: null, chosenPath: null,
      shopItems: [], shopPurchases: {},
      currentEvent: null,
      nextFloorModifiers: {},
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
    const { monster = null, formationMap = {}, runeMap = {} } = options;
    const contract = roomMeta?.contract
      ? { type: roomMeta.contract, param: roomMeta.contractParam ?? null }
      : { type:"standard", param:null };
    const memberIds = Object.keys(room.members || {});
    const upd = {};
    for (const id of memberIds) {
      upd[`members.${id}.contract`]  = contract;
      upd[`members.${id}.arrows`]    = [];
      upd[`members.${id}.ready`]     = false;
      if (formationMap[id]) upd[`members.${id}.formation`] = formationMap[id];
      if (runeMap[id])      upd[`members.${id}.rune`]      = runeMap[id];
    }
    const monsterHP = monster?.hp || 100;
    await updateDoc(doc(db, D, roomId), {
      ...upd,
      monster:             monster,
      monsterHP:           monsterHP,
      monsterMaxHP:        monsterHP,
      status:              "active",
      activeRoomContract:  contract,
      round:               1,
      log:                 [],
      result:              null,
      processing:          false,
      totalFloors:         1,
      currentFloor:        1,
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

// 累積地圖戰利品
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
    // 先確認尚未有首殺廣播
    const snap = await getDocs(query(collection(db, "dungeonBroadcasts"), where("dungeonId", "==", dungeonId)));
    if (!snap.empty) return { ok: true, isFirst: false };
    // 直接 setDoc（不存在才建立）
    await setDoc(doc(db, "dungeonFirstClear", dungeonId), {
      dungeonId, memberId, memberName, teamNames,
      clearedAt: serverTimestamp(),
    });
    return { ok: true, isFirst: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 新增地下城首殺廣播（全域通知用）
export async function addDungeonBroadcast(dungeonId, dungeonName, difficultyLabel, emoji, teamNames = []) {
  try {
    const ref = await addDoc(collection(db, "dungeonBroadcasts"), {
      dungeonId, dungeonName, difficultyLabel, emoji,
      teamNames,
      createdAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// 取得某個 dungeon 是否已被首殺
export async function checkDungeonFirstClear(dungeonId) {
  try {
    const snap = await getDocs(query(collection(db, "dungeonBroadcasts"), where("dungeonId", "==", dungeonId)));
    return { ok: true, isFirstClear: !snap.empty, data: snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
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
