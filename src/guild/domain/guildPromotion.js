import { GUILD_RANKS, rankIndexOf } from "./guildRank";
import { normalizeGuildProfile } from "./guildRewards";

const trial = (targetRankId, family, familyLabel, waves) => {
  const target = GUILD_RANKS.find(r => r.id === targetRankId);
  return Object.freeze({
    id: `promotion-${targetRankId}`,
    isPromotion: true,
    targetRankId,
    title: `${target.name}晉階試煉`,
    story: `公會長指定你討伐一支${familyLabel}族編隊，證明你足以佩戴${target.name}徽章。`,
    danger: target.maxDanger,
    family,
    families: [family],
    familyLabel,
    familyIcon: "⚔️",
    skulls: `☠️×${target.maxDanger}`,
    waves: waves.length,
    fixedWaves: waves,
  });
};

export const PROMOTION_TRIALS = Object.freeze({
  bronze: trial("bronze", "ghost", "鬼怪", [
    ["ghost_t2_normal_a", "ghost_t2_normal_b"],
    ["ghost_t2_normal_a", "ghost_t2_mini_a"],
    ["ghost_t2_normal_b", "ghost_t2_boss"],
  ]),
  silver: trial("silver", "mountain", "山林", [
    ["mountain_t3_normal_a", "mountain_t3_normal_b"],
    ["mountain_t3_normal_a", "mountain_t3_mini_a"],
    ["mountain_t3_normal_b", "mountain_t3_mini_b"],
    ["mountain_t3_normal_a", "mountain_t3_boss"],
  ]),
  gold: trial("gold", "insect", "毒蟲", [
    ["insect_t4_normal_a", "insect_t4_normal_b"],
    ["insect_t4_normal_a", "insect_t4_mini_a"],
    ["insect_t4_normal_b", "insect_t4_mini_b"],
    ["insect_t4_mini_a", "insect_t4_boss"],
  ]),
  platinum: trial("platinum", "temple", "神殿", [
    ["temple_t5_normal_a", "temple_t5_normal_b"],
    ["temple_t5_normal_a", "temple_t5_mini_a"],
    ["temple_t5_normal_b", "temple_t5_mini_b"],
    ["temple_t5_mini_a", "temple_t5_mini_b"],
    ["temple_t5_normal_a", "temple_t5_boss"],
  ]),
  legend: trial("legend", "exam", "考試", [
    ["exam_t6_normal_a", "exam_t6_normal_b", "exam_t6_normal_a"],
    ["exam_t6_normal_b", "exam_t6_mini_a", "exam_t6_normal_a"],
    ["exam_t6_mini_a", "exam_t6_mini_b"],
    ["exam_t6_normal_a", "exam_t6_mini_b", "exam_t6_normal_b"],
    ["exam_t6_mini_a", "exam_t6_boss"],
  ]),
});

export function availablePromotionTrial(profile) {
  const p = normalizeGuildProfile(profile);
  const next = GUILD_RANKS[rankIndexOf(p.rankId) + 1];
  return next && p.rep >= next.rep ? PROMOTION_TRIALS[next.id] : null;
}

export function completePromotionTrial(profile, targetRankId) {
  const p = normalizeGuildProfile(profile);
  const next = GUILD_RANKS[rankIndexOf(p.rankId) + 1];
  if (!next || next.id !== targetRankId || p.rep < next.rep) return { ok: false, reason: "尚未符合晉階資格", profile: p };
  return { ok: true, rank: next, profile: { ...p, rankId: next.id } };
}
