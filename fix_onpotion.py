import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the current potions line and add onPotionUsed before it
# The pattern is:
#   potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
#   onSubmit={handlePartyScoringSubmit}

# Let's find and replace the order: put onPotionUsed before potions
old = 'potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}\n              onSubmit={handlePartyScoringSubmit}'
new = '''onPotionUsed={(pid) => {
                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
                if (!p || !myId || isGuestMode) return;
                if (p.kind === "carry") {
                  applyPartyCarryPotion(roomId, myId, p).catch(()=>{});
                } else {
                  applyPartyUtilityPotion(roomId, myId, p).catch(()=>{});
                }
                usePotions(myId, [pid]).catch(()=>{}); recordPotionUsed(myId, [pid]).catch(()=>{});
              }}
              potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
              onSubmit={handlePartyScoringSubmit}'''

if old in content:
    content = content.replace(old, new, 1)
    with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Added onPotionUsed handler before potions")
else:
    print("[WARN] Pattern not found")
    # Try finding line by line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'potions={[...CARRY_POTIONS' in line:
            print(f"Line {i+1}: {repr(line.strip()[:60])}")
        if 'onSubmit={handlePartyScoringSubmit}' in line:
            print(f"Line {i+2}: {repr(line.strip()[:60])}")
