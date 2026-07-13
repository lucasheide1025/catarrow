#!/usr/bin/env python3
"""Modify PartyBattleRoom.jsx: use full BattleScreen UI with allies + autoStart."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Replace the scoringMode BattleScreen with full UI version
old = """            <BattleScreen
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

new = """            <BattleScreen
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

if old in content:
    content = content.replace(old, new)
    changes += 1
    print("✅ Replaced scoringMode BattleScreen with full UI version")
else:
    print("❌ Could not find scoringMode BattleScreen")

# 2. Modify the condition to show BattleScreen all the time (not just when scoringReady)
# Current: {me.alive && !myReady && !liveEntry && scoringReady && (
# New:     {me.alive && !myReady && !liveEntry && scoringReady && (
# (Keep the same condition - scoringReady is set when user clicks "開始計分")
# The BattleScreen now shows full UI instead of just scoring panel

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
print("Done")
