with open("src/lib/monsterRegistry.js", "r", encoding="utf-8") as f:
    content = f.read()

# Add treasure family after the last temple entry
treasure_loot = ''',
  treasure: {
    arrowDew:      { weak: 2, normal: 3, strong: 5, boss: 10 },
    chestChance:   { weak: 0.60, normal: 0.80, strong: 1.00, boss: 1.00 },
    goldChestChance:{ weak: 0.10, normal: 0.20, strong: 0.40, boss: 0.60 },
    cardChance:    { weak: 0.30, normal: 0.50, strong: 0.70, boss: 1.00 },
    materialChance:{ weak: 0.80, normal: 0.90, strong: 1.00, boss: 1.00 },
    materials: {
      common: [
        { id: "copper_coin",    name: "銅幣",     icon: "🪙", weight: 60 },
        { id: "silver_nugget",  name: "銀塊",     icon: "🥈", weight: 40 },
      ],
      rare: [
        { id: "gold_bar",       name: "金條",     icon: "💛", weight: 60 },
        { id: "gem_shard",      name: "寶石碎片", icon: "💎", weight: 40 },
      ],
      boss: [
        { id: "treasure_crown", name: "寶藏王冠", icon: "👑", weight: 40 },
        { id: "mythic_gem",     name: "神話寶石", icon: "🔮", weight: 35 },
        { id: "golden_statue",  name: "黃金雕像", icon: "🗿", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "treasure_map",   name: "藏寶圖", icon: "🗺️", chance: 0.20 },
        { id: "golden_key",     name: "黃金鑰匙", icon: "🔑", chance: 0.15 },
      ],
      boss: [
        { id: "treasure_trophy",name: "寶藏王徽章", icon: "🏆", chance: 1.00 },
        { id: "divine_crown",   name: "神聖皇冠",   icon: "👑", chance: 0.40 },
        { id: "treasure_key",   name: "萬能鑰匙",   icon: "🗝️", chance: 0.25 },
      ],
    },
  },
'''

# Find the end of temple entry (last entry before closing })
end_marker = '    dungeonDrops: {\n      room: [\n        { id: "temple_key",       name: "神廟鑰匙",   icon: "🗝️", chance: 0.20 },\n      ],\n    },\n  },\n};\n'

if end_marker in content:
    content = content.replace(end_marker, end_marker.replace('  },\n};', treasure_loot + '\n};\n'), 1)
    print("OK: treasure loot added")
else:
    # Find the closing brace of FAMILY_LOOT
    idx = content.find("export const FAMILY_LOOT")
    if idx >= 0:
        end_idx = content.find("};\n\n// ── 工具函式", idx)
        if end_idx < 0:
            end_idx = content.find("};\n\n//", idx + 50)
        if end_idx > 0:
            content = content[:end_idx] + treasure_loot + '\n' + content[end_idx:]
            print("OK: treasure loot added (fallback)")
        else:
            print("ERR: could not find end of FAMILY_LOOT")
    else:
        print("ERR: could not find FAMILY_LOOT")

with open("src/lib/monsterRegistry.js", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("DONE: monsterRegistry.js updated")
