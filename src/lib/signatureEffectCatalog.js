// src/lib/signatureEffectCatalog.js — 252 招牌技能「文字摘要 → 結構化積木」目錄
// 來源：signature-skill-mappings.md 生成的 signatureSummary（模式固定,可靠解析）。
// PRD 33-34：每招牌 1~3 積木、共用 resolver,不為單怪寫獨立邏輯。
// 積木型別（對齊 EFFECT_PRIMITIVES）：
//   damage        { mult, hits, pierceDefPct, pierceShieldPct }   直接傷害（含多段/穿甲/破盾）
//   delayedBurst  { mult }                                        下一回合延遲攻擊（倒數可破解）
//   playerStatus  { id, stat, unit, strength, duration }          玩家減益（atkDown/defDown/healDown/poison）
//   selfShield    { maxHpPct }                                    怪物自身護盾（吸玩家傷害）
//   selfReduction { pct, duration }                               怪物自身減傷
//   selfReflect   { pct, duration }                               有限反射（單次上限由 resolver 保障）
//   hqMark        { pct }                                         下次高品質箭傷害加成（風險/回報標記）
//   challenge     { minScore|colorPick, onFail, onSuccessDamageBuffPct } 指定分數/光色挑戰
//
// 傷害基準（monster-skill-catalog.md Tier 數值帶）:resolver 用 TIER_SKILL_ATK_MULT。

import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";

export const TIER_SKILL_ATK_MULT = Object.freeze({
  1: { normal: 1.05, miniBoss: 1.10, boss: 1.15 },
  2: { normal: 1.08, miniBoss: 1.13, boss: 1.18 },
  3: { normal: 1.12, miniBoss: 1.18, boss: 1.23 },
  4: { normal: 1.15, miniBoss: 1.21, boss: 1.26 },
  5: { normal: 1.18, miniBoss: 1.24, boss: 1.30 },
  6: { normal: 1.22, miniBoss: 1.28, boss: 1.35 },
});

const BASE_KIND = { "基準": "normal", "基準傷害": "normal", "小王基準": "miniBoss", "大王基準": "boss" };

const num = s => Number(s);

// 單一效果片段 → 積木（無法辨識回 null,由 validate 揪出）
export function parseSignatureSegment(segment) {
  const s = segment.trim();
  if (!s || s === "無傷害" || s === "不附加狀態") return { type: "none" };

  let m;
  // N段攻擊，總倍率=基準(×K)(，無視護盾N%)
  if ((m = s.match(/^(\d)段(?:光翼)?攻擊，總倍率=(基準|小王基準|大王基準)(?:×([\d.]+))?(?:，無視(防禦|護盾)([\d.]+)%)?$/))) {
    return { type: "damage", hits: num(m[1]), baseKind: BASE_KIND[m[2]], mult: m[3] ? num(m[3]) : 1,
      pierceDefPct: m[4] === "防禦" ? num(m[5]) : 0, pierceShieldPct: m[4] === "護盾" ? num(m[5]) : 0 };
  }
  // 延遲攻擊基準×K(於下回合)
  if ((m = s.match(/^延遲攻擊(基準|小王基準|大王基準)×([\d.]+)(?:於下回合)?$/))) {
    return { type: "delayedBurst", baseKind: BASE_KIND[m[1]], mult: num(m[2]) };
  }
  // 基準(×K)(，無視防禦/護盾N%)
  if ((m = s.match(/^(基準傷害|基準|小王基準|大王基準)(?:×([\d.]+))?(?:，無視(防禦|護盾)([\d.]+)%)?$/))) {
    return { type: "damage", hits: 1, baseKind: BASE_KIND[m[1]], mult: m[2] ? num(m[2]) : 1,
      pierceDefPct: m[3] === "防禦" ? num(m[4]) : 0, pierceShieldPct: m[3] === "護盾" ? num(m[4]) : 0 };
  }
  // (命中後)(玩家 )ATK/DEF-N% M回合
  if ((m = s.match(/^(?:命中後)?(?:玩家\s*)?(ATK|DEF)-([\d.]+)%\s*(\d)回合$/))) {
    const stat = m[1] === "ATK" ? "atk" : "def";
    return { type: "playerStatus", id: `${stat}Down`, stat, unit: "pct", strength: num(m[2]), duration: num(m[3]) };
  }
  // 治療量-N% M回合
  if ((m = s.match(/^治療量-([\d.]+)%\s*(\d)回合$/))) {
    return { type: "playerStatus", id: "healDown", stat: "heal", unit: "pct", strength: num(m[1]), duration: num(m[2]) };
  }
  // 最大HP N%毒傷M回合
  if ((m = s.match(/^最大HP\s*([\d.]+)%毒傷(\d)回合$/))) {
    return { type: "playerStatus", id: "poison", stat: "hp", unit: "maxHpPct", strength: num(m[1]), duration: num(m[2]) };
  }
  // 自身護盾=最大HP N% / 自身護盾N% / 護盾=最大HP N% / 護盾N%
  if ((m = s.match(/^(?:自身)?護盾(?:=最大HP\s*)?([\d.]+)%$/))) {
    return { type: "selfShield", maxHpPct: num(m[1]) };
  }
  // (自身)減傷N% M回合
  if ((m = s.match(/^(?:自身)?減傷([\d.]+)%\s*(\d)回合$/))) {
    return { type: "selfReduction", pct: num(m[1]), duration: num(m[2]) };
  }
  // 有限反射N% M回合
  if ((m = s.match(/^有限反射([\d.]+)%\s*(\d)回合$/))) {
    return { type: "selfReflect", pct: num(m[1]), duration: num(m[2]) };
  }
  // 下次高品質箭傷害+N%
  if ((m = s.match(/^下次高品質箭傷害\+([\d.]+)%$/))) {
    return { type: "hqMark", pct: num(m[1]) };
  }
  // (指定)N分以上挑戰 / 指定光色挑戰
  if ((m = s.match(/^(?:指定)?(\d+)分以上挑戰$/))) {
    return { type: "challenge", minScore: num(m[1]) };
  }
  if (s === "指定光色挑戰") return { type: "challenge", colorPick: true };
  // 失敗(則)ATK/DEF-N% M回合（附掛在 challenge 上,parse 階段先獨立回傳,組裝時合併）
  if ((m = s.match(/^失敗(?:則)?(ATK|DEF)-([\d.]+)%\s*(\d)回合$/))) {
    const stat = m[1] === "ATK" ? "atk" : "def";
    return { type: "challengeFail", status: { id: `${stat}Down`, stat, unit: "pct", strength: num(m[2]), duration: num(m[3]) } };
  }
  // 完成則(本回合)玩家(本回合)傷害+N%
  if ((m = s.match(/^完成則(?:本回合)?玩家(?:本回合)?傷害\+([\d.]+)%$/))) {
    return { type: "challengeSuccess", damageBuffPct: num(m[1]) };
  }
  // 較低的玩家ATK或DEF再-N% M回合（天平裁界:動態挑較低能力）
  if ((m = s.match(/^較低的玩家ATK或DEF再?-([\d.]+)%\s*(\d)回合$/))) {
    return { type: "playerStatus", id: "lowerStatDown", stat: "lower", unit: "pct", strength: num(m[1]), duration: num(m[2]) };
  }
  return null;
}

// 大王階段被動（PRD 54：HP 70%/40% 更新,不得額外立即攻擊）。
// counterSummary 尾句格式固定：「…；70% HP<效果>，40% HP<效果>」,效果詞彙 8 類。
function parsePhaseClause(clause) {
  const s = clause.trim().replace(/，?(?:仍可(?:完整)?破解|狀態仍受破解)$/, "");
  let m;
  if ((m = s.match(/^(?:護盾量?\+?|獲一次)([\d.]+)%?護?盾?$/))) return { shieldPct: Number(m[1]) };
  if ((m = s.match(/^(?:技能傷害|基準傷害|多段總傷|總傷|傷害)\+([\d.]+)%$/))) return { damagePct: Number(m[1]) };
  if ((m = s.match(/^減傷\+?([\d.]+)%$/))) return { reductionPct: Number(m[1]) };
  if ((m = s.match(/^反射\+([\d.]+)%$/))) return { reflectPct: Number(m[1]) };
  if ((m = s.match(/^狀態幅度\+([\d.]+)%$/))) return { statusPct: Number(m[1]) };
  if ((m = s.match(/^延遲段\+([\d.]+)%$/))) return { delayedPct: Number(m[1]) };
  if ((m = s.match(/^(?:穿盾|無視護盾再)\+([\d.]+)%$/))) return { shieldPiercePct: Number(m[1]) };
  return null;
}

export function parsePhasePassives(counterSummary = "") {
  const match = counterSummary.match(/70%\s*HP(.+?)，40%\s*HP(.+)$/);
  if (!match) return null;
  const p70 = parsePhaseClause(match[1]);
  const p40 = parsePhaseClause(match[2]);
  if (!p70 || !p40) return { error: counterSummary };
  return { p70, p40 };
}

// 整條 signatureSummary → { skillId, name, blocks[], challenge? }
export function parseSignatureSummary(monster) {
  const raw = monster.signatureSummary || "";
  const sep = raw.indexOf("：");
  const body = sep >= 0 ? raw.slice(sep + 1) : raw;
  const segments = body.split(/[；;＋]/).map(x => x.trim()).filter(Boolean);
  const blocks = [];
  const errors = [];
  let challenge = null;
  for (const segment of segments) {
    const block = parseSignatureSegment(segment);
    if (!block) { errors.push(segment); continue; }
    if (block.type === "none") continue;
    if (block.type === "challenge") { challenge = { ...block, onFail: null, onSuccessDamageBuffPct: 0 }; continue; }
    if (block.type === "challengeFail") {
      if (challenge) challenge.onFail = block.status; else errors.push(segment);
      continue;
    }
    if (block.type === "challengeSuccess") {
      if (challenge) challenge.onSuccessDamageBuffPct = block.damageBuffPct; else errors.push(segment);
      continue;
    }
    blocks.push(block);
  }
  if (challenge) blocks.push({ type: "challenge", ...challenge });
  const phases = monster.encounter === "boss" ? parsePhasePassives(monster.counterSummary || "") : null;
  if (phases?.error) errors.push(`phase:${phases.error}`);
  return {
    skillId: monster.signatureSkillId,
    monsterId: monster.id,
    name: monster.signatureName,
    counterSummary: monster.counterSummary || "",
    blocks,
    phases: phases?.error ? null : phases,
    errors,
  };
}

// 全 252 隻一次結構化（module load 執行一次;錯誤集中在 validate 揪）
export const SIGNATURE_EFFECTS = Object.freeze(Object.fromEntries(
  EXPANSION_MONSTERS
    .filter(monster => monster.signatureSkillId)
    .map(monster => [monster.signatureSkillId, parseSignatureSummary(monster)])
));

export function getSignatureEffect(skillId) {
  return SIGNATURE_EFFECTS[skillId] || null;
}

// 完整性驗證（PRD 72 前置檢查）：252 全解析、1~3 積木、傷害基準與遭遇類型一致
export function validateSignatureEffects() {
  const problems = [];
  const monstersById = Object.fromEntries(EXPANSION_MONSTERS.map(monster => [monster.id, monster]));
  const entries = Object.values(SIGNATURE_EFFECTS);
  if (entries.length !== 252) problems.push(`count:${entries.length}`);
  for (const entry of entries) {
    if (entry.errors.length) problems.push(`${entry.skillId}:unparsed:${entry.errors.join("|")}`);
    if (entry.blocks.length < 1 || entry.blocks.length > 3) problems.push(`${entry.skillId}:block_count:${entry.blocks.length}`);
    const monster = monstersById[entry.monsterId];
    if (monster?.encounter === "boss" && !entry.phases) problems.push(`${entry.skillId}:missing_phases`);
    for (const block of entry.blocks) {
      if ((block.type === "damage" || block.type === "delayedBurst") && block.baseKind && monster
          && block.baseKind !== monster.encounter) {
        problems.push(`${entry.skillId}:base_kind_mismatch:${block.baseKind}vs${monster.encounter}`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
