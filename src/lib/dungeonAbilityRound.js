// src/lib/dungeonAbilityRound.js — 地下城（單人＋組隊）怪物技能回合結算（純函式）
// 權威端 processDungeonRound 每回合呼叫一次（母任務 PRD §39：不得每位成員各重播一輪）。
// 破解採團隊聚合：全體有效成員實得分 ÷ 全體有效成員最高可能得分（PRD §44），由 combatSkillEngine 內部處理。
//
// 為何放這裡：processDungeonRound 是 client-host 的大函式，規則寫在純函式才測得動；
// host 只負責把回傳的 plan 寫進 room doc 欄位。

import { resolveTeamMonsterAbility, mergeCombatStatus, applySoloStatusTick } from "./soloMonsterAbilityEngine";

// 技能目標（母任務 PRD §47-48）。招牌技能資料表沒有 target 欄位，
// 依 encounter 推導：大王＝全隊（效果約單體 50%），一般怪/小王＝單體且不點名後衛。
export const PARTY_TARGET_SCALE = 0.5;

export function getAbilityTargetMode(monster) {
  return monster?.encounter === "boss" ? "party" : "single";
}

// 單體技能點名：優先前衛（host 先手序），全部倒地才落到後衛（PRD §48 後衛不被單體隨機點名）
export function pickSingleTarget(participants) {
  const alive = participants.filter(p => p.alive !== false && (p.hp || 0) > 0);
  return alive.find(p => (p.role || "front") !== "rear") || alive[0] || null;
}

function statusStrength(statuses, id) {
  const found = (statuses || []).find(status => status.id === id);
  return typeof found?.strength === "number" ? found.strength : 0;
}

// 供下一回合 Step 1 使用：異常對 atk/def 的減幅（%）
export function getStatusStatMods(statuses) {
  return {
    atkPct: statusStrength(statuses, "atkDown"),
    defPct: statusStrength(statuses, "defDown"),
  };
}

/**
 * 規劃本回合怪物技能。純函式，不寫任何狀態。
 * @param {object} p
 * @param {string} p.battleId          冪等識別（建議 `dungeon:{roomId}`）
 * @param {object} p.monster           room.monster（需含 signatureSkillId 才會出招）
 * @param {number} p.round             本回合數
 * @param {Array}  p.participants      [{ id, name, arrows, def, hp, maxHP, role, alive, validSubmission }]
 * @param {number} p.monsterAtk        已套樓層修正的怪物 ATK
 * @param {number} p.monsterHpRatio    扣掉本回合玩家傷害後的 HP 比例（大王 70%/40% 階段被動用）
 * @param {function} p.calcCounter     (monsterAtk, def) → 基準反擊傷害
 * @param {object} p.existingStatuses  { [memberId]: status[] }
 * @param {string} p.targetFmt
 * @returns {null | object} plan
 */
export function planDungeonRoundAbility({
  battleId, monster, round, participants = [],
  monsterAtk, monsterHpRatio = 1, calcCounter,
  existingStatuses = {}, targetFmt = "full_110",
}) {
  if (!monster?.signatureSkillId || !battleId) return null;

  // 分母只計本回合有效提交者（倒地/退出/被跳過不納入，PRD §44）
  const eligible = participants.filter(p => p.validSubmission && p.alive !== false && (p.hp || 0) > 0);
  if (!eligible.length) return null;

  const ability = resolveTeamMonsterAbility({
    battleId, monster, round,
    submissions: eligible.map(p => ({ eligible: true, arrows: p.arrows || [] })),
    targetFmt, monsterHpRatio,
  });
  const resolved = ability?.resolved;
  if (!resolved?.resolvedKey) return null;

  const targetMode = getAbilityTargetMode(monster);
  const singleTarget = targetMode === "single" ? pickSingleTarget(eligible) : null;
  const targets = targetMode === "party" ? eligible : (singleTarget ? [singleTarget] : []);
  const scale = targetMode === "party" ? PARTY_TARGET_SCALE : 1;

  const damageByMember = {};
  if (resolved.skillDamageMult > 0 && typeof calcCounter === "function") {
    for (const target of targets) {
      // 穿甲：破解後已縮放的 pierceDefPct 直接削目標 DEF
      const effectiveDef = Math.max(0, Math.round((target.def || 0) * (1 - (resolved.pierceDefPct || 0) / 100)));
      const base = calcCounter(monsterAtk, effectiveDef) || 0;
      const damage = Math.max(0, Math.round(base * resolved.skillDamageMult * scale));
      // 技能不致死：最多打到剩 1 HP（與單人路徑一致）
      if (damage > 0) damageByMember[target.id] = Math.min(damage, Math.max(0, (target.hp || 0) - 1));
    }
  }

  const statusesByMember = {};
  if (resolved.statuses?.length) {
    for (const target of targets) {
      let merged = existingStatuses[target.id] || [];
      for (const status of resolved.statuses) merged = mergeCombatStatus(merged, status);
      statusesByMember[target.id] = merged;
    }
  }

  const monsterMaxHp = monster.hp || 0;
  return {
    resolvedKey: resolved.resolvedKey,
    round,
    name: resolved.name || ability.scheduled?.name || "怪物技能",
    skillId: resolved.skillId || ability.scheduled?.skillId || null,
    enhanced: !!resolved.enhanced,
    targetMode,
    targetIds: targets.map(target => target.id),
    breakRatio: Math.round((resolved.breakRatio || 0) * 1000) / 1000,
    breakLevel: resolved.outcome?.level || "none",
    damageByMember,
    statusesByMember,
    monsterEffect: {
      shieldHp: resolved.selfShieldMaxHpPct > 0 ? Math.round(monsterMaxHp * resolved.selfShieldMaxHpPct / 100) : 0,
      reductionPct: resolved.selfReductionPct || 0,
      reductionDuration: resolved.selfReductionDuration || 0,
      reflectPct: resolved.selfReflectPct || 0,
      reflectDuration: resolved.selfReflectDuration || 0,
      delayedMult: resolved.delayedMult || 0,
    },
  };
}

// 回合末異常 tick：毒扣血（不致死）＋所有異常 duration -1
export function tickDungeonStatuses(statusesByMember = {}, memberHP = {}, memberMaxHP = {}) {
  const nextStatuses = {};
  const nextHP = { ...memberHP };
  const poisonDamage = {};
  for (const [id, statuses] of Object.entries(statusesByMember)) {
    const remaining = [];
    for (const status of statuses || []) {
      const tick = applySoloStatusTick({
        status,
        playerHp: nextHP[id] ?? 0,
        playerMaxHp: memberMaxHP[id] ?? nextHP[id] ?? 0,
      });
      if (tick.damage > 0) {
        poisonDamage[id] = (poisonDamage[id] || 0) + tick.damage;
        nextHP[id] = tick.playerHp;
      }
      if (tick.status) remaining.push(tick.status);
    }
    if (remaining.length) nextStatuses[id] = remaining;
  }
  return { statuses: nextStatuses, memberHP: nextHP, poisonDamage };
}
