// src/worldboss/domain/tournament.js
// ─────────────────────────────────────────────────────────────
// 🏛️ 對外賽事的歷史排行榜（作者 2026-08-01）。
//
// 兩種來源，**同一個資料結構**：
//   ① 從比賽模式結算匯入（今天射的那一場）
//   ② 教練手動補登（資格賽、對抗賽——那些是在別的場地打的，
//      系統裡沒有資料，只能照紙本記分表輸入）
//
// ⚠️ **最終名次是教練填的，不是系統算的**。
//    對外賽事有申訴、有淘汰賽制、有並列，實際名次跟總分排序不一定一樣。
//    系統只提供「照分數排」當預設值，教練可以改；改過的不准被自動覆蓋。
// ─────────────────────────────────────────────────────────────

export const TOURNAMENT_TYPES = Object.freeze([
  { id: "qualifier", label: "資格賽", icon: "🎯", color: "#60a5fa" },
  { id: "match", label: "對抗賽", icon: "⚔️", color: "#f87171" },
  { id: "internal", label: "館內賽", icon: "🏹", color: "#4ade80" },
  { id: "other", label: "其他", icon: "🏛️", color: "#94a3b8" },
]);

export const TOURNAMENT_TYPE_MAP = Object.freeze(
  Object.fromEntries(TOURNAMENT_TYPES.map(t => [t.id, t])),
);

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = v => String(v ?? "").trim();

/** 日期字串 → YYYY-MM-DD（教練可能打成 2026/8/1） */
export function normalizeDate(input) {
  const s = str(input).replace(/[/.]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const p = n => String(n).padStart(2, "0");
  return `${m[1]}-${p(Number(m[2]))}-${p(Number(m[3]))}`;
}

/** 一列成績。⚠️ rank 為 0／空＝還沒填，不是第 0 名。 */
export function normalizeEntry(entry, index = 0) {
  return {
    key: entry?.key || `e${index}_${Math.random().toString(36).slice(2, 7)}`,
    memberId: entry?.memberId || null,
    name: str(entry?.name),
    score: Math.max(0, Math.round(num(entry?.score))),
    arrows: Math.max(0, Math.round(num(entry?.arrows))),
    xCount: Math.max(0, Math.round(num(entry?.xCount))),
    tens: Math.max(0, Math.round(num(entry?.tens))),
    rank: Math.max(0, Math.round(num(entry?.rank))),
    note: str(entry?.note),
  };
}

/**
 * 照分數排出**建議名次**（總分 → X 數 → 10 數，跟比賽當下同一套規則）。
 * ⚠️ 只是建議：回傳的是 suggestedRank，不會蓋掉教練已經填的 rank。
 */
export function suggestRanks(entries = []) {
  const rows = (entries || []).map((e, i) => normalizeEntry(e, i));
  const sorted = [...rows].sort((a, b) =>
    b.score - a.score || b.xCount - a.xCount || b.tens - a.tens
    || String(a.name).localeCompare(String(b.name)));
  const rankOf = new Map();
  sorted.forEach((e, i) => rankOf.set(e.key, i + 1));
  return rows.map(e => ({ ...e, suggestedRank: rankOf.get(e.key) || 0 }));
}

/** 把建議名次寫成正式名次（教練按「照分數排」時用） */
export function applySuggestedRanks(entries = []) {
  return suggestRanks(entries).map(e => ({ ...e, rank: e.suggestedRank }));
}

/**
 * 顯示用排序：**有填名次的照名次，沒填的排在後面照分數**。
 * ⚠️ 不能把沒填名次的當第 0 名排到最前面——那是最容易被誤會的呈現。
 */
export function sortForDisplay(entries = []) {
  const rows = suggestRanks(entries);
  return rows.sort((a, b) => {
    const ar = a.rank || Infinity;
    const br = b.rank || Infinity;
    if (ar !== br) return ar - br;
    return a.suggestedRank - b.suggestedRank;
  });
}

/** 存檔前的檢查。⚠️ 擋下來的理由要具體，教練才知道要改哪裡。 */
export function validateTournament(t) {
  const errors = [];
  if (!str(t?.name)) errors.push("請填比賽名稱");
  if (!normalizeDate(t?.date)) errors.push("請填比賽日期（YYYY-MM-DD）");
  const rows = (t?.entries || []).map((e, i) => normalizeEntry(e, i));
  const named = rows.filter(e => e.name);
  if (!named.length) errors.push("至少要有一位選手");
  const dupRanks = named
    .filter(e => e.rank > 0)
    .reduce((acc, e) => { acc[e.rank] = (acc[e.rank] || 0) + 1; return acc; }, {});
  const dup = Object.entries(dupRanks).filter(([, n]) => n > 1).map(([r]) => r);
  // 並列是合法的，但要教練自己確認過——所以只提醒，不擋
  return {
    ok: errors.length === 0,
    errors,
    warnings: dup.length ? [`第 ${dup.join("、")} 名有並列，確認是刻意的`] : [],
    entries: rows,
  };
}

/** 比賽模式的排行榜 → 賽事成績列 */
export function entriesFromMatchBoard(board = []) {
  return (board || []).map((p, i) => normalizeEntry({
    memberId: p.memberId, name: p.name, score: p.score,
    arrows: p.arrows, xCount: p.xCount, tens: p.tens,
    rank: p.rank,          // 先帶當下的即時名次當預設，教練可以改
  }, i));
}

/** 一場賽事的摘要（列表用） */
export function tournamentSummary(t) {
  const rows = (t?.entries || []).map((e, i) => normalizeEntry(e, i));
  const champion = rows.find(e => e.rank === 1) || sortForDisplay(rows)[0] || null;
  return {
    id: t?.id || null,
    name: str(t?.name) || "未命名賽事",
    date: normalizeDate(t?.date),
    type: t?.type || "other",
    typeInfo: TOURNAMENT_TYPE_MAP[t?.type] || TOURNAMENT_TYPE_MAP.other,
    players: rows.filter(e => e.name).length,
    champion: champion?.name || "",
    topScore: champion?.score || 0,
    note: str(t?.note),
  };
}

/** 賽事列表排序：**日期新的排前面**（最近打的最常被看） */
export function sortTournaments(list = []) {
  return [...(list || [])].sort((a, b) =>
    String(normalizeDate(b?.date)).localeCompare(String(normalizeDate(a?.date)))
    || String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
}

/** 個人的對外賽事戰績（射手頁要用） */
export function memberRecord(list = [], memberId = null, name = null) {
  if (!memberId && !name) return { events: 0, best: null, podiums: 0, rows: [] };
  const rows = [];
  for (const t of list || []) {
    for (const e of (t?.entries || []).map((x, i) => normalizeEntry(x, i))) {
      const mine = (memberId && e.memberId === memberId)
        || (!e.memberId && name && e.name === name);
      if (mine) rows.push({ ...e, tournament: tournamentSummary(t) });
    }
  }
  const ranked = rows.filter(r => r.rank > 0);
  return {
    events: rows.length,
    podiums: ranked.filter(r => r.rank <= 3).length,
    best: ranked.length ? Math.min(...ranked.map(r => r.rank)) : null,
    rows: rows.sort((a, b) => String(b.tournament.date).localeCompare(String(a.tournament.date))),
  };
}
