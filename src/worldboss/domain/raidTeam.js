// src/worldboss/domain/raidTeam.js
// ─────────────────────────────────────────────────────────────
// 組隊討伐。
//
// ⚠️ 先分清楚兩件**不同**的東西（作者 2026-07-31 特別澄清）：
//
//   ① 參戰助戰（既有，不動）：`getParticipantBonus`——**全場**參戰人數，每人 +5% ATK。
//      這是被動的，不管你有沒有組隊都吃得到。
//   ② 組隊戰鬥（本檔，新增）：2~4 人**同一場、同回合**一起打。
//
//   組隊的價值**不是再加一層數值**，而是讓兩個機制從「單人做不到」變成「組隊做得到」：
//     ・破防槽：單人一場只推得動 10~15 點，槽要 30——四人一起才真的會爆發
//     ・打斷：第三階段要 5 次弱點命中，單人一回合幾乎不可能；分工才成立
//
// 規則（作者定案）：**各扣各的每日次數**，而且出發前要確定**全隊每個人都還有次數**。
// ─────────────────────────────────────────────────────────────

import { BREAK_GAUGE_MAX } from "./breakGauge";
import { INTERRUPT_REQUIRED } from "./bossIntent";
import { canRaid, remainingAttempts, todayKey } from "./raidQuota";

export const RAID_MAX_TEAM = 4;      // 比照公會遠征的 MAX_TEAM_SIZE
export const RAID_MIN_TEAM = 2;

// ⚠️ 門檻用**次線性**放大：線性放大等於組隊完全沒有好處，
//    不放大則四個人每回合都能破防、打斷變成免費。0.6 / 0.7 是讓
//    「人多比較容易，但還是要配合」的係數。
export const TEAM_INTERRUPT_SCALE = 0.6;
export const TEAM_GAUGE_SCALE = 0.7;

export function teamSizeOf(state) {
  return Math.max(1, Math.min(RAID_MAX_TEAM, state?.members?.length || 1));
}

// 這一場的打斷需求（單人時就是原本的值）
export function teamInterruptRequired(phaseId = 1, teamSize = 1) {
  const base = INTERRUPT_REQUIRED[phaseId] || INTERRUPT_REQUIRED[1];
  const n = Math.max(1, Math.min(RAID_MAX_TEAM, teamSize));
  return Math.ceil(base * (1 + (n - 1) * TEAM_INTERRUPT_SCALE));
}

// 這一場的破防槽上限（單人時就是原本的值）
export function teamGaugeMax(teamSize = 1) {
  const n = Math.max(1, Math.min(RAID_MAX_TEAM, teamSize));
  return Math.ceil(BREAK_GAUGE_MAX * (1 + (n - 1) * TEAM_GAUGE_SCALE));
}

/**
 * 出發前的檢查：人數對不對、每個人今天還有沒有次數。
 * 回傳 blockers 而不是只回 false——UI 要能指名道姓說「誰不能去」。
 */
export function canTeamDepart(members = [], dateKey = todayKey()) {
  const blockers = [];
  const roster = Array.isArray(members) ? members : [];

  if (roster.length < RAID_MIN_TEAM) {
    blockers.push({ code: "too_few", text: `至少要 ${RAID_MIN_TEAM} 人才能組隊出擊` });
  }
  if (roster.length > RAID_MAX_TEAM) {
    blockers.push({ code: "too_many", text: `最多 ${RAID_MAX_TEAM} 人` });
  }

  for (const m of roster) {
    if (!m?.memberId) {
      blockers.push({ code: "invalid", text: "隊員資料不完整" });
      continue;
    }
    // ⚠️ 作者指定：要確定玩家還有次數才能一起打
    if (!canRaid(m.participant, dateKey)) {
      blockers.push({
        code: "no_attempts", memberId: m.memberId,
        text: `${m.name || m.memberId} 今天的次數已經用完了`,
      });
    }
    if (!m.ready) {
      blockers.push({
        code: "not_ready", memberId: m.memberId,
        text: `${m.name || m.memberId} 還沒準備好`,
      });
    }
  }

  const ids = roster.map(m => m?.memberId).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    blockers.push({ code: "duplicate", text: "同一個人不能重複加入" });
  }

  return { ok: blockers.length === 0, blockers };
}

// 等待室用：每個隊員的次數狀態
export function teamQuotaSummary(members = [], dateKey = todayKey()) {
  return (members || []).map(m => ({
    memberId: m?.memberId,
    name: m?.name || m?.memberId,
    left: remainingAttempts(m?.participant, dateKey),
    ready: !!m?.ready,
    canGo: canRaid(m?.participant, dateKey),
  }));
}

// 這一回合是不是所有人都送出了（房主要等全隊）
export function allSubmitted(members = [], submissions = {}) {
  const roster = (members || []).map(m => m?.memberId).filter(Boolean);
  if (!roster.length) return false;
  return roster.every(id => Array.isArray(submissions[id]) && submissions[id].length > 0);
}

export function pendingMembers(members = [], submissions = {}) {
  return (members || [])
    .filter(m => m?.memberId && !(Array.isArray(submissions[m.memberId]) && submissions[m.memberId].length))
    .map(m => m.name || m.memberId);
}
