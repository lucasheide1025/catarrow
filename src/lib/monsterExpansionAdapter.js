import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";

export const SOLO_HUNT_FAMILIES = Object.freeze(["ghost", "mountain", "insect", "workplace", "exam", "temple"]);
const TIER_ORDER = Object.freeze(["common", "rare", "elite", "fierce", "boss", "mythic"]);
const TIER_HP_MULTIPLIER = Object.freeze({ common: 0.95, rare: 1, elite: 1.05, fierce: 1.1, boss: 1, mythic: 1.1 });
const FAMILY_ICONS = Object.freeze({ ghost: "👻", mountain: "🏔️", insect: "🦂", workplace: "💼", exam: "📝", temple: "🏰", treasure: "📦" });

export function toLegacyBattleMonster(monster) {
  if (!monster?.id) throw new Error("invalid_expansion_monster");
  return {
    id: monster.id,
    family: monster.family,
    tier: monster.tier,
    tierIndex: monster.tierIndex,
    name: monster.name,
    icon: FAMILY_ICONS[monster.family] || "⚔️",
    hp: monster.hp,
    atk: monster.atk,
    def: monster.def,
    desc: monster.signatureSummary,
    encounter: monster.encounter,
    role: monster.role,
    signatureSkillId: monster.signatureSkillId,
    signatureName: monster.signatureName,
    commonSkillIds: [...monster.commonSkillIds],
    materialId: monster.material.id,
    cardId: monster.card.id,
    artKey: monster.artKey,
    bossTagged: monster.encounter !== "normal",
    expansionVersion: 1,
  };
}

export function getExpansionTierPool(power) {
  if (power >= 400) return TIER_ORDER;
  if (power >= 280) return TIER_ORDER.slice(0, 5);
  if (power >= 180) return TIER_ORDER.slice(0, 4);
  if (power >= 100) return TIER_ORDER.slice(0, 3);
  if (power >= 50) return TIER_ORDER.slice(0, 2);
  return TIER_ORDER.slice(0, 1);
}

// ── 挑戰強度（2026-07-18 方案A：取代隨機變體,玩家進場自選）─────────
// 單一數值來源：怪物強度與掉落全查這張表;UI 直接引用顯示給玩家。
export const SOLO_CHALLENGE_LEVELS = Object.freeze({
  easy:     { id: "easy",     label: "😌 輕鬆", statMult: 0.8, materialQty: 3, coinMult: 0.8, coinChestChance: 0.2, cardChance: 0.12, desc: "怪物 -20%｜素材×3｜金幣×0.8｜金幣寶箱 20%｜掉卡 12%" },
  standard: { id: "standard", label: "⚔️ 標準", statMult: 1.0, materialQty: 5, coinMult: 1.0, coinChestChance: 0.5, cardChance: 0.2,  desc: "怪物原值｜素材×5｜金幣×1.0｜金幣寶箱 50%｜掉卡 20%" },
  hard:     { id: "hard",     label: "🔥 挑戰", statMult: 1.2, materialQty: 7, coinMult: 1.5, coinChestChance: 1.0, cardChance: 0.3,  desc: "怪物 +20%｜素材×7｜金幣×1.5｜金幣寶箱必掉｜掉卡 30%" },
});

// ── 組隊人數加成（使用者規格 2026-07-18）─────────────────────
// 每多一位隊員：怪物強度 +10%（要顯示）;素材 +1、掉卡 +5pp、金幣寶箱 +15pp
export const PARTY_COUNT_BONUS = Object.freeze({
  monsterStatPctPerExtra: 10,
  materialQtyPerExtra: 1,
  cardChancePctPerExtra: 5,
  coinChestChancePctPerExtra: 15,
});

export function getPartyChallengeProfile(levelId, memberCount = 1) {
  const level = SOLO_CHALLENGE_LEVELS[levelId] || SOLO_CHALLENGE_LEVELS.standard;
  const extra = Math.max(0, (memberCount || 1) - 1);
  const monsterBonusPct = extra * PARTY_COUNT_BONUS.monsterStatPctPerExtra;
  return {
    ...level,
    memberCount: memberCount || 1,
    extra,
    monsterBonusPct,
    monsterStatMult: Math.round(level.statMult * (1 + monsterBonusPct / 100) * 100) / 100,
    materialQty: level.materialQty + extra * PARTY_COUNT_BONUS.materialQtyPerExtra,
    cardChance: Math.min(0.6, Math.round((level.cardChance + extra * PARTY_COUNT_BONUS.cardChancePctPerExtra / 100) * 100) / 100),
    coinChestChance: Math.min(1, Math.round((level.coinChestChance + extra * PARTY_COUNT_BONUS.coinChestChancePctPerExtra / 100) * 100) / 100),
  };
}

export function applyChallengeLevel(monster, levelId) {
  const level = SOLO_CHALLENGE_LEVELS[levelId] || SOLO_CHALLENGE_LEVELS.standard;
  return {
    ...monster,
    challengeLevel: level.id,
    hp: Math.round(monster.hp * level.statMult),
    atk: Math.round(monster.atk * level.statMult),
    def: Math.round(monster.def * level.statMult),
  };
}

function selectVariant() {
  // 方案A：抽怪不再隨機貼弱化/強悍,強度改由玩家進場自選（applyChallengeLevel）
  return "normal";
}

export function applySoloVariant(monster, variant, roll) {
  const ranges = {
    weak: [[0.78, 0.92], [0.78, 0.92], [0.78, 0.92]],
    strong: [[1.15, 1.4], [1.1, 1.3], [1.1, 1.3]],
  };
  const range = ranges[variant];
  const multipliers = range
    ? range.map(([low, high]) => low + (high - low) * roll)
    : [1, 1, 1];
  return {
    ...monster,
    variant,
    hp: Math.round(monster.hp * (TIER_HP_MULTIPLIER[monster.tier] || 1) * multipliers[0]),
    atk: Math.round(monster.atk * multipliers[1]),
    def: Math.round(monster.def * multipliers[2]),
  };
}

export function drawExpansionSoloMonsters(power, { random = Math.random, families = SOLO_HUNT_FAMILIES } = {}) {
  const tierPool = getExpansionTierPool(power);
  return families.map(family => {
    const candidates = EXPANSION_MONSTERS.filter(monster =>
      monster.family === family && monster.encounter === "normal" && tierPool.includes(monster.tier),
    );
    if (!candidates.length) return null;
    const selected = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    const variant = selectVariant(power, random());
    return applySoloVariant(toLegacyBattleMonster(selected), variant, random());
  }).filter(Boolean);
}
