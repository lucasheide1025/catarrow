import { getBuildingStage, getResourceKey } from "./villageData";

export const GATHERING_ROUNDS = 3;
export const GATHERING_ARROWS_PER_ROUND = 6;

export const GATHERING_TIERS = ["common", "rare", "elite", "fierce", "boss", "mythic"];

export const GATHERING_TIER_META = {
  common: { no: 1, label: "T1 基礎", color: "#64748b", catXP: 40, bond: 1 },
  rare: { no: 2, label: "T2 進階", color: "#2563eb", catXP: 65, bond: 1 },
  elite: { no: 3, label: "T3 菁英", color: "#7c3aed", catXP: 95, bond: 2 },
  fierce: { no: 4, label: "T4 兇猛", color: "#ea580c", catXP: 135, bond: 2 },
  boss: { no: 5, label: "T5 首領", color: "#dc2626", catXP: 185, bond: 3 },
  mythic: { no: 6, label: "T6 神話", color: "#db2777", catXP: 250, bond: 4 },
};

export const GATHERING_SITES = [
  {
    id: "mine",
    name: "星屑礦坑",
    buildingName: "礦坑",
    icon: "⛏️",
    race: "mountain",
    raceName: "山岳族",
    resource: "ore",
    resourceName: "礦石",
    palette: ["#111827", "#374151", "#f97316"],
    flavor: "用定點射擊敲開礦脈，帶回山岳族素材與礦石。",
  },
  {
    id: "farm",
    name: "月芽農田",
    buildingName: "農田",
    icon: "🌿",
    race: "insect",
    raceName: "昆蟲族",
    resource: "melon",
    resourceName: "瓜果",
    palette: ["#052e16", "#15803d", "#bef264"],
    flavor: "射落作物上的害蟲與果實，收集昆蟲族素材與瓜果。",
  },
  {
    id: "harbor",
    name: "霧潮港口",
    buildingName: "港口",
    icon: "🐟",
    race: "ghost",
    raceName: "幽靈族",
    resource: "fish",
    resourceName: "鮮魚",
    palette: ["#082f49", "#0369a1", "#67e8f9"],
    flavor: "瞄準浪花與漂流物，撈起幽靈族素材與鮮魚。",
  },
  {
    id: "hunting",
    name: "巡林狩獵場",
    buildingName: "狩獵場",
    icon: "🏹",
    race: "workplace",
    raceName: "職場族",
    resource: "meat",
    resourceName: "獸肉",
    palette: ["#1a2e05", "#4d7c0f", "#facc15"],
    flavor: "用連射推進巡林路線，帶回職場族素材與獸肉。",
  },
  {
    id: "market",
    name: "喧鬧市集",
    buildingName: "市集",
    icon: "🧺",
    race: "exam",
    raceName: "考試族",
    resource: "driedfish",
    resourceName: "小魚乾",
    palette: ["#431407", "#c2410c", "#fde68a"],
    flavor: "替攤販完成精準射擊委託，換取考試族素材與小魚乾。",
  },
  {
    id: "warehouse",
    name: "古罐倉庫",
    buildingName: "倉庫",
    icon: "🥫",
    race: "temple",
    raceName: "神殿族",
    resource: "can",
    resourceName: "罐頭",
    palette: ["#312e81", "#6d28d9", "#f0abfc"],
    flavor: "射開封存箱與標籤鎖，整理神殿族素材與罐頭。",
  },
];

export const GATHERING_SITE_MAP = Object.fromEntries(GATHERING_SITES.map(site => [site.id, site]));

const SCORE_PROGRESS = {
  X: 30,
  "10": 25,
  "9": 20,
  "8": 16,
  "7": 13,
  "6": 10,
  "5": 8,
  "4": 7,
  "3": 6,
  "2": 5,
  "1": 3,
  M: 0,
  "0": 0,
};

export function getGatheringTierNumber(tier) {
  return GATHERING_TIER_META[tier]?.no || 1;
}

export function getUnlockedGatheringTiers(buildingLevel = 1) {
  const stage = Math.max(1, Math.min(5, getBuildingStage(buildingLevel || 1)));
  return GATHERING_TIERS.slice(0, stage);
}

export function scoreToGatheringProgress(label) {
  return SCORE_PROGRESS[String(label)] ?? 0;
}

export function getGatheringCompletion(progressPct) {
  if (progressPct >= 180) return { key: "great", label: "大豐收", multiplier: 1.5, rareRolls: 2 };
  if (progressPct >= 130) return { key: "harvest", label: "豐收", multiplier: 1.25, rareRolls: 1 };
  if (progressPct >= 100) return { key: "complete", label: "完成", multiplier: 1, rareRolls: 0 };
  if (progressPct >= 50) return { key: "partial", label: "半成品", multiplier: 0.65, rareRolls: 0 };
  return { key: "comfort", label: "安慰獎", multiplier: 0.35, rareRolls: 0 };
}

export function buildGatheringRunContract({ buildingId, tier, buildingLevel = 1, seed = Date.now() }) {
  const site = GATHERING_SITE_MAP[buildingId] || GATHERING_SITES[0];
  const unlocked = getUnlockedGatheringTiers(buildingLevel);
  const resolvedTier = unlocked.includes(tier) ? tier : unlocked[unlocked.length - 1];
  const tierMeta = GATHERING_TIER_META[resolvedTier] || GATHERING_TIER_META.common;
  return {
    id: `gather_${site.id}_${resolvedTier}_${seed}`,
    version: 2,
    site,
    tier: resolvedTier,
    tierNo: tierMeta.no,
    rounds: GATHERING_ROUNDS,
    arrowsPerRound: GATHERING_ARROWS_PER_ROUND,
    targetProgress: 100,
  };
}

export function calculateGatheringRound(arrows) {
  const labels = Array.isArray(arrows) ? arrows : [];
  const progress = labels.reduce((sum, label) => sum + scoreToGatheringProgress(label), 0);
  const score = labels.reduce((sum, label) => sum + (label === "X" ? 10 : Number(label) || 0), 0);
  const xCount = labels.filter(label => label === "X").length;
  return { progress, score, xCount };
}

function makeRareRewards({ site, tierNo, completion, xCount }) {
  const rewards = [];
  if (completion.rareRolls <= 0) return rewards;

  rewards.push({
    type: "villageResource",
    resourceKey: getResourceKey("fur", Math.min(5, Math.max(1, tierNo))),
    name: "陪練貓毛",
    count: completion.rareRolls,
  });

  if (tierNo >= 3 || xCount >= 4) {
    rewards.push({
      type: "villageResource",
      resourceKey: getResourceKey("potion", Math.min(5, Math.max(1, tierNo - 1))),
      name: "貓草藥水材料",
      count: 1,
    });
  }

  if (completion.key === "great" && tierNo >= 4) {
    rewards.push({
      type: "material",
      materialId: `${site.race}_m${Math.min(6, tierNo + 1)}`,
      name: "高階怪物素材",
      count: 1,
    });
  }

  if (completion.key === "great" && xCount >= 5) {
    rewards.push({
      type: "gachaCoins",
      name: "扭蛋幣",
      count: 1,
    });
  }

  return rewards;
}

export function getGatheringPartyBonus(partySize = 1) {
  const size = Math.max(1, Math.min(4, Math.round(Number(partySize) || 1)));
  if (size >= 4) return { partySize: size, materialMult: 1.10, catXPMult: 1.20, bondBonus: 1, rareBonus: 1 };
  if (size >= 3) return { partySize: size, materialMult: 1.08, catXPMult: 1.15, bondBonus: 0, rareBonus: 1 };
  if (size >= 2) return { partySize: size, materialMult: 1.05, catXPMult: 1.10, bondBonus: 0, rareBonus: 0 };
  return { partySize: 1, materialMult: 1, catXPMult: 1, bondBonus: 0, rareBonus: 0 };
}

export function calculateGatheringRewards({ contract, rounds, partySize = 1 }) {
  const safeRounds = Array.isArray(rounds) ? rounds : [];
  const totalProgress = safeRounds.reduce((sum, round) => sum + (round.progress || 0), 0);
  const totalScore = safeRounds.reduce((sum, round) => sum + (round.score || 0), 0);
  const xCount = safeRounds.reduce((sum, round) => sum + (round.xCount || 0), 0);
  const progressPct = Math.max(0, Math.round(totalProgress));
  const completion = getGatheringCompletion(progressPct);
  const site = contract.site;
  const tierNo = contract.tierNo || getGatheringTierNumber(contract.tier);
  const multiplier = completion.multiplier;
  const partyBonus = getGatheringPartyBonus(partySize);

  // 採集定位（2026-07-11 調整）：大量貓貓 XP、較多羈絆、大幅提高貓貓村材料。
  // 怪物素材（materialCount）維持原樣——升級裝備的素材沿用打怪/地下城，採集不灌它。
  const VILLAGE_MAT_BOOST = 3;   // 貓貓村材料（村資源）大幅 ×3
  const CAT_XP_BOOST = 1.6;      // 貓貓 XP 大量 ×1.6
  const CAT_BOND_BOOST = 1.5;    // 貓貓羈絆 較多 ×1.5
  const materialCount = Math.max(1, Math.round((2 + tierNo * 2) * multiplier * partyBonus.materialMult));
  const villageCount = Math.max(1, Math.round((1 + tierNo) * multiplier * VILLAGE_MAT_BOOST));
  const catXP = Math.max(1, Math.round((GATHERING_TIER_META[contract.tier]?.catXP || 40) * multiplier * partyBonus.catXPMult * CAT_XP_BOOST));
  const bondBase = GATHERING_TIER_META[contract.tier]?.bond || 1;
  const catBond = Math.max(1, Math.round(bondBase * CAT_BOND_BOOST * (progressPct >= 180 ? 1.35 : progressPct >= 130 ? 1.15 : 1)) + partyBonus.bondBonus);

  const rewards = {
    progressPct,
    totalScore,
    xCount,
    completion,
    materialId: `${site.race}_m${Math.min(6, tierNo)}`,
    materialName: `${site.raceName} T${tierNo}素材`,
    materialCount,
    villageResources: {
      [getResourceKey(site.resource, Math.min(5, tierNo))]: villageCount,
    },
    villageResourceName: `${site.resourceName} T${Math.min(5, tierNo)}`,
    catXP,
    catBond,
    partySize: partyBonus.partySize,
    partyBonus,
    rareRewards: makeRareRewards({ site, tierNo, completion, xCount }),
  };

  return rewards;
}
