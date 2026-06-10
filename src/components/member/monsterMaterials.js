// src/lib/monsterMaterials.js
// 怪物材料定義 + 材料圖鑑

export const MATERIALS = [
  // ── 殭屍系列 ──
  { id: "zombie_head",    name: "腐臭頭顱",   icon: "💀", monster: ["zombie_a","zombie_b"],   rarity: "common",   desc: "散發腐臭，但收藏家很喜歡" },
  { id: "zombie_heart",   name: "破爛心臟",   icon: "🖤", monster: ["zombie_a","zombie_b"],   rarity: "uncommon", desc: "還在微弱跳動，令人不安" },
  { id: "zombie_arm",     name: "斷手",       icon: "🦴", monster: ["zombie_a","zombie_b"],   rarity: "common",   desc: "不知道原本屬於誰的手" },
  { id: "zombie_axe",     name: "生鏽斧頭",   icon: "🪓", monster: ["zombie_b"],             rarity: "rare",     desc: "殭屍乙專用武器，鏽跡斑斑" },

  // ── 史萊姆系列 ──
  { id: "slime_shard",    name: "黏液碎片",   icon: "💧", monster: ["slime_a","slime_b"],    rarity: "common",   desc: "黏黏的，用來黏東西超好用" },
  { id: "slime_core",     name: "史萊姆核心", icon: "🫧", monster: ["slime_a"],             rarity: "uncommon", desc: "散發微弱的魔力光芒" },
  { id: "slime_core_big", name: "巨型核心",   icon: "🟢", monster: ["slime_b"],             rarity: "rare",     desc: "黏液史萊姆才有，純度極高" },
  { id: "slime_crystal",  name: "透明結晶",   icon: "💎", monster: ["slime_a","slime_b"],   rarity: "rare",     desc: "凝固的黏液形成的完美結晶" },

  // ── 獸人系列 ──
  { id: "orc_fang",       name: "獸人獠牙",   icon: "🦷", monster: ["orc"],                 rarity: "uncommon", desc: "咬合力超強，但現在沒用了" },
  { id: "orc_shield",     name: "破裂盾牌",   icon: "🛡️", monster: ["orc"],                 rarity: "rare",     desc: "被你的箭射破的盾牌碎片" },
  { id: "orc_hide",       name: "野豬皮",     icon: "🐗", monster: ["orc"],                 rarity: "common",   desc: "厚實耐用，做皮帶很適合" },

  // ── 壞老闆系列 ──
  { id: "boss_card",      name: "假笑名片",   icon: "📇", monster: ["bad_boss"],            rarity: "common",   desc: "印著『誠信第一』，笑死人" },
  { id: "boss_kpi",       name: "KPI報告",    icon: "📊", monster: ["bad_boss"],            rarity: "uncommon", desc: "全是假數字，但裝訂很精美" },
  { id: "boss_button",    name: "西裝鈕扣",   icon: "🔘", monster: ["bad_boss"],            rarity: "rare",     desc: "名牌西裝的最後一顆鈕扣" },

  // ── 奧客系列 ──
  { id: "karen_complaint",name: "投訴書",     icon: "📝", monster: ["obnoxious"],           rarity: "common",   desc: "密密麻麻的無理要求" },
  { id: "karen_tear",     name: "眼淚結晶",   icon: "😭", monster: ["obnoxious"],           rarity: "uncommon", desc: "凝固的鱷魚眼淚，無藥可救" },
  { id: "karen_glass",    name: "玻璃心碎片", icon: "💔", monster: ["obnoxious"],           rarity: "rare",     desc: "易碎品，請小心保存" },

  // ── 爛主管系列 ──
  { id: "mgr_pua",        name: "PUA語錄",    icon: "🗣️", monster: ["bad_mgr"],             rarity: "common",   desc: "『你要感謝我給你這個機會』" },
  { id: "mgr_overtime",   name: "加班申請表", icon: "📋", monster: ["bad_mgr"],             rarity: "uncommon", desc: "已蓋章，永遠無法請假" },
  { id: "mgr_review",     name: "過期績效單", icon: "⚠️", monster: ["bad_mgr"],             rarity: "rare",     desc: "寫著『有待加強』的考核表" },

  // ── 黑心包租婆系列 ──
  { id: "land_notice",    name: "漲租通知",   icon: "📬", monster: ["landlady"],            rarity: "common",   desc: "每個月都會收到，令人崩潰" },
  { id: "land_key",       name: "神秘鑰匙",   icon: "🗝️", monster: ["landlady"],            rarity: "uncommon", desc: "不知道開哪裡的門" },
  { id: "land_contract",  name: "過期契約",   icon: "📜", monster: ["landlady"],            rarity: "uncommon", desc: "霸王條款寫滿整張紙" },
  { id: "land_underwear", name: "神秘內衣",   icon: "👙", monster: ["landlady"],            rarity: "rare",     desc: "在浴室晾了三年，謎團重重" },

  // ── 期末考系列 ──
  { id: "exam_paper",     name: "考卷碎片",   icon: "📄", monster: ["final_exam"],          rarity: "common",   desc: "滿江紅，每個字都是眼淚" },
  { id: "exam_tear",      name: "崩潰眼淚",   icon: "💧", monster: ["final_exam"],          rarity: "uncommon", desc: "考前崩潰的真實眼淚，已乾燥" },
  { id: "exam_luck",      name: "僥倖通過書", icon: "🍀", monster: ["final_exam"],          rarity: "rare",     desc: "據說摸了會考試過關" },
  { id: "exam_perfect",   name: "滿分卷",     icon: "💯", monster: ["final_exam"],          rarity: "legendary",desc: "傳說中存在的東西，有人見過嗎？" },

  // ── 章碎片系列（所有怪物都可能掉）──
  { id: "frag_fatcat",    name: "肥貓章碎片", icon: "🐱", monster: "all",                   rarity: "uncommon", desc: "集齊可以合成肥貓章" },
  { id: "frag_score",     name: "積分章碎片", icon: "⭐", monster: "all",                   rarity: "uncommon", desc: "集齊可以合成積分章" },
  { id: "frag_achieve",   name: "成就章碎片", icon: "🏆", monster: "all",                   rarity: "rare",     desc: "集齊可以合成成就章" },
];

// 稀有度定義
export const RARITY_CONFIG = {
  common:    { label: "普通",   color: "#9ca3af", weight: 60 },
  uncommon:  { label: "非凡",   color: "#4ade80", weight: 30 },
  rare:      { label: "稀有",   color: "#60a5fa", weight: 8  },
  legendary: { label: "傳說",   color: "#fbbf24", weight: 2  },
};

// 依難度調整掉落材料池
export function getMaterialPool(monsterId, tier) {
  const monsterMats = MATERIALS.filter(m =>
    m.monster === "all" || (Array.isArray(m.monster) && m.monster.includes(monsterId))
  );
  if (monsterMats.length === 0) return MATERIALS.filter(m => m.monster === "all");
  return monsterMats;
}

// 隨機抽一個材料
export function drawMaterial(monsterId, tier) {
  const pool = getMaterialPool(monsterId, tier);
  // 依稀有度加權
  const tierMult = { easy: 0.8, normal: 1.0, hard: 1.3, boss: 1.8 }[tier] || 1.0;
  const weighted = pool.map(m => ({
    ...m,
    w: (RARITY_CONFIG[m.rarity]?.weight || 30) * (m.rarity === "common" ? 1 : tierMult),
  }));
  const total = weighted.reduce((s, m) => s + m.w, 0);
  let r = Math.random() * total;
  for (const m of weighted) { r -= m.w; if (r <= 0) return m; }
  return weighted[0];
}
