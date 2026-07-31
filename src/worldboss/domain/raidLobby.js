// src/worldboss/domain/raidLobby.js
// ─────────────────────────────────────────────────────────────
// 出擊前的兩個畫面所需要的**純邏輯**：
//
//   ・單人房（RaidSoloRoom）  ——「我今天還能不能打、打哪一隻、用什麼靶」
//   ・等待室（RaidWaitRoom）  ——「誰在房裡、誰還沒準備、房主能不能按出發」
//
// ⚠️ 為什麼要獨立一支：房間文件的形狀（members 是 map、host 標在房間層）
//    跟畫面要的東西（排好序的陣列、擋出發的原因清單）差很多。
//    把這段轉換寫在元件裡，等到接 Firestore 的時候就沒辦法寫測試——
//    而「誰擋住出發」正是最容易錯、又最需要講清楚給玩家看的地方。
//
// ⚠️ 這裡不碰 Firestore，也不 import 任何 UI。房間文件當成一包純資料傳進來。
// ─────────────────────────────────────────────────────────────

import { RAID_MAX_TEAM, RAID_MIN_TEAM, canTeamDepart, teamGaugeMax, teamStatBonus } from "./raidTeam";
import { canRaid, remainingAttempts, todayKey } from "./raidQuota";

/** 房間裡「還在」的成員 id（離開的人會被設成 null，不是刪掉） */
export function activeMemberIds(room) {
  const members = room?.members || {};
  return Object.keys(members).filter(id => members[id]);
}

/**
 * 把房間文件的 members map 攤成畫面要用的陣列。
 * **房主排第一**，其餘照加入順序——名單每次重繪順序都要一樣，
 * 不然監聽一有更新，整排人就會跳來跳去。
 */
export function lobbyRoster(room, { participants = {}, dateKey = todayKey(), myId = null } = {}) {
  const members = room?.members || {};
  return activeMemberIds(room)
    .map(id => {
      const m = members[id] || {};
      const participant = participants[id] || {};
      return {
        memberId: id,
        name: m.name || id,
        ready: !!m.ready,
        isHost: id === room?.hostId,
        isMe: myId != null && id === myId,
        archerLevel: Number(m.archerLevel) || 1,
        stats: { atk: Number(m.atk) || 0, def: Number(m.def) || 0, hp: Number(m.hp) || 0 },
        cats: Array.isArray(m.cats) ? m.cats : [],
        // ⚠️ 靶紙與射程是**各自的**（作者 2026-07-31）：有人射長有人射短。
        //    房間層的那一份只是新人加入時的預設值，不是全隊的設定。
        targetFmt: m.targetFmt || room?.targetFmt || "half_17",
        distanceM: Number(m.distanceM) || Number(room?.distanceM) || 10,
        joinedAt: m.joinedAt?.seconds ?? m.joinedAt ?? 0,
        participant,
        canGo: canRaid(participant, dateKey),
        left: remainingAttempts(participant, dateKey),
      };
    })
    .sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
}

/**
 * 等待室的完整檢視。
 *
 * ⚠️ `depart.blockers` 一定要**全部列出來**，不能只回第一個。
 *    房主看到「還不能出發」卻不知道是誰卡住，只會一直亂點。
 */
export function lobbyView(room, myId, { participants = {}, dateKey = todayKey() } = {}) {
  const roster = lobbyRoster(room, { participants, dateKey, myId });
  const size = roster.length;
  const check = canTeamDepart(
    roster.map(m => ({ memberId: m.memberId, name: m.name, ready: m.ready, participant: m.participant })),
    dateKey,
  );
  const me = roster.find(m => m.isMe) || null;

  return {
    roomId: room?.id || null,
    code: room?.code || "",
    status: room?.status || "waiting",
    bossKey: room?.bossKey || null,
    // 房間層的這兩個只是**預設值**——每個人真正用的在 roster[i] 上
    defaultTargetFmt: room?.targetFmt || null,
    defaultDistanceM: Number(room?.distanceM) || 0,
    isHost: !!myId && room?.hostId === myId,
    hostName: room?.hostName || "",
    roster, size, me,
    meReady: !!me?.ready,
    readyCount: roster.filter(m => m.ready).length,
    full: size >= RAID_MAX_TEAM,
    tooFew: size < RAID_MIN_TEAM,
    depart: { ok: check.ok, blockers: check.blockers || [] },
    // 出發前就先讓大家看到組隊的好處——這是玩家願意等人的理由
    bonus: teamStatBonus(size),
    gaugeMax: teamGaugeMax(size),
  };
}

/**
 * 單人房能不能出擊。
 * 形狀刻意跟 `lobbyView().depart` 一樣——兩個畫面共用同一顆「出發鈕」的判斷寫法。
 */
export function soloDepart({ participant = {}, dateKey = todayKey(), bossAlive = true } = {}) {
  const blockers = [];
  if (!bossAlive) blockers.push({ code: "boss_down", text: "這隻王已經被討伐了" });
  if (!canRaid(participant, dateKey)) {
    blockers.push({ code: "no_attempts", text: "今天的討伐次數已經用完了" });
  }
  return { ok: blockers.length === 0, blockers, left: remainingAttempts(participant, dateKey) };
}

/** 公開房列表的一列。刻意精簡——列表是所有人都會讀的東西。 */
export function roomSummary(room) {
  const size = activeMemberIds(room).length;
  return {
    roomId: room?.id || null,
    code: room?.code || "",
    hostName: room?.hostName || "房主",
    bossKey: room?.bossKey || null,
    memberNames: activeMemberIds(room).map(id => room.members[id]?.name || id),
    size, full: size >= RAID_MAX_TEAM,
    joinable: room?.status === "waiting" && size < RAID_MAX_TEAM,
  };
}

/**
 * 直接列出可加入的房間（作者 2026-07-31：**不要用組隊碼進入**）。
 *
 * ⚠️ 只列**同一隻王**的房：世界王一次只有一隻，但活動換王的瞬間可能有殘留的舊房，
 *    點進去會打到一隻已經結束的王。
 * ⚠️ 我已經在裡面的房不列——那要走「回到隊伍」，不是「加入」。
 * 排序：人多的排前面（快要能出發的優先），同人數再看誰先開的。
 */
export function openRoomList(rooms = [], { bossKey = null, myId = null } = {}) {
  return (Array.isArray(rooms) ? rooms : [])
    .filter(r => r && (!bossKey || r.bossKey === bossKey))
    .filter(r => !(myId && r.members?.[myId]))
    .map(roomSummary)
    .filter(r => r.joinable)
    .sort((a, b) => b.size - a.size || String(a.code).localeCompare(String(b.code)));
}

/** 我是不是已經在某個房裡了（重整回來要接得回去） */
export function myOpenRoom(rooms = [], myId = null) {
  if (!myId) return null;
  const found = (Array.isArray(rooms) ? rooms : []).find(r => r?.members?.[myId]);
  return found ? roomSummary(found) : null;
}

/** 房主看的一句話：還缺誰 */
export function blockerSummary(blockers = []) {
  if (!blockers.length) return "";
  const notReady = blockers.filter(b => b.code === "not_ready").length;
  const noAttempts = blockers.filter(b => b.code === "no_attempts");
  const parts = [];
  if (blockers.some(b => b.code === "too_few")) parts.push(`至少要 ${RAID_MIN_TEAM} 人`);
  if (notReady) parts.push(`${notReady} 人還沒準備`);
  if (noAttempts.length) parts.push(`${noAttempts.length} 人次數已用完`);
  return parts.join("、") || blockers[0].text;
}
