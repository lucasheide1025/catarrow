// src/guild/domain/guildShopPurchase.js
// 公會商店購買的**純函數**：驗階級/CAT幣/倉庫，算出「新存檔 + 要發的材料」。
// db 層只負責把結果寫進去（規則不進交易，才好測）。
import { MATERIALS } from "../../lib/monsterMaterials";
import { shopItemById, SHOP_MATERIAL_BY_ID } from "../data/guildShop";
import { rankUnlocks } from "./guildRank";
import { normalizeGuildProfile, GUILD_STASH_LIMIT } from "./guildRewards";
import { supplyCapacity } from "./guildBuildings";

export function purchaseFromShop(profile, itemId, opts = {}) {
  const p = normalizeGuildProfile(profile);
  const item = shopItemById(itemId);
  if (!item) return { ok: false, reason: "沒有這件商品", profile: p, materials: [] };

  const { shopTier } = rankUnlocks(p);
  if (item.tier > shopTier) return { ok: false, reason: `階級不足（需 ${item.tier} 級貨架）`, profile: p, materials: [] };
  if (item.kind === "supply") {
    const coins = Math.max(0, Math.floor(Number(opts.coins) || 0));
    if (coins < item.costCoins) return { ok: false, reason: `金幣不足（需 ${item.costCoins}）`, profile: p, materials: [] };
    const cap = supplyCapacity(p);
    if (p.supplyStock[item.supplyId] + item.qty > cap) return { ok: false, reason: `補給倉庫容量不足（上限 ${cap}）`, profile: p, materials: [] };
    return {
      ok: true,
      coinsSpent: item.costCoins,
      profile: {
        ...p,
        supplyStock: {
          ...p.supplyStock,
          [item.supplyId]: p.supplyStock[item.supplyId] + item.qty,
        },
      },
      materials: [],
    };
  }

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
  // ⚠️ 兩套材料都要認：商店主力是**擴充材料**（mat_<族>_t<N>_<role>），
  //    但舊六族鏈（<族>_m<N>）的商品 id 仍可能存在於舊存檔/舊連結。
  const mat = SHOP_MATERIAL_BY_ID[item.materialId] || MATERIALS.find(m => m.id === item.materialId);
  if (!mat) return { ok: false, reason: "材料設定錯誤", profile: p, materials: [] };
  const materials = Array.from({ length: item.qty || 1 }, () => ({ id: mat.id, name: mat.name, ...(mat.icon ? { icon: mat.icon } : {}) }));
  return { ok: true, spent: item.costCat, profile: { ...p, catCoins: p.catCoins - item.costCat }, materials };
}
