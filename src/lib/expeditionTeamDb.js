// src/lib/expeditionTeamDb.js — 組隊遠征房間管理
// 使用 dungeonRooms 集合儲存組隊等待室

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc, getDocs, query, where, onSnapshot,
  runTransaction, deleteField, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  cloneExpeditionChests,
  mergeExpeditionLoot,
  mergeExpeditionStats,
} from "./expeditionRewards";
import { normalizeDungeonRunSettings } from "./dungeonRunSettings";
import { isMonsterExpansionEnabled } from "./monsterExpansionFeature";
import { getDungeonDewMultiplier } from "./dungeonKillRewards";

const D = "dungeonRooms";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createTeamExpeditionRoom({
  hostId, hostName, dungeon, memberData,
}) {
  try {
    if (!hostId || !dungeon) return { ok: false, reason: "參數錯誤" };
    const code = genCode();
    const settings = normalizeDungeonRunSettings(dungeon);
    const expansionRunId = `team:${hostId}:${Date.now()}:${code}`;
    const bossEncounter = isMonsterExpansionEnabled()
      ? (await import("./dungeonBossEncounter")).createLockedDungeonBossEncounter({
          runId:expansionRunId,
          roomId:"floor-3-boss",
          family:dungeon.family,
          difficultyTier:dungeon.difficulty,
          lockedEncounter:dungeon.bossEncounter || null,
        })
      : null;
    const member = {
      name: hostName,
      accountType: memberData?.accountType || "official",
      hp: memberData?.hp ?? 500,
      maxHP: memberData?.maxHP ?? 500,
      atk: memberData?.atk ?? 10,
      def: memberData?.def ?? 10,
      alive: true,
      ready: false,
      catId: memberData?.catId || "",
      catName: memberData?.catName || "",
      catType: memberData?.catType || "",
      catXP: memberData?.catXP ?? 0,
      catBond: memberData?.catBond ?? 0,
      archerStyle: memberData?.archerStyle || "baobao",
      catAtk: memberData?.catAtk ?? 0,
      wbBonus: memberData?.wbBonus || null,
      avatarId: memberData?.avatarId || null,
      battleCosmetics: memberData?.battleCosmetics || null,
      joinedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, D), {
      code, hostId, hostName,
      status: "expedition_waiting",
      // 出圖時決定的掉落倍數（1~3,固定整場;只影響中途擊殺寶箱,不影響王房/獎勵房/結算）
      lootMult: 1 + Math.floor(Math.random() * 3),
      expeditionTeamMode: true,
      dungeonFamily: dungeon.family,
      dungeonDifficulty: dungeon.difficulty,
      dungeonIsHidden: dungeon.isHidden || false,
      dungeonSavedId: dungeon.id || null,
      dungeonBoss: bossEncounter?.monsterSnapshot || dungeon.boss || null,
      ...(bossEncounter ? {
        expansionRunId,
        runVersion:bossEncounter.runVersion,
        bossEncounter,
      } : {}),
      arrowsPerRound: settings.arrowsPerRound,
      targetFmt: settings.targetFmt,
      members: { [hostId]: member },
      createdAt: serverTimestamp(),
    });
    return { ok: true, roomId: ref.id, code };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function joinTeamExpeditionRoom(code, memberId, memberName, memberData = {}) {
  try {
    const snap = await getDocs(
      query(collection(db, D),
        where("code", "==", code.toUpperCase()),
        where("status", "==", "expedition_waiting"),
        where("expeditionTeamMode", "==", true))
    );
    if (snap.empty) return { ok: false, reason: "找不到此房間，或遠征已開始" };
    const roomDoc = snap.docs[0];
    const member = {
      name: memberName,
      accountType: memberData?.accountType || "official",
      hp: memberData?.hp ?? 500,
      maxHP: memberData?.maxHP ?? 500,
      atk: memberData?.atk ?? 10,
      def: memberData?.def ?? 10,
      alive: true,
      ready: false,
      catId: memberData?.catId || "",
      catName: memberData?.catName || "",
      catType: memberData?.catType || "",
      catXP: memberData?.catXP ?? 0,
      catBond: memberData?.catBond ?? 0,
      archerStyle: memberData?.archerStyle || "baobao",
      catAtk: memberData?.catAtk ?? 0,
      wbBonus: memberData?.wbBonus || null,
      avatarId: memberData?.avatarId || null,
      battleCosmetics: memberData?.battleCosmetics || null,
      joinedAt: serverTimestamp(),
    };
    const roomRef = doc(db, D, roomDoc.id);
    const roomData = await runTransaction(db, async tx => {
      const latest = await tx.get(roomRef);
      if (!latest.exists()) throw new Error("房間不存在");
      const data = latest.data();
      if (data.status !== "expedition_waiting") throw new Error("遠征已開始");
      const members = Object.fromEntries(
        Object.entries(data.members || {}).filter(([, value]) => value != null)
      );
      if (members[memberId]) throw new Error("你已在房間中");
      if (Object.keys(members).length >= 8) throw new Error("房間已滿（最多 8 人）");
      tx.update(roomRef, { [`members.${memberId}`]: member });
      return data;
    });
    const settings = normalizeDungeonRunSettings(roomData);
    return { ok: true, roomId: roomDoc.id, dungeon: {
      family: roomData.dungeonFamily,
      difficulty: roomData.dungeonDifficulty,
      isHidden: roomData.dungeonIsHidden,
      savedId: roomData.dungeonSavedId,
      boss: roomData.dungeonBoss || null,
      expansionRunId: roomData.expansionRunId || null,
      bossEncounter: roomData.bossEncounter || null,
      ...settings,
    }, hostId: roomData.hostId, hostName: roomData.hostName };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 等待室選擇初始角色（前衛/後衛）────────────────────────
// 已改為新模型：開場全員前衛，無上限；前衛倒下自動復活轉後衛
// 保留函式避免匯入端報錯，但不再被 UI 呼叫（等待室已移除選角步驟）
export async function setTeamExpeditionMemberRole(roomId, memberId, role) {
  try {
    if (!["front", "rear"].includes(role)) return { ok: false, reason: "角色錯誤" };
    await updateDoc(doc(db, D, roomId), {
      [`members.${memberId}.role`]: role,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export function subscribeTeamExpeditionRoom(roomId, cb) {
  return onSnapshot(doc(db, D, roomId), snap => {
    if (snap.exists()) {
      cb({ id: snap.id, ...snap.data() });
    } else {
      cb(null);
    }
  }, () => cb(null));
}

export async function leaveTeamExpeditionRoom(roomId, memberId) {
  try {
    await updateDoc(doc(db, D, roomId), {
      [`members.${memberId}`]: deleteField(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function startTeamExpeditionRoom(roomId, hostId) {
  try {
    const roomRef = doc(db, D, roomId);
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("房間不存在");
      const data = snap.data();
      if (data.hostId !== hostId) throw new Error("只有房主可以開始遠征");
      if (data.status !== "expedition_waiting") throw new Error("遠征已開始");
      const memberRef = doc(db, "members", hostId);
      const memberSnap = data.dungeonSavedId ? await tx.get(memberRef) : null;
      if (data.dungeonSavedId) {
        if (!memberSnap?.exists()) throw new Error("找不到房主資料");
        const saved = memberSnap.data().dungeonExcavation?.savedDungeons || [];
        if (!saved.some(dungeon => dungeon.id === data.dungeonSavedId)) {
          throw new Error("這個地下城已不存在於儲存槽");
        }
        tx.update(memberRef, {
          "dungeonExcavation.savedDungeons": saved.filter(
            dungeon => dungeon.id !== data.dungeonSavedId,
          ),
        });
      }
      tx.update(roomRef, {
        status: "expedition_active",
        expeditionPhase: "preparing",
        startedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function updateTeamExpeditionSettings(roomId, hostId, nextSettings) {
  try {
    const roomRef = doc(db, D, roomId);
    const settings = normalizeDungeonRunSettings(nextSettings);
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("房間不存在");
      const data = snap.data();
      if (data.hostId !== hostId) throw new Error("只有房主可以修改遠征規則");
      if (data.status !== "expedition_waiting") throw new Error("遠征開始後不能修改規則");
      tx.update(roomRef, settings);
    });
    return { ok:true, ...settings };
  } catch (e) {
    return { ok:false, reason:e.message };
  }
}

export async function disbandTeamExpeditionRoom(roomId, hostId) {
  try {
    const snap = await getDoc(doc(db, D, roomId));
    if (!snap.exists()) return { ok: false, reason: "房間不存在" };
    const data = snap.data();
    if (data.hostId !== hostId) return { ok: false, reason: "只有房主可以解散房間" };
    await updateDoc(doc(db, D, roomId), { status: "completed", result: "disbanded" });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function cleanupTeamExpeditionRoom(roomId) {
  try {
    await deleteDoc(doc(db, D, roomId));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 建立組隊遠征戰鬥房間（包含所有隊員）───────────────────
// 與 createExpeditionBattleRoom 類似，但包含多人
export async function createTeamExpeditionBattleRoom({
  members,  // [{ memberId, name, hp, maxHP, atk, def, catId, catName, archerStyle, catAtk }]
  hostId,
  monster,
  difficultyTier,
  floorIndex,
  roomType = "monster",
  arrowsPerRound = 6,
  targetFmt = "full_110",
}) {
  try {
    if (!members?.length || !monster) return { ok: false, reason: "參數錯誤" };
    const settings = normalizeDungeonRunSettings({ arrowsPerRound, targetFmt });

    const floorScale = [1.0, 1.05, 1.2][Math.min(floorIndex, 2)] || 1.0;
    // 組隊遠征人數加成（2026-07-18 使用者規格）：怪物強度 +10%/額外隊員,要顯示（partyBonusPct 存進房間）
    const partyBonusPct = Math.max(0, (members.length - 1)) * 10;
    const partyScale = 1 + partyBonusPct / 100;
    const finalMonster = {
      ...monster,
      hp:  Math.round((monster.hp || 100) * floorScale * partyScale),
      atk: Math.round((monster.atk || 10) * floorScale * partyScale),
      def: Math.round((monster.def || 5) * floorScale * partyScale),
      partyBonusPct,
    };

    if (!hostId || !members.some(m => m.memberId === hostId)) {
      return { ok: false, reason: "找不到組隊房主" };
    }
    const memberEntries = {};
    for (const m of members) {
      memberEntries[m.memberId] = {
        name: m.name || "射手",
        hp: m.hp ?? 500,
        maxHP: m.maxHP ?? 500,
        atk: m.atk ?? 10,
        def: m.def ?? 10,
        alive: m.alive !== false,
        ready: false,
        arrows: [],
        validRounds: 0,
        contract: { type: "standard", param: null },
        buffs: m.buffs || { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
        revived: false,
        role: m.role || "front",
        displayGroup: m.displayGroup || m.role || "front",
        rearChoice: null,
        catId: m.catId || "",
        catName: m.catName || "",
        catType: m.catType || "",
        catXP: m.catXP ?? 0,
        catBond: m.catBond ?? 0,
        archerStyle: m.archerStyle || "baobao",
        catAtk: m.catAtk || 0,
        wbBonus: m.wbBonus || null,
        avatarId: m.avatarId || null,
        battleCosmetics: m.battleCosmetics || null,
      };
    }

    const ref = await addDoc(collection(db, D), {
      status: "active",
      mode: "student",
      hostId,
      currentFloor: floorIndex + 1,
      totalFloors: 3,
      arrowsPerRound: settings.arrowsPerRound,
      targetFmt: settings.targetFmt,
      rewardMult: 1.0,
      monster: finalMonster,
      monsterHP: finalMonster.hp,
      monsterMaxHP: finalMonster.hp,
      round: 1,
      log: [],
      result: null,
      processing: false,
      members: memberEntries,
      expeditionMode: true,
      expeditionDifficulty: difficultyTier,
      expeditionRoomType: roomType,
      expeditionFloorIndex: floorIndex,
      mapDungeonId: "expedition",
      createdAt: serverTimestamp(),
    });

    return { ok: true, roomId: ref.id };
  } catch (e) {
    // 同 updateTeamExpeditionRoom：帶出錯誤碼，才分得清資料格式(invalid-argument)與權限(permission-denied)
    console.error("[createTeamExpeditionBattleRoom]", e?.code, e?.message);
    return { ok: false, reason: `${e?.code || "error"}: ${e?.message || e}` };
  }
}

// ── 更新組隊遠征房間的協調欄位 ──────────────────────────
export async function updateTeamExpeditionRoom(roomId, fields) {
  try {
    await updateDoc(doc(db, D, roomId), fields);
    return { ok: true };
  } catch (e) {
    // 帶出 Firestore 的錯誤碼（invalid-argument / permission-denied…）：
    // 只有 e.message 時常看不出是資料格式問題還是權限問題。
    console.error("[updateTeamExpeditionRoom]", e?.code, e?.message, Object.keys(fields || {}));
    return { ok: false, reason: `${e?.code || "error"}: ${e?.message || e}` };
  }
}

export async function syncTeamExpeditionMembers(roomId, battleMembers, battleSummary = null) {
  try {
    const roomRef = doc(db, D, roomId);
    const result = await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("組隊房間不存在");
      const data = snap.data();
      const current = data.members || {};
      const next = {};
      for (const [memberId, member] of Object.entries(current)) {
        if (!member) continue;
        const battleMember = battleMembers?.[memberId];
        next[memberId] = battleMember ? {
          ...member,
          hp: battleMember.hp ?? member.hp,
          maxHP: battleMember.maxHP ?? member.maxHP,
          atk: battleMember.atk ?? member.atk,
          def: battleMember.def ?? member.def,
          alive: battleMember.alive !== false,
          role: battleMember.role || member.role || "front",
          displayGroup: battleMember.displayGroup || battleMember.role || member.displayGroup || member.role || "front",
          buffs: battleMember.buffs || member.buffs || { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
          ready: false,
        } : member;
      }
      const loot = battleSummary?.loot
        ? mergeExpeditionLoot(data.expeditionLoot, battleSummary.loot)
        : (data.expeditionLoot || null);
      const stats = battleSummary?.stats
        ? mergeExpeditionStats(data.expeditionStats, battleSummary.stats)
        : (data.expeditionStats || {});
      tx.update(roomRef, {
        members: next,
        ...(loot ? { expeditionLoot: loot } : {}),
        expeditionStats: stats,
      });
      return { members: next, loot, stats };
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function claimTeamExpeditionResult(roomId, memberId, record = {}) {
  try {
    const roomRef = doc(db, D, roomId);
    const result = await runTransaction(db, async tx => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) throw new Error("遠征結算房間不存在");
      const data = roomSnap.data();
      if (!data.members?.[memberId]) throw new Error("你不是這次遠征的成員");
      if (!data.expeditionResult?.rewards) throw new Error("遠征結果尚未完成");
      const claims = data.resultClaims || {};
      if (claims[memberId]) {
        const activeIds = Object.entries(data.members || {})
          .filter(([, member]) => member != null)
          .map(([id]) => id);
        return {
          alreadyClaimed: true,
          allClaimed: activeIds.every(id => claims[id]),
        };
      }

      const memberRef = doc(db, "members", memberId);
      const chestRef = doc(db, "chestInventory", memberId);
      const materialRef = doc(db, "materialInventory", memberId);
      const memberSnap = await tx.get(memberRef);
      const chestSnap = await tx.get(chestRef);
      const materialSnap = await tx.get(materialRef);
      if (!memberSnap.exists()) throw new Error("找不到會員資料");

      const memberData = data.members?.[memberId] || {};
      const isGuestMember = ["guest", "kid"].includes(memberData.accountType);
      const rewards = data.expeditionResult.rewards;
      const rawCoins = (rewards.coins || 0)
        + (data.expeditionResult.loot?.bonusCoins || 0);
      const totalCoins = isGuestMember
        ? Math.min(rawCoins, Math.max(20, (data.dungeonDifficulty || 1) * 50))
        : rawCoins;
      // 箭露：基準 × 難度倍率 × 5（使用者拍板;dungeonKillRewards.getDungeonDewMultiplier）
      const totalArrowDew = isGuestMember ? 0 : Math.round(((rewards.arrowDew || 0)
        + (data.expeditionResult.loot?.bonusArrowDew || 0)) * getDungeonDewMultiplier(data.dungeonDifficulty));
      const chests = isGuestMember ? [] : cloneExpeditionChests(
        data.expeditionResult.loot?.chests || [],
        memberId,
      );
      const kingVault = isGuestMember ? null : data.expeditionResult.loot?.kingVault;
      const materialItems = { ...(materialSnap.data()?.items || {}) };
      (kingVault?.materials || []).forEach(material => {
        if (material?.id) materialItems[material.id] = (materialItems[material.id] || 0) + 1;
      });
      const previousRecords = memberSnap.data().expeditionRecords || [];
      const newRecord = {
        id: `er_${roomId}_${memberId}`,
        completedAt: new Date().toISOString(),
        ...record,
        coins: totalCoins,
        arrowDew: totalArrowDew,
        archerXP: isGuestMember ? 0 : (rewards.archerXP || 0),
      };
      const nextClaims = { ...claims, [memberId]: true };
      const activeIds = Object.entries(data.members || {})
        .filter(([, member]) => member != null)
        .map(([id]) => id);
      tx.update(roomRef, { resultClaims: nextClaims });
      tx.update(memberRef, {
        ...(totalCoins > 0 ? { coins: increment(totalCoins) } : {}),
        ...(totalArrowDew > 0
          ? { "village.resources.arrowdew": increment(totalArrowDew) }
          : {}),
        ...(!isGuestMember && rewards.archerXP > 0 ? { archerXP: increment(rewards.archerXP) } : {}),
        ...(kingVault?.kingSeals ? { kingSeals: increment(kingVault.kingSeals) } : {}),
        ...Object.fromEntries((kingVault?.runeFragments || [])
          .filter(fragment => fragment?.type && fragment.count > 0)
          .map(fragment => [`equipmentRuneFragments.${fragment.type}`, increment(fragment.count)])),
        expeditionRecords: [newRecord, ...previousRecords].slice(0, 20),
      });
      if (chests.length > 0) {
        tx.set(chestRef, {
          chests: [...(chestSnap.data()?.chests || []), ...chests],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      if ((kingVault?.materials || []).length > 0) {
        tx.set(materialRef, { items: materialItems, updatedAt: serverTimestamp() }, { merge: true });
      }
      return {
        alreadyClaimed: false,
        allClaimed: activeIds.every(id => nextClaims[id]),
        rewards,
        chestCount: chests.length,
      };
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export function subscribeOpenTeamExpeditionRooms(cb) {
  const q = query(
    collection(db, D),
    where("status", "==", "expedition_waiting"),
    where("expeditionTeamMode", "==", true),
  );
  return onSnapshot(q, snap => {
    const rooms = snap.docs.map(d => {
      const data = d.data();
      const memberCount = Object.values(data.members || {}).filter(Boolean).length;
      return {
        id: d.id, code: data.code, hostId: data.hostId,
        hostName: data.hostName,
        dungeonFamily: data.dungeonFamily,
        dungeonDifficulty: data.dungeonDifficulty,
        dungeonIsHidden: data.dungeonIsHidden,
        memberCount, createdAt: data.createdAt,
      };
    });
    cb(rooms);
  }, () => cb([]));
}

export async function findReconnectableTeamExpedition(memberId) {
  if (!memberId) return { ok:false, reason:"缺少會員資料", room:null };
  try {
    const snap = await getDocs(query(
      collection(db, D),
      where("expeditionTeamMode", "==", true),
    ));
    const candidates = snap.docs
      .map(roomDoc => ({ id:roomDoc.id, ...roomDoc.data() }))
      .filter(room => {
        if (!room.members?.[memberId]) return false;
        if (!["expedition_waiting", "expedition_active"].includes(room.status)) return false;
        if (room.expeditionPhase === "result" && room.resultClaims?.[memberId]) return false;
        return true;
      })
      .sort((a, b) => {
        const priority = room => room.expeditionPhase === "result"
          ? 3
          : room.status === "expedition_active"
            ? 2
            : 1;
        const priorityDiff = priority(b) - priority(a);
        if (priorityDiff !== 0) return priorityDiff;
        const time = room => room.startedAt?.toMillis?.()
          || room.createdAt?.toMillis?.()
          || 0;
        return time(b) - time(a);
      });
    return { ok:true, room:candidates[0] || null };
  } catch (e) {
    return { ok:false, reason:e.message, room:null };
  }
}
