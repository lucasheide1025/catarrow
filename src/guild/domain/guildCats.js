// src/guild/domain/guildCats.js
// ─────────────────────────────────────────────────────────────
// 真貓 → 公會遠征戰鬥單位的映射層。
// 貓的養成（等級/羈絆/裝備）**沿用主線 `calcCatCombatStats`**，公會不另開一套數值，
// 所以「在貓村養貓」直接讓遠征變強＝貓村×打怪的融合點。
// ⚠️ 單向依賴：公會讀貓的資料 OK；公會的六維/裝備絕不回寫貓或主線。
// ⚠️ 公會**不**呼叫 addCatBond/addCatXP（遠征不養貓），避免公會偷偷灌主線成長。
// ─────────────────────────────────────────────────────────────
import { calcCatCombatStats } from "../../lib/catCombat";
import { CATS } from "../../lib/catData";

export const MAX_PARTY_CATS = 3; // 一趟最多帶 3 隻（畫面塞得下、也保留取捨）

// 美術未到位前用 type emoji 佔位（P4 換成 2.5D sprite）
const TYPE_ICON = { attack: "🐈‍⬛", defense: "🐈", allround: "🐱" };
const TYPE_LABEL = { attack: "攻擊型", defense: "防禦型", allround: "全能型" };

// 單隻：members/{id}/cats/{catId} 的文件 → 戰鬥單位（expeditionFlow 吃的形狀）
export function toGuildCat(catData = {}) {
  const s = calcCatCombatStats(catData);
  return {
    id: s.catId,
    name: CATS[s.catId]?.name || s.catId,
    icon: TYPE_ICON[s.type] || "🐱",
    type: s.type,
    typeLabel: TYPE_LABEL[s.type] || "全能型",
    level: s.catLevel,
    bondLv: s.bondLv,
    atk: s.catATK,
    def: s.catDEF,
    hp: s.catHP,
  };
}

// 全部我的貓 → 依戰力排序的名冊（強的排前面，選擇時一目了然）
export function buildCatRoster(catsMap = {}) {
  return Object.values(catsMap || {})
    .filter(c => c && (c.catId || c.id))
    .map(c => toGuildCat(c.catId ? c : { ...c, catId: c.id }))
    .sort((a, b) => b.atk - a.atk || a.name.localeCompare(b.name));
}

// 出戰名單。**null/undefined（沒設定過）→ 自動帶最強的前 N 隻**（新玩家不必先進設定）；
// **`[]`（玩家刻意全部取消）→ 真的不帶貓**。兩者必須分得開，否則取消最後一隻會被自動補回去。
export function pickPartyCats(roster = [], selectedIds) {
  if (!Array.isArray(selectedIds)) return roster.slice(0, MAX_PARTY_CATS);
  return roster.filter(c => selectedIds.includes(c.id)).slice(0, MAX_PARTY_CATS);
}

// 勾選/取消（超過上限時擋下，回傳原陣列讓 UI 顯示提示）
export function togglePartyCat(selectedIds = [], catId) {
  const cur = Array.isArray(selectedIds) ? selectedIds : [];
  if (cur.includes(catId)) return cur.filter(id => id !== catId);
  if (cur.length >= MAX_PARTY_CATS) return cur;
  return [...cur, catId];
}
