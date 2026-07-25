// src/guild/domain/guildTitles.js
// ─────────────────────────────────────────────────────────────
// 稱號的判定與選用（純函數）。
// ⚠️ 稱號**零戰力加成**——跟階級同一個原則，公會強度不外溢。
// 統計來源全部是既有存檔欄位，不必為了稱號另外埋點：
//   expeditions（場次/勝場/各危險度）、junkSeen（雜貨圖鑑）、
//   equipped+stash 的最高 +N、salvagedCount（分解累計）、catEarned（CAT幣累計）。
// ─────────────────────────────────────────────────────────────
import { GUILD_TITLES, TITLE_BY_ID } from "../data/guildTitles";
import { GUILD_JUNK } from "../data/guildJunkCatalog";
import { normalizeGuildProfile } from "./guildRewards";

// 存檔 → 稱號判定用的統計數字
export function buildTitleStats(profile) {
  const p = normalizeGuildProfile(profile);
  const byDanger = p.expeditions.byDanger || {};
  const sumFrom = min => Object.entries(byDanger)
    .filter(([d]) => Number(d) >= min)
    .reduce((s, [, n]) => s + (Number(n) || 0), 0);

  const allItems = [...Object.values(p.equipped || {}), ...p.stash];
  return {
    total: p.expeditions.total,
    won: p.expeditions.won,
    hardWon: sumFrom(3),
    deadlyWon: sumFrom(5),
    mythicWon: Number(byDanger[6]) || 0,
    junkSeen: Object.keys(p.junkSeen || {}).length,
    junkTotal: GUILD_JUNK.length,
    maxPlus: allItems.reduce((m, i) => Math.max(m, Number(i?.plus) || 0), 0),
    salvaged: p.salvagedCount,
    catEarned: p.catEarned,
    rep: p.rep,
  };
}

// 全部稱號 + 進度（UI 直接畫）。need 可以是數字或 (stats)=>數字
export function evaluateTitles(profile) {
  const stats = buildTitleStats(profile);
  return GUILD_TITLES.map(t => {
    const need = typeof t.need === "function" ? t.need(stats) : t.need;
    const have = t.of(stats);
    return {
      ...t,
      need,
      have,
      unlocked: have >= need,
      progressPct: Math.max(0, Math.min(100, Math.round((have / Math.max(1, need)) * 100))),
    };
  });
}

export function unlockedTitles(profile) {
  return evaluateTitles(profile).filter(t => t.unlocked);
}

// 選用稱號：只能選已解鎖的；傳 null 取消配戴
export function setGuildTitle(profile, titleId) {
  const p = normalizeGuildProfile(profile);
  if (titleId === null) return { ...p, title: null };
  if (!TITLE_BY_ID[titleId]) return p;
  if (!evaluateTitles(p).find(t => t.id === titleId && t.unlocked)) return p;
  return { ...p, title: titleId };
}

// 目前配戴的稱號（存檔壞掉或條件已不符 → 回 null，不會顯示假稱號）
export function currentTitle(profile) {
  const p = normalizeGuildProfile(profile);
  if (!p.title) return null;
  const t = evaluateTitles(p).find(x => x.id === p.title);
  return t?.unlocked ? t : null;
}
