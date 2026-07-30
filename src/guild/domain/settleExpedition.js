// src/guild/domain/settleExpedition.js
// ─────────────────────────────────────────────────────────────
// 凱旋回報結算：勝利後 roll 獎勵。
//
// 2026-07-25 改版（作者指示）：
//  ① 材料改掉**擴充材料**（跟主線打怪同一份 `EXPANSION_MATERIALS`），
//     每隻怪 **2~3 個**（公會是刷材料的地方，量比主線大方）。
//     首領（miniBoss/boss）掉對應 kind 的材料 → 高危險委託才拿得到王素材。
//  ② 雜貨**不再自動賣掉**：只回傳撈到什麼，進「雜貨倉庫」由玩家決定何時賣
//     （賣價在 `guildJunkCatalog.evaluateJunk`，賣的當下才算 LUK 加成）。
//  ③ 舊六族材料鏈保留當保底（`legacyMaterials`），不刪舊系統。
//
// 六維 LUK 影響：dropBonusPct（掉率/量）、valuationBonusPct（雜貨價值，賣出時才用）。
// 純函數。
// ─────────────────────────────────────────────────────────────
import { LOOT_BY_DANGER } from "../data/guildLootTable";
import { junkPoolFor, drawJunk } from "../data/guildJunkCatalog";
import { GUILD_EQUIP_ARCHETYPES, GRADES } from "../data/guildEquipCatalog";
import { compatibleAffixIds } from "./guildEquipmentV2";
import { EXPANSION_MATERIALS } from "../../lib/monsterExpansionCatalog";
import { deriveGuildCombat } from "./guildStats";
import { shootingRatio } from "./expeditionFlow";

const TIER_INDEX = { common: 1, rare: 2, elite: 3, fierce: 4, boss: 5, mythic: 6 };

// 每隻怪的擴充材料掉落量（作者要求 2~3 倍量）
const MAT_PER_MONSTER = [2, 3];

const EMPTY = { won: false, materials: [], legacyMaterials: [], junk: [], equipDrops: [], coins: 0, catCoins: 0, accuracy: null };

// ── 射擊表現 → 掉落加成（這是射箭遊戲：射得準就該掉得好）──
// ratio = 整趟命中率（總得分/總滿分）。全 M ≈ 0.7 倍、平均 8 分 ≈ 1.0 倍、全 X = 1.35 倍。
// 另外高命中會**多一次裝備判定**，讓「射得好」的回饋看得見。
export const ACCURACY_BANDS = Object.freeze([
  { min: 0.90, band: "S", label: "神射", dropMult: 1.35, extraRoll: true },
  { min: 0.78, band: "A", label: "優異", dropMult: 1.20, extraRoll: true },
  { min: 0.62, band: "B", label: "穩健", dropMult: 1.05, extraRoll: false },
  { min: 0.45, band: "C", label: "普通", dropMult: 0.92, extraRoll: false },
  { min: 0.00, band: "D", label: "生疏", dropMult: 0.75, extraRoll: false },
]);

export function accuracyBand(ratio) {
  return ACCURACY_BANDS.find(b => ratio >= b.min) || ACCURACY_BANDS[ACCURACY_BANDS.length - 1];
}

// 該怪對應的擴充材料池：同族、同階、同 kind（雜兵 normal／小王 miniBoss／大王 boss）
function materialPoolFor(monster) {
  const tierIndex = monster.tierIndex || TIER_INDEX[monster.tier] || 1;
  const kind = monster.encounter === "boss" ? "boss" : monster.encounter === "miniBoss" ? "miniBoss" : "normal";
  const exact = EXPANSION_MATERIALS.filter(m => m.family === monster.family && m.tierIndex === tierIndex && m.kind === kind);
  if (exact.length) return exact;
  // 保險：該 kind 沒有就退回同族同階全部（例如資料表日後調整）
  return EXPANSION_MATERIALS.filter(m => m.family === monster.family && m.tierIndex === tierIndex);
}

export function settleExpedition(state, opts = {}) {
  if (!state || state.status !== "won") return { ...EMPTY };
  const rand = opts.rand || Math.random;
  const d = state.derived || deriveGuildCombat(state.guildStats);
  const danger = state.expedition?.danger || 1;
  const cfg = LOOT_BY_DANGER[danger] || LOOT_BY_DANGER[1];
  const ratio = shootingRatio(state);
  const acc = accuracyBand(ratio);
  const lukDrop = (1 + (d.dropBonusPct || 0)) * acc.dropMult;   // LUK × 射擊表現

  // 擊敗的怪（勝利＝全滅所有波）
  const skipped = new Set(state.skippedWaveIndexes || []);
  const defeated = (state.expedition?.waves || [])
    .flatMap((wave, index) => skipped.has(index) ? [] : (wave.monsters || []));

  // ① 擴充材料：每隻怪機率掉 2~3 個該族該階該 kind 的材料
  const matMap = {};      // { materialId: { id, name, qty, kind, family, tierIndex } }
  const legacyMap = {};   // 舊六族材料鏈（保底，維持舊系統不斷線）
  for (const m of defeated) {
    if (rand() >= Math.min(0.98, cfg.matChance * lukDrop)) continue;
    const pool = materialPoolFor(m);
    if (!pool.length) continue;
    const qty = MAT_PER_MONSTER[0] + Math.floor(rand() * (MAT_PER_MONSTER[1] - MAT_PER_MONSTER[0] + 1));
    for (let i = 0; i < qty; i++) {
      const mat = pool[Math.floor(rand() * pool.length)];
      const cur = matMap[mat.id];
      if (cur) cur.qty += 1;
      else matMap[mat.id] = { id: mat.id, name: mat.name, kind: mat.kind, family: mat.family, tierIndex: mat.tierIndex, qty: 1 };
    }
    // 保底：同族同階的舊材料鏈各給 1（沿用 `{family}_t{n}` 格式，授予時再轉 id）
    const key = `${m.family}_t${m.tierIndex || TIER_INDEX[m.tier] || 1}`;
    legacyMap[key] = (legacyMap[key] || 0) + 1;
  }
  const materials = Object.values(matMap);
  const legacyMaterials = Object.entries(legacyMap).map(([familyTier, qty]) => ({ familyTier, qty }));

  // ② 雜貨：撈到就進倉庫（**不換錢**）。危險度當稀有度 bias。
  const junk = [];
  if (rand() < cfg.junkChance) {
    const pool = junkPoolFor(state.expedition?.families?.length ? state.expedition.families : [state.expedition?.family].filter(Boolean));
    const n = 1 + Math.floor(rand() * cfg.junkMax);
    for (let i = 0; i < n; i++) {
      const j = drawJunk(pool, rand, danger);
      if (j) junk.push({ id: j.id, name: j.name, icon: j.icon, rarity: j.rarity });
    }
  }

  // ③ 基礎報酬（金幣/CAT幣）：雜貨的錢改成賣出時才進帳，這裡只有委託本身的酬金
  const coins = cfg.coinBase;
  const catCoins = cfg.catCoinBase;

  // ④ 公會專屬裝備掉落（品級由危險度加權）。
  //    判定次數：基礎 1 次 ＋ 高命中(A/S) 1 次 ＋ 有首領的委託(danger≥3) 1 次
  //    → 一趟最多 3 次，「射得準」與「敢接難的」都看得到回報。
  const equipDrops = [];
  const rollEquip = () => {
    if (rand() >= Math.min(0.98, cfg.equipChance * lukDrop)) return;
    const archIds = Object.keys(GUILD_EQUIP_ARCHETYPES);
    const archetypeId = archIds[Math.floor(rand() * archIds.length)];
    const gi = Math.min(GRADES.length - 1, Math.floor(rand() * (danger + 1)));
    // 詞綴：**掉落品一律至少 1 條**（商店貨永遠 0 條）——「刷詞綴」是公會的核心循環，
    // 每件都有詞綴才值得一件一件看。危險度越高越容易出第二條。
    //   T1~T2：1 條（25% 兩條）／T3~T4：1 條（50% 兩條）／T5~T6：保證 2 條
    const maxAffix = danger >= 5 ? 2 : 1 + (rand() < (danger >= 3 ? 0.5 : 0.25) ? 1 : 0);
    // ⚠️ 從「還沒抽中的池子」挑，不要抽到重複就放棄——舊寫法會讓該掉兩條的偶爾只掉一條
    const affixes = [];
    const pool = compatibleAffixIds(archetypeId);
    while (affixes.length < maxAffix && pool.length) {
      affixes.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }
    equipDrops.push({ archetypeId, grade: GRADES[gi], affixes });
  };
  rollEquip();
  if (acc.extraRoll) rollEquip();                                          // 射得好，多一次
  if (defeated.some(m => m.encounter && m.encounter !== "normal")) rollEquip(); // 首領委託，多一次

  return {
    won: true, materials, legacyMaterials, junk, equipDrops, coins, catCoins,
    accuracy: { ratio, band: acc.band, label: acc.label, dropMult: acc.dropMult, extraRoll: acc.extraRoll },
  };
}
