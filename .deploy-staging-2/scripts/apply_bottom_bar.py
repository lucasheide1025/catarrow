#!/usr/bin/env python3
"""Apply remaining BattleBottomBar integration changes to MonsterBattle.jsx"""
import re

with open("src/components/member/MonsterBattle.jsx", "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Add BattleBottomBar import after SharedBattleComponents import
old_import = 'import { BattleHPBar, BattleArrowSlots, BattleScoreButtons, BattleStatusTags, BattleStatCard } from "../shared/SharedBattleComponents";'
new_import = 'import { BattleHPBar, BattleArrowSlots, BattleScoreButtons, BattleStatusTags, BattleStatCard } from "../shared/SharedBattleComponents";\nimport BattleBottomBar from "./BattleBottomBar";'
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes += 1
    print("1. BattleBottomBar import added")
else:
    print("1. Import NOT FOUND")

# 2. Replace score buttons section with BattleBottomBar usage
old_score = '''              {/* 分數按鈕（按鈕模式才顯示）*/}
              {!targetMode && arrows.length < ARROWS_PER_ROUND &&
                <BattleScoreButtons
                  labels={HALF_SCORES.map(s => s.label)}
                  onScore={inputArrow}
                  disabled={false}
                  variant="image"
                  btnSize="md"
                />
              }

              <TargetFaceOverlay'''

new_score = '''              {/* 🧪 藥水效果提示 */}
              {usedPotionThisRound && (
                <div style={{
                  textAlign:"center", fontSize:11, fontWeight:900,
                  color:"#fbbf24", marginBottom:3,
                  background:"rgba(251,191,36,0.1)", borderRadius:6, padding:"3px 0",
                }}>
                  {usedPotionThisRound.icon} {usedPotionThisRound.name}：{usedPotionThisRound.effectText}
                </div>
              )}

              {/* 📌 底部 Tab 系統 */}
              <BattleBottomBar
                bottomTab={bottomTab} setBottomTab={setBottomTab}
                potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
                potionUsedThisRound={potionUsedThisRound}
                scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
                targetMode={targetMode} setTargetMode={setTargetMode}
                arrows={arrows} onArrow={inputArrow}
                potionInv={potionInv}
                onCarryPotion={useCarryPotion}
                onThrowPotion={useThrowPotion}
              />

              <TargetFaceOverlay'''

if old_score in content:
    content = content.replace(old_score, new_score, 1)
    changes += 1
    print("2. Score buttons replaced with BattleBottomBar")
else:
    print("2. Score buttons section NOT FOUND")

# 3. Update startBattle resets
old_reset = '    setPhase("battle_intro");'
new_reset = '    setBottomTab("score");\n    setPotionUsedThisRound(false);\n    setUsedPotionThisRound(null);\n    setScoringModeChosen(false);\n    setPhase("battle_intro");'
# Only replace the one in startBattle (not other appearances)
# Find the context: count occurrences and replace the right one
idx = content.find(old_reset)
count = 0
last_idx = -1
while idx != -1:
    count += 1
    last_idx = idx
    idx = content.find(old_reset, idx + 1)

print(f"Found {count} occurrences of 'setPhase(\"battle_intro\")'")

# Replace the one in startBattle (it should be the one followed by setPhase)
if count >= 1:
    # Find the specific one - in startBattle function
    search_from = content.find("function startBattle()")
    idx = content.find(old_reset, search_from)
    if idx != -1:
        content = content[:idx] + new_reset + content[idx + len(old_reset):]
        changes += 1
        print("3. startBattle resets updated")
    else:
        print("3. startBattle resets NOT FOUND in function context")

# 4. Update submitRound reset
old_submit = '    setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);'
new_submit = '    setArrows([]); setArcherATKMod(0); setRound(r=>r+1);\n    setBattlePhase("input"); setProcessing(false);\n    setPotionUsedThisRound(false); setUsedPotionThisRound(null);\n    setBottomTab("score");'

if old_submit in content:
    content = content.replace(old_submit, new_submit, 1)
    changes += 1
    print("4. submitRound resets updated")
else:
    print("4. submitRound resets NOT FOUND")

# Write changes
if changes > 0:
    with open("src/components/member/MonsterBattle.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n✅ {changes} changes applied successfully!")
else:
    print("\n❌ No changes were applied!")
