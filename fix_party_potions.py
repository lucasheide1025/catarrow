with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the BattleScreen potions={[]} with actual potion data
old = 'potions={[]}\n              onSubmit={handlePartyScoringSubmit}'
new = 'potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}\n              onPotionUsed={(pid) => {\n                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);\n                if (!p || !myId || isGuestMode) return;\n                if (p.kind === \"carry\") {\n                  applyPartyCarryPotion(roomId, myId, p).catch(()=>{});\n                } else {\n                  applyPartyUtilityPotion(roomId, myId, p).catch(()=>{});\n                }\n                usePotions(myId, [pid]).catch(()=>{});\n                recordPotionUsed(myId, [pid]).catch(()=>{});\n              }}\n              onSubmit={handlePartyScoringSubmit}'

if old in content:
    content = content.replace(old, new, 1)
    print("OK: Updated potions prop with CARRY_POTIONS + THROW_POTIONS")
else:
    print("WARN: Could not find potions={[]} to replace")

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved file")
