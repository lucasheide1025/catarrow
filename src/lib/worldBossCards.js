// src/lib/worldBossCards.js
// 世界王專屬卡片定義：18 張，一隻王對應一張，只從世界秘寶箱/族寶箱開出

import { WORLD_BOSSES, WB_FAMILY_TO_DUNGEON_FAMILY } from "./worldBossData";
import { FAMILY_STAT, CAT_GROUP_STAT } from "./monsterCards";

// statMode: "choose" = 開卡時玩家自選屬性（教練系列）
//           "fixed"  = 固定屬性（貓貓系列依分組、六族依 FAMILY_STAT）
function buildWbCard(bossKey) {
  const boss = WORLD_BOSSES[bossKey];
  if (!boss) return null;

  if (boss.family === "coach") {
    return {
      bossKey, name: boss.name, icon: "👑", title: boss.title,
      flavor: boss.desc, family: "coach", statMode: "choose", stat: null,
    };
  }
  if (boss.family === "cat") {
    return {
      bossKey, name: boss.name, icon: "🐱", title: boss.title,
      flavor: boss.desc, family: "cat", statMode: "fixed",
      stat: CAT_GROUP_STAT[boss.catGroup] || "hp",
    };
  }
  // 六大族：沿用 FAMILY_STAT 對照（world boss family key → dungeon family key）
  const dungeonFamily = WB_FAMILY_TO_DUNGEON_FAMILY[boss.family];
  return {
    bossKey, name: boss.name, icon: "🗡️", title: boss.title,
    flavor: boss.desc, family: boss.family, statMode: "fixed",
    stat: FAMILY_STAT[dungeonFamily] || "atk",
  };
}

export const WB_CARDS = Object.keys(WORLD_BOSSES).reduce((acc, key) => {
  const card = buildWbCard(key);
  if (card) acc[key] = card;
  return acc;
}, {});

export const WB_CARD_KEYS = Object.keys(WB_CARDS);
