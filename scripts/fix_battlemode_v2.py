"""Fix battleMode in Dungeon and WorldBoss files - handles large files"""
import sys

files = {
    "src/components/dungeon/DungeonBattleRoom.jsx": [
        ('                battleMode={targetMode ? "zombie" : "score"}\n                scoreInput={targetMode ? "target" : "keypad"}',
         '                battleMode="score"\n                scoreInput={targetMode ? "target" : "keypad"}'),
    ],
    "src/components/worldboss/WorldBossAttack.jsx": [
        ('                battleMode={targetMode ? "zombie" : "score"}\n                scoreInput={targetMode ? "target" : "keypad"}',
         '                battleMode="score"\n                scoreInput={targetMode ? "target" : "keypad"}'),
    ],
}

ok = True
for path, replacements in files.items():
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            print(f"  OK: {path} - replaced")
        else:
            print(f"  ERROR: {path} - pattern NOT found")
            # Show context for debugging
            idx = content.find("battleMode=")
            if idx >= 0:
                print(f"    Found 'battleMode=' at index {idx}")
                print(f"    Context: {repr(content[idx:idx+100])}")
            ok = False
    if ok:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

if ok:
    print("\nAll files updated successfully!")
    sys.exit(0)
else:
    print("\nSome files failed!")
    sys.exit(1)
