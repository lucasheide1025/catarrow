export function describeDungeonBossChoice(reward) {
  if (reward?.type === "coins") return `金幣 ${Number(reward.coins || 0).toLocaleString()}`;
  if (reward?.type === "materialChests") return `T${reward.tierIndex} ${reward.family} 材料寶箱 ×${reward.quantity || 0}`;
  if (reward?.type === "card") return `王卡：${reward.card?.name || reward.card?.monsterId || "未知"}`;
  if (reward?.type === "consolation") return `箭露 ${reward.arrowDew || 0}・射手 EXP ${reward.archerXP || 0}`;
  return "未知獎勵";
}
