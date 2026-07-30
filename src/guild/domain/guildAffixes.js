// src/guild/domain/guildAffixes.js
// 詞綴的挑選與合併。純函數，沒有 Firestore、沒有 UI。
//
// 消費端只有兩處，改動時一起看：
//   rollExpedition  → waveSizeBonus / monsterHpMult / monsterAtkMult / monsterDefMult / monsterSpeedBonus
//   expeditionFlow  → supplyCostMult / roundLimit
//   GuildBattle     → visionDepth（純呈現，不影響規則）
import { CHALLENGE_TIERS, GUILD_AFFIXES, GUILD_AFFIX_MAP } from "../data/guildAffixPool";

// 合併後的預設值＝「什麼都沒改」。消費端一律讀這個形狀，不必逐條判斷詞綴是否存在。
export const NEUTRAL_AFFIX_MODS = Object.freeze({
  monsterHpMult: 1,
  monsterAtkMult: 1,
  monsterDefMult: 1,
  monsterSpeedBonus: 0,
  waveSizeBonus: 0,
  supplyCostMult: 1,
  roundLimit: 0,      // 0 ＝ 不限回合
  visionDepth: 0,     // 0 ＝ 全部看得見
});

// 倍率相乘、加值相加；roundLimit / visionDepth 取「最嚴格」的那個（較小的非 0 值）。
export function mergeAffixMods(affixIds = []) {
  const out = { ...NEUTRAL_AFFIX_MODS };
  for (const id of affixIds) {
    const mods = GUILD_AFFIX_MAP[id]?.mods;
    if (!mods) continue;
    for (const [key, value] of Object.entries(mods)) {
      if (key === "roundLimit" || key === "visionDepth") {
        out[key] = out[key] === 0 ? value : Math.min(out[key], value);
      } else if (key.endsWith("Mult")) {
        out[key] = (out[key] ?? 1) * value;
      } else {
        out[key] = (out[key] ?? 0) + value;
      }
    }
  }
  return out;
}

// 依挑戰層級抽詞綴。同一張委託不重複抽到同一條。
export function rollAffixes(tierId, rand = Math.random) {
  const tier = CHALLENGE_TIERS[tierId];
  if (!tier) return [];
  const pool = GUILD_AFFIXES.map(a => a.id);
  const picked = [];
  while (picked.length < tier.affixCount && picked.length < pool.length) {
    const candidate = pool[Math.floor(rand() * pool.length)];
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}

export function affixesOf(ids = []) {
  return ids.map(id => GUILD_AFFIX_MAP[id]).filter(Boolean);
}

// 挑戰委託的獎勵倍率（一般委託回 1）
export function challengeRewardMult(tierId) {
  const tier = CHALLENGE_TIERS[tierId];
  return { loot: tier?.lootMult || 1, rep: tier?.repMult || 1 };
}

// 給 UI 用的一句話摘要
export function affixSummary(ids = []) {
  const list = affixesOf(ids);
  if (!list.length) return "";
  return list.map(a => `${a.icon}${a.name}`).join("　");
}
