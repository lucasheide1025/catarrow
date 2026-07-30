export const DUNGEON_REST_OPTIONS = Object.freeze([
  { id:"rest", title:"休息", desc:"回復最大 HP 的 15%～50%" },
  { id:"prepare", title:"整備", desc:"本趟地下城 DEF +1%～15%，只保留最高值" },
  { id:"polish", title:"打磨", desc:"本趟地下城 ATK +1%～15%，只保留最高值" },
  { id:"blessing", title:"祝福", desc:"消耗 1,000 金幣，後衛回到前衛並恢復半血" },
]);

export function rollDungeonRestValue(option, random = Math.random) {
  const min = option === "rest" ? 15 : 1;
  const max = option === "rest" ? 50 : 15;
  return min + Math.floor(random() * (max - min + 1));
}

export function getDungeonRestOptionState(member = {}, option, context = {}) {
  if (option !== "blessing") return { visible:true, enabled:true, reason:"" };
  if (context.localMode) return { visible:false, enabled:false, reason:"單人遠征不使用祝福" };
  if (member.role !== "rear") return { visible:true, enabled:false, reason:"只有後衛可以使用" };
  if ((context.coins || 0) < 1000) return { visible:true, enabled:false, reason:"金幣不足 1,000" };
  return { visible:true, enabled:true, reason:"" };
}

export function resolveDungeonRestChoice(member = {}, option, context = {}) {
  const maxHP = Math.max(1, Number(member.maxHP) || 100);
  const current = {
    atkPct:Number(member.restBonuses?.atkPct) || 0,
    defPct:Number(member.restBonuses?.defPct) || 0,
  };
  if (option === "rest") {
    const healPct = rollDungeonRestValue(option, context.random);
    const heal = Math.round(maxHP * healPct / 100);
    return {
      option, healPct, heal,
      hp:Math.min(maxHP, Math.max(0, Number(member.hp) || 0) + heal),
      restBonuses:current,
      resultText:`恢復 ${healPct}% 最大生命（+${heal} HP）`,
    };
  }
  if (option === "prepare" || option === "polish") {
    const rolledPct = rollDungeonRestValue(option, context.random);
    const key = option === "prepare" ? "defPct" : "atkPct";
    const keptPct = Math.max(current[key], rolledPct);
    return {
      option, rolledPct, keptPct,
      keptPrevious:current[key] > rolledPct,
      restBonuses:{ ...current, [key]:keptPct },
      resultText:`擲出 ${rolledPct}%，本趟保留 ${keptPct}%`,
    };
  }
  if (option === "blessing") {
    return {
      option, hp:Math.round(maxHP * 0.5), role:"front", displayGroup:"front",
      coinCost:1000, restBonuses:current, resultText:"祝福完成：回到前衛並恢復 50% HP",
    };
  }
  throw new Error("未知的休息區選項");
}
