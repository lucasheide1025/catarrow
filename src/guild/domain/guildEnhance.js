// src/guild/domain/guildEnhance.js
// ─────────────────────────────────────────────────────────────
// 公會裝的「強化 / 分解」——純函數。
//
// 為什麼要有這兩個（2026-07-25）：
//  ① 重複掉落的裝備原本毫無用途，倉庫滿了還會卡住（`stashFull`）→ **分解**給出口。
//  ② 高階裝只能靠打，但打到之後沒有長期投資對象 → **強化**讓它值得養。
//
// 貨幣設計：強化用「公會裝碎片（shards）」＋ CAT幣。碎片只能從**分解裝備**取得，
// 所以「刷到重複裝」＝「養主力裝的資源」，掉落永遠不會白費。
// 強化**必定成功**：隨機性已經在掉落與詞綴上了，再賭一層只會變成挫敗來源。
// ─────────────────────────────────────────────────────────────
import { GRADE_META, plusCapOf, PLUS_PCT_PER_LEVEL } from "../data/guildEquipCatalog";
import { normalizeGuildProfile } from "./guildRewards";

// 分解回收的碎片：品級越高越多，已投入的強化等級退回 8 成（不會完全打水漂）
const SALVAGE_BY_TIER = { 1: 2, 2: 5, 3: 12, 4: 25, 5: 45, 6: 80 };

export function salvageValue(item) {
  const tier = GRADE_META[item?.grade]?.tier || 1;
  const base = SALVAGE_BY_TIER[tier] || 2;
  const plus = Math.max(0, Math.floor(Number(item?.plus) || 0));
  const invested = enhanceTotalCost(item?.grade, plus).shards;
  return base + Math.floor(invested * 0.8);
}

// 下一級強化的成本（碎片＋CAT幣）：品級越高、等級越高越貴
export function enhanceCost(grade, currentPlus) {
  const tier = GRADE_META[grade]?.tier || 1;
  const next = Math.max(0, Math.floor(Number(currentPlus) || 0)) + 1;
  return {
    shards: Math.round(tier * 3 * next * (1 + (next - 1) * 0.25)),
    catCoins: Math.round(tier * 6 * next),
    next,
  };
}

// 從 0 強化到 plus 的累計成本（分解回收要用）
export function enhanceTotalCost(grade, plus) {
  let shards = 0;
  let catCoins = 0;
  for (let i = 0; i < Math.max(0, Math.floor(Number(plus) || 0)); i++) {
    const c = enhanceCost(grade, i);
    shards += c.shards;
    catCoins += c.catCoins;
  }
  return { shards, catCoins };
}

// 這件裝備還能不能強化（含上限說明）
export function enhanceInfo(item) {
  const cap = plusCapOf(item?.grade);
  const plus = Math.max(0, Math.floor(Number(item?.plus) || 0));
  return {
    plus, cap,
    maxed: plus >= cap,
    cost: plus >= cap ? null : enhanceCost(item?.grade, plus),
    gainPct: Math.round(PLUS_PCT_PER_LEVEL * 100),
  };
}

// ── 強化倉庫裡的一件（或裝備中的某槽）──
// target = { where: "stash", uid } | { where: "equipped", slot }
export function enhanceEquip(profile, target) {
  const p = normalizeGuildProfile(profile);
  const item = target?.where === "equipped" ? p.equipped[target.slot] : p.stash.find(i => i.uid === target?.uid);
  if (!item) return { ok: false, reason: "找不到這件裝備", profile: p };

  const info = enhanceInfo(item);
  if (info.maxed) return { ok: false, reason: `已達 ${GRADE_META[item.grade]?.label || ""}品級上限 +${info.cap}`, profile: p };
  if (p.shards < info.cost.shards) return { ok: false, reason: `碎片不足（需 ${info.cost.shards}）`, profile: p };
  if (p.catCoins < info.cost.catCoins) return { ok: false, reason: `CAT幣不足（需 ${info.cost.catCoins}）`, profile: p };

  const next = { ...item, plus: info.plus + 1 };
  const patched = target.where === "equipped"
    ? { ...p, equipped: { ...p.equipped, [target.slot]: next } }
    : { ...p, stash: p.stash.map(i => (i.uid === target.uid ? next : i)) };

  return {
    ok: true,
    profile: { ...patched, shards: p.shards - info.cost.shards, catCoins: p.catCoins - info.cost.catCoins },
    spent: info.cost,
    plus: next.plus,
  };
}

// ── 分解倉庫裡的一件（裝備中的不能直接分解，先卸下→避免手滑拆掉主力）──
export function salvageEquip(profile, uid) {
  const p = normalizeGuildProfile(profile);
  const item = p.stash.find(i => i.uid === uid);
  if (!item) return { ok: false, reason: "找不到這件裝備", profile: p };
  const gained = salvageValue(item);
  return {
    ok: true,
    profile: {
      ...p,
      stash: p.stash.filter(i => i.uid !== uid),
      shards: p.shards + gained,
      salvagedCount: p.salvagedCount + 1,   // 稱號「裝備狂人」要用
    },
    gained,
  };
}

// 批次分解（清倉用）：把倉庫裡指定的 uid 一次拆掉
export function salvageMany(profile, uids = []) {
  let cur = normalizeGuildProfile(profile);
  let gained = 0;
  let count = 0;
  for (const uid of uids) {
    const res = salvageEquip(cur, uid);
    if (!res.ok) continue;
    cur = res.profile;
    gained += res.gained;
    count += 1;
  }
  return { ok: count > 0, profile: cur, gained, count };
}
