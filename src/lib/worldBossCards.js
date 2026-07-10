// src/lib/worldBossCards.js
// 世界王專屬卡片定義：18 張，一隻王對應一張，只從世界秘寶箱/族寶箱開出

import { WORLD_BOSSES, WB_FAMILY_TO_DUNGEON_FAMILY } from "./worldBossData";
import { FAMILY_STAT, CAT_GROUP_STAT } from "./monsterCards";

const STAT_COPY = {
  hp:  { label: "HP",  role: "治癒型", effect: "治療效果 +3%", color: "#22c55e" },
  atk: { label: "ATK", role: "猛攻型", effect: "造成傷害 +3%", color: "#ef4444" },
  def: { label: "DEF", role: "守護型", effect: "受到傷害 -3%", color: "#3b82f6" },
};

const FAMILY_CARD_META = {
  coach: { typeLabel: "傳說教練", rarity: "LEGEND", frame: "#facc15" },
  cat: { typeLabel: "貓貓王", rarity: "FAMILIAR", frame: "#f97316" },
  ghost: { typeLabel: "幽靈族王", rarity: "SPECTER", frame: "#818cf8" },
  forest: { typeLabel: "山林族王", rarity: "GUARDIAN", frame: "#86efac" },
  poison: { typeLabel: "毒蟲族王", rarity: "VENOM", frame: "#fcd34d" },
  office: { typeLabel: "職場族王", rarity: "TYRANT", frame: "#fca5a5" },
  exam: { typeLabel: "考試族王", rarity: "ORACLE", frame: "#c4b5fd" },
  western: { typeLabel: "神殿族王", rarity: "ANCIENT", frame: "#4ade80" },
};

function getArtPath(bossKey, boss) {
  if (boss?.family === "cat" && boss.catId) return `/cats/${boss.catId}.webp`;
  return `/worldboss/${boss?.pixelKey || bossKey}.webp`;
}

function makeCardMeta(bossKey, boss, stat) {
  const familyMeta = FAMILY_CARD_META[boss.family] || FAMILY_CARD_META.coach;
  const statMeta = STAT_COPY[stat] || STAT_COPY.atk;
  const statLine = stat ? `${statMeta.label} +25` : "自由選擇 +25";
  return {
    artPath: getArtPath(bossKey, boss),
    serial: `WB-${String(Object.keys(WORLD_BOSSES).indexOf(bossKey) + 1).padStart(3, "0")}`,
    typeLabel: familyMeta.typeLabel,
    rarity: familyMeta.rarity,
    frameColor: boss.accent || familyMeta.frame,
    bgColor: boss.bg || "#1c1917",
    statLine,
    effectText: stat ? statMeta.effect : "裝備前選擇一種被動效果",
    roleLabel: stat ? statMeta.role : "自選型",
    lore: boss.desc,
    hp: boss.hp || 0,
    atk: boss.atk || 0,
    def: boss.def || 0,
  };
}

// statMode: "choose" = 開卡時玩家自選屬性（教練系列）
//           "fixed"  = 固定屬性（貓貓系列依分組、六族依 FAMILY_STAT）
function buildWbCard(bossKey) {
  const boss = WORLD_BOSSES[bossKey];
  if (!boss) return null;

  if (boss.family === "coach") {
    return {
      bossKey, name: boss.name, icon: "👑", title: boss.title,
      flavor: boss.desc, family: "coach", statMode: "choose", stat: null,
      ...makeCardMeta(bossKey, boss, null),
    };
  }
  if (boss.family === "cat") {
    const stat = CAT_GROUP_STAT[boss.catGroup] || "hp";
    return {
      bossKey, name: boss.name, icon: "🐱", title: boss.title,
      flavor: boss.desc, family: "cat", statMode: "fixed",
      stat,
      ...makeCardMeta(bossKey, boss, stat),
    };
  }
  // 六大族：沿用 FAMILY_STAT 對照（world boss family key → dungeon family key）
  const dungeonFamily = WB_FAMILY_TO_DUNGEON_FAMILY[boss.family];
  const stat = FAMILY_STAT[dungeonFamily] || "atk";
  return {
    bossKey, name: boss.name, icon: "🗡️", title: boss.title,
    flavor: boss.desc, family: boss.family, statMode: "fixed",
    stat,
    ...makeCardMeta(bossKey, boss, stat),
  };
}

export const WB_CARDS = Object.keys(WORLD_BOSSES).reduce((acc, key) => {
  const card = buildWbCard(key);
  if (card) acc[key] = card;
  return acc;
}, {});

export const WB_CARD_KEYS = Object.keys(WB_CARDS);
