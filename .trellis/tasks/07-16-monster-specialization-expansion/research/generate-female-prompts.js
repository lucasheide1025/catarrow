// C7-female：女性外觀變體 prompt 產生器（A 路線：只改角色外觀,不動 catalog/ID/名稱/artKey）。
// task-local research。執行：node generate-female-prompts.js → claude-female-monster-prompts.json
// 從正式 catalog 取 name/family/tier/encounter,套「御姐/高冷/全包覆/零色氣」框架 + 各族視覺語言。

const fs = require("fs");
const path = require("path");
const cat = require("../../../../src/data/monsterExpansionCatalog.json");
const byId = Object.fromEntries(cat.monsters.map(m => [m.id, m]));

const FAMILY_ART = {
  ghost:     { palette: "deep indigo-violet, cyan-green nightglow, silver starlight", motifs: "lanterns, star-mist, glowing spirit-runes, flowing veils", attire: "flowing high-collar spirit robe with long draping sleeves" },
  mountain:  { palette: "earthy greens and browns, mossy stone, warm gold", motifs: "leaf-armor, cloak, wind and falling leaves, longbow", attire: "layered ranger tunic, cloak, leather bracers and boots" },
  insect:    { palette: "glowing green-violet, metallic carapace, amber", motifs: "luminous translucent butterfly/crystal wings (fairy-like, NOT a realistic insect)", attire: "ornate carapace-plated fae-knight armor" },
  workplace: { palette: "brass gold, parchment brown, seal red", motifs: "glowing contract seals, scrolls, arcane workshop tools (fantasy artisan, NOT modern office)", attire: "high-collar arcane robe with brass ornaments" },
  exam:      { palette: "indigo, parchment gold, ink black", motifs: "silver quill, floating runic scrolls, arithmetic magic circles", attire: "scholarly high-collar mage robe" },
  temple:    { palette: "stone-white, rune-blue, holy gold", motifs: "runic magic circles, shield and blade, castle, dragon crest", attire: "ornate paladin armor or high-collar mage dress" },
  treasure:  { palette: "gold and silver, rainbow gemstone light", motifs: "gemstones, crown, faintly crystalline skin, prismatic glow", attire: "ornate full-coverage gemstone gown" },
};
const TIER_DESC = { 1:"apprentice/tier-1 form, humble simple accessories", 2:"early-tier, basic gear", 3:"elite, refined gear with early energy effects", 4:"empowered, ornate gear and clear aura", 5:"regal, strong effects, larger presence", 6:"legendary top-tier, extremely ornate, grandest presence" };
const ENC_SIL = { normal:"clear standard silhouette, no crown", miniBoss:"a crown/insignia and extra ornamentation, silhouette clearly reads as a MINI-BOSS", boss:"grand kingly/queenly aura and signature effects, silhouette instantly reads as a BOSS" };

// 御姐/高冷 + 全包覆 + 零色氣（強制,勿刪）
const FEMALE_FRAME =
  "a mature, cool and aloof, dignified adult woman; tall, statuesque, elegant and poised; confident regal/heroic bearing and a calm, slightly aloof expression. " +
  "FULL-COVERAGE, modest, tasteful attire; NOT sexualized — fully-clothed, no cleavage, no revealing or tight fanservice outfit, no suggestive pose, no body-part emphasis; wholesome and all-ages appropriate.";
const GLOBAL_TAIL =
  "Fully transparent background (alpha, no scenery). Clean readable silhouette, character centered with generous safe margin, portrait 3:4, painterly trading-card-game illustration, soft rim light. No horror, no gore, no scary face.";

// 14 候選（monsterId → 專屬設計方向）;非人形怪不列入(維持生物感)
const CANDIDATES = [
  { id: "mountain_t2_mini_b", dir: "an elf-like woodland huntress holding an elegant longbow (archery hero)", approved: true },
  { id: "ghost_t6_mini_b",    dir: "a serene star-mist spirit queen wreathed in drifting star-veils and constellations", approved: true },
  { id: "ghost_t4_mini_a",    dir: "a composed night-watch lantern officer holding a softly glowing lantern" },
  { id: "insect_t6_mini_b",   dir: "a graceful crystal/butterfly-wing fae knight with luminous translucent wings (fairy, not a bug)" },
  { id: "insect_t4_mini_b",   dir: "an agile storm-wing fae scout with glowing lightning-crystal wings" },
  { id: "workplace_t5_mini_b",dir: "an arcane contract sorceress / chief officer wielding glowing seals and scrolls (fantasy, not modern office)" },
  { id: "exam_t2_mini_a",     dir: "a scholarly examiner sorceress with a silver quill and floating runic scrolls" },
  { id: "exam_t2_boss",       dir: "a wise grand-sage sorceress in star-chart robes, queenly aura" },
  { id: "temple_t3_mini_b",   dir: "a rune paladin sorceress with a glowing runic circle and shield" },
  { id: "temple_t2_mini_a",   dir: "a heroic silver-shield vanguard knight-woman" },
  { id: "treasure_t6_mini_b", dir: "a prismatic gem fae queen with faintly crystalline skin and a rainbow-crystal crown" },
  { id: "workplace_t2_mini_a",dir: "a fantasy workshop artisan-master woman with arcane tools, a touch of gentle humor (not modern office)" },
  { id: "mountain_t2_mini_a", dir: "a rugged-yet-elegant stone-armored scout woman" },
  { id: "ghost_t2_mini_a",    dir: "a gentle apprentice lantern-spirit maiden, fresh and calm" },
];

function buildPrompt(m, dir) {
  const fam = FAMILY_ART[m.family];
  return [
    `Elegant trading-card-game character art of ${dir}.`,
    `She is ${FEMALE_FRAME}`,
    `Family visual language: ${fam.motifs}; attire style: ${fam.attire}; palette: ${fam.palette}.`,
    `Tier feel: ${TIER_DESC[m.tierIndex]}. Encounter: ${ENC_SIL[m.encounter]}.`,
    GLOBAL_TAIL,
  ].join(" ");
}

const out = CANDIDATES.map(c => {
  const m = byId[c.id];
  if (!m) throw new Error(`catalog 缺 ${c.id}`);
  return {
    monsterId: m.id, name: m.name, family: m.family, tier: "T" + m.tierIndex,
    encounter: m.encounter, artKey: m.card.artKey, approved: !!c.approved,
    designDirection: c.dir,
    femaleVariantPrompt: buildPrompt(m, c.dir),
  };
});

// 驗證：皆在 catalog、皆非既有(existing:false)、涵蓋族系分布、未動 artKey
const errors = [];
out.forEach(e => { const m = byId[e.monsterId];
  if (!m) errors.push(`${e.monsterId} 不在 catalog`);
  if (m && m.existing) errors.push(`${e.monsterId} 是既有怪(不應改)`);
  if (m && e.artKey !== m.card.artKey) errors.push(`${e.monsterId} artKey 被更動`);
});
const famCover = [...new Set(out.map(e => e.family))];
const doc = {
  generatedAt: new Date().toISOString().slice(0, 10),
  route: "A（只改 prompt 角色外觀,不動 catalog/ID/名稱/cardId/artKey）",
  aesthetic: "御姐/高冷/成熟英氣、體態優雅有型;全包覆得體、零色氣、全年齡",
  count: out.length, familiesCovered: famCover,
  validation: { ok: errors.length === 0, errors },
  candidates: out,
};
fs.writeFileSync(path.join(__dirname, "claude-female-monster-prompts.json"), JSON.stringify(doc, null, 2));
console.log(`女性外觀候選：${out.length} 隻;涵蓋族系：${famCover.join(", ")}`);
console.log(`遭遇分布：`, out.reduce((a, e) => (a[e.encounter] = (a[e.encounter] || 0) + 1, a), {}));
console.log(errors.length ? `❌ ${errors.join("; ")}` : "✅ 驗證通過(皆在catalog/皆非既有/artKey未動)");
