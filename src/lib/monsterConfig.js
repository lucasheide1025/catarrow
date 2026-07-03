// src/lib/monsterConfig.js
// 完整怪物設定檔 — 供冒險模式、貓貓村採集地下城、組隊採集等共用

import { drawMaterial, getMaterialDropCount } from "./monsterMaterials";
import { MONSTERS, applyVariant } from "./monsterData";

export { MONSTERS, applyVariant };

// 1. 變體參數
export const VARIANT_CONFIG = {
  weak:   { hp: 0.6, atk: 0.6, def: 0.6, dropMult: 0.7, coinMult: 0.7, cardMult: 0.5, arrowdewMult: 0.6, chestMult: 0.6 },
  normal: { hp: 1.0, atk: 1.0, def: 1.0, dropMult: 1.0, coinMult: 1.0, cardMult: 1.0, arrowdewMult: 1.0, chestMult: 1.0 },
  strong: { hp: 1.5, atk: 1.4, def: 1.4, dropMult: 1.4, coinMult: 1.5, cardMult: 1.5, arrowdewMult: 1.5, chestMult: 1.3 },
  boss:   { hp: 3.0, atk: 2.2, def: 2.0, dropMult: 2.5, coinMult: 3.0, cardMult: 2.0, arrowdewMult: 3.0, chestMult: 2.0 },
};

// 2. Tier 掉落表
export const TIER_DROP_CONFIG = {
  common: {
    coin:       { min: 3,  max: 8 },
    material:   { chance: 0.55, count: 1 },
    card:       { chance: 0.05 },
    arrowdew:   { min: 1,  max: 3 },
    coinChest:  { chance: 0.20, tiers: ["common"] },
  },
  rare: {
    coin:       { min: 6,  max: 15 },
    material:   { chance: 0.65, count: 1 },
    card:       { chance: 0.08 },
    arrowdew:   { min: 2,  max: 5 },
    coinChest:  { chance: 0.25, tiers: ["common", "rare"] },
  },
  elite: {
    coin:       { min: 12, max: 25 },
    material:   { chance: 0.75, count: 2 },
    card:       { chance: 0.12 },
    arrowdew:   { min: 3,  max: 8 },
    coinChest:  { chance: 0.35, tiers: ["common", "rare", "elite"] },
    dungeonItemChance: 0.10,
  },
  fierce: {
    coin:       { min: 20, max: 40 },
    material:   { chance: 0.85, count: 2 },
    card:       { chance: 0.15 },
    arrowdew:   { min: 5,  max: 12 },
    coinChest:  { chance: 0.45, tiers: ["rare", "elite", "fierce"] },
    dungeonItemChance: 0.20,
  },
  boss: {
    coin:       { min: 35, max: 65 },
    material:   { chance: 0.92, count: 3 },
    card:       { chance: 0.20 },
    arrowdew:   { min: 8,  max: 18 },
    coinChest:  { chance: 0.60, tiers: ["elite", "fierce", "boss"] },
    dungeonItemChance: 0.35,
  },
  mythic: {
    coin:       { min: 60, max: 100 },
    material:   { chance: 0.97, count: 3 },
    card:       { chance: 0.25 },
    arrowdew:   { min: 12, max: 28 },
    coinChest:  { chance: 0.80, tiers: ["fierce", "boss", "mythic"] },
    dungeonItemChance: 0.50,
  },
};

// 3. 各怪物專屬掉落
export const MONSTER_SPECIAL_DROPS = {
  ghost_5: [
    { id: "ghost_trophy",      name: "\u9748\u754C\u4EE4\u724C",   icon: "\uD83D\uDCDC", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "ghost_boss_essence", name: "\u738B\u516C\u9748\u529B",   icon: "\u2728", chance: 0.30, qty: 1, rarity: "boss" },
  ],
  ghost_6: [
    { id: "hell_seal",         name: "\u5730\u7344\u5370\u8A18",   icon: "\uD83D\uDD25", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "ghost_mythic_orb",  name: "\u8F2A\u8FF4\u5B9D\u73E0",   icon: "\uD83D\uDD2E", chance: 0.15, qty: 1, rarity: "mythic" },
    { id: "ghost_essence",     name: "\u9670\u754C\u7CBE\u83EF",   icon: "\uD83D\uDC9C", chance: 0.50, qty: 1, rarity: "boss" },
  ],
  mountain_5: [
    { id: "mountain_trophy",   name: "\u5C71\u6797\u738B\u51A0",   icon: "\uD83D\uDC51", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "mountain_boss_fang", name: "\u5DE8\u718A\u7350\u7259",  icon: "\uD83E\uDDB7", chance: 0.40, qty: 1, rarity: "boss" },
  ],
  mountain_6: [
    { id: "dragon_scale",      name: "\u86CB\u9F8D\u9C57\u7247",   icon: "\uD83D\uDEE1\uFE0F", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "mountain_mythic_orb", name: "\u5C71\u6797\u7CBE\u9B44", icon: "\uD83D\uDC9A", chance: 0.50, qty: 1, rarity: "boss" },
    { id: "dragon_tear",       name: "\u86CB\u9F8D\u6DDA\u73E0",   icon: "\uD83D\uDCA7", chance: 0.15, qty: 1, rarity: "mythic" },
  ],
  insect_5: [
    { id: "insect_trophy",     name: "\u5973\u738B\u7D72\u51A0",   icon: "\uD83D\uDC51", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "insect_boss_venom", name: "\u5973\u738B\u6BD2\u6DB2",   icon: "\uD83E\uDDEA", chance: 0.40, qty: 1, rarity: "boss" },
  ],
  insect_6: [
    { id: "insect_mythic_wing", name: "\u87F2\u795E\u4E4B\u7FFC",  icon: "\uD83E\uDD8B", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "insect_essence",    name: "\u842C\u87F2\u7CBE\u83EF",   icon: "\uD83E\uDDEC", chance: 0.50, qty: 1, rarity: "boss" },
    { id: "insect_mythic_orb", name: "\u87F2\u65CF\u6E90\u6838",   icon: "\u269B\uFE0F", chance: 0.15, qty: 1, rarity: "mythic" },
  ],
  workplace_5: [
    { id: "workplace_trophy",   name: "\u5546\u696D\u5951\u7D04",  icon: "\uD83D\uDCC4", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "workplace_boss_gold", name: "\u9EC3\u91D1\u6B0A\u6756", icon: "\uD83C\uDFC6", chance: 0.30, qty: 1, rarity: "boss" },
  ],
  workplace_6: [
    { id: "capital_crown",     name: "\u8CC7\u672C\u7687\u51A0",   icon: "\uD83D\uDC51", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "workplace_essence", name: "\u525D\u524A\u6838\u5FC3",   icon: "\u2699\uFE0F", chance: 0.50, qty: 1, rarity: "boss" },
    { id: "workplace_mythic_orb", name: "\u5236\u5EA6\u672C\u6E90", icon: "\uD83D\uDCDC", chance: 0.15, qty: 1, rarity: "mythic" },
  ],
  exam_5: [
    { id: "exam_trophy",       name: "\u5408\u683C\u8B49\u66F8",   icon: "\uD83D\uDCDC", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "exam_boss_paper",   name: "\u6B77\u5C46\u8A66\u984C",   icon: "\uD83D\uDCDA", chance: 0.40, qty: 1, rarity: "boss" },
  ],
  exam_6: [
    { id: "exam_mythic_scroll", name: "\u7D42\u6975\u89E3\u7B54",  icon: "\uD83D\uDCD6", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "exam_essence",      name: "\u5236\u5EA6\u6838\u5FC3",   icon: "\uD83C\uDCAF", chance: 0.50, qty: 1, rarity: "boss" },
    { id: "exam_mythic_orb",   name: "\u6559\u80B2\u771F\u7406",   icon: "\uD83D\uDCA1", chance: 0.15, qty: 1, rarity: "mythic" },
  ],
  temple_5: [
    { id: "temple_trophy",     name: "\u5DEB\u5996\u6B0A\u6756",   icon: "\uD83E\uDE84", chance: 0.50, qty: 1, rarity: "rare" },
    { id: "temple_boss_soul",  name: "\u4EA1\u9748\u9B42\u77F3",   icon: "\uD83D\uDC8E", chance: 0.40, qty: 1, rarity: "boss" },
  ],
  temple_6: [
    { id: "dragon_heart",      name: "\u9F8D\u4E4B\u5FC3\u81DF",   icon: "\uD83D\uDC9B", chance: 0.35, qty: 1, rarity: "mythic" },
    { id: "temple_essence",    name: "\u9060\u53E4\u9F8D\u529B",   icon: "\uD83D\uDC09", chance: 0.50, qty: 1, rarity: "boss" },
    { id: "temple_mythic_orb", name: "\u4E16\u754C\u4E4B\u6838",   icon: "\uD83C\uDF0D", chance: 0.15, qty: 1, rarity: "mythic" },
  ],
};

// 4. 地下城道具池
export const DUNGEON_ITEM_POOL = {
  ghost:     [ { id: "ghost_crystal",    name: "\u9B3C\u9B45\u6C34\u6676",   icon: "\uD83D\uDCA0", weight: 40, tier: "elite" },
               { id: "ghost_amulet",     name: "\u5F6F\u90AA\u8B77\u7B26",   icon: "\uD83D\uDCFF", weight: 25, tier: "fierce" },
               { id: "ghost_lantern",    name: "\u5F15\u9B42\u71C8",     icon: "\uD83C\uDFEE", weight: 10, tier: "boss" } ],
  mountain:  [ { id: "mountain_herb",    name: "\u9AD8\u5C71\u9748\u8349",   icon: "\uD83C\uDF3F", weight: 40, tier: "elite" },
               { id: "mountain_stone",   name: "\u5C71\u8108\u4E4B\u5FC3",   icon: "\uD83E\uDEA8", weight: 25, tier: "fierce" },
               { id: "mountain_horn",    name: "\u5DE8\u7378\u865F\u89D2",   icon: "\uD83D\uDCEF", weight: 10, tier: "boss" } ],
  insect:    [ { id: "insect_silk",      name: "\u91D1\u87B3\u7D72",     icon: "\uD83E\uDD75", weight: 40, tier: "elite" },
               { id: "insect_stinger",   name: "\u6BD2\u738B\u91DD\u523A",   icon: "\uD83E\uDD82", weight: 25, tier: "fierce" },
               { id: "insect_queen_amber",name: "\u7425\u73C0\u5973\u738B",  icon: "\uD83D\uDFE7", weight: 10, tier: "boss" } ],
  workplace: [ { id: "workplace_bond",   name: "\u516C\u53F8\u503A\u5238",   icon: "\uD83D\uDCC4", weight: 40, tier: "elite" },
               { id: "workplace_key",    name: "\u91D1\u5EAB\u9470\u5319",   icon: "\uD83D\uDD11", weight: 25, tier: "fierce" },
               { id: "workplace_stock",  name: "\u63A7\u80A1\u6B0A\u72C0",   icon: "\uD83D\uDCC8", weight: 10, tier: "boss" } ],
  exam:      [ { id: "exam_note",        name: "\u5B78\u9738\u7B46\u8A18",   icon: "\uD83D\uDCDD", weight: 40, tier: "elite" },
               { id: "exam_compass",     name: "\u6307\u5357\u91DD",     icon: "\uD83E\uDDED", weight: 25, tier: "fierce" },
               { id: "exam_diploma",     name: "\u69AE\u8A89\u535A\u58EB",   icon: "\uD83C\uDF93", weight: 10, tier: "boss" } ],
  temple:    [ { id: "temple_relic",     name: "\u53E4\u8056\u907A\u7269",   icon: "\uD83C\uDFFA", weight: 40, tier: "elite" },
               { id: "temple_crown",     name: "\u8056\u8005\u51A0\u5195",   icon: "\uD83D\uDC51", weight: 25, tier: "fierce" },
               { id: "temple_grail",     name: "\u795E\u8056\u8056\u676F",   icon: "\uD83C\uDFC6", weight: 10, tier: "boss" } ],
};

export const COIN_CHEST_TIER_TABLE = {
  common: ["common"],
  rare:   ["common", "rare"],
  elite:  ["common", "rare", "elite"],
  fierce: ["rare", "elite", "fierce"],
  boss:   ["elite", "fierce", "boss"],
  mythic: ["fierce", "boss", "mythic"],
};

export const COIN_CHEST_TIERS = {
  common: { name: "\u91D1\u5E63\u6728\u5B9D\u7BB1",  icon: "\uD83E\uDEB5", color: "#92400e", min: 20,   max: 50   },
  rare:   { name: "\u91D1\u5E63\u9435\u5B9D\u7BB1",  icon: "\u2699\uFE0F", color: "#b45309", min: 60,   max: 120  },
  elite:  { name: "\u91D1\u5E63\u9280\u5B9D\u7BB1",  icon: "\uD83E\uDD48", color: "#94a3b8", min: 150,  max: 250  },
  fierce: { name: "\u91D1\u5E63\u91D1\u5B9D\u7BB1",  icon: "\uD83E\uDD47", color: "#f59e0b", min: 300,  max: 500  },
  boss:   { name: "\u91D1\u5E63\u5B9D\u77F3\u5B9D\u7BB1", icon: "\uD83D\uDC8E", color: "#818cf8", min: 600,  max: 1000 },
  mythic: { name: "\u91D1\u5E63\u50B3\u8AAA\u5B9D\u7BB1", icon: "\uD83D\uDC51", color: "#a855f7", min: 1200, max: 2000 },
};

// 5. 輔助函式
export function getVariantMultipliers(variant) {
  return VARIANT_CONFIG[variant] || VARIANT_CONFIG.normal;
}

export function getTierDropConfig(tier) {
  return TIER_DROP_CONFIG[tier] || TIER_DROP_CONFIG.common;
}

export function getMonsterVariantStats(monster, variant) {
  const v = getVariantMultipliers(variant);
  return {
    hp:  Math.round((monster.hp  || 100) * v.hp),
    atk: Math.round((monster.atk || 10)  * v.atk),
    def: Math.round((monster.def || 5)   * v.def),
  };
}

export function rollCoinsByConfig(tier, variant) {
  const cfg  = getTierDropConfig(tier);
  const v    = getVariantMultipliers(variant);
  const raw  = cfg.coin.min + Math.floor(Math.random() * (cfg.coin.max - cfg.coin.min + 1));
  return Math.round(raw * v.coinMult);
}

export function rollMaterialsByConfig(monsterId, monsterTier, variant) {
  const cfg  = getTierDropConfig(monsterTier);
  const v    = getVariantMultipliers(variant);
  if (Math.random() > cfg.material.chance * v.dropMult) return [];
  const count = Math.ceil(cfg.material.count * v.dropMult);
  const results = [];
  for (let i = 0; i < count; i++) {
    const mat = drawMaterial(monsterId, monsterTier);
    if (mat) results.push(mat);
  }
  return results;
}

export function rollCardByConfig(tier, variant) {
  const cfg = getTierDropConfig(tier);
  const v   = getVariantMultipliers(variant);
  return Math.random() < cfg.card.chance * v.cardMult;
}

export function rollArrowdewByConfig(tier, variant) {
  const cfg = getTierDropConfig(tier);
  const v   = getVariantMultipliers(variant);
  const raw = cfg.arrowdew.min + Math.floor(Math.random() * (cfg.arrowdew.max - cfg.arrowdew.min + 1));
  return Math.round(raw * v.arrowdewMult);
}

export function rollCoinChestTier(tier) {
  const cfg  = getTierDropConfig(tier);
  const opts = cfg.coinChest.tiers;
  return opts[Math.floor(Math.random() * opts.length)];
}

export function rollCoinChestByConfig(tier, variant) {
  const cfg = getTierDropConfig(tier);
  const v   = getVariantMultipliers(variant);
  if (Math.random() > cfg.coinChest.chance * v.chestMult) return null;
  const chestTier = rollCoinChestTier(tier);
  const info = COIN_CHEST_TIERS[chestTier] || COIN_CHEST_TIERS.common;
  const coins = info.min + Math.floor(Math.random() * (info.max - info.min + 1));
  return { ...info, coins, chestTier };
}

export function rollBossDropsByMonster(monsterId, variant) {
  const drops = MONSTER_SPECIAL_DROPS[monsterId];
  if (!drops || drops.length === 0) return [];
  const v = getVariantMultipliers(variant);
  const results = [];
  for (const drop of drops) {
    if (Math.random() < drop.chance * v.dropMult) {
      results.push({ ...drop });
    }
  }
  return results;
}

export function rollDungeonItem(family, variant) {
  const pool = DUNGEON_ITEM_POOL[family];
  if (!pool || pool.length === 0) return null;
  const v = getVariantMultipliers(variant);
  const totalWeight = pool.reduce((s, item) => s + item.weight, 0);
  let rand = Math.random() * totalWeight;
  let picked = pool[pool.length - 1];
  for (const item of pool) {
    rand -= item.weight;
    if (rand <= 0) { picked = item; break; }
  }
  const tierIdx = { weak: 0, normal: 1, strong: 2, boss: 3 };
  const itemTierIdx = { elite: 1, fierce: 2, boss: 3 };
  const vi = tierIdx[variant] || 1;
  const ii = itemTierIdx[picked.tier] || 1;
  if (vi < ii && Math.random() > 0.3) return null;
  return picked;
}

export function rollFullDropResult(monster, variant, options = {}) {
  const { isDungeon = false, isBoss = false } = options;
  const tier   = monster.tier || "common";
  const coins  = rollCoinsByConfig(tier, variant);
  const materials = rollMaterialsByConfig(monster.id, tier, variant);
  const hasCard   = rollCardByConfig(tier, variant);
  const arrowdew  = rollArrowdewByConfig(tier, variant);
  const coinChest = rollCoinChestByConfig(tier, variant);
  const bossDrops = isBoss ? rollBossDropsByMonster(monster.id, variant) : [];
  const dungeonItem = isDungeon ? rollDungeonItem(monster.family, variant) : null;
  return {
    coins,
    materials,
    monsterCard: hasCard ? { monsterId: monster.id, name: monster.name, icon: monster.icon, tier, family: monster.family } : null,
    arrowdew,
    coinChest,
    bossDrops,
    dungeonItem,
  };
}
