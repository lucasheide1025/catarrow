# Apply BattleScreen scoring mode integration to DungeonBattleRoom.jsx
import re

f = 'src/components/dungeon/DungeonBattleRoom.jsx'
with open(f, 'r', encoding='utf-8') as fp:
    content = fp.read()

# 1. Add scoringReady state after scoringModeChosen
old1 = '  const [scoringModeChosen,   setScoringModeChosen]   = useState(false);'
new1 = old1 + '\n  const [scoringReady,        setScoringReady]        = useState(false);'
content = content.replace(old1, new1, 1)

# 2. Add setScoringReady and setControlsStarted in round reset effect
old2 = '      setPotionUsedThisRound(false);\n    }\n  }, [room?.status, room?.currentFloor, room?.round]); // eslint-disable-line'
new2 = '      setPotionUsedThisRound(false);\n      setScoringReady(false);\n      setControlsStarted(false);\n    }\n  }, [room?.status, room?.currentFloor, room?.round]); // eslint-disable-line'
content = content.replace(old2, new2, 1)

# 3. Restructure input area to add BattleScreen
# Find the input area section - replace from the rear choice section through hasCat section
old3 = '''        ) : (
          <>
            {/* 後衛選擇（前衛死亡後變後衛時出現）*/}
            {me.role === "rear" && !submitted && (
              <div style={{ background:"rgba(0,0,0,0.7)", border:"2px solid rgba(168,85,247,0.6)", borderRadius:10, padding:"8px 10px", marginBottom:6 }}>
                <div style={{ color:"#e2e8f0", fontSize:10, fontWeight:700, textAlign:"center", marginBottom:6 }}>🛡️ 後衛 — 選擇行動</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setRearChoice("heal")}
                    style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="heal"?"#4ade80":"rgba(74,222,128,0.3)"}`,
                      background: rearChoice==="heal" ? "rgba(74,222,128,0.25)" : "rgba(0,0,0,0.4)",
                      color:"#4ade80", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                    💚 治癒 (看命中%)
                  </button>
                  <button onClick={() => setRearChoice("dmg")}
                    style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="dmg"?"#38bdf8":"rgba(56,189,248,0.3)"}`,
                      background: rearChoice==="dmg" ? "rgba(56,189,248,0.25)" : "rgba(0,0,0,0.4)",
                      color:"#38bdf8", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                    🛡️ 助攻 (前衛加攻擊)
                  </button>
                </div>
              </div>
            )}
            {/* 任務提示 */}
            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:4, padding:"2px 6px", borderRadius:6, background:"rgba(0,0,0,0.3)" }} className={contractInfo.color}>
              <span style={{ fontSize:11 }}>{contractInfo.icon}</span>
              <span style={{ fontSize:9, fontWeight:700 }}>{getContractDesc(myContract)}</span>
            </div>
            <BattleArrowSlots
                arrows={arrows}
                totalArrows={room.arrowsPerRound || 6}
                onUndo={undoArrow}
                showUndo={arrows.length>0}
                slotSize={36}
              />
            {/* 分數按鈕格（依合約類型調整）*/}
            {myContract.type === "hit_count" ? (
              /* 命中關：命中/M 兩顆按鈕 */
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:4 }}>
                <button onClick={() => addArrow("命中")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                  className="rounded-xl font-black active:scale-95 bg-emerald-500 text-white"
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                  命中
                </button>
                <button onClick={() => addArrow("M")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                  className={`rounded-xl font-black active:scale-95 ${SCORE_COLORS["M"]}`}
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                  M
                </button>
                {arrows.length === 0 && !targetMode && (
                  <button onClick={() => { setTargetMode(true); setBattleInputMode("target"); }}
                    className="col-span-2 rounded-xl font-black active:scale-95 bg-blue-500/20 text-blue-200 border border-blue-400/40"
                    style={{ fontSize:13, padding:"10px 0" }}>
                    🎯 改用靶面點擊
                  </button>
                )}
              </div>
            ) : (
              <BattleBottomBar
                bottomTab={bottomTab} setBottomTab={setBottomTab}
                potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
                potionUsedThisRound={potionUsedThisRound}
                scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
                targetMode={targetMode} setTargetMode={setTargetMode}
                arrows={arrows} onArrow={addArrow}
                targetFmt={targetFmt}
                arrowsPerRound={room.arrowsPerRound || 6}
                battleMode="dungeon"
                potionInv={potionInv}
                onCarryPotion={onCarryPotion}
                onThrowPotion={onThrowPotion}
                controlsLocked={!controlsStarted}
                onStartScoring={() => { setControlsStarted(true); setBottomTab("score"); }}
                showModeChooser={true}
              />
            )}
            <TargetFaceOverlay
              open={targetMode && controlsStarted && !submitted && !targetPending}
              fmtId={targetFmt}
              arrowLabels={arrows.map(arrow => arrow.label)}
              arrowPositions={arrows.filter(arrow => Number.isFinite(arrow.nx))}
              arrowsPerRound={room.arrowsPerRound || 6}
              onArrow={addArrow}
              onUndo={undoArrow}
              onSubmit={handleTargetSubmit}
            />
            {/* 送出 */}
            {controlsStarted && (
              <button onClick={handleSubmit} disabled={arrows.length<(room.arrowsPerRound||6)}
                style={{ width:"100%", padding:"10px", borderRadius:10, fontWeight:900, fontSize:14, color:"white", cursor:"pointer", border:"none",
                  background: arrows.length>=(room.arrowsPerRound||6)?"linear-gradient(135deg,#059669,#10b981)":"rgba(255,255,255,0.1)",
                  opacity: arrows.length<(room.arrowsPerRound||6)?0.5:1, transition:"all 0.2s" }}>
                🏹 送出 {room.arrowsPerRound||6} 箭 {arrows.length>0?`(${arrows.length}/${room.arrowsPerRound||6})`:""}
              </button>
            )}
            {hasCat && (
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 6px", borderRadius:6, background:"rgba(79,70,229,0.15)", border:"1px solid rgba(99,102,241,0.3)" }}>
                <span style={{ fontSize:11 }}>🐱</span>
                <span style={{ fontSize:9, color:"#a5b4fc", fontWeight:700 }}>{myCatName} 陪戰中</span>
              </div>
            )}
          </>
        )}'''

new3 = '''        ) : (
          <>
            {/* ⬇ BattleScreen 新式計分流程 ⬇ */}
            {!scoringReady ? (
              /* 舊式計分流程（BattleBottomBar）或「開始計分」按鈕 */
              <>
                {me.role === "rear" && !submitted && (
                  <div style={{ background:"rgba(0,0,0,0.7)", border:"2px solid rgba(168,85,247,0.6)", borderRadius:10, padding:"8px 10px", marginBottom:6 }}>
                    <div style={{ color:"#e2e8f0", fontSize:10, fontWeight:700, textAlign:"center", marginBottom:6 }}>🛡️ 後衛 — 選擇行動</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setRearChoice("heal")}
                        style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="heal"?"#4ade80":"rgba(74,222,128,0.3)"}`,
                          background: rearChoice==="heal" ? "rgba(74,222,128,0.25)" : "rgba(0,0,0,0.4)",
                          color:"#4ade80", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                        💚 治癒 (看命中%)
                      </button>
                      <button onClick={() => setRearChoice("dmg")}
                        style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="dmg"?"#38bdf8":"rgba(56,189,248,0.3)"}`,
                          background: rearChoice==="dmg" ? "rgba(56,189,248,0.25)" : "rgba(0,0,0,0.4)",
                          color:"#38bdf8", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                        🛡️ 助攻 (前衛加攻擊)
                      </button>
                    </div>
                  </div>
                )}
                {/* 任務提示 */}
                <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:4, padding:"2px 6px", borderRadius:6, background:"rgba(0,0,0,0.3)" }} className={contractInfo.color}>
                  <span style={{ fontSize:11 }}>{contractInfo.icon}</span>
                  <span style={{ fontSize:9, fontWeight:700 }}>{getContractDesc(myContract)}</span>
                </div>
                <BattleArrowSlots
                    arrows={arrows}
                    totalArrows={room.arrowsPerRound || 6}
                    onUndo={undoArrow}
                    showUndo={arrows.length>0}
                    slotSize={36}
                  />
                {/* 「開始計分」按鈕（取代 BattleBottomBar） */}
                {!controlsStarted && (
                  <button
                    onClick={() => { setControlsStarted(true); setScoringReady(true); setScoringModeChosen(true); }}
                    style={{ width:"100%", padding:"11px 0", borderRadius:12, fontWeight:900, fontSize:14, cursor:"pointer",
                      background:"linear-gradient(135deg,#7c3aed,#2563eb)", color:"white", border:"none", marginTop:4 }}>
                    🎯 開始計分
                  </button>
                )}
                {/* 舊式 BattleBottomBar（controlsStarted 但非 scoringReady 時的 fallback） */}
                {controlsStarted && (
                  <>
                    {myContract.type === "hit_count" ? (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:4 }}>
                        <button onClick={() => addArrow("命中")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                          className="rounded-xl font-black active:scale-95 bg-emerald-500 text-white"
                          style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                          命中
                        </button>
                        <button onClick={() => addArrow("M")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                          className={`rounded-xl font-black active:scale-95 ${SCORE_COLORS["M"]}`}
                          style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                          M
                        </button>
                        {arrows.length === 0 && !targetMode && (
                          <button onClick={() => { setTargetMode(true); setBattleInputMode("target"); }}
                            className="col-span-2 rounded-xl font-black active:scale-95 bg-blue-500/20 text-blue-200 border border-blue-400/40"
                            style={{ fontSize:13, padding:"10px 0" }}>
                            🎯 改用靶面點擊
                          </button>
                        )}
                      </div>
                    ) : (
                      <BattleBottomBar
                        bottomTab={bottomTab} setBottomTab={setBottomTab}
                        potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
                        potionUsedThisRound={potionUsedThisRound}
                        scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
                        targetMode={targetMode} setTargetMode={setTargetMode}
                        arrows={arrows} onArrow={addArrow}
                        targetFmt={targetFmt}
                        arrowsPerRound={room.arrowsPerRound || 6}
                        battleMode="dungeon"
                        potionInv={potionInv}
                        onCarryPotion={onCarryPotion}
                        onThrowPotion={onThrowPotion}
                        controlsLocked={false}
                        showModeChooser={true}
                      />
                    )}
                    <TargetFaceOverlay
                      open={targetMode && !submitted && !targetPending}
                      fmtId={targetFmt}
                      arrowLabels={arrows.map(arrow => arrow.label)}
                      arrowPositions={arrows.filter(arrow => Number.isFinite(arrow.nx))}
                      arrowsPerRound={room.arrowsPerRound || 6}
                      onArrow={addArrow}
                      onUndo={undoArrow}
                      onSubmit={handleTargetSubmit}
                    />
                    <button onClick={handleSubmit} disabled={arrows.length<(room.arrowsPerRound||6)}
                      style={{ width:"100%", padding:"10px", borderRadius:10, fontWeight:900, fontSize:14, color:"white", cursor:"pointer", border:"none",
                        background: arrows.length>=(room.arrowsPerRound||6)?"linear-gradient(135deg,#059669,#10b981)":"rgba(255,255,255,0.1)",
                        opacity: arrows.length<(room.arrowsPerRound||6)?0.5:1, transition:"all 0.2s" }}>
                      🏹 送出 {room.arrowsPerRound||6} 箭
                    </button>
                  </>
                )}
                {hasCat && (
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 6px", borderRadius:6, background:"rgba(79,70,229,0.15)", border:"1px solid rgba(99,102,241,0.3)" }}>
                    <span style={{ fontSize:11 }}>🐱</span>
                    <span style={{ fontSize:9, color:"#a5b4fc", fontWeight:700 }}>{myCatName} 陪戰中</span>
                  </div>
                )}
              </>
            ) : (
              /* ⬇ BattleScreen 新式計分模式 ⬇ */
              <BattleScreen
                scoringMode
                player={{
                  name: me?.name || profile?.name || "Player",
                  lv: me?.level || 1,
                  atk: me?.atk || 10,
                  def: me?.def || 10,
                  hp: me?.hp || 100,
                  maxHp: me?.maxHP || 100,
                }}
                monster={{
                  id: room?.monster?.id,
                  name: room?.monster?.name,
                  family: room?.monster?.family,
                  hp: displayHP,
                  atk: room?.monster?.atk,
                  def: room?.monster?.def,
                  tier: room?.monster?.tier,
                }}
                battleMode={targetMode ? "zombie" : "score"}
                scoreInput={targetMode ? "target" : "keypad"}
                arrowsPerRound={room.arrowsPerRound || 6}
                onSubmit={handleDungeonSubmit}
              />
            )}
          </>
        )}'''

if old3 in content:
    content = content.replace(old3, new3, 1)
    print("SUCCESS: Input area restructured with BattleScreen")
else:
    print("WARNING: Could not find exact input area text to replace")
    # Try a shorter match
    # Show a snippet around where it should be
    idx = content.find('{controlsLocked={!controlsStarted}')
    if idx >= 0:
        print(f"Found 'controlsLocked' at position {idx}")
        print(content[idx-200:idx+200])
    else:
        print("Could not find 'controlsLocked' pattern either")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(content)

print("Done writing file")
