function seededRoll(key) {
  let hash = 2166136261;
  for (const char of String(key)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function buildSoloExpansionReward({ battleId, memberId, monster, materialQty = 5, cardChance = 0.2 }) {
  if (!battleId || !memberId || monster?.expansionVersion !== 1 || monster?.encounter !== "normal" || !monster?.materialId) return null;
  const cardDropped = seededRoll(`${battleId}:${memberId}:${monster.id}:card`) < cardChance;
  return {
    rewardKey:`${battleId}:${memberId}:solo`,
    materials:[{ id:monster.materialId, quantity:materialQty }],
    card:cardDropped ? {
      monsterId:monster.cardId || monster.id,
      name:monster.name,
      icon:monster.icon,
      tier:monster.tier,
      family:monster.family,
    } : null,
  };
}

