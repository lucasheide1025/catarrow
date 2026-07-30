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
import { GRADE_META, plusCapOf, PLUS_PCT_PER_LEVEL, enhanceCost, enhanceTotalCost, salvageCost, salvageValue } from "../data/guildEquipCatalog";
import { normalizeGuildProfile } from "./guildRewards";

// 計價已搬到 `data/guildEquipCatalog.js`（純數字、不碰存檔），
// 這樣 guildRewards 的自動分解也能用，而不會跟本檔互相 import（循環相依）。
export { enhanceCost, enhanceTotalCost, salvageCost, salvageValue };

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
export function enhanceEquip(profile, target, opts = {}) {
  const p = normalizeGuildProfile(profile);
  const item = target?.where === "equipped" ? p.equipped[target.slot] : p.stash.find(i => i.uid === target?.uid);
  if (!item) return { ok: false, reason: "找不到這件裝備", profile: p };

  const info = enhanceInfo(item);
  if (info.maxed) return { ok: false, reason: `已達 ${GRADE_META[item.grade]?.label || ""}品級上限 +${info.cap}`, profile: p };
  if (p.shards < info.cost.shards) return { ok: false, reason: `碎片不足（需 ${info.cost.shards}）`, profile: p };
  if (p.catCoins < info.cost.catCoins) return { ok: false, reason: `CAT幣不足（需 ${info.cost.catCoins}）`, profile: p };
  const coins = opts.coins == null ? Infinity : Math.max(0, Math.floor(Number(opts.coins) || 0));
  if (coins < info.cost.coins) return { ok: false, reason: `金幣不足（需 ${info.cost.coins}）`, profile: p };

  const next = { ...item, plus: info.plus + 1 };
  const patched = target.where === "equipped"
    ? { ...p, equipped: { ...p.equipped, [target.slot]: next } }
    : { ...p, stash: p.stash.map(i => (i.uid === target.uid ? next : i)) };

  return {
    ok: true,
    profile: { ...patched, shards: p.shards - info.cost.shards, catCoins: p.catCoins - info.cost.catCoins },
    spent: info.cost,
    coinsSpent: info.cost.coins,
    plus: next.plus,
  };
}

// ── 分解倉庫裡的一件（裝備中的不能直接分解，先卸下→避免手滑拆掉主力）──
export function salvageEquip(profile, uid, opts = {}) {
  const p = normalizeGuildProfile(profile);
  const item = p.stash.find(i => i.uid === uid);
  if (!item) return { ok: false, reason: "找不到這件裝備", profile: p };
  const costCoins = salvageCost(item);
  const coins = opts.coins == null ? Infinity : Math.max(0, Math.floor(Number(opts.coins) || 0));
  if (coins < costCoins) return { ok: false, reason: `金幣不足（分解需 ${costCoins}）`, profile: p };
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
    coinsSpent: costCoins,
  };
}

// 批次分解（清倉用）：把倉庫裡指定的 uid 一次拆掉
export function salvageMany(profile, uids = [], opts = {}) {
  let cur = normalizeGuildProfile(profile);
  let gained = 0;
  let count = 0;
  let coinsSpent = 0;
  const availableCoins = opts.coins == null ? Infinity : Math.max(0, Math.floor(Number(opts.coins) || 0));
  for (const uid of uids) {
    const res = salvageEquip(cur, uid, { coins: availableCoins - coinsSpent });
    if (!res.ok) continue;
    cur = res.profile;
    gained += res.gained;
    coinsSpent += res.coinsSpent;
    count += 1;
  }
  return { ok: count > 0, profile: cur, gained, count, coinsSpent };
}
