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
import { GUILD_SLOTS, GUILD_EQUIP_ARCHETYPES, AFFIX_IDS } from "../data/guildEquipCatalog";
import { JUNK_BY_ID, evaluateJunk } from "../data/guildJunkCatalog";

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
    arrowsPerRound: 3,     // 一回合射幾箭（3 或 6，備包可改；6 箭補給消耗加倍）
    shards: 0,             // 公會裝碎片：分解重複裝備取得，用來強化主力裝（見 guildEnhance）
    junkStock: {},         // 雜貨倉庫 { [junkId]: qty }——**不自動賣**，玩家自己決定何時賣
    contracts: null,      // 今日委託完成紀錄 { dateKey, done:[contractId] }；跨日自動換板（見 guildContracts）
    junkSeen: {},
    expeditions: { total: 0, won: 0, byDanger: { 1: 0, 2: 0, 3: 0 } },
  };
}

// Firestore 讀回來的資料可能缺欄位／是舊版 → 一律補成完整形狀（UI 不必到處防 undefined）
export function normalizeGuildProfile(raw) {
  const base = emptyGuildProfile();
  if (!raw) return base;
  // 裝備欄位正規化：舊存檔沒有 plus/affixes → 補 0/[]（強化與詞綴是後來才加的）
  const normItem = it => ({
    archetypeId: it.archetypeId,
    grade: it.grade || "common",
    plus: Math.max(0, Math.floor(Number(it.plus) || 0)),
    affixes: (Array.isArray(it.affixes) ? it.affixes : []).filter(id => AFFIX_IDS.includes(id)),
  });
  const eq = {};
  for (const slot of GUILD_SLOTS) {
    const it = raw.equipped?.[slot];
    if (it && GUILD_EQUIP_ARCHETYPES[it.archetypeId]) eq[slot] = normItem(it);
  }
  return {
    catCoins: Number(raw.catCoins) || 0,
    rep: Number(raw.rep) || 0,
    equipped: Object.keys(eq).length ? eq : base.equipped,
    stash: (Array.isArray(raw.stash) ? raw.stash : [])
      .filter(i => i && GUILD_EQUIP_ARCHETYPES[i.archetypeId])
      .map(i => ({ uid: i.uid, at: i.at || 0, ...normItem(i) })),
    shards: Math.max(0, Math.floor(Number(raw.shards) || 0)),
    partyCats: Array.isArray(raw.partyCats) ? raw.partyCats.filter(id => typeof id === "string") : null,
    arrowsPerRound: Number(raw.arrowsPerRound) === 6 ? 6 : 3,
    contracts: raw.contracts?.dateKey
      ? { dateKey: raw.contracts.dateKey, done: Array.isArray(raw.contracts.done) ? raw.contracts.done.filter(x => typeof x === "string") : [] }
      : null,
    junkSeen: raw.junkSeen && typeof raw.junkSeen === "object" ? { ...raw.junkSeen } : {},
    // 倉庫只留圖鑑裡存在的雜貨、數量正整數（壞資料不會炸畫面）
    junkStock: Object.fromEntries(
      Object.entries(raw.junkStock && typeof raw.junkStock === "object" ? raw.junkStock : {})
        .filter(([id, n]) => JUNK_BY_ID[id] && Number(n) > 0)
        .map(([id, n]) => [id, Math.floor(Number(n))]),
    ),
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

// 舊六族材料鏈（保底）：[{familyTier,qty}] → addMaterials 要的陣列（每元素 +1，依 qty 展開）
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

// 擴充材料（主線打怪同一份）：[{id,name,qty}] → addMaterials 要的陣列
export function expandExpansionMaterials(materials = []) {
  const out = [];
  for (const entry of materials) {
    if (!entry?.id) continue;
    for (let i = 0; i < (entry.qty || 0); i++) out.push({ id: entry.id, name: entry.name });
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

  // 雜貨：圖鑑計數 + **進倉庫**（賣出的錢等玩家自己決定時機，見 sellJunkFromStock）
  const junkSeen = { ...p.junkSeen };
  const junkStock = { ...p.junkStock };
  for (const j of loot.junk || []) {
    junkSeen[j.id] = (junkSeen[j.id] || 0) + 1;
    junkStock[j.id] = (junkStock[j.id] || 0) + 1;
  }

  const uidFn = opts.uidFn || (() => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
  const stash = [...p.stash];
  let stashFull = false;
  for (const d of loot.equipDrops || []) {
    if (stash.length >= GUILD_STASH_LIMIT) { stashFull = true; break; }
    stash.push({ uid: uidFn(), archetypeId: d.archetypeId, grade: d.grade,
      plus: 0, affixes: Array.isArray(d.affixes) ? d.affixes : [], at: opts.now || Date.now() });
  }

  const repGained = danger * REP_PER_DANGER;
  return {
    profile: { ...p, catCoins: p.catCoins + (loot.catCoins || 0), rep: p.rep + repGained, junkSeen, junkStock, stash, expeditions },
    repGained,
    coinsGained: loot.coins || 0,
    stashFull,
  };
}

// ── 賣雜貨（純函數）──
// sell = { [junkId]: qty }（qty 省略或超過持有量 → 全賣該項）。
// valuationMult＝LUK 的評估加成，**賣出的當下才算** → 養高 LUK 再賣是刻意的策略空間。
export function sellJunkFromStock(profile, sell = {}, valuationMult = 1) {
  const p = normalizeGuildProfile(profile);
  const stock = { ...p.junkStock };
  let coins = 0;
  let catCoins = 0;
  const sold = [];
  for (const [id, want] of Object.entries(sell)) {
    const have = stock[id] || 0;
    if (!have || !JUNK_BY_ID[id]) continue;
    const n = want == null ? have : Math.min(have, Math.max(0, Math.floor(want)));
    if (n <= 0) continue;
    const unit = evaluateJunk(id, valuationMult);
    coins += unit.coins * n;
    catCoins += unit.catCoins * n;
    if (have - n > 0) stock[id] = have - n; else delete stock[id];
    sold.push({ id, name: JUNK_BY_ID[id].name, qty: n });
  }
  return {
    profile: { ...p, junkStock: stock, catCoins: p.catCoins + catCoins },   // 金幣走主線 members.coins，由 db 層寫
    coins, catCoins, sold,
  };
}

// 倉庫總覽（UI 用）：持有的雜貨 + 單價 + 總價，稀有度高的排前面
export function junkStockView(profile, valuationMult = 1) {
  const p = normalizeGuildProfile(profile);
  const order = { legend: 0, prize: 1, rare: 2, fine: 3, common: 4 };
  return Object.entries(p.junkStock)
    .map(([id, qty]) => {
      const j = JUNK_BY_ID[id];
      const unit = evaluateJunk(id, valuationMult);
      return { ...j, qty, unitCoins: unit.coins, unitCatCoins: unit.catCoins, totalCoins: unit.coins * qty, totalCatCoins: unit.catCoins * qty };
    })
    .sort((a, b) => (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9) || b.totalCoins - a.totalCoins);
}

// 全部賣掉的預覽/執行用：{ [id]: qty }
export function allJunkSellMap(profile) {
  return { ...normalizeGuildProfile(profile).junkStock };
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
  // ⚠️ 換裝一定要把 plus/affixes 一起搬，否則強化過的裝備換上/換下就歸零
  if (prev?.archetypeId) stash.push({ uid: `${uid}-off`, archetypeId: prev.archetypeId, grade: prev.grade, plus: prev.plus || 0, affixes: prev.affixes || [], at: Date.now() });
  return {
    ...p,
    equipped: { ...p.equipped, [slot]: { archetypeId: item.archetypeId, grade: item.grade, plus: item.plus || 0, affixes: item.affixes || [] } },
    stash,
  };
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
    stash: [...p.stash, { uid: `off-${slot}-${Date.now().toString(36)}`, archetypeId: prev.archetypeId, grade: prev.grade, plus: prev.plus || 0, affixes: prev.affixes || [], at: Date.now() }],
  };
}
