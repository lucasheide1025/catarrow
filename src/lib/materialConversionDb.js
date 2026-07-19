// src/lib/materialConversionDb.js — 冒險素材轉換（同 Tier 轉換 / 同族升階;design.md §7 交易原則）
// transaction：先驗證金幣與庫存,再一次扣寫;規則與匯率全在 monsterEconomyCatalog（此檔零數值）。

import { doc, runTransaction, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./firebase";
import { previewSameTierConversion, previewTierUpgrade } from "./monsterEconomyCatalog";

export async function convertMaterials(memberId, { operation, sourceMaterialId, targetMaterialId, batches = 1 }) {
  if (!memberId) return { ok: false, reason: "參數錯誤" };
  let preview;
  try {
    preview = operation === "tierUpgrade"
      ? previewTierUpgrade({ sourceMaterialId, targetMaterialId, batches })
      : previewSameTierConversion({ sourceMaterialId, targetMaterialId, batches });
  } catch (e) { return { ok: false, reason: e.message }; }
  try {
    return await runTransaction(db, async transaction => {
      const memberRef = doc(db, "members", memberId);
      const inventoryRef = doc(db, "materialInventory", memberId);
      const [memberSnap, inventorySnap] = await Promise.all([
        transaction.get(memberRef), transaction.get(inventoryRef),
      ]);
      if (!memberSnap.exists()) return { ok: false, reason: "找不到會員" };
      const coins = memberSnap.data().coins || 0;
      if (coins < preview.coins) return { ok: false, reason: `金幣不足（需 ${preview.coins.toLocaleString()}）` };
      const items = inventorySnap.exists() ? { ...(inventorySnap.data().items || {}) } : {};
      const owned = items[preview.source.materialId] || 0;
      if (owned < preview.source.quantity) return { ok: false, reason: `素材不足（需 ${preview.source.quantity}，持有 ${owned}）` };
      items[preview.source.materialId] = owned - preview.source.quantity;
      items[preview.target.materialId] = (items[preview.target.materialId] || 0) + preview.target.quantity;
      transaction.update(memberRef, { coins: increment(-preview.coins) });
      transaction.set(inventoryRef, { items, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true, preview };
    });
  } catch (e) { return { ok: false, reason: e.message }; }
}
