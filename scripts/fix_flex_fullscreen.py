#!/usr/bin/env python3
"""Fix PartyBattleRoom flex layout + add fullScreen to BattleScreen."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Revert container display to always 'flex'
old1 = "display:scoringReady?'block':'flex', flexDirection:\"column\","
new1 = "display:\"flex\", flexDirection:\"column\","
if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("✅ Container display reverted to always 'flex'")
else:
    print("❌ Could not find container display")

# 2. Find the input area div and change its flex
# Input area starts with: style={{ flex:\"0 0 auto\", background:\"rgba(0,0,0,0.68)\", padding:\"3px 6px 10px\" }}
old2 = 'style={{ flex:\"0 0 auto\", background:\"rgba(0,0,0,0.68)\", padding:\"3px 6px 10px\" }}'
new2 = 'style={{ flex:scoringReady?1:\"0 0 auto\", background:\"rgba(0,0,0,0.68)\", padding:\"3px 6px 10px\" }}'
if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("✅ Input area flex now flex:1 when scoringReady")
else:
    print("❌ Could not find input area flex")

# 3. Add fullScreen prop to BattleScreen
# Find the autoStart prop and add fullScreen before it
old3 = "              autoStart"
new3 = "              fullScreen\n              autoStart"
if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("✅ Added fullScreen to BattleScreen")
else:
    print("❌ Could not find autoStart")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
