#!/usr/bin/env python3
"""Fix PartyBattleRoom.jsx: 
1. Hide player cards area when scoringReady
2. Replace autoStart with scoringMode for immediate scoring UI
3. Keep fullScreen for proper layout
"""

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# === Fix 1: Hide player cards area when scoringReady ===
# Change: flex:"0 0 auto" → + display:none when scoringReady
old_player_cards = '''      {/* 弓箭手 + 玩家資訊：前後排 */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)" }}>'''
new_player_cards = '''      {/* 弓箭手 + 玩家資訊：前後排（計分時隱藏） */}
      <div style={{ flex:scoringReady?0:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)", display:scoringReady?"none":undefined }}>'''

if old_player_cards in content:
    content = content.replace(old_player_cards, new_player_cards)
    print("✅ Fix 1: Player cards area hides when scoringReady")
else:
    print("⚠️ Fix 1: Could not find player cards div")

# === Fix 2: Replace autoStart=true with scoringMode=true ===
old_bs_auto = '''              fullScreen
              autoStart
              allies'''
new_bs_scoring = '''              fullScreen
              scoringMode
              allies'''

if old_bs_auto in content:
    content = content.replace(old_bs_auto, new_bs_scoring)
    print("✅ Fix 2: autoStart → scoringMode")
else:
    print("⚠️ Fix 2: Could not find autoStart line, trying alternative match...")
    # Try matching with different whitespace
    old_bs_auto2 = '''              fullScreen
              autoStart'''
    new_bs_scoring2 = '''              fullScreen
              scoringMode'''
    if old_bs_auto2 in content:
        content = content.replace(old_bs_auto2, new_bs_scoring2)
        print("✅ Fix 2: autoStart → scoringMode (alt match)")
    else:
        print("⚠️ Fix 2: Still could not find autoStart")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone!")
