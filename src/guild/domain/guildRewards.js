// src/guild/domain/guildRewards.js
// ─────────────────────────────────────────────────────────────
// 公會「持久化用純函數」：戰利品 → 存檔（profile）的所有變換都在這裡，
// db 層只負責讀寫，不做任何計算 → 好測、好改、不會在 Firestore 交易裡藏規則。
//
// 存檔形狀（guildProfiles/{memberId}）：
//   { catCoins, rep, equipped:{slot:{archetypeId,grade}}, stash:[{uid,archetypeId,grade,at}],
//     junkSeen:{[junkId]:count}, expeditions:{total,won,byDanger:{1,2,3}} }
// ⚠️ 金幣(coins)不存這裡——沿用主線 members/{id}.coins；材料寫進主線 materialInventory。
//    公會只獨佔 CAT幣 / 聲望 / 公會裝，維持「戰力隔離、經濟回饋主線」。
// ─────────────────────────────────────────────────────────────
import { MATERIALS } from "../../lib/monsterMaterials";
import { GUILD_SLOTS, GUILD_EQUIP_ARCHETYPES } from "../data/guildEquipCatalog";

export const GUILD_STASH_LIMIT = 60;          // 倉庫上限（滿了就不再收，避免存檔無限膨脹）
export const REP_PER_DANGER = 10;             // 完成一趟遠征的聲望 = 危險度 × 此值

// 新玩家起手裝（最低品級，不裸奔；六維幾乎等於沒有，不影響平衡）
const STARTER_EQUIPPED = Object.freeze({
  bow:   { archetypeId: "wood_bow",    grade: "common" },
  arrow: { archetypeId: "wood_arrow",  grade: "common" },
  armor: { archetypeId: "cloth_armor", grade: "common" },
});

export function emptyGuildProfile() {
  return {
    catCoins: 0,
    rep: 0,
    equipped: { ...STARTER_EQUIPPED },
    stash: [],
    partyCats: null,      // 出戰貓（catId 陣列）。null = 還沒設定過→自動帶最強的；[] = 刻意不帶貓
    junkSeen: {},
    expeditions: { total: 0, won: 0, byDanger: { 1: 0, 2: 0, 3: 0 } },
  };
}

// Firestore 讀回來的資料可能缺欄位／是舊版 → 一律補成完整形狀（UI 不必到處防 undefined）
export function normalizeGuildProfile(raw) {
  const base = emptyGuildProfile();
  if (!raw) return base;
  const eq = {};
  for (const slot of GUILD_SLOTS) {
    const it = raw.equipped?.[slot];
    if (it && GUILD_EQUIP_ARCHETYPES[it.archetypeId]) eq[slot] = { archetypeId: it.archetypeId, grade: it.grade || "common" };
  }
  return {
    catCoins: Number(raw.catCoins) || 0,
    rep: Number(raw.rep) || 0,
    equipped: Object.keys(eq).length ? eq : base.equipped,
    stash: (Array.isArray(raw.stash) ? raw.stash : []).filter(i => i && GUILD_EQUIP_ARCHETYPES[i.archetypeId]),
    partyCats: Array.isArray(raw.partyCats) ? raw.partyCats.filter(id => typeof id === "string") : null,
    junkSeen: raw.junkSeen && typeof raw.junkSeen === "object" ? { ...raw.junkSeen } : {},
    expeditions: {
      total: Number(raw.expeditions?.total) || 0,
      won: Number(raw.expeditions?.won) || 0,
      byDanger: { 1: 0, 2: 0, 3: 0, ...(raw.expeditions?.byDanger || {}) },
    },
  };
}

// ── 材料對應：公會的 `ghost_t3` → 主線材料 `ghost_m3`（同族同階，寫回共用庫存）──
export function guildMaterialId(familyTier) {
  const m = /^([a-z]+)_t([1-6])$/.exec(String(familyTier || ""));
  if (!m) return null;
  const id = `${m[1]}_m${m[2]}`;
  return MATERIALS.some(x => x.id === id) ? id : null;
}

// loot.materials（[{familyTier,qty}]）→ addMaterials 要的陣列（每個元素 +1，故依 qty 展開）
export function expandLootMaterials(materials = []) {
  const out = [];
  for (const entry of materials) {
    const id = guildMaterialId(entry?.familyTier);
    if (!id) continue;
    const mat = MATERIALS.find(x => x.id === id);
    for (let i = 0; i < (entry.qty || 0); i++) out.push({ id: mat.id, name: mat.name, icon: mat.icon });
  }
  return out;
}

// ── 戰利品 → 新存檔（純函數：不動輸入）──
// loot = settleExpedition 的回傳；opts.danger 決定聲望；opts.uidFn 供測試注入。
export function applyLootToProfile(profile, loot, opts = {}) {
  const p = normalizeGuildProfile(profile);
  const danger = opts.danger || 1;
  const won = !!loot?.won;

  const expeditions = {
    total: p.expeditions.total + 1,
    won: p.expeditions.won + (won ? 1 : 0),
    byDanger: { ...p.expeditions.byDanger, [danger]: (p.expeditions.byDanger[danger] || 0) + (won ? 1 : 0) },
  };
  if (!won) return { profile: { ...p, expeditions }, repGained: 0, coinsGained: 0, stashFull: false };

  const junkSeen = { ...p.junkSeen };
  for (const j of loot.junk || []) junkSeen[j.id] = (junkSeen[j.id] || 0) + 1;

  const uidFn = opts.uidFn || (() => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
  const stash = [...p.stash];
  let stashFull = false;
  for (const d of loot.equipDrops || []) {
    if (stash.length >= GUILD_STASH_LIMIT) { stashFull = true; break; }
    stash.push({ uid: uidFn(), archetypeId: d.archetypeId, grade: d.grade, at: opts.now || Date.now() });
  }

  const repGained = danger * REP_PER_DANGER;
  return {
    profile: { ...p, catCoins: p.catCoins + (loot.catCoins || 0), rep: p.rep + repGained, junkSeen, stash, expeditions },
    repGained,
    coinsGained: loot.coins || 0,
    stashFull,
  };
}

// ── 換裝（純函數）：倉庫件 → 對應槽位；原本裝著的回倉庫（不會憑空消失）──
export function equipFromStash(profile, uid) {
  const p = normalizeGuildProfile(profile);
  const idx = p.stash.findIndex(i => i.uid === uid);
  if (idx < 0) return p;
  const item = p.stash[idx];
  const slot = GUILD_EQUIP_ARCHETYPES[item.archetypeId]?.slot;
  if (!slot) return p;

  const stash = p.stash.filter((_, i) => i !== idx);
  const prev = p.equipped[slot];
  if (prev?.archetypeId) stash.push({ uid: `${uid}-off`, archetypeId: prev.archetypeId, grade: prev.grade, at: Date.now() });
  return { ...p, equipped: { ...p.equipped, [slot]: { archetypeId: item.archetypeId, grade: item.grade } }, stash };
}

export function unequipSlot(profile, slot) {
  const p = normalizeGuildProfile(profile);
  const prev = p.equipped[slot];
  if (!prev?.archetypeId) return p;
  const equipped = { ...p.equipped };
  delete equipped[slot];
  return {
    ...p,
    equipped,
    stash: [...p.stash, { uid: `off-${slot}-${Date.now().toString(36)}`, archetypeId: prev.archetypeId, grade: prev.grade, at: Date.now() }],
  };
}
