// src/worldboss/domain/raidQuota.js
// ─────────────────────────────────────────────────────────────
// 每日出擊次數。
//
// ⚠️ 現行線上規則是**每日一次**，server 端在 `worldBossDb.js:370` 用
//    `participants[memberId].lastAttackedDate` 擋。這支把它抽成可設定的配額，
//    並且**相容舊資料**：只有 lastAttackedDate 沒有計數器的舊玩家，
//    當天視為已用 1 次（不然改版當下所有人會平白多出次數）。
//
// 想改成每日 3 次就只動 RAID_DAILY_ATTEMPTS 這一行——其餘邏輯都是從它推出來的。
//
// 組隊規則（作者 2026-07-31）：**各扣各的**，而且出發前要確定
// **全隊每個人都還有次數**才能一起打（見 raidTeam.canTeamDepart）。
// ─────────────────────────────────────────────────────────────

export const RAID_DAILY_ATTEMPTS = 1;

export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 今天已經用掉幾次。
 * participant 形狀（沿用既有 worldBossEvents/{id}.participants[memberId]）：
 *   { lastAttackedDate: "2026-07-31", attemptDate: "2026-07-31", attempts: 2 }
 */
export function attemptsUsed(participant, dateKey = todayKey()) {
  if (!participant) return 0;
  if (participant.attemptDate === dateKey) {
    return Math.max(0, Math.floor(Number(participant.attempts) || 0));
  }
  // 舊資料相容：只有 lastAttackedDate → 當天算已用 1 次
  if (participant.lastAttackedDate === dateKey) return 1;
  return 0;
}

export function remainingAttempts(participant, dateKey = todayKey()) {
  return Math.max(0, RAID_DAILY_ATTEMPTS - attemptsUsed(participant, dateKey));
}

export function canRaid(participant, dateKey = todayKey()) {
  return remainingAttempts(participant, dateKey) > 0;
}

/**
 * 扣一次。回傳新的 participant 物件（不改原本的）。
 * lastAttackedDate 一併更新，這樣舊的 server 檢查也還是對的。
 */
export function consumeAttempt(participant, dateKey = todayKey()) {
  const used = attemptsUsed(participant, dateKey);
  return {
    ...(participant || {}),
    attemptDate: dateKey,
    attempts: used + 1,
    lastAttackedDate: dateKey,
  };
}

// UI 用的一句話
export function quotaLabel(participant, dateKey = todayKey()) {
  const left = remainingAttempts(participant, dateKey);
  if (left <= 0) return { text: "今日次數已用完", color: "#f87171", left };
  return { text: `今日還可出擊 ${left} 次`, color: "#4ade80", left };
}
