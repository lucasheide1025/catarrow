import re

with open("src/lib/monsterData.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add treasure family to FAMILIES
old_families = '  temple:    { label:"西方怪物族", icon:"🏰", color:"#ea580c" },\n};'
new_families = '  temple:    { label:"西方怪物族", icon:"🏰", color:"#ea580c" },\n  treasure:  { label:"寶箱族",   icon:"📦", color:"#fbbf24" },\n};'
if old_families in content:
    content = content.replace(old_families, new_families, 1)
    print("OK: treasure family added")
else:
    print("WARN: treasure family pattern not found, searching...")
    # Find the FAMILIES block end
    idx = content.find("export const FAMILIES")
    if idx >= 0:
        end_idx = content.find("};", idx)
        if end_idx >= 0:
            # Insert before the closing
            content = content[:end_idx] + ',\n  treasure:  { label:"寶箱族",   icon:"📦", color:"#fbbf24" }' + content[end_idx:]
            print("OK: treasure family added (fallback)")

# 2. Add treasure monsters after temple last monster
treasure_blob = '''

  // ════ 寶箱族 ════
  {
    id:"treasure_1", family:"treasure", tier:"common",
    name:"寶箱怪", icon:"📦",
    hp:100, atk:5, def:50,
    desc:"偽裝成寶箱的怪物，不會攻擊只會防禦，打開它會噴出金幣。",
  },
  {
    id:"treasure_2", family:"treasure", tier:"rare",
    name:"黃金寶箱怪", icon:"📦",
    hp:180, atk:8, def:80,
    desc:"鍍金的寶箱怪，防禦力更高，擊破後獲得大量金幣。",
  },
  {
    id:"treasure_3", family:"treasure", tier:"elite",
    name:"鑽石寶箱怪", icon:"💎",
    hp:280, atk:12, def:120,
    desc:"鑲滿鑽石的寶箱怪，堅硬無比，擊破獎勵豐厚。",
  },
  {
    id:"treasure_4", family:"treasure", tier:"fierce",
    name:"祕銀寶箱怪", icon:"📦",
    hp:420, atk:18, def:170,
    desc:"祕銀打造的寶箱怪，傳說擊破它能獲得稀有收藏品。",
  },
  {
    id:"treasure_5", family:"treasure", tier:"boss",
    name:"遠古寶箱怪", icon:"🗡️",
    hp:650, atk:25, def:230,
    desc:"存在千年的遠古寶箱怪，守護著無數珍寶，攻擊力不高但極難擊破。",
  },
  {
    id:"treasure_6", family:"treasure", tier:"mythic",
    name:"神話寶箱巨像", icon:"👑",
    hp:1000, atk:35, def:300,
    desc:"傳說中的終極寶箱巨像，擊破它將獲得無法想像的財富與寶物。",
  },'''

# Insert after the last MONSTERS entry (before the closing ];)
# Find the pattern: last monster description + closing
end_marker = '    desc:"噴吐烈焰的西方巨龍，所到之處化為焦土，勇者的終極試煉。",\n  },\n];'
if end_marker in content:
    content = content.replace(end_marker, end_marker.replace('];', treasure_blob + '\n];'), 1)
    print("OK: treasure monsters added (end marker)")
else:
    # Fallback: find the last ] before export
    export_idx = content.find("\n// ── 身體部位")
    monsters_end = content.rfind("];", 0, export_idx if export_idx > 0 else len(content))
    if monsters_end > 0:
        content = content[:monsters_end] + treasure_blob + '\n' + content[monsters_end:]
        print("OK: treasure monsters added (fallback)")

# 3. Add drawMixedMonsterPool and drawFloorMonsters after TIER_ORDER
insert_after = 'export const TIER_ORDER = ["common","rare","elite","fierce","boss","mythic"];'
mixed_funcs = '''

// ── 混種抽怪（終戰模式用）────────────────────────────────
// 從六族中隨機抽不同種的怪物，確保每場不重複
const FAMILY_KEYS = ["ghost","mountain","insect","workplace","exam","temple"];

/**
 * 從六族隨機抽指定數量的怪物（各自不同族）
 * @param {number} count - 數量（上限 6）
 * @param {string} variant - weak/normal/strong
 * @param {number} tier - 難度 (1-6)
 * @returns {Array} 怪物物件陣列（已套用變體）
 */
export function drawMixedMonsterPool(count, variant, tier) {
  const tierKeys = TIER_ORDER.slice(0, Math.max(1, Math.min(tier, 6)));
  const shuffled = [...FAMILY_KEYS].sort(() => Math.random() - 0.5);
  const selectedFamilies = shuffled.slice(0, Math.min(count, 6));

  return selectedFamilies.map(family => {
    const candidates = MONSTERS.filter(m =>
      m.family === family && tierKeys.includes(m.tier)
    );
    let monster;
    if (candidates.length === 0) {
      const fallback = MONSTERS.filter(m => m.family === family)
        .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      monster = fallback[0] || MONSTERS.find(m => m.family === family);
    } else {
      monster = candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (!monster) return null;
    return applyVariant(monster, variant);
  }).filter(Boolean);
}

/**
 * 根據樓層決定終戰模式的怪物組合
 * @param {number} floorIndex - 0=第1層, 1=第2層, 2=第3層
 * @param {number} difficultyTier - 難度 (1-6)
 * @returns {{ monsters: Array, elite: Object|null, boss: Object|null }}
 */
export function drawFloorMonsters(floorIndex, difficultyTier) {
  if (floorIndex === 0) {
    // 第1層：探索層，2-3 隻弱化怪
    const count = 2 + Math.floor(Math.random() * 2);
    return {
      monsters: drawMixedMonsterPool(count, "weak", Math.max(1, difficultyTier - 1)),
      elite: null, boss: null,
    };
  }
  if (floorIndex === 1) {
    // 第2層：戰鬥層，3-4 隻普通/強悍怪
    const count = 3 + Math.floor(Math.random() * 2);
    const variant = Math.random() < 0.3 ? "strong" : "normal";
    return {
      monsters: drawMixedMonsterPool(count, variant, difficultyTier),
      elite: null, boss: null,
    };
  }
  // 第3層：王關層
  const bossTier = Math.min(6, difficultyTier);
  const [elite] = drawMixedMonsterPool(1, "strong", bossTier);
  const [boss] = drawMixedMonsterPool(1, "boss", bossTier);
  return {
    monsters: [],
    elite: elite || null,
    boss: boss || null,
  };
}
'''

idx = content.find(insert_after)
if idx >= 0:
    insert_pos = idx + len(insert_after)
    content = content[:insert_pos] + mixed_funcs + content[insert_pos:]
    print("OK: mixed monster functions added")
else:
    print("ERR: could not find TIER_ORDER export")

with open("src/lib/monsterData.js", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("DONE: monsterData.js updated")
