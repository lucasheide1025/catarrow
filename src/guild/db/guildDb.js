// src/guild/db/guildDb.js
// ─────────────────────────────────────────────────────────────
// 公會存檔的 Firestore I/O。**只做讀寫，規則全在 domain/guildRewards.js**。
//
// 存放位置的決策（design.md §4 給了兩個選項，這裡選後者）：
//   公會獨佔資料 → 新集合 `guildProfiles/{memberId}`（CAT幣/聲望/公會裝/雜貨圖鑑/場次）
//   ⇒ 不必動 members 那兩份 hasOnly 白名單，規則只加一個 block，隔離也更乾淨。
//   回饋主線的兩樣東西照舊寫主線：金幣 → `members/{id}.coins`（已在白名單）、
//   材料 → `materialInventory`（addMaterials）。
//
// ⚠️ 一律只寫自己的（memberId = profile.id，不是 auth uid），不幫別人請領。
// ⚠️ 新集合要貼 firestore.rules 到 Console，否則 permission-denied。
// ─────────────────────────────────────────────────────────────
import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { addMaterials } from "../../lib/db";
import { normalizeGuildProfile, applyLootToProfile, expandLootMaterials, expandExpansionMaterials, sellJunkFromStock } from "../domain/guildRewards";
import { purchaseFromShop } from "../domain/guildShopPurchase";
import { markContractDone } from "../domain/guildContracts";

const C_GUILD = "guildProfiles";

const ref = memberId => doc(db, C_GUILD, memberId);

// 只挑要存的欄位（避免把 UI 暫存欄位一起寫上去）
const toDoc = p => ({
  catCoins: p.catCoins,
  rep: p.rep,
  equipped: p.equipped,
  stash: p.stash,
  partyCats: p.partyCats,
  arrowsPerRound: p.arrowsPerRound,
  shards: p.shards,
  title: p.title,
  salvagedCount: p.salvagedCount,
  catEarned: p.catEarned,
  contracts: p.contracts,
  junkSeen: p.junkSeen,
  junkStock: p.junkStock,
  expeditions: p.expeditions,
  updatedAt: serverTimestamp(),
});

export async function loadGuildProfile(memberId) {
  if (!memberId) return normalizeGuildProfile(null);
  try {
    const snap = await getDoc(ref(memberId));
    return normalizeGuildProfile(snap.exists() ? snap.data() : null);
  } catch (e) {
    console.warn("loadGuildProfile:", e?.message);
    return normalizeGuildProfile(null);
  }
}

export function subscribeGuildProfile(memberId, callback) {
  if (!memberId) { callback(normalizeGuildProfile(null)); return () => {}; }
  return onSnapshot(
    ref(memberId),
    snap => callback(normalizeGuildProfile(snap.exists() ? snap.data() : null)),
    err => { console.warn("subscribeGuildProfile:", err.message); callback(normalizeGuildProfile(null)); },
  );
}

// 換裝/卸下後存檔（equipped + stash 是一體的，一起寫才不會掉件）
export async function saveGuildProfile(memberId, profile) {
  if (!memberId) return { ok: false, reason: "未登入（測試模式不存檔）" };
  try {
    await setDoc(ref(memberId), toDoc(normalizeGuildProfile(profile)), { merge: true });
    return { ok: true };
  } catch (e) {
    console.warn("saveGuildProfile:", e?.message);
    return { ok: false, reason: e?.message };
  }
}

// 公會商店購買：驗證全在 domain（階級/CAT幣/倉庫），這裡只寫。
// 材料類商品的材料寫進主線 materialInventory（回饋打怪/貓村經濟）。
export async function buyGuildShopItem(memberId, profile, itemId) {
  const res = purchaseFromShop(profile, itemId);
  if (!res.ok) return res;
  if (!memberId) return { ...res, offline: true };   // 離線試玩：算得出結果但不存
  try {
    await setDoc(ref(memberId), toDoc(res.profile), { merge: true });
    if (res.materials.length) await addMaterials(memberId, res.materials);
    return { ...res, offline: false };
  } catch (e) {
    console.warn("buyGuildShopItem:", e?.message);
    return { ok: false, reason: e?.message || "購買失敗", profile: normalizeGuildProfile(profile), materials: [] };
  }
}

// 賣雜貨：驗證與計價全在 domain（`sellJunkFromStock`），這裡只寫。
// CAT幣進 guildProfiles、金幣進主線 members.coins（跟遠征結算同一條路）。
export async function sellGuildJunk(memberId, profile, sell, valuationMult = 1) {
  const res = sellJunkFromStock(profile, sell, valuationMult);
  if (!res.sold.length) return { ok: false, reason: "沒有可賣的雜貨", ...res };
  if (!memberId) return { ok: true, offline: true, ...res };
  try {
    await setDoc(ref(memberId), toDoc(res.profile), { merge: true });
    if (res.coins > 0) {
      await updateDoc(doc(db, "members", memberId), { coins: increment(res.coins), updatedAt: serverTimestamp() });
    }
    return { ok: true, offline: false, ...res };
  } catch (e) {
    console.warn("sellGuildJunk:", e?.message);
    return { ok: false, reason: e?.message || "賣出失敗", profile: normalizeGuildProfile(profile), coins: 0, catCoins: 0, sold: [] };
  }
}

// 遠征結算 → 真的發獎。呼叫端要自己做 once-guard（一趟只請領一次）。
// 回傳 { ok, profile, repGained, coinsGained, materialsGranted, stashFull, offline }
export async function grantExpeditionRewards(memberId, loot, opts = {}) {
  const current = opts.profile !== undefined ? opts.profile : await loadGuildProfile(memberId);
  const applied = applyLootToProfile(current, loot, { danger: opts.danger || 1 });
  // 委託結案：勝敗都鎖同一張（企劃拍板——失敗也算接過了，當天不能重刷）
  if (opts.contractId) applied.profile = markContractDone(applied.profile, opts.contractId, opts.dateKey);
  // 擴充材料（主力，2~3 倍量）＋ 舊六族材料鏈（保底）都寫進主線 materialInventory
  const materials = loot?.won
    ? [...expandExpansionMaterials(loot.materials), ...expandLootMaterials(loot.legacyMaterials)]
    : [];

  // 未登入（?guild 直接開）→ 只回傳算好的結果，讓畫面照樣試玩，不打 Firestore
  if (!memberId) return { ok: true, offline: true, ...applied, materialsGranted: materials.length };

  try {
    await setDoc(ref(memberId), toDoc(applied.profile), { merge: true });
    if (applied.coinsGained > 0) {
      await updateDoc(doc(db, "members", memberId), { coins: increment(applied.coinsGained), updatedAt: serverTimestamp() });
    }
    if (materials.length) await addMaterials(memberId, materials);
    return { ok: true, offline: false, ...applied, materialsGranted: materials.length };
  } catch (e) {
    console.warn("grantExpeditionRewards:", e?.message);
    return { ok: false, reason: e?.message, ...applied, materialsGranted: 0 };
  }
}
