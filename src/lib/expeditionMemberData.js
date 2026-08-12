// src/lib/expeditionMemberData.js
// 遠征模式使用的射手素質組裝

import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";
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
  // 射手面板值已包含正式養成加成；貓咪在地下城以 catAtk 獨立參戰，
  // 不可再次用羈絆倍率放大射手 HP / ATK / DEF。
  const hp = Math.round((base.hp || 0) + (level.hp || 0) + (cb.hp || 0));
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
  const wbKeys = (cardCollection?.equipped || [])
    .filter(entry => entry && typeof entry !== "string" && entry.source === "wb" && WB_CARDS[entry.key])
    .map(entry => entry.key);
  return {
    ...profile,
    level: archerLevel,
    hp,
    maxHP: hp,
    atk: Math.round((base.atk || 0) + (level.atk || 0) + (cb.atk || 0)),
    def: Math.round((base.def || 0) + (level.def || 0) + (cb.def || 0)),
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catType: equippedCat?.type || "",
    catXP: equippedCat?.catXP || 0,
    catBond: equippedCat?.bond || 0,
    catAtk: catStats?.catATK || 0,
    wbBonus: {
      effectVersion:2, equippedCardKeys:wbKeys,
      dmgBonusPct:cb.dmgBonusPct || 0,
      dmgReducePct:cb.dmgReducePct || 0,
      healBonusPct:cb.healBonusPct || 0,
    },
    avatarId: profile?.avatarId || null,
    battleCosmetics,
  };
}

// 建立「地圖進入戰鬥房」的玩家快照。基礎 ATK/DEF 與地下城途中加成分開保存，
// 讓地圖狀態列、傷害公式與 BattleScreen 使用同一份來源。
export function buildExpeditionBattleMemberSnapshot({ memberName, memberData = {} }) {
  return {
    name:memberName,
    hp:memberData.hp ?? 500,
    maxHP:memberData.maxHP ?? 500,
    atk:memberData.atk ?? 10,
    def:memberData.def ?? 10,
    alive:true,
    ready:false,
    arrows:[],
    contract:{ type:"standard", param:null },
    buffs:{
      atkMult:memberData.buffs?.atkMult ?? 1,
      defMult:memberData.buffs?.defMult ?? 1,
      dmgMult:memberData.buffs?.dmgMult ?? 1,
      hasRevival:memberData.buffs?.hasRevival ?? false,
    },
    potionBuffs:memberData.potionBuffs || {},
    restBonuses:memberData.restBonuses || { atkPct:0, defPct:0 },
    merchantBonuses:memberData.merchantBonuses || { atkPct:0, defPct:0 },
    revived:false,
    role:"front",
    displayGroup:"front",
    rearChoice:null,
    catId:memberData.catId || "",
    catName:memberData.catName || "",
    catType:memberData.catType || "",
    catXP:memberData.catXP ?? 0,
    catBond:memberData.catBond ?? 0,
    archerStyle:memberData.archerStyle || "baobao",
    catAtk:memberData.catAtk ?? 0,
    wbBonus:memberData.wbBonus || null,
    avatarId:memberData.avatarId || null,
  };
}
