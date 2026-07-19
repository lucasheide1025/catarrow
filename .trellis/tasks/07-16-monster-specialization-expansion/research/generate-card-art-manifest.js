// C7 卡圖 manifest 產生器（task-local research，不碰 production）。
// 讀正式 catalog → 為 192 隻新增怪物(existing:false)產出圖片 manifest + prompt + 批次 + 驗證。
// 執行：node generate-card-art-manifest.js
//   → claude-card-art-manifest.json（192 entries + batches + validation）

const fs = require("fs");
const path = require("path");
const cat = require("../../../../src/data/monsterExpansionCatalog.json");

const TIER_LABEL = ["", "T1", "T2", "T3", "T4", "T5", "T6"];
const ENCOUNTER_ZH = { normal: "一般怪", miniBoss: "小王", boss: "大王" };

// 各族視覺語言（同族共用;避免項對齊 PRD 兒童友善規範）
const FAMILY_ART = {
  ghost:     { theme: "幽冥奇幻：夜光精靈、影子騎士、星霧守衛", palette: "深藍紫、青綠夜光、銀白微光", motifs: "燈籠、星霧、靈光紋、飄帶", avoid: "血腥、屍體、骷髏臉、恐怖表情" },
  mountain:  { theme: "山林巨獸與岩石守衛", palette: "大地綠棕、苔石灰、岩金", motifs: "岩甲、獸角、森風、巨龍鱗", avoid: "血腥獵殺、傷口" },
  insect:    { theme: "帥氣甲蟲騎士與晶翼斥候", palette: "螢光綠紫、甲殼金屬、琥珀", motifs: "甲殼盔甲、晶翼、奇幻毒光", avoid: "寫實蟲害、密集蟲群、噁心黏液" },
  workplace: { theme: "奇幻職人：工坊監督、契約守衛（帶點幽默）", palette: "黃銅金、羊皮卷棕、印章紅", motifs: "工坊器具、卷軸契約、金庫、印章", avoid: "科技公司、電競、純表情包、現代辦公室" },
  exam:      { theme: "學術魔法與試煉守衛", palette: "靛藍、羊皮金、墨黑", motifs: "符文卷軸、算式法陣、榮譽冠", avoid: "壓迫恐怖、焦慮驚嚇" },
  temple:    { theme: "西方奇幻騎士、符文法衛、巨龍", palette: "石灰白、符文藍、聖金", motifs: "城堡、符文法陣、盾劍、巨龍", avoid: "血腥、殘暴" },
  treasure:  { theme: "寶箱魔像與珠寶守衛", palette: "金銀、寶石彩光、絲絨紅", motifs: "寶箱、王冠、寶石、金幣、鎖鏈", avoid: "貪婪醜化、恐怖臉" },
};
const TIER_DESC = {
  1: "見習階：體型較小、裝備簡樸、柔和光效",
  2: "初階：基礎裝備、初現能量紋",
  3: "精銳：精良裝備、能量特效初現",
  4: "強權：華麗裝備、明顯氣場光環",
  5: "王階：威嚴姿態、強烈特效、體型放大",
  6: "傳說：傳說級裝備、極致特效、最大氣勢",
};
const ENCOUNTER_SIL = {
  normal:  "標準體型、清楚易辨的剪影、無王冠",
  miniBoss:"體型放大、加頭冠/徽記與額外裝飾，剪影明顯區別於一般怪",
  boss:    "最大體型、王者光環與招牌特效，剪影一眼可辨為大王",
};

const GLOBAL_STYLE = "帥氣有震撼感但兒童友善的奇幻集換卡插畫；乾淨可辨識的角色剪影；角色置中、四周安全留白；透明背景(webp alpha)；直式 3:4；適合手機小卡置中裁切；避免恐怖、血腥、屍體、寫實蟲害與驚嚇臉";

function buildPrompt(m) {
  const fam = FAMILY_ART[m.family];
  return [
    `【${ENCOUNTER_ZH[m.encounter]}・${TIER_LABEL[m.tierIndex]}】${m.name}`,
    `族系視覺：${fam.theme}`,
    `色彩：${fam.palette}；元素：${fam.motifs}`,
    `階級：${TIER_DESC[m.tierIndex]}`,
    `角色定位：${ENCOUNTER_SIL[m.encounter]}`,
    `全域風格：${GLOBAL_STYLE}`,
    `嚴禁：${fam.avoid}`,
  ].join("\n");
}

const newMonsters = cat.monsters.filter(m => !m.existing);
const existingIds = new Set(cat.monsters.filter(m => m.existing).map(m => m.id));

const entries = newMonsters.map(m => ({
  monsterId: m.id,
  name: m.name,
  family: m.family,
  tier: TIER_LABEL[m.tierIndex],
  tierIndex: m.tierIndex,
  encounter: m.encounter,
  encounterZh: ENCOUNTER_ZH[m.encounter],
  role: m.role,
  artKey: m.card.artKey,
  outputFile: `${m.card.artKey}.webp`,
  outputPath: `public/cards/monsters/${m.card.artKey}.webp`,
  prompt: buildPrompt(m),
}));

// ── 批次（每批 16，同族相鄰 Tier 一起做以維持一致性）──
entries.sort((a, b) =>
  a.family.localeCompare(b.family) || a.tierIndex - b.tierIndex ||
  ["normal", "miniBoss", "boss"].indexOf(a.encounter) - ["normal", "miniBoss", "boss"].indexOf(b.encounter));
const BATCH = 16;
const batches = [];
for (let i = 0; i < entries.length; i += BATCH) {
  const slice = entries.slice(i, i + BATCH);
  batches.push({
    batch: batches.length + 1,
    count: slice.length,
    families: [...new Set(slice.map(e => e.family))],
    tiers: [...new Set(slice.map(e => e.tier))].sort(),
    ids: slice.map(e => e.monsterId),
  });
}

// ── 驗證 ──
const errors = [];
if (entries.length !== 192) errors.push(`新增卡圖數 ${entries.length} ≠ 192`);
const allIds = new Set(cat.monsters.map(m => m.id));
entries.forEach(e => { if (!allIds.has(e.monsterId)) errors.push(`${e.monsterId} 不在 catalog`); });
if (new Set(entries.map(e => e.outputFile)).size !== entries.length) errors.push("輸出檔名有重複");
// 不得覆蓋既有 60 張：新 artKey 不可落在 existing id 集合;且實體檔案不可已存在
entries.forEach(e => {
  if (existingIds.has(e.artKey)) errors.push(`${e.artKey} 與既有怪物 ID 衝突`);
  if (fs.existsSync(path.join(__dirname, "../../../../", e.outputPath))) errors.push(`${e.outputPath} 已存在(會覆蓋)`);
});

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  imageSpec: {
    format: "webp (alpha)", ratio: "3:4 直式", recommendedSize: "768×1024",
    background: "透明", safeMargin: "四周 ≥8% 安全留白，角色主體置中",
    mobileCropZone: "中央 3:4 全可見（小卡以 objectFit:cover 顯示 3:4，勿把重點放邊緣）",
    note: "⚠️ 既有 60 張為 768×576(4:3)不透明 lossy;新圖採透明直式為 go-forward 標準,舊 60 是否重製由 Codex 決定(不在 C7)",
  },
  styleRules: GLOBAL_STYLE,
  familyVisualLanguage: FAMILY_ART,
  tierProgression: TIER_DESC,
  encounterSilhouette: ENCOUNTER_SIL,
  totalNew: entries.length,
  batchSize: BATCH,
  batchCount: batches.length,
  validation: { ok: errors.length === 0, errors },
  batches,
  entries,
};
fs.writeFileSync(path.join(__dirname, "claude-card-art-manifest.json"), JSON.stringify(out, null, 2));

console.log(`新增卡圖：${entries.length} 張`);
console.log(`批次：${batches.length} 批 × ${BATCH} 張`);
console.log(`唯一檔名：${new Set(entries.map(e => e.outputFile)).size}`);
console.log(`與既有 60 衝突：${entries.filter(e => existingIds.has(e.artKey)).length}`);
console.log(errors.length ? `❌ 驗證失敗:\n- ${errors.slice(0, 10).join("\n- ")}` : "✅ 驗證通過(192/唯一檔名/皆在catalog/不覆蓋既有)");
console.log("\n範例 prompt:\n" + entries[0].prompt);
