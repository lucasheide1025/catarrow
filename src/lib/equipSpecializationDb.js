// src/lib/equipSpecializationDb.js — 裝備專精持久化（design.md §8）
// equipSpecializations/{memberId} = {
//   version: 1,
//   weapon:    { activeTrackId, tracks: { precision:{level,failCount}, ... } },
//   armor:     { activeTrackId, tracks: {...} },
//   accessory: { activeTrackId, tracks: {...} },
// }
// 缺欄位＝全部 Lv0/未解鎖,首次寫入補預設,不做批次 backfill。
// 全部走 transaction：先驗證金幣/庫存,再一次扣寫（design.md §7）。
// 素材消耗：每 Tier 需求量從玩家該 Tier「一般怪素材」總持有中扣（多的先扣）;
// 40/35/25 主次分配是配方層描述,不強制指定家族——玩家湊滿同 Tier 一般素材即可。

import { doc, getDoc, runTransaction, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./firebase";
import {
  SPECIALIZATION_TRACKS, SPECIALIZATION_UNLOCK_COST,
  getSpecializationUpgradeCost, getSpecializationAttemptChance,
} from "./equipmentSpecializationCatalog";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";

const C_SPEC = "equipSpecializations";

const trackById = Object.fromEntries(SPECIALIZATION_TRACKS.map(track => [track.id, track]));

// 素材 id → { tierIndex, kind }（normal/miniBoss/boss）
const MATERIAL_META = Object.fromEntries(EXPANSION_MONSTERS.map(monster => [
  monster.material.id,
  { tierIndex: monster.tierIndex, kind: monster.encounter === "normal" ? "normal" : monster.encounter },
]));

export const EMPTY_SPECIALIZATIONS = Object.freeze({
  version: 1,
  weapon: { activeTrackId: null, tracks: {} },
  armor: { activeTrackId: null, tracks: {} },
  accessory: { activeTrackId: null, tracks: {} },
});

export function normalizeSpecializations(data) {
  const base = { ...EMPTY_SPECIALIZATIONS };
  if (!data) return base;
  return {
    version: 1,
    weapon: { activeTrackId: data.weapon?.activeTrackId || null, tracks: { ...(data.weapon?.tracks || {}) } },
    armor: { activeTrackId: data.armor?.activeTrackId || null, tracks: { ...(data.armor?.tracks || {}) } },
    accessory: { activeTrackId: data.accessory?.activeTrackId || null, tracks: { ...(data.accessory?.tracks || {}) } },
  };
}

export async function getEquipSpecializations(memberId) {
  if (!memberId) return normalizeSpecializations(null);
  try {
    const snap = await getDoc(doc(db, C_SPEC, memberId));
    return normalizeSpecializations(snap.exists() ? snap.data() : null);
  } catch { return normalizeSpecializations(null); }
}

// 依 Tier 匯總玩家的一般怪素材/王素材持有
export function summarizeMaterialsForSpec(items = {}) {
  const byTier = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let miniBoss = 0, boss = 0;
  for (const [materialId, rawCount] of Object.entries(items)) {
    const meta = MATERIAL_META[materialId];
    // 歷史資料可能有負值（讀改寫競態）;顯示與消耗一律當 0,不讓負數污染總和
    const count = Math.max(0, Number(rawCount) || 0);
    if (!meta || !count) continue;
    if (meta.kind === "normal") byTier[meta.tierIndex] += count;
    else if (meta.kind === "miniBoss") miniBoss += count;
    else if (meta.kind === "boss") boss += count;
  }
  return { byTier, miniBoss, boss };
}

// 從 items 扣掉某 Tier 的一般素材 total 個（持有多的先扣）;不足回 null
function consumeTierMaterials(items, tierIndex, total) {
  if (total <= 0) return items;
  const holdings = Object.entries(items)
    .filter(([materialId, count]) => MATERIAL_META[materialId]?.kind === "normal"
      && MATERIAL_META[materialId].tierIndex === tierIndex && Number(count) > 0)
    .sort(([, a], [, b]) => b - a);
  let remaining = total;
  const next = { ...items };
  for (const [materialId, count] of holdings) {
    if (remaining <= 0) break;
    const take = Math.min(count, remaining);
    next[materialId] = count - take;
    remaining -= take;
  }
  return remaining > 0 ? null : next;
}

function consumeKindMaterials(items, kind, quantity) {
  if (quantity <= 0) return items;
  const holdings = Object.entries(items)
    .filter(([materialId, count]) => MATERIAL_META[materialId]?.kind === kind && count > 0)
    .sort(([, a], [, b]) => b - a);
  let remaining = quantity;
  const next = { ...items };
  for (const [materialId, count] of holdings) {
    if (remaining <= 0) break;
    const take = Math.min(count, remaining);
    next[materialId] = count - take;
    remaining -= take;
  }
  return remaining > 0 ? null : next;
}

// 解鎖一條專精（10,000 金幣;同 slot 首條自動設為啟用）
export async function unlockSpecializationTrack(memberId, trackId) {
  const track = trackById[trackId];
  if (!memberId || !track) return { ok: false, reason: "參數錯誤" };
  try {
    return await runTransaction(db, async transaction => {
      const specRef = doc(db, C_SPEC, memberId);
      const memberRef = doc(db, "members", memberId);
      const [specSnap, memberSnap] = await Promise.all([transaction.get(specRef), transaction.get(memberRef)]);
      if (!memberSnap.exists()) return { ok: false, reason: "找不到會員" };
      const spec = normalizeSpecializations(specSnap.exists() ? specSnap.data() : null);
      if (spec[track.slot].tracks[trackId]) return { ok: false, reason: "已解鎖" };
      const coins = memberSnap.data().coins || 0;
      if (coins < SPECIALIZATION_UNLOCK_COST) return { ok: false, reason: `金幣不足（需 ${SPECIALIZATION_UNLOCK_COST.toLocaleString()}）` };
      spec[track.slot].tracks[trackId] = { level: 0, failCount: 0 };
      if (!spec[track.slot].activeTrackId) spec[track.slot].activeTrackId = trackId;
      transaction.update(memberRef, { coins: increment(-SPECIALIZATION_UNLOCK_COST) });
      transaction.set(specRef, { ...spec, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true, spec };
    });
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 切換 slot 啟用的專精（需已解鎖）
export async function setActiveSpecialization(memberId, trackId) {
  const track = trackById[trackId];
  if (!memberId || !track) return { ok: false, reason: "參數錯誤" };
  try {
    return await runTransaction(db, async transaction => {
      const specRef = doc(db, C_SPEC, memberId);
      const specSnap = await transaction.get(specRef);
      const spec = normalizeSpecializations(specSnap.exists() ? specSnap.data() : null);
      if (!spec[track.slot].tracks[trackId]) return { ok: false, reason: "尚未解鎖" };
      spec[track.slot].activeTrackId = trackId;
      transaction.set(specRef, { ...spec, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true, spec };
    });
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 嘗試升級（成功/失敗都扣成本;pity 由 catalog 的 failCount 加成/保底規則決定）
export async function attemptSpecializationUpgrade(memberId, trackId, { roll = Math.random() } = {}) {
  const track = trackById[trackId];
  if (!memberId || !track) return { ok: false, reason: "參數錯誤" };
  try {
    return await runTransaction(db, async transaction => {
      const specRef = doc(db, C_SPEC, memberId);
      const memberRef = doc(db, "members", memberId);
      const inventoryRef = doc(db, "materialInventory", memberId);
      const [specSnap, memberSnap, inventorySnap] = await Promise.all([
        transaction.get(specRef), transaction.get(memberRef), transaction.get(inventoryRef),
      ]);
      if (!memberSnap.exists()) return { ok: false, reason: "找不到會員" };
      const spec = normalizeSpecializations(specSnap.exists() ? specSnap.data() : null);
      const state = spec[track.slot].tracks[trackId];
      if (!state) return { ok: false, reason: "尚未解鎖" };
      if (state.level >= 10) return { ok: false, reason: "已達最高等級" };
      const targetLevel = state.level + 1;
      const cost = getSpecializationUpgradeCost({ trackId, targetLevel });
      const coins = memberSnap.data().coins || 0;
      if (coins < cost.coins) return { ok: false, reason: `金幣不足（需 ${cost.coins.toLocaleString()}）` };
      let items = inventorySnap.exists() ? { ...(inventorySnap.data().items || {}) } : {};
      for (const tierCost of cost.tierMaterials) {
        items = consumeTierMaterials(items, tierCost.tierIndex, tierCost.total);
        if (!items) return { ok: false, reason: `T${tierCost.tierIndex} 素材不足（需 ${tierCost.total}）` };
      }
      if (cost.bossMaterial) {
        items = consumeKindMaterials(items, cost.bossMaterial.kind, cost.bossMaterial.quantity);
        if (!items) return { ok: false, reason: `${cost.bossMaterial.kind === "boss" ? "大王" : "小王"}素材不足（需 ${cost.bossMaterial.quantity}）` };
      }
      const chance = getSpecializationAttemptChance({ trackId, targetLevel, consecutiveFailures: state.failCount || 0 });
      const success = roll < chance;
      spec[track.slot].tracks[trackId] = success
        ? { level: targetLevel, failCount: 0 }
        : { level: state.level, failCount: (state.failCount || 0) + 1 };
      transaction.update(memberRef, { coins: increment(-cost.coins) });
      transaction.set(inventoryRef, { items, updatedAt: serverTimestamp() }, { merge: true });
      transaction.set(specRef, { ...spec, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true, success, chance, targetLevel, spec };
    });
  } catch (e) { return { ok: false, reason: e.message }; }
}
