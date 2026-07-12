#!/usr/bin/env python3
"""Complete BattleBottomBar integration in MonsterBattle.jsx"""
import os

path = "src/components/member/MonsterBattle.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# ===== 1. Replace score buttons section with BattleBottomBar =====
old_score = """              {/* 分數按鈕（按鈕模式才顯示）*/}
              {!targetMode && arrows.length < ARROWS_PER_ROUND &&
                <BattleScoreButtons
                  labels={HALF_SCORES.map(s => s.label)}
                  onScore={inputArrow}
                  disabled={false}
                  variant="image"
                  btnSize="md"
                />
              }"""

new_bottom_bar = """              {/* 藥水效果提示 */}
              {usedPotionThisRound && (
                <div style={{
                  textAlign:"center", fontSize:11, fontWeight:900,
                  color:"#fbbf24", marginBottom:3,
                  background:"rgba(251,191,36,0.1)", borderRadius:6, padding:"3px 0",
                }}>
                  {usedPotionThisRound.icon} {usedPotionThisRound.name}：{usedPotionThisRound.effectText}
                </div>
              )}

              {/* 底部 Tab 系統 */}
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
              />"""

if old_score in content:
    content = content.replace(old_score, new_bottom_bar, 1)
    changes += 1
    print("[1/5] Score buttons replaced with BattleBottomBar ✓")
else:
    print("[1/5] Score buttons NOT FOUND — trying substring match...")
    # Broader match: just the comment
    idx = content.find("分數按鈕（按鈕模式才顯示）")
    if idx > 0:
        print(f"  Found at index {idx}")
        # Show surrounding text to debug
        print(repr(content[idx-50:idx+300]))
    else:
        print("  Comment not found either!")

# ===== 2. Update startBattle reset =====
old_start = """    setTotalDmgDealt(0); setTotalDmgRecvd(0); setCritCount(0); setDroppedMaterials([]);
    setPhase("battle_intro");"""

new_start = """    setTotalDmgDealt(0); setTotalDmgRecvd(0); setCritCount(0); setDroppedMaterials([]);
    setBottomTab("score");
    setPotionUsedThisRound(false);
    setUsedPotionThisRound(null);
    setScoringModeChosen(false);
    setPhase("battle_intro");"""

if old_start in content:
    content = content.replace(old_start, new_start, 1)
    changes += 1
    print("[2/5] startBattle resets updated ✓")
else:
    print("[2/5] startBattle resets NOT FOUND")

# ===== 3. Update submitRound success reset =====
old_submit_success = """    setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);
    } catch(err) {"""

new_submit_success = """    setArrows([]); setArcherATKMod(0); setRound(r=>r+1);
    setBattlePhase("input"); setProcessing(false);
    setPotionUsedThisRound(false); setUsedPotionThisRound(null);
    setBottomTab("score");
    } catch(err) {"""

if old_submit_success in content:
    content = content.replace(old_submit_success, new_submit_success, 1)
    changes += 1
    print("[3/5] submitRound success reset updated ✓")
else:
    print("[3/5] submitRound success reset NOT FOUND")

# ===== 4. Update submitRound error handler =====
old_submit_error = """      setBattlePhase("input");
      setProcessing(false);
    }
  }"""

# Need to find the specific error handler context
search_for = """      setCurrentEvent(null);
      setSkipCounter(false);
      setArcherATKMod(0);
      setBattlePhase("input");
      setProcessing(false);
    }
  }"""

new_submit_error = """      setCurrentEvent(null);
      setSkipCounter(false);
      setArcherATKMod(0);
      setPotionUsedThisRound(false);
      setUsedPotionThisRound(null);
      setBattlePhase("input");
      setProcessing(false);
    }
  }"""

if search_for in content:
    content = content.replace(search_for, new_submit_error, 1)
    changes += 1
    print("[4/5] submitRound error handler reset updated ✓")
else:
    print("[4/5] submitRound error handler NOT FOUND")

# ===== 5. Update restoreBattle =====
old_restore = """    setArrows([]); setBattlePhase("input"); setProcessing(false);
    setPhase("battle");"""

new_restore = """    setArrows([]); setBattlePhase("input"); setProcessing(false);
    setPotionUsedThisRound(false);
    setUsedPotionThisRound(null);
    setBottomTab("score");
    setPhase("battle");"""

if old_restore in content:
    content = content.replace(old_restore, new_restore, 1)
    changes += 1
    print("[5/5] restoreBattle resets updated ✓")
else:
    print("[5/5] restoreBattle resets NOT FOUND")

if changes > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nDone! {changes}/5 changes applied.")
else:
    print("\nNo changes applied!")
