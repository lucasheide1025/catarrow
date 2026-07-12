import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert onPotionUsed line after the potions line and before the closing /> of BattleScreen
# Current pattern:
#   onSubmit={handlePartyScoringSubmit}
#   potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
#             />
# We want to add onPotionUsed between potions and />

old = '''              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
            />'''
new = '''              onPotionUsed={(pid) => {
                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
                if (!p || !myId || isGuestMode) return;
                if (p.kind === "carry") {
                  applyPartyCarryPotion(roomId, myId, p).catch(()=>{});
                } else {
                  applyPartyUtilityPotion(roomId, myId, p).catch(()=>{});
                }
                usePotions(myId, [pid]).catch(()=>{});
                recordPotionUsed(myId, [pid]).catch(()=>{});
              }}
              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
            />'''

if old in content:
    content = content.replace(old, new, 1)
    with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Added onPotionUsed handler to BattleScreen props")
else:
    print("[WARN] Pattern not found - attempting partial match")
    # Try finding just the potions line and /> to add onPotionUsed after potions
    idx = content.find('potions={[...CARRY_POTIONS')
    if idx >= 0:
        end_idx = content.find('/>', idx)
        if end_idx >= 0:
            prefix = content[idx:end_idx+1]
            print(f"Found from 'potions' to '/>': {repr(prefix[:100])}")
