import { MONSTER_STATUSES } from "./monsterStatus";

const SPECIALIZATION_NAMES = Object.freeze({
  precision:"精準", armorBreak:"破甲", bossHunter:"獵王",
  tenacity:"堅韌", immunity:"免疫", guard:"守護",
  nutrition:"營養", wellRested:"充分休息", support:"支援",
});

const EFFECT_FIELDS = [
  ["armorPiercePct", "🗡️", "穿甲", "%"], ["shieldPiercePct", "💠", "破盾", "%"],
  ["damagePct", "💪", "傷害加成", "%"], ["hqDamagePct", "🎯", "高品質傷害", "%"],
  ["critRatePct", "⚡", "額外爆擊率", "%"], ["firstStrikePct", "⏳", "首回合傷害", "%"],
  ["finisherPct", "🏆", "殘血傷害", "%"], ["damageReductionPct", "🧱", "承傷減免", "%"],
  ["healPct", "💚", "治療加成", "%"], ["reflectPct", "🌵", "傷害反彈", "%"],
  ["endRoundHeal", "🌿", "回合恢復", ""], ["openingShieldPct", "🫧", "開場護盾", "%"],
  ["poisonResistPct", "🛡️", "中毒抗性", "%"], ["statusStrengthReductionPct", "🛡️", "異常強度減免", "%"],
  ["statusDurationReduction", "⏱️", "異常回合縮短", " 回合"],
];

export function buildBattleBonusSections({ cardFx = {}, equipSpec = {}, statRows = [], activeStatuses = [], shield = 0 } = {}) {
  const effects = EFFECT_FIELDS.flatMap(([key, icon, label, suffix]) => {
    const value = Number(cardFx?.[key]) || 0;
    return value > 0 ? [{ id:key, icon, label, value:`${value}${suffix}` }] : [];
  });
  const inflicts = Object.entries(cardFx?.inflict || {}).flatMap(([id, config]) => {
    const definition = MONSTER_STATUSES[id];
    if (!definition) return [];
    return [{ id:`inflict-${id}`, icon:definition.icon, label:`可施加${definition.name}`, value:`${Math.round(Number(config?.chancePct) || 0)}%` }];
  });
  const specializations = Object.entries(equipSpec || {}).flatMap(([slot, spec]) => spec?.trackId
    ? [{ id:`spec-${slot}`, icon:"✦", label:{weapon:"武器專精",armor:"防具專精",accessory:"飾品專精"}[slot] || "專精", value:`${SPECIALIZATION_NAMES[spec.trackId] || "未知專精"} Lv.${spec.level || 1}` }]
    : []);
  const stats = (statRows || []).filter(row => row && row.label && (row.atk || row.def)).map(row => ({
    id:`stat-${row.id || row.label}`, icon:"📊", label:row.label,
    value:[row.atk ? `攻 ${row.atk > 0 ? "+" : ""}${row.atk}` : "", row.def ? `防 ${row.def > 0 ? "+" : ""}${row.def}` : ""].filter(Boolean).join("・"),
  }));
  const current = [
    ...(Number(shield) > 0 ? [{ id:"shield", icon:"🫧", label:"目前護盾", value:String(Math.round(shield)) }] : []),
    ...(activeStatuses || []).filter(status => status && (status.duration || status.expiresAfterRound)).map(status => ({ id:`status-${status.id}`, icon:status.icon || "🌀", label:status.name || status.id, value:`${status.duration || status.expiresAfterRound} 回合` })),
  ];
  return [
    { id:"effects", title:"卡片與戰鬥加成", items:effects },
    { id:"inflicts", title:"可施加異常", items:inflicts },
    { id:"specializations", title:"裝備專精", items:specializations },
    { id:"stats", title:"能力來源", items:stats },
    { id:"current", title:"目前狀態", items:current },
  ].filter(section => section.items.length > 0);
}
