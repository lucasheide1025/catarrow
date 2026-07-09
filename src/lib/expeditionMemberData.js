// src/lib/expeditionMemberData.js
// 遠征模式使用的射手素質組裝

import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";

// cardBonus: calcEquippedBonus(resolveEquippedCards(cardCollection)) 的結果，未傳入視為 0 加成
// （地下城遠征系統本來完全沒有串接卡片系統，2026-07-09 補上，見 quick-ref.md「世界王 Phase 2」）
export function buildExpeditionMemberData(profile, cardBonus = null) {
  const base = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile?.certRecords || [],
    dexStats: null,
  });
  const level = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
  const cb = cardBonus || { hp:0, atk:0, def:0, dmgBonusPct:0, dmgReducePct:0, healBonusPct:0 };
  const hp = (base.hp || 0) + (level.hp || 0) + (cb.hp || 0);
  const equippedCat = profile?.equippedCat;
  const catStats = equippedCat?.catId ? calcCatFullStats(equippedCat) : null;
  return {
    ...profile,
    hp,
    maxHP: hp,
    atk: (base.atk || 0) + (level.atk || 0) + (cb.atk || 0),
    def: (base.def || 0) + (level.def || 0) + (cb.def || 0),
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catAtk: catStats?.catATK || 0,
    wbBonus: { dmgBonusPct: cb.dmgBonusPct || 0, dmgReducePct: cb.dmgReducePct || 0, healBonusPct: cb.healBonusPct || 0 },
  };
}
