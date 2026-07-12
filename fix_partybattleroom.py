with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# Fix 1: Add BattleScreen import
old_import = 'import WorldBossCardBadge from "../shared/WorldBossCardBadge";'
new_import = 'import WorldBossCardBadge from "../shared/WorldBossCardBadge";\nimport BattleScreen from "../battle/BattleScreen";'
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes += 1
    print("OK: Added BattleScreen import")
else:
    print("WARN: Could not find import line for BattleScreen")

# Fix 2: Add handlePartyScoringSubmit function before handleSubmit
# Find the handleSubmit function and add our function before it
old_submit_fn = '''  async function handleSubmit() {'''
new_with_fn = '''  async function handlePartyScoringSubmit(scores) {
    if (myReady || submitting) return;
    if (myRole === "rear" && !myRearChoice) return;
    const labelMap = {10:"X",9:"9",8:"8",7:"7",6:"6",5:"5",4:"4",3:"3",2:"2",1:"1",0:"M"};
    const newArrows = scores.map(s => ({
      score: s,
      label: labelMap[s] || String(s),
    }));
    setArrows(newArrows);
    const ok = await fsHandleSubmit(newArrows, myRole, myRearChoice);
    if (ok) setArrows([]);
  }

  async function handleSubmit() {'''
if old_submit_fn in content:
    content = content.replace(old_submit_fn, new_with_fn, 1)
    changes += 1
    print("OK: Added handlePartyScoringSubmit function")
else:
    print("WARN: Could not find handleSubmit function start")

# Fix 3: Replace the scoring UI block with <BattleScreen scoringMode>
# Find the scoring section start
scoring_start = '{me.alive && !myReady && !liveEntry && scoringReady && ('
idx = content.find(scoring_start)
if idx >= 0:
    # Find the end of this JSX fragment block
    # The block is: {condition && (<><HP Warning/><Rear Select/><BattleArrowSlots/><TargetFaceOverlay/><BattleBottomBar/><Submit/></>)}
    # We need to find the matching </> that closes the fragment
    # Let's search for the pattern that marks the end of the fragment
    # The block ends with ):}  -- closing the JSX fragment and the && expression
    end_markers = [
        '{/* 已送出狀態 */}',
        '{me.alive && myReady &&',
        '{/* 動畫期間 */}',
    ]
    end_idx = None
    for marker in end_markers:
        m = content.find(marker, idx + len(scoring_start))
        if m >= 0 and (end_idx is None or m < end_idx):
            end_idx = m
    
    if end_idx:
        line_start = content[:idx].count('\n') + 1
        line_end = content[:end_idx].count('\n') + 1
        print(f"Scoring section: lines {line_start}-{line_end}")
        
        # The scoring block we want to replace is from idx to end_idx
        # Strip whitespace/newlines from the found section
        scoring_block = content[idx:end_idx].rstrip()
        
        # Build the replacement
        replacement = '''{/* ⬇ BattleScreen 計分模式 ⬇ */}
        {me.alive && !myReady && !liveEntry && scoringReady && (
          <div style={{padding:"6px 8px 10px"}}>
            <BattleScreen
              scoringMode
              player={{
                name: profile?.name || me?.name || "Player",
                lv: me?.level || 1,
                atk: me?.atk || 10,
                def: me?.def || 10,
                hp: me?.hp || 100,
                maxHp: me?.maxHP || 100,
              }}
              monster={{
                id: room.monster?.id,
                name: room.monster?.name,
                family: room.monster?.family,
                hp: displayHP,
                atk: room.monster?.atk,
                def: room.monster?.def,
                tier: room.monster?.tier,
              }}
              battleMode={targetMode ? "zombie" : "score"}
              scoreInput={targetMode ? "target" : "keypad"}
              difficulty={{hp:1, atk:1, def:1}}
              arrowsPerRound={room?.arrowsPerRound || ARROWS_PER_ROUND}
              bgImage={battleBgRef.current || "/ui/dungeon-bg.webp"}
              onSubmit={handlePartyScoringSubmit}
              potions={[]}
            />
            {myRole === "rear" && !myRearChoice && (
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button onClick={()=>setMyRearChoice("heal")}
                  style={{flex:1,padding:"5px 0",borderRadius:8,fontWeight:900,fontSize:11,
                    border:"1px solid rgba(52,211,153,0.5)",cursor:"pointer",
                    background: myRearChoice==="heal"?"rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)",
                    color:"#34d399"}}>
                  💚 治癒隊友
                </button>
                <button onClick={()=>setMyRearChoice("dmg")}
                  style={{flex:1,padding:"5px 0",borderRadius:8,fontWeight:900,fontSize:11,
                    border:"1px solid rgba(251,146,60,0.5)",cursor:"pointer",
                    background: myRearChoice==="dmg"?"rgba(251,146,60,0.25)" : "rgba(255,255,255,0.05)",
                    color:"#fb923c"}}>
                  ⚔️ 協助攻擊
                </button>
              </div>
            )}
          </div>
        )}'''
        
        # Replace the scoring block
        content = content[:idx] + replacement + content[end_idx:]
        changes += 1
        print("OK: Replaced scoring UI section with BattleScreen")
        
        # Verify the replacement looks valid
        new_line_start = content[:idx].count('\n') + 1
        new_line_end = content[:idx+len(replacement)].count('\n') + 1
        print(f"  BattleScreen inserted at lines {new_line_start}-{new_line_end}")
    else:
        print("WARN: Could not find end of scoring section")
else:
    print("WARN: Could not find scoring section start")
    # Try partial matches
    for pat in ['scoringReady && (', 'scoringReady && (']:
        i = content.find(pat)
        if i >= 0:
            line = content[:i].count('\n') + 1
            print(f"  Found partial match '{pat}' at line {line}")

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"\nTotal changes: {changes}")
