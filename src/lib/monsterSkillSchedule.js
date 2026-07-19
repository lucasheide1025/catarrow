import { COMMON_MONSTER_ABILITIES } from "./monsterAbilityCatalog";

function commonAction(monster, index) {
  const skillId = monster.commonSkillIds?.[index];
  const ability = COMMON_MONSTER_ABILITIES[skillId];
  return ability ? { type: "common", skillId, name: ability.name, enhanced: false } : null;
}

function signatureAction(monster, enhanced = false) {
  if (!monster.signatureSkillId) return null;
  return { type: "signature", skillId: monster.signatureSkillId, name: monster.signatureName, summary: monster.signatureSummary, counterSummary: monster.counterSummary, enhanced };
}

export function getMonsterScheduledAbility(monster, round) {
  if (!monster || !Number.isInteger(round) || round < 1 || round % 2 === 1) return null;
  if (monster.encounter === "normal") return round % 4 === 2 ? signatureAction(monster) : commonAction(monster, 0);
  if (monster.encounter === "miniBoss") {
    const position = ((round - 2) / 2) % 3;
    return position === 0 ? signatureAction(monster) : commonAction(monster, position - 1) || commonAction(monster, 0);
  }
  if (monster.encounter === "boss") {
    const position = ((round - 2) / 2) % 4;
    if (position === 0) return signatureAction(monster);
    if (position === 1) return commonAction(monster, 0);
    if (position === 2) return signatureAction(monster, true);
    return commonAction(monster, 1) || commonAction(monster, 0);
  }
  return null;
}

export function getNextMonsterAbility(monster, currentRound) {
  for (let round = Math.max(2, currentRound + 1); round <= currentRound + 8; round += 1) {
    const ability = getMonsterScheduledAbility(monster, round);
    if (ability) return { ...ability, round };
  }
  return null;
}
