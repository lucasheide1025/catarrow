"""Replace battleMode={battleMode} -> battleMode="score" + add scoreInput prop in MonsterBattle.jsx"""
import re

path = "src/components/member/MonsterBattle.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '          battleMode={battleMode}\n          difficulty={{hp:1, atk:1, def:1}}'
new = '          battleMode="score"\n          scoreInput={targetMode ? "target" : "keypad"}\n          difficulty={{hp:1, atk:1, def:1}}'

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: MonsterBattle.jsx updated")
else:
    print("ERROR: Could not find the target string")
    # Show context around battleMode for debugging
    idx = content.find("battleMode={battleMode}")
    if idx >= 0:
        print("Found battleMode={battleMode} but context differs:")
        print(repr(content[idx:idx+200]))
    else:
        print("battleMode={battleMode} not found at all")
