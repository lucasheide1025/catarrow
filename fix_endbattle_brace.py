import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the catch block closing + transition to handleMBBattleEnd
marker = '// BattleScreen callback'
idx = content.find(marker)

if idx < 0:
    print("ERROR: // BattleScreen callback not found!")
    sys.exit(1)

# Look backwards from the marker to find '    }\n  \n  //'
# The catch block is indented 4 spaces, then we need 2-space } to close endBattle
before = content[idx-30:idx]
print('Before marker:')
print(repr(before))

# The pattern is: "    }\n  \n  // BattleScreen callback"
# But after "    }" (close catch), we need "  }" (close endBattle) then "\n\n  // BattleScreen callback"
# Current content: ...    }\n  \n  // BattleScreen callback...
# We need to insert:   }\n\n  // BattleScreen callback...
# So replace:  "    }\n  \n  // BattleScreen callback"
#         ->  "    }\n  }\n\n  // BattleScreen callback"

old = '    }\n  \n  // BattleScreen callback'
new = '    }\n  }\n\n  // BattleScreen callback'

if old in content:
    content = content.replace(old, new, 1)
    print("SUCCESS: Added missing '}' to close endBattle function")
    with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("File saved")
else:
    print("FAILED: Pattern not found!")
    print(f"Looking for: {repr(old)}")
    # Try to find similar patterns
    sim = content[idx-50:idx+50]
    print(f"Actual context: {repr(sim)}")
    sys.exit(1)
