// src/lib/expeditionMemberData.js
// 遠征模式使用的射手素質組裝

import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";
import { getBondLevel, getCatStatMult } from "./catData";
import { WB_CARDS } from "./worldBossCards";

// cardBonus: calcEquippedBonus(resolveEquippedCards(cardCollection)) 的結果，未傳入視為 0 加成
// （地下城遠征系統本來完全沒有串接卡片系統，2026-07-09 補上，見 quick-ref.md「世界王 Phase 2」）
export function buildExpeditionMemberData(profile, cardBonus = null, cardCollection = null) {
  const base = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile?.certRecords || [],
    dexStats: null,
  });
  const archerLevel = archerLevelFromXP(profile?.archerXP || 0);
  const level = archerLevelBonus(archerLevel);
  const cb = cardBonus || { hp:0, atk:0, def:0, dmgBonusPct:0, dmgReducePct:0, healBonusPct:0 };
  const equippedCat = profile?.equippedCat;
  const catStats = equippedCat?.catId ? calcCatFullStats(equippedCat) : null;
  // 與單人打怪／組隊戰鬥一致：已裝備貓咪的羈絆會加乘射手基礎戰鬥數值。
  const catBondLevel = equippedCat?.catId ? getBondLevel(equippedCat.bond || 0) : 0;
  const catStatMult = equippedCat?.catId
    ? getCatStatMult(equippedCat.type || "allround", catBondLevel)
    : 1;
  const hp = Math.round(((base.hp || 0) + (level.hp || 0) + (cb.hp || 0)) * catStatMult);
  const topWorldBoss = (cardCollection?.equipped || [])
    .filter(entry => entry && typeof entry !== "string" && entry.source === "wb")
    .map(entry => ({ meta: WB_CARDS[entry.key], card: cardCollection?.wbCards?.[entry.key] || {} }))
    .filter(entry => entry.meta)
    .sort((a, b) => ((b.card.stars || b.card.level || 1) - (a.card.stars || a.card.level || 1)))[0];
  const battleCosmetics = topWorldBoss ? {
    wbFrame: {
      color: topWorldBoss.meta.frameColor || "#f5b942",
      title: topWorldBoss.meta.title || topWorldBoss.meta.name || "世界王獵人",
      stars: topWorldBoss.card.stars || topWorldBoss.card.level || 1,
    },
  } : null;
  return {
    ...profile,
    level: archerLevel,
    hp,
    maxHP: hp,
    atk: Math.round(((base.atk || 0) + (level.atk || 0) + (cb.atk || 0)) * catStatMult),
    def: Math.round(((base.def || 0) + (level.def || 0) + (cb.def || 0)) * catStatMult),
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catType: equippedCat?.type || "",
    catXP: equippedCat?.catXP || 0,
    catBond: equippedCat?.bond || 0,
    catAtk: catStats?.catATK || 0,
    wbBonus: { dmgBonusPct: cb.dmgBonusPct || 0, dmgReducePct: cb.dmgReducePct || 0, healBonusPct: cb.healBonusPct || 0 },
    avatarId: profile?.avatarId || null,
    battleCosmetics,
  };
}
