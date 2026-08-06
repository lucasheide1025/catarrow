// src/lib/cardTalentDisplay.js
// ─────────────────────────────────────────────────────────────
// 卡片天賦「純顯示層」：把 cardTalents.js 已經算好的效果攤開給玩家看。
// ⚠️ 零平衡守則：本檔不做任何戰鬥計算，也不定義任何 cap 數字——
//    cap 一律引用 cardTalents 的 TALENT_CAPS，避免第二段改上限時顯示對不上。
// ─────────────────────────────────────────────────────────────
import { getCardTalent, TALENT_CAPS, calcFamilySetStatus, STATUS_STRENGTH } from "./cardTalents";
import {
  CONTROL_PROC_CAP, MONSTER_STATUSES, MONSTER_STATUS_LIST, PROC_CAP, PROC_MIN_SCORE,
} from "./monsterStatus";

// key → 顯示資訊（icon / 友善名稱 / 共池來源 / 類別）。cap 不放這裡（見 effectCap）。
export const EFFECT_DISPLAY = Object.freeze({
  // 天賦類（對齊 TALENT_CAPS）
  armorPiercePct:     { icon: "🗡️", name: "穿甲",         kind: "talent" },
  shieldPiercePct:    { icon: "💥", name: "破盾",         kind: "talent" },
  critRatePct:        { icon: "⚡", name: "爆擊率",       kind: "talent", pooledFrom: ["連擊", "挑戰者"] },
  damagePct:          { icon: "💪", name: "傷害系",       kind: "talent", pooledFrom: ["蠻力", "蓄勁", "淬毒"] },
  openingShieldPct:   { icon: "🛡️", name: "開場護盾",     kind: "talent" },
  damageReductionPct: { icon: "🧱", name: "減傷",         kind: "talent" },
  reflectPct:         { icon: "🌵", name: "荊棘反彈",     kind: "talent" },
  monsterAtkDownPct:  { icon: "😱", name: "威嚇（怪ATK↓）", kind: "talent" },
  monsterDefDownPct:  { icon: "🔨", name: "破防（怪DEF↓）", kind: "talent" },
  endRoundHeal:       { icon: "🌿", name: "回合回復",     kind: "mixed" },  // 天賦(汲取)＋套裝(山息)都會加
  hqDamagePct:        { icon: "🎯", name: "高品質傷害",   kind: "mixed" },  // 天賦(精研)＋套裝(全神貫注)
  firstStrikePct:     { icon: "⏳", name: "蓄勁",         kind: "talent" },
  finisherPct:        { icon: "🏆", name: "終結",         kind: "talent" },
  venomPct:           { icon: "☠️", name: "淬毒",         kind: "talent" },
  // 套裝專屬（不吃天賦 cap）
  coinBonusPct:               { icon: "🪙", name: "金幣加成", kind: "set" },
  bossDamagePct:              { icon: "🐲", name: "屠龍（對王傷害）", kind: "set" },
  poisonResistPct:            { icon: "🧪", name: "抗毒",     kind: "set", cap: 100 },
  statusDurationReduction:    { icon: "⏱️", name: "異常縮短", kind: "set" },
  statusStrengthReductionPct: { icon: "🩹", name: "異常減弱", kind: "set" },
});

// tier → tierIndex（複製自 cardTalents 私有表，避免改動該檔）
const TIER_INDEX = { common: 1, rare: 2, elite: 3, fierce: 4, boss: 5, mythic: 6 };

// 顯示用 cap：優先 TALENT_CAPS，其次 EFFECT_DISPLAY.cap，否則 null（無上限）
export function effectCap(key) {
  if (TALENT_CAPS[key] != null) return TALENT_CAPS[key];
  if (EFFECT_DISPLAY[key] && EFFECT_DISPLAY[key].cap != null) return EFFECT_DISPLAY[key].cap;
  return null;
}

// 效果值格式化（百分比 / HP / 回合）
export function formatEffectValue(key, value) {
  if (key === "endRoundHeal") return `${value} HP`;
  if (key === "statusDurationReduction") return `${value} 回合`;
  return `${value}%`;
}

// 從 collection 建 enriched views（含 tierIndex，天賦計算需要；世界王卡排除）
export function buildEquippedViews(collection = {}) {
  const cards = collection.cards || {};
  return (collection.equipped || [])
    .map(item => (typeof item === "string" ? { key: item, source: "monster" } : item))
    .filter(item => item && item.source !== "wb")
    .map(item => {
      const card = cards[item.key];
      if (!card) return null;
      return {
        monsterId: item.key, family: card.family, tier: card.tier,
        tierIndex: card.tierIndex || TIER_INDEX[card.tier] || 1, source: "monster",
      };
    })
    .filter(Boolean);
}

// key → 貢獻清單 [{monsterId, label, icon, value}]（每張貢獻卡一筆；名稱由元件層解析）
export function buildContribution(views = []) {
  const acc = {};
  for (const v of views) {
    const t = getCardTalent(v);
    if (!t) continue;
    (acc[t.key] || (acc[t.key] = [])).push({ monsterId: v.monsterId, label: t.label, icon: t.icon, value: t.value });
  }
  return acc;
}

// 某 key 的天賦原始總和（未砍上限）——判斷有沒有「疊到浪費」
function rawTalentSum(contribution, key) {
  return (contribution[key] || []).reduce((s, e) => s + e.value, 0);
}

// 主動搭配建議：回傳 1~2 條字串（最重要在前）。totals=calcCardCombatEffects 結果, sets=calcFamilySetStatus。
export function buildSuggestion(totals = {}, sets = [], views = [], contribution = null) {
  contribution = contribution || buildContribution(views);
  const tips = [];

  // 1) 撞頂浪費（原始總和 > cap）
  for (const key of Object.keys(contribution)) {
    const cap = effectCap(key);
    if (cap == null) continue;
    if (rawTalentSum(contribution, key) > cap + 0.01) {
      const name = (EFFECT_DISPLAY[key] && EFFECT_DISPLAY[key].name) || key;
      tips.push(`⚠️ ${name}已達上限，多裝同類沒作用——換成別種天賦更划算`);
      break;
    }
  }

  // 2) 差一張套裝（count==1 → 差 1 張觸發 2 階；count==3 → 差 1 張升 4 階）
  for (const s of sets) {
    if (s.count === 1) { tips.push(`再裝 1 張同族卡，即可觸發「${s.name}」族系套裝`); break; }
    if (s.count === 3) { tips.push(`再裝 1 張同族卡，即可把「${s.name}」升到 4 階`); break; }
  }

  // 3) 還有空間（主力效果離上限 >40%）
  if (tips.length < 2) {
    for (const key of Object.keys(totals)) {
      const cap = effectCap(key);
      if (cap == null) continue;
      if (totals[key] > 0 && totals[key] < cap * 0.6) {
        const name = (EFFECT_DISPLAY[key] && EFFECT_DISPLAY[key].name) || key;
        tips.push(`${name} 還有空間，可再堆同類天賦衝滿`);
        break;
      }
    }
  }

  if (tips.length === 0) tips.push("搭配均衡，讚 👍");
  return tips.slice(0, 2);
}

// ── ☠️ 異常狀態的真實公式（數字從 STATUS_STRENGTH / MONSTER_STATUSES 讀,不抄）────
// 給卡片系統顯示「怪物中毒到底扣多少」;顯示與 tickMonsterStatuses 永遠同源,
// 改強度只動 cardTalents.STATUS_STRENGTH 一處,這裡自動跟上。
export function describeStatusFormula(statusId) {
  const def = MONSTER_STATUSES[statusId];
  if (!def) return "";
  const s = STATUS_STRENGTH[statusId];
  switch (statusId) {
    case "poison":   return `每回合 -${s}% 最大HP（不致死）`;
    case "burn":     return `每回合 -${s}% 你的ATK`;
    case "bleed":    return `每回合 -${s}% 你的ATK ×層數（最多5層）`;
    case "defBreak": return `怪物DEF -${s}%`;
    case "weaken":   return `怪物ATK -${s}%`;
    case "freeze":   return `怪物本回合無法放技能`;
    case "paralyze": return `${s}% 機率擋下反擊`;
    default:         return def.desc || "";
  }
}

// 這副牌能施加的異常（calcCardCombatEffects 的 inflict）→ 顯示用清單
export function describeInflict(inflict = {}) {
  return Object.entries(inflict || {}).map(([id, cfg]) => {
    const def = MONSTER_STATUSES[id];
    if (!def || !cfg) return null;
    return {
      id, icon: def.icon, name: def.name, color: def.color,
      chancePct: Math.round(Number(cfg.chancePct) * 10) / 10,
      duration: cfg.duration,
      formula: describeStatusFormula(id),
    };
  }).filter(Boolean);
}

// 全部異常狀態一覽（狀態說明面板用）
export function describeAllStatuses() {
  return MONSTER_STATUS_LIST.map(s => ({
    id: s.id, icon: s.icon, name: s.name, color: s.color,
    desc: s.desc, formula: describeStatusFormula(s.id),
  }));
}

// 觸發規則一行字
export function describeStatusProcRule() {
  return `${PROC_MIN_SCORE} 環以上（含 X）才判定觸發；一般狀態上限 ${PROC_CAP}%，冰凍/麻痺（控場）上限 ${CONTROL_PROC_CAP}%`;
}

