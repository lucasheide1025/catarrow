// src/lib/leaderboardData.js — 排行榜資料層（純函式：註冊表＋排名計算＋季賽抽取）
// UI 只負責畫；所有「哪些榜、怎麼算分、哪些可分季」都集中在這裡。
import { FAMILIES, MONSTERS } from "./monsterData";
import { calcBadgePoints, getCertLevel } from "./constants";
import { catLevelFromXP } from "./catLevel";
import { computeDexStats } from "./achievementDex";
import { COLLECTIBLE_MAP } from "./dungeonCollectibles";

// 怪物 id → 資料（族/階）
const MONSTER_MAP = {};
MONSTERS.forEach((m) => { MONSTER_MAP[m.id] = m; });
const BOSS_TIERS = new Set(["boss", "mythic"]);

export const LB_FAMILY_LIST = Object.entries(FAMILIES).map(([id, f]) => ({
  id, label: f.label, icon: f.icon, color: f.color,
}));

const DUNGEON_DEX_TOTAL = Object.keys(COLLECTIBLE_MAP).length;

// ── 分組與分頁 ──────────────────────────────────────────
export const LB_GROUPS = [
  { id: "compete", label: "競技", icon: "🎯" },
  { id: "battle",  label: "戰鬥", icon: "⚔️" },
  { id: "badge",   label: "徽章", icon: "🏅" },
  { id: "collect", label: "收藏", icon: "🏆" },
  { id: "village", label: "貓貓村", icon: "🐱" },
];

// kind:
//  simple  → 直接一個 board
//  family  → 內含族群 pill（board id = `${base}:${fam}` / `${base}:all`）
export const LB_TABS = [
  // 競技
  { id: "event",    group: "compete", label: "賽事積分", icon: "🎪", kind: "simple", unit: "分",  season: true },
  { id: "arrows",   group: "compete", label: "射箭總數", icon: "🏹", kind: "simple", unit: "箭",  season: true },
  { id: "checkin",  group: "compete", label: "報到達人", icon: "📋", kind: "simple", unit: "天",  season: true },
  { id: "cert_recurve", group: "compete", label: "反曲檢定", icon: "🎯", kind: "simple", unit: "分", season: false },
  { id: "cert_compound", group: "compete", label: "獵弓檢定", icon: "🦅", kind: "simple", unit: "分", season: false },
  { id: "cert_traditional", group: "compete", label: "傳統檢定", icon: "🌿", kind: "simple", unit: "分", season: false },
  // 戰鬥
  { id: "adventurer", group: "battle", label: "冒險者",   icon: "🛡️", kind: "simple", unit: "XP", season: false },
  { id: "duel",       group: "battle", label: "決鬥",     icon: "⚔️", kind: "simple", unit: "勝", season: true },
  { id: "kill",       group: "battle", label: "族群獵殺", icon: "🐾", kind: "family", base: "kill",   unit: "殺", season: true },
  { id: "boss",       group: "battle", label: "頭目+",   icon: "💀", kind: "simple", unit: "殺", season: true },
  { id: "dclear",     group: "battle", label: "突破地下城", icon: "🏰", kind: "family", base: "dclear", unit: "次", season: true },
  { id: "wbdmg",      group: "battle", label: "世界王傷害", icon: "🐲", kind: "simple", unit: "傷害", season: true },
  { id: "partydmg",   group: "battle", label: "組隊傷害",   icon: "🤝", kind: "simple", unit: "傷害", season: true },
  // 徽章
  { id: "fatcat",  group: "badge", label: "肥貓章", icon: "🐱", kind: "simple", unit: "分", season: true },
  { id: "score",   group: "badge", label: "積分章", icon: "⭐", kind: "simple", unit: "分", season: true },
  { id: "achieve", group: "badge", label: "成就章", icon: "🏆", kind: "simple", unit: "分", season: true },
  // 收藏
  { id: "dungeon_dex", group: "collect", label: "地下城圖鑑", icon: "🏺", kind: "simple", unit: "件", season: false },
  { id: "achieve_dex", group: "collect", label: "成就圖鑑",   icon: "📖", kind: "simple", unit: "個", season: false },
  { id: "cat_cards",   group: "collect", label: "貓貓卡片",   icon: "🃏", kind: "simple", unit: "張", season: false },
  // 貓貓村
  { id: "max_cat", group: "village", label: "最高等級貓貓", icon: "😻", kind: "simple", unit: "級", season: false },
  { id: "laps",    group: "village", label: "探索繞圈",     icon: "🗺️", kind: "simple", unit: "圈", season: true },
];

export const LB_TAB_MAP = Object.fromEntries(LB_TABS.map((t) => [t.id, t]));

// ── 檢定：取每人今年最高分（已審核）──────────────────────
const CERT_BOWS = {
  cert_recurve: ["recurve_bare", "recurve_full"],
  cert_compound: ["compound"],
  cert_traditional: ["traditional"],
};

function certBestMap(certRecords, bowTypes, year) {
  const keys = Array.isArray(bowTypes) ? bowTypes : [bowTypes];
  const map = {};
  (certRecords || [])
    .filter((r) => keys.includes(r.bowType) && Number(r.year) === year)
    .forEach((r) => {
      const s = r.score || 0;
      if (map[r.memberId] === undefined || s > map[r.memberId]) map[r.memberId] = s;
    });
  return map;
}

// ── 單一成員的原始數值（未套季賽差值）────────────────────
// data: { certMaps, duelMap, dexMap, cardMap, year }
function rawMetric(boardId, member, data) {
  const id = member.id;

  // family boards: `${base}:${fam}` 或 `${base}:all`
  if (boardId.startsWith("kill:")) {
    const fam = boardId.slice(5);
    const dex = data.dexMap[id] || {};
    let sum = 0;
    Object.entries(dex).forEach(([mId, stat]) => {
      const mon = MONSTER_MAP[mId];
      if (!mon) return;
      if (fam === "all" || mon.family === fam) sum += stat.wins || 0;
    });
    return sum;
  }
  if (boardId.startsWith("dclear:")) {
    const fam = boardId.slice(7);
    const dc = member.dungeonClears || {};
    if (fam === "all") return Object.values(dc).reduce((s, n) => s + (Number(n) || 0), 0);
    return Number(dc[fam]) || 0;
  }

  switch (boardId) {
    case "event":   return Number(member.eventPoints) || 0;
    case "arrows":  return Number(member.totalArrowsAllTime) || 0;
    case "checkin": return Number(member.dailyQuestCount) || 0;
    case "cert_recurve":     return data.certMaps.cert_recurve[id] || 0;
    case "cert_compound":    return data.certMaps.cert_compound[id] || 0;
    case "cert_traditional": return data.certMaps.cert_traditional[id] || 0;
    case "adventurer": return Number(member.adventurerXP) || 0;
    case "duel":       return (data.duelMap[id]?.wins) || 0;
    case "boss": {
      const dex = data.dexMap[id] || {};
      let sum = 0;
      Object.entries(dex).forEach(([mId, stat]) => {
        const mon = MONSTER_MAP[mId];
        if (mon && BOSS_TIERS.has(mon.tier)) sum += stat.wins || 0;
      });
      return sum;
    }
    case "wbdmg":    return Number(member.worldBossDmgTotal) || 0;
    case "partydmg": return Number(member.partyDmgTotal) || 0;
    case "fatcat":  return calcBadgePoints(member, "fatcat");
    case "score":   return calcBadgePoints(member, "score");
    case "achieve": return calcBadgePoints(member, "achieve");
    case "dungeon_dex":
      return Object.values(member.dungeonCollectibles || {}).filter((n) => Number(n) > 0).length;
    case "achieve_dex": {
      const stats = computeDexStats({
        member,
        certRecords: (data.certRecords || []).filter((r) => r.memberId === id),
        monsterDex: data.dexMap[id] || {},
        cardData: data.cardMap[id] || {},
        duelStats: data.duelMap[id] || {},
        checkinCount: Number(member.dailyQuestCount) || 0,
      });
      return stats.totalUnlocked || 0;
    }
    case "cat_cards":
      return Object.keys((data.cardMap[id] || {}).cards || {}).length;
    case "max_cat": {
      const xp = Math.max(Number(member.maxCatXP) || 0, Number(member.equippedCat?.catXP) || 0);
      return catLevelFromXP(xp);
    }
    case "laps": return Number(member.villageTotalLaps) || 0;
    default: return 0;
  }
}

// 展開所有「可分季」board id（含族群變體）
export function seasonableBoardIds() {
  const ids = [];
  LB_TABS.forEach((t) => {
    if (!t.season) return;
    if (t.kind === "family") {
      LB_FAMILY_LIST.forEach((f) => ids.push(`${t.base}:${f.id}`));
      ids.push(`${t.base}:all`);
    } else ids.push(t.id);
  });
  return ids;
}

// 建立季賽快照用的 metrics：{ [memberId]: { [boardId]: raw } }
export function computeSeasonMetrics(members, data) {
  const ids = seasonableBoardIds();
  const out = {};
  members.forEach((m) => {
    const row = {};
    ids.forEach((bid) => { row[bid] = rawMetric(bid, m, data); });
    out[m.id] = row;
  });
  return out;
}

// ── 排名主函式 ──────────────────────────────────────────
// 回傳 [{ id, name, nickname, value, member }]（已排序、已濾 0）
// opts: { useSeason, snapshot }
export function rankBoard(boardId, members, data, opts = {}) {
  const { useSeason, snapshot } = opts;
  const tab = LB_TAB_MAP[boardId.split(":")[0]];
  const seasonable = tab?.season && useSeason;

  const rows = members.map((m) => {
    const raw = rawMetric(boardId, m, data);
    let value = raw;
    if (seasonable) {
      const base = snapshot?.[m.id]?.[boardId] || 0;
      value = Math.max(0, raw - base);
    }
    return { id: m.id, name: m.name, nickname: m.nickname, value, member: m };
  });

  return rows
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export { DUNGEON_DEX_TOTAL };

// 檢定年度最佳（給 UI 顯示級別用）
export function buildCertMaps(certRecords, year) {
  return {
    cert_recurve: certBestMap(certRecords, CERT_BOWS.cert_recurve, year),
    cert_compound: certBestMap(certRecords, CERT_BOWS.cert_compound, year),
    cert_traditional: certBestMap(certRecords, CERT_BOWS.cert_traditional, year),
  };
}

export const CERT_BOW_OF = {
  cert_recurve: "recurve_bare",
  cert_compound: "compound",
  cert_traditional: "traditional",
};

export { getCertLevel };
