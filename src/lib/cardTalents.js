// src/lib/cardTalents.js — 卡片個性系統：族系套裝效果 + 招牌天賦（2026-07-18 方向1+2）
// 天賦「零手工」：從 signatureEffectCatalog 的結構化積木自動映射,252 張卡各自有效果。
// 套裝：同族「怪物卡」裝備滿 2/4 張觸發族系加成。世界王卡不參與(自有被動)。
// 所有數值集中此檔;戰鬥端只吃 calcCardCombatEffects 的彙總結果(各鍵有 cap)。

import { getSignatureEffect } from "./signatureEffectCatalog";
import { FAMILY_STATUS, MONSTER_STATUSES, procCapFor } from "./monsterStatus";
import { resolveWorldBossCardEffects } from "./worldBossCards";

// ── 族系套裝（2張/4張兩階）────────────────────────────────
export const FAMILY_SET_BONUSES = Object.freeze({
  ghost:     { name: "幽環共鳴", t2: { statusDurationReduction: 1 },  t4: { statusStrengthReductionPct: 20 }, text2: "受到的異常 -1 回合", text4: "異常強度再 -20%" },
  mountain:  { name: "山息滋養", t2: { endRoundHeal: 5 },             t4: { endRoundHeal: 10 },               text2: "回合末回復 5 HP",   text4: "回合末再 +10 HP" },
  insect:    { name: "毒殼抗性", t2: { poisonResistPct: 50 },         t4: { poisonResistPct: 50 },            text2: "毒傷減半",           text4: "毒傷完全免疫" },
  workplace: { name: "加薪談判", t2: { coinBonusPct: 10 },            t4: { coinBonusPct: 10 },               text2: "打怪金幣 +10%",     text4: "打怪金幣共 +20%" },
  exam:      { name: "全神貫注", t2: { hqDamagePct: 5 },              t4: { hqDamagePct: 5 },                 text2: "高品質命中傷害 +5%", text4: "高品質命中共 +10%" },
  temple:    { name: "屠龍血脈", t2: { bossDamagePct: 5 },            t4: { bossDamagePct: 5 },               text2: "對王類傷害 +5%",    text4: "對王類共 +10%" },
  treasure:  { name: "尋寶直覺", t2: { coinBonusPct: 10 },            t4: { coinBonusPct: 15 },               text2: "打怪金幣 +10%",     text4: "打怪金幣共 +25%" },
});

// ── 招牌天賦映射（積木 → 天賦;每卡取第一個命中,Tier 放大 T1-2×1/T3-4×1.5/T5-6×2）──
//
// ⚠️ 2026-08-01 重寫：舊版有 4 條規則擠在同一個 damagePct（蓄勁/淬毒/挑戰者/蠻力），
//    252 張卡實際只有 9 種效果，而且大量是「+1~2% 傷害」的保底——玩家換卡感覺不到差別。
//    現在每條規則都有**自己的鍵**，換卡才有換打法的感覺。
//
// ⚠️ 「淬毒」以前是假的（只是 +1% 傷害）。現在它真的會施加異常狀態，
//    種類由**卡片的族系**決定（見 monsterStatus.FAMILY_STATUS）。
const TALENT_RULES = [
  { key: "armorPiercePct",  base: 2,  icon: "🗡️", label: "穿甲",   match: b => b.type === "damage" && b.pierceDefPct > 0 },
  { key: "shieldPiercePct", base: 2,  icon: "💥", label: "破盾",   match: b => b.type === "damage" && b.pierceShieldPct > 0 },
  { key: "critRatePct",     base: 2,  icon: "⚡", label: "連擊",   match: b => b.type === "damage" && (b.hits || 1) >= 2 },
  // 蓄勁：開場先發制人（原本跟蠻力共用 damagePct，分不出差別）
  { key: "firstStrikePct",  base: 4,  icon: "⏳", label: "蓄勁",   match: b => b.type === "delayedBurst" },
  { key: "openingShieldPct",base: 2,  icon: "🛡️", label: "護體",   match: b => b.type === "selfShield" },
  { key: "damageReductionPct", base: 1.5, icon: "🧱", label: "堅盾", match: b => b.type === "selfReduction" },
  { key: "reflectPct",      base: 2,  icon: "🌵", label: "荊棘",   match: b => b.type === "selfReflect" },
  { key: "monsterAtkDownPct", base: 2, icon: "😱", label: "威嚇",  match: b => b.type === "playerStatus" && b.id === "atkDown" },
  { key: "monsterDefDownPct", base: 2, icon: "🔨", label: "破防",  match: b => b.type === "playerStatus" && b.id === "defDown" },
  { key: "endRoundHeal",    base: 3,  icon: "🌿", label: "汲取",   match: b => b.type === "playerStatus" && b.id === "healDown" },
  // ☠️ 淬毒：**真的施加異常**，種類看族系（毒蟲=中毒、西方=灼燒、寶箱=冰凍…）
  { key: "venomPct",        base: 3,  icon: "☠️", label: "淬毒",   match: b => b.type === "playerStatus" && b.id === "poison" },
  { key: "hqDamagePct",     base: 3,  icon: "🎯", label: "精研",   match: b => b.type === "hqMark" },
  // 挑戰者：殘血追擊（原本跟連擊共用 critRatePct）
  { key: "finisherPct",     base: 4,  icon: "🏆", label: "終結",   match: b => b.type === "challenge" },
];
const DEFAULT_TALENT = { key: "damagePct", base: 2, icon: "💪", label: "蠻力" };

const tierScale = tierIndex => (tierIndex <= 2 ? 1 : tierIndex <= 4 ? 1.5 : 2);

// 單卡天賦（view 需含 monsterId/signatureSkillId?/tierIndex;世界王卡回 null）
export function getCardTalent(view) {
  if (!view || view.source === "wb" || view.tier === "worldboss") return null;
  const effect = getSignatureEffect(`sig_${view.monsterId}`);
  if (!effect) return null;
  let rule = DEFAULT_TALENT;
  outer: for (const candidate of TALENT_RULES) {
    for (const block of effect.blocks) {
      if (candidate.match(block)) { rule = candidate; break outer; }
    }
  }
  const value = Math.round(rule.base * tierScale(view.tierIndex || 1) * 10) / 10;
  return { key: rule.key, value, icon: rule.icon, label: rule.label,
    text: `${rule.icon} ${rule.label}：${talentText(rule.key, value)}` };
}

function talentText(key, value) {
  switch (key) {
    case "armorPiercePct": return `無視怪物防禦 ${value}%`;
    case "shieldPiercePct": return `無視怪物護盾 ${value}%`;
    case "critRatePct": return `爆擊率 +${value}%`;
    case "damagePct": return `傷害 +${value}%`;
    case "openingShieldPct": return `開場護盾（最大HP ${value}%）`;
    case "damageReductionPct": return `受傷 -${value}%`;
    case "reflectPct": return `反彈 ${value}% 傷害`;
    case "monsterAtkDownPct": return `怪物 ATK -${value}%`;
    case "monsterDefDownPct": return `怪物 DEF -${value}%`;
    case "endRoundHeal": return `回合末回復 ${value} HP`;
    case "hqDamagePct": return `高品質命中傷害 +${value}%`;
    case "firstStrikePct": return `第一回合傷害 +${value}%`;
    case "finisherPct": return `怪物殘血時傷害 +${value}%`;
    case "venomPct": return `9環以上有 ${value}% 機率附加族系異常`;
    default: return `+${value}`;
  }
}

// 各天賦鍵彙總上限（防 10 張同天賦疊到失衡）
// export：供顯示層 cardTalentDisplay 引用同一份上限（不抄數字，避免顯示與實際 cap 漂移）
// ⚠️ 2026-08-01 一併調高：舊上限（傷害 8%、穿甲 10%）讓 10 張滿編卡片
//    加起來也感覺不出來。卡片是主要的養成線，要換得出打法。
export const TALENT_CAPS = Object.freeze({
  armorPiercePct: 20, shieldPiercePct: 20, critRatePct: 15, damagePct: 15,
  openingShieldPct: 12, damageReductionPct: 10, reflectPct: 10,
  monsterAtkDownPct: 12, monsterDefDownPct: 12, endRoundHeal: 25, hqDamagePct: 18,
  firstStrikePct: 25, finisherPct: 25, venomPct: 30,
});

// 套裝觸發：同族怪物卡張數 ≥2 / ≥4
export function calcFamilySetStatus(equippedViews = []) {
  const counts = {};
  for (const view of equippedViews) {
    if (!view || view.source === "wb") continue;
    counts[view.family] = (counts[view.family] || 0) + 1;
  }
  return Object.entries(FAMILY_SET_BONUSES)
    .map(([family, config]) => ({ family, name: config.name, count: counts[family] || 0,
      tier2: (counts[family] || 0) >= 2, tier4: (counts[family] || 0) >= 4,
      text2: config.text2, text4: config.text4 }))
    .filter(entry => entry.count > 0);
}

// 戰鬥用彙總：天賦（含 cap）＋套裝,一次算好給戰鬥端
export function calcCardCombatEffects(equippedViews = []) {
  const total = {};
  for (const view of equippedViews) {
    const talent = getCardTalent(view);
    if (talent) total[talent.key] = (total[talent.key] || 0) + talent.value;
  }
  for (const [key, cap] of Object.entries(TALENT_CAPS)) {
    if (total[key]) total[key] = Math.min(cap, Math.round(total[key] * 10) / 10);
  }
  for (const set of calcFamilySetStatus(equippedViews)) {
    const config = FAMILY_SET_BONUSES[set.family];
    if (set.tier2) for (const [key, value] of Object.entries(config.t2)) total[key] = (total[key] || 0) + value;
    if (set.tier4) for (const [key, value] of Object.entries(config.t4)) total[key] = (total[key] || 0) + value;
  }
  if (total.poisonResistPct) total.poisonResistPct = Math.min(100, total.poisonResistPct);
  // ☠️ 這副牌能對怪物施加什麼——戰鬥端拿去 rollInflict()
  total.inflict = calcInflictFromViews(equippedViews, total.venomPct || 0);
  return total;
}

// ── ☠️ 異常施加：每張卡都替**自己的族系狀態**貢獻一點觸發率 ──────
//
// ⚠️ 這是族系識別度的來源：10 張毒蟲卡＝很會下毒，混編＝各種狀態各一點。
//    「淬毒」天賦的卡再額外加碼（那是它的招牌）。
//
// ⚠️ 強度**不隨張數成長**，只有觸發率會——不然滿編毒隊會把怪物毒到見底，
//    那是傷害不是控場。
const FAMILY_INFLICT_BASE = 1.5;      // 每張卡替族系狀態 +1.5%（再乘 tier）
export const STATUS_STRENGTH = Object.freeze({
  poison: 3,      // 每回合 3% 最大 HP
  burn: 12,       // 每回合 12% 玩家 ATK
  bleed: 8,       // 每回合 8% 玩家 ATK（可疊層）
  defBreak: 12,   // 怪物 DEF -12%
  weaken: 12,     // 怪物 ATK -12%
  freeze: 1,      // 控場沒有強度
  paralyze: 50,   // 50% 機率擋反擊
});

/**
 * 算出「這副牌能施加哪些異常、各自多少機率」。
 * @returns { [statusId]: { chancePct, strength } }
 */
export function calcInflictFromViews(equippedViews = [], venomPct = 0) {
  const chance = {};
  for (const view of equippedViews) {
    if (!view || view.source === "wb") continue;
    const statusId = FAMILY_STATUS[view.family];
    if (!statusId) continue;
    chance[statusId] = (chance[statusId] || 0) + FAMILY_INFLICT_BASE * tierScale(view.tierIndex || 1);
  }
  const out = {};
  for (const [id, raw] of Object.entries(chance)) {
    // 淬毒天賦是全域加碼：帶了淬毒卡，所有族系狀態都更容易觸發
    const total = Math.min(procCapFor(id), Math.round((raw + Number(venomPct || 0)) * 10) / 10);
    if (total <= 0) continue;
    out[id] = {
      chancePct: total,
      strength: STATUS_STRENGTH[id] ?? 0,
      duration: MONSTER_STATUSES[id]?.maxDuration ?? 1,
    };
  }
  return out;
}

// 從 cardCollections 文件形狀直接彙總（戰鬥端便利入口）
export function calcCardCombatEffectsFromCollection(collection = {}, context = {}) {
  const cards = collection.cards || {};
  const views = (collection.equipped || [])
    .map(item => (typeof item === "string" ? { key: item, source: "monster" } : item))
    .filter(item => item.source !== "wb")
    .map(item => {
      const card = cards[item.key];
      return card ? { monsterId: item.key, family: card.family, tier: card.tier, tierIndex: card.tierIndex || tierIndexFromTier(card.tier), source: "monster" } : null;
    })
    .filter(Boolean);
  const total = calcCardCombatEffects(views);
  const wb = resolveWorldBossCardEffects({
    equippedCardKeys:(collection.equipped || []).filter(item => item && typeof item !== "string" && item.source === "wb").map(item => item.key),
    enemyFamily:context.enemyFamily,
    enemyClass:context.enemyClass,
  }).modifiers;
  total.damagePct = (total.damagePct || 0) + wb.damagePct * 100;
  total.damageReductionPct = (total.damageReductionPct || 0) + wb.damageReducePct * 100;
  total.healPct = (total.healPct || 0) + wb.healPct * 100;
  total.armorPiercePct = (total.armorPiercePct || 0) + wb.armorPiercePct;
  if (wb.burn) total.inflict = { ...(total.inflict || {}), burn:{ chancePct:100, strength:wb.burn.strengthPct, duration:wb.burn.duration, uncapped:true } };
  return total;
}

function tierIndexFromTier(tier) {
  return { common: 1, rare: 2, elite: 3, fierce: 4, boss: 5, mythic: 6 }[tier] || 1;
}
