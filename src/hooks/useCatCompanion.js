// src/hooks/useCatCompanion.js — 貓貓陪練共用 hook
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { addCatBond, addCatXP } from "../lib/catDb";
import { CAT_COMBAT_BASE as CAT_TYPE_BASE_DATA } from "../lib/catData";
import { calcCatCombatStats } from "../lib/catCombat";

export const CAT_TYPE_BASE = CAT_TYPE_BASE_DATA;
// 向後相容（其他 import 此常數的地方不需改）
export const CAT_COMBAT_BASE = CAT_TYPE_BASE.allround;

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
  const catXP = hasCat ? (equippedCat?.catXP || 0) : 0;
  const catLevel = hasCat ? combatStats.catLevel : 1;

  const catHP = hasCat ? combatStats.catHP : CAT_TYPE_BASE.allround.hp;
  const catDEF = hasCat ? combatStats.catDEF : CAT_TYPE_BASE.allround.def;
  const catATK = hasCat ? combatStats.catATK : 0;

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
    catLevel, catXP, bondLv:hasCat ? combatStats.bondLv : 0,
    catHP, catATK, catDEF,
    catMsg, clearCatMsg, triggerCatAction, showCatEntry,
    saveBond, saveXP,
  };
}
