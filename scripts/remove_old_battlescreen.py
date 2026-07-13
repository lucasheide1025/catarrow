#!/usr/bin/env python3
"""Remove the duplicate old BattleScreen from PartyBattleRoom input area."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find and remove the duplicate BattleScreen block
old_block = """        {/* ⬇ BattleScreen 計分模式 ⬇ */}
        {me.alive && !myReady && !liveEntry && scoringReady && (
          <div style={{padding:\"6px 8px 10px\"}}>
            <BattleScreen
              key={room?.round || 1}
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
        )}"""

if old_block in content:
    content = content.replace(old_block, "")
    print("✅ Removed duplicate BattleScreen from input area")
else:
    print("❌ Could not find duplicate BattleScreen block")
    # Try shorter match
    if "BattleScreen 計分模式" in content:
        print("   But found the comment - exact match failed")
    else:
        print("   Comment not found either")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
