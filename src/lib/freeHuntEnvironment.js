import { RAID_FACES, faceMultiplier, raidFaceLabel, maxArrowsPerFace } from "../worldboss/domain/raidFaces";
import { RAID_DISTANCES, distanceMultiplier, rangeMultiplier, rangeLabel } from "../worldboss/domain/raidRange";

export const FREE_HUNT_FACES = RAID_FACES;
export const FREE_HUNT_DISTANCES = RAID_DISTANCES;

export const FREE_HUNT_BOW_MULTIPLIERS = Object.freeze({
  recurve_bare: 1,
  recurve_full: 1,
  compound: 1,
  traditional: 2,
});

const FREE_HUNT_BOW_LABELS = Object.freeze({
  recurve_bare: "裸弓",
  recurve_full: "反曲弓",
  compound: "獵弓／複合弓",
  traditional: "傳統弓",
});

export function freeHuntBowMultiplier(bowType) {
  return FREE_HUNT_BOW_MULTIPLIERS[bowType] || 1;
}

export function getFreeHuntEnvironment({ distanceM, targetFmt, bowType } = {}) {
  const environmentMult = rangeMultiplier({ distanceM, targetFmt });
  const bowMult = freeHuntBowMultiplier(bowType);
  const multiplier = environmentMult * bowMult;
  return {
    distanceM: Number(distanceM),
    targetFmt,
    bowType: bowType || null,
    bowLabel: FREE_HUNT_BOW_LABELS[bowType] || "其他弓種",
    faceLabel: raidFaceLabel(targetFmt),
    distanceMult: distanceMultiplier(distanceM),
    faceMult: faceMultiplier(targetFmt),
    faceCap: maxArrowsPerFace(targetFmt),
    environmentMult,
    bowMult,
    multiplier,
    label: rangeLabel(multiplier),
  };
}

export function getPartyMemberFreeHuntEnvironment(member = {}, room = {}, bowTypeOverride = null) {
  const distanceM = Number(member?.huntDistanceM ?? room?.huntDistanceM ?? room?.distance ?? 5) || 5;
  const targetFmt = member?.huntTargetFmt || room?.huntTargetFmt || room?.targetFormat || "half_17";
  const bowType = bowTypeOverride || member?.bowType || "recurve_bare";
  return getFreeHuntEnvironment({ distanceM, targetFmt, bowType });
}

export function applyFreeHuntFaceCap(arrows = [], faceCap = null) {
  const cap = Number(faceCap);
  const hasCap = Number.isFinite(cap) && cap > 0;
  const counts = new Map();
  return (arrows || []).map(arrow => {
    const base = arrow && typeof arrow === "object" ? arrow : { score: arrow, label: String(arrow ?? "") };
    const faceIndex = Math.max(0, Math.floor(Number(base.faceIndex) || 0));
    if (!hasCap) return { ...base, faceIndex, overFaceCap: false };
    const used = counts.get(faceIndex) || 0;
    counts.set(faceIndex, used + 1);
    return { ...base, faceIndex, overFaceCap: used >= cap };
  });
}
