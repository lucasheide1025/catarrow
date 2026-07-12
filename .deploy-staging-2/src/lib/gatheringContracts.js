import {
  COUNCIL_BUILDINGS,
  COUNCIL_MONSTERS,
  LIFE_TIER_STATS,
  TIER_META,
  TIER_ORDER,
} from "./councilMonsters";

export const GATHERING_CHECKPOINT_MULTIPLIERS = [1, 1.35, 1.8];
export const GATHERING_TEAM_ROLES = ["gatherer", "support", "guard"];

const CHECKPOINT_LABELS = [
  { title: "外圍作業", progressScale: 0.55, fatigueScale: 0.8 },
  { title: "深入處理", progressScale: 0.75, fatigueScale: 1 },
  { title: "核心收尾", progressScale: 1, fatigueScale: 1.15 },
];

export function getGatheringTierOptions(availableTiers = []) {
  const allowed = new Set(availableTiers);
  return TIER_ORDER.filter(tier => allowed.has(tier) && TIER_META[tier]);
}

export function buildGatheringContract({
  buildingId,
  tier,
  distance = 18,
  targetFmt = "standard",
  seed = Date.now(),
}) {
  const building = COUNCIL_BUILDINGS.find(item => item.id === buildingId);
  const obstacle = COUNCIL_MONSTERS[buildingId]?.[tier];
  const stats = LIFE_TIER_STATS[tier];
  if (!building || !obstacle || !stats) {
    throw new Error("無法建立採集委託：建築或難度不存在");
  }

  const normalizedSeed = String(seed);
  return {
    version: 1,
    id: `${buildingId}_${tier}_${normalizedSeed}`,
    buildingId,
    buildingName: building.name,
    race: building.race,
    raceLabel: building.raceLabel,
    tier,
    tierLabel: TIER_META[tier].label,
    distance: Number(distance),
    targetFmt,
    checkpoints: CHECKPOINT_LABELS.map((checkpoint, index) => ({
      index,
      title: checkpoint.title,
      name: `${checkpoint.title}・${obstacle.name}`,
      action: obstacle.action,
      emoji: obstacle.emoji,
      progressRequired: Math.max(1, Math.round(stats.hp * checkpoint.progressScale)),
      resistance: stats.def,
      fatigue: Math.max(1, Math.round(stats.atk * checkpoint.fatigueScale)),
      rewardMultiplier: GATHERING_CHECKPOINT_MULTIPLIERS[index],
    })),
  };
}

export function getGatheringRewardMultiplier(checkpointsCleared) {
  const index = Math.max(0, Math.min(3, Number(checkpointsCleared) || 0)) - 1;
  return index >= 0 ? GATHERING_CHECKPOINT_MULTIPLIERS[index] : 0;
}

export function createTeamGatheringState({ contract, hostId, members = {} }) {
  if (!contract?.version || !Array.isArray(contract.checkpoints) || !hostId) {
    throw new Error("無法建立組隊採集狀態：委託或房主資料不完整");
  }
  const normalizedMembers = Object.fromEntries(
    Object.entries(members).map(([id, member]) => [
      id,
      {
        name: member?.name || "射手",
        role: GATHERING_TEAM_ROLES.includes(member?.role) ? member.role : "gatherer",
        ready: false,
        connected: true,
        contribution: 0,
      },
    ]),
  );
  return {
    version: 1,
    mode: "team_gathering",
    hostId,
    status: "waiting",
    contract,
    members: normalizedMembers,
    checkpointIndex: 0,
    sharedProgress: 0,
    sharedFatigue: 0,
    round: 1,
    submissions: {},
    result: null,
    resultClaims: {},
  };
}
