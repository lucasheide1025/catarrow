// src/hooks/useCatCompanion.js — 貓貓陪練共用 hook
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { addCatBond, addCatXP } from "../lib/catDb";
import {
  getBondLevel,
  CAT_SKILL_GROUPS, calcCatSkillChance, calcCatSkillEffect,
  calcCatEquipBonus,
} from "../lib/catData";
import { calcDamage } from "../lib/monsterData";
import { catLevelFromXP, catLevelBonus } from "../lib/catLevel";

// ── 三類型基底數值（各有特化）────────────────────────────────
export const CAT_TYPE_BASE = {
  attack:   { hp: 140, atk: 16, def:  7 }, // 高傷低耐
  defense:  { hp: 300, atk:  7, def: 16 }, // 高血高防
  allround: { hp: 200, atk: 10, def: 10 }, // 均衡
};
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

export function useCatCompanion() {
  const { profile } = useAuth();
  const [catMsg, setCatMsg] = useState(null);

  const equippedCat = profile?.equippedCat;
  const catId    = equippedCat?.catId  || null;
  const catName  = equippedCat?.name   || "";
  const catType  = equippedCat?.type   || "allround";
  const hasCat   = !!catId;

  // 羈絆等級
  const bondLv = hasCat ? getBondLevel(equippedCat?.bond || 0) : 0;

  // 貓貓等級（從 equippedCat.catXP 計算）
  const catXP    = hasCat ? (equippedCat?.catXP || 0) : 0;
  const catLevel = hasCat ? catLevelFromXP(catXP) : 1;
  const lvBonus  = catLevelBonus(catLevel);

  // 裝備加成
  const equipBonus = useMemo(() =>
    hasCat ? calcCatEquipBonus(equippedCat?.equip || {}) : { atkBonus: 0, defBonus: 0, hpBonus: 0 },
    [hasCat, equippedCat?.equip]
  );

  // 技能分組（決定哪種技能會觸發）
  const skillGroup = hasCat ? (CAT_SKILL_GROUPS[catId] || null) : null;

  // ── 戰鬥數值（類型基底 + 羈絆技能加成 + 等級 + 裝備）────────
  // 羈絆里程碑：達到 lv5 解鎖技能 I（主屬性×1.2），lv10 解鎖技能 II（×1.4）
  const bondTierMult = bondLv >= 10 ? 1.4 : bondLv >= 5 ? 1.2 : 1.0;
  const base = CAT_TYPE_BASE[catType] || CAT_TYPE_BASE.allround;

  // 攻擊型：bondTier 強化 ATK；防禦型：強化 HP/DEF；全能型：三者均強化
  const atkMult = (catType === "attack"  || catType === "allround") ? bondTierMult : 1.0;
  const tkhMult = (catType === "defense" || catType === "allround") ? bondTierMult : 1.0;

  const catHP  = hasCat
    ? Math.round((base.hp  + lvBonus.hp  + equipBonus.hpBonus)  * tkhMult)
    : base.hp;
  const catDEF = hasCat
    ? Math.round((base.def + lvBonus.def + equipBonus.defBonus) * tkhMult)
    : base.def;
  const catATK = hasCat
    ? Math.round((base.atk + bondLv + lvBonus.atk + equipBonus.atkBonus) * atkMult)
    : 0;

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
    const chance = calcCatSkillChance(catLevel, bondLv);
    if (Math.random() >= chance)   return { triggered: false };
    const effect = calcCatSkillEffect(skillGroup, catLevel, bondLv);
    return { triggered: true, skillGroup, ...effect };
  }, [hasCat, skillGroup, catLevel, bondLv]);

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
