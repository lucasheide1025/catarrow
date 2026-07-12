import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changes = 0
for i, line in enumerate(lines):
    if 'potions={[]}' in line:
        indent = line[:len(line) - len(line.lstrip())]
        old_line = line.rstrip()
        lines[i] = ' ' * 14 + 'potions={[...CARRY_POTIONS, ...THROW_POTIONS].filter(Boolean)}\n'
        changes += 1
        print(f"[OK] Line {i+1}: replaced '{old_line.strip()}'")
        # Add onPotionUsed after the potions line
        on_potion = ' ' * 14 + '''onPotionUsed={(pid) => {
                const p = [...CARRY_POTIONS, ...THROW_POTIONS].find(x=>x.id===pid);
                if (!p || !myId || isGuestMode) return;
                if (p.kind === "carry") {
                  applyPartyCarryPotion(roomId, myId, p).catch(()=>{});
                } else {
                  applyPartyUtilityPotion(roomId, myId, p).catch(()=>{});
                }
                usePotions(myId, [pid]).catch(()=>{});
                recordPotionUsed(myId, [pid]).catch(()=>{});
              }}\n'''
        # Find the onSubmit line and insert before it
        for j in range(i+1, min(i+5, len(lines))):
            if 'onSubmit=' in lines[j]:
                lines.insert(j, on_potion)
                changes += 1
                print(f"[OK] Added onPotionUsed before line {j+1}")
                break
        break

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n[Total] {changes} changes applied")
