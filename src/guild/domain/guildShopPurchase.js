// src/guild/domain/guildShopPurchase.js
// 公會商店購買的**純函數**：驗階級/CAT幣/倉庫，算出「新存檔 + 要發的材料」。
// db 層只負責把結果寫進去（規則不進交易，才好測）。
import { MATERIALS } from "../../lib/monsterMaterials";
import { shopItemById } from "../data/guildShop";
import { rankUnlocks } from "./guildRank";
import { normalizeGuildProfile, GUILD_STASH_LIMIT } from "./guildRewards";

export function purchaseFromShop(profile, itemId, opts = {}) {
  const p = normalizeGuildProfile(profile);
  const item = shopItemById(itemId);
  if (!item) return { ok: false, reason: "沒有這件商品", profile: p, materials: [] };

  const { shopTier } = rankUnlocks(p.rep);
  if (item.tier > shopTier) return { ok: false, reason: `階級不足（需 ${item.tier} 級貨架）`, profile: p, materials: [] };
  if (p.catCoins < item.costCat) return { ok: false, reason: `CAT幣不足（需 ${item.costCat}）`, profile: p, materials: [] };

  if (item.kind === "equip") {
    if (p.stash.length >= GUILD_STASH_LIMIT) return { ok: false, reason: "倉庫已滿", profile: p, materials: [] };
    const uid = (opts.uidFn || (() => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`))();
    return {
      ok: true,
      spent: item.costCat,
      profile: {
        ...p,
        catCoins: p.catCoins - item.costCat,
        stash: [...p.stash, { uid, archetypeId: item.archetypeId, grade: item.grade, at: opts.now || Date.now() }],
      },
      materials: [],
    };
  }

  // material：扣 CAT幣，材料由 db 層寫進主線 materialInventory
  const mat = MATERIALS.find(m => m.id === item.materialId);
  if (!mat) return { ok: false, reason: "材料設定錯誤", profile: p, materials: [] };
  const materials = Array.from({ length: item.qty || 1 }, () => ({ id: mat.id, name: mat.name, icon: mat.icon }));
  return { ok: true, spent: item.costCat, profile: { ...p, catCoins: p.catCoins - item.costCat }, materials };
}
