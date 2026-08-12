// src/worldboss/domain/raidSupport.js
// ─────────────────────────────────────────────────────────────
// 倒地 → 轉後衛助戰（作者 2026-07-31，比照公會的
// 「💀 你已倒地——隊友還在戰鬥，撐到勝利你一樣有獎勵」）。
//
// ⚠️ **只有組隊有後衛**（作者 2026-07-31）：
//    單人被打倒＝直接結束，沒有後衛這回事（沒有隊友可以助戰，本來也不該有）。
//    組隊則是全員陣亡才提前結束；還有人站著就繼續打，倒下的人轉後衛。
//
// 被王打倒的人不是出局（組隊時），而是換位置：
//   ・幫還站著的隊友加攻擊力（**最高 +15%**）
//   ・每回合幫隊友補血（**最高 +15% 最大生命**）
//
// ⚠️ 「按照表現」＝**倒下之前打得怎麼樣**。這條很重要：
//    不看表現的話，故意送死去當後衛會變成一種打法。
//    表現用「自己的傷害 ÷ 隊伍平均傷害」——打到隊伍平均就滿檔，
//    這比絕對數字公平（新手跟老手的平均不一樣）。
// ─────────────────────────────────────────────────────────────

export const SUPPORT_MAX_ATK = 0.15;    // 攻擊力最多 +15%
export const SUPPORT_MAX_HEAL = 0.15;   // 每回合最多補 15% 最大生命

/**
 * 一位後衛的表現係數（0~1）。
 * 達到隊伍平均傷害就滿檔——不是要你打贏所有人，是要你有認真打過。
 */
export function supportPerformance(member, teamAvgDamage = 0) {
  const dmg = Math.max(0, Number(member?.damage) || 0);
  const avg = Math.max(1, Number(teamAvgDamage) || 0);
  return Math.max(0, Math.min(1, dmg / avg));
}

/**
 * 全隊的後衛助戰。多位後衛會**累加但有上限**——
 * 三個人倒地不該給到 45%，那會變成「倒地比站著有用」。
 */
export function teamSupport(members = []) {
  const roster = Array.isArray(members) ? members : [];
  const none = { atkMult: 1, healPct: 0, supporters: [], totalPerf: 0 };

  // ⚠️ 單人沒有後衛——寫死在這裡，不要靠「剛好沒有存活者」這種間接條件。
  if (roster.length < 2) return none;

  const alive = roster.filter(m => m.hp > 0);
  const downed = roster.filter(m => m.hp <= 0);
  if (!downed.length || !alive.length) return none;

  const totalDamage = roster.reduce((sum, m) => sum + (Number(m.damage) || 0), 0);
  const avg = roster.length ? totalDamage / roster.length : 0;

  const supporters = downed.map(m => ({
    memberId: m.memberId, name: m.name,
    perf: supportPerformance(m, avg),
    healBonusPct: Math.max(0, Number(m.cardFx?.healPct) || 0),
  }));
  const totalPerf = Math.min(1, supporters.reduce((s, x) => s + x.perf, 0));
  const weightedHeal = supporters.reduce((sum, item) => sum + item.perf * (1 + item.healBonusPct / 100), 0);
  const basePerf = supporters.reduce((sum, item) => sum + item.perf, 0);
  const healBonusMult = basePerf > 0 ? weightedHeal / basePerf : 1;

  return {
    atkMult: 1 + SUPPORT_MAX_ATK * totalPerf,
    healPct: SUPPORT_MAX_HEAL * totalPerf * healBonusMult,
    supporters, totalPerf,
  };
}

/** UI 用的一句話 */
export function supportLabel(support) {
  if (!support || !support.supporters.length) return "";
  const names = support.supporters.map(s => s.name).join("、");
  const atk = Math.round((support.atkMult - 1) * 100);
  const heal = Math.round(support.healPct * 100);
  return `🛡️ ${names} 轉為後衛：攻擊 +${atk}%、每回合補血 ${heal}%`;
}
