#!/usr/bin/env python3
"""Simple fix for PartyBattleRoom: hide old display when scoringReady, use full BattleScreen UI."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Hide old display area when scoringReady
# Find: "flex:1, display:\"flex\", flexDirection:\"column\", minWidth:0, paddingTop:28, minHeight:0"
old_flex1 = 'flex:1, display:\"flex\", flexDirection:\"column\", minWidth:0, paddingTop:28, minHeight:0'
new_flex1 = 'flex:scoringReady?0:1, display:scoringReady?\"none\":\"flex\", flexDirection:\"column\", minWidth:0, paddingTop:28, minHeight:0'
if old_flex1 in content:
    content = content.replace(old_flex1, new_flex1)
    changes += 1
    print("✅ Old display area hidden when scoringReady")
else:
    print("❌ Could not find old display flex:1")

# 2. Replace scoringMode BattleScreen with full UI version
old_bs = """            <BattleScreen
              scoringMode
              player={{
                name: profile?.name || me?.name || \"Player\",
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
              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
            />"""

new_bs = """            <BattleScreen
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
            />"""

if old_bs in content:
    content = content.replace(old_bs, new_bs)
    changes += 1
    print("✅ Replaced scoringMode BattleScreen with full UI + allies + autoStart")
else:
    print("❌ Could not find BattleScreen props")

# 3. Make the outer container NOT use flex (so BattleScreen fills it when old display hidden)
old_container_start = """      width:\"100%\", maxWidth:540, zIndex:9999, overflow:\"hidden\",
      backgroundImage:`url(${battleBgRef.current || \"/ui/dungeon-bg.webp\"})`, backgroundSize:\"cover\", backgroundPosition:\"center\",
      display:\"flex\", flexDirection:\"column\","""
new_container_start = """      width:\"100%\", maxWidth:540, zIndex:9999, overflow:\"hidden\",
      backgroundImage:`url(${battleBgRef.current || \"/ui/dungeon-bg.webp\"})`, backgroundSize:\"cover\", backgroundPosition:\"center\",
      display:scoringReady?'block':'flex', flexDirection:\"column\","""

if old_container_start in content:
    content = content.replace(old_container_start, new_container_start)
    changes += 1
    print("✅ Container display changes from 'flex' to 'block' when scoringReady")
else:
    print("❌ Could not find container display setting")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
print("Done")
