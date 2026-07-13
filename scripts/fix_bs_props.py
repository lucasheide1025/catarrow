#!/usr/bin/env python3
"""Fix BattleScreen props in PartyBattleRoom with precise replacements."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Remove scoringMode + fix player indent
old1 = "              scoringMode\n              player={{"
new1 = "              player={{"
if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("✅ Removed scoringMode")
else:
    # Try with tab
    old1b = "\t\t\tscoringMode\n\t\t\tplayer={{"
    if old1b in content:
        content = content.replace(old1b, "\t\t\tplayer={{")
        changes += 1
        print("✅ Removed scoringMode (tab version)")
    else:
        print("❌ Could not find scoringMode")

# 2. Add catId to player props
old2 = "                maxHp: me?.maxHP || 100,\n              }\n              monster={{"
new2 = "                maxHp: me?.maxHP || 100,\n                catId: me?.catId || profile?.equippedCat?.catId || \"diandian\",\n              }\n              monster={{"
if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("✅ Added catId to player")
else:
    print("❌ Could not find player maxHp line")

# 3. Fix battleMode
old3 = '              battleMode={targetMode ? \"zombie\" : \"score\"}'
new3 = '              battleMode=\"score\"'
if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("✅ Fixed battleMode to score")
else:
    print("❌ Could not find battleMode line")

# 4. Replace potions filter + add allies/autoStart
old4 = """              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
            />"""
new4 = """              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(p => (potionInv[p.id] || 0) > 0)}
              allies={memberList.filter(m => m.id !== myId).map(m => ({
                catId: m.catId || profile?.equippedCat?.catId || \"diandian\",
                name: m.name,
                hp: m.hp || 0,
                maxHP: m.maxHP || 100,
                done: m.done || m.ready || false,
                ready: m.ready || false,
                alive: m.alive !== false,
                role: m.role || \"front\",
                isFront: (m.role || \"front\") === \"front\",
              }))}
              autoStart
            />"""
if old4 in content:
    content = content.replace(old4, new4)
    changes += 1
    print("✅ Added potions filter + allies + autoStart")
else:
    print("❌ Could not find potions line")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
print("Done")
