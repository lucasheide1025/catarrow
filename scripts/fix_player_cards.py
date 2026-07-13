#!/usr/bin/env python3
"""Fix line 1733: add scoringReady conditional hiding to player cards div."""

import re

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the line with flex:"0 0 auto" (player cards div)
target = 'flex:"0 0 auto"'
# But NOT the one that already has scoringReady (input area)
old_line = '<div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)" }}>'
new_line = '<div style={{ flex:scoringReady?0:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)", display:scoringReady?"none":undefined }}>'

found = False
for i, line in enumerate(lines):
    if old_line in line:
        lines[i] = line.replace(old_line, new_line)
        found = True
        print(f"Fixed line {i+1}: player cards div now hidden when scoringReady")
        break

if not found:
    print("ERROR: Could not find the player cards div!")
    # Debug: show matching lines
    for i, line in enumerate(lines):
        if 'flex:"0 0 auto"' in line:
            print(f"  Line {i+1}: {line.rstrip()[:100]}...")
    exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Done!")
