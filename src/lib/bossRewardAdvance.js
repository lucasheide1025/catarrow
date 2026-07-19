// src/lib/bossRewardAdvance.js
// 組隊 Boss 獎勵「是否可前進 / 資格」判定的純函式（無 Firestore、無副作用,方便測試與共用）。
// 原本這段邏輯內嵌在 TeamExpeditionBattle 的 render 與 expeditionTeamDb;抽出以利驗證。
//
// 定義：
//   eligibleMemberIds = 本場 validRounds > 0 的合格隊員（存於房間 bossRewardEligibleMemberIds）。
//   choiceClaims      = { [memberId]: true } 已完成選箱的隊員（房間 bossRewardChoiceClaims）。

// 某隊員是否有資格領取本場 Boss 獎勵（未符合 validRounds → 不在 eligible 名單）。
export function isEligibleForBossReward({ eligibleMemberIds = [], memberId } = {}) {
  if (!memberId || !Array.isArray(eligibleMemberIds)) return false;
  return eligibleMemberIds.includes(memberId);
}

// 尚未完成選箱的合格隊員（斷線未領者仍列於此 → 維持 pending）。
export function pendingBossRewardMembers({ eligibleMemberIds = [], choiceClaims = {} } = {}) {
  if (!Array.isArray(eligibleMemberIds)) return [];
  return eligibleMemberIds.filter(id => id && choiceClaims[id] !== true);
}

// 是否可前進（帶領全隊前往遠征報告）：需有合格隊員,且全部合格隊員皆已完成選箱。
// - 不合格隊員（不在 eligible）不納入判定 → 不阻擋。
// - 合格但未領（含斷線）→ 仍 pending,不可前進。
// - 重連完成選箱後 → 可前進。
export function canAdvanceAfterBossReward({ eligibleMemberIds = [], choiceClaims = {} } = {}) {
  if (!Array.isArray(eligibleMemberIds) || eligibleMemberIds.length === 0) return false;
  return eligibleMemberIds.every(id => choiceClaims[id] === true);
}

// 王房獎勵室是否「阻擋前進」：只有『有合格隊員、且尚未全部完成選箱』才阻擋。
// 無合格隊員（理論罕見:0 人 validRounds>0）→ 不阻擋,避免全隊卡死在王房室。
// UI 前進閘門用此函式,才能同時（a）等所有合格隊員（b）不因空名單卡死。
export function bossRewardBlocksAdvance({ eligibleMemberIds = [], choiceClaims = {} } = {}) {
  if (!Array.isArray(eligibleMemberIds) || eligibleMemberIds.length === 0) return false;
  return !eligibleMemberIds.every(id => choiceClaims[id] === true);
}
