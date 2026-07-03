// src/lib/expeditionMemberData.js
// 遠征模式使用的射手素質組裝

import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";

export function buildExpeditionMemberData(profile) {
  const base = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile?.certRecords || [],
    dexStats: null,
  });
  const level = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
  const hp = (base.hp || 0) + (level.hp || 0);
  const equippedCat = profile?.equippedCat;
  const catStats = equippedCat?.catId ? calcCatFullStats(equippedCat) : null;
  return {
    ...profile,
    hp,
    maxHP: hp,
    atk: (base.atk || 0) + (level.atk || 0),
    def: (base.def || 0) + (level.def || 0),
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catAtk: catStats?.catATK || 0,
  };
}
