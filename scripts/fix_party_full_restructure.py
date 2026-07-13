#!/usr/bin/env python3
"""Restructure PartyBattleRoom return: wrap in Fragment, hide old UI when scoringReady, show full BattleScreen."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Add Fragment opening + hide old UI when scoringReady
old_return = """  return (
    <div style={{
      position:\"fixed\", top:0, bottom:0, left:\"50%\", transform:\"translateX(-50%)\",
      width:\"100%\", maxWidth:540, zIndex:9999, overflow:\"hidden\",
      backgroundImage:`url(${battleBgRef.current || \"/ui/dungeon-bg.webp\"})`, backgroundSize:\"cover\", backgroundPosition:\"center\",
      display:\"flex\", flexDirection:\"column\",
    }}>"""

new_return = """  return (
    <>
    <div style={{
      position:\"fixed\", top:0, bottom:0, left:\"50%\", transform:\"translateX(-50%)\",
      width:\"100%\", maxWidth:540, zIndex:9999, overflow:\"hidden\",
      backgroundImage:`url(${battleBgRef.current || \"/ui/dungeon-bg.webp\"})`, backgroundSize:\"cover\", backgroundPosition:\"center\",
      display:scoringReady?'none':'flex', flexDirection:\"column\",
    }}>"""

if old_return in content:
    content = content.replace(old_return, new_return)
    changes += 1
    print("✅ Added Fragment + hide old UI when scoringReady")
else:
    print("❌ Could not find return statement start")

# 2. Find the BOTTOM of the page - after all closing divs and before the closing of the component
# Look for: "      </div>\n    </div>\n  );\n}"
# This is the end of the component - replace with Fragment close + BattleScreen

old_end = """        {!me.alive && room.status===\"active\" && (
          <div style={{ textAlign:\"center\", padding:\"6px 0\", color:\"#475569\", fontWeight:900, fontSize:12 }}>
            💀 你已陣亡，觀戰中…
          </div>
        )}
      </div>
    </div>
  );
}"""

new_end = """        {!me.alive && room.status===\"active\" && (
          <div style={{ textAlign:\"center\", padding:\"6px 0\", color:\"#475569\", fontWeight:900, fontSize:12 }}>
            💀 你已陣亡，觀戰中…
          </div>
        )}
      </div>
    </div>
    {scoringReady && me.alive && !myReady && !liveEntry && (
      <div style={{position:\"fixed\", top:0, bottom:0, left:\"50%\", transform:\"translateX(-50%)\", width:\"100%\", maxWidth:540, zIndex:9999, overflow:\"hidden\", background:\"#0a1018\"}}>
        <div style={{position:\"relative\", width:\"100%\", height:\"100%\", maxWidth:540, margin:\"0 auto\", overflow:\"hidden\", userSelect:\"none\", background:\"#0a1018\"}}>
          <BattleScreen
            player={{
              name: profile?.name || me?.name || \"Player\",
              lv: me?.level || 1,
              atk: me?.atk || 10,
              def: me?.def || 10,
              hp: me?.hp || 100,
              maxHp: me?.maxHP || 100,
              catId: me?.catId || profile?.equippedCat?.catId || \"diandian\",
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
            battleMode=\"score\"
            scoreInput={targetMode ? \"target\" : \"keypad\"}
            difficulty={{hp:1, atk:1, def:1}}
            arrowsPerRound={room?.arrowsPerRound || ARROWS_PER_ROUND}
            bgImage={battleBgRef.current || \"/ui/dungeon-bg.webp\"}
            onSubmit={handlePartyScoringSubmit}
            onPotionUsed={(pid) => {
              const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
              if (!p || !myId || isGuestMode) return;
              if (p.kind === \"carry\") {
                applyPartyCarryPotion(roomId, myId, p).catch(()=>{});
              } else {
                applyPartyUtilityPotion(roomId, myId, p).catch(()=>{});
              }
              usePotions(myId, [pid]).catch(()=>{});
              recordPotionUsed(myId, [pid]).catch(()=>{});
            }}
            potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(p => (potionInv[p.id] || 0) > 0)}
            allies={memberList.filter(m => m.id !== myId).map(m => ({
              catId: m.catId || profile?.equippedCat?.catId || \"diandian\",
              name: m.name,
              hp: m.hp || 0,
              maxHP: m.maxHP || 100,
              done: m.done || m.ready || false,
              ready: m.ready || false,
              alive: m.alive !== false,
              role: m.role || \"front\",
              isFront: (m.role || \"front\") === \"front\",
            }))}
            autoStart
          />
        </div>
      </div>
    )}
    </>
  );
}"""

if old_end in content:
    content = content.replace(old_end, new_end)
    changes += 1
    print("✅ Added Fragment closing + BattleScreen rendering after old UI")
else:
    print("❌ Could not find file ending")
    # Try a shorter match - maybe the spectator message div is different
    # Let's find just the last part
    print("   Looking for alternative end pattern...")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
print("Done")
