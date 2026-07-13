#!/usr/bin/env python3
"""Fix the top section div (sidebar + monster area) to hide when scoringReady.

Currently: flex:"1 1 0" - takes flex space even when scoringReady, making sidebar visible
Fixed: flex:scoringReady?0:"1 1 0" + display:scoringReady?"none":"flex"
"""

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = 'flex:"1 1 0", minHeight:0, display:"flex", gap:6, padding:"8px 8px 0"'
new = 'flex:scoringReady?0:"1 1 0", minHeight:0, display:scoringReady?"none":"flex", gap:6, padding:"8px 8px 0"'

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Top section div fixed - hides sidebar+monster when scoringReady")
else:
    print("ERROR: Could not find the top section div!")
    exit(1)
