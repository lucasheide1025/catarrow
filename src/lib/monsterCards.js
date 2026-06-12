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
};

// 階級 → 1★基礎值 & 每升一星追加值
export const TIER_CARD_BONUS = {
  common:  { base: 1,  perStar: 1, label: "普通", color: "#94a3b8", bg: "#f1f5f9" },
  rare:    { base: 2,  perStar: 1, label: "稀有", color: "#3b82f6", bg: "#eff6ff" },
  elite:   { base: 3,  perStar: 1, label: "精英", color: "#a855f7", bg: "#faf5ff" },
  fierce:  { base: 5,  perStar: 1, label: "兇猛", color: "#f97316", bg: "#fff7ed" },
  boss:    { base: 8,  perStar: 2, label: "首領", color: "#ef4444", bg: "#fef2f2" },
  mythic:  { base: 12, perStar: 2, label: "神話", color: "#f59e0b", bg: "#fffbeb" },
};

// 升星所需重複張數 (index 0 = 1★→2★)
export const STAR_UPGRADE_COST = [1, 2, 3, 4, 5];

export const MAX_EQUIPPED_CARDS = 5;

// 計算某星級的加成數值
export function calcCardBonus(tier, stars) {
  const cfg = TIER_CARD_BONUS[tier] || TIER_CARD_BONUS.common;
  return cfg.base + (Math.max(1, stars || 1) - 1) * cfg.perStar;
}

// 計算已裝備卡片的合計加成 { hp, atk, def }
export function calcEquippedBonus(equippedCards = []) {
  const bonus = { hp: 0, atk: 0, def: 0 };
  for (const card of equippedCards) {
    const stat = card.chosenStat || FAMILY_STAT[card.family] || "atk";
    bonus[stat] = (bonus[stat] || 0) + calcCardBonus(card.tier, card.stars || 1);
  }
  return bonus;
}

// 判斷是否可以升星
export function canUpgradeStar(stars, duplicates) {
  if ((stars || 1) >= 5) return false;
  return (duplicates || 0) >= STAR_UPGRADE_COST[(stars || 1) - 1];
}

// 升星費用
export function getUpgradeCost(stars) {
  return STAR_UPGRADE_COST[(stars || 1) - 1] ?? 99;
}

// 取得卡片加成的屬性（mythic 依 chosenStat）
export function getCardStat(card) {
  if (card?.tier === "mythic" && card?.chosenStat) return card.chosenStat;
  return FAMILY_STAT[card?.family] || "atk";
}

// 屬性顯示標籤
export function getStatLabel(stat) {
  return { hp: "HP ❤️", atk: "ATK ⚔️", def: "DEF 🛡️" }[stat] || stat;
}
