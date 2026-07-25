// src/guild/data/guildTitles.js
// ─────────────────────────────────────────────────────────────
// 公會稱號：長期目標感的來源。**只有名譽，零戰力加成**（跟階級同一個原則——
// 公會的強度永遠不外溢，進度感來自「做到了什麼」而不是偷偷變強）。
//
// 每個稱號 = { id, name, icon, desc, cat, need(stats) → 需要的量, of(stats) → 目前的量 }
// 這樣 UI 可以統一畫「進度 3/10」，不必為每個稱號寫顯示邏輯。
// stats 由 `domain/guildTitles.buildTitleStats(profile)` 算出來（純函數）。
// ─────────────────────────────────────────────────────────────

const T = (id, name, icon, cat, desc, of, need) => ({ id, name, icon, cat, desc, of, need });

export const GUILD_TITLES = Object.freeze([
  // ── 遠征次數 ──
  T("rookie",     "初出茅廬", "🔰", "遠征", "完成 1 趟遠征",        s => s.won, 1),
  T("veteran",    "老練獵人", "🏹", "遠征", "完成 25 趟遠征",       s => s.won, 25),
  T("relentless", "不知疲倦", "🔥", "遠征", "完成 100 趟遠征",      s => s.won, 100),
  T("legendary",  "公會傳奇", "👑", "遠征", "完成 300 趟遠征",      s => s.won, 300),

  // ── 高危險委託 ──
  T("brave",      "膽識過人", "💪", "危險", "完成 10 趟 ☠️×3 以上", s => s.hardWon, 10),
  T("deathwish",  "向死而行", "☠️", "危險", "完成 25 趟 ☠️×5 以上", s => s.deadlyWon, 25),
  T("mythslayer", "神話終結", "🗡️", "危險", "完成 10 趟 ☠️×6",     s => s.mythicWon, 10),

  // ── 收藏（雜貨圖鑑）──
  T("collector",  "雜貨收藏家", "🧺", "收藏", "雜貨圖鑑收集 20 種", s => s.junkSeen, 20),
  T("curator",    "博物館長",   "🏺", "收藏", "雜貨圖鑑收集 50 種", s => s.junkSeen, 50),
  T("completist", "無所不藏",   "💎", "收藏", "雜貨圖鑑全收集",     s => s.junkSeen, s => s.junkTotal),

  // ── 裝備 ──
  T("smith",      "初階工匠", "🔧", "裝備", "把一件裝備強化到 +3",  s => s.maxPlus, 3),
  T("master",     "強化大師", "⚒️", "裝備", "把一件裝備強化到 +7",  s => s.maxPlus, 7),
  T("perfection", "極致追求", "✨", "裝備", "把一件裝備強化到 +10", s => s.maxPlus, 10),
  T("hoarder",    "裝備狂人", "🎒", "裝備", "累計分解 50 件裝備",   s => s.salvaged, 50),

  // ── 財富 ──
  T("merchant",   "精打細算", "🐾", "財富", "累計賺取 1000 CAT幣", s => s.catEarned, 1000),
  T("tycoon",     "富甲一方", "💰", "財富", "累計賺取 10000 CAT幣", s => s.catEarned, 10000),
]);

export const TITLE_BY_ID = Object.freeze(Object.fromEntries(GUILD_TITLES.map(t => [t.id, t])));
export const TITLE_CATEGORIES = Object.freeze(["遠征", "危險", "收藏", "裝備", "財富"]);
