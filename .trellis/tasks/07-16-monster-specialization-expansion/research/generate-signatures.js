// C3 招牌技能產生器（task-local research）
// 讀 monster-roster-draft.json + ability-catalog-draft.json 的 familySignatureThemes，
// 為 252 隻各生成 1 個招牌技能（sig_{monsterId}），由 effectBlocks 組合。
// 執行：node generate-signatures.js → signature-catalog-draft.json

const fs = require("fs");
const path = require("path");
const roster = require("./monster-roster-draft.json");
const catalog = require("./ability-catalog-draft.json");
const THEMES = catalog.familySignatureThemes;

// tier 分段值：t12/t34/t56 對應強度係數（招牌隨 Tier 放大）
const tierSeg = idx => (idx <= 2 ? "t12" : idx <= 4 ? "t34" : "t56");
const SEG_MULT = { t12: 1.0, t34: 1.35, t56: 1.7 };

// 每個 encounter 的目標與積木數
const ENC = {
  normal:   { target: "single", telegraph: true, blockN: 1 },
  miniBoss: { target: "single", telegraph: true, blockN: 2 },
  bigBoss:  { target: "party",  telegraph: true, blockN: 3 }, // 大王全隊招牌，必須預告
};

function blocksFor(fam, encounter) {
  const th = THEMES[fam];
  const core = th.coreBlocks;
  const boss = th.bossBlocks;
  if (encounter === "normal") return [core[0]];
  if (encounter === "miniBoss") return [core[0], core[1]];
  // bigBoss: core[0] + boss[0] + boss[1]（去重）
  return [...new Set([core[0], boss[0], boss[1]])].slice(0, 3);
}

const sigs = [];
const seen = new Set();
for (const m of roster) {
  const enc = ENC[m.encounter];
  const seg = tierSeg(m.tierIndex);
  const id = `sig_${m.id}`;
  if (seen.has(id)) throw new Error(`dup signature ${id}`);
  seen.add(id);
  sigs.push({
    id,
    monsterId: m.id,
    name: `${m.name}·絕技`,
    family: m.family,
    encounter: m.encounter,
    target: enc.target,
    telegraph: enc.telegraph,
    trigger: "scheduled",
    blocks: blocksFor(m.family, m.encounter),
    tierSegment: seg,
    intensityMult: SEG_MULT[seg],
    counter: m.family === "exam" ? "scoreBreak" : "hqHitBreak",
    _todo: "數值/文案待 Codex/使用者潤色;積木參數由 resolver 依 intensityMult 套 Tier",
  });
}

// 驗證
const errs = [];
if (sigs.length !== 252) errs.push(`招牌數 ${sigs.length} ≠ 252`);
const monsterIds = new Set(roster.map(m => m.id));
for (const s of sigs) {
  if (!monsterIds.has(s.monsterId)) errs.push(`${s.id} 對應怪物 ${s.monsterId} 不存在`);
  if (s.blocks.length < 1 || s.blocks.length > 3) errs.push(`${s.id} 積木數 ${s.blocks.length} 超出 1-3`);
}
const byEnc = sigs.reduce((a, s) => (a[s.encounter] = (a[s.encounter]||0)+1, a), {});

fs.writeFileSync(path.join(__dirname, "signature-catalog-draft.json"), JSON.stringify(sigs, null, 2));
console.log("=== C3 招牌產生結果 ===");
console.log(`招牌：${sigs.length}（一般 ${byEnc.normal} / 小王 ${byEnc.miniBoss} / 大王 ${byEnc.bigBoss}）`);
console.log(`唯一 ID：${seen.size}`);
console.log(errs.length ? `❌ 驗證失敗:\n- ${errs.join("\n- ")}` : "✅ 驗證通過（數量252/唯一/積木1-3/對應怪物存在）");
