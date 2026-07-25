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
export const GUILD_EQUIP_ARCHETYPES = Object.freeze({
  // ── 弓（主攻）──
  wood_bow:   { slot: "bow", name: "木弓",   icon: "🏹", weight: 2.0, base: { atk: 8,  agi: 2 } },
  iron_bow:   { slot: "bow", name: "鐵弓",   icon: "🏹", weight: 3.0, base: { atk: 12, def: 2 } },
  hunter_bow: { slot: "bow", name: "獵弓",   icon: "🏹", weight: 1.8, base: { atk: 9,  agi: 5, luk: 3 } }, // 偏敏捷幸運
  long_bow:   { slot: "bow", name: "長弓",   icon: "🏹", weight: 3.5, base: { atk: 16 } },                 // 偏純攻擊
  // ── 箭（增傷/特效）──
  wood_arrow:  { slot: "arrow", name: "木箭",   icon: "➶", weight: 0.5, base: { atk: 3 } },
  sharp_arrow: { slot: "arrow", name: "利箭",   icon: "➶", weight: 0.6, base: { atk: 5, luk: 2 } },
  heavy_arrow: { slot: "arrow", name: "重箭",   icon: "➶", weight: 1.0, base: { atk: 7, agi: -1 } },
  // ── 護具（防禦/生命）──
  cloth_armor:   { slot: "armor", name: "布甲",   icon: "🛡️", weight: 1.5, base: { hp: 30, def: 4 } },
  leather_armor: { slot: "armor", name: "皮甲",   icon: "🛡️", weight: 2.5, base: { hp: 45, def: 7, agi: -1 } },
  scout_armor:   { slot: "armor", name: "斥候衣", icon: "🛡️", weight: 1.2, base: { hp: 25, def: 3, agi: 4 } }, // 偏敏
  // ── 箭袋（容量/敏捷/幸運）──
  small_quiver:  { slot: "quiver", name: "小箭袋", icon: "🎯", weight: 1.0, base: { agi: 3, vit: 2 } },
  ranger_quiver: { slot: "quiver", name: "遊俠箭袋", icon: "🎯", weight: 1.5, base: { agi: 5, luk: 3 } },
  // ── 藥水袋（體力/生存）──
  potion_pouch_s: { slot: "potionPouch", name: "小藥水袋", icon: "🧪", weight: 1.0, base: { vit: 6, hp: 20 } }, // 偏體力
  potion_pouch_l: { slot: "potionPouch", name: "大藥水袋", icon: "🧪", weight: 2.0, base: { vit: 12, hp: 40, def: 2 } },
});

// 取某件裝備（archetype × grade）的實際六維
export function resolveEquipStats(archetypeId, grade) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return {};
  const m = GRADE_MULT[grade] || 1;
  const out = {};
  for (const [k, v] of Object.entries(a.base)) out[k] = Math.round(v * m);
  return out;
}

// 取某件裝備的重量（品級略增重）
export function resolveEquipWeight(archetypeId, grade) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return 0;
  const tier = GRADE_META[grade]?.tier || 1;
  return Math.round((a.weight * (1 + (tier - 1) * 0.05)) * 10) / 10;
}

// 顯示名（含品級）
export function equipDisplayName(archetypeId, grade) {
  const a = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!a) return archetypeId;
  return `${GRADE_META[grade]?.label || ""}${a.name}`;
}
