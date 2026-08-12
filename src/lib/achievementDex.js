// src/lib/achievementDex.js
// 數位圖鑑：里程碑成就定義 + 自動判定 + 統計

import { calcBadgePoints, getCertLevel } from "./constants";
import { getCohort, cohortRarity, cohortLabel, cohortTitle } from "./cohort";
import { MONSTERS } from "./monsterData";
import { POTIONS } from "./itemData";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { levelFromXP } from "./adventurerSystem";
import { FAMILY_COLLECTIBLES, COLLECTIBLE_MAP } from "./dungeonCollectibles";
import { WB_TROPHY_MAP, WORLD_BOSSES, getDropCategory } from "./worldBossData";
import { BUILDING_LIST, BUILDINGS } from "./villageData";
import { getShopLevel, MAX_SHOP_LEVEL, SHOP_CUSTOMERS } from "./villageShop";
import { WB_CARDS, WB_CARD_KEYS } from "./worldBossCards";
import { CATS, CAT_EQUIP_SLOTS, catEquipEnhancement, getBondLevel } from "./catData";
import { catLevelFromXP } from "./catLevel";
import { CAT_CARDS } from "./catCardData";
import { JOURNEY_MAP_IDS, JOURNEY_MAP_META } from "./boardJourney";
import { GUILD_RANKS } from "../guild/domain/guildRank";
import { MAX_ARCHER_LEVEL, archerLevelFromXP } from "./archerLevel";

// 裝備品階順序（equipData.js：common→mythic），供裝備成就取「最高品階」用
const EQUIP_GRADE_ORDER = ["common", "rare", "elite", "epic", "legend", "mythic"];

function findAchievementCat(cats, catId) {
  return (cats || []).find(cat => cat?.catId === catId) || null;
}

function catAchievementLevel(cats, catId) {
  const cat = findAchievementCat(cats, catId);
  return cat ? catLevelFromXP(cat.catXP || 0) : 0;
}

function catAchievementBondLevel(cats, catId) {
  const cat = findAchievementCat(cats, catId);
  return cat ? getBondLevel(cat.bond || 0) : 0;
}

function catAchievementEquipmentLevel(cats, catId) {
  const cat = findAchievementCat(cats, catId);
  if (!cat || CAT_EQUIP_SLOTS.length === 0) return 0;
  const total = CAT_EQUIP_SLOTS.reduce((sum, slot) => {
    const slotId = typeof slot === "string" ? slot : slot.id;
    const item = cat.equip?.[slotId];
    return sum + catEquipEnhancement(item?.grade || "普通", item?.plusLevel || 0);
  }, 0);
  return Math.floor(total / CAT_EQUIP_SLOTS.length);
}

export const RARITY_STYLE = {
  common:    { ring: "#cbd5e1", glow: "none",                              label: "普通" },
  uncommon:  { ring: "#22c55e", glow: "0 0 8px rgba(34,197,94,.45)",       label: "非凡" },
  rare:      { ring: "#3b82f6", glow: "0 0 10px rgba(59,130,246,.5)",      label: "稀有" },
  epic:      { ring: "#a855f7", glow: "0 0 12px rgba(168,85,247,.6)",      label: "史詩" },
  legendary: { ring: "#f59e0b", glow: "0 0 16px rgba(245,158,11,.7)",      label: "傳說" },
  mythic:    { ring: "#ef4444", glow: "0 0 20px rgba(239,68,68,.8)",       label: "神話" },
};

export const RANK_STYLE = {
  1: { ring: "#f59e0b", glow: "0 0 16px rgba(245,158,11,.7)",  icon: "🥇", label: "冠軍" },
  2: { ring: "#94a3b8", glow: "0 0 12px rgba(148,163,184,.6)", icon: "🥈", label: "亞軍" },
  3: { ring: "#b45309", glow: "0 0 12px rgba(180,83,9,.5)",    icon: "🥉", label: "季軍" },
  0: { ring: "#0ea5e9", glow: "0 0 8px rgba(14,165,233,.4)",   icon: "🎯", label: "參賽" },
};

export const DEX_CATEGORIES = [
  { id: "start",    label: "🌱 啟程" },
  { id: "practice", label: "🎯 練習" },
  { id: "cohort",   label: "🎓 期數" },
  { id: "archer_level", label: "\u{1F4C8} \u5c04\u624b\u7b49\u7d1a" },
  { id: "archery_tenure", label: "\u{1F3F9} \u7d2f\u7a4d\u5c04\u9f61" },
  { id: "cert",     label: "🎖️ 射手證" },
  { id: "level",    label: "🏹 檢定" },
  { id: "collect",  label: "🐱 收藏" },
  { id: "physical", label: "🏆 實體賽" },
  { id: "point",    label: "⭐ 積分賽" },
  { id: "external", label: "🏅 外賽" },
  { id: "special",  label: "✨ 特殊" },
  { id: "monster",  label: "👹 打怪" },
  { id: "monster_miniboss", label: "\u{1F536} \u5c0f\u738b" },
  { id: "monster_boss", label: "\u{1F534} \u5927\u738b" },
  { id: "worldboss_participation", label: "⚔️ 參與戰鬥" },
  { id: "worldboss_kill",          label: "💀 擊殺" },
  { id: "worldboss_rank",          label: "🏆 名次" },
  { id: "duel",     label: "⚔️ 決鬥" },
  { id: "forge",    label: "🔮 煉製 & 藥水" },
  { id: "card",     label: "🃏 怪物卡" },
  { id: "wbcard",   label: "🐲 世界王卡" },
  { id: "chest",    label: "🎁 寶箱" },
  { id: "shop",     label: "🏪 商店" },
  { id: "guild",    label: "🏰 冒險者公會" },
  { id: "dungeon",  label: "🏚️ 地下城" },
  { id: "cat",      label: "🐈 貓咪" },
  { id: "village",  label: "🏘️ 貓貓村" },
  { id: "equip",    label: "🛡️ 裝備" },
];

// V3：頂層先收斂成 9 個玩家主題，再顯示既有分類。
// legacy cat id 完全不改，避免 seen key、授予紀錄與歷史資料失效。
export const DEX_THEMES = [
  { id:"career",     label:"🎯 射手生涯", categories:["start","practice","cohort","archer_level","archery_tenure","cert","level"] },
  { id:"honor",      label:"🏆 榮耀紀錄", categories:["collect","physical","point","external","special"] },
  { id:"combat",     label:"⚔️ 戰鬥", categories:["monster","monster_miniboss","monster_boss","duel","chest"] },
  { id:"worldboss",  label:"🐲 世界王", categories:["worldboss_participation","worldboss_kill","worldboss_rank"] },
  { id:"adventure",  label:"🗺️ 冒險", categories:["guild","dungeon"] },
  { id:"collection", label:"🃏 收藏", categories:["card","wbcard"] },
  { id:"cat",        label:"🐈 貓小隊", categories:["cat"] },
  { id:"village",    label:"🏘️ 貓貓村", categories:["village","shop"] },
  { id:"growth",     label:"🛡️ 養成", categories:["equip","forge"] },
];

export const DEX_CATEGORY_THEME = Object.freeze(Object.fromEntries(
  DEX_THEMES.flatMap(theme => theme.categories.map(cat => [cat, theme.id]))
));

export const EXTERNAL_COMP_FORMATS = Object.freeze([
  Object.freeze({ id:"qualification", label:"資格賽" }),
  Object.freeze({ id:"mixed", label:"混雙" }),
  Object.freeze({ id:"team", label:"團體" }),
  Object.freeze({ id:"head_to_head", label:"對抗" }),
]);
const EXTERNAL_COMP_FORMAT_MAP = Object.freeze(Object.fromEntries(
  EXTERNAL_COMP_FORMATS.map(item => [item.id, item])
));

function normalizeExternalFormat(record) {
  const raw = String(record?.format || "").trim();
  if (EXTERNAL_COMP_FORMAT_MAP[raw]) return raw;
  const byLabel = EXTERNAL_COMP_FORMATS.find(item => item.label === raw);
  if (byLabel) return byLabel.id;
  const legacy = String(record?.category || "").trim();
  if (legacy.includes("資格")) return "qualification";
  if (legacy.includes("混雙")) return "mixed";
  if (legacy.includes("團體")) return "team";
  if (legacy.includes("對抗")) return "head_to_head";
  return null;
}

function externalRankScore(record) {
  if (record?.status !== "approved") return 0;
  const raw = String(record?.rank || "").trim();
  const exact = raw.match(/^第([1-8])名$/);
  if (exact) return 10 - Number(exact[1]);
  if (raw === "前8名") return 2;
  return 1;
}

function externalBestScore(records, formatId) {
  return (records || []).reduce((best, record) => {
    if (normalizeExternalFormat(record) !== formatId) return best;
    return Math.max(best, externalRankScore(record));
  }, 0);
}

export function isActiveAchievement(achievement) {
  return !!achievement && achievement.retired !== true && achievement.futureData !== true;
}

// 一般怪物卡包的單一真本：擴充目錄中 encounter=normal 的怪物。
export const MONSTER_CARD_PACK = Object.freeze(
  EXPANSION_MONSTERS.filter(monster => monster.encounter === "normal")
);
export const MONSTER_CARD_FAMILIES = Object.freeze([
  ...new Set(MONSTER_CARD_PACK.map(card => card.family).filter(Boolean)),
]);

export const WORLD_BOSS_CARD_DEX_FAMILIES = Object.freeze(
  Object.entries(WB_CARD_KEYS.reduce((groups, key) => {
    const family = WB_CARDS[key]?.family;
    if (!family) return groups;
    if (!groups[family]) groups[family] = [];
    groups[family].push(key);
    return groups;
  }, {})).map(([family, cardKeys]) => Object.freeze({ family, cardKeys:Object.freeze(cardKeys) }))
);

const WORLD_BOSS_CARD_GROUP_META = Object.freeze({
  coach:        { label:"教練系", icon:"👑" },
  cat:          { label:"貓王系", icon:"🐱" },
  family_small: { label:"小王系", icon:"🔹" },
  family_big:   { label:"大王系", icon:"🔸" },
});
export const WORLD_BOSS_CARD_DEX_GROUPS = Object.freeze(
  Object.entries(WORLD_BOSS_CARD_GROUP_META).map(([id, meta]) => Object.freeze({
    id,
    ...meta,
    cardKeys:Object.freeze(WB_CARD_KEYS.filter(key => getDropCategory(WORLD_BOSSES[key]) === id)),
  }))
);

export const MONSTER_CARD_DEX_GROUPS = Object.freeze(
  MONSTER_CARD_FAMILIES.flatMap(family => [1,2,3,4,5,6].map(tierIndex => {
    const cards = MONSTER_CARD_PACK.filter(card => card.family === family && Number(card.tierIndex) === tierIndex);
    return Object.freeze({
      id:`${family}_t${tierIndex}`,
      family,
      tierIndex,
      cardIds:Object.freeze(cards.map(card => card.id)),
      cardNames:Object.freeze(cards.map(card => card.name || card.id)),
    });
  }))
);

function canonicalVillageBuildingLevel(buildings, buildingId) {
  const raw = Number(buildings?.[buildingId]);
  const level = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return Math.max(1, Math.min(20, Math.floor(level)));
}

function villageDevelopmentTotal(buildings) {
  return BUILDING_LIST.reduce((sum, buildingId) => sum + canonicalVillageBuildingLevel(buildings, buildingId), 0);
}

export const VILLAGE_BUILDING_DEX = Object.freeze(BUILDING_LIST.map(buildingId => Object.freeze({
  id: buildingId,
  name: BUILDINGS[buildingId]?.name || buildingId,
  icon: BUILDINGS[buildingId]?.emoji || "🏗️",
})));

function shopStatsFromContext(c) {
  return c.member?.village?.shop?.stats || {};
}

const SHOP_CUSTOMER_IDS = new Set(SHOP_CUSTOMERS.map(customer => customer.id));
function discoveredShopCustomerCount(c) {
  const discovered = shopStatsFromContext(c).discoveredCustomers;
  const ids = Array.isArray(discovered) ? discovered : Object.keys(discovered || {});
  return new Set(ids.filter(id => SHOP_CUSTOMER_IDS.has(id))).size;
}

export const MONSTER_DEX_CATALOG = EXPANSION_MONSTERS;
export const MONSTER_DEX_FAMILIES = Object.freeze([
  ...new Set(MONSTER_DEX_CATALOG.map(monster => monster.family).filter(Boolean)),
]);
const MONSTER_DEX_BY_ID = new Map(MONSTER_DEX_CATALOG.map(monster => [monster.id, monster]));

function monsterDexMeta(id, entry) {
  const monster = MONSTER_DEX_BY_ID.get(id);
  return {
    family: monster?.family || entry?.family || null,
    tier: monster?.tier || entry?.tier || null,
  };
}

function monsterWinsByTier(monsterDex, tier) {
  return Object.entries(monsterDex || {}).reduce((sum, [id, entry]) => {
    return monsterDexMeta(id, entry).tier === tier ? sum + (entry?.wins || 0) : sum;
  }, 0);
}

export function countDefeatedCatalogMonsters(monsterDex, family = null) {
  return MONSTER_DEX_CATALOG.reduce((count, monster) => {
    if (family && monster.family !== family) return count;
    return count + (((monsterDex?.[monster.id]?.wins || 0) > 0) ? 1 : 0);
  }, 0);
}

function sumCatalogMonsterWins(monsterDex, monsterIds) {
  return (monsterIds || []).reduce(
    (sum, id) => sum + Math.max(0, Number(monsterDex?.[id]?.wins) || 0),
    0,
  );
}

// 地下城目前是七族；收藏品系統仍是舊六族，不能拿 FAMILY_COLLECTIBLES 當通關族群來源。
const DUNGEON_CLEAR_FAMILIES = Object.freeze([
  "ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure",
]);

function dungeonClearTotal(member) {
  const clears = member?.dungeonClears || {};
  return DUNGEON_CLEAR_FAMILIES.reduce(
    (sum, family) => sum + Math.max(0, Math.floor(Number(clears?.[family]) || 0)),
    0,
  );
}

function buildCardCollectTiers(total) {
  const counts = [...new Set([1, 10, 25, 50, 100, total].filter(n => n > 0 && n <= total))];
  const meta = {
    1:["common", "初探怪窟"],
    10:["uncommon", "卡片達人"],
    25:["rare", "收藏有成"],
    50:["epic", "半百圖鑑"],
    100:["legendary", "百卡收藏家"],
  };
  return counts.map(count => {
    const isLast = count === total;
    const [rarity, name] = isLast ? ["mythic", "全圖鑑"] : (meta[count] || ["legendary", `${count} 張收藏`]);
    return {
      count, rarity, icon:"🃏", name,
      desc:isLast ? `收集全部 ${total} 種一般怪物卡` : `收集 ${count} 種怪物卡`,
    };
  });
}

// ── helpers ──────────────────────────────────────────────────
const LEVEL_ORDER = ["入門", "初級", "中級", "進階", "精英", "菁英"];
function levelIdx(lv) { return LEVEL_ORDER.indexOf(lv); }

function bowAtLeast(certRecords, bowType, minLevel) {
  const recs = (certRecords || []).filter(r => r.bowType === bowType);
  if (!recs.length) return false;
  const best = Math.max(...recs.map(r => r.score || 0));
  const lv = getCertLevel(bowType, best);
  return lv && levelIdx(lv) >= levelIdx(minLevel);
}
function anyBowLevelAtLeast(certRecords, minLevel) {
  const bows = [...new Set((certRecords || []).map(r => r.bowType))];
  return bows.some(b => bowAtLeast(certRecords, b, minLevel));
}
// 幾種弓達到某級別以上
function bowCountAtLeast(certRecords, minLevel, count) {
  const bows = [...new Set((certRecords || []).map(r => r.bowType))];
  const qualified = bows.filter(b => bowAtLeast(certRecords, b, minLevel));
  return qualified.length >= count;
}
// task 命中/分數 helper
function certTaskVal(certification, tier, task, field) {
  return certification?.[tier]?.[task]?.[field] ?? 0;
}
function certTaskPassed(certification, tier, task) {
  return certification?.[tier]?.[task]?.passed === true;
}
// 射手證編號數字化（archerNo 是 string）
function archerNoNum(member) {
  const n = parseInt(member?.archerNo, 10);
  return isNaN(n) ? null : n;
}

// ── AUTO_ACHIEVEMENTS ────────────────────────────────────────
export const AUTO_ACHIEVEMENTS = [

  // ══ 啟程 ══
  { id: "checkin_1",  cat: "start", icon: "📍", name: "初次報到",   rarity: "common",   desc: "完成第一次今日任務報到",   check: c => (c.checkinCount || 0) >= 1  },
  { id: "checkin_5",  cat: "start", icon: "🌤️", name: "漸入佳境",   rarity: "common",   desc: "累積報到 5 次",            check: c => (c.checkinCount || 0) >= 5  },
  { id: "checkin_10", cat: "start", icon: "🔥", name: "持之以恆",   rarity: "uncommon", desc: "累積報到 10 次",           check: c => (c.checkinCount || 0) >= 10 },
  { id: "checkin_15", cat: "start", icon: "⚡", name: "勢如破竹",   rarity: "uncommon", desc: "累積報到 15 次",           check: c => (c.checkinCount || 0) >= 15 },
  { id: "checkin_20", cat: "start", icon: "💎", name: "鍛鍊有成",   rarity: "rare",     desc: "累積報到 20 次",           check: c => (c.checkinCount || 0) >= 20 },
  { id: "checkin_25", cat: "start", icon: "🌟", name: "百練成鋼",   rarity: "rare",     desc: "累積報到 25 次",           check: c => (c.checkinCount || 0) >= 25 },
  { id: "checkin_30", cat: "start", icon: "💪", name: "風雨無阻",   rarity: "epic",     desc: "累積報到 30 次",           check: c => (c.checkinCount || 0) >= 30 },
  { id: "first_cert", cat: "start", icon: "🎯", name: "初試啼聲",   rarity: "common",   desc: "第一次參加年度檢定",       check: c => (c.certRecords || []).length >= 1 },
  // 月卡（已實裝：member.monthlyCard）。card_first 可判定；card_renew 待續約計數器（Phase 4）
  { id: "card_first",  cat: "start", icon: "🪪", name: "月卡初啟",  rarity: "uncommon", desc: "第一次啟動月卡",
    check: c => !!(c.member?.monthlyCard?.startedAt || c.member?.monthlyCard?.active) },
  { id: "card_renew",  cat: "start", icon: "🔄", name: "月卡續射",  rarity: "rare",     desc: "月卡至少續約一次",
    check: c => (c.member?.monthlyCard?.renewCount || 0) >= 1 },

  // ══ 射手證 ══
  { id: "cert_blue",       cat: "cert", icon: "🎖️", name: "藍證射手",     rarity: "rare",
    desc: "通過射手證畢業考，取得藍證",
    check: c => c.certification?.level === "blue" || c.certification?.level === "gold" },

  { id: "cert_blue_top",   cat: "cert", icon: "💯", name: "藍證完美",     rarity: "epic",
    desc: "藍證任務一全中（6支）且任務二滿分（100分）",
    check: c => {
      if (!certTaskPassed(c.certification, "blue", "task1")) return false;
      if (!certTaskPassed(c.certification, "blue", "task2")) return false;
      return certTaskVal(c.certification, "blue", "task1", "hits") >= 6
          && certTaskVal(c.certification, "blue", "task2", "score") >= 100;
    }
  },
  { id: "cert_blue_great", cat: "cert", icon: "✨", name: "藍證優秀",     rarity: "rare",
    desc: "藍證任務一命中 5 支以上且任務二 90 分以上",
    check: c => {
      if (!certTaskPassed(c.certification, "blue", "task1")) return false;
      if (!certTaskPassed(c.certification, "blue", "task2")) return false;
      return certTaskVal(c.certification, "blue", "task1", "hits") >= 5
          && certTaskVal(c.certification, "blue", "task2", "score") >= 90;
    }
  },

  { id: "cert_gold",       cat: "cert", icon: "🏅", name: "金證射手",     rarity: "legendary",
    desc: "取得射手證最高榮譽——金證",
    check: c => c.certification?.level === "gold" },

  { id: "cert_gold_top",   cat: "cert", icon: "👑", name: "金證完美",     rarity: "legendary",
    desc: "金證任務一全中（6支）且任務二滿分（100分）",
    check: c => {
      if (c.certification?.level !== "gold") return false;
      return certTaskVal(c.certification, "gold", "task1", "hits") >= 6
          && certTaskVal(c.certification, "gold", "task2", "score") >= 100;
    }
  },
  { id: "cert_gold_great", cat: "cert", icon: "🌠", name: "金證優秀",     rarity: "epic",
    desc: "金證任務一命中 5 支以上且任務二 90 分以上",
    check: c => {
      if (c.certification?.level !== "gold") return false;
      return certTaskVal(c.certification, "gold", "task1", "hits") >= 5
          && certTaskVal(c.certification, "gold", "task2", "score") >= 90;
    }
  },

  // 射手證編號
  { id: "archer_no_20",  cat: "cert", icon: "🔢", name: "元老號碼",   rarity: "legendary",
    desc: "射手證編號在 20 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 20; } },
  { id: "archer_no_50",  cat: "cert", icon: "🔢", name: "早鳥號碼",   rarity: "epic",
    desc: "射手證編號在 50 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 50; } },
  { id: "archer_no_100", cat: "cert", icon: "🔢", name: "百內射手",   rarity: "rare",
    desc: "射手證編號在 100 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 100; } },
  { id: "archer_no_200", cat: "cert", icon: "🔢", name: "雙百射手",   rarity: "uncommon",
    desc: "射手證編號在 200 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 200; } },
  { id: "archer_no_500", cat: "cert", icon: "🔢", name: "五百射手",   rarity: "common",
    desc: "射手證編號在 500 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 500; } },

  // ══ 檢定 — 裸弓 ══
  { id: "bare_entry",  cat: "level", icon: "🏹", name: "裸弓入門",   rarity: "common",   desc: "裸弓年度檢定達到入門",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "入門") },
  { id: "bare_basic",  cat: "level", icon: "🏹", name: "裸弓初級",   rarity: "common",   desc: "裸弓年度檢定達到初級",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "初級") },
  { id: "bare_mid",    cat: "level", icon: "🏹", name: "裸弓中級",   rarity: "uncommon", desc: "裸弓年度檢定達到中級",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "中級") },
  { id: "bare_adv",    cat: "level", icon: "🏹", name: "裸弓進階",   rarity: "rare",     desc: "裸弓年度檢定達到進階",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "進階") },
  { id: "bare_elite",  cat: "level", icon: "🏹", name: "裸弓精英",   rarity: "epic",     desc: "裸弓年度檢定達到精英",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "精英") },

  // ══ 檢定 — 獵弓 ══
  { id: "comp_entry",  cat: "level", icon: "🦅", name: "獵弓入門",   rarity: "common",   desc: "獵弓年度檢定達到入門",  check: c => bowAtLeast(c.certRecords, "compound", "入門") },
  { id: "comp_basic",  cat: "level", icon: "🦅", name: "獵弓初級",   rarity: "common",   desc: "獵弓年度檢定達到初級",  check: c => bowAtLeast(c.certRecords, "compound", "初級") },
  { id: "comp_mid",    cat: "level", icon: "🦅", name: "獵弓中級",   rarity: "uncommon", desc: "獵弓年度檢定達到中級",  check: c => bowAtLeast(c.certRecords, "compound", "中級") },
  { id: "comp_adv",    cat: "level", icon: "🦅", name: "獵弓進階",   rarity: "rare",     desc: "獵弓年度檢定達到進階",  check: c => bowAtLeast(c.certRecords, "compound", "進階") },
  { id: "comp_elite",  cat: "level", icon: "🦅", name: "獵弓精英",   rarity: "epic",     desc: "獵弓年度檢定達到精英",  check: c => bowAtLeast(c.certRecords, "compound", "精英") },

  // ══ 檢定 — 傳統弓 ══
  { id: "trad_entry",  cat: "level", icon: "🌿", name: "傳統弓入門", rarity: "common",   desc: "傳統弓年度檢定達到入門", check: c => bowAtLeast(c.certRecords, "traditional", "入門") },
  { id: "trad_basic",  cat: "level", icon: "🌿", name: "傳統弓初級", rarity: "common",   desc: "傳統弓年度檢定達到初級", check: c => bowAtLeast(c.certRecords, "traditional", "初級") },
  { id: "trad_mid",    cat: "level", icon: "🌿", name: "傳統弓中級", rarity: "uncommon", desc: "傳統弓年度檢定達到中級", check: c => bowAtLeast(c.certRecords, "traditional", "中級") },
  { id: "trad_adv",    cat: "level", icon: "🌿", name: "傳統弓進階", rarity: "rare",     desc: "傳統弓年度檢定達到進階", check: c => bowAtLeast(c.certRecords, "traditional", "進階") },
  { id: "trad_elite",  cat: "level", icon: "🌿", name: "傳統弓精英", rarity: "epic",     desc: "傳統弓年度檢定達到精英", check: c => bowAtLeast(c.certRecords, "traditional", "精英") },

  // ══ 檢定 — 跨弓成就 ══
  { id: "multi_mid2",   cat: "level", icon: "🔀", name: "左右開弓",   rarity: "rare",
    desc: "兩種弓以上達到中級",    check: c => bowCountAtLeast(c.certRecords, "中級", 2) },
  { id: "multi_adv2",   cat: "level", icon: "🔀", name: "左右逢源",   rarity: "epic",
    desc: "兩種弓以上達到進階",    check: c => bowCountAtLeast(c.certRecords, "進階", 2) },
  { id: "multi_elite2", cat: "level", icon: "🔀", name: "左右互搏",   rarity: "legendary",
    desc: "兩種弓以上達到精英",    check: c => bowCountAtLeast(c.certRecords, "精英", 2) },

  { id: "all_mid3",     cat: "level", icon: "🎖️", name: "全職弓手",   rarity: "epic",
    desc: "三種弓以上達到中級",    check: c => bowCountAtLeast(c.certRecords, "中級", 3) },
  { id: "all_adv3",     cat: "level", icon: "🎖️", name: "全職射手",   rarity: "legendary",
    desc: "三種弓以上達到進階",    check: c => bowCountAtLeast(c.certRecords, "進階", 3) },
  { id: "all_elite3",   cat: "level", icon: "🎖️", name: "全職獵人",   rarity: "legendary", hidden: true,
    riddle: "三道試煉，缺一不可　🏹 🦅 🌿", desc: "三種弓以上達到精英",
    check: c => bowCountAtLeast(c.certRecords, "精英", 3) },

  // ══ 收藏 — 個別章 ══
  { id: "fatcat_bronze",  cat: "collect", icon: "🐱", name: "貓奴入門",   rarity: "common",
    desc: "獲得第一個肥貓銅章",    check: c => (c.member?.fatCat?.bronze || 0) >= 1 },
  { id: "fatcat_silver",  cat: "collect", icon: "🐱", name: "肥貓騎士",   rarity: "uncommon",
    desc: "取得肥貓銀章一顆",      check: c => (c.member?.fatCat?.silver || 0) >= 1 },
  { id: "fatcat_gold",    cat: "collect", icon: "👑", name: "肥貓之王",   rarity: "epic",
    desc: "肥貓章累積達到金章",    check: c => (c.member?.fatCat?.gold || 0) >= 1 },

  { id: "score_bronze",   cat: "collect", icon: "⭐", name: "積分新星",   rarity: "common",
    desc: "獲得第一個積分銅章",    check: c => (c.member?.score?.bronze || 0) >= 1 },
  { id: "score_silver",   cat: "collect", icon: "⭐", name: "積分銀星",   rarity: "uncommon",
    desc: "取得積分銀章一顆",      check: c => (c.member?.score?.silver || 0) >= 1 },
  { id: "score_gold",     cat: "collect", icon: "🌠", name: "積分大師",   rarity: "epic",
    desc: "積分章累積達到金章",    check: c => (c.member?.score?.gold || 0) >= 1 },

  { id: "ach_silver",     cat: "collect", icon: "🏆", name: "成就獵人",   rarity: "common",
    desc: "獲得第一個成就銀章",    check: c => (c.member?.achievement?.silver || 0) >= 1 },
  { id: "ach_gold",       cat: "collect", icon: "🏆", name: "金光閃閃",   rarity: "uncommon",
    desc: "取得成就金章一顆",      check: c => (c.member?.achievement?.gold || 0) >= 1 },
  { id: "ach_black",      cat: "collect", icon: "⬛", name: "黑牌傳說",   rarity: "legendary",
    desc: "成就章累積達到黑牌",    check: c => (c.member?.achievement?.black || 0) >= 1 },

  // ══ 收藏 — 組合章 ══
  { id: "set_lowest",  cat: "collect", icon: "✨", name: "初現光芒",   rarity: "uncommon",
    desc: "三種章各有最低級：肥貓銅章、積分銅章、成就銀章",
    check: c =>
      (c.member?.fatCat?.bronze    || 0) >= 1 &&
      (c.member?.score?.bronze     || 0) >= 1 &&
      (c.member?.achievement?.silver || 0) >= 1
  },
  { id: "set_mid",     cat: "collect", icon: "💫", name: "披掛上陣",   rarity: "epic",
    desc: "三種章各有中級：肥貓銀章、積分銀章、成就金章",
    check: c =>
      (c.member?.fatCat?.silver    || 0) >= 1 &&
      (c.member?.score?.silver     || 0) >= 1 &&
      (c.member?.achievement?.gold || 0) >= 1
  },
  { id: "set_top",     cat: "collect", icon: "👑", name: "穿金戴銀",   rarity: "legendary",
    desc: "三種章各有最高級：肥貓金章、積分金章、成就黑牌",
    check: c =>
      (c.member?.fatCat?.gold      || 0) >= 1 &&
      (c.member?.score?.gold       || 0) >= 1 &&
      (c.member?.achievement?.black || 0) >= 1
  },

  // ══ 打怪模式 — 累積場數 ══
  { id: "monster_first",   cat: "monster", icon: "👹", name: "初入戰場",   rarity: "common",
    desc: "第一次擊敗怪物",
    check: c => Object.values(c.monsterDex || {}).some(m => (m.wins || 0) > 0) },
  { id: "monster_5",       cat: "monster", icon: "⚔️", name: "身經百戰",   rarity: "uncommon",
    desc: "累積擊敗怪物 5 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 5 },
  { id: "monster_10",      cat: "monster", icon: "🗡️", name: "殺伐決斷",   rarity: "rare",
    desc: "累積擊敗怪物 10 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 10 },
  { id: "monster_30",      cat: "monster", icon: "🔱", name: "百戰老將",   rarity: "epic",
    desc: "累積擊敗怪物 30 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 30 },
  { id: "monster_mvp1",    cat: "monster_boss", icon: "🌟", name: "首殺頭目",   rarity: "rare",
    desc: "擊敗任意一隻頭目（boss）",
    check: c => monsterWinsByTier(c.monsterDex, "boss") >= 1 },
  { id: "monster_mvp10",   cat: "monster_boss", icon: "💥", name: "頭目獵人",   rarity: "legendary",
    desc: "累積擊敗頭目（boss）10 次以上",
    check: c => monsterWinsByTier(c.monsterDex, "boss") >= 10 },
  // 神話成就
  { id: "mythic_first",    cat: "monster", icon: "🌋", name: "神話挑戰者", rarity: "epic",
    desc: "第一次擊敗神話怪物",
    check: c => monsterWinsByTier(c.monsterDex, "mythic") >= 1 },
  { id: "mythic_all",      cat: "monster", icon: "👑", name: "封神之路",   rarity: "mythic",
    desc: "擊敗全部 6 隻神話怪物", hidden: true,
    riddle: "六大神話，一個都不能少…",
    check: c => ["ghost_6","mountain_6","insect_6","workplace_6","exam_6","temple_6"].every(id => (c.monsterDex?.[id]?.wins || 0) > 0) },
  // 六族全圖鑑
  { id: "dex_all6",        cat: "monster", icon: "🏆", name: "六族征服者", rarity: "epic",
    desc: "六大族各擊敗至少一隻",
    check: c => ["ghost","mountain","insect","workplace","exam","temple"].every(fam =>
      Object.entries(c.monsterDex || {}).some(([id, m]) => id.startsWith(fam + "_") && (m.wins || 0) > 0)) },
  { id: "dex_all36",       cat: "monster", icon: "📖", name: "圖鑑完成",   rarity: "legendary",
    desc: "擊敗全部 36 隻怪物", hidden: true,
    riddle: "三十六道關卡，一個都不能逃…",
    check: c => Object.values(c.monsterDex || {}).filter(m => (m.wins || 0) > 0).length >= 36 },
  // 掉寶成就（check 暫為 false）
  { id: "drop_rare",      cat: "monster", icon: "📦", name: "初嚐甜頭",   rarity: "rare",
    desc: "打怪模式獲得稀有掉寶",  check: _c => false },
  { id: "drop_epic",      cat: "monster", icon: "🎁", name: "奇蹟降臨",   rarity: "epic",
    desc: "打怪模式獲得史詩掉寶",  check: _c => false },
  { id: "drop_legendary", cat: "monster", icon: "🏺", name: "傳說之物",   rarity: "legendary",
    desc: "打怪模式獲得傳說掉寶",  check: _c => false },
  { id: "drop_mythic",    cat: "monster", icon: "🌋", name: "神話現世",   rarity: "mythic",
    desc: "打怪模式獲得神話掉寶",  check: _c => false },

  // ══ 決鬥模式 ══
  { id: "duel_first",     cat: "duel", icon: "🤺", name: "踏上決鬥場",   rarity: "common",
    desc: "第一次參加決鬥模式（勝負不拘）",
    check: c => (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0) >= 1 },

  { id: "duel_loss3",     cat: "duel", icon: "🩹", name: "越挫越勇",    rarity: "common",
    desc: "決鬥中累積落敗 3 次，但你還是回來了",
    check: c => (c.duelStats?.losses || 0) >= 3 },

  { id: "duel_win1",      cat: "duel", icon: "🏴", name: "初勝",        rarity: "uncommon",
    desc: "決鬥模式首次獲勝",
    check: c => (c.duelStats?.wins || 0) >= 1 },

  { id: "duel_draw",      cat: "duel", icon: "🤝", name: "棋逢對手",    rarity: "uncommon",
    desc: "在決鬥中達成平局",
    check: c => (c.duelStats?.draws || 0) >= 1 },

  { id: "duel_solo_win1", cat: "duel", icon: "🗡", name: "單挑王",      rarity: "uncommon",
    desc: "1v1 決鬥模式首次獲勝",
    check: c => (c.duelStats?.soloWins || 0) >= 1 },

  { id: "duel_team_win1", cat: "duel", icon: "🛡", name: "隊長魂",      rarity: "uncommon",
    desc: "組隊決鬥模式首次獲勝",
    check: c => (c.duelStats?.teamWins || 0) >= 1 },

  { id: "duel_win5",      cat: "duel", icon: "⚔️", name: "百戰老將",    rarity: "rare",
    desc: "決鬥模式累積勝利 5 次",
    check: c => (c.duelStats?.wins || 0) >= 5 },

  { id: "duel_dmg1000",   cat: "duel", icon: "💥", name: "千點傷害",    rarity: "rare",
    desc: "決鬥中累積造成 1000 點傷害",
    check: c => (c.duelStats?.totalDmg || 0) >= 1000 },

  { id: "duel_win10",     cat: "duel", icon: "🏆", name: "決鬥大師",    rarity: "epic",
    desc: "決鬥模式累積勝利 10 次",
    check: c => (c.duelStats?.wins || 0) >= 10 },

  { id: "duel_winrate70", cat: "duel", icon: "📊", name: "決鬥強者",    rarity: "epic",
    desc: "累積 10 場決鬥，且勝率達 70% 以上",
    check: c => {
      const total = (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0);
      if (total < 10) return false;
      return (c.duelStats?.wins || 0) / total >= 0.7;
    } },

  { id: "duel_win25",     cat: "duel", icon: "👑", name: "決鬥王者",    rarity: "epic",
    desc: "決鬥模式累積勝利 25 次",
    check: c => (c.duelStats?.wins || 0) >= 25 },

  { id: "duel_flawless",  cat: "duel", icon: "💎", name: "完美決鬥",    rarity: "legendary", hidden: true,
    riddle: "一滴血未流，卻讓對方倒下…",
    desc: "決鬥模式以完美HP獲勝，自身HP未減少",
    check: c => (c.duelStats?.flawless || 0) >= 1 },

  { id: "duel_flawless5", cat: "duel", icon: "✨", name: "無懈可擊",    rarity: "legendary", hidden: true,
    riddle: "五次無傷完勝，傳說級箭術…",
    desc: "累積 5 次完美決鬥獲勝",
    check: c => (c.duelStats?.flawless || 0) >= 5 },

  // ══ 煉製 ══
  { id: "brew_first",    cat: "forge", icon: "🧪", name: "初學煉金",   rarity: "common",
    desc: "第一次合成藥水",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 1 },
  { id: "brew_5",        cat: "forge", icon: "⚗️", name: "藥水調製師", rarity: "uncommon",
    desc: "累積合成藥水 5 瓶",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 5 },
  { id: "brew_10",       cat: "forge", icon: "💊", name: "藥劑大師",   rarity: "rare",
    desc: "累積合成藥水 10 瓶",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 10 },
  { id: "brew_all",      cat: "forge", icon: "🌈", name: "全能藥師",   rarity: "epic",
    desc: "新版消耗品各製作過至少一次", hidden: true,
    riddle: "工坊百味，缺一不可…",
    check: c => POTIONS.every(p => (c.craftStats?.potionTypesCrafted?.[p.id] || 0) >= 1) },
  { id: "frag_forge_1",  cat: "forge", icon: "✨", name: "碎片煉士",   rarity: "uncommon",
    desc: "第一次合成章碎片",
    check: c => (c.craftStats?.fragsCrafted || 0) >= 1 },
  { id: "frag_forge_all",cat: "forge", icon: "🌟", name: "三章合一",   rarity: "rare",
    desc: "三種章碎片各合成過至少一次",
    check: c => Object.keys(c.craftStats?.fragTypesCrafted || {}).length >= 3 },
  { id: "frag_forge_5",  cat: "forge", icon: "💎", name: "鑄章大師",   rarity: "epic",
    desc: "累積合成章碎片 5 次",
    check: c => (c.craftStats?.fragsCrafted || 0) >= 5 },

  // ══ 藥水使用 — 累積場數 ══
  { id: "potion_any_1",  cat: "forge", icon: "🧪", name: "初識藥水",   rarity: "common",
    desc: "第一次在戰鬥中使用藥水",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 1 },
  { id: "potion_any_10", cat: "forge", icon: "💊", name: "藥水依賴",   rarity: "uncommon",
    desc: "累積使用藥水 10 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 10 },
  { id: "potion_any_30", cat: "forge", icon: "⚗️", name: "藥水大戶",   rarity: "rare",
    desc: "累積使用藥水 30 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 30 },
  { id: "potion_any_50", cat: "forge", icon: "🔮", name: "藥水狂熱者", rarity: "epic",
    desc: "累積使用藥水 50 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 50 },
  { id: "potion_all_9",  cat: "forge", icon: "🌈", name: "全種藥師",   rarity: "epic",
    desc: "所有已開放消耗品各使用至少一次", hidden: true,
    riddle: "百味戰術，各試過一遍…",
    check: c => POTIONS.filter(p => !p.futureFeature).every(p => (c.potionDex?.used?.[p.id] || 0) >= 1) },

  // ══ 怪物卡收藏 ══
  { id: "card_1",         cat: "card", icon: "🃏", name: "初探怪窟",   rarity: "common",
    desc: "收集第一張怪物卡",
    check: c => (c.cardCount || 0) >= 1 },
  { id: "card_5",         cat: "card", icon: "🃏", name: "收藏家入門", rarity: "uncommon",
    desc: "收集 5 種怪物卡",
    check: c => (c.cardCount || 0) >= 5 },
  { id: "card_10",        cat: "card", icon: "🃏", name: "卡片達人",   rarity: "rare",
    desc: "收集 10 種怪物卡",
    check: c => (c.cardCount || 0) >= 10 },
  { id: "card_15",        cat: "card", icon: "🃏", name: "卡片狂人",   rarity: "epic",
    desc: "收集 15 種怪物卡",
    check: c => (c.cardCount || 0) >= 15 },
  { id: "card_20",        cat: "card", icon: "🃏", name: "怪物圖鑑家", rarity: "legendary",
    desc: "收集 20 種怪物卡",
    check: c => (c.cardCount || 0) >= 20 },
  { id: "card_mythic",    cat: "card", icon: "✨", name: "傳說獵手",   rarity: "epic",
    desc: "獲得至少一張神話怪物卡", hidden: true,
    riddle: "凡俗之手，握住了傳說…",
    check: c => (c.mythicCards || 0) >= 1 },
  { id: "card_all6fam",   cat: "card", icon: "🌐", name: "七族全收",   rarity: "epic",
    desc: `${MONSTER_CARD_FAMILIES.length} 大族群各收集至少一張一般怪物卡`, hidden: true,
    riddle: "七種血脈，盡收囊中…",
    check: c => MONSTER_CARD_FAMILIES.every(fam => c.cardFamilies?.includes(fam)) },

  // ══ 冒險者公會 ══
  { id: "guild_first_xp",     cat: "guild", icon: "⚔️", name: "初入公會",   rarity: "common",
    desc: "在冒險者公會首次累積 XP",
    check: c => (c.member?.adventurerXP || 0) > 0 },

  { id: "guild_lv10",         cat: "guild", icon: "🥉", name: "青銅巔峰",   rarity: "common",
    desc: "冒險者等級達到 Lv.10",
    check: c => levelFromXP(c.member?.adventurerXP || 0) >= 10 },

  { id: "guild_promo_bronze", cat: "guild", icon: "🥈", name: "白銀晉階",   rarity: "uncommon",
    desc: "完成 Lv.10 晉階儀式，踏入白銀階級",
    check: c => (c.member?.promotionDone || []).includes(10) },

  { id: "guild_promo_silver", cat: "guild", icon: "🥇", name: "黃金晉階",   rarity: "rare",
    desc: "完成 Lv.20 晉階儀式，展現精英實力",
    check: c => (c.member?.promotionDone || []).includes(20) },

  { id: "guild_promo_gold",   cat: "guild", icon: "💎", name: "白金晉階",   rarity: "epic",
    desc: "完成 Lv.30 晉階儀式，躋身頂尖射手",
    check: c => (c.member?.promotionDone || []).includes(30) },

  { id: "guild_promo_plat",   cat: "guild", icon: "🔥", name: "傳說晉階",   rarity: "legendary",
    desc: "完成 Lv.40 晉階儀式，成為傳說冒險者",
    check: c => (c.member?.promotionDone || []).includes(40) },

  { id: "guild_promo_legend", cat: "guild", icon: "⚡", name: "神話晉階",   rarity: "mythic",
    desc: "完成 Lv.50 晉階儀式，踏入神話領域",
    check: c => (c.member?.promotionDone || []).includes(50) },

  { id: "guild_max",          cat: "guild", icon: "👑", name: "神話滿等",   rarity: "mythic",
    desc: "冒險者等級達到最高境界 Lv.60",
    check: c => levelFromXP(c.member?.adventurerXP || 0) >= 60 },

  // ══ 地下城道具圖鑑 ══（2026-07-09 重寫：舊版依賴 dungeonClears/dungeonFamClear，
  // 全專案沒有任何地方會寫入這兩個欄位，是永遠不可能達成的死成就。改用真實會寫入的
  // member.dungeonCollectibles（地下城掉落收藏品，見 dungeonCollectibles.js，
  // 6族×(20普通+10稀有+5頭目+1超稀有)=216件+24首通紀念章=240件）。
  { id: "collectible_first",    cat: "dungeon", icon: "🎒", name: "初次拾獲",     rarity: "common",
    desc: "第一次在地下城拾獲收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 1 },
  { id: "collectible_10",       cat: "dungeon", icon: "🧳", name: "小有收穫",     rarity: "uncommon",
    desc: "累積拾獲 10 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 10 },
  { id: "collectible_60",       cat: "dungeon", icon: "📦", name: "探險家的行囊", rarity: "rare",
    desc: "累積拾獲 60 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 60 },
  { id: "collectible_150",      cat: "dungeon", icon: "🏺", name: "秘寶收藏家",   rarity: "epic",
    desc: "累積拾獲 150 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 150 },
  { id: "collectible_all_fam",  cat: "dungeon", icon: "🗺️", name: "六族踏查",     rarity: "epic", hidden: true,
    riddle: "六片土地，都留下了你的足跡…",
    desc: "六大族地下城各拾獲至少一件收藏品",
    check: c => ["ghost","mountain","insect","workplace","exam","temple"].every(fam =>
      Object.keys(c.member?.dungeonCollectibles || {}).some(id => COLLECTIBLE_MAP[id]?.family === fam)) },
  { id: "collectible_master",   cat: "dungeon", icon: "👑", name: "圖鑑大師",     rarity: "mythic", hidden: true,
    riddle: `${Object.keys(COLLECTIBLE_MAP).length} 件秘寶，一件不缺…`,
    desc: `收集全部地下城收藏品（${Object.keys(COLLECTIBLE_MAP).length} 件）`,
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= Object.keys(COLLECTIBLE_MAP).length },
];

// ── 動態加入：族群 1~6 級各一個成就 ───────────────────────────
const FAM_ICONS = { ghost:"👻", mountain:"🏔️", insect:"🦂", workplace:"💼", exam:"📝", temple:"🏰", treasure:"📦" };
const FAM_LABELS = { ghost:"鬼怪族", mountain:"山林族", insect:"毒蟲族", workplace:"職場族", exam:"考試族", temple:"西方怪物族", treasure:"寶箱族" };
const TIER_RARITIES_LIST = ["common","uncommon","rare","epic","legendary","mythic"];
const TIER_NAMES_LIST    = ["一星","二星","三星","四星","五星","六星"];

for (const fam of ["ghost","mountain","insect","workplace","exam","temple"]) {
  for (let t = 1; t <= 6; t++) {
    const monsterId = `${fam}_${t}`;
    const monster = MONSTERS.find(m => m.id === monsterId);
    AUTO_ACHIEVEMENTS.push({
      id:     `dex_${fam}_t${t}`,
      cat:    "monster",
      icon:   FAM_ICONS[fam],
      name:   `${FAM_LABELS[fam]}${TIER_NAMES_LIST[t-1]}`,
      rarity: TIER_RARITIES_LIST[t-1],
      desc:   monster ? `擊敗「${monster.name}」（${FAM_LABELS[fam]}${t}級）` : `擊敗${FAM_LABELS[fam]}${t}級怪物`,
      check:  c => (c.monsterDex?.[monsterId]?.wins || 0) > 0,
    });
  }
}

// ── 動態加入：地下城道具圖鑑（每族普通/稀有/頭目/超稀有 + 首通紀念章）──
for (const fam of ["ghost","mountain","insect","workplace","exam","temple"]) {
  const pool = FAMILY_COLLECTIBLES[fam];
  const commonIds    = (pool?.common    || []).map(i => i.id);
  const rareIds      = (pool?.rare      || []).map(i => i.id);
  const bossIds      = (pool?.boss      || []).map(i => i.id);
  const superRareId  = pool?.superRare?.[0]?.id;

  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_common10`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}拾荒者`, rarity: "uncommon",
    desc: `${FAM_LABELS[fam]}地下城累積拾獲 10 種普通收藏品`,
    check: c => commonIds.filter(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0).length >= 10,
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_common_all`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}收藏家`, rarity: "rare", hidden: true,
    riddle: `${FAM_LABELS[fam]}的每一寸角落，都被翻找過…`,
    desc: `${FAM_LABELS[fam]}地下城收集全部 20 種普通收藏品`,
    check: c => commonIds.length > 0 && commonIds.every(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_rare1`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}稀有獵人`, rarity: "rare",
    desc: `拾獲${FAM_LABELS[fam]}任一稀有收藏品`,
    check: c => rareIds.some(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_rare_all`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}稀有大師`, rarity: "epic", hidden: true,
    riddle: "十件稀世珍寶，缺一不可…",
    desc: `${FAM_LABELS[fam]}地下城收集全部 10 種稀有收藏品`,
    check: c => rareIds.length > 0 && rareIds.every(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_boss1`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}王者遺物`, rarity: "legendary",
    desc: `拾獲${FAM_LABELS[fam]}任一頭目專屬收藏品`,
    check: c => bossIds.some(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  if (superRareId) {
    AUTO_ACHIEVEMENTS.push({
      id: `dungeon_${fam}_superrare`, cat: "dungeon", icon: FAM_ICONS[fam],
      name: `${FAM_LABELS[fam]}至寶`, rarity: "mythic", hidden: true,
      riddle: "傳說中的至寶，只有極少數人見過…",
      desc: `拾獲${FAM_LABELS[fam]}的超稀有收藏品`,
      check: c => (c.member?.dungeonCollectibles?.[superRareId] || 0) > 0,
    });
  }
}

// 首通紀念章（COLLECTIBLE_MAP 裡 rarity==="exclusive" 的項目，6族×4難度=24張）
for (const item of Object.values(COLLECTIBLE_MAP)) {
  if (item.rarity !== "exclusive") continue;
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_trophy_${item.dungeonId}`, cat: "dungeon", icon: item.icon,
    name: item.name, rarity: "epic",
    desc: `取得「${item.name}」——${FAM_LABELS[item.family] || item.family}地下城首通紀念`,
    check: c => (c.member?.dungeonCollectibles?.[item.id] || 0) > 0,
  });
}

// ── 動態加入：世界王專屬收藏獎盃成就（尾刀+前三名，24隻×2=48個）────
for (const t of Object.values(WB_TROPHY_MAP)) {
  AUTO_ACHIEVEMENTS.push({
    id: `wb_trophy_${t.id}`, cat: "worldboss_rank", icon: t.icon,
    name: t.name, rarity: t.kind === "lastHit" ? "mythic" : "legendary",
    desc: t.desc, hidden: true,
    riddle: t.kind === "lastHit" ? "終結牠的人，只有一個…" : "傷害的證明，刻在勳章上…",
    check: c => (c.member?.dungeonCollectibles?.[t.id] || 0) > 0,
  });
}

// ── 動態加入：單一怪物擊殺次數成就 ──────────────────────────────
const KILL_MILESTONES = [5, 10, 25, 50, 100];
const KILL_RARITIES = { 5:"common", 10:"uncommon", 25:"rare", 50:"epic", 100:"legendary" };
const KILL_ICONS    = { 5:"⚔️", 10:"🗡️", 25:"💀", 50:"🔱", 100:"👑" };
const TARGET_KILL_MILESTONES = [1, ...KILL_MILESTONES];
const TARGET_KILL_RARITIES = { 1:"common", ...KILL_RARITIES };
const TARGET_KILL_ICONS = { 1:"⚔️", ...KILL_ICONS };

function buildMonsterTargetTiers(label, firstIcon) {
  return TARGET_KILL_MILESTONES.map(count => ({
    count,
    rarity: TARGET_KILL_RARITIES[count],
    icon: count === 1 ? firstIcon : TARGET_KILL_ICONS[count],
    name: count === 1 ? "首次討伐" : `擊倒 ${count} 次`,
    desc: count === 1 ? `第一次擊敗${label}` : `累積擊敗${label} ${count} 次`,
  }));
}

for (const monster of MONSTERS) {
  for (const n of KILL_MILESTONES) {
    AUTO_ACHIEVEMENTS.push({
      id:     `kill_${monster.id}_${n}`,
      cat:    "monster",
      icon:   monster.icon,
      name:   `${monster.name}剋星 ×${n}`,
      rarity: KILL_RARITIES[n],
      desc:   `擊敗「${monster.name}」${n} 次`,
      check:  c => (c.monsterDex?.[monster.id]?.wins || 0) >= n,
    });
  }
}

// ── 動態加入：開箱次數成就 ────────────────────────────────────────
const CHEST_10000_MILESTONES = [1, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const CHEST_500_MILESTONES = [1, 5, 10, 20, 50, 100, 250, 500];
const CHEST_100_MILESTONES = [1, 5, 10, 20, 50, 100];
const CHEST_FAMILY_DEX = [
  ["ghost", "👻", "鬼怪族"], ["mountain", "🏔️", "山林族"], ["insect", "🦂", "毒蟲族"],
  ["workplace", "💼", "職場族"], ["exam", "📝", "考試族"], ["temple", "🏰", "西方怪物族"],
  ["treasure", "📦", "寶箱族"],
];
export const CHEST_DEX_TYPES = [
  { id:"wood",          statKey:"wood",          icon:"📦", name:"通用材料木箱", milestones:CHEST_10000_MILESTONES },
  { id:"iron",          statKey:"iron",          icon:"🧰", name:"通用材料鐵箱", milestones:CHEST_10000_MILESTONES },
  { id:"gold",          statKey:"gold",          icon:"🎁", name:"通用材料金箱", milestones:CHEST_10000_MILESTONES },
  { id:"epic",          statKey:"epic",          icon:"💜", name:"通用材料史詩箱", milestones:CHEST_10000_MILESTONES },
  { id:"mythic",        statKey:"mythic",        icon:"🔮", name:"通用材料神話箱", milestones:CHEST_10000_MILESTONES },
  { id:"potion",        statKey:"potion",        icon:"🧪", name:"藥水箱", milestones:CHEST_10000_MILESTONES },
  { id:"coin",          statKey:"coin",          icon:"🪙", name:"金幣寶箱", milestones:CHEST_10000_MILESTONES },
  { id:"card_pack",     statKey:"card_pack",     icon:"🃏", name:"怪物卡包", milestones:CHEST_10000_MILESTONES },
  { id:"cat_box",       statKey:"cat_box",       icon:"🎐", name:"貓貓箱", milestones:CHEST_100_MILESTONES },
  { id:"mimi_box",      statKey:"mimi_box",      icon:"😺", name:"咪咪箱", milestones:CHEST_100_MILESTONES },
  ...CHEST_FAMILY_DEX.map(([family, icon, label]) => ({
    id:`family_mat_${family}`, statKey:`family_mat_${family}`, family, icon,
    name:`${label}素材箱`, milestones:CHEST_10000_MILESTONES,
  })),
  { id:"mini_boss_mat", statKey:"mini_boss_mat", icon:"🔶", name:"小王素材箱", milestones:CHEST_500_MILESTONES },
  { id:"boss_mat",      statKey:"boss_mat",      icon:"🔴", name:"大王素材箱", milestones:CHEST_500_MILESTONES },
];
const LEGACY_CHEST_ACH_TYPES = [
  { id:"wood", icon:"📦", name:"木寶箱" },
  { id:"iron", icon:"🧰", name:"鐵寶箱" },
  { id:"gold", icon:"🎁", name:"黃金寶箱" },
  { id:"epic", icon:"💜", name:"史詩寶箱" },
  { id:"mythic", icon:"🔮", name:"神話寶箱" },
  { id:"cat", icon:"🐱", name:"貓貓箱" },
  { id:"potion", icon:"🧪", name:"藥水箱" },
];
const LEGACY_CHEST_OPEN_MILESTONES = [1, 5, 10, 20];
function chestMilestoneRarity(count, max) {
  if (count >= max) return "legendary";
  if (count >= Math.max(20, Math.floor(max * 0.05))) return "epic";
  if (count >= Math.max(10, Math.floor(max * 0.01))) return "rare";
  if (count >= 10) return "uncommon";
  return "common";
}
const CHEST_OPEN_RARITIES = Object.fromEntries(
  CHEST_10000_MILESTONES.map(count => [count, chestMilestoneRarity(count, 10000)])
);

for (const ct of LEGACY_CHEST_ACH_TYPES) {
  for (const n of LEGACY_CHEST_OPEN_MILESTONES) {
    AUTO_ACHIEVEMENTS.push({
      id:     `chest_${ct.id}_open_${n}`,
      cat:    "monster",
      // 舊版開箱 AUTO 曾掛在「打怪」；現行 13 種寶箱已改由 cat=chest 的單張 tiered 圖鑑承接。
      // ID 留著只為歷史 seen/notified 相容，全部退役避免再次混進「戰鬥 > 打怪」。
      retired: true,
      retiredReason: "舊版開箱 AUTO 已由戰鬥／寶箱分類的現行階段式寶箱圖鑑取代",
      icon:   ct.icon,
      name:   `${ct.name}開了 ${n} 次`,
      rarity: CHEST_OPEN_RARITIES[n],
      desc:   n === 1 ? `第一次開啟${ct.name}` : `累積開啟${ct.name} ${n} 次`,
      check:  c => (c.chestStats?.[ct.id] || 0) >= n,
    });
  }
}

// ── 動態加入：每種藥水使用次數成就 ──────────────────────────────
const POTION_RARITY_MILESTONES = {
  common:    [[1,"common","初嘗"], [3,"uncommon","慣用"], [5,"rare","老手"], [10,"epic","沉迷"]],
  rare:      [[1,"uncommon","初嘗"], [3,"rare","慣用"], [5,"epic","老手"]],
  epic:      [[1,"rare","初嘗"], [3,"epic","慣用"]],
  legendary: [[1,"epic","初嘗"]],
};

for (const potion of POTIONS.filter(item => !item.futureFeature)) {
  const milestones = POTION_RARITY_MILESTONES[potion.rarity] || POTION_RARITY_MILESTONES.common;
  for (const [count, rarity, suffix] of milestones) {
    AUTO_ACHIEVEMENTS.push({
      id:     `potion_${potion.id}_${count}`,
      cat:    "forge",
      icon:   potion.icon,
      name:   `${potion.name} · ${suffix}`,
      rarity,
      desc:   `使用「${potion.name}」${count} 次`,
      check:  c => (c.potionDex?.used?.[potion.id] || 0) >= count,
    });
  }
}

// ── 後台授予的特殊成就 ──────────────────────────────────────
// V3 退役層：保留舊 id 供歷史資料 / localStorage seen key 相容，
// 但不再顯示、不提醒，也不進完成率分母。
const LEGACY_GUILD_AUTO_IDS = new Set([
  "guild_first_xp", "guild_lv10", "guild_promo_bronze", "guild_promo_silver",
  "guild_promo_gold", "guild_promo_plat", "guild_promo_legend", "guild_max",
]);
const LEGACY_MONSTER_AUTO_IDS = new Set([
  ...["ghost","mountain","insect","workplace","exam","temple"].flatMap(fam =>
    Array.from({ length: 6 }, (_, index) => `dex_${fam}_t${index + 1}`)
  ),
  ...MONSTERS.flatMap(monster => KILL_MILESTONES.map(count => `kill_${monster.id}_${count}`)),
]);
const RETIRED_AUTO_IDS = new Set([
  ...LEGACY_GUILD_AUTO_IDS,
  ...LEGACY_MONSTER_AUTO_IDS,
  "drop_rare", "drop_epic", "drop_legendary", "drop_mythic",
  "dex_all6", "dex_all36", "mythic_all",
]);
AUTO_ACHIEVEMENTS.forEach(achievement => {
  if (!RETIRED_AUTO_IDS.has(achievement.id)) return;
  achievement.retired = true;
  achievement.retiredReason = LEGACY_GUILD_AUTO_IDS.has(achievement.id)
    ? "舊冒險者等級系統已由新公會聲望／階級取代"
    : LEGACY_MONSTER_AUTO_IDS.has(achievement.id)
      ? "舊 36 怪個別討伐已由現行 252 怪目錄的普通怪族×T階／小王大王指定討伐取代"
    : achievement.id.startsWith("drop_")
      ? "目前沒有可靠的掉寶稀有度累計資料"
      : "舊 36 怪／六族終局條件已不符合現行擴充怪物目錄";
  if (achievement.id.startsWith("drop_")) achievement.futureData = true;
});

export const SPECIAL_GRANTS = [
  { id: "beat_coach",  cat: "special", icon: "⚔️", name: "擊敗主教練",     rarity: "legendary", hidden: true,
    riddle: "在他面前，沒有人能輕易取勝…",             desc: "在對戰中擊敗主教練" },
  { id: "beat_yumi",   cat: "special", icon: "🗡️", name: "擊敗 Yumi 教練", rarity: "legendary", hidden: true,
    riddle: "優雅的箭術背後，是難以跨越的高牆…",       desc: "在對戰中擊敗 Yumi 教練" },
  { id: "beat_shimu",  cat: "special", icon: "🏹", name: "擊敗師母",       rarity: "legendary", hidden: true,
    riddle: "傳說中的隱藏魔王，深藏不露…",             desc: "在對戰中擊敗師母" },
  { id: "helper_mat",  cat: "special", icon: "🔨", name: "箭場小工匠",     rarity: "uncommon",
    desc: "幫忙整理箭場塌塌米" },
  { id: "helper_build",cat: "special", icon: "🏗️", name: "箭場魯班",       rarity: "rare",
    desc: "協助箭場建設工程" },
  { id: "helper_task", cat: "special", icon: "📋", name: "箭場小幫手",     rarity: "common",
    desc: "幫忙箭場日常事務" },
  { id: "helper_heart",cat: "special", icon: "💝", name: "箭場小天使",     rarity: "uncommon",
    desc: "提供情緒價值，溫暖整個箭場" },
];

// ── 屆數成就（動態產生）────────────────────────────────────
export function buildRoundAchievements(type, max, granted) {
  const list = [];
  for (let r = 1; r <= max; r++) {
    const g = (granted || []).find(x => x.type === type && x.round === r);
    list.push({
      id: `${type}_${r}`,
      cat: type,
      round: r,
      name: `第 ${r} 屆`,
      unlocked: !!g,
      rank: g ? (g.rank ?? 0) : null,
    });
  }
  return list;
}

// ── 期數成就 ───────────────────────────────────────────────
export function buildCohortAchievement(joinDate) {
  const n = getCohort(joinDate);
  return {
    id: `cohort_${n}`,
    cat: "cohort",
    icon: n === 1 ? "👑" : n === 0 ? "❓" : "🎓",
    name: cohortLabel(n),
    rarity: cohortRarity(n),
    title: cohortTitle(n),
    desc: n === 0
      ? "尚未設定加入日期，期數無法判定。請聯絡教練更新資料。"
      : `${cohortLabel(n)}（${cohortTitle(n)}）— 你在這個時期加入了貓小隊射箭場`,
    unlocked: true,
  };
}

export function buildCohortAchievements(joinDate, max = 20) {
  const parsedJoinDate = joinDate ? new Date(joinDate) : null;
  const hasValidJoinDate = !!parsedJoinDate && !Number.isNaN(parsedJoinDate.getTime());
  const current = getCohort(joinDate);
  return Array.from({ length: Math.max(0, Number(max) || 0) + 1 }, (_, index) => {
    const n = index;
    return {
      id: `cohort_${n}`,
      cat: "cohort",
      icon: n === 0 ? "🌱" : n === 1 ? "👑" : "🎓",
      name: n === 0 ? "0期生" : cohortLabel(n),
      rarity: cohortRarity(n),
      title: n === 0 ? "創始期射手" : cohortTitle(n),
      desc: n === 0 ? "2022/07/16 前加入貓小隊的 0 期生" : `${cohortLabel(n)}（${cohortTitle(n)}）`,
      unlocked: hasValidJoinDate && current === n,
    };
  });
}

export function buildArcherLevelAchievement() {
  return {
    id: "archer_level_progress",
    cat: "archer_level",
    icon: "📈",
    name: "射手等級",
    desc: `射手等級 Lv.1～Lv.${MAX_ARCHER_LEVEL}`,
    directDisplay: true,
    getValue: c => archerLevelFromXP(c.member?.archerXP || 0),
    tiers: Array.from({ length: MAX_ARCHER_LEVEL }, (_, index) => {
      const level = index + 1;
      return {
        count: level,
        rarity: level >= 500 ? "mythic" : level >= 300 ? "legendary" : level >= 200 ? "epic" : level >= 100 ? "rare" : level >= 50 ? "uncommon" : "common",
        icon: level >= 500 ? "👑" : "📈",
        name: `Lv.${level}`,
        desc: `射手等級達到 Lv.${level}`,
      };
    }),
  };
}

function completedArcheryYears(joinDate, now = new Date()) {
  if (!joinDate) return 0;
  const raw = joinDate?.toDate ? joinDate.toDate() : joinDate?.seconds ? new Date(joinDate.seconds * 1000) : joinDate;
  const start = raw instanceof Date ? raw : new Date(raw);
  const end = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let years = end.getFullYear() - start.getFullYear();
  const anniversary = new Date(end.getFullYear(), start.getMonth(), start.getDate());
  if (end < anniversary) years -= 1;
  return Math.max(0, Math.min(20, years));
}

export function buildArcheryTenureAchievement(joinDate, now = new Date()) {
  return {
    id: "archery_tenure_progress",
    cat: "archery_tenure",
    icon: "🏹",
    name: "累積射齡",
    desc: "以加入箭場日期計算完整射箭年資，最多 20 年",
    directDisplay: true,
    getValue: () => completedArcheryYears(joinDate, now),
    tiers: Array.from({ length: 20 }, (_, index) => {
      const year = index + 1;
      return {
        count: year,
        rarity: year >= 20 ? "mythic" : year >= 15 ? "legendary" : year >= 10 ? "epic" : year >= 5 ? "rare" : year >= 3 ? "uncommon" : "common",
        icon: year >= 20 ? "👑" : "🏹",
        name: `${year} 年射齡`,
        desc: `完整累積 ${year} 年射箭年資`,
      };
    }),
  };
}

const ANNUAL_CERT_BOWS = Object.freeze([
  Object.freeze({ id: "recurve_bare", label: "裸弓", icon: "🏹" }),
  Object.freeze({ id: "compound", label: "獵弓", icon: "🦅" }),
  Object.freeze({ id: "traditional", label: "傳統弓", icon: "🌿" }),
]);
const ANNUAL_CERT_TIERS = Object.freeze([
  [1, "common", "入門"],
  [2, "uncommon", "初級"],
  [3, "rare", "中級"],
  [4, "epic", "進階"],
  [5, "legendary", "精英"],
]);
const normalizeAnnualBowType = bowType => bowType === "recurve_full" ? "recurve_bare" : bowType;
const normalizeAnnualHalf = half => ["second", "下", "lower", "2", 2].includes(half) ? "second" : "first";
const annualLevelValue = level => ({ 入門:1, 初級:2, 中級:3, 進階:4, 精英:5, 菁英:5 })[level] || 0;

function annualRecordValue(record, bowType) {
  const stored = annualLevelValue(record?.level);
  if (stored) return stored;
  return annualLevelValue(getCertLevel(bowType, Number(record?.score) || 0));
}

function certCompetitionYear(comp) {
  const explicit = Number(comp?.year || comp?.certYear);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const date = comp?.date ? new Date(comp.date) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getFullYear() : null;
}

function certCompetitionHalf(comp) {
  if (comp?.half != null) return normalizeAnnualHalf(comp.half);
  const date = comp?.date ? new Date(comp.date) : null;
  return date && !Number.isNaN(date.getTime()) && date.getMonth() >= 6 ? "second" : "first";
}

function buildCertCard({ year, half, bow, competition = null }) {
  const compId = competition?.id || null;
  const stableId = compId ? `annual_cert_${compId}_${bow.id}` : `annual_cert_${year}_${half}_${bow.id}`;
  return {
    id: stableId,
    cat: "level",
    icon: bow.icon,
    name: competition?.title ? `${competition.title}・${bow.label}` : `${year} ${half === "first" ? "上半年" : "下半年"}・${bow.label}`,
    desc: `${year} ${half === "first" ? "上半年" : "下半年"}${bow.label}年度檢定`,
    annualCert: true,
    competitionId: compId,
    year,
    half,
    bowType: bow.id,
    getValue: c => (c.certRecords || []).reduce((best, record) => {
      if (compId && record?.compId && record.compId !== compId) return best;
      if (Number(record?.year) !== year) return best;
      if (normalizeAnnualHalf(record?.half) !== half) return best;
      if (normalizeAnnualBowType(record?.bowType) !== bow.id) return best;
      return Math.max(best, annualRecordValue(record, bow.id));
    }, 0),
    tiers: ANNUAL_CERT_TIERS.map(([count, rarity, level]) => ({
      count,
      rarity,
      icon: bow.icon,
      name: level,
      desc: `${year} ${half === "first" ? "上半年" : "下半年"}${bow.label}達到${level}`,
    })),
  };
}

export function buildAnnualCertificationAchievements(certRecords = [], currentYear = new Date().getFullYear(), dexCompetitions = []) {
  const catalog = (dexCompetitions || []).filter(comp => comp?.dexKind === "cert" || comp?.type === "年度檢定");
  if (catalog.length) {
    return catalog.flatMap(comp => {
      const year = certCompetitionYear(comp);
      if (!year) return [];
      const half = certCompetitionHalf(comp);
      return ANNUAL_CERT_BOWS.map(bow => buildCertCard({ year, half, bow, competition: comp }));
    });
  }
  const years = new Set([Number(currentYear)]);
  (certRecords || []).forEach(record => {
    const year = Number(record?.year);
    if (Number.isFinite(year) && year > 0) years.add(year);
  });
  return [...years].sort((a, b) => b - a).flatMap(year =>
    ["first", "second"].flatMap(half => ANNUAL_CERT_BOWS.map(bow => buildCertCard({ year, half, bow })))
  );
}

const DYNAMIC_EXTERNAL_RESULT_TIERS = Object.freeze([
  { count:1, rarity:"common", icon:"🎖️", name:"參加紀念章", desc:"完成一次正式對外比賽" },
  ...[8,7,6,5,4,3,2,1].map(rank => ({
    count:10-rank,
    rarity:rank === 1 ? "legendary" : rank === 2 ? "epic" : rank === 3 ? "rare" : "uncommon",
    icon:rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅",
    name:`第 ${rank} 名`,
    desc:`正式對外比賽取得第 ${rank} 名或更佳成績`,
  })),
]);

export function buildExternalCompetitionAchievements(dexCompetitions = []) {
  return (dexCompetitions || [])
    .filter(comp => comp?.dexCatalog === true && comp?.dexKind === "external" && comp?.id)
    .map(comp => ({
      id:`external_comp_${comp.id}`,
      cat:"external",
      icon:"🏅",
      name:comp.title || "對外比賽",
      desc:`${EXTERNAL_COMP_FORMAT_MAP[comp.externalFormat]?.label || "外賽"}・參賽與名次紀錄`,
      dynamicExternal:true,
      competitionId:comp.id,
      getValue:c => {
        const result = c.member?.competitionDex?.[comp.id];
        if (!result?.participated) return 0;
        const rank = Number(result.rank);
        return Number.isFinite(rank) && rank >= 1 && rank <= 8 ? 10-rank : 1;
      },
      tiers:DYNAMIC_EXTERNAL_RESULT_TIERS,
    }));
}

// ── 階段式成就（TIERED） — 里程碑系統 ─────────────────────────
// 每個階段式成就只佔 1 格，隨數值成長自動替換圖示、稀有度、名稱
// 點擊後顯示進度條 + 里程碑列表

export const TIERED_ACHIEVEMENTS = [
  // ══ 啟程 — 累積報到 ══
  {
    id: "checkin", cat: "start", icon: "📍", name: "累積報到",
    desc: "完成今日任務報到，累積次數",
    directDisplay: true,
    replacesIds: ["checkin_1","checkin_5","checkin_10","checkin_15","checkin_20","checkin_25","checkin_30"],
    getValue: c => c.checkinCount || 0,
    tiers: [
      { count: 1,  rarity: "common",   icon: "📍", name: "初次報到",   desc: "完成第一次今日任務報到" },
      { count: 5,  rarity: "common",   icon: "🌤️", name: "漸入佳境",   desc: "累積報到 5 次" },
      { count: 10, rarity: "uncommon", icon: "🔥", name: "持之以恆",   desc: "累積報到 10 次" },
      { count: 15, rarity: "uncommon", icon: "⚡", name: "勢如破竹",   desc: "累積報到 15 次" },
      { count: 20, rarity: "rare",     icon: "💎", name: "鍛鍊有成",   desc: "累積報到 20 次" },
      { count: 25, rarity: "rare",     icon: "🌟", name: "百練成鋼",   desc: "累積報到 25 次" },
      { count: 30, rarity: "epic",     icon: "💪", name: "風雨無阻",   desc: "累積報到 30 次" },
    ],
  },

  // ══ 打怪 — 累積擊殺場數 ══
  {
    id: "monster_kills", cat: "monster", icon: "👹", name: "累積擊殺",
    desc: "累積擊敗怪物的總次數",
    replacesIds: ["monster_first","monster_5","monster_10","monster_30"],
    getValue: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "👹", name: "初入戰場",   desc: "第一次擊敗怪物" },
      { count: 5,  rarity: "uncommon", icon: "⚔️", name: "身經百戰",   desc: "累積擊敗怪物 5 次" },
      { count: 10, rarity: "rare",     icon: "🗡️", name: "殺伐決斷",   desc: "累積擊敗怪物 10 次" },
      { count: 30, rarity: "epic",     icon: "🔱", name: "百戰老將",   desc: "累積擊敗怪物 30 次" },
    ],
  },

  {
    id: "monster_catalog", cat: "monster", icon: "📖", name: "怪物全圖鑑",
    desc: `擊敗不同種類的正式怪物（全目錄 ${MONSTER_DEX_CATALOG.length} 種）`,
    getValue: c => countDefeatedCatalogMonsters(c.monsterDex),
    tiers: [
      { count: 1, rarity: "common", icon: "📖", name: "圖鑑第一頁", desc: "擊敗第 1 種怪物" },
      { count: 10, rarity: "common", icon: "📚", name: "初識百怪", desc: "擊敗 10 種不同怪物" },
      { count: 25, rarity: "uncommon", icon: "🗂️", name: "怪物觀察員", desc: "擊敗 25 種不同怪物" },
      { count: 50, rarity: "rare", icon: "🔎", name: "怪物研究員", desc: "擊敗 50 種不同怪物" },
      { count: 100, rarity: "epic", icon: "📜", name: "百怪獵人", desc: "擊敗 100 種不同怪物" },
      { count: 150, rarity: "epic", icon: "🧭", name: "異獸遠征家", desc: "擊敗 150 種不同怪物" },
      { count: 200, rarity: "legendary", icon: "🏆", name: "萬象征服者", desc: "擊敗 200 種不同怪物" },
      { count: MONSTER_DEX_CATALOG.length, rarity: "mythic", icon: "👑", name: "全圖鑑制霸", desc: `擊敗全部 ${MONSTER_DEX_CATALOG.length} 種正式怪物` },
    ],
  },

  // ══ 打怪 — 頭目擊殺 ══
  {
    id: "monster_boss", cat: "monster_boss", icon: "🌟", name: "頭目擊殺",
    desc: "擊敗頭目（boss）級怪物的次數",
    replacesIds: ["monster_mvp1","monster_mvp10"],
    getValue: c => monsterWinsByTier(c.monsterDex, "boss"),
    tiers: [
      { count: 1,  rarity: "rare",     icon: "🌟", name: "首殺頭目",   desc: "擊敗任意一隻頭目（boss）" },
      { count: 10, rarity: "legendary",icon: "💥", name: "頭目獵人",   desc: "累積擊敗頭目（boss）10 次以上" },
    ],
  },

  // ══ 煉製 — 藥水合成 ══
  {
    id: "brew", cat: "forge", icon: "🧪", name: "藥水合成",
    desc: "累積合成藥水的次數",
    replacesIds: ["brew_first","brew_5","brew_10"],
    getValue: c => (c.craftStats?.potionsCrafted || 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🧪", name: "初學煉金",   desc: "第一次合成藥水" },
      { count: 5,  rarity: "uncommon", icon: "⚗️", name: "藥水調製師", desc: "累積合成藥水 5 瓶" },
      { count: 10, rarity: "rare",     icon: "💊", name: "藥劑大師",   desc: "累積合成藥水 10 瓶" },
    ],
  },

  // ══ 煉製 — 藥水使用 ══
  {
    id: "potion_usage", cat: "forge", icon: "🧪", name: "藥水使用",
    desc: "累積在戰鬥中使用藥水的次數",
    replacesIds: ["potion_any_1","potion_any_10","potion_any_30","potion_any_50"],
    getValue: c => Object.values(c.potionDex?.used || {}).reduce((s, n) => s + n, 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🧪", name: "初識藥水",   desc: "第一次在戰鬥中使用藥水" },
      { count: 10, rarity: "uncommon", icon: "💊", name: "藥水依賴",   desc: "累積使用藥水 10 次" },
      { count: 30, rarity: "rare",     icon: "⚗️", name: "藥水大戶",   desc: "累積使用藥水 30 次" },
      { count: 50, rarity: "epic",     icon: "🔮", name: "藥水狂熱者", desc: "累積使用藥水 50 次" },
    ],
  },

  // ══ 怪物卡 — 卡片收集 ══
  {
    id: "card_collect", cat: "card", icon: "🃏", name: "怪物卡收集",
    desc: "收集不同種類的怪物卡",
    replacesIds: ["card_1","card_5","card_10","card_15","card_20"],
    getValue: c => (c.cardCount || 0),
    tiers: buildCardCollectTiers(MONSTER_CARD_PACK.length),
    retired: true,
    retiredReason: "怪物卡收藏已改為七族 × T1～T6 各自收集",
  },

  {
    id: "guild_reputation", cat: "guild", icon: "🏰", name: "公會聲望",
    desc: "完成公會遠征累積聲望，逐步晉升冒險者階級",
    getValue: c => Math.max(0, Math.floor(Number(c.guildRep) || 0)),
    tiers: [
      { count: 1, rarity: "common", icon: "🔰", name: "踏入公會", desc: "在新版冒險者公會獲得第一點聲望" },
      ...GUILD_RANKS.filter(rank => rank.rep > 0).map((rank, index) => ({
        count: rank.rep,
        rarity: ["uncommon", "rare", "epic", "legendary", "mythic"][index] || "mythic",
        icon: rank.icon,
        name: rank.name,
        desc: `公會聲望達 ${rank.rep.toLocaleString()}，晉升${rank.name}`,
      })),
    ],
  },

  {
    id: "guild_expeditions", cat: "guild", icon: "🧭", name: "公會遠征",
    desc: "累積完成冒險者公會遠征的次數（勝負皆計）",
    getValue: c => Math.max(0, Number(c.guildExpeditionStats?.total) || 0),
    tiers: [
      { count: 1, rarity: "common", icon: "🧭", name: "首次出征", desc: "完成第一次公會遠征" },
      { count: 10, rarity: "uncommon", icon: "🥾", name: "遠征常客", desc: "累積完成 10 次公會遠征" },
      { count: 30, rarity: "rare", icon: "🗺️", name: "踏遍險境", desc: "累積完成 30 次公會遠征" },
      { count: 100, rarity: "legendary", icon: "🌍", name: "百征冒險家", desc: "累積完成 100 次公會遠征" },
    ],
  },
  {
    id: "guild_wins", cat: "guild", icon: "⚔️", name: "遠征勝利",
    desc: "累積在冒險者公會遠征中獲勝的次數",
    getValue: c => Math.max(0, Number(c.guildExpeditionStats?.won) || 0),
    tiers: [
      { count: 1, rarity: "common", icon: "⚔️", name: "遠征初勝", desc: "第一次贏得公會遠征" },
      { count: 10, rarity: "uncommon", icon: "🏹", name: "十勝之士", desc: "累積贏得 10 次公會遠征" },
      { count: 30, rarity: "rare", icon: "🏆", name: "遠征菁英", desc: "累積贏得 30 次公會遠征" },
      { count: 100, rarity: "legendary", icon: "👑", name: "百勝傳說", desc: "累積贏得 100 次公會遠征" },
    ],
  },
  {
    id: "guild_hard_wins", cat: "guild", icon: "🔥", name: "高危遠征",
    desc: "累積贏得危險度 3 以上的公會遠征",
    getValue: c => Math.max(0, Number(c.guildExpeditionStats?.hardWon) || 0),
    tiers: [
      { count: 1, rarity: "rare", icon: "🔥", name: "迎難而上", desc: "首次贏得危險度 3 以上遠征" },
      { count: 5, rarity: "epic", icon: "⚡", name: "險境獵人", desc: "累積贏得 5 次危險度 3 以上遠征" },
      { count: 15, rarity: "legendary", icon: "🏆", name: "高危專家", desc: "累積贏得 15 次危險度 3 以上遠征" },
    ],
  },
  {
    id: "guild_deadly_wins", cat: "guild", icon: "💀", name: "致命遠征",
    desc: "累積贏得危險度 5 以上的公會遠征",
    getValue: c => Math.max(0, Number(c.guildExpeditionStats?.deadlyWon) || 0),
    tiers: [
      { count: 1, rarity: "epic", icon: "💀", name: "死地歸來", desc: "首次贏得危險度 5 以上遠征" },
      { count: 5, rarity: "legendary", icon: "☠️", name: "絕境行者", desc: "累積贏得 5 次危險度 5 以上遠征" },
      { count: 15, rarity: "mythic", icon: "🔥", name: "死境征服者", desc: "累積贏得 15 次危險度 5 以上遠征" },
    ],
  },
  {
    id: "guild_mythic_wins", cat: "guild", icon: "👑", name: "神話遠征",
    desc: "累積贏得最高危險度 6 的公會遠征",
    getValue: c => Math.max(0, Number(c.guildExpeditionStats?.mythicWon) || 0),
    tiers: [
      { count: 1, rarity: "legendary", icon: "👑", name: "神話首勝", desc: "首次贏得危險度 6 遠征" },
      { count: 3, rarity: "mythic", icon: "🌋", name: "三破神話", desc: "累積贏得 3 次危險度 6 遠征" },
      { count: 10, rarity: "mythic", icon: "🌠", name: "神話征服者", desc: "累積贏得 10 次危險度 6 遠征" },
    ],
  },

  // ══ 決鬥 — 累積勝場 ══
  {
    id: "duel_wins", cat: "duel", icon: "⚔️", name: "決鬥勝場",
    desc: "決鬥模式中累積獲勝的次數",
    replacesIds: ["duel_win1","duel_win5","duel_win10","duel_win25"],
    getValue: c => (c.duelStats?.wins || 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🏴", name: "初勝",       desc: "決鬥模式首次獲勝" },
      { count: 5,  rarity: "rare",     icon: "⚔️", name: "百戰老將",   desc: "決鬥模式累積勝利 5 次" },
      { count: 10, rarity: "epic",     icon: "🏆", name: "決鬥大師",   desc: "決鬥模式累積勝利 10 次" },
      { count: 25, rarity: "epic",     icon: "👑", name: "決鬥王者",   desc: "決鬥模式累積勝利 25 次" },
    ],
  },

  // ══ 地下城 — 收藏品拾獲 ══
  {
    id: "collectible_progress", cat: "dungeon", icon: "🎒", name: "收藏品拾獲",
    desc: "在地下城中拾獲不同收藏品的數量",
    replacesIds: ["collectible_first","collectible_10","collectible_60","collectible_150"],
    getValue: c => Object.keys(c.member?.dungeonCollectibles || {}).length,
    tiers: [
      { count: 1,   rarity: "common",   icon: "🎒", name: "初次拾獲",       desc: "第一次在地下城拾獲收藏品" },
      { count: 10,  rarity: "uncommon", icon: "🧳", name: "小有收穫",       desc: "累積拾獲 10 種不同收藏品" },
      { count: 60,  rarity: "rare",     icon: "📦", name: "探險家的行囊",   desc: "累積拾獲 60 種不同收藏品" },
      { count: 150, rarity: "epic",     icon: "🏺", name: "秘寶收藏家",     desc: "累積拾獲 150 種不同收藏品" },
    ],
  },
  {
    id: "dungeon_clears", cat: "dungeon", icon: "🏚️", name: "地下城通關",
    desc: "單人或組隊地下城的終身累積通關次數",
    getValue: c => dungeonClearTotal(c.member),
    tiers: [
      { count: 1, rarity: "common", icon: "🚪", name: "首次踏破", desc: "完成第一次地下城通關" },
      { count: 5, rarity: "uncommon", icon: "🗺️", name: "地城熟客", desc: "累積通關地下城 5 次" },
      { count: 20, rarity: "rare", icon: "⚔️", name: "地下獵人", desc: "累積通關地下城 20 次" },
      { count: 50, rarity: "epic", icon: "🏆", name: "深淵行者", desc: "累積通關地下城 50 次" },
      { count: 100, rarity: "legendary", icon: "👑", name: "百城踏破", desc: "累積通關地下城 100 次" },
    ],
  },
];

// ── 動態加入階段式成就（Phase 2：把巨量動態系列也合併成 1 格）──────────
// 全部沿用上方 AUTO 生成用的常數（KILL_MILESTONES / CHEST_ACH_TYPES /
// POTION_RARITY_MILESTONES / FAM_ICONS…），tiers 值刻意跟舊 AUTO 對齊，
// 這樣 computeDexStats 換成用 tiered 里程碑計數後總數幾乎不變。
// replacesIds 一定要列全對應的舊 AUTO id，cellsFor 才會把舊格濾掉。

// 單一怪物擊殺次數（36 隻各 1 格，取代 kill_{id}_{5,10,25,50,100}）
for (const monster of MONSTERS) {
  TIERED_ACHIEVEMENTS.push({
    id: `kill_${monster.id}`, cat: "monster", icon: monster.icon,
    name: `${monster.name}剋星`,
    desc: `累積擊敗「${monster.name}」的次數`,
    retired: true,
    retiredReason: "舊 36 怪單怪討伐已由現行 252 怪目錄的普通怪族×T階／小王大王指定討伐取代",
    replacesIds: KILL_MILESTONES.map(n => `kill_${monster.id}_${n}`),
    getValue: c => (c.monsterDex?.[monster.id]?.wins || 0),
    tiers: KILL_MILESTONES.map(n => ({
      count: n, rarity: KILL_RARITIES[n], icon: KILL_ICONS[n],
      name: `${monster.name}剋星 ×${n}`,
      desc: `擊敗「${monster.name}」${n} 次`,
    })),
  });
}

// 現行指定怪物討伐：普通怪收斂成 7族 × T1~T6；小王與大王保留每隻獨立辨識度。
// 每張卡把「首次擊倒」併為第一階，避免首次擊倒與累積擊倒重複佔格。
for (const fam of MONSTER_DEX_FAMILIES) {
  for (let tierIndex = 1; tierIndex <= 6; tierIndex++) {
    const monsters = MONSTER_DEX_CATALOG.filter(monster =>
      monster.family === fam
      && monster.tierIndex === tierIndex
      && monster.encounter === "normal"
    );
    if (!monsters.length) continue;
    const monsterIds = monsters.map(monster => monster.id);
    const monsterNames = monsters.map(monster => `「${monster.name}」`).join("、");
    const label = `${FAM_LABELS[fam]} T${tierIndex} 普通怪`;
    TIERED_ACHIEVEMENTS.push({
      id: `monster_normal_${fam}_t${tierIndex}`,
      cat: "monster",
      icon: FAM_ICONS[fam],
      name: `${label}討伐`,
      desc: `合計擊敗 ${monsterNames} 的次數`,
      monsterAchievementKind: "normalGroup",
      family: fam,
      tierIndex,
      monsterIds,
      getValue: c => sumCatalogMonsterWins(c.monsterDex, monsterIds),
      tiers: buildMonsterTargetTiers(label, FAM_ICONS[fam]),
    });
  }
}

for (const monster of MONSTER_DEX_CATALOG.filter(item => item.encounter === "miniBoss")) {
  const label = `小王「${monster.name}」`;
  TIERED_ACHIEVEMENTS.push({
    id: `monster_miniboss_${monster.id}`,
    cat: "monster_miniboss",
    icon: "🔱",
    name: `小王・${monster.name}`,
    desc: `累積擊敗${label}的次數`,
    monsterAchievementKind: "miniBoss",
    family: monster.family,
    tierIndex: monster.tierIndex,
    monsterId: monster.id,
    getValue: c => sumCatalogMonsterWins(c.monsterDex, [monster.id]),
    tiers: buildMonsterTargetTiers(label, "🔱"),
  });
}

for (const monster of MONSTER_DEX_CATALOG.filter(item => item.encounter === "boss")) {
  const label = `大王「${monster.name}」`;
  TIERED_ACHIEVEMENTS.push({
    id: `monster_boss_${monster.id}`,
    cat: "monster_boss",
    icon: "👑",
    name: `大王・${monster.name}`,
    desc: `累積擊敗${label}的次數`,
    monsterAchievementKind: "boss",
    family: monster.family,
    tierIndex: monster.tierIndex,
    monsterId: monster.id,
    getValue: c => sumCatalogMonsterWins(c.monsterDex, [monster.id]),
    tiers: buildMonsterTargetTiers(label, "👑"),
  });
}

// 開箱次數（7 種箱各 1 格，取代 chest_{type}_open_{1,5,10,20}）
for (const ct of CHEST_DEX_TYPES) {
  const legacyCompatible = ["wood","iron","gold","epic","mythic","potion"].includes(ct.id);
  const milestones = ct.milestones || CHEST_10000_MILESTONES;
  const max = milestones[milestones.length - 1];
  TIERED_ACHIEVEMENTS.push({
    id: `chest_${ct.id}`, cat: "chest", icon: ct.icon,
    name: `${ct.name}開箱`,
    desc: `累積開啟${ct.name}的次數`,
    replacesIds: legacyCompatible ? LEGACY_CHEST_OPEN_MILESTONES.map(n => `chest_${ct.id}_open_${n}`) : [],
    getValue: c => (c.chestStats?.[ct.statKey || ct.id] || 0),
    tiers: milestones.map(n => ({
      count: n, rarity: chestMilestoneRarity(n, max), icon: ct.icon,
      name: n === 1 ? `初見${ct.name}` : `${ct.name} ×${n}`,
      desc: n === 1 ? `第一次開啟${ct.name}` : `累積開啟${ct.name} ${n} 次`,
    })),
  });
}

TIERED_ACHIEVEMENTS.push({
  id:"chest_cat", cat:"chest", icon:"🐱",
  name:"舊版貓貓箱", desc:"舊版寶箱紀錄（已退役）",
  replacesIds: LEGACY_CHEST_OPEN_MILESTONES.map(n => `chest_cat_open_${n}`),
  getValue: c => Number(c.chestStats?.cat || 0),
  tiers: LEGACY_CHEST_OPEN_MILESTONES.map(n => ({ count:n, rarity:CHEST_OPEN_RARITIES[n], icon:"🐱", name:`舊版貓貓箱 ×${n}`, desc:`舊版開箱紀錄 ${n} 次` })),
  retired:true,
});

// 2026-08-12 前的舊圖鑑 ID：現行 family_mat 已拆成七族、wb_relic 改列特殊道具。
// ID 留著給 seen/notified 與歷史資料相容，但不再顯示／觸發。
for (const legacy of [
  { id:"chest_family_mat", statKey:"family_mat", icon:"📦", name:"舊版族系素材箱" },
  { id:"chest_wb_relic", statKey:"wb_relic", icon:"🗝️", name:"世界秘寶箱" },
]) {
  TIERED_ACHIEVEMENTS.push({
    id:legacy.id, cat:"chest", icon:legacy.icon,
    name:legacy.name, desc:"舊版寶箱圖鑑紀錄（已退役）",
    getValue:c => Number(c.chestStats?.[legacy.statKey] || 0),
    tiers:CHEST_10000_MILESTONES.map(n => ({
      count:n, rarity:chestMilestoneRarity(n, 10000), icon:legacy.icon,
      name:`${legacy.name} ×${n}`, desc:`歷史累積開啟 ${n} 次`,
    })),
    retired:true,
    retiredReason: legacy.id === "chest_family_mat"
      ? "族系素材箱已拆為七族各自統計"
      : "世界秘寶箱屬特殊道具，不列入現行寶箱圖鑑",
  });
}

const CHEST_DEX_TYPE_IDS = new Set(CHEST_DEX_TYPES.map(type => type.statKey || type.id));
const CHEST_CATALOG_MILESTONES = [1, 3, 5, 8, 10, CHEST_DEX_TYPES.length];
const CHEST_CATALOG_RARITIES = ["common","uncommon","rare","epic","legendary","mythic"];
TIERED_ACHIEVEMENTS.push({
  id:"chest_catalog", cat:"chest", icon:"🗃️",
  name:"寶箱收藏圖鑑", desc:"開啟不同種類的現行寶箱，永久記錄曾發現的箱型",
  getValue: c => Object.entries(c.chestStats || {}).filter(([id, count]) => CHEST_DEX_TYPE_IDS.has(id) && Number(count) > 0).length,
  tiers: CHEST_CATALOG_MILESTONES.map((count, index) => ({
    count, rarity:CHEST_CATALOG_RARITIES[index], icon:"🗃️",
    name: count === CHEST_DEX_TYPES.length ? `全收集 ${count} 種` : `發現 ${count} 種寶箱`,
    desc: count === CHEST_DEX_TYPES.length ? "開啟過所有現行寶箱種類" : `累積開啟過 ${count} 種不同寶箱`,
  })),
});

// 每種藥水使用次數（每藥水 1 格，取代 potion_{id}_{count}）
const WORLD_BOSS_PARTICIPATION_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const WORLD_BOSS_KILL_MILESTONES = [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000];
const longTermRarity = count => count >= 100 ? "mythic" : count >= 50 ? "legendary" : count >= 25 ? "epic" : count >= 10 ? "rare" : count >= 5 ? "uncommon" : "common";

for (let danger = 1; danger <= 6; danger++) {
  TIERED_ACHIEVEMENTS.push({
    id:`guild_danger_${danger}_wins`, cat:"guild", icon:"⚔️", name:`公會 T${danger} 遠征勝場`,
    desc:`累積贏得危險度 ${danger}（T${danger}）公會遠征`, guildDanger:danger,
    getValue:c => Math.max(0, Number(c.guildExpeditionStats?.byDanger?.[danger]) || 0),
    tiers:[1,5,10,25,50,100].map(count => ({ count, rarity:longTermRarity(count), icon:"⚔️", name:`T${danger} 勝場 ×${count}`, desc:`累積贏得 T${danger} 公會遠征 ${count} 次` })),
  });
}

TIERED_ACHIEVEMENTS.push(
  {
    id:"worldboss_participations", cat:"worldboss_participation", icon:"⚔️", name:"世界王參戰",
    desc:"累積參與世界王並完成參戰獎勵領取的次數",
    getValue:c => Number(c.member?.worldBossParticipations || 0),
    tiers:WORLD_BOSS_PARTICIPATION_MILESTONES.map(count => ({ count, rarity:longTermRarity(count), icon:"⚔️", name:`參戰 ${count} 次`, desc:`累積參戰世界王 ${count} 次` })),
  },
  {
    id:"worldboss_kills", cat:"worldboss_kill", icon:"💀", name:"世界王擊殺",
    desc:"累積參與並成功擊倒世界王的次數",
    getValue:c => Number(c.member?.worldBossKills || 0),
    tiers:WORLD_BOSS_KILL_MILESTONES.map(count => ({ count, rarity:longTermRarity(count), icon:"💀", name:`擊殺 ${count} 次`, desc:`累積擊倒世界王 ${count} 次` })),
  },
);

for (const group of WORLD_BOSS_CARD_DEX_FAMILIES) {
  const familyName = group.family;
  TIERED_ACHIEVEMENTS.push({
    id:`worldboss_cards_${group.family}`, cat:"card", icon:"🃏", name:`世界王卡・${familyName}`,
    desc:`收集 ${familyName} 族類的不同世界王卡`,
    worldBossCardFamily:group.family,
    worldBossCardKeys:group.cardKeys,
    getValue:c => group.cardKeys.filter(key => Boolean(c.cardData?.wbCards?.[key])).length,
    tiers:group.cardKeys.map((_, index) => ({ count:index + 1, rarity:longTermRarity(index + 1), icon:"🃏", name:`${familyName} ${index + 1}/${group.cardKeys.length}`, desc:`收集 ${index + 1} 張不同的 ${familyName} 世界王卡` })),
    retired:true,
    retiredReason:"世界王卡已改為教練系／貓王系／小王系／大王系",
  });
}

for (const group of WORLD_BOSS_CARD_DEX_GROUPS) {
  TIERED_ACHIEVEMENTS.push({
    id:`worldboss_card_group_${group.id}`, cat:"wbcard", icon:group.icon, name:`世界王卡・${group.label}`,
    desc:`收集不同的${group.label}世界王卡`,
    worldBossCardGroup:group.id,
    worldBossCardKeys:group.cardKeys,
    getValue:c => group.cardKeys.filter(key => Boolean(c.cardData?.wbCards?.[key])).length,
    tiers:group.cardKeys.map((_, index) => ({
      count:index + 1, rarity:longTermRarity(index + 1), icon:group.icon,
      name:`${group.label} ${index + 1}/${group.cardKeys.length}`,
      desc:`收集 ${index + 1} 張不同的${group.label}世界王卡`,
    })),
  });
}

const MONSTER_CARD_FAMILY_LABELS = {
  ghost:"鬼怪族", mountain:"山林族", insect:"毒蟲族", workplace:"職場族",
  exam:"考試族", temple:"西方怪物族", treasure:"寶箱族",
};
for (const group of MONSTER_CARD_DEX_GROUPS) {
  const label = MONSTER_CARD_FAMILY_LABELS[group.family] || group.family;
  TIERED_ACHIEVEMENTS.push({
    id:`monster_cards_${group.id}`, cat:"card", icon:"🃏", name:`${label} T${group.tierIndex}`,
    desc:`收集 ${label} T${group.tierIndex} 的一般怪物卡`,
    monsterCardFamily:group.family,
    monsterCardTier:group.tierIndex,
    monsterCardIds:group.cardIds,
    getValue:c => group.cardIds.filter(id => Boolean(c.cardData?.cards?.[id])).length,
    tiers:group.cardIds.map((id, index) => ({
      count:index + 1,
      rarity:index === group.cardIds.length - 1 ? "epic" : index === 1 ? "rare" : "uncommon",
      icon:"🃏",
      name:index === group.cardIds.length - 1 ? `${label} T${group.tierIndex} 全收集` : `${label} T${group.tierIndex} ${index + 1}/${group.cardIds.length}`,
      desc:`收集 ${index + 1}/${group.cardIds.length} 張 ${label} T${group.tierIndex} 怪物卡`,
    })),
  });
}

for (const building of VILLAGE_BUILDING_DEX) {
  TIERED_ACHIEVEMENTS.push({
    id:`village_building_${building.id}`, cat:"village", icon:building.icon, name:`${building.name}等級`,
    desc:`提升${building.name}的建築等級`,
    villageBuildingId:building.id,
    getValue:c => canonicalVillageBuildingLevel(c.member?.village?.buildings || {}, building.id),
    tiers:[1,5,10,15,20].map(count => ({ count, rarity:longTermRarity(count), icon:building.icon, name:`${building.name} Lv.${count}`, desc:`${building.name}達到 Lv.${count}` })),
  });
}

TIERED_ACHIEVEMENTS.push({
  id:"village_cat_cards", cat:"village", icon:"🎴", name:"貓貓卡片收藏",
  desc:`收集貓貓卡片（目前共 ${CAT_CARDS.length} 張）`,
  getValue:c => Object.keys(c.member?.catCards || {}).filter(id => Boolean(c.member?.catCards?.[id])).length,
  tiers:[1,10,25,50,100,150,CAT_CARDS.length]
    .filter((count, index, all) => count <= CAT_CARDS.length && all.indexOf(count) === index)
    .map(count => ({
      count, rarity:count === CAT_CARDS.length ? "legendary" : longTermRarity(count), icon:"🎴",
      name:count === CAT_CARDS.length ? `全收集 ${CAT_CARDS.length} 張` : `收集 ${count} 張`,
      desc:count === CAT_CARDS.length ? `收集全部 ${CAT_CARDS.length} 張貓貓卡片` : `累積收集 ${count} 張不同貓貓卡片`,
    })),
});

for (const mapId of JOURNEY_MAP_IDS) {
  const meta = JOURNEY_MAP_META[mapId] || {};
  const label = meta.name || mapId;
  const icon = meta.icon || "🗺️";
  TIERED_ACHIEVEMENTS.push({
    id:`village_journey_${mapId}`, cat:"village", icon, name:`探索地圖・${label}`,
    desc:`完成${label}的旅程次數`, villageJourneyMapId:mapId,
    getValue:c => Math.max(0, Number(c.member?.villageBoard?.maps?.[mapId]?.clears) || 0),
    tiers:[1,5,10,25,50,100].map(count => ({ count, rarity:longTermRarity(count), icon, name:`${label} ×${count}`, desc:`累積完成${label} ${count} 次` })),
  });
}

const shopCustomerMilestones = [...new Set([1,3,6,12,18,SHOP_CUSTOMERS.length].filter(count => count <= SHOP_CUSTOMERS.length))].sort((a,b) => a-b);
TIERED_ACHIEVEMENTS.push(
  {
    id:"shop_level", cat:"shop", icon:"🏪", name:"商店等級", desc:"依累積營業額提升商店等級",
    getValue:c => getShopLevel(shopStatsFromContext(c).totalRevenue),
    tiers:[1,5,10,15,20,25,MAX_SHOP_LEVEL].map(count => ({ count, rarity:longTermRarity(count), icon:"🏪", name:`商店 Lv.${count}`, desc:`商店達到 Lv.${count}` })),
  },
  {
    id:"shop_sales", cat:"shop", icon:"🧾", name:"累積成交", desc:"累積商店完成的銷售筆數",
    getValue:c => Number(shopStatsFromContext(c).totalSales || 0),
    tiers:[1,10,50,100,250,500,1000,2500,5000].map(count => ({ count, rarity:longTermRarity(count), icon:"🧾", name:`成交 ${count} 筆`, desc:`商店累積成交 ${count} 筆` })),
  },
  {
    id:"shop_customers_served", cat:"shop", icon:"🐾", name:"服務顧客", desc:"累積服務顧客人次",
    getValue:c => Number(shopStatsFromContext(c).customersServed || 0),
    tiers:[1,10,50,100,250,500,1000].map(count => ({ count, rarity:longTermRarity(count), icon:"🐾", name:`服務 ${count} 人次`, desc:`累積服務顧客 ${count} 人次` })),
  },
  {
    id:"shop_customer_catalog", cat:"shop", icon:"📖", name:"顧客圖鑑", desc:"發現不同的商店顧客",
    getValue:discoveredShopCustomerCount,
    tiers:shopCustomerMilestones.map(count => ({ count, rarity:longTermRarity(count), icon:"📖", name:`發現 ${count} 位顧客`, desc:`累積發現 ${count} 位不同顧客` })),
  },
);

for (const potion of POTIONS.filter(item => !item.futureFeature)) {
  const milestones = POTION_RARITY_MILESTONES[potion.rarity] || POTION_RARITY_MILESTONES.common;
  TIERED_ACHIEVEMENTS.push({
    id: `potion_${potion.id}`, cat: "forge", icon: potion.icon,
    name: `${potion.name}使用`,
    desc: `累積使用「${potion.name}」的次數`,
    replacesIds: milestones.map(([count]) => `potion_${potion.id}_${count}`),
    getValue: c => (c.potionDex?.used?.[potion.id] || 0),
    tiers: milestones.map(([count, rarity, suffix]) => ({
      count, rarity, icon: potion.icon,
      name: `${potion.name} · ${suffix}`,
      desc: `使用「${potion.name}」${count} 次`,
    })),
  });
}

// 各族完整圖鑑：7 族 × 36 種，不再只計六個階級代表怪。
for (const fam of MONSTER_DEX_FAMILIES) {
  TIERED_ACHIEVEMENTS.push({
    id: `monster_family_${fam}`, cat: "monster", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}圖鑑`,
    desc: `擊敗${FAM_LABELS[fam]}不同怪物（共 36 種）`,
    getValue: c => countDefeatedCatalogMonsters(c.monsterDex, fam),
    tiers: [
      { count: 1, rarity: "common", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}初遇`, desc: `擊敗第 1 種${FAM_LABELS[fam]}怪物` },
      { count: 6, rarity: "uncommon", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}踏查`, desc: `擊敗 6 種${FAM_LABELS[fam]}怪物` },
      { count: 12, rarity: "rare", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}獵手`, desc: `擊敗 12 種${FAM_LABELS[fam]}怪物` },
      { count: 18, rarity: "rare", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}半制霸`, desc: `擊敗 18 種${FAM_LABELS[fam]}怪物` },
      { count: 24, rarity: "epic", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}專家`, desc: `擊敗 24 種${FAM_LABELS[fam]}怪物` },
      { count: 30, rarity: "legendary", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}征服者`, desc: `擊敗 30 種${FAM_LABELS[fam]}怪物` },
      { count: 36, rarity: "mythic", icon: FAM_ICONS[fam], name: `${FAM_LABELS[fam]}全圖鑑`, desc: `擊敗全部 36 種${FAM_LABELS[fam]}怪物` },
    ],
  });
}

// ── Phase 3：跨系統新分類的階段式成就（練習/貓咪/貓村/裝備/決鬥歷練）──────
// 全部讀 member 文件既有欄位或 ctx.cats（子集合，由前端注入），皆為單調累積值。

TIERED_ACHIEVEMENTS.push(
  // 🎯 練習 — 終身箭數（member.totalArrowsAllTime）
  {
    id: "arrows_total", cat: "practice", icon: "🎯", name: "累積練習箭數",
    desc: "終身在系統內累積射出的箭數",
    directDisplay: true,
    getValue: c => c.member?.totalArrowsAllTime || 0,
    tiers: [
      { count: 100,   rarity: "common",    icon: "🎯", name: "起手式",   desc: "累積射出 100 箭" },
      { count: 500,   rarity: "common",    icon: "🏹", name: "漸上手",   desc: "累積射出 500 箭" },
      { count: 1000,  rarity: "uncommon",  icon: "🔥", name: "千箭穿楊", desc: "累積射出 1,000 箭" },
      { count: 3000,  rarity: "rare",      icon: "💪", name: "勤練不輟", desc: "累積射出 3,000 箭" },
      { count: 6000,  rarity: "epic",      icon: "⚡", name: "箭術精湛", desc: "累積射出 6,000 箭" },
      { count: 10000, rarity: "legendary", icon: "🌟", name: "萬箭大師", desc: "累積射出 10,000 箭" },
      { count: 20000, rarity: "mythic",    icon: "👑", name: "箭道傳說", desc: "累積射出 20,000 箭" },
    ],
  },

  // 🐈 貓咪（ctx.cats：cats 子集合陣列）
  {
    id: "cat_collect", cat: "cat", icon: "🐈", name: "集貓數",
    desc: "收服的貓咪夥伴數量（共 9 隻）",
    getValue: c => (c.cats || []).length,
    tiers: [
      { count: 1, rarity: "common",   icon: "🐱", name: "初識貓緣", desc: "收服第一隻貓咪" },
      { count: 3, rarity: "uncommon", icon: "🐈", name: "貓群漸聚", desc: "收服 3 隻貓咪" },
      { count: 6, rarity: "rare",     icon: "😺", name: "貓丁興旺", desc: "收服 6 隻貓咪" },
      { count: 9, rarity: "epic",     icon: "👑", name: "九貓齊聚", desc: "收服全部 9 隻貓咪" },
    ],
  },
  {
    id: "cat_level", cat: "cat", icon: "⭐", name: "貓咪等級",
    desc: "任一貓咪達到的最高等級",
    retired: true,
    retiredReason: "九隻貓已改為各自獨立的等級／羈絆／裝備成就",
    getValue: c => (c.cats || []).reduce((m, x) => Math.max(m, levelFromXP(x.catXP || 0)), 0),
    tiers: [
      { count: 10,  rarity: "common",   icon: "⭐", name: "貓咪成長",   desc: "任一貓咪達到 Lv.10" },
      { count: 30,  rarity: "uncommon", icon: "🌟", name: "獨當一面",   desc: "任一貓咪達到 Lv.30" },
      { count: 60,  rarity: "rare",     icon: "💫", name: "身經百戰",   desc: "任一貓咪達到 Lv.60" },
      { count: 100, rarity: "epic",     icon: "🔥", name: "貓中豪傑",   desc: "任一貓咪達到 Lv.100" },
      { count: 150, rarity: "legendary",icon: "⚡", name: "傳說貓將",   desc: "任一貓咪達到 Lv.150" },
      { count: 200, rarity: "mythic",   icon: "👑", name: "神話貓王",   desc: "任一貓咪達到滿等 Lv.200" },
    ],
  },
  {
    id: "cat_bond", cat: "cat", icon: "💛", name: "貓咪羈絆",
    desc: "任一貓咪累積的最高羈絆值",
    retired: true,
    retiredReason: "九隻貓已改為各自獨立的等級／羈絆／裝備成就",
    getValue: c => (c.cats || []).reduce((m, x) => Math.max(m, x.bond || 0), 0),
    tiers: [
      { count: 50,   rarity: "common",   icon: "💛", name: "漸生情誼", desc: "任一貓咪羈絆達 50" },
      { count: 200,  rarity: "uncommon", icon: "💗", name: "形影不離", desc: "任一貓咪羈絆達 200" },
      { count: 500,  rarity: "rare",     icon: "💖", name: "心有靈犀", desc: "任一貓咪羈絆達 500" },
      { count: 1000, rarity: "epic",     icon: "💞", name: "生死之交", desc: "任一貓咪羈絆達 1,000" },
    ],
  },
  {
    id: "cat_story", cat: "cat", icon: "📖", name: "貓咪故事",
    desc: "累積解鎖的貓咪故事章節數",
    getValue: c => (c.cats || []).reduce((s, x) => s + (Array.isArray(x.unlockedChapters) ? x.unlockedChapters.length : 0), 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "📖", name: "翻開扉頁", desc: "解鎖第一段貓咪故事" },
      { count: 5,  rarity: "uncommon", icon: "📚", name: "娓娓道來", desc: "累積解鎖 5 段故事" },
      { count: 10, rarity: "rare",     icon: "📜", name: "貓生百態", desc: "累積解鎖 10 段故事" },
      { count: 20, rarity: "epic",     icon: "🏆", name: "故事收藏家", desc: "累積解鎖 20 段故事" },
    ],
  },

  // 🏘️ 貓貓村（member.village.buildings）
  {
    id: "village_level", cat: "village", icon: "🏘️", name: "村莊發展",
    desc: "貓貓村的整體發展程度（各棟等級總和）",
    getValue: c => villageDevelopmentTotal(c.member?.village?.buildings || {}),
    tiers: [
      { count: 12,  rarity: "common",   icon: "🏕️", name: "拓荒立村", desc: "村莊發展度達 12" },
      { count: 30,  rarity: "uncommon", icon: "🏘️", name: "漸有規模", desc: "村莊發展度達 30" },
      { count: 60,  rarity: "rare",     icon: "🏙️", name: "繁榮興盛", desc: "村莊發展度達 60" },
      { count: 100, rarity: "epic",     icon: "🌆", name: "貓城崛起", desc: "村莊發展度達 100" },
      { count: 150, rarity: "legendary",icon: "👑", name: "貓國之光", desc: "村莊發展度達 150" },
    ],
  },
  {
    id: "building_max", cat: "village", icon: "🏗️", name: "建築等級",
    desc: "任一棟建築達到的最高等級（上限 20）",
    retired: true,
    retiredReason: "已由九大建築各自獨立等級圖鑑取代",
    getValue: c => {
      const b = c.member?.village?.buildings || {};
      return Object.values(b).reduce((m, lv) => Math.max(m, Number(lv) || 0), 0);
    },
    tiers: [
      { count: 5,  rarity: "common",   icon: "🔨", name: "小有基礎", desc: "任一棟建築達 Lv.5" },
      { count: 10, rarity: "uncommon", icon: "🏗️", name: "穩紮穩打", desc: "任一棟建築達 Lv.10" },
      { count: 15, rarity: "rare",     icon: "🏛️", name: "精益求精", desc: "任一棟建築達 Lv.15" },
      { count: 20, rarity: "epic",     icon: "👑", name: "登峰造極", desc: "任一棟建築達滿級 Lv.20" },
    ],
  },

  // 🛡️ 裝備（member.rpgEquip）
  {
    id: "equip_slots", cat: "equip", icon: "🛡️", name: "裝備蒐羅",
    desc: "已裝備的槽位數（共 6 槽）",
    getValue: c => Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId).length,
    tiers: [
      { count: 1, rarity: "common",   icon: "🗡️", name: "初出茅廬", desc: "裝上第一件裝備" },
      { count: 3, rarity: "uncommon", icon: "🛡️", name: "武裝待發", desc: "裝滿 3 個槽位" },
      { count: 6, rarity: "rare",     icon: "⚔️", name: "全副武裝", desc: "6 個槽位全數裝滿" },
    ],
  },
  {
    id: "equip_plus", cat: "equip", icon: "✨", name: "衝裝強化",
    desc: "任一件裝備達到的最高強化等級",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((m, e) => Math.max(m, Number(e?.plusLevel) || 0), 0),
    tiers: [
      { count: 1, rarity: "common",   icon: "✨", name: "初嘗強化", desc: "任一件裝備強化至 +1" },
      { count: 2, rarity: "uncommon", icon: "💫", name: "越磨越利", desc: "任一件裝備強化至 +2" },
      { count: 3, rarity: "rare",     icon: "🌟", name: "精工細琢", desc: "任一件裝備強化至 +3" },
      { count: 4, rarity: "epic",     icon: "🔥", name: "極限突破", desc: "任一件裝備強化至 +4" },
    ],
  },
  {
    id: "equip_grade", cat: "equip", icon: "💠", name: "品階突破",
    desc: "任一件裝備達到的最高品階",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((m, e) => {
      const idx = EQUIP_GRADE_ORDER.indexOf(e?.grade);
      return idx > m ? idx : m;
    }, -1) + 1, // +1 讓「無裝備」為 0、common 為 1…mythic 為 6
    tiers: [
      { count: 2, rarity: "uncommon", icon: "🔷", name: "稀有之證", desc: "任一件裝備達稀有品階" },
      { count: 3, rarity: "rare",     icon: "💠", name: "精英之器", desc: "任一件裝備達精英品階" },
      { count: 4, rarity: "epic",     icon: "🟣", name: "史詩之作", desc: "任一件裝備達史詩品階" },
      { count: 5, rarity: "legendary",icon: "🟠", name: "傳說鍛造", desc: "任一件裝備達傳說品階" },
      { count: 6, rarity: "mythic",   icon: "🔴", name: "神話神兵", desc: "任一件裝備達神話品階" },
    ],
  },
  {
    id: "equip_mythic", cat: "equip", icon: "🔴", name: "神話裝備",
    desc: "擁有神話品階裝備的件數",
    getValue: c => Object.values(c.member?.rpgEquip || {}).filter(e => e?.grade === "mythic").length,
    tiers: [
      { count: 1, rarity: "epic",      icon: "🔴", name: "神兵初現", desc: "擁有 1 件神話裝備" },
      { count: 3, rarity: "legendary", icon: "🔥", name: "神兵在握", desc: "擁有 3 件神話裝備" },
      { count: 6, rarity: "mythic",    icon: "👑", name: "神裝加身", desc: "6 槽全為神話裝備" },
    ],
  },
  {
    id: "equip_socket", cat: "equip", icon: "🕳️", name: "裝備打洞",
    desc: "全身裝備打出的符文孔總數（每件至多 3 孔）",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((s, e) => s + (Array.isArray(e?.sockets) ? e.sockets.length : 0), 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🕳️", name: "初鑿一孔", desc: "打出第一個符文孔" },
      { count: 3,  rarity: "rare",     icon: "🔩", name: "孔道漸開", desc: "累積打出 3 個孔" },
      { count: 6,  rarity: "epic",     icon: "⚙️", name: "千瘡百孔", desc: "累積打出 6 個孔" },
      { count: 12, rarity: "legendary",icon: "🛠️", name: "孔孔到位", desc: "累積打出 12 個孔" },
      { count: 18, rarity: "mythic",   icon: "👑", name: "洞徹全裝", desc: "6 槽全打滿 18 個孔" },
    ],
  },
  {
    id: "equip_rune", cat: "equip", icon: "🔮", name: "符文鑲嵌",
    desc: "全身裝備已鑲嵌的符文總數",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((s, e) => s + (Array.isArray(e?.sockets) ? e.sockets.filter(Boolean).length : 0), 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🔮", name: "初嵌符文", desc: "鑲嵌第一顆符文" },
      { count: 3,  rarity: "rare",     icon: "💎", name: "符力初成", desc: "鑲嵌 3 顆符文" },
      { count: 6,  rarity: "epic",     icon: "✨", name: "符文加持", desc: "鑲嵌 6 顆符文" },
      { count: 12, rarity: "legendary",icon: "👑", name: "符文大師", desc: "鑲嵌 12 顆符文" },
    ],
  },

  // ⚔️ 決鬥參與 — 總參與場次
  {
    id: "mode_duel", cat: "practice", icon: "🎮", name: "決鬥參與",
    desc: "累積參與決鬥的總場次（勝負不拘）",
    getValue: c => (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🎮", name: "初登決鬥場", desc: "第一次參與決鬥" },
      { count: 5,  rarity: "uncommon", icon: "🤺", name: "決鬥常客",   desc: "累積參與決鬥 5 場" },
      { count: 10, rarity: "rare",     icon: "⚔️", name: "沙場老手",   desc: "累積參與決鬥 10 場" },
      { count: 25, rarity: "epic",     icon: "🏆", name: "百戰決鬥士", desc: "累積參與決鬥 25 場" },
    ],
  },
);

const PRACTICE_BATTLE_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const practiceBattleTiers = (icon, label) => PRACTICE_BATTLE_MILESTONES.map(count => ({
  count,
  rarity: longTermRarity(count),
  icon,
  name: `${label} ×${count}`,
  desc: `累積${label} ${count} 次`,
}));

TIERED_ACHIEVEMENTS.push(
  {
    id: "mode_monster", cat: "practice", icon: "👹", name: "打怪完成場次",
    desc: "以永久怪物圖鑑勝場統計完成的打怪場次",
    getValue: c => Object.values(c.monsterDex || {}).reduce((sum, item) => sum + (Number(item?.wins) || 0), 0),
    tiers: practiceBattleTiers("👹", "完成打怪"),
  },
  {
    id: "mode_dungeon", cat: "practice", icon: "🏚️", name: "地下城完成場次",
    desc: "累積完成地下城的次數",
    getValue: c => dungeonClearTotal(c.member),
    tiers: practiceBattleTiers("🏚️", "完成地下城"),
  },
  {
    id: "mode_worldboss", cat: "practice", icon: "🐲", name: "世界王參與",
    desc: "累積取得世界王參戰紀錄的次數",
    getValue: c => Number(c.member?.worldBossParticipations || 0),
    tiers: practiceBattleTiers("🐲", "參與世界王"),
  },
  {
    id: "mode_guild", cat: "practice", icon: "🏰", name: "公會遠征參與",
    desc: "累積完成冒險者公會遠征的次數（勝負皆計）",
    getValue: c => Number(c.guildExpeditionStats?.total || 0),
    tiers: practiceBattleTiers("🏰", "完成公會遠征"),
  },
);

const EXTERNAL_RESULT_TIERS = Object.freeze([
  { count:1, rarity:"common", icon:"🎟️", name:"參加紀念章", desc:"完成一次通過審核的對外比賽" },
  ...[8, 7, 6, 5, 4, 3, 2, 1].map(rank => ({
    count: 10 - rank,
    rarity: rank === 1 ? "legendary" : rank === 2 ? "epic" : rank === 3 ? "rare" : "uncommon",
    icon: rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅",
    name: `第${rank}名`,
    desc: `對外比賽取得第${rank}名或更佳成績`,
  })),
]);

for (const format of EXTERNAL_COMP_FORMATS) {
  TIERED_ACHIEVEMENTS.push({
    id: `external_${format.id}`,
    cat: "external",
    icon: "🏅",
    name: format.label,
    desc: `對外比賽・${format.label}最佳榮耀紀錄`,
    externalFormat: format.id,
    retired: true,
    retiredReason: "外賽圖鑑已改由後台每一場正式比賽自動建立並於結算名單後解鎖",
    getValue: c => externalBestScore(c.externalComps, format.id),
    tiers: EXTERNAL_RESULT_TIERS,
  });
}

// 🐈 九隻貓各自獨立養成：等級／羈絆等級／七件裝備平均強化。
// 裝備採整套平均，缺少的槽位視為普通 +0，避免只衝一件裝備就完成整套養成成就。
const CAT_LEVEL_ACHIEVEMENT_TIERS = [
  [10, "common", "⭐"], [50, "uncommon", "🌟"], [100, "rare", "💫"],
  [200, "epic", "🔥"], [300, "legendary", "⚡"], [500, "mythic", "👑"],
];
const CAT_BOND_ACHIEVEMENT_TIERS = [
  [5, "common", "💛"], [10, "uncommon", "💗"], [20, "rare", "💖"],
  [30, "epic", "💞"], [40, "legendary", "💝"], [50, "mythic", "🫶"],
];
const CAT_EQUIP_ACHIEVEMENT_TIERS = [
  [5, "common", "🔧"], [10, "uncommon", "🛠️"], [20, "rare", "⚙️"],
  [30, "epic", "✨"], [40, "legendary", "💎"], [50, "mythic", "👑"],
];

for (const [catId, cat] of Object.entries(CATS)) {
  const catName = cat?.name || catId;
  TIERED_ACHIEVEMENTS.push(
    {
      id: `cat_${catId}_level`, cat: "cat", icon: "⭐", name: `${catName}・等級`,
      desc: `${catName}的成長等級`,
      catAchievementKind: "level", catId,
      getValue: c => catAchievementLevel(c.cats, catId),
      tiers: CAT_LEVEL_ACHIEVEMENT_TIERS.map(([count, rarity, icon]) => ({
        count, rarity, icon,
        name: `${catName} Lv.${count}`,
        desc: `${catName}達到 Lv.${count}`,
      })),
    },
    {
      id: `cat_${catId}_bond`, cat: "cat", icon: "💛", name: `${catName}・羈絆`,
      desc: `${catName}的羈絆等級`,
      catAchievementKind: "bond", catId,
      getValue: c => catAchievementBondLevel(c.cats, catId),
      tiers: CAT_BOND_ACHIEVEMENT_TIERS.map(([count, rarity, icon]) => ({
        count, rarity, icon,
        name: `${catName} 羈絆 Lv.${count}`,
        desc: `${catName}羈絆等級達 Lv.${count}`,
      })),
    },
    {
      id: `cat_${catId}_equipment`, cat: "cat", icon: "⚙️", name: `${catName}・裝備`,
      desc: `${catName}七件裝備的平均強化等級`,
      catAchievementKind: "equipment", catId,
      getValue: c => catAchievementEquipmentLevel(c.cats, catId),
      tiers: CAT_EQUIP_ACHIEVEMENT_TIERS.map(([count, rarity, icon]) => ({
        count, rarity, icon,
        name: `${catName} 裝備 +${count}`,
        desc: `${catName}七件裝備平均強化達到 +${count}`,
      })),
    },
  );
}

// ── Phase 3：跨系統的一次性（單次）成就（終局/收集完成）──────────
AUTO_ACHIEVEMENTS.push(
  { id: "cat_all9", cat: "village", icon: "👑", name: "九貓齊聚", rarity: "legendary", hidden: true,
    riddle: "九條貓命，一個都不能少…", desc: "收服全部 9 隻貓咪",
    check: c => (c.cats || []).length >= 9 },
  { id: "village_allbuilt", cat: "village", icon: "🏰", name: "極盛之城", rarity: "mythic", hidden: true,
    riddle: "九棟建築，全數登頂…", desc: "9 棟建築全部升到滿級 Lv.20",
    check: c => {
      const b = c.member?.village?.buildings || {};
      return BUILDING_LIST.every(buildingId => canonicalVillageBuildingLevel(b, buildingId) >= 20);
    } },
  { id: "equip_full_mythic", cat: "equip", icon: "👑", name: "神裝完全體", rarity: "mythic", hidden: true,
    riddle: "六神裝，皆臻極境…", desc: "6 槽全部為神話裝備且皆強化至 +4",
    check: c => {
      const es = Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId);
      return es.length >= 6 && es.every(e => e.grade === "mythic" && (Number(e.plusLevel) || 0) >= 4);
    } },
  { id: "equip_full_socket", cat: "equip", icon: "🔮", name: "符文全通", rarity: "legendary", hidden: true,
    riddle: "十八孔，孔孔有靈…", desc: "6 槽全部打滿 3 孔並鑲滿符文",
    check: c => {
      const es = Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId);
      return es.length >= 6 && es.every(e => Array.isArray(e.sockets) && e.sockets.length >= 3 && e.sockets.every(Boolean));
    } },
);

// ── computeTierProgress：計算階段式成就的當前進度 ────────────
// @param {Object} tieredAch - TIERED_ACHIEVEMENTS 中的定義
// @param {Object} ctx - 上下文（含 member, monsterDex 等）
// @returns {Object|null} tierProgress
//   回傳值包含 currentValue, currentTier, nextTier, progress, tiers[] 等
export function computeTierProgress(tieredAch, ctx) {
  const value = tieredAch.getValue(ctx);
  const tiers = tieredAch.tiers;
  if (!tiers || tiers.length === 0) return null;

  // 從最高往低找，找到已達到的 tier
  let currentTierIdx = -1;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (value >= tiers[i].count) { currentTierIdx = i; break; }
  }

  const nextTierIdx = currentTierIdx + 1;
  const isComplete = nextTierIdx >= tiers.length;

  // 進度百分比：以「當前 tier 門檻 → 下一個門檻」為區間
  const prevThreshold = currentTierIdx >= 0 ? tiers[currentTierIdx].count : 0;
  const nextThreshold = isComplete
    ? tiers[tiers.length - 1].count
    : tiers[nextTierIdx].count;
  const range = nextThreshold - prevThreshold;
  const progress = range > 0
    ? Math.min(1, Math.max(0, (value - prevThreshold) / range))
    : 1;

  // 組裝里程碑列表（含 unlocked / isCurrent 狀態）
  const tierList = tiers.map((t, i) => ({
    ...t,
    unlocked: i <= currentTierIdx,
    isCurrent: i === nextTierIdx && !isComplete,
  }));

  return {
    currentValue: value,
    currentTierIndex: currentTierIdx,
    currentTier: currentTierIdx >= 0 ? tiers[currentTierIdx] : null,
    nextTier: isComplete ? null : tiers[nextTierIdx],
    isComplete,
    progress: {
      current: value,
      currentLabel: String(value),
      next: nextThreshold,
      nextLabel: String(nextThreshold),
      percent: Math.round(progress * 100),
      gap: isComplete ? 0 : nextThreshold - value,
      isComplete,
    },
    tiers: tierList,
    totalTiers: tiers.length,
    unlockedCount: currentTierIdx + 1,
  };
}

// 被階段式成就取代的舊 AUTO id（模組層級算一次）：這些改由 tiered 里程碑計數/顯示，
// 統計與「已解鎖 key」都要跳過，避免同一系列被算兩次。
export const REPLACED_BY_TIERED = new Set();
TIERED_ACHIEVEMENTS.filter(isActiveAchievement)
  .forEach(t => (t.replacesIds || []).forEach(id => REPLACED_BY_TIERED.add(id)));

// 舊版終身最高檢定與早期怪物卡總數 ID 留作 seen/notified 相容；新版改由期間檢定與七族分階收藏承接。
for (const achievement of AUTO_ACHIEVEMENTS) {
  if (achievement.cat === "level") {
    achievement.retired = true;
    achievement.retiredReason = "年度檢定已改為年份 × 上下半年 × 弓種折疊紀錄";
  }
  if (["card_1", "card_5", "card_10", "card_15", "card_20"].includes(achievement.id)) {
    achievement.retired = true;
    achievement.retiredReason = "怪物卡收藏已改為七族 × T1～T6 分組圖鑑";
  }
}

// ── getUnlockedKeys：回傳「目前已解鎖的成就 key」陣列 ────────────
// 供 App 層即時偵測 + 紅點/NEW 高亮共用。
//   單次成就 → key = id
//   階段式成就 → 每達到一個里程碑 → key = `${id}#${里程碑index}`（逐階可個別提醒）
// ctx 需含：member, cats, monsterDex, craftStats, chestStats, potionDex,
//          cardCount/mythicCards/cardFamilies, duelStats, certification, certRecords, checkinCount
export function getUnlockedKeys(ctx) {
  const keys = [];
  AUTO_ACHIEVEMENTS.forEach(a => {
    if (!isActiveAchievement(a)) return;
    if (REPLACED_BY_TIERED.has(a.id)) return;
    try { if (a.check(ctx)) keys.push(a.id); } catch { /* 資料未就緒時忽略 */ }
  });
  const dynamicTiered = [
    buildArcherLevelAchievement(),
    buildArcheryTenureAchievement(ctx.member?.joinDate),
    ...buildAnnualCertificationAchievements(ctx.certRecords, new Date().getFullYear(), ctx.dexCompetitions),
    ...buildExternalCompetitionAchievements(ctx.dexCompetitions),
  ];
  [...TIERED_ACHIEVEMENTS, ...dynamicTiered].forEach(t => {
    if (!isActiveAchievement(t)) return;
    const prog = computeTierProgress(t, ctx);
    if (!prog) return;
    for (let i = 0; i <= prog.currentTierIndex; i++) keys.push(`${t.id}#${i}`);
  });
  return keys;
}

// ── describeKey：把 getUnlockedKeys 的 key 還原成可顯示的成就資訊 ──────
export function describeKey(key) {
  if (typeof key === "string" && key.includes("#")) {
    const [id, idxStr] = key.split("#");
    let t = TIERED_ACHIEVEMENTS.find(x => x.id === id);
    if (!t && id.startsWith("annual_cert_")) {
      const match = id.match(/^annual_cert_(\d{4})_/);
      if (match) t = buildAnnualCertificationAchievements([], Number(match[1])).find(x => x.id === id);
    }
    const tier = t?.tiers?.[Number(idxStr)];
    if (t && tier) return { id: key, name: `${t.name}・${tier.name}`, desc: tier.desc, icon: tier.icon, rarity: tier.rarity };
    return null;
  }
  const a = AUTO_ACHIEVEMENTS.find(x => x.id === key) || SPECIAL_GRANTS.find(x => x.id === key);
  return a ? { id: a.id, name: a.name, desc: a.desc, icon: a.icon, rarity: a.rarity } : null;
}

// ── 統計 ───────────────────────────────────────────────────
export function computeDexStats({ member, certification, certRecords, checkinCount, granted, physicalMax, pointMax, monsterDex, craftStats, chestStats, potionDex, cardData, duelStats, cats, guildRep, guildExpeditionStats, externalComps, dexCompetitions }) {
  const cards       = cardData?.cards || {};
  const cardCount   = Object.keys(cards).length;
  const mythicCards = Object.values(cards).filter(c => c.tier === "mythic").length;
  const cardFamilies = [...new Set(Object.values(cards).map(c => c.family).filter(Boolean))];
  const ctx = { member, certification, certRecords, checkinCount, monsterDex: monsterDex || {}, craftStats: craftStats || {}, chestStats: chestStats || {}, potionDex: potionDex || {}, cardData: cardData || {}, cardCount, mythicCards, cardFamilies, duelStats: duelStats || {}, cats: cats || [], guildRep: Math.max(0, Number(guildRep) || 0), guildExpeditionStats: guildExpeditionStats || {}, externalComps: externalComps || [], dexCompetitions: dexCompetitions || [] };

  let autoUnlocked = 0, autoTotal = 0;
  AUTO_ACHIEVEMENTS.forEach(a => {
    if (!isActiveAchievement(a)) return;
    if (REPLACED_BY_TIERED.has(a.id)) return; // 已被 tiered 取代，跳過（下面用里程碑計）
    autoTotal++;
    if (a.check(ctx)) autoUnlocked++;
  });

  // 階段式成就：每個里程碑各算一格（totalTiers=總格、unlockedCount=已解鎖）
  let tieredUnlocked = 0, tieredTotal = 0;
  const dynamicTiered = [
    buildArcherLevelAchievement(),
    buildArcheryTenureAchievement(member?.joinDate),
    ...buildAnnualCertificationAchievements(certRecords, new Date().getFullYear(), dexCompetitions),
    ...buildExternalCompetitionAchievements(dexCompetitions),
  ];
  [...TIERED_ACHIEVEMENTS, ...dynamicTiered].forEach(t => {
    if (!isActiveAchievement(t)) return;
    const prog = computeTierProgress(t, ctx);
    if (!prog) return;
    tieredTotal    += prog.totalTiers;
    tieredUnlocked += prog.unlockedCount;
  });

  const grantedIds = new Set((granted || []).filter(g => g.type === "special").map(g => g.id || g.specialId));
  let specialUnlocked = 0;
  SPECIAL_GRANTS.forEach(a => { if (grantedIds.has(a.id)) specialUnlocked++; });

  const physicalUnlocked = (granted || []).filter(g => g.type === "physical").length;
  const pointUnlocked    = (granted || []).filter(g => g.type === "point").length;
  const cohortUnlocked   = 1; // 期數格永遠亮著

  const totalUnlocked = autoUnlocked + tieredUnlocked + specialUnlocked + physicalUnlocked + pointUnlocked + cohortUnlocked;
  const totalAll = autoTotal + tieredTotal + SPECIAL_GRANTS.length + (physicalMax || 0) + (pointMax || 0) + 1;

  let gold = 0, silver = 0, bronze = 0;
  (granted || []).forEach(g => {
    if (g.type === "physical" || g.type === "point") {
      if (g.rank === 1) gold++;
      else if (g.rank === 2) silver++;
      else if (g.rank === 3) bronze++;
    }
  });

  return { totalUnlocked, totalAll, gold, silver, bronze };
}
