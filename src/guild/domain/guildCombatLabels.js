const ROLE_LABELS = Object.freeze({
  pursuer: "追擊者",
  heavy: "重裝怪",
  ranged: "遠程怪",
  caster: "施法者",
  support: "支援者",
  charger: "突進者",
});

const TARGET_LABELS = Object.freeze({
  player: "冒險者",
  nearest: "最近目標",
  weakest: "生命最低者",
  gate: "城門",
  random: "隨機目標",
});

const STAT_LABELS = Object.freeze({
  atk: "攻擊",
  def: "防禦",
  hp: "生命",
  speed: "移動速度",
  range: "攻擊射程",
});

export const combatRoleLabel = role => ROLE_LABELS[role] || "一般怪物";
export const targetPolicyLabel = target => TARGET_LABELS[target] || "冒險者";
export const combatStatLabel = stat => STAT_LABELS[stat] || "狀態";

export function attackRangeLabel(range) {
  return Number(range) <= 0 ? "近戰（貼身）" : `${Math.floor(Number(range))} 格`;
}

export function counterConditionLabel(counter, targetFormat = "full_110") {
  if (!counter) return "沒有可用的破解方式";
  if (counter.type === "minScore") return `任一箭至少 ${counter.threshold} 分`;
  if (counter.type === "totalScore") return `本回合累積 ${counter.threshold} 分`;
  if (counter.type === "defeatCaster") return "本回合擊倒施法者";
  if (counter.type === "exactRing") {
    const ring = counter.exactRings?.[targetFormat] ?? counter.exactRing;
    return `命中指定 ${ring} 分環`;
  }
  return "查看技能說明";
}
