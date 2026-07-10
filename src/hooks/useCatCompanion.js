// src/hooks/useCatCompanion.js — 貓貓陪練共用 hook
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { addCatBond, addCatXP } from "../lib/catDb";
import {
  CAT_SKILL_GROUPS, calcCatSkillChance, calcCatSkillEffect,
  CAT_COMBAT_BASE as CAT_TYPE_BASE_DATA,
} from "../lib/catData";
import { calcCatCombatStats } from "../lib/catCombat";
import { calcDamage } from "../lib/monsterData";

export const CAT_TYPE_BASE = CAT_TYPE_BASE_DATA;
// 向後相容（其他 import 此常數的地方不需改）
export const CAT_COMBAT_BASE = CAT_TYPE_BASE.allround;

const ARROWS_PER_CAT = 6;

const CAT_MESSAGES = {
  attack: [
    n => `🐱 ${n} 利爪出擊！暴擊加成 ×1.2 ⚡`,
    n => `🐱 ${n} 目光如炬，找到了弱點！傷害提升 💥`,
    n => `🐱 ${n} 撲了過去，追加一擊！🎯`,
  ],
  defense: [
    n => `🐱 ${n} 擋在你面前！減傷 30% 🛡️`,
    n => `🐱 ${n} 舔了你的傷口，緩慢回復 HP 💚`,
    n => `🐱 ${n} 用爪子撥開了攻擊！✨`,
  ],
  allround: [
    n => `🐱 ${n} 偷偷藏了一顆金幣，掉寶 +1 💰`,
    n => `🐱 ${n} 嚇到怪物！防禦暫時下降 🐾`,
    n => `🐱 ${n} 帶來了好運氣！全屬性小提升 ✨`,
  ],
};

export function useCatCompanion(profileOverride = null) {
  const { profile: authProfile } = useAuth();
  const profile = profileOverride || authProfile;
  const [catMsg, setCatMsg] = useState(null);

  const equippedCat = profile?.equippedCat;
  const catId    = equippedCat?.catId  || null;
  const catName  = equippedCat?.name   || "";
  const catType  = equippedCat?.type   || "allround";
  const hasCat   = !!catId;

  const combatStats = useMemo(
    () => calcCatCombatStats(equippedCat || {}, catId),
    [equippedCat, catId],
  );
  const bondLv = hasCat ? combatStats.bondLv : 0;
  const catXP = hasCat ? (equippedCat?.catXP || 0) : 0;
  const catLevel = hasCat ? combatStats.catLevel : 1;

  // 技能分組（決定哪種技能會觸發）
  const skillGroup = hasCat ? (CAT_SKILL_GROUPS[catId] || null) : null;

  const catHP = hasCat ? combatStats.catHP : CAT_TYPE_BASE.allround.hp;
  const catDEF = hasCat ? combatStats.catDEF : CAT_TYPE_BASE.allround.def;
  const catATK = hasCat ? combatStats.catATK : 0;

  // ── 貓貓攻擊：6箭合一，回傳總傷害 ───────────────────────────
  const calcCatRoundDamage = useCallback((monster) => {
    if (!hasCat || !monster) return 0;
    let total = 0;
    for (let i = 0; i < ARROWS_PER_CAT; i++) {
      const score    = Math.floor(Math.random() * 7) + 4;
      const partMult = score >= 10 ? 2.0 : score >= 8 ? 1.4 : 1.0;
      const dmg = calcDamage({ score, archerATK: catATK, monsterDEF: monster.def || 5, partMult });
      total += Math.max(1, dmg);
    }
    return total;
  }, [hasCat, catATK]);

  // ── 貓貓特技觸發（每回合 AFTER 攻擊後呼叫）──────────────────
  // 回傳 { triggered: false } 或 { triggered: true, skillGroup, ...effectData }
  const triggerCatSkill = useCallback(() => {
    if (!hasCat || !skillGroup) return { triggered: false };
    const chance = calcCatSkillChance(catLevel, bondLv, catId);
    if (Math.random() >= chance)   return { triggered: false };
    const effect = calcCatSkillEffect(skillGroup, catLevel, bondLv, catId);
    return { triggered: true, skillGroup, ...effect };
  }, [hasCat, skillGroup, catLevel, bondLv, catId]);

  // ── 輔助功能 ─────────────────────────────────────────────────
  const triggerCatAction = useCallback(() => {
    if (!hasCat || Math.random() >= 0.25) return;
    const pool = CAT_MESSAGES[catType] || CAT_MESSAGES.allround;
    const fn   = pool[Math.floor(Math.random() * pool.length)];
    setCatMsg(fn(catName));
  }, [hasCat, catType, catName]);

  const showCatEntry = useCallback(() => {
    if (!hasCat) return;
    const pool = CAT_MESSAGES[catType] || CAT_MESSAGES.allround;
    const fn   = pool[Math.floor(Math.random() * pool.length)];
    setCatMsg(fn(catName));
  }, [hasCat, catType, catName]);

  const clearCatMsg = useCallback(() => setCatMsg(null), []);

  const saveBond = useCallback(async (source = "monster") => {
    if (!profile?.id || !catId) return;
    await addCatBond(profile.id, catId, source).catch(() => {});
  }, [profile?.id, catId]);

  const saveXP = useCallback(async (amount) => {
    if (!profile?.id || !catId || !amount) return;
    await addCatXP(profile.id, catId, amount).catch(() => {});
  }, [profile?.id, catId]);

  return {
    equippedCat, catId, catName, catType, hasCat,
    catLevel, catXP, bondLv, skillGroup,
    catHP, catATK, catDEF,
    calcCatRoundDamage, triggerCatSkill,
    catMsg, clearCatMsg, triggerCatAction, showCatEntry,
    saveBond, saveXP,
  };
}
