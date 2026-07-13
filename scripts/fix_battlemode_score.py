"""Fix battleMode={targetMode ? "zombie" : "score"} -> battleMode="score" in all mode files"""
import os, glob

base = "src/components"
files = {
    f"{base}/party/PartyBattleRoom.jsx": (
        '              battleMode={targetMode ? "zombie" : "score"}\n              scoreInput={targetMode ? "target" : "keypad"}',
        '              battleMode="score"\n              scoreInput={targetMode ? "target" : "keypad"}',
    ),
    f"{base}/dungeon/DungeonBattleRoom.jsx": (
        '                battleMode={targetMode ? "zombie" : "score"}\n                scoreInput={targetMode ? "target" : "keypad"}',
        '                battleMode="score"\n                scoreInput={targetMode ? "target" : "keypad"}',
    ),
    f"{base}/worldboss/WorldBossAttack.jsx": (
        '                battleMode={targetMode ? "zombie" : "score"}\n                scoreInput={targetMode ? "target" : "keypad"}',
        '                battleMode="score"\n                scoreInput={targetMode ? "target" : "keypad"}',
    ),
}

for path, (old, new) in files.items():
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new, 1)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✓ {path}")
    else:
        print(f"  ✗ {path} - pattern NOT FOUND")

print("Done!")
