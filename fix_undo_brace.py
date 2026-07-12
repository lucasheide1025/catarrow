import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('src/components/member/MonsterBattle.jsx', 'rb') as f:
    data = f.read()

# The binary patch added: `    }\r\n  }\r\n  \r\n  // BattleScreen callback`
# We need to undo it back to: `    }\r\n  \r\n  // BattleScreen callback`

old_bytes = b'    }\r\n  }\r\n  \r\n  // BattleScreen callback'
target_bytes = b'    }\r\n  \r\n  // BattleScreen callback'

idx = data.find(old_bytes)
if idx >= 0:
    line_no = data[:idx].count(b'\n') + 1
    print(f"Found double-brace pattern at byte {idx}, line ~{line_no}")
    data = data[:idx] + target_bytes + data[idx+len(old_bytes):]
    with open('src/components/member/MonsterBattle.jsx', 'wb') as f:
        f.write(data)
    print("[OK] Removed the extra } that prematurely closed the component")
else:
    print("[WARN] Pattern not found")
    # Check what's actually at that location
    marker = b'// BattleScreen callback'
    midx = data.find(marker)
    if midx >= 0:
        context = data[midx-40:midx+10]
        print(f"Actual bytes before marker: {repr(context)}")
        # If there are 2 } chars before the marker, we have the double-brace issue
        count = data[:midx].count(b'}')
        print(f"Total }} chars in file: {count}")
