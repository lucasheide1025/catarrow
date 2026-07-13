#!/usr/bin/env python3
"""PartyBattleRoom battle UI replacement.

Replaces the entire old battle UI section (from the '上半' comment to the container close)
with a clean conditional structure:
- !scoringReady: old UI content
- scoringReady: BattleScreen
"""

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# ============================================================
# Find markers
# ============================================================

# Marker: start of old UI
# The line: {/* 上半：左側 sidebar log + 右側怪物 */}
old_ui_start = '{/* \u4e0a\u534a\uff1a\u5de6\u5074 sidebar log + \u53f3\u5074\u602a\u7269 */}'

pos_start = content.find(old_ui_start)
if pos_start < 0:
    print("ERROR: Could not find old UI start marker")
    exit(1)

# Find the container closing </div>
# It's the LAST </div> in the file that's at 4-space indent
# Looking for: '    </div>' followed by '\n  );\n'
container_close = '\n    </div>\n  );\n'

pos_end = content.rfind(container_close)
if pos_end < 0:
    print("ERROR: Could not find container close")
    exit(1)

# ============================================================
# Extract old UI content (will be wrapped in !scoringReady)
# ============================================================

old_ui_content = content[pos_start:pos_end]

# ============================================================
# Build new BattleScreen content
# ============================================================

battlescreen_content = '''{/* \u4e0a\u534a\uff1a\u5de6\u5074 sidebar log + \u53f3\u5074\u602a\u7269 */}

      {!scoringReady ? (
        <>
''' + old_ui_content + '''        </>) : (
        <div style={{
          position:"fixed", top:0, bottom:0, left:"50%",
          transform:"translateX(-50%)",
          width:"100%", maxWidth:540, zIndex:9999,
          display:"flex", flexDirection:"column",
          background:"#0a1018",
        }}>
          <BattleScreen
            player={{
              name: profile?.name || me?.name || "Player",
              lv: me?.level || 1,
              atk: me?.atk || 10,
              def: me?.def || 10,
              hp: me?.hp || 100,
              maxHp: me?.maxHP || 100,
              catId: me?.catId || profile?.equippedCat?.catId || "diandian",
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
            battleMode="score"
            scoreInput={targetMode ? "target" : "keypad"}
            difficulty={{hp:1, atk:1, def:1}}
            arrowsPerRound={room?.arrowsPerRound || ARROWS_PER_ROUND}
            bgImage={battleBgRef.current || "/ui/dungeon-bg.webp"}
            autoStart
            fullScreen
            allies={memberList.filter(m => m.id !== myId).map(m => ({
              catId: m.catId || profile?.equippedCat?.catId || "diandian",
              name: m.name || "\u961f\u53cb",
              hp: m.hp || 100,
              maxHP: m.maxHP || 100,
              done: m.ready || false,
              ready: m.ready || false,
              alive: m.alive !== false,
              role: m.role || "front",
              isFront: (m.role || "front") === "front",
            }))}
            potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(p => (potionInv[p.id] || 0) > 0)}
            onPotionUsed={(potionId) => {
              const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(pp => pp.id === potionId);
              if (!p) return;
              if (p.kind === "carry") {
                applyPartyCarryPotion(roomId, myId, potionId).catch(() => {});
              } else {
                applyPartyUtilityPotion(roomId, myId, potionId).catch(() => {});
              }
              usePotions(myId, [potionId]).catch(() => {});
              recordPotionUsed(myId, potionId).catch(() => {});
            }}
            onSubmit={handlePartyScoringSubmit}
          />
          {myRole === "rear" && !myRearChoice && (
            <div style={{display:"flex", gap:8, marginTop:8, padding:"0 12px"}}>
              <button onClick={()=>setMyRearChoice("heal")}
                style={{flex:1, padding:"10px 0", borderRadius:10, fontWeight:900, fontSize:13,
                  background:"rgba(52,211,153,0.15)", color:"#34d399", border:"1px solid rgba(52,211,153,0.4)", cursor:"pointer"}}>
                \U0001fa7a \u6cbb\u7652\u968a\u53cb
              </button>
              <button onClick={()=>setMyRearChoice("dmg")}
                style={{flex:1, padding:"10px 0", borderRadius:10, fontWeight:900, fontSize:13,
                  background:"rgba(251,146,60,0.15)", color:"#fb923c", border:"1px solid rgba(251,146,60,0.4)", cursor:"pointer"}}>
                \u2694\ufe0f \u5354\u52a9\u653b\u64ca
              </button>
            </div>
          )}
        </div>
      )}

'''

new_content = content[:pos_start] + battlescreen_content + content[pos_end + len(container_close) + 0:]

# Fix: the container_close was found, but we also need to keep the closing tags
# The content AFTER pos_end starts with '\n    </div>\n  );\n'
# We want to REPLACE everything from pos_start to pos_end with the new content
# and KEEP the container close

new_content = content[:pos_start] + battlescreen_content + '\n    </div>\n  );\n'

# But wait - we also need to keep anything AFTER the container close (like the component's closing brace)
# Let me check what's after the container close
after_container = content[pos_end + len(container_close):]
if after_container.strip():
    new_content += after_container

with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done! Battle UI restructured with conditional.")
