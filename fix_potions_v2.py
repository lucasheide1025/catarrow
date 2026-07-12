import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# Fix 1: Add CARRY_POTIONS and THROW_POTIONS to imports
old_import = 'import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs } from "../../lib/itemData";'
new_import = 'import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs, CARRY_POTIONS, THROW_POTIONS } from "../../lib/itemData";'
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes += 1
    print("[OK] Added CARRY_POTIONS/THROW_POTIONS to import")
else:
    print("[WARN] Import not found")

# Fix 2: Replace potions={[]} with potions array + onPotionUsed handler
old_potions = 'potions={[]}\n              onSubmit={handlePartyScoringSubmit}'
new_potions = '''potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}
              onPotionUsed={(pid) => {
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
              onSubmit={handlePartyScoringSubmit}'''

if old_potions in content:
    content = content.replace(old_potions, new_potions, 1)
    changes += 1
    print("[OK] Updated potions with CARRY_POTIONS + THROW_POTIONS + onPotionUsed")
else:
    print("[WARN] Could not find potions={[]} line - trying alternate format")
    # Try with different whitespace
    for variant in [
        'potions={[]}\nonSubmit={handlePartyScoringSubmit}',
        'potions={[]} onSubmit={handlePartyScoringSubmit}',
        'potions={[]}',
    ]:
        if variant in content:
            print(f"  Found variant: {repr(variant[:40])}")
            break
    else:
        # Search for the line containing potions
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'potions=' in line and '[]' in line:
                print(f"  potions line {i+1}: {repr(line.strip())}")
                break

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"\n[Total] {changes} changes applied")
