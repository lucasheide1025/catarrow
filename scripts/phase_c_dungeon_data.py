with open("src/lib/dungeonData.js", "r", encoding="utf-8") as f:
    content = f.read()

# Insert after DYNAMIC_DIFFICULTY block
insert_after = "  maxAdjustment: 0.4,\n};"
insert_blob = '''

// ══════════════════════════════════════════════════════════════
// ▼▼▼  終戰模式（Expedition Mode）  ▼▼▼
// ══════════════════════════════════════════════════════════════

// ── 終戰模式難度（6 級，對應 monster tier）───────────────────
export const EXCAVATION_DIFFICULTIES = [
  { id:1, tier:"common", label:"普通級", icon:"🌱", color:"#4ade80", monsterTier:"common" },
  { id:2, tier:"rare",   label:"稀有級", icon:"🔵", color:"#60a5fa", monsterTier:"rare" },
  { id:3, tier:"elite",  label:"精英級", icon:"⚔️", color:"#8b5cf6", monsterTier:"elite" },
  { id:4, tier:"fierce", label:"強悍級", icon:"🔥", color:"#f97316", monsterTier:"fierce" },
  { id:5, tier:"boss",   label:"頭目級", icon:"💀", color:"#ef4444", monsterTier:"boss" },
  { id:6, tier:"mythic", label:"神話級", icon:"👑", color:"#fbbf24", monsterTier:"mythic" },
];

export function getExcavationDifficulty(difficultyTier) {
  return EXCAVATION_DIFFICULTIES.find(d => d.id === difficultyTier) || EXCAVATION_DIFFICULTIES[0];
}

export function getExcavationTierLabel(tier) {
  const d = getExcavationDifficulty(tier);
  return d ? `${d.icon} ${d.label}` : `Lv.${tier}`;
}

// ── 終戰模式三層結構定義 ──────────────────────────────────
// 每層的房間類型權重與怪物配置
export const EXCAVATION_FLOOR_CONFIG = [
  {
    // 第1層：探索層
    label:"第1層 · 探索層",
    desc:"少量怪物、大量事件、陷阱、商人",
    monsterCount: { min:2, max:3 },
    monsterVariant: "weak",
    tierOffset: -1,  // Tier 降一級
    roomTypes: {
      events:  { weight:35, label:"事件" },
      traps:   { weight:25, label:"陷阱" },
      merchants:{ weight:20, label:"商人" },
      monsters:{ weight:20, label:"怪物" },
    },
  },
  {
    // 第2層：戰鬥層
    label:"第2層 · 戰鬥層",
    desc:"怪物增加、陷阱寶箱、少量事件商人",
    monsterCount: { min:3, max:4 },
    monsterVariant: "normal",  // 30% 機率變強悍
    tierOffset: 0,
    hasStrongChance: 0.3,
    roomTypes: {
      monsters:{ weight:40, label:"怪物" },
      traps:   { weight:25, label:"陷阱" },
      chests:  { weight:20, label:"寶箱" },
      events:  { weight:10, label:"事件" },
      merchants:{ weight:5,  label:"商人" },
    },
  },
  {
    // 第3層：王關層（固定流程）
    label:"第3層 · 王關",
    desc:"精英 → 休息 → 商人 → Boss → 獎勵",
    fixedSequence: true,
  },
];

// ── 六族隨機權重（預設均等）───────────────────────────────
export const MIXED_FAMILY_WEIGHTS = {
  ghost:     1,
  mountain:  1,
  insect:    1,
  workplace: 1,
  exam:      1,
  temple:    1,
};

// ── 強化金幣範圍（500~2000）───────────────────────────────
export const UPGRADE_COIN_RANGE = { min:500, max:2000 };

// ── 抽隱藏地下城的稀有度權重（依練箭量調整）───────────────
export const EXCAVATION_RARITY_WEIGHTS = {
  base: { common:60, rare:30, hidden:10 },
  threshold30: { common:-10, rare:10, hidden:0 },   // 30箭以上
  threshold60: { common:0,  rare:-5, hidden:15 },   // 60箭以上
  threshold90: { common:0,  rare:-5, hidden:10 },   // 90箭以上
};
'''

idx = content.find(insert_after)
if idx >= 0:
    insert_pos = idx + len(insert_after)
    content = content[:insert_pos] + insert_blob + content[insert_pos:]
    print("OK: excavation constants added")
else:
    print("ERR: could not find insert point")

with open("src/lib/dungeonData.js", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("DONE: dungeonData.js updated")
