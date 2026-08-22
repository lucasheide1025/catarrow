"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TALENT_CRIT_MULT = exports.MAX_DAMAGE_REDUCTION_PCT = exports.HIGH_QUALITY_SCORE = void 0;
exports.applyBattleStart = applyBattleStart;
exports.applyCompanion = applyCompanion;
exports.applyIncoming = applyIncoming;
exports.applyOutgoing = applyOutgoing;
exports.applyRoundEnd = applyRoundEnd;
exports.applyStatusResist = applyStatusResist;
exports.buildCombatModifiers = buildCombatModifiers;
exports.describeModifiers = describeModifiers;
exports.effectiveDefense = effectiveDefense;
exports.reflectDamage = reflectDamage;
var _equipmentSpecializationEngine = require("./equipmentSpecializationEngine");
// src/lib/combatModifiers.js
// ─────────────────────────────────────────────────────────────
// 🎯 玩家側加成的**唯一結算管線**（2026-08-01）。
//
// ⚠️ 為什麼要有這支：卡片天賦（cardTalents）與裝備專精
//    （equipmentSpecializationEngine）本來只寫在 `BattleScreen.jsx` 裡，
//    而那個檔**沒有任何地方 import**。結果是五個線上模式
//    （單人打怪／組隊打怪／地下城單人／地下城組隊／世界王）
//    玩家的卡片天賦與專精**全部沒有作用**——只有卡片的三圍有效。
//    玩家一直在投資完全沒有效果的東西。
//
// ⚠️ 所以規則集中在這裡，五個模式各自呼叫。**不要再把公式抄進元件**——
//    抄一次就會漂一次，而這正是上一輪出事的原因。
//
// 結算順序（照既有 BattleScreen 的實作，不要重新發明）：
//   進場   nutrition 加最大 HP → 威嚇/破防壓怪物面板 → 開場護盾
//   出手   破甲(專精)＋穿甲(卡片) 減防 → 算基礎傷害
//          → 精準/獵王(專精) → 傷害%/高品質%/對王%(卡片) → 連擊爆擊
//   受擊   堅韌/守護(專精) ＋ 堅盾(卡片)，合計上限 80%
//   中狀態 免疫(專精) ＋ 幽環共鳴(套裝) 削強度與回合；毒另外吃毒抗
//   回合末 睡飽(專精) ＋ 汲取(卡片) 回血
// ─────────────────────────────────────────────────────────────

const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const pct = v => Math.max(0, num(v)) / 100;

/** 受擊減傷的總上限——多來源疊加不能讓玩家無敵 */
const MAX_DAMAGE_REDUCTION_PCT = exports.MAX_DAMAGE_REDUCTION_PCT = 80;
/** 卡片「連擊」觸發時的爆擊倍率（跟 BattleScreen 一致） */
const TALENT_CRIT_MULT = exports.TALENT_CRIT_MULT = 1.3;
/** 幾環以上算「高品質命中」（精準／精研都吃這條線） */
const HIGH_QUALITY_SCORE = exports.HIGH_QUALITY_SCORE = 8;
function specValue(slot, trackId, key) {
  if (!slot || slot.trackId !== trackId) return 0;
  try {
    return num((0, _equipmentSpecializationEngine.getSpecializationEffect)(trackId, slot.level)[key]);
  } catch {
    return 0;
  }
}

/**
 * 把「卡片天賦 + 裝備專精」壓成一包扁平的修正值。
 * 之後每一層只讀這一包，不再各自去翻 equipSpec / cardFx。
 *
 * @param cardFx    calcCardCombatEffects() 的結果
 * @param equipSpec { weapon:{trackId,level}, armor:{...}, accessory:{...} }
 */
function buildCombatModifiers({
  cardFx = null,
  equipSpec = null
} = {}) {
  const fx = cardFx || {};
  const w = equipSpec?.weapon || null;
  const a = equipSpec?.armor || null;
  const ac = equipSpec?.accessory || null;
  return {
    // ── 進場 ──
    maxHpFlat: specValue(ac, "nutrition", "maxHpFlat"),
    openingShieldPct: num(fx.openingShieldPct),
    monsterAtkDownPct: num(fx.monsterAtkDownPct),
    monsterDefDownPct: num(fx.monsterDefDownPct),
    // ── 出手 ──
    // 破甲(專精) 與 穿甲(卡片) 是**相乘**不是相加：兩個都滿也不會讓防禦歸零
    defIgnoreSpecPct: specValue(w, "armorBreak", "defenseIgnorePct"),
    defIgnoreCardPct: num(fx.armorPiercePct),
    hqDamageSpecPct: specValue(w, "precision", "highQualityDamagePct"),
    hqDamageCardPct: num(fx.hqDamagePct),
    bossDamageSpecPct: specValue(w, "bossHunter", "bossDamagePct"),
    bossDamageCardPct: num(fx.bossDamagePct),
    damagePct: num(fx.damagePct),
    critRatePct: num(fx.critRatePct),
    // 拆開後的三個新鍵（2026-08-01）：讓換卡真的換得出打法
    firstStrikePct: num(fx.firstStrikePct),
    // 蓄勁：第一回合
    finisherPct: num(fx.finisherPct),
    // 終結：怪物殘血時
    shieldPiercePct: num(fx.shieldPiercePct),
    // ☠️ 這副牌能對怪物施加什麼異常
    inflict: fx.inflict || {},
    // ── 受擊 ──
    flatReductionPct: specValue(a, "tenacity", "finalDamageReductionPct"),
    guardReductionPct: specValue(a, "guard", "finalDamageReductionPct"),
    guardThresholdPct: specValue(a, "guard", "hpThresholdPct") || 35,
    cardReductionPct: num(fx.damageReductionPct),
    reflectPct: num(fx.reflectPct),
    // ── 狀態抗性 ──
    statusStrengthReductionPct: specValue(a, "immunity", "statusStrengthReductionPct") + num(fx.statusStrengthReductionPct),
    statusDurationReduction: specValue(a, "immunity", "statusDurationReduction") + num(fx.statusDurationReduction),
    poisonResistPct: Math.min(100, num(fx.poisonResistPct)),
    // ── 回合末 ──
    endRoundHeal: specValue(ac, "wellRested", "endRoundHeal") + num(fx.endRoundHeal),
    // ── 貓貓（支援專精）──
    companionAttackPct: specValue(ac, "support", "companionAttackPct"),
    companionHealingPct: specValue(ac, "support", "companionHealingPct")
  };
}

/** 進場一次：最大 HP、護盾、壓低怪物面板 */
function applyBattleStart({
  playerMaxHp = 0,
  monsterAtk = 0,
  monsterDef = 0,
  mods
}) {
  const m = mods || buildCombatModifiers();
  const maxHp = Math.max(1, Math.round(num(playerMaxHp) + m.maxHpFlat));
  return {
    playerMaxHp: maxHp,
    hpGain: m.maxHpFlat,
    shield: Math.round(maxHp * pct(m.openingShieldPct)),
    // ⚠️ 威嚇/破防是**常駐壓怪物面板**，不是每箭再算一次
    monsterAtk: Math.max(1, Math.round(num(monsterAtk) * (1 - pct(m.monsterAtkDownPct)))),
    monsterDef: Math.max(0, Math.round(num(monsterDef) * (1 - pct(m.monsterDefDownPct))))
  };
}

/**
 * 有效防禦：破甲(專精) 與 穿甲(卡片) **相乘**。
 * ⚠️ 相加的話兩個都點滿會讓防禦直接歸零，那條線不能開。
 */
function effectiveDefense(monsterDef, mods) {
  const m = mods || buildCombatModifiers();
  return Math.max(0, num(monsterDef) * (1 - pct(m.defIgnoreSpecPct)) * (1 - pct(m.defIgnoreCardPct)));
}

/**
 * 出手：把算好的基礎傷害套上所有加成。
 * @param baseDamage 已經用 effectiveDefense() 算過的傷害
 * @param score      這一箭的環數（"X" 或數字）
 */
function applyOutgoing({
  baseDamage,
  score = 0,
  bossTagged = false,
  mods,
  rand = Math.random,
  round = 1,
  monsterHpRatio = 1
}) {
  const m = mods || buildCombatModifiers();
  let dmg = Math.max(0, num(baseDamage));
  if (dmg <= 0) return {
    damage: 0,
    crit: false,
    highQuality: false
  };
  const isX = score === "X" || score === "x";
  const value = isX ? 10 : num(score);
  const highQuality = isX || value >= HIGH_QUALITY_SCORE;
  if (highQuality && m.hqDamageSpecPct) dmg *= 1 + pct(m.hqDamageSpecPct);
  if (bossTagged && m.bossDamageSpecPct) dmg *= 1 + pct(m.bossDamageSpecPct);
  if (m.damagePct) dmg *= 1 + pct(m.damagePct);
  if (highQuality && m.hqDamageCardPct) dmg *= 1 + pct(m.hqDamageCardPct);
  if (bossTagged && m.bossDamageCardPct) dmg *= 1 + pct(m.bossDamageCardPct);
  // ⏳ 蓄勁只在第一回合、🏆 終結只在怪物殘血——都是有條件的，才有辨識度
  if (round <= 1 && m.firstStrikePct) dmg *= 1 + pct(m.firstStrikePct);
  if (num(monsterHpRatio, 1) <= 0.3 && m.finisherPct) dmg *= 1 + pct(m.finisherPct);

  // ⚠️ X 本來就是爆擊，不再疊「連擊」——不然滿環變成雙重爆擊
  let crit = false;
  if (m.critRatePct && !isX && value > 0 && rand() < pct(m.critRatePct)) {
    crit = true;
    dmg *= TALENT_CRIT_MULT;
  }
  return {
    damage: Math.round(dmg),
    crit,
    highQuality
  };
}

/** 受擊：堅韌／守護／堅盾，合計有上限 */
function applyIncoming({
  damage,
  currentHp = 1,
  maxHp = 1,
  mods
}) {
  const m = mods || buildCombatModifiers();
  const ratio = num(maxHp) > 0 ? num(currentHp) / num(maxHp) : 1;
  const guardOn = ratio <= pct(m.guardThresholdPct);
  const flat = num(m.flatReductionPct);
  const guard = guardOn ? num(m.guardReductionPct) : 0;
  const card = num(m.cardReductionPct);
  const total = Math.min(MAX_DAMAGE_REDUCTION_PCT, flat + guard + card);
  return {
    // ⚠️ 全部經過 num()：不完整/缺欄位的 mods（如機器人快照）不會算出 NaN 傷害
    damage: Math.max(0, Math.round(num(damage) * (1 - total / 100))),
    reductionPct: total,
    guardActive: guardOn && guard > 0
  };
}

/**
 * 中狀態：削強度與回合。
 * ⚠️ 回合最少留 1——削到 0 等於完全免疫，那是套裝滿階才該有的待遇。
 */
function applyStatusResist(status, mods) {
  if (!status) return null;
  const m = mods || buildCombatModifiers();
  const strengthScale = Math.max(0, 1 - pct(m.statusStrengthReductionPct));
  let strength = typeof status.strength === "number" ? Math.round(status.strength * strengthScale * 10) / 10 : status.strength;

  // 毒抗是額外一層：100% 就是完全免疫（毒殼抗性 4 張）
  if (status.id === "poison" && m.poisonResistPct) {
    strength = typeof strength === "number" ? Math.round(strength * (1 - pct(m.poisonResistPct)) * 10) / 10 : strength;
  }
  const duration = Math.max(1, num(status.duration, 1) - num(m.statusDurationReduction));
  return {
    ...status,
    strength,
    duration
  };
}

/** 回合末回血。⚠️ 倒下的人不回——那是後衛系統的事，不是這裡。 */
function applyRoundEnd({
  currentHp = 0,
  maxHp = 1,
  mods,
  alive = true
}) {
  const m = mods || buildCombatModifiers();
  if (!alive || m.endRoundHeal <= 0) return {
    hp: num(currentHp),
    healed: 0
  };
  const hp = Math.min(num(maxHp), num(currentHp) + m.endRoundHeal);
  return {
    hp,
    healed: hp - num(currentHp)
  };
}

/** 反彈：對方打你多少，彈回去多少（有上限，見呼叫端） */
function reflectDamage(incomingDamage, mods) {
  const m = mods || buildCombatModifiers();
  if (!m.reflectPct) return 0;
  return Math.max(0, Math.round(num(incomingDamage) * pct(m.reflectPct)));
}

/** 貓貓：支援專精放大陪練的攻擊與治療 */
function applyCompanion({
  attack = 0,
  healing = 0,
  mods
}) {
  const m = mods || buildCombatModifiers();
  return {
    attack: Math.round(num(attack) * (1 + pct(m.companionAttackPct))),
    healing: Math.round(num(healing) * (1 + pct(m.companionHealingPct)))
  };
}

/** UI 用：這場戰鬥玩家實際帶了哪些加成（讓玩家看得到投資有效） */
function describeModifiers(mods) {
  const m = mods || buildCombatModifiers();
  const rows = [];
  const add = (icon, label, value, unit = "%") => {
    if (value > 0) rows.push({
      icon,
      label,
      text: `${label} +${Math.round(value * 10) / 10}${unit}`
    });
  };
  add("🗡️", "無視防禦", 100 - (1 - pct(m.defIgnoreSpecPct)) * (1 - pct(m.defIgnoreCardPct)) * 100);
  add("💪", "傷害", m.damagePct);
  add("⏳", "首回合傷害", m.firstStrikePct);
  add("🏆", "殘血追擊", m.finisherPct);
  add("🎯", "高品質命中", m.hqDamageSpecPct + m.hqDamageCardPct);
  add("👑", "對王類", m.bossDamageSpecPct + m.bossDamageCardPct);
  add("⚡", "爆擊率", m.critRatePct);
  add("🧱", "受傷減免", Math.min(MAX_DAMAGE_REDUCTION_PCT, m.flatReductionPct + m.cardReductionPct));
  add("🌵", "反彈", m.reflectPct);
  add("🛡️", "開場護盾", m.openingShieldPct);
  add("🌿", "回合末回復", m.endRoundHeal, " HP");
  add("😷", "異常強度減免", m.statusStrengthReductionPct);
  add("🧪", "毒抗", m.poisonResistPct);
  add("🐾", "貓貓攻擊", m.companionAttackPct);
  for (const [id, cfg] of Object.entries(m.inflict || {})) {
    rows.push({
      icon: "☠️",
      label: id,
      text: `附加異常 ${Math.round(cfg.chancePct)}%（9環以上）`
    });
  }
  return rows;
}
