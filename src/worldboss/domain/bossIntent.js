// src/worldboss/domain/bossIntent.js
// ─────────────────────────────────────────────────────────────
// 王的意圖：每回合開始就告訴玩家牠要幹嘛，然後玩家決定要貪輸出還是去打斷。
// 「預告 → 抉擇 → 分歧」這個循環才是「打世界王的感覺」的來源。
//
// 為什麼蓄力回合定在 R2 / R4：既有的 24 隻王都已經設定好 r2Strike / r4Finisher
// （worldBossStrikeEngine + worldBossSkillData），連破解方式的文案都寫好了。
// 沿用等於**一行資料都不用重寫**，玩家熟悉的節奏也不變。
// ─────────────────────────────────────────────────────────────

import { getWorldBossScheduledStrike } from "../../lib/worldBossStrikeEngine";

export const CHARGE_ROUNDS = Object.freeze([2, 4]);

// 打斷需要的弱點命中數：階段越後面越難斷（但硬直的回報也越大）。
// 2026-07-31 改制後「任何弱點命中」都推進度（紅點推 2 格），不再綁單一部位，
// 所以門檻要比原本的腿部專屬高一些。
export const INTERRUPT_REQUIRED = Object.freeze({ 1: 3, 2: 4, 3: 5 });

// 尾部「削弱」的效果：每層讓大招倍率降一截，最多疊到剩四成
export const WEAKEN_PER_STACK = 0.15;
export const WEAKEN_FLOOR = 0.4;

export function isChargeRound(round) {
  return CHARGE_ROUNDS.includes(Number(round));
}

/**
 * 這回合王在做什麼。charging=false 就是普通回合（牠只會平砍）。
 */
export function intentForRound({ config = null, round = 1, phaseId = 1 } = {}) {
  const charging = isChargeRound(round);
  const skill = charging ? getWorldBossScheduledStrike(config, round) : null;
  return {
    round,
    charging,
    skill,
    skillId: skill?.skillId || null,
    name: skill?.name || (charging ? "蓄力" : "伺機而動"),
    counterText: skill?.counterText || "",
    color: skill?.color || "#f43f5e",
    isFinisher: charging && round === Math.max(...CHARGE_ROUNDS),
    interruptRequired: charging ? (INTERRUPT_REQUIRED[phaseId] || 2) : 0,
  };
}

/**
 * 回合結束時決定分歧：斷成了，還是被大招轟。
 * legHits = 本回合全隊打中腿的次數（單人模式就是自己的）。
 */
export function resolveIntent({ intent, legHits = 0, weakenStacks = 0 } = {}) {
  if (!intent?.charging) {
    return { interrupted: false, staggerNext: false, ultMultiplier: 0, fired: false };
  }
  const interrupted = Number(legHits) >= intent.interruptRequired;
  if (interrupted) {
    return { interrupted: true, staggerNext: true, ultMultiplier: 0, fired: false };
  }
  const weaken = Math.max(WEAKEN_FLOOR, 1 - Math.max(0, Number(weakenStacks) || 0) * WEAKEN_PER_STACK);
  return { interrupted: false, staggerNext: false, ultMultiplier: weaken, fired: true };
}

// UI 用的一句話：現在該貪還是該斷
export function intentHint(intent, legHits = 0) {
  if (!intent?.charging) return "牠在等你出手——弱點都開著。";
  const left = Math.max(0, intent.interruptRequired - legHits);
  if (left === 0) return "💢 打斷條件已達成，這次牠發不出來了！";
  return `💢 再命中弱點 ${left} 次可以打斷「${intent.name}」`;
}
