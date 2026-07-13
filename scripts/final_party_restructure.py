#!/usr/bin/env python3
"""PartyBattleRoom FINAL restructure.

The problem: old UI sections use display:none CSS to hide when scoringReady,
but BattleScreen is rendered inside the input area div with padding/background.

The fix: wrap ALL old UI content in {!scoringReady && (...)} so it's NOT rendered at all
when scoringReady. Render BattleScreen OUTSIDE the old structure when scoringReady.
"""

import sys

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# ============================================================
# Step 1: Find the markers for the old UI sections
# ============================================================

# Marker A: The opening of the top section (sidebar + monster)
# The line contains: flex:scoringReady?0:"1 1 0"
marker_a = 'flex:scoringReady?0:"1 1 0"'

# Marker B: The opening of the player cards section
# The line contains: 弓箭手 + 玩家資訊：前後排
marker_b = '\u5f13\u7bad\u624b + \u73a9\u5bb6\u8cc7\u8a0a\uff1a\u524d\u5f8c\u6392'

# Marker C: The input area opening
# The line contains: flex:scoringReady?1:"0 0 auto"
marker_c = 'flex:scoringReady?1:"0 0 auto"'

# Marker D: The closing </div> of the main container
# We need to find the LAST </div> before the return's );
marker_d = '    </div>\n  );\n'

# ============================================================
# Step 2: Find exact positions
# ============================================================

pos_a = content.find(marker_a)
pos_b = content.find(marker_b)
pos_c = content.find(marker_c)
pos_d = content.rfind('    </div>')  # Last </div> before );

if pos_a < 0 or pos_b < 0 or pos_c < 0 or pos_d < 0:
    print(f"ERROR: Could not find markers: a={pos_a} b={pos_b} c={pos_c} d={pos_d}")
    sys.exit(1)

# ============================================================
# Step 3: Replace the sections
# ============================================================

# We're going to:
# 1. Mark section A (top: sidebar+monster) with WrapStart
# 2. Keep section B (player cards) 
# 3. Replace section C (input area) with the new BattleScreen structure

# Strategy: Find the line where the top section opens and add 
# `{!scoringReady && (` before it. Then after section C ends, close
# the wrap and add `{scoringReady && <BattleScreen.../>}`.

# Actually, the simplest approach: use the <CatRoundOverlay.../> at line 1555
# as the marker. The content BEFORE it (CatRoundOverlay, style, CatMsg, etc.)
# should ALWAYS show. The content AFTER it (sidebar+monster, player cards, input)
# should wrap in !scoringReady.

# Let me use CatRoundOverlay close as the split point.
cat_overlay_end = '</CatRoundOverlay>'

pos_overlay = content.find(cat_overlay_end)
if pos_overlay < 0:
    print("ERROR: Could not find CatRoundOverlay closing tag")
    sys.exit(1)

# Content break after CatRoundOverlay
# Everything from after CatRoundOverlay until the closing </div> is the "old battle UI"
# This includes: leave button, cheer, killing blow, event, sidebar+monster, player cards, input area

# Mark the boundary: insert `{!scoringReady ? (<>` after CatRoundOverlay close
# And before the container closing `</div>`, insert `</> : <div style={{flex:1}}><BattleScreen [props]/></div>)}`

# The line after CatRoundOverlay close typically starts with:
#       {/* 離開按鈕 */}
leave_btn_marker = '{/* \u96e2\u958b\u6309\u9215 */}'

pos_leave = content.find(leave_btn_marker, pos_overlay)
if pos_leave < 0:
    # Try alternative: the CatRoundOverlay component is a self-closing tag
    # Find the line AFTER it
    print("Trying alternative marker...")
    # Find the newline after CatRoundOverlay
    pos_after_overlay = content.find('\n', pos_overlay) + 1
    pos_leave = pos_after_overlay

# Also find the last </div> in the container (before );)
last_div = content.rfind('\n    </div>\n  );\n')
if last_div < 0:
    # Try different pattern
    last_div = content.rfind('\n      </div>\n    </div>\n  );\n')

# ============================================================
# Step 4: Build the replacement
# ============================================================

# We'll split the content into 3 parts:
# Part 1: Before the old UI (includes CatMsg, CatRoundOverlay, style)
# Part 2: The old UI content (leave button through input area)
# Part 3: After the old UI (the return's closing )

# Actually let me use a simpler approach:
# The old UI starts at the "離開按鈕" comment or the leave button
# The old UI ends at the input area's BattleScreen/button section

# Let me find the actual range to wrap.
# I'll search for `{/* 離開按鈕 */}` comment, which is right after CatRoundOverlay
# And search for the end of the input area, just before the container's closing </div>

# ============================================================
# Step 5: Build the complete new battle view
# ============================================================

# Find: the line number where old UI content starts (after CatRoundOverlay)
# Find: the line where the container closes (before );

# The container opens at the "return (" line, so the closing is:
#     </div>
#   );

# Let me find the exact last `</div>` that belongs to the battle container
# It should be followed by `\n  );\n`

# Look for the closing pattern of the container div
container_close = content.rfind('\n    </div>\n  ')

# The content between CatRoundOverlay end and container_close is the old battle UI
# We wrap it in {!scoringReady ? (<>)...</>)

# And ADD after container_close (before );): {scoringReady && <BattleScreen .../>}

# Actually, this is getting too complex for string manipulation.
# Let me take a simpler approach: add the conditional wrappers directly.

# Marker for where old UI begins (after CatRoundOverlay close)
# CatRoundOverlay typically ends with:
#       />
# or
#       </CatRoundOverlay>

# Then the next line is the leave button.
# Let me insert a wrapper OPENING right after CatRoundOverlay

# Find CatRoundOverlay close - could be /> or </CatRoundOverlay>
cat_close_self = content.find('/>\n\n', pos_overlay - 20)  # self-closing

# After the CatRoundOverlay, insert:
#       {!scoringReady ? (<>\n
wrap_open = '      {!scoringReady ? (<>\n'

# Before the last </div> of the container, insert:
#       </>) : (\n'
#         <BattleScreen [props] />\n
#       )}
wrap_close_battlescreen = (
    '      </>) : (\n'
    '        <div style={{\n'
    '          position:"fixed", top:0, bottom:0, left:"50%",\n'
    '          transform:"translateX(-50%)",\n'
    '          width:"100%", maxWidth:540, zIndex:9999,\n'
    '          display:"flex", flexDirection:"column",\n'
    '          background:`url(${battleBgRef.current || "/ui/dungeon-bg.webp"})`,\n'
    '          backgroundSize:"cover", backgroundPosition:"center",\n'
    '        }}>\n'
    '          <BattleScreen\n'
    '            player={{\n'
    '              name: profile?.name || me?.name || "Player",\n'
    '              lv: me?.level || 1,\n'
    '              atk: me?.atk || 10,\n'
    '              def: me?.def || 10,\n'
    '              hp: me?.hp || 100,\n'
    '              maxHp: me?.maxHP || 100,\n'
    '              catId: me?.catId || profile?.equippedCat?.catId || "diandian",\n'
    '            }}\n'
    '            monster={{\n'
    '              id: room.monster?.id,\n'
    '              name: room.monster?.name,\n'
    '              family: room.monster?.family,\n'
    '              hp: displayHP,\n'
    '              atk: room.monster?.atk,\n'
    '              def: room.monster?.def,\n'
    '              tier: room.monster?.tier,\n'
    '            }}\n'
    '            battleMode="score"\n'
    '            scoreInput={targetMode ? "target" : "keypad"}\n'
    '            difficulty={{hp:1, atk:1, def:1}}\n'
    '            arrowsPerRound={room?.arrowsPerRound || ARROWS_PER_ROUND}\n'
    '            bgImage={battleBgRef.current || "/ui/dungeon-bg.webp"}\n'
    '            autoStart\n'
    '            fullScreen\n'
    '            allies={memberList.filter(m => m.id !== myId).map(m => ({\n'
    '              catId: m.catId || profile?.equippedCat?.catId || "diandian",\n'
    '              name: m.name || "隊友",\n'
    '              hp: m.hp || 100,\n'
    '              maxHP: m.maxHP || 100,\n'
    '              done: m.ready || false,\n'
    '              ready: m.ready || false,\n'
    '              alive: m.alive !== false,\n'
    '              role: m.role || "front",\n'
    '              isFront: (m.role || "front") === "front",\n'
    '            }))}\n'
    '            potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(p => (potionInv[p.id] || 0) > 0)}\n'
    '            onPotionUsed={(potionId) => {\n'
    '              const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(pp => pp.id === potionId);\n'
    '              if (!p) return;\n'
    '              if (p.kind === "carry") {\n'
    '                applyPartyCarryPotion(roomId, myId, potionId).catch(() => {});\n'
    '              } else {\n'
    '                applyPartyUtilityPotion(roomId, myId, potionId).catch(() => {});\n'
    '              }\n'
    '              usePotions(myId, [potionId]).catch(() => {});\n'
    '              recordPotionUsed(myId, potionId).catch(() => {});\n'
    '            }}\n'
    '            onSubmit={handlePartyScoringSubmit}\n'
    '          />\n'
    '          {myRole === "rear" && !myRearChoice && (\n'
    '            <div style={{display:"flex", gap:8, marginTop:8, padding:"0 12px"}}>\n'
    '              <button onClick={()=>setMyRearChoice("heal")}\n'
    '                style={{flex:1, padding:"10px 0", borderRadius:10, fontWeight:900, fontSize:13,\n'
    '                  background:"rgba(52,211,153,0.15)", color:"#34d399", border:"1px solid rgba(52,211,153,0.4)", cursor:"pointer"}}>\n'
    '                \U0001fa7a 治癒隊友\n'
    '              </button>\n'
    '              <button onClick={()=>setMyRearChoice("dmg")}\n'
    '                style={{flex:1, padding:"10px 0", borderRadius:10, fontWeight:900, fontSize:13,\n'
    '                  background:"rgba(251,146,60,0.15)", color:"#fb923c", border:"1px solid rgba(251,146,60,0.4)", cursor:"pointer"}}>\n'
    '                \u2694\u200d\ufe0f 增加傷害\n'
    '              </button>\n'
    '            </div>\n'
    '          )}\n'
    '        </div>\n'
    '      )}\n'
)

# Find the insertion points in the content
# Insert wrap_open AFTER the CatRoundOverlay closing
# Insert wrap_close BEFORE the container's last </div>

# ============================================================
# Step 6: Execute the replacement
# ============================================================

# Find where CatRoundOverlay ends. It's followed by a newline and then the leave button section.
# Strategy: find the leave button comment marker, insert wrap_open before it.

leave_line_start = content.find('{/* \u96e2\u958b\u6309\u9215 */}\n      <button', pos_overlay)
if leave_line_start < 0:
    # Try alternative exact string
    leave_line_start = content.find('{/* \u96e2\u958b\u6309\u9215 */}', pos_overlay)

if leave_line_start < 0:
    print("ERROR: Could not find leave button marker")
    print(f"pos_overlay={pos_overlay}")
    # Debug: print some context
    print(content[pos_overlay:pos_overlay+500])
    sys.exit(1)

# Insert wrap_open before the leave button section
content = content[:leave_line_start] + wrap_open + content[leave_line_start:]

# Now insert wrap_close_battlescreen before the container's last </div>
# The container close is the last `</div>` before `  );\n`
# We need to find it AGAIN because we just added content
last_div = content.rfind('\n    </div>\n  );\n')
if last_div < 0:
    print("ERROR: Could not find container closing div")
    sys.exit(1)

content = content[:last_div] + wrap_close_battlescreen + content[last_div:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done! Old UI wrapped in !scoringReady, BattleScreen added for scoringReady")
print("NOTE: The old display:none CSS conditions are now redundant but harmless.")
