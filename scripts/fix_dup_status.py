import sys
sys.stdout.reconfigure(encoding='utf-8')

# Fix 1: Remove duplicate const status in DungeonBattleRoom.jsx
with open('src/components/dungeon/DungeonBattleRoom.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Remove duplicate line 270: "  const status = room?.status;" that appears after myLevel
old = '  const myLevel = !isGuestMode && profile?.archerXP !== undefined ? archerLevelFromXP(profile?.archerXP || 0) : (me?.level || 1);\n  const status = room?.status;'
new = '  const myLevel = !isGuestMode && profile?.archerXP !== undefined ? archerLevelFromXP(profile?.archerXP || 0) : (me?.level || 1);'
if old in c:
    c = c.replace(old, new)
    print("Removed duplicate const status line")
else:
    # Try to find and fix any other duplicates
    lines = c.split('\n')
    cleaned = []
    seen_status = False
    for line in lines:
        stripped = line.strip()
        if stripped == 'const status = room?.status;':
            if seen_status:
                print("Skipping duplicate:", line)
                continue
            seen_status = True
        cleaned.append(line)
    c = '\n'.join(cleaned)
    print("Cleaned duplicates using line-by-line method")

with open('src/components/dungeon/DungeonBattleRoom.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("DungeonBattleRoom.jsx written")

# Fix 2: Add partyRound guard in BattleScreen.jsx
with open('src/components/battle/BattleScreen.jsx', 'r', encoding='utf-8') as f:
    bs = f.read()

# The current code should have the new effect. Add a ref guard for partyRound
party_round_effect = '  useEffect(()=>{\n    if(!partyMode || !partyRound) return;\n    dispatch({type:"NEXT_ROUND"});\n  },[partyMode, partyRound]);'
party_round_guard = """  const lastPartyRoundRef = useRef(null);
  useEffect(()=>{
    if(!partyMode || !partyRound) return;
    if (lastPartyRoundRef.current === partyRound) return;
    lastPartyRoundRef.current = partyRound;
    if (partyRound <= 1) return; // skip initial mount - autoStart handles round 1
    dispatch({type:"NEXT_ROUND"});
  },[partyMode, partyRound]);"""

if party_round_effect in bs:
    # Check if the guard already exists
    if 'lastPartyRoundRef' not in bs:
        bs = bs.replace(party_round_effect, party_round_guard)
        with open('src/components/battle/BattleScreen.jsx', 'w', encoding='utf-8') as f:
            f.write(bs)
        print("Added partyRound guard (ref + initial round check)")
    else:
        print("partyRound guard already exists")
else:
    # Try to find the partial match
    idx = bs.find('if(!partyMode || !partyRound)')
    if idx >= 0:
        context = bs[idx:idx+150]
        print(f"Found partial match: {context}")
        # Check if guard already exists
        guard_idx = bs.find('lastPartyRoundRef')
        if guard_idx >= 0:
            print("Guard already exists at", guard_idx)
        else:
            # Add ref declaration and modify the effect
            add_ref = bs.find('const [catCurrentHP')
            if add_ref >= 0:
                bs = bs[:add_ref] + '  const lastPartyRoundRef = useRef(null);\n' + bs[add_ref:]
                # Replace the effect
                effect_start = bs.find('if(!partyMode || !partyRound)')
                effect_end = bs.find('\n  },[partyMode, partyRound]);', effect_start) + len('\n  },[partyMode, partyRound]);')
                new_effect = """if(!partyMode || !partyRound) return;
    if (lastPartyRoundRef.current === partyRound) return;
    lastPartyRoundRef.current = partyRound;
    if (partyRound <= 1) return; // skip initial mount
    dispatch({type:"NEXT_ROUND"});
  },[partyMode, partyRound]);"""
                bs = bs[:effect_start] + new_effect + bs[effect_end:]
                with open('src/components/battle/BattleScreen.jsx', 'w', encoding='utf-8') as f:
                    f.write(bs)
                print("Added partyRound guard via fallback method")
            else:
                print("Could not find hook insertion point")
    else:
        print("Party round effect not found in BattleScreen")

print("Done")
