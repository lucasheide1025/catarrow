// src/hooks/useCatCompanion.js — 貓貓陪練共用 hook
import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { addCatBond } from "../lib/catDb";

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
  const catId   = equippedCat?.catId   || null;
  const catName = equippedCat?.name    || "";
  const catType = equippedCat?.type    || "allround";
  const hasCat  = !!catId;

  // 10% 機率觸發，跳出貓咪訊息
  const triggerCatAction = useCallback(() => {
    if (!hasCat || Math.random() >= 0.10) return;
    const pool = CAT_MESSAGES[catType] || CAT_MESSAGES.allround;
    const fn   = pool[Math.floor(Math.random() * pool.length)];
    setCatMsg(fn(catName));
  }, [hasCat, catType, catName]);

  const clearCatMsg = useCallback(() => setCatMsg(null), []);

  // 戰鬥結束後增加羈絆
  const saveBond = useCallback(async (source = "monster") => {
    if (!profile?.id || !catId) return;
    await addCatBond(profile.id, catId, source).catch(() => {});
  }, [profile?.id, catId]);

  return { equippedCat, catId, catName, catType, hasCat, catMsg, clearCatMsg, triggerCatAction, saveBond };
}
