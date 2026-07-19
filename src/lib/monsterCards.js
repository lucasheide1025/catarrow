// src/lib/monsterCards.js
// 怪物卡片系統：收集、升星、裝備加成

// 族 → 加成屬性
export const FAMILY_STAT = {
  ghost:     "atk",
  mountain:  "def",
  insect:    "hp",
  workplace: "atk",
  exam:      "def",
  temple:    "hp",
  treasure:  "atk",
};

// 貓貓分組 → 加成屬性（世界王貓貓卡用）
export const CAT_GROUP_STAT = { atk: "atk", def: "def", heal: "hp" };

// 階級 → 1★基礎值 & 每升一星追加值
export const TIER_CARD_BONUS = {
  common:    { base: 1,  perStar: 1, label: "普通",   color: "#94a3b8", bg: "#f1f5f9" },
  rare:      { base: 2,  perStar: 1, label: "稀有",   color: "#3b82f6", bg: "#eff6ff" },
  elite:     { base: 3,  perStar: 1, label: "精英",   color: "#a855f7", bg: "#faf5ff" },
  fierce:    { base: 5,  perStar: 1, label: "兇猛",   color: "#f97316", bg: "#fff7ed" },
  boss:      { base: 8,  perStar: 2, label: "首領",   color: "#ef4444", bg: "#fef2f2" },
  mythic:    { base: 12, perStar: 2, label: "神話",   color: "#f59e0b", bg: "#fffbeb" },
  worldboss: { base: 25, perStar: 0, label: "世界王", color: "#facc15", bg: "#fffbeb" },
};

// 升星所需重複張數 (index 0 = 1★→2★)
export const STAR_UPGRADE_COST = [1, 2, 3, 4, 5];

// 2026-07-19 使用者拍板：改回依屬性分槽，HP 5 張、ATK/DEF 各 3 張，四個區塊各自獨立。
export const MAX_EQUIPPED_BY_STAT = Object.freeze({ hp: 5, atk: 3, def: 3 });
export function maxEquippedForStat(stat) {
  return MAX_EQUIPPED_BY_STAT[stat] ?? 3;
}
// 舊常數保留避免外部引用炸掉；總量＝各槽相加（5+3+3）
export const MAX_EQUIPPED_PER_STAT = 3;
export const MAX_MONSTER_EQUIPPED =
  MAX_EQUIPPED_BY_STAT.hp + MAX_EQUIPPED_BY_STAT.atk + MAX_EQUIPPED_BY_STAT.def;
// 世界王卡：獨立的裝備欄位，最多 3 張（不分屬性，跟怪物卡的 9 格完全分開算）
export const MAX_WB_EQUIPPED = 3;

// 世界王卡被動效果：同分類每張額外加成，封頂 3 張
export const WB_PASSIVE_PCT_PER_CARD = 0.03;

// 計算某星級的加成數值（worldboss 固定值，忽略星級）
export function calcCardBonus(tier, stars) {
  const cfg = TIER_CARD_BONUS[tier] || TIER_CARD_BONUS.common;
  if (tier === "worldboss") return cfg.base;
  return cfg.base + (Math.max(1, stars || 1) - 1) * cfg.perStar;
}

// 解析 cardCollection（{cards, wbCards, equipped}）→ 已裝備卡片物件陣列
// 相容舊格式（equipped 為字串陣列，全部視為怪物卡）與新格式（{key,source}）
export function resolveEquippedCards(collection = {}) {
  const { cards = {}, wbCards = {}, equipped = [] } = collection;
  return equipped.map(item => {
    if (typeof item === "string") return cards[item];
    const { key, source } = item || {};
    return source === "wb" ? wbCards[key] : cards[key];
  }).filter(Boolean);
}

// 計算已裝備卡片的合計加成 { hp, atk, def, dmgBonusPct, dmgReducePct, healBonusPct }
// equippedCards: 已解析好的卡片物件陣列（monster卡 + wb卡混合皆可，各自帶 tier/family/stat/chosenStat）
export function calcEquippedBonus(equippedCards = []) {
  const bonus = {
    hp: 0, atk: 0, def: 0, dmgBonusPct: 0, dmgReducePct: 0, healBonusPct: 0,
    // 族系剋制（2026-07-19 新增）：對特定族系的加傷／減傷，皆為百分比。
    // 形如 { ghost: 12 } 代表對鬼怪族 +12% 傷害 / 承受鬼怪族傷害 -12%。
    familyDamageBonusPct: {},
    familyDamageReducePct: {},
  };
  for (const card of equippedCards) {
    if (!card) continue;
    const stat = getCardStat(card);
    bonus[stat] = (bonus[stat] || 0) + calcCardBonus(card.tier, card.stars || 1);
    if (card.tier === "worldboss") {
      if (stat === "atk") bonus.dmgBonusPct  += WB_PASSIVE_PCT_PER_CARD;
      if (stat === "def") bonus.dmgReducePct += WB_PASSIVE_PCT_PER_CARD;
      if (stat === "hp")  bonus.healBonusPct += WB_PASSIVE_PCT_PER_CARD;
    }
    // 剋制效果寫在卡片資料上（不隨玩家選擇改變），星級會放大
    const slayer = getCardSlayerEffect(card);
    if (slayer) {
      const target = slayer.targetFamily;
      const key = slayer.mode === "reduce" ? "familyDamageReducePct" : "familyDamageBonusPct";
      bonus[key][target] = (bonus[key][target] || 0) + slayer.pct;
    }
  }
  return bonus;
}

// 族系剋制加成：每星 +2%，基礎依卡片稀有度。
// 卡片資料需帶 slayer: { targetFamily, mode: "bonus" | "reduce" }；沒有就不是剋制卡。
export const SLAYER_BASE_PCT = Object.freeze({
  common: 3, rare: 5, elite: 7, fierce: 9, boss: 12, mythic: 15, worldboss: 15,
});
export const SLAYER_PCT_PER_STAR = 2;

// ── 族系相剋循環（2026-07-19 使用者拍板：用現有卡片做，不另外發新卡）──────
// 七族連成一個環，每族剋下一族：
//   西方怪物 → 鬼怪 → 考試 → 職場 → 寶藏 → 毒蟲 → 山林 →（回到西方怪物）
// 卡片是「加傷」還是「減傷」由它本來的屬性決定，不另外存資料：
//   ATK 卡 → 對「它剋的那一族」加傷（進攻型）
//   HP/DEF 卡 → 對「剋它的那一族」減傷（防禦型，抵抗天敵）
// 這樣 252 張卡不用改任何資料就全部有剋制效果，而且效果可從卡面直接推理出來。
export const SLAYER_CYCLE = Object.freeze([
  "temple", "ghost", "exam", "workplace", "treasure", "insect", "mountain",
]);

function cycleNeighbor(family, step) {
  const index = SLAYER_CYCLE.indexOf(family);
  if (index < 0) return null;
  const size = SLAYER_CYCLE.length;
  return SLAYER_CYCLE[(index + step + size) % size];
}

// 這一族剋誰
export function familyPreysOn(family) { return cycleNeighbor(family, 1); }
// 誰剋這一族（天敵）
export function familyPreyedBy(family) { return cycleNeighbor(family, -1); }

export function getCardSlayerEffect(card) {
  if (!card) return null;
  const base = SLAYER_BASE_PCT[card.tier] ?? SLAYER_BASE_PCT.common;
  const stars = Math.max(1, card.stars || 1);
  const pct = base + (stars - 1) * SLAYER_PCT_PER_STAR;

  // 卡片資料若明確寫了 slayer 就以它為準（保留未來做特殊卡的空間）
  const explicit = card.slayer;
  if (explicit?.targetFamily) {
    return { targetFamily: explicit.targetFamily, mode: explicit.mode === "reduce" ? "reduce" : "bonus", pct };
  }

  // 世界王卡不參與族系相剋（它們本來就有自己的被動加成）
  if (card.tier === "worldboss") return null;

  const stat = getCardStat(card);
  const targetFamily = stat === "atk" ? familyPreysOn(card.family) : familyPreyedBy(card.family);
  if (!targetFamily) return null;
  return { targetFamily, mode: stat === "atk" ? "bonus" : "reduce", pct };
}

// 依「本場怪物族系」把卡片加成攤平成戰鬥端直接可用的百分比。
// 注意單位：familyDamage*Pct 是整數百分比（12 = 12%），而 dmgBonusPct/dmgReducePct
// 是小數（0.03 = 3%，世界王卡被動），所以族系那份要除以 100 才能相加。
export const MAX_DAMAGE_REDUCE_PCT = 0.8; // 減傷封頂，避免堆到完全免疫

export function resolveBattleBonus(bonus, monsterFamily) {
  const family = resolveFamilyModifiers(bonus, monsterFamily);
  return {
    dmgBonusPct: (bonus?.dmgBonusPct || 0) + family.damageBonusPct / 100,
    dmgReducePct: Math.min(
      MAX_DAMAGE_REDUCE_PCT,
      (bonus?.dmgReducePct || 0) + family.damageReducePct / 100,
    ),
    healBonusPct: bonus?.healBonusPct || 0,
  };
}

// 依「本場怪物族系」把剋制加成攤平成單一數字，供戰鬥端直接使用
export function resolveFamilyModifiers(bonus, monsterFamily) {
  if (!monsterFamily) return { damageBonusPct: 0, damageReducePct: 0 };
  return {
    damageBonusPct: bonus?.familyDamageBonusPct?.[monsterFamily] || 0,
    damageReducePct: bonus?.familyDamageReducePct?.[monsterFamily] || 0,
  };
}

// 判斷是否可以升星（世界王卡不可升星）
export function canUpgradeStar(stars, duplicates, tier) {
  if (tier === "worldboss") return false;
  if ((stars || 1) >= 5) return false;
  return (duplicates || 0) >= STAR_UPGRADE_COST[(stars || 1) - 1];
}

// 升星費用
export function getUpgradeCost(stars) {
  return STAR_UPGRADE_COST[(stars || 1) - 1] ?? 99;
}

// 取得卡片加成的屬性。
// 2026-07-19 使用者拍板：移除「自選屬性」，一律用卡片本身寫死的屬性
// （世界王卡看 card.stat，其餘看族系對映）。舊資料殘留的 chosenStat 一律忽略，
// 不再影響數值——這樣同一張卡在任何玩家身上效果都相同，方便平衡與說明。
export function getCardStat(card) {
  if (card?.tier === "worldboss" && card?.stat) return card.stat;
  return FAMILY_STAT[card?.family] || "atk";
}

// 屬性顯示標籤
export function getStatLabel(stat) {
  return { hp: "HP ❤️", atk: "ATK ⚔️", def: "DEF 🛡️" }[stat] || stat;
}
