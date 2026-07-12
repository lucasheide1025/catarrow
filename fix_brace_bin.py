import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('src/components/member/MonsterBattle.jsx', 'rb') as f:
    data = f.read()

# The pattern: after catch block's closing }, there's \r\n  \r\n  // BattleScreen callback
# We need to insert  }\r\n after the catch block's }

# Search for the specific byte sequence
# The text after the catch block: \r\n    }\r\n  \r\n  // BattleScreen callback
# We want to change it to: \r\n    }\r\n  }\r\n  \r\n  // BattleScreen callback
#                          ^^catch close^^^new:close endBattle^^^^empty line^^^^^callback

old_bytes = b'    }\r\n  \r\n  // BattleScreen callback'
new_bytes = b'    }\r\n  }\r\n  \r\n  // BattleScreen callback'

idx = data.find(old_bytes)
if idx >= 0:
    # Verify what we found
    line_no = data[:idx].count(b'\n') + 1
    print(f"Found pattern at byte {idx}, line ~{line_no}")
    print(f"Before: {repr(data[idx-20:idx+20])}")
    
    data = data[:idx] + new_bytes + data[idx+len(old_bytes):]
    
    # Verify the fix
    verify_idx = data.find(b'// BattleScreen callback')
    verify_before = data[verify_idx-30:verify_idx]
    print(f"After fix: {repr(verify_before)}")
    
    with open('src/components/member/MonsterBattle.jsx', 'wb') as f:
        f.write(data)
    print("[OK] Added missing } to close endBattle function")
else:
    print("[WARN] Pattern not found")
    # Try other variations
    for pat in [
        b'    }\r\n  \r\n  // BattleScreen callback',
        b'    }\n  \n  // BattleScreen callback',
        b'    }\r\n\n  // BattleScreen callback',
    ]:
        if pat in data:
            print(f"  Found alternative pattern: {repr(pat)}")
            break
    
    # Show what's actually before the marker
    marker = b'// BattleScreen callback'
    midx = data.find(marker)
    if midx >= 0:
        context = data[midx-50:midx]
        print(f"Actual bytes before marker ({midx-50}-{midx}): {repr(context)}")
        print(f"Hex: {context.hex()}")

    # Also check if the brace is already there  
    check = b'    }\r\n  }\r\n  \r\n  // BattleScreen callback'
    if check in data:
        print("Closing brace already present!")
