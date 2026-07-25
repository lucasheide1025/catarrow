// src/guild/domain/settleExpedition.js
// ─────────────────────────────────────────────────────────────
// 凱旋回報結算：勝利後 roll 獎勵（通用材料 + 公會雜貨→金幣+CAT幣 + 公會裝掉落）。
// 六維 LUK 影響：dropBonusPct（掉率）、valuationBonusPct（雜貨價值）。
// 純函數；材料用 family_t{n} 格式（授予時再對應主線材料 ID，供打怪/貓村共用）。
// ─────────────────────────────────────────────────────────────
import { GUILD_JUNK, LOOT_BY_DANGER, evaluateJunk } from "../data/guildLootTable";
import { GUILD_EQUIP_ARCHETYPES, GRADES } from "../data/guildEquipCatalog";
import { deriveGuildCombat } from "./guildStats";

const TIER_INDEX = { common: 1, rare: 2, elite: 3, fierce: 4, boss: 5, mythic: 6 };

const EMPTY = { won: false, materials: [], junk: [], equipDrops: [], coins: 0, catCoins: 0 };

export function settleExpedition(state, opts = {}) {
  if (!state || state.status !== "won") return { ...EMPTY };
  const rand = opts.rand || Math.random;
  const d = state.derived || deriveGuildCombat(state.guildStats);
  const danger = state.expedition?.danger || 1;
  const cfg = LOOT_BY_DANGER[danger] || LOOT_BY_DANGER[1];
  const lukDrop = 1 + (d.dropBonusPct || 0);
  const lukVal = 1 + (d.valuationBonusPct || 0);

  // 擊敗的怪（勝利＝全滅所有波）
  const defeated = (state.expedition?.waves || []).flatMap(w => w.monsters || []);

  // ① 通用材料：每隻怪族系有機率掉該族該階材料
  const matMap = {};
  for (const m of defeated) {
    if (rand() < Math.min(0.95, cfg.matChance * lukDrop)) {
      const key = `${m.family}_t${TIER_INDEX[m.tier] || 1}`;
      matMap[key] = (matMap[key] || 0) + 1;
    }
  }
  const materials = Object.entries(matMap).map(([familyTier, qty]) => ({ familyTier, qty }));

  // ② 公會雜貨 + 評估
  const junk = [];
  if (rand() < cfg.junkChance) {
    const n = 1 + Math.floor(rand() * cfg.junkMax);
    for (let i = 0; i < n; i++) junk.push(GUILD_JUNK[Math.floor(rand() * GUILD_JUNK.length)]);
  }
  let coins = cfg.coinBase;
  let catCoins = cfg.catCoinBase;
  for (const j of junk) {
    const ev = evaluateJunk(j, lukVal);
    coins += ev.coins;
    catCoins += ev.catCoins;
  }

  // ③ 公會專屬裝備掉落（品級由危險度加權）
  const equipDrops = [];
  if (rand() < Math.min(0.95, cfg.equipChance * lukDrop)) {
    const archIds = Object.keys(GUILD_EQUIP_ARCHETYPES);
    const archetypeId = archIds[Math.floor(rand() * archIds.length)];
    const gi = Math.min(GRADES.length - 1, Math.floor(rand() * (danger + 2)));
    equipDrops.push({ archetypeId, grade: GRADES[gi] });
  }

  return { won: true, materials, junk, equipDrops, coins, catCoins };
}
