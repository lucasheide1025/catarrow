// src/guild/data/guildEquipCatalog.js
// ─────────────────────────────────────────────────────────────
// 冒險者公會「專屬裝備」資料表（ARPG 式 itemization）。
// 每個槽有多種「基礎裝 archetype」，每種基礎裝各有 6 個品級（common→mythic）。
// 實際六維 = base × GRADE_MULT[grade]（＋日後強化/詞綴）。
// ⚠️ 隔離：本檔與其數值「只」被公會遠征戰力用，永不進主線 RPG。
// ─────────────────────────────────────────────────────────────

// 5 槽（保留擴充第 6 槽）
export const GUILD_SLOTS = ["bow", "arrow", "armor", "quiver", "potionPouch"];

export const SLOT_META = {
  bow:         { name: "弓",     icon: "🏹" },
  arrow:       { name: "箭",     icon: "➶" },
  armor:       { name: "護具",   icon: "🛡️" },
  quiver:      { name: "箭袋",   icon: "🎯" },
  potionPouch: { name: "藥水袋", icon: "🧪" },
};

// 6 品級（T1→T6），品級倍率放大六維
export const GRADES = ["common", "rare", "elite", "fierce", "boss", "mythic"];
export const GRADE_META = {
  common: { tier: 1, label: "粗製", color: "#9ca3af" },
  rare:   { tier: 2, label: "精良", color: "#4ade80" },
  elite:  { tier: 3, label: "優秀", color: "#60a5fa" },
  fierce: { tier: 4, label: "稀有", color: "#c084fc" },
  boss:   { tier: 5, label: "史詩", color: "#fb923c" },
  mythic: { tier: 6, label: "傳說", color: "#fbbf24" },
};
export const GRADE_MULT = { common: 1.0, rare: 1.4, elite: 1.9, fierce: 2.5, boss: 3.2, mythic: 4.0 };

// 基礎裝 archetype：slot + 六維 base（偏向）+ weight（與補給爭背包容量）。
// 六維鍵：hp / atk / agi / def / vit / luk。
// 2026-07-25 大幅擴充（作者要求「裝備要非常非常豐富」）：
// 每槽 7~9 種基礎裝 × 6 品級 = **240 組以上**，各有明確流派偏向（純攻／敏捷／坦／幸運／體力）。
// 舊有 14 個 id 全部保留（存檔與商店設定不會斷）。負重是取捨的核心：強的通常也重。
export const GUILD_EQUIP_ARCHETYPES = Object.freeze({
  // ── 弓（主攻）9 種 ──
  wood_bow:     { slot: "bow", name: "木弓",     icon: "🏹", weight: 2.0, base: { atk: 8,  agi: 2 } },
  iron_bow:     { slot: "bow", name: "鐵弓",     icon: "🏹", weight: 3.0, base: { atk: 12, def: 2 } },
  hunter_bow:   { slot: "bow", name: "獵弓",     icon: "🏹", weight: 1.8, base: { atk: 9,  agi: 5, luk: 3 } },  // 偏敏捷幸運
  long_bow:     { slot: "bow", name: "長弓",     icon: "🏹", weight: 3.5, base: { atk: 16 } },                  // 偏純攻擊
  short_bow:    { slot: "bow", name: "短弓",     icon: "🏹", weight: 1.2, base: { atk: 6,  agi: 7 } },          // 極輕、拚額外箭
  horn_bow:     { slot: "bow", name: "獸角弓",   icon: "🏹", weight: 2.8, base: { atk: 13, hp: 20 } },
  bamboo_bow:   { slot: "bow", name: "竹弓",     icon: "🏹", weight: 1.5, base: { atk: 7,  vit: 4, agi: 3 } },  // 省補給
  siege_bow:    { slot: "bow", name: "攻城弩",   icon: "🏹", weight: 5.0, base: { atk: 22, agi: -4 } },         // 最重最痛
  spirit_bow:   { slot: "bow", name: "靈弓",     icon: "🏹", weight: 2.2, base: { atk: 11, luk: 8 } },          // 幸運流核心

  // ── 箭（增傷/特效）8 種 ──
  wood_arrow:    { slot: "arrow", name: "木箭",   icon: "➶", weight: 0.5, base: { atk: 3 } },
  sharp_arrow:   { slot: "arrow", name: "利箭",   icon: "➶", weight: 0.6, base: { atk: 5, luk: 2 } },
  heavy_arrow:   { slot: "arrow", name: "重箭",   icon: "➶", weight: 1.0, base: { atk: 7, agi: -1 } },
  bodkin_arrow:  { slot: "arrow", name: "破甲箭", icon: "➶", weight: 0.8, base: { atk: 8, def: 1 } },
  feather_arrow: { slot: "arrow", name: "羽箭",   icon: "➶", weight: 0.4, base: { atk: 4, agi: 4 } },
  poison_arrow:  { slot: "arrow", name: "淬毒箭", icon: "➶", weight: 0.7, base: { atk: 9, vit: -2 } },
  blessed_arrow: { slot: "arrow", name: "祝福箭", icon: "➶", weight: 0.6, base: { atk: 6, luk: 5 } },
  fire_arrow:    { slot: "arrow", name: "火矢",   icon: "➶", weight: 0.9, base: { atk: 11, agi: -2 } },

  // ── 護具（防禦/生命）8 種 ──
  cloth_armor:   { slot: "armor", name: "布甲",     icon: "🛡️", weight: 1.5, base: { hp: 30, def: 4 } },
  leather_armor: { slot: "armor", name: "皮甲",     icon: "🛡️", weight: 2.5, base: { hp: 45, def: 7, agi: -1 } },
  scout_armor:   { slot: "armor", name: "斥候衣",   icon: "🛡️", weight: 1.2, base: { hp: 25, def: 3, agi: 4 } },
  chain_armor:   { slot: "armor", name: "鎖子甲",   icon: "🛡️", weight: 3.5, base: { hp: 60, def: 11, agi: -3 } },
  plate_armor:   { slot: "armor", name: "板甲",     icon: "🛡️", weight: 5.0, base: { hp: 80, def: 16, agi: -6 } }, // 坦到極致
  robe_armor:    { slot: "armor", name: "旅人長袍", icon: "🛡️", weight: 1.0, base: { hp: 20, def: 2, vit: 6 } },   // 省補給
  hide_armor:    { slot: "armor", name: "獸皮衣",   icon: "🛡️", weight: 2.2, base: { hp: 50, def: 6, vit: 3 } },
  fortune_vest:  { slot: "armor", name: "福運背心", icon: "🛡️", weight: 1.8, base: { hp: 35, def: 5, luk: 6 } },

  // ── 箭袋（容量/敏捷/幸運）7 種 ──
  small_quiver:   { slot: "quiver", name: "小箭袋",   icon: "🎯", weight: 1.0, base: { agi: 3, vit: 2 } },
  ranger_quiver:  { slot: "quiver", name: "遊俠箭袋", icon: "🎯", weight: 1.5, base: { agi: 5, luk: 3 } },
  hunter_quiver:  { slot: "quiver", name: "獵人箭袋", icon: "🎯", weight: 1.8, base: { agi: 4, atk: 4 } },
  wide_quiver:    { slot: "quiver", name: "寬口箭袋", icon: "🎯", weight: 2.2, base: { vit: 8, agi: 2 } },        // 負重流
  swift_quiver:   { slot: "quiver", name: "疾風箭袋", icon: "🎯", weight: 1.1, base: { agi: 9 } },                // 極敏
  gilded_quiver:  { slot: "quiver", name: "鎏金箭袋", icon: "🎯", weight: 1.6, base: { luk: 9, agi: 2 } },        // 極幸運
  war_quiver:     { slot: "quiver", name: "戰用箭袋", icon: "🎯", weight: 2.6, base: { atk: 6, def: 3, hp: 15 } },

  // ── 藥水袋（體力/生存）7 種 ──
  potion_pouch_s: { slot: "potionPouch", name: "小藥水袋", icon: "🧪", weight: 1.0, base: { vit: 6, hp: 20 } },
  potion_pouch_l: { slot: "potionPouch", name: "大藥水袋", icon: "🧪", weight: 2.0, base: { vit: 12, hp: 40, def: 2 } },
  herb_pouch:     { slot: "potionPouch", name: "草藥囊",   icon: "🧪", weight: 0.8, base: { vit: 8, agi: 2 } },
  ration_pack:    { slot: "potionPouch", name: "乾糧包",   icon: "🧪", weight: 1.4, base: { vit: 16, hp: 15 } },   // 續航之王
  alchemy_kit:    { slot: "potionPouch", name: "煉金工具", icon: "🧪", weight: 2.4, base: { vit: 10, luk: 5, atk: 3 } },
  medic_bag:      { slot: "potionPouch", name: "急救包",   icon: "🧪", weight: 1.9, base: { hp: 60, vit: 6 } },    // 血牛
  waterskin:      { slot: "potionPouch", name: "水囊",     icon: "🧪", weight: 0.6, base: { vit: 5, def: 1 } },
});

// ── 詞綴（2026-07-25）：讓同名同品級的裝備也有差異，刷裝才有意義 ──
// pct = 對該件裝備自身六維的百分比加成；flat = 直接加值。
// 掉落時依危險度 roll 0~2 條（見 settleExpedition），商店貨一律無詞綴（更凸顯「打到的比較好」）。
export const GUILD_AFFIXES = Object.freeze({
  sharp:     { name: "銳利",   icon: "⚔️", pct: { atk: 0.25 } },
  brutal:    { name: "兇暴",   icon: "💢", pct: { atk: 0.40 }, flat: { agi: -2 } },
  sturdy:    { name: "堅韌",   icon: "🛡️", pct: { def: 0.30 } },
  vital:     { name: "強壯",   icon: "❤️", pct: { hp: 0.30 } },
  swift:     { name: "疾風",   icon: "💨", flat: { agi: 4 } },
  lucky:     { name: "幸運",   icon: "🍀", flat: { luk: 5 } },
  enduring:  { name: "耐勞",   icon: "🍖", flat: { vit: 5 } },
  balanced:  { name: "均衡",   icon: "⚖️", pct: { atk: 0.12, def: 0.12, hp: 0.12 } },
  hunters:   { name: "獵手",   icon: "🎯", pct: { atk: 0.18 }, flat: { luk: 3 } },
  guardians: { name: "守衛",   icon: "🏰", pct: { def: 0.20, hp: 0.15 } },
});
export const AFFIX_IDS = Object.freeze(Object.keys(GUILD_AFFIXES));

// ── 強化（+N）──
// 每級 +8% 六維（對「品級後」的數值），必定成功（隨機性已經在掉落與詞綴上了，
// 強化再賭會變成挫敗來源）。上限依品級遞增 → 高階裝才值得長期投資。
export const PLUS_PCT_PER_LEVEL = 0.08;
export const PLUS_CAP_BY_GRADE = Object.freeze({ common: 3, rare: 5, elite: 7, fierce: 8, boss: 9, mythic: 10 });
export const plusCapOf = grade => PLUS_CAP_BY_GRADE[grade] || 3;

// 取某件裝備的實際六維。
// item 可傳 { plus, affixes }：先套品級倍率 → 加詞綴 → 再乘強化係數。
export function resolveEquipStats(archetypeId, grade, item = {}) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return {};
  const m = GRADE_MULT[grade] || 1;
  const base = {};
  for (const [k, v] of Object.entries(a.base)) base[k] = v * m;

  // 詞綴
  for (const id of item.affixes || []) {
    const af = GUILD_AFFIXES[id];
    if (!af) continue;
    for (const [k, p] of Object.entries(af.pct || {})) base[k] = (base[k] || 0) + (base[k] || 0) * p;
    for (const [k, f] of Object.entries(af.flat || {})) base[k] = (base[k] || 0) + f;
  }

  // 強化（夾在品級上限內）
  const plus = Math.max(0, Math.min(plusCapOf(grade), Math.floor(Number(item.plus) || 0)));
  const mult = 1 + plus * PLUS_PCT_PER_LEVEL;

  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.round(v * mult);
  return out;
}

// 取某件裝備的重量（品級略增重）
export function resolveEquipWeight(archetypeId, grade) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return 0;
  const tier = GRADE_META[grade]?.tier || 1;
  return Math.round((a.weight * (1 + (tier - 1) * 0.05)) * 10) / 10;
}

// 顯示名（含品級／詞綴／+N）。例：「銳利 精良獵弓 +3」
export function equipDisplayName(archetypeId, grade, item = {}) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return archetypeId;
  const affixPart = (item.affixes || []).map(id => GUILD_AFFIXES[id]?.name).filter(Boolean).join("");
  const plus = Math.max(0, Math.floor(Number(item.plus) || 0));
  return `${affixPart}${GRADE_META[grade]?.label || ""}${a.name}${plus > 0 ? ` +${plus}` : ""}`;
}

// 詞綴摘要（UI 標籤用）
export function affixTags(item = {}) {
  return (item.affixes || []).map(id => GUILD_AFFIXES[id]).filter(Boolean);
}
