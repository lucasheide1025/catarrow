# scripts/fix_battle_round_stuck.py
# Bug 1a: Add useEffect to dispatch NEXT_ROUND when partyRound changes

import re

path = "src/components/battle/BattleScreen.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the section after the autoStart effect but before the scoring mode comment
# The old code has:
#   useEffect(()=>{if(autoStart)handleStartBattle();},[autoStart]);
#
#   // 組隊回合由房間狀態主導。新回合到來時只清空本機計分，不能重置房間戰鬥。
#   useEffect(()=>{
#   // ─── 計分模式（PartyBattleRoom 等外部元件用）───
#   });
#   useEffect(()=>{if(scoringMode)dispatch({type:"START_SCORING",arrowsPerRound});},[scoringMode,arrowsPerRound]);

old_block = "  // 組隊回合由房間狀態主導。新回合到來時只清空本機計分，不能重置房間戰鬥。\n  useEffect(()=>{\n  // ─── 計分模式（PartyBattleRoom 等外部元件用）───\n  });"
new_block = "  // 組隊回合由房間狀態主導。新回合到來時強制重置內部計分狀態\n  // NEXT_ROUND 只清空箭矢/傷害/phase，不 reset 整個戰鬥。\n  useEffect(()=>{\n    if(!partyMode || !partyRound) return;\n    dispatch({type:\"NEXT_ROUND\"});\n  },[partyMode, partyRound]);\n\n  // ─── 計分模式（PartyBattleRoom 等外部元件用）───"

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ Bug 1a fixed: Added partyRound reset effect in BattleScreen.jsx")
else:
    print("❌ Could not find target block in BattleScreen.jsx")
    # Try to find what's actually there
    idx = content.find("組隊回合由房間狀態")
    if idx >= 0:
        print(f"Found at position {idx}: {repr(content[idx:idx+200])}")
